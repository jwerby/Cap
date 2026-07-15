#!/usr/bin/env node

import {
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import mysql from "mysql2/promise";
import {
	buildThumbnailKeys,
	getBackfillRequiredEnv,
	isMissingObjectError,
	parseBackfillArgs,
	parseBooleanEnv,
} from "./thumbnail-backfill-utils.mjs";

const args = parseBackfillArgs(process.argv.slice(2));
const required = getBackfillRequiredEnv(process.env, args.apply);

function getCredentials() {
	const accessKeyId = process.env.CAP_AWS_ACCESS_KEY?.trim();
	const secretAccessKey = process.env.CAP_AWS_SECRET_KEY?.trim();

	if (!accessKeyId && !secretAccessKey) return undefined;
	if (!accessKeyId || !secretAccessKey) {
		throw new Error(
			"CAP_AWS_ACCESS_KEY and CAP_AWS_SECRET_KEY must be provided together",
		);
	}

	return { accessKeyId, secretAccessKey };
}

const s3 = new S3Client({
	endpoint: process.env.S3_INTERNAL_ENDPOINT || process.env.CAP_AWS_ENDPOINT,
	region: required.CAP_AWS_REGION,
	credentials: getCredentials(),
	forcePathStyle: parseBooleanEnv(process.env.S3_PATH_STYLE),
});

async function objectExists(key) {
	try {
		await s3.send(
			new HeadObjectCommand({
				Bucket: required.CAP_AWS_BUCKET,
				Key: key,
			}),
		);
		return true;
	} catch (error) {
		if (isMissingObjectError(error)) return false;
		throw error;
	}
}

async function generateThumbnail(videoUrl) {
	const headers = { "Content-Type": "application/json" };
	const webhookSecret = process.env.MEDIA_SERVER_WEBHOOK_SECRET?.trim();
	if (webhookSecret) headers["x-media-server-secret"] = webhookSecret;

	const response = await fetch(
		new URL("/video/thumbnail", required.MEDIA_SERVER_URL),
		{
			method: "POST",
			headers,
			body: JSON.stringify({ videoUrl }),
		},
	);

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(
			`Media server thumbnail failed: ${response.status} ${body}`,
		);
	}

	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("image/jpeg")) {
		throw new Error(
			`Media server returned unexpected content type: ${contentType}`,
		);
	}

	const bytes = new Uint8Array(await response.arrayBuffer());
	if (bytes.length === 0)
		throw new Error("Media server returned an empty thumbnail");

	return bytes;
}

async function backfillVideo(row) {
	const { resultKey, thumbnailKey } = buildThumbnailKeys({
		ownerId: row.ownerId,
		videoId: row.id,
	});

	if (await objectExists(thumbnailKey)) {
		return { status: "skipped", reason: "thumbnail-exists", videoId: row.id };
	}

	if (!(await objectExists(resultKey))) {
		return { status: "skipped", reason: "result-missing", videoId: row.id };
	}

	if (!args.apply) {
		return { status: "dry-run", thumbnailKey, videoId: row.id };
	}

	const videoUrl = await getSignedUrl(
		s3,
		new GetObjectCommand({
			Bucket: required.CAP_AWS_BUCKET,
			Key: resultKey,
		}),
		{ expiresIn: 60 * 60 },
	);
	const thumbnail = await generateThumbnail(videoUrl);

	await s3.send(
		new PutObjectCommand({
			Bucket: required.CAP_AWS_BUCKET,
			Key: thumbnailKey,
			Body: thumbnail,
			ContentType: "image/jpeg",
			CacheControl: "public, max-age=3600",
		}),
	);

	return { status: "backfilled", thumbnailKey, videoId: row.id };
}

function buildVideoQuery() {
	const conditions = [
		"bucket IS NULL",
		"storageIntegrationId IS NULL",
		"isScreenshot = 0",
	];
	const params = [];

	if (args.videoId) {
		conditions.push("id = ?");
		params.push(args.videoId);
	}

	return {
		params,
		sql: `SELECT id, ownerId FROM videos WHERE ${conditions.join(" AND ")} ORDER BY createdAt ASC LIMIT ${args.limit}`,
	};
}

const connection = await mysql.createConnection(required.DATABASE_URL);

try {
	const query = buildVideoQuery();
	const [rows] = await connection.execute(query.sql, query.params);
	const results = [];

	for (const row of rows) {
		try {
			results.push(await backfillVideo(row));
		} catch (error) {
			results.push({
				status: "error",
				videoId: row.id,
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	console.log(
		JSON.stringify(
			{
				apply: args.apply,
				limit: args.limit,
				videoId: args.videoId,
				results,
			},
			null,
			2,
		),
	);
} finally {
	await connection.end();
}
