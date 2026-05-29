"use client";

import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { PortstbdAuthLogo } from "@/components/PortstbdAuthLogo";

export const Base = ({
	children,
	title,
	description,
	descriptionClassName,
	hideBackButton = true,
}: {
	children: React.ReactNode;
	title: string;
	description: string | React.ReactNode;
	descriptionClassName?: string;
	hideBackButton?: boolean;
}) => {
	const router = useRouter();
	return (
		<div className="relative z-10 w-full space-y-7 rounded-2xl border border-[#63A1B4]/30 bg-white/90 p-7 shadow-[0_26px_90px_-58px_#163760] backdrop-blur-xl max-w-[472px]">
			{!hideBackButton && (
				<button
					type="button"
					onClick={() => router.back()}
					className="absolute overflow-hidden flex top-5 rounded-full left-5 z-20 hover:bg-[#EDF5F7] gap-2 items-center py-1.5 px-3 text-[#163760] bg-transparent border border-[#D8E7EB] transition-colors duration-300 cursor-pointer"
				>
					<FontAwesomeIcon className="w-2" icon={faArrowLeft} />
					<p className="text-xs text-inherit">Back</p>
				</button>
			)}
			<a href="/">
				<PortstbdAuthLogo className="mx-auto h-11 w-auto max-w-[260px]" />
			</a>
			<div className="flex flex-col justify-center items-center space-y-1 text-center">
				<h2 className="text-2xl font-semibold text-[#163760]">{title}</h2>
				{typeof description === "string" ? (
					<p
						className={clsx(
							"w-full text-base max-w-[260px] text-[#6B8791]",
							descriptionClassName,
						)}
					>
						{description}
					</p>
				) : (
					description
				)}
			</div>
			{children}
		</div>
	);
};
