import { readFile } from "node:fs/promises";
import { FirstShareableLink } from "@cap/database/emails/first-shareable-link";
import { FirstView } from "@cap/database/emails/first-view";
import { LoginLink } from "@cap/database/emails/login-link";
import { OTPEmail } from "@cap/database/emails/otp-email";
import {
	buildPortstbdAssetUrl,
	getPortstbdWebUrl,
	PORTSTBD_BRAND,
} from "@cap/utils";
import { render } from "@react-email/render";
import { describe, expect, it, vi } from "vitest";

const task5BrandSources = {
	emailConfig: "../../../../packages/database/emails/config.ts",
	otpEmail: "../../../../packages/database/emails/otp-email.tsx",
	loginLinkEmail: "../../../../packages/database/emails/login-link.tsx",
	firstViewEmail: "../../../../packages/database/emails/first-view.tsx",
	firstShareableLinkEmail:
		"../../../../packages/database/emails/first-shareable-link.tsx",
	authOptions: "../../../../packages/database/auth/auth-options.ts",
	notification: "../../lib/Notification.ts",
	videoUploadAction: "../../actions/video/upload.ts",
	videoCreateForProcessingAction:
		"../../actions/video/create-for-processing.ts",
	desktopVideoApi: "../../app/api/desktop/[...route]/video.ts",
	videosBackend: "../../../../packages/web-backend/src/Videos/index.ts",
	httpApi: "../../../../packages/web-domain/src/Http/Api.ts",
	authLogo: "../../components/PortstbdAuthLogo.tsx",
	loginForm: "../../app/(org)/login/form.tsx",
	signupForm: "../../app/(org)/signup/form.tsx",
	verifyOtpForm: "../../app/(org)/verify-otp/form.tsx",
	verifyOtpPage: "../../app/(org)/verify-otp/page.tsx",
	shareAuthOverlay: "../../app/s/[videoId]/_components/AuthOverlay.tsx",
} as const;

const legacyTransactionalBrandPattern =
	/Your Cap|Welcome to Cap|View Your Cap|created your first Cap|With Cap|Cap Recording|Cap Screenshot|Cap Upload|Cap HTTP API/;
const legacyAuthBrandPattern =
	/Sign in to Cap|Sign up to Cap|Beautiful screen recordings, owned by you|agree to Cap's|Verify Code \| Cap|LogoBadge/;

type Task5BrandSourceName = keyof typeof task5BrandSources;

const loadTask5BrandSources = async () => {
	const entries = await Promise.all(
		Object.entries(task5BrandSources).map(async ([name, path]) => {
			const source = await readFile(new URL(path, import.meta.url), "utf8");

			return [name, source] as const;
		}),
	);

	return Object.fromEntries(entries) as Record<Task5BrandSourceName, string>;
};

const normalizeEmailHtml = (html: string) =>
	html
		.replaceAll("&amp;", "&")
		.replaceAll("&quot;", '"')
		.replace(/<!-- -->/g, "")
		.replace(/\s+/g, " ");

