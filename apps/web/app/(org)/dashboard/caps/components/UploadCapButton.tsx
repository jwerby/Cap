"use client";

import { Button } from "@cap/ui";
import { faUpload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import { useDashboardContext } from "@/app/(org)/dashboard/Contexts";

export const UploadCapButton = ({
	size = "md",
}: {
	size?: "sm" | "lg" | "md";
	grey?: boolean;
}) => {
	const { user } = useDashboardContext();
	const router = useRouter();

	const handleClick = () => {
		if (!user) return;
		router.push("/dashboard/import");
	};

	return (
		<Button
			onClick={handleClick}
			variant="dark"
			className="flex gap-2 items-center"
			size={size}
		>
			<FontAwesomeIcon className="size-3.5" icon={faUpload} />
			Import Media
		</Button>
	);
};
