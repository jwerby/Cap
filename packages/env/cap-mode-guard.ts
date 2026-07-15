import { z } from "zod";

export const CAP_SO_PATTERN = /\bcap\.so\b/;
export const CAP_POSTHOG_HOST = "app.posthog.com";

export const webUrlSchema = z
	.string()
	.refine(
		(v) => !CAP_SO_PATTERN.test(v),
		"WEB_URL / NEXT_PUBLIC_WEB_URL must not contain cap.so — configure the Port & Starboard Watch URL instead",
	);

export const posthogHostSchema = z
	.string()
	.optional()
	.refine(
		(v) => !v || !v.includes(CAP_POSTHOG_HOST),
		"NEXT_PUBLIC_POSTHOG_HOST must not point at Cap's PostHog (app.posthog.com) — this fork uses its own analytics configuration",
	);
