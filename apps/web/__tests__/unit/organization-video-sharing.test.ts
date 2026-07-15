import { beforeEach, describe, expect, it, vi } from "vitest";

const serverEnvMock = vi.hoisted(() => vi.fn());

vi.mock("@cap/env", () => ({
	serverEnv: serverEnvMock,
}));

vi.mock("@cap/web-domain", () => ({
	Organisation: {},
	User: {},
	Video: {},
}));

vi.mock("@cap/database/helpers", () => ({
	nanoId: vi.fn(() => "generated-id"),
}));

import {
	createAutoOrganizationVideoShare,
	shouldAutoShareVideoWithOrganization,
} from "../../../../packages/database/organization-video-sharing";

type OrgId = string & { readonly __brand: "OrganisationId" };
const orgId = (s: string) => s as OrgId;

describe("shouldAutoShareVideoWithOrganization", () => {
	describe("gate enabled: PORTSTBD_AUTO_JOIN_ORG_ID is set", () => {
		beforeEach(() => {
			serverEnvMock.mockReturnValue({ PORTSTBD_AUTO_JOIN_ORG_ID: "org-abc" });
		});

		it("returns true when the organizationId matches the configured org", () => {
			expect(shouldAutoShareVideoWithOrganization(orgId("org-abc"))).toBe(true);
		});

		it("returns false when the organizationId does not match the configured org", () => {
			expect(shouldAutoShareVideoWithOrganization(orgId("org-other"))).toBe(
				false,
			);
		});

		it("returns false for an empty organizationId string even if env is set", () => {
			expect(shouldAutoShareVideoWithOrganization(orgId(""))).toBe(false);
		});
	});

	describe("gate disabled: PORTSTBD_AUTO_JOIN_ORG_ID is absent or blank", () => {
		it("returns false when the env var is undefined", () => {
			serverEnvMock.mockReturnValue({ PORTSTBD_AUTO_JOIN_ORG_ID: undefined });
			expect(shouldAutoShareVideoWithOrganization(orgId("org-abc"))).toBe(
				false,
			);
		});

		it("returns false when the env var is an empty string", () => {
			serverEnvMock.mockReturnValue({ PORTSTBD_AUTO_JOIN_ORG_ID: "" });
			expect(shouldAutoShareVideoWithOrganization(orgId("org-abc"))).toBe(
				false,
			);
		});

		it("returns false when the env var is whitespace only", () => {
			serverEnvMock.mockReturnValue({ PORTSTBD_AUTO_JOIN_ORG_ID: "   " });
			expect(shouldAutoShareVideoWithOrganization(orgId("org-abc"))).toBe(
				false,
			);
		});
	});

	it("trims whitespace from the env var before comparing", () => {
		serverEnvMock.mockReturnValue({
			PORTSTBD_AUTO_JOIN_ORG_ID: "  org-abc  ",
		});
		expect(shouldAutoShareVideoWithOrganization(orgId("org-abc"))).toBe(true);
		expect(shouldAutoShareVideoWithOrganization(orgId("  org-abc  "))).toBe(
			false,
		);
	});
});

describe("createAutoOrganizationVideoShare", () => {
	beforeEach(() => {
		serverEnvMock.mockReturnValue({ PORTSTBD_AUTO_JOIN_ORG_ID: "org-abc" });
	});

	it("returns a share record when gate is enabled and org matches", () => {
		const result = createAutoOrganizationVideoShare({
			videoId: "vid-1" as never,
			organizationId: orgId("org-abc"),
			sharedByUserId: "user-1" as never,
		});
		expect(result).not.toBeNull();
		expect(result).toMatchObject({
			videoId: "vid-1",
			organizationId: "org-abc",
			sharedByUserId: "user-1",
		});
		expect(result?.id).toBe("generated-id");
	});

	it("returns null when gate is disabled", () => {
		serverEnvMock.mockReturnValue({ PORTSTBD_AUTO_JOIN_ORG_ID: undefined });
		const result = createAutoOrganizationVideoShare({
			videoId: "vid-1" as never,
			organizationId: orgId("org-abc"),
			sharedByUserId: "user-1" as never,
		});
		expect(result).toBeNull();
	});

	it("returns null when organizationId does not match the configured org", () => {
		const result = createAutoOrganizationVideoShare({
			videoId: "vid-1" as never,
			organizationId: orgId("org-different"),
			sharedByUserId: "user-1" as never,
		});
		expect(result).toBeNull();
	});
});
