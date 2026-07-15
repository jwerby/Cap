#!/usr/bin/env node
import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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
	parseNonNegativeInt,
	withPlaylistQuery,
} from "./loom-import-utils.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const csvPath = path.join(repoRoot, "loom-import.csv");
const detailsPath = path.join(repoRoot, "loom-import-details.json");
const quiet = process.env.CAP_QUIET === "1";
const cookiesFromBrowser =
	process.env.CAP_LOOM_COOKIES_FROM_BROWSER ?? "chrome";
const loomCookieFile = process.env.CAP_LOOM_COOKIE_FILE;
const paceMinMs = parseNonNegativeInt(
	process.env.CAP_IMPORT_MIN_DELAY_MS,
	30_000,
);
const paceMaxMs = parseNonNegativeInt(
	process.env.CAP_IMPORT_MAX_DELAY_MS,
	90_000,
);
const downloadRetryDelayMs = parseNonNegativeInt(
	process.env.CAP_IMPORT_RETRY_DELAY_MS,
	8_000,
);
const downloadRetryMaxDelayMs = parseNonNegativeInt(
	process.env.CAP_IMPORT_RETRY_MAX_DELAY_MS,
	45_000,
);
const regeneratePollDelayMs = parseNonNegativeInt(
	process.env.CAP_IMPORT_REGENERATE_POLL_MS,
	45_000,
);
const regeneratePollAttempts = Math.max(
	1,
	Number.parseInt(
		process.env.CAP_IMPORT_REGENERATE_POLL_ATTEMPTS ?? "20",
		10,
	) || 20,
);
const configuredSkippedSourceIds = parseIdSet(process.env.CAP_LOOM_SKIP_IDS);
let scrapedTitleById = null;
let loomCookieHeader = null;
const maxImports = Math.max(
	1,
	Number.parseInt(process.env.CAP_IMPORT_COUNT ?? process.argv[2] ?? "1", 10) ||
		1,
);

function parseEnv(text) {
	const env = {};
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const index = trimmed.indexOf("=");
		if (index === -1) continue;
		env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
	}
	return env;
}

function parseCsv(text) {
	const rows = [];
	let row = [];
	let field = "";
	let inQuotes = false;
	const input = text.replace(/^\uFEFF/, "");

	for (let index = 0; index < input.length; index += 1) {
		const char = input[index];
		const next = input[index + 1];

		if (char === '"') {
			if (inQuotes && next === '"') {
				field += '"';
				index += 1;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}

		if (char === "," && !inQuotes) {
			row.push(field.trim());
			field = "";
			continue;
		}

		if ((char === "\n" || char === "\r") && !inQuotes) {
			if (char === "\r" && next === "\n") index += 1;
			row.push(field.trim());
			if (row.some((cell) => cell.length > 0)) rows.push(row);
			row = [];
			field = "";
			continue;
		}

		field += char;
	}

	if (field.length > 0 || row.length > 0) {
		row.push(field.trim());
		if (row.some((cell) => cell.length > 0)) rows.push(row);
	}

	return rows;
}

function parseNetscapeCookies(text) {
	const cookies = new Map();
	for (const line of text.split(/\r?\n/)) {
		if (!line || line.startsWith("#")) continue;
		const parts = line.split("\t");
		if (parts.length < 7) continue;
		const domain = parts[0].replace(/^\./, "");
		if (domain !== "loom.com" && domain !== "www.loom.com") continue;
		cookies.set(parts[5], parts.slice(6).join("\t"));
	}
	return Array.from(cookies, ([name, value]) => `${name}=${value}`).join("; ");
}

async function getLoomCookieHeader() {
	if (!loomCookieFile) return null;
	if (loomCookieHeader !== null) return loomCookieHeader;
	loomCookieHeader = parseNetscapeCookies(
		await readFile(loomCookieFile, "utf8"),
	);
	return loomCookieHeader;
}

async function withLoomCookies(request) {
	const cookie = await getLoomCookieHeader();
	if (!cookie) return request;
	return {
		...request,
		options: {
			...request.options,
			headers: {
				...request.options.headers,
				cookie,
			},
		},
	};
}

function execFileText(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		execFile(
			command,
			args,
			{ maxBuffer: 1024 * 1024 * 20, ...options },
			(error, stdout, stderr) => {
				if (error) {
					error.stdout = stdout;
					error.stderr = stderr;
					reject(error);
					return;
				}
				resolve(stdout.toString());
			},
		);
	});
}

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit",
			...options,
		});
		let outputTail = "";
		const appendTail = (chunk) => {
			outputTail = `${outputTail}${chunk.toString()}`.slice(-4000);
		};
		child.stdout?.on("data", appendTail);
		child.stderr?.on("data", appendTail);
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) resolve();
			else
				reject(new Error(`${command} exited with code ${code}\n${outputTail}`));
		});
	});
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function wait(ms, label) {
	if (ms <= 0) return;
	console.log(`Waiting ${Math.ceil(ms / 1000)}s ${label}.`);
	await sleep(ms);
}

