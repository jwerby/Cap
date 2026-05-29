import { describe, expect, it } from "vitest";
import {
	PORTSTBD_AUTO_JOIN_EMAIL_DOMAIN,
	shouldAutoJoinPortstbdOrganization,
} from "../../../../packages/database/auth/organization-auto-join";

describe("Port & Starboard organization auto-join", () => {
	it("allows Google-authenticated portstbd.com users when an organization is configured", () => {
		expect(PORTSTBD_AUTO_JOIN_EMAIL_DOMAIN).toBe("portstbd.com");
		expect(
			shouldAutoJoinPortstbdOrganization({
				provider: "google",
				email: "new.user@portstbd.com",
				organizationId: "org-123",
			}),
		).toBe(true);
	});

	it("rejects non-Google auth, other domains, and missing organization config", () => {
		expect(
			shouldAutoJoinPortstbdOrganization({
				provider: "email",
				email: "new.user@portstbd.com",
				organizationId: "org-123",
			}),
		).toBe(false);
		expect(
			shouldAutoJoinPortstbdOrganization({
				provider: "google",
				email: "new.user@example.com",
				organizationId: "org-123",
			}),
		).toBe(false);
		expect(
			shouldAutoJoinPortstbdOrganization({
				provider: "google",
				email: "new.user@portstbd.com",
				organizationId: undefined,
			}),
		).toBe(false);
	});
});
