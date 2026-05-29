export type CloudFrontEnvInput = {
	distributionId?: string;
	keypairId?: string;
	privateKey?: string;
	bucketUrl?: string;
};

export type CloudFrontConfig = {
	distributionId: string;
	keypairId: string;
	privateKey: string;
	bucketUrl: string;
};

export type CloudFrontConfigResolution =
	| { _tag: "disabled" }
	| { _tag: "invalid"; message: string }
	| { _tag: "enabled"; config: CloudFrontConfig };

const configKeys = [
	["CAP_AWS_BUCKET_URL", "bucketUrl"],
	["CAP_CLOUDFRONT_DISTRIBUTION_ID", "distributionId"],
	["CLOUDFRONT_KEYPAIR_ID", "keypairId"],
	["CLOUDFRONT_KEYPAIR_PRIVATE_KEY", "privateKey"],
] as const;

const normalizeOptional = (value: string | undefined) => {
	const normalized = value?.trim();
	return normalized ? normalized : undefined;
};

const normalizePrivateKey = (value: string) =>
	value.trim().replaceAll("\\n", "\n");

const normalizeBucketUrl = (value: string) => {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return {
			_tag: "invalid" as const,
			message: "CAP_AWS_BUCKET_URL must be a valid URL.",
		};
	}

	if (url.protocol !== "https:") {
		return {
			_tag: "invalid" as const,
			message: "CAP_AWS_BUCKET_URL must use https.",
		};
	}

	if (url.search || url.hash) {
		return {
			_tag: "invalid" as const,
			message:
				"CAP_AWS_BUCKET_URL must not include query parameters or fragments.",
		};
	}

	return {
		_tag: "valid" as const,
		bucketUrl: url.toString().replace(/\/+$/, ""),
	};
};

export const resolveCloudFrontConfig = (
	input: CloudFrontEnvInput,
): CloudFrontConfigResolution => {
	const normalized = {
		bucketUrl: normalizeOptional(input.bucketUrl),
		distributionId: normalizeOptional(input.distributionId),
		keypairId: normalizeOptional(input.keypairId),
		privateKey: normalizeOptional(input.privateKey),
	};

	const present = configKeys.filter(([, key]) => normalized[key]);
	if (present.length === 0) return { _tag: "disabled" };

	const missing = configKeys
		.filter(([, key]) => !normalized[key])
		.map(([name]) => name);

	if (missing.length > 0) {
		return {
			_tag: "invalid",
			message: `Incomplete CloudFront config. Missing ${missing.join(", ")}.`,
		};
	}

	const bucketUrl = normalizeBucketUrl(normalized.bucketUrl ?? "");
	if (bucketUrl._tag === "invalid") return bucketUrl;

	const privateKey = normalizePrivateKey(normalized.privateKey ?? "");
	if (
		!privateKey.includes("-----BEGIN") ||
		!privateKey.includes("PRIVATE KEY-----")
	) {
		return {
			_tag: "invalid",
			message: "CLOUDFRONT_KEYPAIR_PRIVATE_KEY must be a PEM private key.",
		};
	}

	return {
		_tag: "enabled",
		config: {
			bucketUrl: bucketUrl.bucketUrl,
			distributionId: normalized.distributionId ?? "",
			keypairId: normalized.keypairId ?? "",
			privateKey,
		},
	};
};
