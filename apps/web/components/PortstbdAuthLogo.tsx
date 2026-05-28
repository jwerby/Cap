import { PORTSTBD_BRAND } from "@cap/utils";
import Image from "next/image";

export function PortstbdAuthLogo({
	className = "h-10 w-auto max-w-[240px]",
}: {
	className?: string;
}) {
	return (
		<Image
			src="/port-starboard-logo.svg"
			alt={PORTSTBD_BRAND.logoAlt}
			width={269}
			height={44}
			className={className}
			priority
		/>
	);
}
