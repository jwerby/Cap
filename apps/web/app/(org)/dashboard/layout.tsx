import { getCurrentUser } from "@cap/database/auth/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthContextProvider } from "@/app/Layout/AuthContext";
import { resolveCurrentUser } from "@/app/Layout/current-user";
import { resolveTheme } from "@/app/themeScript";
import { runPromise } from "@/lib/server";
import DashboardInner from "./_components/DashboardInner";
import MobileTab from "./_components/MobileTab";
import DesktopNav from "./_components/Navbar/Desktop";
import MobileNav from "./_components/Navbar/Mobile";
import { DashboardContexts } from "./Contexts";
import { UploadingProvider } from "./caps/UploadingContext";
import {
	getDashboardData,
	type Organization,
	type OrganizationSettings,
	type Spaces,
	type UserPreferences,
} from "./dashboard-data";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const user = await getCurrentUser();
	if (!user) redirect("/login");

	if (!user.name || user.name.length === 0) {
		redirect("/onboarding/welcome");
	}

	let organizationSelect: Organization[] = [];
	let userCapsCount: number | null = 0;
	let organizationSettings: OrganizationSettings | null = null;
	let spacesData: Spaces[] = [];
	let anyNewNotifications = false;
	let userPreferences: UserPreferences;
	try {
		const dashboardData = await getDashboardData(user);
		organizationSelect = dashboardData.organizationSelect;
		userCapsCount = dashboardData.userCapsCount;
		organizationSettings = dashboardData.organizationSettings;
		userPreferences = dashboardData.userPreferences?.preferences || null;
		spacesData = dashboardData.spacesData;
		anyNewNotifications = dashboardData.anyNewNotifications;
	} catch (error) {
		console.error("Failed to load dashboard data", error);
		organizationSelect = [];
		userCapsCount = 0;
		organizationSettings = null;
		spacesData = [];
		anyNewNotifications = false;
		userPreferences = null;
	}

	let activeOrganization = organizationSelect.find(
		(organization) =>
			organization.organization.id === user.activeOrganizationId,
	);

	if (!activeOrganization && organizationSelect.length > 0) {
		activeOrganization = organizationSelect[0];
	}

	const theme = resolveTheme((await cookies()).get("theme")?.value);
	const sidebar = (await cookies()).get("sidebarCollapsed")?.value ?? "false";
	const referClicked = (await cookies()).get("referClicked")?.value ?? "false";

	return (
		<AuthContextProvider user={runPromise(resolveCurrentUser)}>
			<UploadingProvider>
				<DashboardContexts
					organizationSettings={organizationSettings}
					userCapsCount={userCapsCount}
					organizationData={organizationSelect}
					activeOrganization={activeOrganization || null}
					spacesData={spacesData}
					initialTheme={theme as "light" | "dark"}
					initialSidebarCollapsed={sidebar === "true"}
					anyNewNotifications={anyNewNotifications}
					userPreferences={userPreferences}
					referClicked={referClicked === "true"}
				>
					<div className="dashboard-grid bg-[radial-gradient(circle_at_top_left,#E6F2F5_0%,#EDF5F7_34%,#F7FBFC_100%)] text-[#163760] dark:bg-none dark:bg-gray-1 dark:text-gray-12">
						<DesktopNav />
						<div className="flex h-full [grid-area:main] focus:outline-none">
							<MobileNav />
							<DashboardInner>{children}</DashboardInner>
						</div>
						<MobileTab />
					</div>
				</DashboardContexts>
			</UploadingProvider>
		</AuthContextProvider>
	);
}
