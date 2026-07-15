import { readFile } from "node:fs/promises";
import { isCapDeployment } from "@cap/utils";
import { describe, expect, it } from "vitest";

const suppressionSources = {
	topNav: "../../app/(org)/dashboard/_components/Navbar/Top.tsx",
	sideNav: "../../app/(org)/dashboard/_components/Navbar/Items.tsx",
	usageButton: "../../components/UsageButton.tsx",
	recordPage: "../../app/(org)/dashboard/caps/record/RecordVideoPage.tsx",
	referPage: "../../app/(org)/dashboard/refer/page.tsx",
	embedVideo: "../../app/embed/[videoId]/_components/EmbedVideo.tsx",
	onboardingLayout: "../../app/(org)/onboarding/[...steps]/layout.tsx",
	onboardingStepper: "../../app/(org)/onboarding/components/Stepper.tsx",
	loomImport: "../../actions/loom.ts",
	downloadLink: "../../actions/send-download-link.ts",
	videoUpload: "../../actions/video/upload.ts",
	videoCreate: "../../actions/video/create-for-processing.ts",
	desktopVideo: "../../app/api/desktop/[...route]/video.ts",
	notification: "../../lib/Notification.ts",
	emailConfig: "../../../../packages/database/emails/config.ts",
	authOptions: "../../../../packages/database/auth/auth-options.ts",
} as const;

const loadSuppressionSources = async () => {
	const entries = await Promise.all(
		Object.entries(suppressionSources).map(async ([name, sourcePath]) => [
			name,
			await readFile(new URL(sourcePath, import.meta.url), "utf8"),
		]),
	);

	return Object.fromEntries(entries) as Record<
		keyof typeof suppressionSources,
		string
	>;
};

describe("Port and Starboard Cap-specific suppression", () => {
	it("treats only the literal true flag as a Cap deployment", () => {
		expect(isCapDeployment("true")).toBe(true);
		expect(isCapDeployment("false")).toBe(false);
		expect(isCapDeployment(undefined)).toBe(false);
	});

	it("keeps support, commercial, referral, and download surfaces Cap-only", async () => {
		const sources = await loadSuppressionSources();

		expect(sources.topNav).toMatch(
			/name: "Chat Support"[\s\S]*?showCondition: capDeployment/,
		);
		expect(sources.topNav).toMatch(
			/name: "Earn 40% Referral"[\s\S]*?showCondition: capDeployment/,
		);
		expect(sources.sideNav).toContain(
			"isCapDeployment(buildEnv.NEXT_PUBLIC_IS_CAP)",
		);
		expect(sources.usageButton).toContain(
			"if (!isCapDeployment(buildEnv.NEXT_PUBLIC_IS_CAP)) return null;",
		);
		expect(sources.recordPage).toContain(
			"const showDesktopRecorder = isCapDeployment(",
		);
		expect(sources.referPage).toContain(
			"if (!isCapDeployment(buildEnv.NEXT_PUBLIC_IS_CAP)) notFound();",
		);
		expect(sources.embedVideo).toContain(
			"isCapDeployment(buildEnv.NEXT_PUBLIC_IS_CAP) && (",
		);
		expect(sources.onboardingLayout).toContain(
			"onboardingStepsForDeployment(capDeployment)",
		);
		expect(sources.onboardingLayout).toContain('redirect("/dashboard/caps")');
		expect(sources.onboardingStepper).toContain(
			"onboardingStepsForDeployment(capDeployment)",
		);
	});

	it("prevents false string flags from creating Cap links or leaking auth debug data", async () => {
		const sources = await loadSuppressionSources();

		for (const source of [
			sources.videoUpload,
			sources.videoCreate,
			sources.desktopVideo,
			sources.notification,
			sources.emailConfig,
		]) {
			expect(source).toContain("isCapDeployment(buildEnv.NEXT_PUBLIC_IS_CAP)");
		}

		expect(sources.desktopVideo).not.toContain(
			"Boolean(buildEnv.NEXT_PUBLIC_IS_CAP)",
		);
		expect(sources.authOptions).toContain(
			'debug: process.env.NODE_ENV !== "production"',
		);
		expect(sources.loomImport).not.toContain(
			"https://cap.so/api/loom-import-rate-limit",
		);
		expect(sources.loomImport).not.toContain(
			"Contact support to raise this limit.",
		);
		expect(sources.downloadLink).not.toContain(
			"https://cap.so/api/send-download-link",
		);
		expect(sources.downloadLink).toContain(
			"if (!isCapDeployment(buildEnv.NEXT_PUBLIC_IS_CAP))",
		);
	});
});
