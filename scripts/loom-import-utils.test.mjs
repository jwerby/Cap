import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildDownloadAttempts,
	buildLoomRawCdnRequest,
	buildLoomRegenerateMp4Request,
	buildLoomSourceRequest,
	buildLoomTranscodedRequest,
	extractLoomRawCdnUrl,
	extractLoomRegenerateMp4Success,
	extractLoomSourceUrl,
	extractLoomTranscodedUrl,
	getPaceDelayMs,
	getRetryDelayMs,
	isHlsPlaylistUri,
	parseIdSet,
	withPlaylistQuery,
} from "./loom-import-utils.mjs";

test("buildDownloadAttempts orders plain, browser-cookie, format-limited, and raw fallback methods", () => {
	const attempts = buildDownloadAttempts({
		cookiesFromBrowser: "chrome",
		format: "bv*+ba/b",
		sourceTemplate: "/tmp/source.%(ext)s",
		url: "https://www.loom.com/share/abc",
	});

	assert.deepEqual(
		attempts.map((attempt) => attempt.label),
		[
			"default",
			"browser-cookies",
			"browser-cookies-mp4",
			"browser-cookies-any",
			"browser-cookies-raw-url",
		],
	);
	assert.ok(attempts[2].args.includes("--format-sort"));
	assert.ok(attempts[4].args.includes("--force-generic-extractor"));
});

test("getPaceDelayMs returns zero before first import and bounded jitter after imports", () => {
	assert.equal(
		getPaceDelayMs({ completedImports: 0, minMs: 10, maxMs: 20 }),
		0,
	);

	for (let index = 0; index < 25; index += 1) {
		const delay = getPaceDelayMs({ completedImports: 1, minMs: 10, maxMs: 20 });
		assert.ok(delay >= 10);
		assert.ok(delay <= 20);
	}
});

test("getRetryDelayMs uses bounded exponential backoff", () => {
	assert.equal(
		getRetryDelayMs({ attemptIndex: 0, baseMs: 100, maxMs: 10_000 }),
		100,
	);
	assert.equal(
		getRetryDelayMs({ attemptIndex: 2, baseMs: 100, maxMs: 10_000 }),
		400,
	);
	assert.equal(
		getRetryDelayMs({ attemptIndex: 20, baseMs: 100, maxMs: 10_000 }),
		10_000,
	);
});

test("parseIdSet accepts comma and whitespace separated ids", () => {
	assert.deepEqual(Array.from(parseIdSet("abc, def\nghi\tabc")), [
		"abc",
		"def",
		"ghi",
	]);
});

test("buildLoomSourceRequest asks Loom for an M3U8 source URL", () => {
	const request = buildLoomSourceRequest({ loomVideoId: "abc123" });
	const body = JSON.parse(request.options.body);

	assert.equal(request.url, "https://www.loom.com/graphql");
	assert.equal(
		request.options.headers["graphql-operation-name"],
		"GetVideoSource",
	);
	assert.deepEqual(body.variables, {
		acceptableMimes: ["M3U8"],
		password: null,
		videoId: "abc123",
	});
});

test("extractLoomSourceUrl reads nullableRawCdnUrl from GraphQL data", () => {
	assert.equal(
		extractLoomSourceUrl({
			data: {
				getVideo: {
					nullableRawCdnUrl: {
						url: "https://luna.loom.com/id/video/resource/hls/playlist.m3u8",
					},
				},
			},
		}),
		"https://luna.loom.com/id/video/resource/hls/playlist.m3u8",
	);
});

test("buildLoomTranscodedRequest asks Loom for a regenerated MP4 source URL", () => {
	const request = buildLoomTranscodedRequest({ loomVideoId: "abc123" });
	const body = JSON.parse(request.options.body);

	assert.equal(request.url, "https://www.loom.com/graphql");
	assert.equal(
		request.options.headers["graphql-operation-name"],
		"GetVideoTranscodedUrl",
	);
	assert.deepEqual(body.variables, {
		forceOriginal: false,
		videoId: "abc123",
	});
});

test("extractLoomTranscodedUrl reads getVideoTranscodedUrl from GraphQL data", () => {
	assert.equal(
		extractLoomTranscodedUrl({
			data: {
				getVideoTranscodedUrl: {
					url: "https://cdn.loom.com/transcoded.mp4",
				},
			},
		}),
		"https://cdn.loom.com/transcoded.mp4",
	);
});

test("buildLoomRawCdnRequest asks Loom for its default raw CDN URL", () => {
	const request = buildLoomRawCdnRequest({ loomVideoId: "abc123" });
	const body = JSON.parse(request.options.body);

	assert.equal(request.url, "https://www.loom.com/graphql");
	assert.equal(
		request.options.headers["graphql-operation-name"],
		"GetVideoRawCdnUrl",
	);
	assert.deepEqual(body.variables, {
		password: null,
		videoId: "abc123",
	});
});

test("extractLoomRawCdnUrl reads rawCdnUrl from GraphQL data", () => {
	assert.equal(
		extractLoomRawCdnUrl({
			data: {
				getVideo: {
					rawCdnUrl: {
						url: "https://luna.loom.com/id/video/resource/dash/playlist.mpd",
					},
				},
			},
		}),
		"https://luna.loom.com/id/video/resource/dash/playlist.mpd",
	);
});

test("buildLoomRegenerateMp4Request asks Loom to regenerate a download MP4", () => {
	const request = buildLoomRegenerateMp4Request({ loomVideoId: "abc123" });
	const body = JSON.parse(request.options.body);

	assert.equal(request.url, "https://www.loom.com/graphql");
	assert.equal(
		request.options.headers["graphql-operation-name"],
		"RegenerateMP4",
	);
	assert.deepEqual(body.variables, {
		input: {
			regenerationType: "DOWNLOAD",
			videoId: "abc123",
		},
	});
});

test("extractLoomRegenerateMp4Success reads regenerateMP4 success payload", () => {
	assert.equal(
		extractLoomRegenerateMp4Success({
			data: {
				regenerateMP4: {
					__typename: "RegenerateMP4Payload",
					success: true,
				},
			},
		}),
		true,
	);
	assert.equal(
		extractLoomRegenerateMp4Success({
			data: {
				regenerateMP4: {
					__typename: "GenericError",
					message: "Nope",
				},
			},
		}),
		false,
	);
});

test("withPlaylistQuery resolves relative HLS URIs and preserves existing query", () => {
	const playlistUrl =
		"https://luna.loom.com/id/video/resource/hls/playlist.m3u8?Policy=abc&Signature=def";

	assert.equal(
		withPlaylistQuery("segment-1.ts", playlistUrl),
		"https://luna.loom.com/id/video/resource/hls/segment-1.ts?Policy=abc&Signature=def",
	);
	assert.equal(
		withPlaylistQuery("child.m3u8?already=1", playlistUrl),
		"https://luna.loom.com/id/video/resource/hls/child.m3u8?already=1",
	);
});

test("isHlsPlaylistUri detects nested playlists without query sensitivity", () => {
	assert.equal(isHlsPlaylistUri("child.m3u8"), true);
	assert.equal(isHlsPlaylistUri("child.m3u8?Policy=abc"), true);
	assert.equal(isHlsPlaylistUri("segment.ts?Policy=abc"), false);
});
