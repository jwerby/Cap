import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildThumbnailKeys,
	getBackfillRequiredEnv,
	isMissingObjectError,
	parseBackfillArgs,
	parseBooleanEnv,
} from "./thumbnail-backfill-utils.mjs";

test("buildThumbnailKeys returns the video result and thumbnail keys", () => {
	assert.deepEqual(
		buildThumbnailKeys({ ownerId: "user-123", videoId: "video-456" }),
		{
			resultKey: "user-123/video-456/result.mp4",
			thumbnailKey: "user-123/video-456/screenshot/screen-capture.jpg",
		},
	);
});

test("parseBackfillArgs defaults to dry run and a bounded limit", () => {
	assert.deepEqual(parseBackfillArgs([]), {
		apply: false,
		limit: 25,
		videoId: undefined,
	});
});

test("parseBackfillArgs accepts apply, video id, and clamps limit", () => {
	assert.deepEqual(
		parseBackfillArgs(["--apply", "--video-id", "abc123", "--limit", "9999"]),
		{
			apply: true,
			limit: 500,
			videoId: "abc123",
		},
	);
});

test("isMissingObjectError recognizes S3 404 shapes", () => {
	assert.equal(isMissingObjectError({ name: "NotFound" }), true);
	assert.equal(
		isMissingObjectError({ $metadata: { httpStatusCode: 404 } }),
		true,
	);
	assert.equal(isMissingObjectError({ name: "AccessDenied" }), false);
});

test("parseBooleanEnv reads only true as enabled", () => {
	assert.equal(parseBooleanEnv("true"), true);
	assert.equal(parseBooleanEnv("false"), false);
	assert.equal(parseBooleanEnv(undefined), false);
});

test("getBackfillRequiredEnv allows dry runs without a media server URL", () => {
	assert.deepEqual(
		getBackfillRequiredEnv(
			{
				DATABASE_URL: "mysql://example",
				CAP_AWS_BUCKET: "bucket",
				CAP_AWS_REGION: "us-east-1",
			},
			false,
		),
		{
			DATABASE_URL: "mysql://example",
			CAP_AWS_BUCKET: "bucket",
			CAP_AWS_REGION: "us-east-1",
		},
	);
});

test("getBackfillRequiredEnv requires a media server URL when applying", () => {
	assert.throws(
		() =>
			getBackfillRequiredEnv(
				{
					DATABASE_URL: "mysql://example",
					CAP_AWS_BUCKET: "bucket",
					CAP_AWS_REGION: "us-east-1",
				},
				true,
			),
		/Missing required env: MEDIA_SERVER_URL/,
	);
});
