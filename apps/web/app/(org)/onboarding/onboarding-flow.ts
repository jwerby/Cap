export const ONBOARDING_STEPS = [
	{
		id: "1",
		slug: "welcome",
		name: "Welcome",
		completionKey: "welcome",
	},
	{
		id: "2",
		slug: "organization-setup",
		name: "Organization Setup",
		completionKey: "organizationSetup",
	},
	{
		id: "3",
		slug: "custom-domain",
		name: "Custom Domain",
		completionKey: "customDomain",
	},
	{
		id: "4",
		slug: "invite-team",
		name: "Invite your team",
		completionKey: "inviteTeam",
	},
	{
		id: "5",
		slug: "download",
		name: "Download",
		completionKey: "download",
	},
] as const;

export type OnboardingStepSlug = (typeof ONBOARDING_STEPS)[number]["slug"];

export const onboardingStepsForDeployment = (capDeployment: boolean) =>
	capDeployment ? ONBOARDING_STEPS : ONBOARDING_STEPS.slice(0, 2);
