import { getCurrentUser } from "@cap/database/auth/session";
import { buildEnv, serverEnv } from "@cap/env";
import { isCapDeployment } from "@cap/utils";
import { notFound, redirect } from "next/navigation";
import ReferClient from "./ReferClient";

export const metadata = {
	title: "Refer - Port & Starboard Watch",
	description: "Earn rewards by referring friends to Port & Starboard Watch",
};

async function generateEmbedToken(
	userId: string,
	userName: string | null,
	userEmail: string,
	userImage: string | null,
) {
	const response = await fetch("https://api.dub.co/tokens/embed/referrals", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${serverEnv().DUB_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			tenantId: userId,
			partner: {
				name: userName || userEmail,
				email: userEmail,
				image: userImage || undefined,
				tenantId: userId,
			},
		}),
	});

	if (!response.ok) {
		throw new Error("Failed to generate embed token");
	}

	const data = await response.json();
	return data.publicToken || data.token;
}

export default async function ReferPage() {
	if (!isCapDeployment(buildEnv.NEXT_PUBLIC_IS_CAP)) notFound();

	// Check if Dub Partners is available
	if (!serverEnv().DUB_API_KEY) {
		redirect("/dashboard/caps");
	}

	const user = await getCurrentUser();
	if (!user || !user.id) {
		redirect("/login");
	}

	const token = await generateEmbedToken(
		user.id,
		user.name,
		user.email,
		user.image,
	);

	return <ReferClient token={token} />;
}
