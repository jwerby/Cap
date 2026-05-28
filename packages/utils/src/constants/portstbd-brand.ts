type PublicUrlEnv = {
	NEXT_PUBLIC_WEB_URL?: string;
	WEB_URL?: string;
};

const getRuntimeEnv = (): PublicUrlEnv => {
	if (typeof process === "undefined") return {};

	return process.env;
};

const normalizeWebUrl = (url?: string) => {
	const trimmedUrl = url?.trim();

	if (!trimmedUrl) return undefined;
	if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmedUrl)) return trimmedUrl;

	return `https://${trimmedUrl}`;
};

export const PORTSTBD_BRAND = {
	companyName: "Port & Starboard",
	productName: "Port & Starboard Watch",
	shortName: "P&S Watch",
	domain: "watch.portstbd.com",
	defaultWebUrl: "https://watch.portstbd.com",
	description: "Secure video watch and sharing for Port & Starboard work.",
	logoAlt: "Port & Starboard logo",
	recordingTitleSuffix: "Port & Starboard Recording",
	watchDescription: "Watch this video from Port & Starboard",
	verificationEmailSubject: "Your Port & Starboard verification code",
	colors: {
		atlanticBlue: "#163760",
		caribbeanBlue: "#63A1B4",
		offPort: "#CF1C9C",
		offStarboard: "#C7D857",
	},
} as const;

export const getPortstbdWebUrl = (env: PublicUrlEnv = getRuntimeEnv()) =>
	normalizeWebUrl(env.NEXT_PUBLIC_WEB_URL) ??
	normalizeWebUrl(env.WEB_URL) ??
	PORTSTBD_BRAND.defaultWebUrl;

export const buildPortstbdAssetUrl = (
	path: `/${string}`,
	env?: PublicUrlEnv,
) => {
	if (path.startsWith("//")) {
		throw new Error("Asset path must not be protocol-relative");
	}

	return new URL(path, getPortstbdWebUrl(env)).toString();
};
