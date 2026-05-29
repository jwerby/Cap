import clsx from "clsx";
import type { PropsWithChildren } from "react";

type PortstbdAuthScaffoldProps = PropsWithChildren<{
	className?: string;
	contentClassName?: string;
}>;

export function PortstbdAuthScaffold({
	children,
	className,
	contentClassName,
}: PortstbdAuthScaffoldProps) {
	return (
		<div
			className={clsx(
				"relative min-h-dvh w-full overflow-hidden bg-[#EDF5F7] text-[#163760]",
				className,
			)}
		>
			<div
				className="absolute inset-0"
				style={{
					background:
						"radial-gradient(circle at 15% 18%, rgba(99, 161, 180, 0.34), transparent 31%), radial-gradient(circle at 86% 15%, rgba(199, 216, 87, 0.28), transparent 28%), radial-gradient(circle at 74% 82%, rgba(207, 28, 156, 0.12), transparent 30%), linear-gradient(135deg, #F8FBFC 0%, #EDF5F7 48%, #F7FAEA 100%)",
				}}
			/>
			<div className="absolute -top-20 -left-24 size-80 rounded-full bg-[#CF1C9C]/10 blur-3xl" />
			<div className="absolute -right-24 bottom-8 size-96 rounded-full bg-[#63A1B4]/20 blur-3xl" />
			<div className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#163760]/10 to-transparent" />
			<div className={clsx("relative z-10 flex w-full", contentClassName)}>
				{children}
			</div>
		</div>
	);
}
