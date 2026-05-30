import { userIsPro } from "@cap/utils";

export interface FeatureFlagUser {
	email: string;
	stripeSubscriptionStatus?: string | null;
	thirdPartyStripeSubscriptionId?: string | null;
}

function hasPortstbdEmail(user: FeatureFlagUser): boolean {
	const normalizedEmail = user.email.trim().toLowerCase();
	const atIndex = normalizedEmail.lastIndexOf("@");
	return atIndex >= 0 && normalizedEmail.slice(atIndex + 1) === "portstbd.com";
}

export async function isAiGenerationEnabled(
	user: FeatureFlagUser,
): Promise<boolean> {
	return hasPortstbdEmail(user) || userIsPro(user);
}
