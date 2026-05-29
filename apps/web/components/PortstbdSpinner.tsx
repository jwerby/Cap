import clsx from "clsx";

type PortstbdSpinnerProps = {
	className?: string;
	markClassName?: string;
	label?: string;
};

export function PortstbdSpinner({
	className = "size-10",
	markClassName = "text-xl",
	label = "Loading",
}: PortstbdSpinnerProps) {
	return (
		<output
			className={clsx("relative grid place-items-center", className)}
			aria-label={label}
		>
			<span className="absolute inset-0 animate-spin rounded-full bg-[conic-gradient(from_120deg,#CF1C9C,#63A1B4,#C7D857,#CF1C9C)] shadow-[0_12px_34px_-18px_#163760] [animation-duration:1.1s] motion-reduce:animate-none" />
			<span className="absolute inset-[3px] rounded-full bg-[#163760] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]" />
			<span
				className={clsx(
					"relative block animate-spin font-bold leading-none text-white [animation-duration:1.1s] motion-reduce:animate-none",
					markClassName,
				)}
			>
				&
			</span>
			<span className="sr-only">{label}</span>
		</output>
	);
}
