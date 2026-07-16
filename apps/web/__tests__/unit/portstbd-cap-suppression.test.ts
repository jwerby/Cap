import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { isCapDeployment } from "@cap/utils";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(process.cwd(), "../..");

const SCAN_ROOTS = [
	join(REPO_ROOT, "apps/web/app/(org)"),
	join(REPO_ROOT, "apps/web/app/api"),
	join(REPO_ROOT, "apps/web/app/embed"),
	join(REPO_ROOT, "apps/web/app/s"),
	join(REPO_ROOT, "apps/web/actions"),
	join(REPO_ROOT, "apps/web/components"),
	join(REPO_ROOT, "apps/web/lib"),
	join(REPO_ROOT, "apps/web/utils"),
	join(REPO_ROOT, "apps/web/proxy.ts"),
	join(REPO_ROOT, "apps/web/next.config.mjs"),
	join(REPO_ROOT, "apps/desktop/src/utils"),
	join(REPO_ROOT, "apps/desktop/src/routes"),
	join(REPO_ROOT, "apps/desktop/src-tauri/src"),
	join(REPO_ROOT, "apps/desktop/src-tauri/tauri.prod.conf.json"),
	join(REPO_ROOT, "packages/database/emails/config.ts"),
	join(REPO_ROOT, "packages/sdk-embed/src"),
	join(REPO_ROOT, "packages/sdk-recorder/src"),
	join(REPO_ROOT, "packages/web-backend/src"),
];

const FILE_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".rs",
	".json",
	".toml",
]);

interface ScanRule {
	name: string;
	pattern: RegExp;
	allowlist: Array<RegExp | string>;
}

