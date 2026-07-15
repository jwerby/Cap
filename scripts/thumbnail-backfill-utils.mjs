export const DEFAULT_THUMBNAIL_BACKFILL_LIMIT = 25;
export const MAX_THUMBNAIL_BACKFILL_LIMIT = 500;

export function buildThumbnailKeys({ ownerId, videoId }) {
	return {
		resultKey: `${ownerId}/${videoId}/result.mp4`,
		thumbnailKey: `${ownerId}/${videoId}/screenshot/screen-capture.jpg`,
	};
}

export function parseBooleanEnv(value) {
	return String(value ?? "").toLowerCase() === "true";
}

export function parsePositiveInt(value, fallback) {
	const parsed = Number.parseInt(String(value ?? ""), 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseBackfillArgs(argv) {
	let apply = false;
	let limit = DEFAULT_THUMBNAIL_BACKFILL_LIMIT;
	let videoId;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === "--apply") {
			apply = true;
			continue;
		}

		if (arg === "--limit") {
			limit = parsePositiveInt(argv[index + 1], limit);
			index += 1;
			continue;
		}

		if (arg?.startsWith("--limit=")) {
			limit = parsePositiveInt(arg.slice("--limit=".length), limit);
			continue;
		}

		if (arg === "--video-id") {
			videoId = argv[index + 1];
			index += 1;
			continue;
		}

		if (arg?.startsWith("--video-id=")) {
			videoId = arg.slice("--video-id=".length);
			continue;
		}

		throw new Error(`Unknown argument: ${arg}`);
	}

	return {
		apply,
		limit: Math.min(limit, MAX_THUMBNAIL_BACKFILL_LIMIT),
		videoId: videoId || undefined,
	};
}

export function isMissingObjectError(error) {
	return (
		error?.name === "NotFound" ||
		error?.name === "NoSuchKey" ||
		error?.Code === "NoSuchKey" ||
		error?.$metadata?.httpStatusCode === 404
	);
}

export function getRequiredEnv(env, keys) {
	const missing = keys.filter((key) => !String(env[key] ?? "").trim());
	if (missing.length > 0) {
		throw new Error(`Missing required env: ${missing.join(", ")}`);
	}

	return Object.fromEntries(keys.map((key) => [key, String(env[key]).trim()]));
}

export function getBackfillRequiredEnv(env, apply) {
	return getRequiredEnv(env, [
		"DATABASE_URL",
		"CAP_AWS_BUCKET",
		"CAP_AWS_REGION",
		...(apply ? ["MEDIA_SERVER_URL"] : []),
	]);
}
