"use client";

import { buildEnv } from "@cap/env";
import { Button } from "@cap/ui";
import { isCapDeployment } from "@cap/utils";
import { faUpload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDashboardContext } from "@/app/(org)/dashboard/Contexts";
import { UpgradeModal } from "@/components/UpgradeModal";

export const UploadCapButton = ({
	size = "md",
}: {
	size?: "sm" | "lg" | "md";
	grey?: boolean;
}) => {
	const { user } = useDashboardContext();
	const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
	const router = useRouter();

	const handleClick = () => {
		if (!user) return;

		if (isCapDeployment(buildEnv.NEXT_PUBLIC_IS_CAP) && !user.isPro) {
			setUpgradeModalOpen(true);
			return;
		}

		router.push("/dashboard/import");
	};

	return (
		<>
			<Button
				onClick={handleClick}
				variant="dark"
				className="flex gap-2 items-center"
				size={size}
			>
				<FontAwesomeIcon className="size-3.5" icon={faUpload} />
				Import Media
			</Button>
			<UpgradeModal
				open={upgradeModalOpen}
				onOpenChange={setUpgradeModalOpen}
			/>
		</>
	);
};
