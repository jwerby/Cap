import { getCurrentUser } from "@cap/database/auth/session";
import { buildEnv } from "@cap/env";
import { isCapDeployment } from "@cap/utils";
import { redirect } from "next/navigation";
import {
	type OnboardingStepSlug,
	onboardingStepsForDeployment,
} from "../onboarding-flow";

export default async function OnboardingStepLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ steps: string[] }>;
}) {
	const user = await getCurrentUser();

	if (!user) {
		redirect("/login");
	}

	const steps = user.onboardingSteps || {};
	const currentStep = (await params).steps?.[0] ?? "welcome";
	const capDeployment = isCapDeployment(buildEnv.NEXT_PUBLIC_IS_CAP);

	const ordered = onboardingStepsForDeployment(capDeployment).map(
		(step) => step.slug,
	);
	const isComplete = (s: OnboardingStepSlug) =>
		s === "welcome"
			? Boolean(steps.welcome && user.name)
			: s === "organization-setup"
				? Boolean(steps.organizationSetup)
				: s === "custom-domain"
					? Boolean(steps.customDomain)
					: s === "invite-team"
						? Boolean(steps.inviteTeam)
						: Boolean(steps.download);

	const firstIncomplete =
		ordered.find((s) => !isComplete(s)) ?? (capDeployment ? "download" : null);

	if (!firstIncomplete) redirect("/dashboard/caps");

	if (currentStep !== firstIncomplete) {
		redirect(`/onboarding/${firstIncomplete}`);
	}

	return children;
}
