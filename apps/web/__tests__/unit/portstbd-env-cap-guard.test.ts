import { posthogHostSchema, webUrlSchema } from "@cap/env";
import { describe, expect, it } from "vitest";

describe("Cap-mode env guard", () => {
	describe("webUrlSchema (NEXT_PUBLIC_WEB_URL / WEB_URL)", () => {
		it("accepts the production Port & Starboard Watch URL", () => {
			const result = webUrlSchema.safeParse("https://watch.portstbd.com");
			expect(result.success).toBe(true);
		});

		it("accepts the staging Port & Starboard Watch URL", () => {
			const result = webUrlSchema.safeParse(
				"https://staging-watch.portstbd.com",
			);
			expect(result.success).toBe(true);
		});

		it("accepts an arbitrary self-hosted URL", () => {
			const result = webUrlSchema.safeParse("https://watch.example.com");
			expect(result.success).toBe(true);
		});

		it("accepts a localhost URL", () => {
			const result = webUrlSchema.safeParse("http://localhost:3000");
			expect(result.success).toBe(true);
		});

		it("rejects the Cap production URL", () => {
			const result = webUrlSchema.safeParse("https://cap.so");
			expect(result.success).toBe(false);
			expect(result.error?.errors[0]?.message).toContain("cap.so");
			expect(result.error?.errors[0]?.message).toContain(
				"Port & Starboard Watch",
			);
		});

		it("rejects a subdomain of cap.so", () => {
			const result = webUrlSchema.safeParse("https://app.cap.so");
			expect(result.success).toBe(false);
			expect(result.error?.errors[0]?.message).toContain("cap.so");
		});

		it("accepts a URL that merely contains 'cap' without 'cap.so'", () => {
			const result = webUrlSchema.safeParse("https://recap.example.com");
			expect(result.success).toBe(true);
		});
	});

	describe("posthogHostSchema (NEXT_PUBLIC_POSTHOG_HOST)", () => {
		it("accepts undefined (analytics not configured)", () => {
			const result = posthogHostSchema.safeParse(undefined);
			expect(result.success).toBe(true);
		});

		it("accepts an empty string (analytics not configured)", () => {
			const result = posthogHostSchema.safeParse("");
			expect(result.success).toBe(true);
		});

		it("accepts a self-hosted PostHog URL", () => {
			const result = posthogHostSchema.safeParse("https://posthog.example.com");
			expect(result.success).toBe(true);
		});

		it("rejects Cap's PostHog host (app.posthog.com)", () => {
			const result = posthogHostSchema.safeParse("https://app.posthog.com");
			expect(result.success).toBe(false);
			expect(result.error?.errors[0]?.message).toContain("app.posthog.com");
		});

		it("rejects the bare Cap PostHog hostname", () => {
			const result = posthogHostSchema.safeParse("app.posthog.com");
			expect(result.success).toBe(false);
			expect(result.error?.errors[0]?.message).toContain("app.posthog.com");
		});
	});
});
