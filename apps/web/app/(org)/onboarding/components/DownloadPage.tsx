"use client";

import { Button } from "@cap/ui";
import { useDetectPlatform } from "hooks/useDetectPlatform";
import { Clapperboard, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { PortstbdAuthLogo } from "@/components/PortstbdAuthLogo";
import {
	getDownloadButtonText,
	getDownloadUrl,
	getPlatformIcon,
} from "@/utils/platform";

const recordingModes = [
	{
		name: "Instant Mode",
		icon: <Zap fill="#C7D857" className="mb-4 size-8" strokeWidth={1.5} />,
		description:
			"Hit record, stop, share link. Your video is live in seconds with automatically generated captions, a title, summary, chapters, and more. Perfect for quick feedback, bug reports, or when you just need to show something fast.",
	},
	{
		name: "Studio Mode",
		icon: (
			<Clapperboard fill="#63A1B4" className="mb-4 size-8" strokeWidth={1.5} />
		),
		description:
			"Professional recordings with local editing, custom backgrounds, and export options. When you need pixel-perfect demos, tutorials, or presentations that represent your brand.",
	},
];

export function DownloadPage() {
	const { platform, isIntel } = useDetectPlatform();
	const loading = platform === null;
	const router = useRouter();

	return (
		<div className="flex flex-col gap-12 justify-center items-center min-h-fit lg:gap-20">
			<div className="space-y-10">
				<div className="flex flex-col gap-6 justify-center items-center">
					<PortstbdAuthLogo className="mx-auto h-11 w-auto max-w-[260px]" />
					<div className="space-y-1 text-center">
						<h1 className="text-3xl font-medium text-[#163760]">
							Download recorder
						</h1>
						<p className="text-lg text-center text-[#6B8791] text-pretty">
							Start recording Port & Starboard videos today
						</p>
					</div>
				</div>
				<div className="flex flex-wrap gap-10 justify-center items-center w-full max-w-[1000px] mx-auto">
					{recordingModes.map((recordingMode) => (
						<div
							key={recordingMode.name}
							className="flex flex-col w-full max-w-[440px] gap-2 items-center p-6 text-center rounded-xl border bg-white/80 border-[#D8E7EB]"
						>
							{recordingMode.icon}
							<h2 className="text-xl font-medium text-[#163760]">
								{recordingMode.name}
							</h2>
							<p className="text-base text-[#6B8791] text-pretty">
								{recordingMode.description}
							</p>
						</div>
					))}
				</div>
			</div>
			<div className="flex flex-wrap gap-4 justify-center">
				<Button
					variant="blue"
					size="lg"
					href={getDownloadUrl(platform, isIntel)}
					className="hidden justify-center items-center py-6 font-medium text-white bg-[#163760] hover:bg-[#102947] border-[#163760] lg:flex"
				>
					{!loading && getPlatformIcon(platform)}
					{getDownloadButtonText(platform, loading, isIntel)}
				</Button>
				<Button
					onClick={() => router.push("/dashboard/caps")}
					className="min-w-[120px] bg-[#163760] text-white hover:bg-[#102947] border-[#163760]"
					variant="dark"
					size="lg"
				>
					Continue
				</Button>
			</div>
		</div>
	);
}
