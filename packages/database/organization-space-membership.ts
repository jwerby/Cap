import { serverEnv } from "@cap/env";
import type { Organisation, Space, User } from "@cap/web-domain";
import { and, eq, inArray } from "drizzle-orm";
import { nanoId } from "./helpers.ts";
import type { db } from "./index.ts";
import {
	organizationMembers,
	organizations,
	spaceMembers,
	spaces,
} from "./schema.ts";

type SpaceMembershipClient = Pick<ReturnType<typeof db>, "select" | "insert">;

type SpaceMemberRole = "admin" | "member";

type ExistingSpaceMembership = {
	spaceId: string;
	userId: string;
};

function spaceMembershipKey(spaceId: string, userId: string) {
	return `${spaceId}:${userId}`;
}

export function shouldAutoSyncOrganizationSpaceMembers(
	organizationId: Organisation.OrganisationId,
) {
	const autoSyncOrganizationId =
		serverEnv().PORTSTBD_AUTO_JOIN_ORG_ID?.trim() ?? "";

	return (
		autoSyncOrganizationId.length > 0 &&
		organizationId === autoSyncOrganizationId
	);
}

export function createMissingSpaceMemberRows({
	spaceIds,
	userIds,
	existingMemberships,
	adminUserIds = [],
	createId = nanoId,
}: {
	spaceIds: Array<Space.SpaceIdOrOrganisationId>;
	userIds: Array<User.UserId>;
	existingMemberships: ExistingSpaceMembership[];
	adminUserIds?: string[];
	createId?: () => string;
}) {
	const existingKeys = new Set(
		existingMemberships.map((membership) =>
			spaceMembershipKey(membership.spaceId, membership.userId),
		),
	);
	const adminUsers = new Set(adminUserIds);
	const uniqueSpaceIds = [...new Set(spaceIds)];
	const uniqueUserIds = [...new Set(userIds)];

	return uniqueSpaceIds.flatMap((spaceId) =>
		uniqueUserIds.flatMap((userId) => {
			if (existingKeys.has(spaceMembershipKey(spaceId, userId))) return [];

			const role: SpaceMemberRole = adminUsers.has(userId) ? "admin" : "member";
			return [
				{
					id: createId(),
					spaceId,
					userId,
					role,
				},
			];
		}),
	);
}

export async function addUserToOrganizationSpaces(
	client: SpaceMembershipClient,
	{
		organizationId,
		userId,
	}: {
		organizationId: Organisation.OrganisationId;
		userId: User.UserId;
	},
) {
	if (!shouldAutoSyncOrganizationSpaceMembers(organizationId)) return 0;

	const spaceRows = await client
		.select({ id: spaces.id })
		.from(spaces)
		.where(eq(spaces.organizationId, organizationId));
	const spaceIds = spaceRows.map((space) => space.id);
	if (spaceIds.length === 0) return 0;

	const existingMemberships = await client
		.select({ spaceId: spaceMembers.spaceId, userId: spaceMembers.userId })
		.from(spaceMembers)
		.where(
			and(
				eq(spaceMembers.userId, userId),
				inArray(spaceMembers.spaceId, spaceIds),
			),
		);
	const rows = createMissingSpaceMemberRows({
		spaceIds,
		userIds: [userId],
		existingMemberships,
	});
	if (rows.length === 0) return 0;

	await client.insert(spaceMembers).values(rows);
	return rows.length;
}

export async function addOrganizationMembersToSpace(
	client: SpaceMembershipClient,
	{
		organizationId,
		spaceId,
		adminUserIds = [],
	}: {
		organizationId: Organisation.OrganisationId;
		spaceId: Space.SpaceIdOrOrganisationId;
		adminUserIds?: string[];
	},
) {
	if (!shouldAutoSyncOrganizationSpaceMembers(organizationId)) return 0;

	const [organization] = await client
		.select({ ownerId: organizations.ownerId })
		.from(organizations)
		.where(eq(organizations.id, organizationId))
		.limit(1);
	const memberRows = await client
		.select({ userId: organizationMembers.userId })
		.from(organizationMembers)
		.where(eq(organizationMembers.organizationId, organizationId));
	const userIds = [
		...new Set([
			...(organization?.ownerId ? [organization.ownerId] : []),
			...memberRows.map((member) => member.userId),
		]),
	];
	if (userIds.length === 0) return 0;

	const existingMemberships = await client
		.select({ spaceId: spaceMembers.spaceId, userId: spaceMembers.userId })
		.from(spaceMembers)
		.where(eq(spaceMembers.spaceId, spaceId));
	const rows = createMissingSpaceMemberRows({
		spaceIds: [spaceId],
		userIds,
		existingMemberships,
		adminUserIds,
	});
	if (rows.length === 0) return 0;

	await client.insert(spaceMembers).values(rows);
	return rows.length;
}
