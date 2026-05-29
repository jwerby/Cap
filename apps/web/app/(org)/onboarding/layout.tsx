import { getCurrentUser } from "@cap/database/auth/session";
import { PortstbdAuthScaffold } from "@/components/PortstbdAuthScaffold";
import Bottom from "./components/Bottom";
import Stepper from "./components/Stepper";

export default async function OnboardingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const user = await getCurrentUser();
	const completedSteps = user?.onboardingSteps || {};

	return (
		<PortstbdAuthScaffold contentClassName="flex-col justify-center items-center px-5 py-10 w-full custom-scroll min-h-fit lg:min-h-auto h-dvh">
			<Stepper completedSteps={completedSteps} />
			{children}
			<Bottom />
		</PortstbdAuthScaffold>
	);
}
