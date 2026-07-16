import { readFile } from "node:fs/promises";
import { NewComment } from "@cap/database/emails/new-comment";
import {
	buildPortstbdAssetUrl,
	isCapDeployment,
	PORTSTBD_BRAND,
} from "@cap/utils";
import { render } from "@react-email/render";
import { describe, expect, it, vi } from "vitest";

const brandSources = {
	newCommentEmail: "../../../../packages/database/emails/new-comment.tsx",
	notification: "../../lib/Notification.ts",
} as const;

type BrandSourceName = keyof typeof brandSources;

const loadBrandSources = async () => {
	const entries = await Promise.all(
		Object.entries(brandSources).map(async ([name, path]) => {
			const source = await readFile(new URL(path, import.meta.url), "utf8");
			return [name, source] as const;
		}),
	);
	return Object.fromEntries(entries) as Record<BrandSourceName, string>;
};

describe("new-comment email branding", () => {
	it("renders with portstbd logo and no Cap strings in HTML output", async () => {
		vi.stubEnv("NEXT_PUBLIC_WEB_URL", "https://watch.portstbd.com");

		try {
			const html = await render(
				NewComment({
					email: "owner@example.com",
					url: "https://watch.portstbd.com/s/vid123",
					videoName: "My Recording",
					commenterName: "Alice",
					commentContent: "Great video!",
					manageNotificationsUrl:
						"https://watch.portstbd.com/dashboard/settings/notifications",
				}),
			);

			const encodeHtml = (value: string) => value.replace(/&/g, "&amp;");
			expect(html).toContain(
				buildPortstbdAssetUrl("/port-starboard-logo-email.png"),
			);
			expect(html).toContain(encodeHtml(PORTSTBD_BRAND.logoAlt));
			expect(html).toContain(encodeHtml(PORTSTBD_BRAND.companyName));
			expect(html).not.toContain("Cap");
			expect(html).not.toContain("cap.so");
			expect(html).not.toContain("github.com/CapSoftware");
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it("subject and source route through portstbd brand constants", async () => {
		const sources = await loadBrandSources();

		expect(sources.newCommentEmail).toContain(
			'buildPortstbdAssetUrl("/port-starboard-logo-email.png")',
		);
		expect(sources.newCommentEmail).toContain("PORTSTBD_BRAND.logoAlt");
		expect(sources.newCommentEmail).toContain("PORTSTBD_BRAND.companyName");
		expect(sources.newCommentEmail).not.toContain("CAP_LOGO_URL");
		expect(sources.newCommentEmail).not.toMatch(/alt="Cap"/);

		expect(sources.notification).toMatch(
			/subject: `New comment on your \$\{PORTSTBD_BRAND\.companyName\} video:/,
		);
		expect(sources.notification).not.toMatch(
			/subject: `New comment on your Cap:/,
		);

		expect(sources.notification).toMatch(
			/videoUrl = isCapDeployment\(buildEnv\.NEXT_PUBLIC_IS_CAP\)/,
		);
		expect(sources.notification).not.toMatch(
			/videoUrl = buildEnv\.NEXT_PUBLIC_IS_CAP\s*\?/,
		);
	});

	it("uses WEB_URL for video link in fork deployment", async () => {
		vi.stubEnv("NEXT_PUBLIC_WEB_URL", "https://watch.portstbd.com");
		vi.stubEnv("NEXT_PUBLIC_IS_CAP", "");

		try {
			const videoUrl = `https://watch.portstbd.com/s/vid123`;
			const html = await render(
				NewComment({
					email: "owner@example.com",
					url: videoUrl,
					videoName: "My Recording",
					commenterName: "Alice",
					commentContent: "Great video!",
				}),
			);

			expect(html).toContain("watch.portstbd.com/s/vid123");
			expect(html).not.toContain("cap.link");
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it('NEXT_PUBLIC_IS_CAP="false" is not a Cap deployment — guards cap.link leak', () => {
		expect(isCapDeployment("false")).toBe(false);
		expect(isCapDeployment("true")).toBe(true);
		expect(isCapDeployment("")).toBe(false);
		expect(isCapDeployment(undefined)).toBe(false);
	});
});
