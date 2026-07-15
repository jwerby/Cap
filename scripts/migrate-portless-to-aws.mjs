#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import {
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import mysql from "mysql2/promise";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const assetsOnly = args.has("--assets-only");
const dbOnly = args.has("--db-only");
const concurrency = Number.parseInt(
	process.env.CAP_MIGRATE_CONCURRENCY ?? "4",
	10,
);

if (assetsOnly && dbOnly) {
	throw new Error("Use only one of --assets-only or --db-only.");
}

const config = {
	localOrgId: "bqy3bj5e3jt7g3s",
	prodOrgId: "hqem1fz7g23nqae",
	alexandraId: "538d4bd0593b11f",
	alexandraEmail: "alexandra@portstbd.com",
	prodJeffId: "bj09cb2xahbqjvx",
	prodBucket: "portstbd-watch-production",
	prodRegion: "us-east-1",
};

const idAlphabet = "0123456789abcdefghjkmnpqrstvwxyz";

function stableId(parts) {
	const hash = createHash("sha256").update(parts.join(":"), "utf8").digest();
	let id = "";
	for (let index = 0; id.length < 15; index += 1) {
		id += idAlphabet[hash[index] % idAlphabet.length];
	}
	return id;
}

function parseEnv(path) {
	const values = {};
	for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const index = trimmed.indexOf("=");
		if (index === -1) continue;
		const key = trimmed.slice(0, index);
		let value = trimmed.slice(index + 1);
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		values[key] = value;
	}
	return values;
}

function prodDbConfig() {
	const secret = JSON.parse(
		execFileSync(
			"aws",
			[
				"secretsmanager",
				"get-secret-value",
				"--secret-id",
				"portstbd-watch/production",
				"--query",
				"SecretString",
				"--output",
				"text",
			],
			{ encoding: "utf8" },
		),
	);
	const url = new URL(secret.DATABASE_URL);
	return {
		host: "127.0.0.1",
		port: 13306,
		user: decodeURIComponent(url.username),
		password: decodeURIComponent(url.password),
		database: url.pathname.slice(1),
	};
}

function jsonValue(value) {
	if (value === undefined) return null;
	if (value === null) return null;
	if (typeof value === "string") return value;
	return JSON.stringify(value);
}

function contentTypeForKey(key, fallback) {
	if (fallback) return fallback;
	if (key.endsWith(".mp4")) return "video/mp4";
	if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
	if (key.endsWith(".gif")) return "image/gif";
	if (key.endsWith(".png")) return "image/png";
	if (key.endsWith(".webp")) return "image/webp";
	return "application/octet-stream";
}

function cacheControlForKey(key) {
	if (
		key.endsWith(".mp4") ||
		key.endsWith(".jpg") ||
		key.endsWith(".jpeg") ||
		key.endsWith(".gif") ||
		key.endsWith(".png") ||
		key.endsWith(".webp")
	) {
		return "public, max-age=31536000, immutable";
	}
	return undefined;
}

async function listObjects(client, bucket, prefix) {
	const objects = [];
	let ContinuationToken;
	do {
		const response = await client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: prefix,
				ContinuationToken,
			}),
		);
		for (const object of response.Contents ?? []) {
			if (object.Key) objects.push(object);
		}
		ContinuationToken = response.NextContinuationToken;
	} while (ContinuationToken);
	return objects;
}

async function mapLimit(items, limit, task) {
	const results = [];
	let nextIndex = 0;
	const workers = Array.from(
		{ length: Math.min(limit, items.length) },
		async () => {
			while (nextIndex < items.length) {
				const index = nextIndex;
				nextIndex += 1;
				results[index] = await task(items[index], index);
			}
		},
	);
	await Promise.all(workers);
	return results;
}

async function headObject(client, bucket, key) {
	try {
		return await client.send(
			new HeadObjectCommand({ Bucket: bucket, Key: key }),
		);
	} catch (error) {
		if (
			error?.$metadata?.httpStatusCode === 404 ||
			error?.name === "NotFound"
		) {
			return null;
		}
		throw error;
	}
}

