"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PortstbdSpinner } from "@/components/PortstbdSpinner";

const MAX_REFRESH_ATTEMPTS = 30;
const REFRESH_INTERVAL_MS = 2000;

export function PendingRecordingShare() {
	const router = useRouter();
	const [hasTimedOut, setHasTimedOut] = useState(false);

	useEffect(() => {
		let refreshCount = 0;
		router.refresh();

		const interval = window.setInterval(() => {
			refreshCount += 1;

			if (refreshCount >= MAX_REFRESH_ATTEMPTS) {
				setHasTimedOut(true);
				window.clearInterval(interval);
				return;
			}

			router.refresh();
		}, REFRESH_INTERVAL_MS);

		return () => window.clearInterval(interval);
	}, [router]);

	return (
		<div className="flex flex-col justify-center items-center p-4 min-h-screen text-center bg-[#EDF5F7]">
			<PortstbdSpinner
				className="mb-6 size-12"
				markClassName="text-3xl"
				label="Preparing recording"
			/>
			<h1 className="mb-2 text-2xl font-semibold text-gray-12">
				Preparing your recording
			</h1>
			<p className="max-w-md text-gray-10">
				{hasTimedOut
					? "This recording is taking longer than expected. Reload this page in a moment."
					: "Your recording is being made available. This page will update automatically."}
			</p>
		</div>
	);
}
