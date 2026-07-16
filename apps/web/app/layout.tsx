import "@/app/globals.css";
import { buildEnv, serverEnv } from "@cap/env";
import { STRIPE_PLAN_IDS } from "@cap/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Effect } from "effect";
import type { Metadata } from "next";
import { Lato } from "next/font/google";
import Script from "next/script";
import type { PropsWithChildren } from "react";
import { SonnerToaster } from "@/components/SonnerToastProvider";
import { runPromise } from "@/lib/server";
import { getBootstrapData } from "@/utils/getBootstrapData";
import { PublicEnvContext } from "@/utils/public-env";
import { AuthContextProvider } from "./Layout/AuthContext";
import { resolveCurrentUser } from "./Layout/current-user";
import { PosthogIdentify } from "./Layout/PosthogIdentify";
import {
	PostHogProvider,
	ReactQueryProvider,
	SessionProvider,
} from "./Layout/providers";
import { StripeContextProvider } from "./Layout/StripeContext";
import { script } from "./themeScript";

const defaultFont = Lato({
	subsets: ["latin"],
	weight: ["400", "700"],
	display: "swap",
});

const themeScriptId = "theme-script";

export const metadata: Metadata = {
	title: "Port & Starboard Watch",
	description: "Secure video watch and sharing for Port & Starboard work.",
	openGraph: {
		title: "Port & Starboard Watch",
		description: "Secure video watch and sharing for Port & Starboard work.",
		type: "website",
		url: "https://watch.portstbd.com",
		images: ["https://watch.portstbd.com/og.png"],
	},
};

export const dynamic = "force-dynamic";

export default ({ children }: PropsWithChildren) =>
	Effect.gen(function* () {
		const bootstrapData = yield* Effect.promise(getBootstrapData);
		const env = serverEnv();
		const googleAuthAvailable = Boolean(
			env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim(),
		);
		const workosAuthAvailable = Boolean(
			env.WORKOS_CLIENT_ID?.trim() && env.WORKOS_API_KEY?.trim(),
		);

		return (
			<html
				suppressHydrationWarning
				className={defaultFont.className}
				lang="en"
			>
				<head>
					<link
						rel="icon"
						type="image/svg+xml"
						href="/port-starboard-logo.svg"
					/>
					<link
						rel="apple-touch-icon"
						sizes="180x180"
						href="/apple-touch-icon.png"
					/>
					<link
						rel="icon"
						type="image/png"
						sizes="32x32"
						href="/favicon-32x32.png"
					/>
					<link
						rel="icon"
						type="image/png"
						sizes="16x16"
						href="/favicon-16x16.png"
					/>
					<link rel="manifest" href="/site.webmanifest" />
					<link rel="shortcut icon" href="/favicon.ico" />
					<meta name="msapplication-TileColor" content="#163760" />
					<meta name="theme-color" content="#163760" />
				</head>
				<body suppressHydrationWarning>
					<Script id={themeScriptId} strategy="beforeInteractive">
						{`(${script.toString()})()`}
					</Script>
					<TooltipPrimitive.Provider>
						<PostHogProvider bootstrapData={bootstrapData}>
							<AuthContextProvider user={runPromise(resolveCurrentUser)}>
								<SessionProvider>
									<StripeContextProvider
										plans={
											env.VERCEL_ENV === "production"
												? STRIPE_PLAN_IDS.production
												: STRIPE_PLAN_IDS.development
										}
									>
										<PublicEnvContext
											value={{
												webUrl: buildEnv.NEXT_PUBLIC_WEB_URL,
												workosAuthAvailable,
												googleAuthAvailable,
											}}
										>
											<ReactQueryProvider>
												<SonnerToaster />
												<main className="w-full">{children}</main>
												<PosthogIdentify />
											</ReactQueryProvider>
										</PublicEnvContext>
									</StripeContextProvider>
								</SessionProvider>
							</AuthContextProvider>
						</PostHogProvider>
					</TooltipPrimitive.Provider>
				</body>
			</html>
		);
	}).pipe(runPromise);