async function copyObject({
	sourceClient,
	destClient,
	sourceBucket,
	destBucket,
	object,
}) {
	const existing = await headObject(destClient, destBucket, object.Key);
	if (existing?.ContentLength === object.Size) {
		return { copied: false, skipped: true, bytes: object.Size ?? 0 };
	}
	const source = await sourceClient.send(
		new GetObjectCommand({ Bucket: sourceBucket, Key: object.Key }),
	);
	const body = Buffer.from(await source.Body.transformToByteArray());
	await destClient.send(
		new PutObjectCommand({
			Bucket: destBucket,
			Key: object.Key,
			Body: body,
			ContentLength: body.byteLength,
			ContentType: contentTypeForKey(object.Key, source.ContentType),
			CacheControl: cacheControlForKey(object.Key),
			Metadata: source.Metadata,
		}),
	);
	return { copied: true, skipped: false, bytes: object.Size ?? 0 };
}

async function loadLocalData(local) {
	const [[alexandra]] = await local.query(
		"select * from users where id = ? and email = ? limit 1",
		[config.alexandraId, config.alexandraEmail],
	);
	if (!alexandra) throw new Error("Alexandra user missing in local DB.");

	const [videos] = await local.query(
		"select * from videos where ownerId = ? and orgId = ? order by createdAt, id",
		[config.alexandraId, config.localOrgId],
	);
	const videoIds = videos.map((video) => video.id);
	if (videoIds.length === 0)
		throw new Error("No Alexandra videos found in local DB.");

	const [importedVideos] = await local.query(
		`select * from imported_videos where orgId = ? and id in (${videoIds.map(() => "?").join(",")})`,
		[config.localOrgId, ...videoIds],
	);
	const [spaces] = await local.query(
		"select * from spaces where organizationId = ? order by createdAt, id",
		[config.localOrgId],
	);
	const [spaceVideos] = await local.query(
		`select sv.* from space_videos sv inner join videos v on v.id = sv.videoId where v.ownerId = ? and v.orgId = ? order by sv.addedAt, sv.id`,
		[config.alexandraId, config.localOrgId],
	);
	const [folders] = await local.query(
		"select * from folders where organizationId = ? order by createdAt, id",
		[config.localOrgId],
	);

	return { alexandra, videos, importedVideos, spaces, spaceVideos, folders };
}

function assertProdUserShape(users) {
	for (const user of users) {
		if (
			user.email === config.alexandraEmail &&
			user.id !== config.alexandraId
		) {
			throw new Error(
				`Prod Alexandra email already belongs to different user id ${user.id}.`,
			);
		}
		if (
			user.id === config.alexandraId &&
			user.email !== config.alexandraEmail
		) {
			throw new Error(
				`Prod Alexandra id already belongs to different email ${user.email}.`,
			);
		}
	}
}

