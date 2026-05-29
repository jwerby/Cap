import { serverEnv } from "@cap/env";
import { Organisation, User } from "@cap/web-domain";
import { and, eq, isNull } from "drizzle-orm";
import { nanoId } from "../helpers.ts";
import { db } from "../index.ts";
import { organizationMembers, organizations, users } from "../schema.ts";

export const PORTSTBD_AUTO_JOIN_EMAIL_DOMAIN = "portstbd.com";

type AutoJoinCheckInput = {
	provider?: string | null;
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
	provider,
	email,
	organizationId,
}: AutoJoinCheckInput) {
	return (
		provider === "google" &&
		!!organizationId?.trim() &&
		emailHasPortstbdDomain(email)
	);
}

export async function autoJoinPortstbdOrganization({
	provider,
	userId,
	email,
}: {
	provider?: string | null;
	userId: string;
	email?: string | null;
}) {
	const organizationId = serverEnv().PORTSTBD_AUTO_JOIN_ORG_ID?.trim() ?? "";

	if (
		!shouldAutoJoinPortstbdOrganization({
			provider,
			email,
			organizationId,
		})
	) {
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

			if (!organization) return;

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

			if (!membership && organization.ownerId !== targetUserId) {
				await tx.insert(organizationMembers).values({
					id: nanoId(),
					organizationId: targetOrganizationId,
					userId: targetUserId,
					role: "member",
				});
			}

			await tx
				.update(users)
				.set({
					activeOrganizationId: targetOrganizationId,
					defaultOrgId: targetOrganizationId,
				})
				.where(eq(users.id, targetUserId));
		});
	} catch (error) {
		console.error("Failed to auto-join Port & Starboard organization", error);
	}
}