const SCAN_RULES: ScanRule[] = [
	{
		name: "cap-license-server",
		pattern: /l\.cap\.so/,
		allowlist: [],
	},
	{
		name: "posthog-hardcoded-fallback",
		pattern: /app\.posthog\.com/,
		allowlist: [],
	},
	{
		name: "crabnebula-cap-updater",
		pattern: /cdn\.crabnebula\.app\/update\/cap\/cap/,
		allowlist: [],
	},
	{
		name: "cap-chrome-extension-id",
		pattern: /fefjaffcodfiogbbngmjkcjpbpclbdcp/,
		allowlist: [],
	},
	{
		name: "cap-chrome-extension-import",
		pattern: /ChromeRecorderButton|CHROME_EXTENSION_BUTTON_CLASS/,
		allowlist: [],
	},
	{
		name: "cap-server-url-default",
		pattern: /(?:\?\?|unwrap_or\()\s*["'`]https:\/\/cap\.so["'`]/,
		allowlist: [/apps\/desktop\/src\/routes\/.*\/settings\/general\./],
	},
	{
		name: "cap-license-email-from",
		pattern: /no-reply@auth\.cap\.so|richie@send\.cap\.so|richie@cap\.so/,
		allowlist: [],
	},
	{
		name: "cap-short-link-domain",
		pattern: /cap\.link/,
		allowlist: [
			/apps\/web\/utils\/helpers\./,
			/apps\/web\/proxy\./,
			/apps\/web\/utils\/cors\./,
		],
	},
	{
		name: "cap-trusted-origin",
		pattern: /["'`]https?:\/\/(www\.)?cap\.so["'`]/,
		allowlist: [
			/apps\/web\/lib\/messenger\//,
			/apps\/web\/app\/\(site\)\//,
			/packages\/env\//,
		],
	},
];

const SKIP_PATHS: RegExp[] = [
	/\/node_modules\//,
	/\/\.next\//,
	/\/\.turbo\//,
	/\/dist\//,
	/\/target\//,
	/\/__tests__\//,
	/\/content\/blog-content\//,
	/\/apps\/web\/app\/\(site\)\//,
	/\/apps\/web\/app\/\(docs\)\//,
	/\/apps\/web\/utils\/web-schema\./,
	/\/apps\/web\/components\/pages\//,
	/apps\/desktop\/src-tauri\/tests\//,
	/apps\/desktop\/src\/utils\/server-url-routing\.test\./,
];

interface Hit {
	file: string;
	line: number;
	text: string;
	rule: string;
}

function hitKey(h: Hit): string {
	return `${h.file}\t${h.rule}`;
}

async function collectFiles(root: string): Promise<string[]> {
	let results: string[] = [];

	let info: { isDirectory(): boolean; isFile(): boolean };
	try {
		info = await stat(root);
	} catch {
		return [];
	}

	if (info.isFile()) {
		const ext = root.slice(root.lastIndexOf("."));
		if (FILE_EXTENSIONS.has(ext)) return [root];
		return [];
	}

	if (!info.isDirectory()) return [];

	const entries = await readdir(root);
	for (const entry of entries) {
		const child = join(root, entry);
		const childStat = await stat(child);
		if (childStat.isDirectory()) {
			const sub = await collectFiles(child);
			results = results.concat(sub);
		} else {
			const ext = entry.slice(entry.lastIndexOf("."));
			if (FILE_EXTENSIONS.has(ext)) results.push(child);
		}
	}

	return results;
}

function isSkipped(filePath: string): boolean {
	const normalized = filePath.replace(/\\/g, "/");
	return SKIP_PATHS.some((re) => re.test(normalized));
}

function isAllowlisted(rule: ScanRule, filePath: string): boolean {
	const normalized = filePath.replace(/\\/g, "/");
	return rule.allowlist.some((entry) => {
		if (entry instanceof RegExp) return entry.test(normalized);
		return normalized.includes(entry);
	});
}

async function scanTree(rootDir: string): Promise<Hit[]> {
	const hits: Hit[] = [];

	let allFiles: string[] = [];
	for (const root of SCAN_ROOTS) {
		const adjusted = root.replace(REPO_ROOT, rootDir);
		const files = await collectFiles(adjusted);
		allFiles = allFiles.concat(files);
	}

	for (const filePath of allFiles) {
		if (isSkipped(filePath)) continue;

		let content: string;
		try {
			content = await readFile(filePath, "utf8");
		} catch {
			continue;
		}

		const lines = content.split("\n");

		for (const rule of SCAN_RULES) {
			if (isAllowlisted(rule, filePath)) continue;

			for (const [idx, rawLine] of lines.entries()) {
				const line = rawLine ?? "";
				if (rule.pattern.test(line)) {
					hits.push({
						file: relative(rootDir, filePath),
						line: idx + 1,
						text: line.trim(),
						rule: rule.name,
					});
				}
			}
		}
	}

	return hits;
}

const KNOWN_FINDINGS = [
	"apps/desktop/src-tauri/src/posthog.rs\tcap-trusted-origin",
	"apps/desktop/src/routes/(window-chrome)/onboarding.tsx\tcap-short-link-domain",
	"apps/desktop/src/routes/(window-chrome)/settings/feedback.tsx\tcap-short-link-domain",
	"apps/web/actions/loom.ts\tcap-short-link-domain",
	"apps/web/actions/video/create-for-processing.ts\tcap-short-link-domain",
	"apps/web/actions/video/upload.ts\tcap-short-link-domain",
	"apps/web/app/(org)/dashboard/_components/Navbar/Top.tsx\tcap-short-link-domain",
	"apps/web/app/(org)/dashboard/caps/components/CapCard/CapCard.tsx\tcap-short-link-domain",
	"apps/web/app/(org)/dashboard/settings/organization/components/CustomDomainDialog/CustomDomainDialog.tsx\tcap-short-link-domain",
	"apps/web/app/api/desktop/[...route]/root.ts\tcap-license-email-from",
	"apps/web/app/api/desktop/[...route]/video.ts\tcap-short-link-domain",
	"apps/web/app/embed/[videoId]/_components/EmbedVideo.tsx\tcap-trusted-origin",
	"apps/web/app/s/[videoId]/_components/ShareHeader.tsx\tcap-short-link-domain",
	"apps/web/app/s/[videoId]/_components/playback-source.ts\tcap-trusted-origin",
	"apps/web/lib/Notification.ts\tcap-short-link-domain",
	"apps/web/next.config.mjs\tcap-short-link-domain",
	"apps/web/proxy.ts\tcap-trusted-origin",
	"apps/web/utils/cors.ts\tcap-trusted-origin",
	"packages/database/emails/config.ts\tcap-license-email-from",
	"packages/sdk-embed/src/vanilla/cap-embed.ts\tcap-trusted-origin",
	"packages/sdk-recorder/src/index.ts\tcap-trusted-origin",
	"packages/web-backend/src/Videos/index.ts\tcap-short-link-domain",
];

describe("Port and Starboard Cap-specific suppression", () => {
	it("treats only the literal true flag as a Cap deployment", () => {
		expect(isCapDeployment("true")).toBe(true);
		expect(isCapDeployment("false")).toBe(false);
		expect(isCapDeployment(undefined)).toBe(false);
	});

	it("current fork tree matches the known-findings baseline exactly", async () => {
		const hits = await scanTree(REPO_ROOT);
		const actual = [...new Set(hits.map(hitKey))].sort();
		const expected = [...KNOWN_FINDINGS].sort();

		const added = actual.filter((k) => !expected.includes(k));
		const removed = expected.filter((k) => !actual.includes(k));

		const lines: string[] = [];
		if (added.length > 0) {
			lines.push(
				"NEW Cap-controlled surfaces not in baseline (must fix or add to baseline):",
			);
			for (const k of added) lines.push(`  + ${k.replace(/\t/g, " | ")}`);
		}
		if (removed.length > 0) {
			lines.push(
				"Baseline entries no longer found (tighten the baseline or verify the fix):",
			);
			for (const k of removed) lines.push(`  - ${k.replace(/\t/g, " | ")}`);
		}

		if (lines.length > 0) expect.fail(lines.join("\n"));
	});

	it("detects known Cap surfaces when scanned against the upstream v0.5.3 tree", async () => {
		const upstreamRoot = "/tmp/cap-v053-check";

		let upstreamPresent = false;
		try {
			await stat(upstreamRoot);
			upstreamPresent = true;
		} catch {
			upstreamPresent = false;
		}

		if (!upstreamPresent) {
			console.warn(
				"Skipping upstream v0.5.3 validation: worktree not present at /tmp/cap-v053-check",
			);
			return;
		}

		const hits = await scanTree(upstreamRoot);
		const hitsByRule = new Map<string, Hit[]>();
		for (const hit of hits) {
			const bucket = hitsByRule.get(hit.rule) ?? [];
			bucket.push(hit);
			hitsByRule.set(hit.rule, bucket);
		}

		expect(
			hitsByRule.has("cap-license-server"),
			"upstream v0.5.3 must have l.cap.so hit (apps/desktop/src/utils/web-api.ts)",
		).toBe(true);

		expect(
			hitsByRule.has("posthog-hardcoded-fallback"),
			"upstream v0.5.3 must have app.posthog.com hit (utils/getBootstrapData.ts)",
		).toBe(true);

		expect(
			hitsByRule.has("crabnebula-cap-updater"),
			"upstream v0.5.3 must have CrabNebula updater hit (tauri.prod.conf.json)",
		).toBe(true);

		expect(
			hitsByRule.has("cap-chrome-extension-id") ||
				hitsByRule.has("cap-chrome-extension-import"),
			"upstream v0.5.3 must have Chrome extension hit (Caps.tsx or ChromeRecorderButton)",
		).toBe(true);

		expect(
			hitsByRule.has("cap-server-url-default"),
			"upstream v0.5.3 must have cap.so server URL default hit (env.ts or auth.ts)",
		).toBe(true);
	});
});