async function migrateDb(prod, data) {
	await prod.beginTransaction();
	try {
		const [prodUsers] = await prod.query(
			"select id, email from users where id = ? or email = ?",
			[config.alexandraId, config.alexandraEmail],
		);
		assertProdUserShape(prodUsers);

		await prod.query(
			`insert into users (
				id, name, lastName, email, emailVerified, image, preferences,
				activeOrganizationId, created_at, updated_at, onboardingSteps,
				onboarding_completed_at, defaultOrgId, authSessionVersion
			) values (?, ?, ?, ?, ?, ?, cast(? as json), ?, ?, ?, cast(? as json), ?, ?, ?)
			on duplicate key update
				name = values(name),
				lastName = values(lastName),
				image = values(image),
				preferences = values(preferences),
				activeOrganizationId = values(activeOrganizationId),
				defaultOrgId = values(defaultOrgId)`,
			[
				config.alexandraId,
				data.alexandra.name ?? "Alexandra",
				data.alexandra.lastName,
				config.alexandraEmail,
				data.alexandra.emailVerified,
				data.alexandra.image,
				jsonValue(data.alexandra.preferences),
				config.prodOrgId,
				data.alexandra.created_at,
				new Date(),
				jsonValue(data.alexandra.onboardingSteps),
				data.alexandra.onboarding_completed_at,
				config.prodOrgId,
				data.alexandra.authSessionVersion ?? 0,
			],
		);

		await prod.query(
			"update organizations set allowedEmailDomain = ?, updatedAt = updatedAt where id = ?",
			["portstbd.com", config.prodOrgId],
		);

		const [[existingMember]] = await prod.query(
			"select id from organization_members where userId = ? and organizationId = ? limit 1",
			[config.alexandraId, config.prodOrgId],
		);
		if (existingMember) {
			await prod.query(
				"update organization_members set role = ?, updatedAt = ? where id = ?",
				["member", new Date(), existingMember.id],
			);
		} else {
			await prod.query(
				`insert into organization_members (id, userId, organizationId, role, hasProSeat, createdAt, updatedAt)
				values (?, ?, ?, ?, ?, ?, ?)`,
				[
					stableId([
						"organization-member",
						config.prodOrgId,
						config.alexandraId,
					]),
					config.alexandraId,
					config.prodOrgId,
					"member",
					0,
					new Date(),
					new Date(),
				],
			);
		}

		for (const video of data.videos) {
			await prod.query(
				`insert into videos (
					id, ownerId, orgId, name, bucket, storageIntegrationId, duration,
					width, height, fps, metadata, public, settings, transcriptionStatus,
					source, folderId, createdAt, updatedAt, password, xStreamInfo,
					firstViewEmailSentAt, isScreenshot, awsRegion, awsBucket,
					videoStartTime, audioStartTime, jobId, jobStatus, skipProcessing
				) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, cast(? as json), ?, cast(? as json), ?, cast(? as json), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				on duplicate key update id = id`,
				[
					video.id,
					config.alexandraId,
					config.prodOrgId,
					video.name,
					video.bucket,
					video.storageIntegrationId,
					video.duration,
					video.width,
					video.height,
					video.fps,
					jsonValue(video.metadata),
					video.public,
					jsonValue(video.settings),
					video.transcriptionStatus,
					jsonValue(video.source),
					video.folderId,
					video.createdAt,
					video.updatedAt,
					video.password,
					video.xStreamInfo,
					video.firstViewEmailSentAt,
					video.isScreenshot,
					video.awsRegion,
					video.awsBucket,
					video.videoStartTime,
					video.audioStartTime,
					video.jobId,
					video.jobStatus,
					video.skipProcessing,
				],
			);
		}

		for (const importedVideo of data.importedVideos) {
			await prod.query(
				`insert into imported_videos (id, orgId, source, source_id)
				values (?, ?, ?, ?)
				on duplicate key update id = values(id)`,
				[
					importedVideo.id,
					config.prodOrgId,
					importedVideo.source,
					importedVideo.source_id,
				],
			);
		}

		for (const folder of data.folders) {
			await prod.query(
				`insert into folders (id, name, color, organizationId, createdById, parentId, spaceId, createdAt, updatedAt)
				values (?, ?, ?, ?, ?, ?, ?, ?, ?)
				on duplicate key update id = id`,
				[
					folder.id,
					folder.name,
					folder.color,
					config.prodOrgId,
					config.alexandraId,
					folder.parentId,
					folder.spaceId,
					folder.createdAt,
					folder.updatedAt,
				],
			);
		}

		for (const space of data.spaces) {
			await prod.query(
				`insert into spaces (
					id, \`primary\`, name, organizationId, createdById, iconUrl,
					description, settings, password, createdAt, updatedAt, privacy
				) values (?, ?, ?, ?, ?, ?, ?, cast(? as json), ?, ?, ?, ?)
				on duplicate key update id = id`,
				[
					space.id,
					space.primary,
					space.name,
					config.prodOrgId,
					config.alexandraId,
					space.iconUrl,
					space.description,
					jsonValue(space.settings),
					space.password,
					space.createdAt,
					space.updatedAt,
					space.privacy,
				],
			);
		}

		for (const spaceVideo of data.spaceVideos) {
			await prod.query(
				`insert into space_videos (id, spaceId, folderId, videoId, addedById, addedAt)
				values (?, ?, ?, ?, ?, ?)
				on duplicate key update id = id`,
				[
					spaceVideo.id,
					spaceVideo.spaceId,
					spaceVideo.folderId,
					spaceVideo.videoId,
					config.alexandraId,
					spaceVideo.addedAt,
				],
			);
		}

		for (const space of data.spaces) {
			for (const userId of [config.alexandraId, config.prodJeffId]) {
				await prod.query(
					`insert into space_members (id, spaceId, userId, role, createdAt, updatedAt)
					values (?, ?, ?, ?, ?, ?)
					on duplicate key update role = values(role), updatedAt = values(updatedAt)`,
					[
						stableId(["space-member", space.id, userId]),
						space.id,
						userId,
						"admin",
						new Date(),
						new Date(),
					],
				);
			}
		}

		await prod.commit();
	} catch (error) {
		await prod.rollback();
		throw error;
	}
}

