import { PORTSTBD_BRAND } from "@cap/utils";
import Image from "next/image";

type PortstbdLogoProps = {
	className?: string;
	priority?: boolean;
};

export function PortstbdLogo({
	className = "h-9 w-auto max-w-[220px]",
	priority = false,
}: PortstbdLogoProps) {
	return (
		<Image
			src="/port-starboard-logo.svg"
			alt={PORTSTBD_BRAND.logoAlt}
			width={269}
			height={44}
			className={className}
			priority={priority}
		/>
	);
}

export function PortstbdMark({ className = "size-10" }: PortstbdLogoProps) {
	return (
		<div
			className={`relative grid place-items-center overflow-hidden rounded-[18px] border border-[#63A1B4]/45 bg-[#163760] shadow-[0_14px_34px_-22px_#163760] ${className}`}
			aria-label={PORTSTBD_BRAND.logoAlt}
			role="img"
		>
			<span className="absolute inset-y-0 left-0 w-1/2 bg-[#CF1C9C]" />
			<span className="absolute inset-y-0 right-0 w-1/2 bg-[#C7D857]" />
			<span className="absolute inset-x-0 top-0 h-1/2 bg-[#63A1B4]/25" />
			<span className="relative rounded-full bg-[#163760] px-1.5 py-1 text-[10px] font-bold leading-none tracking-[-0.02em] text-white shadow-sm ring-1 ring-white/20">
				P&S
			</span>
		</div>
	);
}

export function PortstbdAuthLogo({
	className = "h-10 w-auto max-w-[240px]",
}: {
	className?: string;
}) {
	return <PortstbdLogo className={className} priority />;
}
