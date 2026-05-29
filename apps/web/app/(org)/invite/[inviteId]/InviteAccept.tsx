"use client";

import type { userSelectProps } from "@cap/database/auth/session";
import { Button } from "@cap/ui";
import { PORTSTBD_BRAND } from "@cap/utils";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { PortstbdAuthLogo } from "@/components/PortstbdAuthLogo";
import { PortstbdAuthScaffold } from "@/components/PortstbdAuthScaffold";

type InviteAcceptProps = {
	inviteId: string;
	organizationName: string;
	inviterName: string;
	user: typeof userSelectProps | null;
};

export function InviteAccept({
	inviteId,
	organizationName,
	inviterName,
	user,
}: InviteAcceptProps) {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);

	const handleAccept = async () => {
		setIsLoading(true);
		try {
			if (!user) {
				router.push(`/login?next=/invite/${inviteId}`);
				return;
			}

			const response = await fetch("/api/invite/accept", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ inviteId }),
			});

			if (response.ok) {
				toast.success("Invite accepted successfully");
				router.push("/dashboard");
			} else {
				const error = await response.text();
				toast.error(`Failed to accept invite: ${error}`);
			}
		} catch (error) {
			console.error("Error accepting invite:", error);
			toast.error("An error occurred while accepting the invite");
		} finally {
			setIsLoading(false);
		}
	};

	const handleDecline = async () => {
		setIsLoading(true);
		try {
			if (!user) {
				router.push(`/login?next=/invite/${inviteId}`);
				return;
			}

			const response = await fetch("/api/invite/decline", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ inviteId }),
			});

			if (response.ok) {
				toast.success("Invite declined");
				router.push("/");
			} else {
				const error = await response.text();
				toast.error(`Failed to decline invite: ${error}`);
			}
		} catch (error) {
			console.error("Error declining invite:", error);
			toast.error("An error occurred while declining the invite");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<PortstbdAuthScaffold contentClassName="min-h-dvh flex-col items-center justify-center px-4 py-10">
			<div className="w-full max-w-lg rounded-[24px] border border-[#63A1B4]/30 bg-white/90 p-6 text-center shadow-[0_26px_90px_-58px_#163760] backdrop-blur-xl">
				<PortstbdAuthLogo className="mx-auto mb-6 h-11 w-auto max-w-[260px]" />
				<h1 className="text-xl mb-4">
					You're invited to join <strong>{organizationName}</strong> on{" "}
					{PORTSTBD_BRAND.productName}
				</h1>
				<p className="text-[#6B8791] text-sm mb-6">
					{inviterName} invited you to join their organization on{" "}
					{PORTSTBD_BRAND.productName}.
				</p>
				<div className="flex space-x-2">
					<Button
						onClick={handleAccept}
						variant="primary"
						disabled={isLoading}
						className="bg-[#163760] text-white hover:bg-[#102947] border-[#163760]"
					>
						{isLoading ? "Processing..." : "Accept"}
					</Button>
					<Button
						onClick={handleDecline}
						variant="gray"
						disabled={isLoading}
						className="bg-white text-[#163760] hover:bg-[#EDF5F7] border-[#D8E7EB]"
					>
						{isLoading ? "Processing..." : "Decline"}
					</Button>
				</div>
			</div>
			{!user && (
				<Button
					onClick={() => signOut({ callbackUrl: "/login" })}
					size="sm"
					variant="white"
					className="absolute bottom-4 left-4 text-[#163760] hover:text-[#63A1B4] border-[#D8E7EB] bg-white/80"
				>
					<LogOut className="w-4 h-4 mr-2" />
					Sign Out
				</Button>
			)}
		</PortstbdAuthScaffold>
	);
}