async function summarizeProd(prod) {
	const [[counts]] = await prod.query(
		`select
			(select count(*) from users where id = ?) alexandraUsers,
			(select count(*) from organization_members where userId = ? and organizationId = ?) alexandraOrgMemberships,
			(select count(*) from videos where ownerId = ? and orgId = ?) alexandraVideos,
			(select count(*) from imported_videos where orgId = ?) importedVideos,
			(select count(*) from spaces where organizationId = ?) spaces,
			(select count(*) from space_videos sv inner join spaces s on s.id = sv.spaceId where s.organizationId = ?) spaceVideos,
			(select count(*) from space_members sm inner join spaces s on s.id = sm.spaceId where s.organizationId = ? and sm.userId = ?) alexandraSpaceMemberships,
			(select count(*) from space_members sm inner join spaces s on s.id = sm.spaceId where s.organizationId = ? and sm.userId = ?) jeffSpaceMemberships`,
		[
			config.alexandraId,
			config.alexandraId,
			config.prodOrgId,
			config.alexandraId,
			config.prodOrgId,
			config.prodOrgId,
			config.prodOrgId,
			config.prodOrgId,
			config.prodOrgId,
			config.alexandraId,
			config.prodOrgId,
			config.prodJeffId,
		],
	);
	return counts;
}

async function main() {
	const env = parseEnv(".env");
	const local = await mysql.createConnection({
		host: "127.0.0.1",
		user: "root",
		database: "planetscale",
	});
	const prod = await mysql.createConnection(prodDbConfig());
	const sourceClient = new S3Client({
		endpoint: env.CAP_AWS_ENDPOINT,
		region: env.CAP_AWS_REGION,
		credentials: {
			accessKeyId: env.CAP_AWS_ACCESS_KEY,
			secretAccessKey: env.CAP_AWS_SECRET_KEY,
		},
		forcePathStyle: true,
	});
	const destClient = new S3Client({ region: config.prodRegion });

	try {
		const data = await loadLocalData(local);
		const videoIds = new Set(data.videos.map((video) => video.id));
		const sourceObjects = await listObjects(
			sourceClient,
			env.CAP_AWS_BUCKET,
			`${config.alexandraId}/`,
		);
		const objectsToCopy = sourceObjects.filter((object) => {
			const videoId = object.Key.split("/")[1];
			return videoIds.has(videoId);
		});
		const sourcePrefixes = new Set(
			sourceObjects.map((object) => object.Key.split("/")[1]).filter(Boolean),
		);
		const orphanPrefixes = [...sourcePrefixes].filter(
			(prefix) => !videoIds.has(prefix),
		);
		const objectPrefixes = new Set(
			objectsToCopy.map((object) => object.Key.split("/")[1]).filter(Boolean),
		);
		const missingAssetPrefixes = [...videoIds].filter(
			(videoId) => !objectPrefixes.has(videoId),
		);
		const totalBytes = objectsToCopy.reduce(
			(sum, object) => sum + (object.Size ?? 0),
			0,
		);

		console.log(
			JSON.stringify(
				{
					mode: apply ? "apply" : "dry-run",
					assetsOnly,
					dbOnly,
					local: {
						videos: data.videos.length,
						importedVideos: data.importedVideos.length,
						spaces: data.spaces.length,
						spaceVideos: data.spaceVideos.length,
						folders: data.folders.length,
					},
					s3: {
						objectsToCopy: objectsToCopy.length,
						bytesToCopy: totalBytes,
						orphanPrefixes,
						missingAssetPrefixes,
					},
					prodBefore: await summarizeProd(prod),
				},
				null,
				2,
			),
		);

		if (!apply) return;

		if (!dbOnly) {
			let copied = 0;
			let skipped = 0;
			let copiedBytes = 0;
			const startedAt = Date.now();
			await mapLimit(objectsToCopy, concurrency, async (object, index) => {
				const result = await copyObject({
					sourceClient,
					destClient,
					sourceBucket: env.CAP_AWS_BUCKET,
					destBucket: config.prodBucket,
					object,
				});
				if (result.copied) {
					copied += 1;
					copiedBytes += result.bytes;
				} else {
					skipped += 1;
				}
				if ((index + 1) % 10 === 0 || index + 1 === objectsToCopy.length) {
					console.log(
						JSON.stringify({
							phase: "assets",
							processed: index + 1,
							total: objectsToCopy.length,
							copied,
							skipped,
							copiedBytes,
							elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
						}),
					);
				}
				return result;
			});
		}

		if (!assetsOnly) {
			await migrateDb(prod, data);
		}

		await sleep(500);
		console.log(
			JSON.stringify({ prodAfter: await summarizeProd(prod) }, null, 2),
		);
	} finally {
		await local.end();
		await prod.end();
	}
}

await main();
