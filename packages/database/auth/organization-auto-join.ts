import { serverEnv } from "@cap/env";
import { Organisation, User } from "@cap/web-domain";
import { and, eq, isNull, or } from "drizzle-orm";
import { nanoId } from "../helpers.ts";
import { db } from "../index.ts";
import { addUserToOrganizationSpaces } from "../organization-space-membership.ts";
import { organizationMembers, organizations, users } from "../schema.ts";

export const PORTSTBD_AUTO_JOIN_EMAIL_DOMAIN = "portstbd.com";

export const PORTSTBD_ORG_RECONCILIATION_FAILED =
	"PORTSTBD_ORG_RECONCILIATION_FAILED";

type AutoJoinCheckInput = {
	email?: string | null;
	organizationId?: string | null;
};

function emailHasPortstbdDomain(email: string | null | undefined) {
	const normalizedEmail = email?.trim().toLowerCase();
	if (!normalizedEmail) return false;
	const atIndex = normalizedEmail.lastIndexOf("@");
	if (atIndex < 0) return false;
	return normalizedEmail.slice(atIndex + 1) === PORTSTBD_AUTO_JOIN_EMAIL_DOMAIN;
}

export function shouldAutoJoinPortstbdOrganization({
	email,
	organizationId,
}: AutoJoinCheckInput) {
	return !!organizationId?.trim() && emailHasPortstbdDomain(email);
}

type OrganizationAccessClient = Pick<ReturnType<typeof db>, "select">;

async function userCanAccessOrganization(
	tx: OrganizationAccessClient,
	organizationId: Organisation.OrganisationId,
	userId: User.UserId,
) {
	const [organization] = await tx
		.select({ ownerId: organizations.ownerId })
		.from(organizations)
		.where(
			and(
				eq(organizations.id, organizationId),
				isNull(organizations.tombstoneAt),
			),
		)
		.limit(1);

	if (!organization) return false;
	if (organization.ownerId === userId) return true;

	const [membership] = await tx
		.select({ id: organizationMembers.id })
		.from(organizationMembers)
		.where(
			and(
				eq(organizationMembers.organizationId, organizationId),
				eq(organizationMembers.userId, userId),
			),
		)
		.limit(1);

	return !!membership;
}

export async function autoJoinPortstbdOrganization({
	userId,
	email,
}: {
	userId: string;
	email?: string | null;
}) {
	const organizationId = serverEnv().PORTSTBD_AUTO_JOIN_ORG_ID?.trim() ?? "";

	if (!shouldAutoJoinPortstbdOrganization({ email, organizationId })) {
		return;
	}

	const targetOrganizationId = Organisation.OrganisationId.make(organizationId);
	const targetUserId = User.UserId.make(userId);

	try {
		await db().transaction(async (tx) => {
			const [organization] = await tx
				.select({ ownerId: organizations.ownerId })
				.from(organizations)
				.where(
					and(
						eq(organizations.id, targetOrganizationId),
						isNull(organizations.tombstoneAt),
					),
				)
				.limit(1);

			if (!organization) {
				throw new Error(
					`Configured PORTSTBD_AUTO_JOIN_ORG_ID ${targetOrganizationId} is missing or tombstoned`,
				);
			}

			const [membership] = await tx
				.select({ id: organizationMembers.id })
				.from(organizationMembers)
				.where(
					and(
						eq(organizationMembers.organizationId, targetOrganizationId),
						eq(organizationMembers.userId, targetUserId),
					),
				)
				.limit(1);

			const isOwner = organization.ownerId === targetUserId;
			const newlyEnrolled = !membership && !isOwner;

			if (newlyEnrolled) {
				await tx.insert(organizationMembers).values({
					id: nanoId(),
					organizationId: targetOrganizationId,
					userId: targetUserId,
					role: "member",
				});
			}

			const [currentUser] = await tx
				.select({ activeOrganizationId: users.activeOrganizationId })
				.from(users)
				.where(eq(users.id, targetUserId))
				.limit(1);

			const activeOrganizationId = currentUser?.activeOrganizationId ?? null;
			const activeAccessible =
				!!activeOrganizationId &&
				(activeOrganizationId === targetOrganizationId ||
					(await userCanAccessOrganization(
						tx,
						Organisation.OrganisationId.make(activeOrganizationId),
						targetUserId,
					)));

			if (newlyEnrolled || !activeAccessible) {
				await tx
					.update(users)
					.set({
						activeOrganizationId: targetOrganizationId,
						defaultOrgId: targetOrganizationId,
					})
					.where(eq(users.id, targetUserId));
			} else {
				await tx
					.update(users)
					.set({ defaultOrgId: targetOrganizationId })
					.where(
						and(
							eq(users.id, targetUserId),
							or(
								isNull(users.defaultOrgId),
								eq(users.defaultOrgId, targetOrganizationId),
							),
						),
					);
			}

			await addUserToOrganizationSpaces(tx, {
				organizationId: targetOrganizationId,
				userId: targetUserId,
			});
		});
	} catch (error) {
		console.error(PORTSTBD_ORG_RECONCILIATION_FAILED, {
			userId: targetUserId,
			organizationId: targetOrganizationId,
			error,
		});
	}
}