function sqlString(value) {
	if (value === null || value === undefined) return "NULL";
	return `'${String(value).replace(/'/g, "''")}'`;
}

async function mysql(sql) {
	const stdout = await execFileText("docker", [
		"exec",
		"mysql-primary-db",
		"mysql",
		"-uroot",
		"planetscale",
		"--batch",
		"--raw",
		"-N",
		"-e",
		sql,
	]);

	return stdout
		.trim()
		.split("\n")
		.filter(Boolean)
		.map((line) => line.split("\t"));
}

async function mysqlExec(sql) {
	await execFileText("docker", [
		"exec",
		"mysql-primary-db",
		"mysql",
		"-uroot",
		"planetscale",
		"-e",
		sql,
	]);
}

function nanoId() {
	const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
	const bytes = randomBytes(15);
	return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function parseLoomId(url) {
	return url.match(/loom\.com\/share\/([^?/#]+)/)?.[1] ?? null;
}

function parseRate(rate) {
	const [num, den] = String(rate ?? "")
		.split("/")
		.map(Number);
	if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
	return num / den;
}

function normalizeSpaceName(value) {
	return value.trim().replace(/\s+/g, " ");
}

function normalizeVideoTitle(value, loomVideoId) {
	const fallback = `Loom Import - ${loomVideoId}`;
	const cleaned =
		String(value || fallback)
			.trim()
			.replace(/\s+/g, " ") || fallback;
	const chars = Array.from(cleaned);
	return chars.length <= 255 ? cleaned : `${chars.slice(0, 252).join("")}...`;
}

async function getImportStates() {
	const rows = await mysql(`
		SELECT iv.source_id, iv.id, COALESCE(vu.phase, 'complete')
		FROM imported_videos iv
		LEFT JOIN video_uploads vu ON vu.video_id = iv.id
		WHERE iv.source = 'loom'
	`);
	return new Map(
		rows.map(([sourceId, videoId, phase]) => [sourceId, { videoId, phase }]),
	);
}

async function getDefaultOrgId() {
	const rows = await mysql(
		"SELECT orgId FROM imported_videos WHERE source='loom' GROUP BY orgId ORDER BY COUNT(*) DESC LIMIT 1",
	);
	return rows[0]?.[0] ?? null;
}

async function selectCandidate(skippedSourceIds = new Set()) {
	const importStates = await getImportStates();
	const rows = parseCsv(await readFile(csvPath, "utf8"));
	const headers = rows[0]?.map((header) => header.trim()) ?? [];
	const urlIndex = headers.findIndex((header) => /loom.*url|url/i.test(header));
	const emailIndex = headers.findIndex((header) => /email/i.test(header));
	const spaceIndex = headers.findIndex((header) => /space/i.test(header));
	let firstFailed = null;

	for (const [index, row] of rows.slice(1).entries()) {
		const loomUrl = (row[urlIndex] ?? "").trim();
		const loomVideoId = parseLoomId(loomUrl);
		if (!loomVideoId) continue;
		if (skippedSourceIds.has(loomVideoId)) continue;

		const baseCandidate = {
			rowNumber: index + 2,
			loomUrl,
			loomVideoId,
			userEmail: (row[emailIndex] ?? "").trim().toLowerCase(),
			spaceName: normalizeSpaceName(row[spaceIndex] ?? ""),
		};
		const state = importStates.get(loomVideoId);
		if (!state) return { ...baseCandidate, mode: "missing" };
		if (state.phase === "error" && !firstFailed) {
			firstFailed = {
				...baseCandidate,
				mode: "failed",
				existingVideoId: state.videoId,
			};
		}
	}

	return firstFailed;
}

async function getOwner(candidate, orgId) {
	const rows = await mysql(`
		SELECT u.id, COALESCE(NULLIF(u.name, ''), SUBSTRING_INDEX(u.email, '@', 1))
		FROM users u
		INNER JOIN organization_members om ON om.userId = u.id
		WHERE u.email = ${sqlString(candidate.userEmail)}
			AND om.organizationId = ${sqlString(orgId)}
		LIMIT 1
	`);
	if (!rows[0])
		throw new Error(`${candidate.userEmail} is not a member of ${orgId}`);
	return { id: rows[0][0], name: rows[0][1] };
}

async function getOrgOwnerId(orgId) {
	const rows = await mysql(
		`SELECT ownerId FROM organizations WHERE id=${sqlString(orgId)} LIMIT 1`,
	);
	if (!rows[0]) throw new Error(`Organization not found: ${orgId}`);
	return rows[0][0];
}

async function getScrapedTitle(loomVideoId) {
	if (!scrapedTitleById) {
		scrapedTitleById = new Map();
		try {
			const details = JSON.parse(await readFile(detailsPath, "utf8"));
			const items = Array.isArray(details) ? details : details.items;
			for (const item of items ?? []) {
				if (item?.id && item?.title) scrapedTitleById.set(item.id, item.title);
			}
		} catch {}
	}

	return scrapedTitleById.get(loomVideoId) ?? null;
}

async function getVideoTitle(candidate) {
	const scrapedTitle = await getScrapedTitle(candidate.loomVideoId);
	if (scrapedTitle) return scrapedTitle;

	const baseArgs = ["--no-playlist", "--skip-download", "--print", "%(title)s"];

	try {
		const title = await execFileText("yt-dlp", [
			...baseArgs,
			candidate.loomUrl,
		]);
		return (
			title.trim().split("\n").filter(Boolean).at(-1) ??
			`Loom Import - ${candidate.loomVideoId}`
		);
	} catch {
		if (!cookiesFromBrowser) return `Loom Import - ${candidate.loomVideoId}`;
	}

	try {
		const title = await execFileText("yt-dlp", [
			...baseArgs,
			"--cookies-from-browser",
			cookiesFromBrowser,
			candidate.loomUrl,
		]);
		return (
			title.trim().split("\n").filter(Boolean).at(-1) ??
			`Loom Import - ${candidate.loomVideoId}`
		);
	} catch {
		return `Loom Import - ${candidate.loomVideoId}`;
	}
}

async function downloadLoomVideo(candidate, sourceTemplate) {
	const attempts = buildDownloadAttempts({
		cookiesFromBrowser,
		sourceTemplate,
		url: candidate.loomUrl,
	});
	let lastError = null;

	for (const [attemptIndex, attempt] of attempts.entries()) {
		if (attemptIndex > 0) {
			await wait(
				getRetryDelayMs({
					attemptIndex: attemptIndex - 1,
					baseMs: downloadRetryDelayMs,
					maxMs: downloadRetryMaxDelayMs,
				}),
				`before ${attempt.label}`,
			);
		}

		try {
			console.log(`yt-dlp attempt: ${attempt.label}`);
			await run("yt-dlp", attempt.args);
			return;
		} catch (error) {
			lastError = error;
			console.log(`yt-dlp attempt failed: ${attempt.label}`);
		}
	}

	const transcodedUrl = await getLoomTranscodedSourceUrl(candidate.loomVideoId);
	if (transcodedUrl) {
		await wait(
			getRetryDelayMs({
				attemptIndex: attempts.length - 1,
				baseMs: downloadRetryDelayMs,
				maxMs: downloadRetryMaxDelayMs,
			}),
			"before loom-graphql-transcoded",
		);
		try {
			console.log("yt-dlp attempt: loom-graphql-transcoded");
			await run("yt-dlp", [
				"--no-playlist",
				"--no-progress",
				"-f",
				"b/bv*+ba",
				"--merge-output-format",
				"mp4",
				"-o",
				sourceTemplate,
				transcodedUrl,
			]);
			return;
		} catch (error) {
			lastError = error;
			console.log("yt-dlp attempt failed: loom-graphql-transcoded");
		}
	}

	const rawCdnUrl = await getLoomRawCdnSourceUrl(candidate.loomVideoId);
	if (rawCdnUrl) {
		await wait(
			getRetryDelayMs({
				attemptIndex: attempts.length - 1,
				baseMs: downloadRetryDelayMs,
				maxMs: downloadRetryMaxDelayMs,
			}),
			"before loom-graphql-raw-cdn",
		);
		try {
			console.log("yt-dlp attempt: loom-graphql-raw-cdn");
			await run("yt-dlp", [
				"--no-playlist",
				"--no-progress",
				"-f",
				"b/bv*+ba",
				"--merge-output-format",
				"mp4",
				"-o",
				sourceTemplate,
				rawCdnUrl,
			]);
			return;
		} catch (error) {
			lastError = error;
			console.log("yt-dlp attempt failed: loom-graphql-raw-cdn");
		}
	}

	const fallbackUrl = await getLoomM3u8SourceUrl(candidate.loomVideoId);
	if (fallbackUrl) {
		await wait(
			getRetryDelayMs({
				attemptIndex: attempts.length - 1,
				baseMs: downloadRetryDelayMs,
				maxMs: downloadRetryMaxDelayMs,
			}),
			"before loom-graphql-m3u8",
		);
		try {
			console.log("ffmpeg attempt: loom-graphql-m3u8");
			await downloadPatchedHls(fallbackUrl, sourceTemplate);
			return;
		} catch (error) {
			lastError = error;
			console.log("ffmpeg attempt failed: loom-graphql-m3u8");
		}
	}

	const regeneratedUrl = await waitForLoomRegeneratedMp4Url(
		candidate.loomVideoId,
	);
	if (regeneratedUrl) {
		try {
			console.log("yt-dlp attempt: loom-graphql-regenerated-mp4");
			await run("yt-dlp", [
				"--no-playlist",
				"--no-progress",
				"-f",
				"b/bv*+ba",
				"--merge-output-format",
				"mp4",
				"-o",
				sourceTemplate,
				regeneratedUrl,
			]);
			return;
		} catch (error) {
			lastError = error;
			console.log("yt-dlp attempt failed: loom-graphql-regenerated-mp4");
		}
	}

	throw lastError;
}

async function getLoomTranscodedSourceUrl(loomVideoId) {
	const request = await withLoomCookies(
		buildLoomTranscodedRequest({ loomVideoId }),
	);
	try {
		const response = await fetch(request.url, request.options);
		if (!response.ok) return null;
		return extractLoomTranscodedUrl(await response.json());
	} catch {
		return null;
	}
}

async function getLoomRawCdnSourceUrl(loomVideoId) {
	const request = await withLoomCookies(
		buildLoomRawCdnRequest({ loomVideoId }),
	);
	try {
		const response = await fetch(request.url, request.options);
		if (!response.ok) return null;
		return extractLoomRawCdnUrl(await response.json());
	} catch {
		return null;
	}
}

async function getLoomM3u8SourceUrl(loomVideoId) {
	const request = await withLoomCookies(
		buildLoomSourceRequest({ loomVideoId }),
	);
	try {
		const response = await fetch(request.url, request.options);
		if (!response.ok) return null;
		return extractLoomSourceUrl(await response.json());
	} catch {
		return null;
	}
}

async function requestLoomMp4Regeneration(loomVideoId) {
	const request = await withLoomCookies(
		buildLoomRegenerateMp4Request({ loomVideoId }),
	);
	try {
		const response = await fetch(request.url, request.options);
		if (!response.ok) return false;
		return extractLoomRegenerateMp4Success(await response.json());
	} catch {
		return false;
	}
}

async function waitForLoomRegeneratedMp4Url(loomVideoId) {
	const accepted = await requestLoomMp4Regeneration(loomVideoId);
	if (!accepted) return null;

	for (let attempt = 0; attempt < regeneratePollAttempts; attempt += 1) {
		await wait(
			regeneratePollDelayMs,
			"before loom-graphql-regenerated-mp4 poll",
		);
		const url = await getLoomTranscodedSourceUrl(loomVideoId);
		if (url) return url;
	}

	return null;
}

async function downloadPatchedHls(sourceUrl, sourceTemplate) {
	const hlsDir = await mkdtemp(path.join(os.tmpdir(), "loom-hls-"));
	const outputPath = sourceTemplate.replace("%(ext)s", "mp4");
	let playlistIndex = 0;

	async function writePatchedPlaylist(playlistUrl, fileName) {
		const response = await fetch(playlistUrl);
		if (!response.ok) throw new Error(`HLS playlist HTTP ${response.status}`);
		const children = [];
		const lines = [];

		for (const line of (await response.text()).split(/\r?\n/)) {
			const trimmed = line.trim();
			let rewritten = line.replace(/URI="([^"]+)"/g, (_match, uri) => {
				const absolute = withPlaylistQuery(uri, playlistUrl);
				if (!isHlsPlaylistUri(absolute)) return `URI="${absolute}"`;
				playlistIndex += 1;
				const childName = `playlist-${playlistIndex}.m3u8`;
				children.push({ fileName: childName, url: absolute });
				return `URI="${childName}"`;
			});

			if (trimmed && !trimmed.startsWith("#")) {
				const absolute = withPlaylistQuery(trimmed, playlistUrl);
				if (isHlsPlaylistUri(absolute)) {
					playlistIndex += 1;
					rewritten = `playlist-${playlistIndex}.m3u8`;
					children.push({ fileName: rewritten, url: absolute });
				} else {
					rewritten = absolute;
				}
			}

			lines.push(rewritten);
		}

		await writeFile(path.join(hlsDir, fileName), lines.join("\n"), "utf8");
		for (const child of children) {
			await writePatchedPlaylist(child.url, child.fileName);
		}
	}

	try {
		await writePatchedPlaylist(sourceUrl, "playlist-0.m3u8");
		await run("ffmpeg", [
			"-hide_banner",
			"-loglevel",
			quiet ? "error" : "warning",
			"-protocol_whitelist",
			"file,http,https,tcp,tls,crypto",
			"-allowed_extensions",
			"ALL",
			"-i",
			path.join(hlsDir, "playlist-0.m3u8"),
			"-c",
			"copy",
			outputPath,
		]);
	} finally {
		if (!process.env.CAP_KEEP_LOOM_TMP)
			await rm(hlsDir, { recursive: true, force: true });
	}
}

async function findSourceFile(tmpDir) {
	const files = await readdir(tmpDir);
	const candidates = files.filter((file) => /^source\./.test(file));
	const mp4 = candidates.find((file) => file.endsWith(".mp4"));
	const first = mp4 ?? candidates[0];
	if (!first) throw new Error("yt-dlp did not produce a source file");
	return path.join(tmpDir, first);
}

async function probe(filePath) {
	const json = await execFileText("ffprobe", [
		"-v",
		"error",
		"-show_entries",
		"format=duration:stream=codec_name,width,height,avg_frame_rate",
		"-of",
		"json",
		filePath,
	]);
	const data = JSON.parse(json);
	const video = data.streams.find((stream) => stream.width && stream.height);
	if (!video) throw new Error("No video stream found after transcode");
	return {
		duration: Number(data.format.duration),
		width: Number(video.width),
		height: Number(video.height),
		fps: Math.max(1, Math.round(parseRate(video.avg_frame_rate) ?? 30)),
	};
}

async function ensureSpace({ orgId, orgOwnerId, spaceName }) {
	if (!spaceName) return null;
	const existing = await mysql(`
		SELECT id FROM spaces
		WHERE organizationId=${sqlString(orgId)} AND name=${sqlString(spaceName)}
		LIMIT 1
	`);
	if (existing[0]?.[0]) return existing[0][0];

	const spaceId = nanoId();
	const memberId = nanoId();
	await mysqlExec(`
		START TRANSACTION;
		INSERT INTO spaces (id, name, organizationId, createdById, iconUrl)
		VALUES (${sqlString(spaceId)}, ${sqlString(spaceName)}, ${sqlString(orgId)}, ${sqlString(orgOwnerId)}, NULL);
		INSERT INTO space_members (id, spaceId, userId, role)
		VALUES (${sqlString(memberId)}, ${sqlString(spaceId)}, ${sqlString(orgOwnerId)}, 'admin');
		COMMIT;
	`);
	return spaceId;
}

async function saveVideo({
	videoId,
	title,
	ownerId,
	orgId,
	metadata,
	candidate,
	spaceId,
	orgOwnerId,
}) {
	const spaceVideoId = nanoId();
	const spaceVideoSql = spaceId
		? `INSERT INTO space_videos (id, spaceId, videoId, addedById)
			SELECT ${sqlString(spaceVideoId)}, ${sqlString(spaceId)}, ${sqlString(videoId)}, ${sqlString(orgOwnerId)}
			WHERE NOT EXISTS (
				SELECT 1 FROM space_videos
				WHERE spaceId=${sqlString(spaceId)} AND videoId=${sqlString(videoId)}
			);`
		: "";

	if (candidate.mode === "failed") {
		await mysqlExec(`
			START TRANSACTION;
			UPDATE videos
			SET name=${sqlString(title)},
				ownerId=${sqlString(ownerId)},
				orgId=${sqlString(orgId)},
				source=JSON_OBJECT('type', 'webMP4'),
				public=1,
				duration=${Number.isFinite(metadata.duration) ? metadata.duration : "NULL"},
				width=${metadata.width},
				height=${metadata.height},
				fps=${metadata.fps},
				updatedAt=NOW()
			WHERE id=${sqlString(videoId)};
			DELETE FROM video_uploads WHERE video_id=${sqlString(videoId)};
			${spaceVideoSql}
			COMMIT;
		`);
		return;
	}

	await mysqlExec(`
		START TRANSACTION;
		INSERT INTO videos (id, name, ownerId, orgId, source, public, duration, width, height, fps, createdAt, updatedAt)
		VALUES (
			${sqlString(videoId)},
			${sqlString(title)},
			${sqlString(ownerId)},
			${sqlString(orgId)},
			JSON_OBJECT('type', 'webMP4'),
			1,
			${Number.isFinite(metadata.duration) ? metadata.duration : "NULL"},
			${metadata.width},
			${metadata.height},
			${metadata.fps},
			NOW(),
			NOW()
		);
		INSERT INTO imported_videos (id, orgId, source, source_id)
		VALUES (${sqlString(videoId)}, ${sqlString(orgId)}, 'loom', ${sqlString(candidate.loomVideoId)});
		${spaceVideoSql}
		COMMIT;
	`);
}

async function importCandidate({ candidate, env, orgId }) {
	const owner = await getOwner(candidate, orgId);
	const orgOwnerId = await getOrgOwnerId(orgId);
	const title = normalizeVideoTitle(
		await getVideoTitle(candidate),
		candidate.loomVideoId,
	);
	const videoId = candidate.existingVideoId ?? nanoId();
	const tmpDir = await mkdtemp(path.join(os.tmpdir(), "cap-loom-local-"));

	console.log(
		`${candidate.mode === "failed" ? "Retrying" : "Importing"} row ${candidate.rowNumber}: ${title}`,
	);
	console.log(`Loom: ${candidate.loomVideoId}`);
	console.log(`Cap video id: ${videoId}`);

	try {
		const sourceTemplate = path.join(tmpDir, "source.%(ext)s");
		const sourcePath = path.join(tmpDir, "source.mp4");
		const resultPath = path.join(tmpDir, "result.mp4");
		const thumbnailPath = path.join(tmpDir, "screen-capture.jpg");
		const previewPath = path.join(tmpDir, "animated-preview.gif");

		await downloadLoomVideo(candidate, sourceTemplate);

		const downloadedPath = existsSync(sourcePath)
			? sourcePath
			: await findSourceFile(tmpDir);

		await run("ffmpeg", [
			"-hide_banner",
			"-y",
			"-threads",
			"2",
			"-i",
			downloadedPath,
			"-c:v",
			"libx264",
			"-preset",
			"veryfast",
			"-crf",
			"23",
			"-vf",
			"scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
			"-c:a",
			"aac",
			"-b:a",
			"128k",
			"-movflags",
			"+faststart",
			resultPath,
		]);

		const metadata = await probe(resultPath);

		await run("ffmpeg", [
			"-hide_banner",
			"-y",
			"-ss",
			"1",
			"-i",
			resultPath,
			"-vframes",
			"1",
			"-vf",
			"scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
			"-q:v",
			"6",
			"-update",
			"1",
			thumbnailPath,
		]);

		await run("ffmpeg", [
			"-hide_banner",
			"-y",
			"-ss",
			"1",
			"-t",
			"4",
			"-i",
			resultPath,
			"-an",
			"-filter_complex",
			"fps=8,scale='min(480,iw)':'min(480,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,split[s0][s1];[s0]palettegen=stats_mode=diff:max_colors=48[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
			"-loop",
			"0",
			"-f",
			"gif",
			previewPath,
		]);

		const awsEnv = {
			...process.env,
			AWS_ACCESS_KEY_ID: env.CAP_AWS_ACCESS_KEY,
			AWS_SECRET_ACCESS_KEY: env.CAP_AWS_SECRET_KEY,
			AWS_DEFAULT_REGION: env.CAP_AWS_REGION,
		};
		const s3Base = `s3://${env.CAP_AWS_BUCKET}/${owner.id}/${videoId}`;
		const awsBaseArgs = ["--endpoint-url", env.CAP_AWS_ENDPOINT, "s3", "cp"];

		await run(
			"aws",
			[
				...awsBaseArgs,
				resultPath,
				`${s3Base}/result.mp4`,
				"--content-type",
				"video/mp4",
			],
			{ env: awsEnv },
		);
		await run(
			"aws",
			[
				...awsBaseArgs,
				thumbnailPath,
				`${s3Base}/screenshot/screen-capture.jpg`,
				"--content-type",
				"image/jpeg",
			],
			{ env: awsEnv },
		);
		await run(
			"aws",
			[
				...awsBaseArgs,
				previewPath,
				`${s3Base}/preview/animated-preview.gif`,
				"--content-type",
				"image/gif",
				"--cache-control",
				"public, max-age=31536000, immutable",
			],
			{ env: awsEnv },
		);

		const spaceId = await ensureSpace({
			orgId,
			orgOwnerId,
			spaceName: candidate.spaceName,
		});
		await saveVideo({
			videoId,
			title,
			ownerId: owner.id,
			orgId,
			metadata,
			candidate,
			spaceId,
			orgOwnerId,
		});

		console.log(
			JSON.stringify(
				{
					videoId,
					rowNumber: candidate.rowNumber,
					title,
					metadata,
					spaceName: candidate.spaceName || null,
				},
				null,
				2,
			),
		);
	} finally {
		if (!process.env.CAP_KEEP_LOOM_TMP)
			await rm(tmpDir, { recursive: true, force: true });
	}
}

async function main() {
	const env = parseEnv(await readFile(path.join(repoRoot, ".env"), "utf8"));
	const orgId = process.env.CAP_LOOM_IMPORT_ORG_ID || (await getDefaultOrgId());
	if (!orgId) throw new Error("Could not infer org id");

	let importedCount = 0;
	let failedCount = 0;
	const skippedSourceIds = new Set(configuredSkippedSourceIds);
	for (let index = 0; index < maxImports; index += 1) {
		const candidate = await selectCandidate(skippedSourceIds);
		if (!candidate) {
			console.log("No pending Loom CSV rows found.");
			break;
		}
		await wait(
			getPaceDelayMs({
				completedImports: importedCount + failedCount,
				minMs: paceMinMs,
				maxMs: paceMaxMs,
			}),
			"before next Loom import",
		);

		try {
			await importCandidate({ candidate, env, orgId });
			importedCount += 1;
		} catch (error) {
			failedCount += 1;
			skippedSourceIds.add(candidate.loomVideoId);
			console.error(error);
		}
	}

	console.log(
		`Imported ${importedCount} video${importedCount === 1 ? "" : "s"} this run; ${failedCount} failed.`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
