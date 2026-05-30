import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	userIsPro: vi.fn(
		(user?: { stripeSubscriptionStatus?: string | null } | null) =>
			user?.stripeSubscriptionStatus === "active",
	),
}));

vi.mock("@cap/utils", () => ({
	userIsPro: mocks.userIsPro,
}));

import { isAiGenerationEnabled } from "@/utils/flags";

describe("AI generation flags", () => {
	it("enables AI generation for Port and Starboard email accounts", async () => {
		await expect(
			isAiGenerationEnabled({
				email: "Alexandra@PORTSTBD.com ",
				stripeSubscriptionStatus: null,
				thirdPartyStripeSubscriptionId: null,
			}),
		).resolves.toBe(true);
	});

	it("keeps AI generation enabled for Pro accounts", async () => {
		await expect(
			isAiGenerationEnabled({
				email: "person@example.com",
				stripeSubscriptionStatus: "active",
				thirdPartyStripeSubscriptionId: null,
			}),
		).resolves.toBe(true);
	});

	it("keeps AI generation disabled for non-Pro external accounts", async () => {
		await expect(
			isAiGenerationEnabled({
				email: "person@example.com",
				stripeSubscriptionStatus: null,
				thirdPartyStripeSubscriptionId: null,
			}),
		).resolves.toBe(false);
	});
});
