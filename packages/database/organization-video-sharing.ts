import { serverEnv } from "@cap/env";
import type { Organisation, User, Video } from "@cap/web-domain";

import { nanoId } from "./helpers.ts";

export function shouldAutoShareVideoWithOrganization(
	organizationId: Organisation.OrganisationId,
) {
	const autoShareOrganizationId =
		serverEnv().PORTSTBD_AUTO_JOIN_ORG_ID?.trim() ?? "";

	return (
		autoShareOrganizationId.length > 0 &&
		organizationId === autoShareOrganizationId
	);
}

export function createAutoOrganizationVideoShare({
	videoId,
	organizationId,
	sharedByUserId,
}: {
	videoId: Video.VideoId;
	organizationId: Organisation.OrganisationId;
	sharedByUserId: User.UserId;
}) {
	if (!shouldAutoShareVideoWithOrganization(organizationId)) return null;

	return {
		id: nanoId(),
		videoId,
		organizationId,
		sharedByUserId,
	};
}
