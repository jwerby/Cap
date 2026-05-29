"use client";

import { Button, Input } from "@cap/ui";
import { PORTSTBD_BRAND } from "@cap/utils";
import { Organisation } from "@cap/web-domain";
import {
	faArrowLeft,
	faEnvelope,
	faExclamationCircle,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { AnimatePresence, motion } from "framer-motion";
import Cookies from "js-cookie";
import { LucideArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { getOrganizationSSOData } from "@/actions/organization/get-organization-sso-data";
import { trackEvent } from "@/app/utils/analytics";
import { PortstbdAuthLogo } from "@/components/PortstbdAuthLogo";
import { usePublicEnv } from "@/utils/public-env";

const MotionInput = motion(Input);
const MotionLink = motion(Link);
const MotionButton = motion(Button);
const authCardClassName =
	"overflow-hidden relative w-full p-[28px] max-w-[432px] rounded-2xl border border-[#63A1B4]/30 bg-white/90 shadow-[0_26px_90px_-58px_#163760] backdrop-blur-xl";
const primaryAuthButtonClassName =
	"bg-[#163760] text-white hover:bg-[#102947] border-[#163760] disabled:bg-[#D8E7EB] disabled:text-[#6B8791]";
const secondaryAuthButtonClassName =
	"bg-white text-[#163760] hover:bg-[#EDF5F7] border-[#D8E7EB]";

export function SignupForm() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const next = searchParams?.get("next");
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [emailSent, setEmailSent] = useState(false);
	const [oauthError, setOauthError] = useState(false);
	const [showOrgInput, setShowOrgInput] = useState(false);
	const [organizationId, setOrganizationId] = useState("");
	const [organizationName, setOrganizationName] = useState<string | null>(null);
	const [lastEmailSentTime, setLastEmailSentTime] = useState<number | null>(
		null,
	);
	const theme = Cookies.get("theme") || "light";

	useEffect(() => {
		document.body.className = theme === "dark" ? "dark" : "light";
		return () => {
			document.body.className = "light";
		};
	}, [theme]);

	useEffect(() => {
		const error = searchParams?.get("error");
		const errorDesc = searchParams?.get("error_description");

		const handleErrors = () => {
			if (error === "OAuthAccountNotLinked" && !errorDesc) {
				setOauthError(true);
				return toast.error(
					"This email is already associated with a different sign-in method",
				);
			} else if (
				error === "profile_not_allowed_outside_organization" &&
				!errorDesc
			) {
				return toast.error(
					"Your email domain is not authorized for SSO access. Please use your work email or contact your administrator.",
				);
			} else if (error && errorDesc) {
				return toast.error(errorDesc);
			}
		};
		handleErrors();
	}, [searchParams]);

	useEffect(() => {
		const pendingPriceId = localStorage.getItem("pendingPriceId");
		const pendingQuantity = localStorage.getItem("pendingQuantity") ?? "1";
		if (emailSent && pendingPriceId) {
			localStorage.removeItem("pendingPriceId");
			localStorage.removeItem("pendingQuantity");

			setTimeout(async () => {
				const response = await fetch(`/api/settings/billing/subscribe`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						priceId: pendingPriceId,
						quantity: parseInt(pendingQuantity, 10),
					}),
				});
				const data = await response.json();

				if (data.url) {
					window.location.href = data.url;
				}
			}, 2000);
		}
	}, [emailSent]);

	const handleGoogleSignIn = () => {
		trackEvent("auth_started", {
			method: "google",
			is_signup: true,
			auth_surface: "signup",
		});
		signIn("google", {
			...(next && next.length > 0 ? { callbackUrl: next } : {}),
		});
	};

	const handleOrganizationLookup = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!organizationId) {
			toast.error("Please enter an organization ID");
			return;
		}

		try {
			const data = await getOrganizationSSOData(
				Organisation.OrganisationId.make(organizationId),
			);
			setOrganizationName(data.name);

			signIn("workos", undefined, {
				organization: data.organizationId,
				connection: data.connectionId,
			});
		} catch (error) {
			console.error("Lookup Error:", error);
			toast.error("Organization not found or SSO not configured");
		}
	};

	return (
		<motion.div
			layout
			transition={{
				layout: { duration: 0.3, ease: "easeInOut" },
				height: { duration: 0.3, ease: "easeInOut" },
			}}
			className={authCardClassName}
		>
			<motion.div
				layout="position"
				key="back-button"
				initial={{ opacity: 0, display: "none" }}
				animate={{
					opacity: showOrgInput ? 1 : 0,
					display: showOrgInput ? "flex" : "none",
					transition: { duration: 0.1, delay: 0.2 },
				}}
				onClick={() => setShowOrgInput(false)}
				className="absolute overflow-hidden top-5 rounded-full left-5 z-20 hover:bg-[#EDF5F7] gap-2 items-center py-1.5 px-3 text-[#163760] bg-transparent border border-[#D8E7EB] transition-colors duration-300 cursor-pointer"
			>
				<FontAwesomeIcon className="w-2" icon={faArrowLeft} />
				<motion.p layout="position" className="text-xs text-inherit">
					Back
				</motion.p>
			</motion.div>
			<MotionLink layout="position" className="flex mx-auto size-fit" href="/">
				<PortstbdAuthLogo className="h-11 w-auto max-w-[260px]" />
			</MotionLink>
			<motion.div
				layout="position"
				className="flex flex-col justify-center items-center my-7 text-left"
			>
				<motion.h1
					key="title"
					layout="position"
					className="text-2xl font-semibold text-[#163760]"
				>
					Sign up for {PORTSTBD_BRAND.productName}
				</motion.h1>
				<motion.p
					key="subtitle"
					layout="position"
					className="text-[16px] text-[#6B8791]"
				>
					{PORTSTBD_BRAND.description}
				</motion.p>
			</motion.div>
			<motion.div layout="position" className="flex flex-col space-y-3">
				<Suspense
					fallback={
						<>
							<Button disabled={true} variant="primary" />
							<Button disabled={true} variant="destructive" />
							<div className="mx-auto w-3/4 h-5 rounded-lg bg-gray-1" />
						</>
					}
				>
					<motion.div layout className="flex flex-col space-y-3">
						<AnimatePresence mode="wait" initial={false}>
							<motion.div
								key={showOrgInput ? "sso-wrapper" : "email-wrapper"}
								layout
								initial={{ height: 0, opacity: 0 }}
								animate={{ height: "auto", opacity: 1 }}
								exit={{ height: 0, opacity: 0 }}
								transition={{
									duration: 0.25,
									ease: "easeInOut",
									opacity: { delay: 0.05 },
								}}
								className="px-1"
							>
								{showOrgInput ? (
									<motion.div
										key="sso"
										layout
										className="min-w-fit"
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
										exit={{ opacity: 0, y: -10, transition: { duration: 0.1 } }}
										transition={{ duration: 0.2, ease: "easeInOut" }}
									>
										<SignupWithSSO
											handleOrganizationLookup={handleOrganizationLookup}
											organizationId={organizationId}
											setOrganizationId={setOrganizationId}
											organizationName={organizationName}
										/>
									</motion.div>
								) : (
									<motion.form
										key="email"
										layout
										initial={{ opacity: 0, y: 10 }}
										animate={{
											opacity: 1,
											y: 0,
											transition: { duration: 0.1 },
										}}
										exit={{
											opacity: 0,
											y: -10,
											transition: { duration: 0.15 },
										}}
										transition={{
											duration: 0.2,
											ease: "easeInOut",
											opacity: { delay: 0.05 },
										}}
										onSubmit={async (e) => {
											e.preventDefault();
											if (!email) return;

											if (lastEmailSentTime) {
												const timeSinceLastRequest =
													Date.now() - lastEmailSentTime;
												const waitTime = 30000;
												if (timeSinceLastRequest < waitTime) {
													const remainingSeconds = Math.ceil(
														(waitTime - timeSinceLastRequest) / 1000,
													);
													toast.error(
														`Please wait ${remainingSeconds} seconds before requesting a new code`,
													);
													return;
												}
											}

											setLoading(true);
											trackEvent("auth_started", {
												method: "email",
												is_signup: true,
												auth_surface: "signup",
											});
											const normalizedEmail = email.trim().toLowerCase();
											signIn("email", {
												email: normalizedEmail,
												redirect: false,
												...(next && next.length > 0
													? { callbackUrl: next }
													: {}),
											})
												.then((res) => {
													setLoading(false);

													if (res?.ok && !res?.error) {
														setEmailSent(true);
														setLastEmailSentTime(Date.now());
														trackEvent("auth_email_sent", {
															method: "email",
															is_signup: true,
															auth_surface: "signup",
															email_domain: normalizedEmail.split("@")[1],
														});
														const params = new URLSearchParams({
															email: normalizedEmail,
															...(next && { next }),
															lastSent: Date.now().toString(),
														});
														router.push(`/verify-otp?${params.toString()}`);
													} else {
														toast.error(
															"Please wait 30 seconds before requesting a new code",
														);
													}
												})
												.catch((_error) => {
													setEmailSent(false);
													setLoading(false);
													toast.error("Error sending email - try again?");
												});
										}}
										className="flex flex-col space-y-3"
									>
										<NormalSignup
											setShowOrgInput={setShowOrgInput}
											email={email}
											emailSent={emailSent}
											setEmail={setEmail}
											loading={loading}
											oauthError={oauthError}
											handleGoogleSignIn={handleGoogleSignIn}
										/>
									</motion.form>
								)}
							</motion.div>
						</AnimatePresence>
						<motion.p
							layout="position"
							className="pt-3 text-xs text-center text-[#6B8791]"
						>
							Already have an account?{" "}
							<Link
								href="/login"
								className="text-xs font-semibold text-[#163760] hover:text-[#63A1B4]"
							>
								Log in here
							</Link>
						</motion.p>
						<motion.p
							layout="position"
							className="text-xs text-center text-[#6B8791]"
						>
							By typing your email and clicking continue, you acknowledge that
							you have both read and agree to {PORTSTBD_BRAND.companyName}'s{" "}
							<Link
								href="/terms"
								target="_blank"
								className="text-xs font-semibold text-[#163760] hover:text-[#63A1B4]"
							>
								Terms of Service
							</Link>{" "}
							and{" "}
							<Link
								href="/privacy"
								target="_blank"
								className="text-xs font-semibold text-[#163760] hover:text-[#63A1B4]"
							>
								Privacy Policy
							</Link>
							.
						</motion.p>
					</motion.div>
				</Suspense>
			</motion.div>
		</motion.div>
	);
}

