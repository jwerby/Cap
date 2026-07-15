import { describe, expect, it } from "vitest";
import {
	PORTSTBD_AUTO_JOIN_EMAIL_DOMAIN,
	shouldAutoJoinPortstbdOrganization,
} from "../../../../packages/database/auth/organization-auto-join";

describe("Port & Starboard organization auto-join", () => {
	it("allows verified portstbd.com users when an organization is configured", () => {
		expect(PORTSTBD_AUTO_JOIN_EMAIL_DOMAIN).toBe("portstbd.com");
		expect(
			shouldAutoJoinPortstbdOrganization({
				email: "new.user@portstbd.com",
				organizationId: "org-123",
			}),
		).toBe(true);
	});

	it("is provider-neutral: email/OTP and WorkOS portstbd users qualify", () => {
		for (const email of [
			"otp.user@portstbd.com",
			"WorkOS.User@PORTSTBD.COM",
			"  padded@portstbd.com  ",
		]) {
			expect(
				shouldAutoJoinPortstbdOrganization({
					email,
					organizationId: "org-123",
				}),
			).toBe(true);
		}
	});

	it("rejects other domains and missing organization config", () => {
		expect(
			shouldAutoJoinPortstbdOrganization({
				email: "new.user@example.com",
				organizationId: "org-123",
			}),
		).toBe(false);
		expect(
			shouldAutoJoinPortstbdOrganization({
				email: "spoof@portstbd.com.evil.com",
				organizationId: "org-123",
			}),
		).toBe(false);
		expect(
			shouldAutoJoinPortstbdOrganization({
				email: "new.user@portstbd.com",
				organizationId: undefined,
			}),
		).toBe(false);
		expect(
			shouldAutoJoinPortstbdOrganization({
				email: "new.user@portstbd.com",
				organizationId: "   ",
			}),
		).toBe(false);
		expect(
			shouldAutoJoinPortstbdOrganization({
				email: null,
				organizationId: "org-123",
			}),
		).toBe(false);
	});
});
