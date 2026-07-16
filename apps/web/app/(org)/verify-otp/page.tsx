import { getCurrentUser } from "@cap/database/auth/session";
import { serverEnv } from "@cap/env";
import { PORTSTBD_BRAND } from "@cap/utils";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PortstbdAuthScaffold } from "@/components/PortstbdAuthScaffold";
import { getSafeNextPath } from "../safe-next";
import { VerifyOTPForm } from "./form";

export const metadata = {
	title: `Verify Code | ${PORTSTBD_BRAND.productName}`,
};

export default async function VerifyOTPPage(props: {
	searchParams: Promise<{ email?: string; next?: string; lastSent?: string }>;
}) {
	const searchParams = await props.searchParams;
	const user = await getCurrentUser();

	if (user) {
		redirect(getSafeNextPath(searchParams.next, serverEnv().WEB_URL));
	}

	if (!searchParams.email) {
		redirect("/login");
	}

	return (
		<PortstbdAuthScaffold contentClassName="min-h-dvh items-center justify-center px-4 py-10">
			<Suspense fallback={null}>
				<VerifyOTPForm
					email={searchParams.email?.toLowerCase() ?? ""}
					next={searchParams.next}
					lastSent={searchParams.lastSent}
				/>
			</Suspense>
		</PortstbdAuthScaffold>
	);
}