const SignupWithSSO = ({
	handleOrganizationLookup,
	organizationId,
	setOrganizationId,
	organizationName,
}: {
	handleOrganizationLookup: (e: React.FormEvent) => void;
	organizationId: string;
	setOrganizationId: (organizationId: string) => void;
	organizationName: string | null;
}) => {
	const organizationInputId = useId();

	return (
		<motion.form
			layout
			onSubmit={handleOrganizationLookup}
			className="relative space-y-2"
		>
			<MotionInput
				id={organizationInputId}
				placeholder="Enter your Organization ID..."
				value={organizationId}
				onChange={(e) => setOrganizationId(e.target.value)}
				className="w-full max-w-full"
			/>
			{organizationName && (
				<p className="text-sm text-[#6B8791]">
					Signing up with: {organizationName}
				</p>
			)}
			<div>
				<Button
					type="submit"
					variant="dark"
					className={`w-full max-w-full ${primaryAuthButtonClassName}`}
				>
					Continue with SSO
				</Button>
			</div>
		</motion.form>
	);
};

const NormalSignup = ({
	setShowOrgInput,
	email,
	emailSent,
	setEmail,
	loading,
	oauthError,
	handleGoogleSignIn,
}: {
	setShowOrgInput: (show: boolean) => void;
	email: string;
	emailSent: boolean;
	setEmail: (email: string) => void;
	loading: boolean;
	oauthError: boolean;
	handleGoogleSignIn: () => void;
}) => {
	const publicEnv = usePublicEnv();
	const emailInputId = useId();

	return (
		<motion.div>
			<motion.div layout className="flex flex-col space-y-3">
				<MotionInput
					id={emailInputId}
					name="email"
					autoFocus
					type="email"
					placeholder={emailSent ? "" : "tim@apple.com"}
					autoComplete="email"
					required
					value={email}
					disabled={emailSent || loading}
					onChange={(e) => {
						setEmail(e.target.value.toLowerCase());
					}}
				/>
				<MotionButton
					variant="dark"
					type="submit"
					disabled={loading || emailSent}
					className={primaryAuthButtonClassName}
					icon={<FontAwesomeIcon className="mr-1 size-4" icon={faEnvelope} />}
				>
					Sign up with email
				</MotionButton>
			</motion.div>
			{(publicEnv.googleAuthAvailable || publicEnv.workosAuthAvailable) && (
				<>
					<div className="flex gap-4 items-center my-4">
						<span className="flex-1 h-px bg-gray-5" />
						<p className="text-sm text-center text-[#6B8791]">OR</p>
						<span className="flex-1 h-px bg-gray-5" />
					</div>
					<motion.div
						layout
						className="flex flex-col gap-3 justify-center items-center"
					>
						{publicEnv.googleAuthAvailable && !oauthError && (
							<MotionButton
								variant="gray"
								type="button"
								className={`flex gap-2 justify-center items-center w-full text-sm ${secondaryAuthButtonClassName}`}
								onClick={handleGoogleSignIn}
								disabled={loading}
							>
								<Image src="/google.svg" alt="Google" width={16} height={16} />
								Sign up with Google
							</MotionButton>
						)}

						{oauthError && (
							<div className="flex gap-3 items-center p-3 bg-red-400 rounded-xl border border-red-600">
								<FontAwesomeIcon
									className="text-gray-50 size-8"
									icon={faExclamationCircle}
								/>
								<p className="text-xs leading-5 text-gray-50">
									It looks like you've previously used this email to sign up via
									email. Please enter your email below to receive a sign up
									link.
								</p>
							</div>
						)}
						{publicEnv.workosAuthAvailable && (
							<MotionButton
								variant="gray"
								type="button"
								className={`w-full ${secondaryAuthButtonClassName}`}
								layout
								onClick={() => setShowOrgInput(true)}
								disabled={loading}
							>
								<LucideArrowUpRight size={20} />
								Sign up with SAML SSO
							</MotionButton>
						)}
					</motion.div>
				</>
			)}
		</motion.div>
	);
};
