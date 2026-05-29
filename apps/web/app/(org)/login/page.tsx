import { getCurrentUser } from "@cap/database/auth/session";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PortstbdAuthScaffold } from "@/components/PortstbdAuthScaffold";
import { LoginForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
	const session = await getCurrentUser();
	if (session) {
		redirect("/dashboard");
	}
	return (
		<PortstbdAuthScaffold contentClassName="min-h-dvh items-center justify-center px-4 py-10">
			<div className="flex absolute top-6 left-6 z-20 gap-2 justify-center items-center rounded-full border border-[#63A1B4]/30 bg-white/70 px-3 py-2 text-sm shadow-[0_12px_34px_-28px_#163760] backdrop-blur transition-opacity hover:opacity-75 sm:top-10 sm:left-10">
				<FontAwesomeIcon
					className="size-3 text-[#163760] opacity-75"
					icon={faArrowLeft}
				/>
				<Link className="text-[#163760]" href="/">
					Home
				</Link>
			</div>
			<LoginForm />
		</PortstbdAuthScaffold>
	);
}
