"use client";

import { PortstbdSpinner } from "@/components/PortstbdSpinner";

export function RecordingInProgressOverlay({
	className,
	onStoppedRecording,
	isConfirmingStopped = false,
	confirmStoppedError,
	variant = "solid",
}: {
	className?: string;
	onStoppedRecording: () => void;
	isConfirmingStopped?: boolean;
	confirmStoppedError?: string | null;
	variant?: "solid" | "overlay";
}) {
	const backgroundClassName =
		variant === "overlay" ? "bg-black/70 backdrop-blur-[1px]" : "bg-black";

	return (
		<div
			className={`flex flex-col gap-3 justify-center items-center rounded-xl ${backgroundClassName} ${className ?? ""}`}
		>
			<p className="text-lg text-white/70">Recording in progress</p>
			<button
				type="button"
				onClick={onStoppedRecording}
				disabled={isConfirmingStopped}
				className="text-sm text-white bg-transparent border border-white/20 hover:bg-white/10 transition-colors rounded-lg py-2 px-4"
			>
				{isConfirmingStopped
					? "Finishing recording..."
					: "I have stopped recording"}
			</button>
			{confirmStoppedError && (
				<p className="text-xs text-red-200/80 text-center max-w-xs">
					{confirmStoppedError}
				</p>
			)}
		</div>
	);
}

export function PreparingVideoOverlay({
	className,
	label = "Preparing video...",
}: {
	className?: string;
	label?: string;
}) {
	return (
		<div
			className={`flex flex-col gap-3 justify-center items-center bg-black rounded-xl ${className ?? ""}`}
		>
			<PortstbdSpinner
				className="size-9 sm:size-11"
				markClassName="text-xl sm:text-2xl"
				label="Preparing video"
			/>
			<p className="text-white/50 text-sm">{label}</p>
		</div>
	);
}
