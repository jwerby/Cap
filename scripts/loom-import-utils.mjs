const defaultDownloadFormat = "bv*+ba/b";
const loomSourceQuery = `query GetVideoSource($videoId: ID!, $password: String, $acceptableMimes: [CloudfrontVideoAcceptableMime]) {
	getVideo(id: $videoId, password: $password) {
		... on RegularUserVideo {
			nullableRawCdnUrl(acceptableMimes: $acceptableMimes, password: $password) {
				url
			}
		}
	}
}`;

const loomTranscodedQuery = `query GetVideoTranscodedUrl($videoId: ID!, $forceOriginal: Boolean) {
	getVideoTranscodedUrl(videoId: $videoId, forceOriginal: $forceOriginal) {
		... on VideoSource {
			url
		}
	}
}`;

const loomRawCdnQuery = `query GetVideoRawCdnUrl($videoId: ID!, $password: String) {
	getVideo(id: $videoId, password: $password) {
		... on RegularUserVideo {
			rawCdnUrl {
				url
			}
		}
	}
}`;

const loomRegenerateMp4Mutation = `mutation RegenerateMP4($input: RegenerateMP4Input!) {
	regenerateMP4(input: $input) {
		... on RegenerateMP4Payload {
			__typename
			success
		}
		... on GenericError {
			__typename
			message
		}
		... on VideoNotFoundError {
			__typename
			message
		}
	}
}`;

const baseDownloadArgs = ({ format, sourceTemplate, url }) => [
	"--no-playlist",
	"--no-progress",
	"-f",
	format ?? defaultDownloadFormat,
	"--merge-output-format",
	"mp4",
	"-o",
	sourceTemplate,
	url,
];

const withCookies = (args, cookiesFromBrowser) =>
	cookiesFromBrowser
		? [
				...args.slice(0, -1),
				"--cookies-from-browser",
				cookiesFromBrowser,
				args.at(-1),
			]
		: args;

export function buildDownloadAttempts({
	cookiesFromBrowser,
	format = defaultDownloadFormat,
	sourceTemplate,
	url,
}) {
	const defaultArgs = baseDownloadArgs({ format, sourceTemplate, url });
	const attempts = [{ label: "default", args: defaultArgs }];

	if (!cookiesFromBrowser) return attempts;

	const mp4Args = baseDownloadArgs({
		format: "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
		sourceTemplate,
		url,
	});
	const anyArgs = baseDownloadArgs({
		format: "b/bv*+ba",
		sourceTemplate,
		url,
	});

	attempts.push(
		{
			label: "browser-cookies",
			args: withCookies(defaultArgs, cookiesFromBrowser),
		},
		{
			label: "browser-cookies-mp4",
			args: [
				...withCookies(mp4Args, cookiesFromBrowser).slice(0, -1),
				"--format-sort",
				"res:1080,ext:mp4:m4a",
				url,
			],
		},
		{
			label: "browser-cookies-any",
			args: withCookies(anyArgs, cookiesFromBrowser),
		},
		{
			label: "browser-cookies-raw-url",
			args: [
				...withCookies(anyArgs, cookiesFromBrowser).slice(0, -1),
				"--force-generic-extractor",
				url,
			],
		},
	);

	return attempts;
}

export function getPaceDelayMs({ completedImports, minMs, maxMs }) {
	if (completedImports === 0) return 0;
	const min = Math.max(0, Math.floor(minMs));
	const max = Math.max(min, Math.floor(maxMs));
	return min + Math.floor(Math.random() * (max - min + 1));
}

export function getRetryDelayMs({ attemptIndex, baseMs, maxMs }) {
	const base = Math.max(0, Math.floor(baseMs));
	const max = Math.max(base, Math.floor(maxMs));
	return Math.min(max, base * 2 ** attemptIndex);
}