describe("PORTSTBD_BRAND", () => {
	it("uses the approved public brand", () => {
		expect(PORTSTBD_BRAND.companyName).toBe("Port & Starboard");
		expect(PORTSTBD_BRAND.productName).toBe("Port & Starboard Watch");
		expect(PORTSTBD_BRAND.domain).toBe("watch.portstbd.com");
		expect(PORTSTBD_BRAND.colors.atlanticBlue).toBe("#163760");
	});

	it("falls back to the approved production URL", () => {
		expect(getPortstbdWebUrl({})).toBe("https://watch.portstbd.com");
	});

	it("falls back when runtime URL values are blank", () => {
		expect(
			getPortstbdWebUrl({
				NEXT_PUBLIC_WEB_URL: "  ",
				WEB_URL: "\t",
			}),
		).toBe("https://watch.portstbd.com");
	});

	it("skips blank public URL values before checking server URL values", () => {
		expect(
			getPortstbdWebUrl({
				NEXT_PUBLIC_WEB_URL: "  ",
				WEB_URL: "watch.portstbd.com",
			}),
		).toBe("https://watch.portstbd.com");
	});

	it("normalizes bare host runtime URL values", () => {
		expect(
			getPortstbdWebUrl({
				NEXT_PUBLIC_WEB_URL: "watch.portstbd.com",
			}),
		).toBe("https://watch.portstbd.com");
	});

	it("skips protocol-relative runtime URL values", () => {
		expect(
			getPortstbdWebUrl({
				NEXT_PUBLIC_WEB_URL: "//evil.example",
				WEB_URL: "watch.portstbd.com",
			}),
		).toBe("https://watch.portstbd.com");
	});

	it("falls back when runtime URL values use unsupported protocols", () => {
		expect(
			getPortstbdWebUrl({
				NEXT_PUBLIC_WEB_URL: "javascript://evil.example",
				WEB_URL: "ftp://evil.example",
			}),
		).toBe("https://watch.portstbd.com");
	});

	it("uses the default URL when process is unavailable", () => {
		const originalProcess = globalThis.process;

		vi.stubGlobal("process", undefined);

		try {
			expect(getPortstbdWebUrl()).toBe("https://watch.portstbd.com");
		} finally {
			vi.stubGlobal("process", originalProcess);
		}
	});

	it("prefers runtime public URL values", () => {
		expect(
			getPortstbdWebUrl({
				NEXT_PUBLIC_WEB_URL: "https://staging-watch.portstbd.com",
			}),
		).toBe("https://staging-watch.portstbd.com");
		expect(getPortstbdWebUrl({ WEB_URL: "https://watch.portstbd.com" })).toBe(
			"https://watch.portstbd.com",
		);
	});

	it("builds absolute asset URLs from the runtime public URL", () => {
		expect(
			buildPortstbdAssetUrl("/port-starboard-logo-email.png", {
				NEXT_PUBLIC_WEB_URL: "https://staging-watch.portstbd.com",
			}),
		).toBe("https://staging-watch.portstbd.com/port-starboard-logo-email.png");
	});

	it("rejects protocol-relative asset paths", () => {
		expect(() =>
			buildPortstbdAssetUrl("//evil.example/x" as `/${string}`, {}),
		).toThrow("Asset path must not be protocol-relative");
	});

	it("renders MVP transactional emails with Port & Starboard branding", async () => {
		vi.stubEnv("NEXT_PUBLIC_WEB_URL", "https://watch.portstbd.com");

		try {
			const html = normalizeEmailHtml(
				[
					await render(
						OTPEmail({ email: "viewer@example.com", code: "123456" }),
					),
					await render(
						LoginLink({
							email: "viewer@example.com",
							url: "https://watch.portstbd.com/login",
						}),
					),
					await render(
						FirstView({
							email: "owner@example.com",
							url: "https://watch.portstbd.com/s/video-id",
							videoName: "Demo",
							viewerName: "Viewer",
						}),
					),
					await render(
						FirstShareableLink({
							email: "owner@example.com",
							url: "https://watch.portstbd.com/s/video-id",
						}),
					),
				].join("\n"),
			);

			expect(html).toContain("Port & Starboard verification code: 123456");
			expect(html).toContain("Port & Starboard login link");
			expect(html).toContain(
				'Your Port & Starboard video "Demo" just got its first view!',
			);
			expect(html).toContain("Your first share link is ready.");
			expect(html).toContain("View Video");
			expect(html).toContain(
				"https://watch.portstbd.com/port-starboard-logo-email.png",
			);
			expect(html).not.toContain("{{{RESEND_UNSUBSCRIBE_URL}}}");
			expect(html).not.toMatch(legacyTransactionalBrandPattern);
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it("keeps MVP transactional source paths wired to brand constants", async () => {
		const sources = await loadTask5BrandSources();

		for (const source of Object.values(sources)) {
			expect(source).not.toMatch(legacyTransactionalBrandPattern);
		}

		expect(sources.emailConfig).toMatch(
			/from = `\$\{PORTSTBD_BRAND\.companyName\} <no-reply@\$\{emailFromDomain\(\)\}>`;/,
		);
		expect(sources.otpEmail).toContain(
			'buildPortstbdAssetUrl("/port-starboard-logo-email.png")',
		);
		expect(sources.loginLinkEmail).toContain(
			'buildPortstbdAssetUrl("/port-starboard-logo-email.png")',
		);
		expect(sources.firstViewEmail).toContain(
			'buildPortstbdAssetUrl("/port-starboard-logo-email.png")',
		);
		expect(sources.firstShareableLinkEmail).toContain(
			'buildPortstbdAssetUrl("/port-starboard-logo-email.png")',
		);
		expect(sources.authOptions).toContain(
			"subject: PORTSTBD_BRAND.verificationEmailSubject",
		);
		expect(sources.notification).toMatch(
			/subject: `Your \$\{PORTSTBD_BRAND\.companyName\} video/,
		);
		expect(sources.desktopVideoApi).toMatch(
			/subject: `Your first \$\{PORTSTBD_BRAND\.companyName\} share link is ready`,/,
		);
		expect(sources.desktopVideoApi).toContain("marketing: isCapDeployment");
		expect(sources.desktopVideoApi).toContain(
			"PORTSTBD_BRAND.recordingTitleSuffix",
		);
		expect(sources.videoUploadAction).toContain(
			"PORTSTBD_BRAND.recordingTitleSuffix",
		);
		expect(sources.videoCreateForProcessingAction).toMatch(
			/name: `\$\{PORTSTBD_BRAND\.companyName\} Upload - \$\{formattedDate\}`/,
		);
		expect(sources.videosBackend).toMatch(
			/name: `\$\{PORTSTBD_BRAND\.recordingTitleSuffix\} - \$\{formattedDate\}`,/,
		);
		expect(sources.httpApi).toContain("Port & Starboard Watch HTTP API");
		expect(sources.authLogo).toContain("PORTSTBD_BRAND.logoAlt");
		expect(sources.loginForm).toContain("PORTSTBD_BRAND.productName");
		expect(sources.signupForm).toContain("PORTSTBD_BRAND.productName");
		expect(sources.verifyOtpPage).toContain("PORTSTBD_BRAND.productName");

		for (const source of [
			sources.authLogo,
			sources.loginForm,
			sources.signupForm,
			sources.verifyOtpForm,
			sources.verifyOtpPage,
			sources.shareAuthOverlay,
		]) {
			expect(source).not.toMatch(legacyAuthBrandPattern);
		}
	});
});
