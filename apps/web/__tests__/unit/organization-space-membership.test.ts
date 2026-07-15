import { describe, expect, it } from "vitest";
import { createMissingSpaceMemberRows } from "../../../../packages/database/organization-space-membership";

describe("Port & Starboard space membership sync", () => {
	it("builds missing private space memberships without duplicating existing rows", () => {
		const rows = createMissingSpaceMemberRows({
			spaceIds: ["space-a" as never, "space-b" as never],
			userIds: ["user-a" as never, "user-b" as never],
			existingMemberships: [{ spaceId: "space-a", userId: "user-a" }],
			adminUserIds: ["user-b"],
			createId: () => "membership-id",
		});

		expect(rows).toEqual([
			{
				id: "membership-id",
				spaceId: "space-a",
				userId: "user-b",
				role: "admin",
			},
			{
				id: "membership-id",
				spaceId: "space-b",
				userId: "user-a",
				role: "member",
			},
			{
				id: "membership-id",
				spaceId: "space-b",
				userId: "user-b",
				role: "admin",
			},
		]);
	});
});