export function parseNonNegativeInt(value, fallback) {
	const parsed = Number.parseInt(String(value ?? ""), 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function parseIdSet(value) {
	return new Set(
		String(value ?? "")
			.split(/[\s,]+/)
			.map((item) => item.trim())
			.filter(Boolean),
	);
}

export function buildLoomSourceRequest({
	acceptableMimes = ["M3U8"],
	loomVideoId,
}) {
	return {
		url: "https://www.loom.com/graphql",
		options: {
			method: "POST",
			headers: {
				accept: "application/json",
				"apollographql-client-name": "web",
				"apollographql-client-version": "45a5bd4",
				"content-type": "application/json",
				"graphql-operation-name": "GetVideoSource",
				origin: "https://www.loom.com",
				referer: `https://www.loom.com/share/${loomVideoId}`,
				"x-loom-request-source": "loom_web_45a5bd4",
			},
			body: JSON.stringify({
				operationName: "GetVideoSource",
				variables: {
					acceptableMimes,
					password: null,
					videoId: loomVideoId,
				},
				query: loomSourceQuery,
			}),
		},
	};
}

export function buildLoomTranscodedRequest({ loomVideoId }) {
	return {
		url: "https://www.loom.com/graphql",
		options: {
			method: "POST",
			headers: {
				accept: "application/json",
				"apollographql-client-name": "web",
				"apollographql-client-version": "45a5bd4",
				"content-type": "application/json",
				"graphql-operation-name": "GetVideoTranscodedUrl",
				origin: "https://www.loom.com",
				referer: `https://www.loom.com/share/${loomVideoId}`,
				"x-loom-request-source": "loom_web_45a5bd4",
			},
			body: JSON.stringify({
				operationName: "GetVideoTranscodedUrl",
				variables: {
					forceOriginal: false,
					videoId: loomVideoId,
				},
				query: loomTranscodedQuery,
			}),
		},
	};
}

export function buildLoomRawCdnRequest({ loomVideoId }) {
	return {
		url: "https://www.loom.com/graphql",
		options: {
			method: "POST",
			headers: {
				accept: "application/json",
				"apollographql-client-name": "web",
				"apollographql-client-version": "45a5bd4",
				"content-type": "application/json",
				"graphql-operation-name": "GetVideoRawCdnUrl",
				origin: "https://www.loom.com",
				referer: `https://www.loom.com/share/${loomVideoId}`,
				"x-loom-request-source": "loom_web_45a5bd4",
			},
			body: JSON.stringify({
				operationName: "GetVideoRawCdnUrl",
				variables: {
					password: null,
					videoId: loomVideoId,
				},
				query: loomRawCdnQuery,
			}),
		},
	};
}

export function buildLoomRegenerateMp4Request({ loomVideoId }) {
	return {
		url: "https://www.loom.com/graphql",
		options: {
			method: "POST",
			headers: {
				accept: "application/json",
				"apollographql-client-name": "web",
				"apollographql-client-version": "45a5bd4",
				"content-type": "application/json",
				"graphql-operation-name": "RegenerateMP4",
				origin: "https://www.loom.com",
				referer: `https://www.loom.com/share/${loomVideoId}`,
				"x-loom-request-source": "loom_web_45a5bd4",
			},
			body: JSON.stringify({
				operationName: "RegenerateMP4",
				variables: {
					input: {
						regenerationType: "DOWNLOAD",
						videoId: loomVideoId,
					},
				},
				query: loomRegenerateMp4Mutation,
			}),
		},
	};
}

export function extractLoomSourceUrl(data) {
	const url = data?.data?.getVideo?.nullableRawCdnUrl?.url;
	return typeof url === "string" && url.length > 0 ? url : null;
}

export function extractLoomTranscodedUrl(data) {
	const url = data?.data?.getVideoTranscodedUrl?.url;
	return typeof url === "string" && url.length > 0 ? url : null;
}

export function extractLoomRawCdnUrl(data) {
	const url = data?.data?.getVideo?.rawCdnUrl?.url;
	return typeof url === "string" && url.length > 0 ? url : null;
}

export function extractLoomRegenerateMp4Success(data) {
	const result = data?.data?.regenerateMP4;
	return (
		result?.__typename === "RegenerateMP4Payload" && result.success === true
	);
}

export function withPlaylistQuery(uri, playlistUrl) {
	const playlist = new URL(playlistUrl);
	const url = new URL(uri, playlist);
	if (!url.search) url.search = playlist.search;
	return url.toString();
}

export function isHlsPlaylistUri(uri) {
	return new URL(uri, "https://loom.local").pathname.endsWith(".m3u8");
}
