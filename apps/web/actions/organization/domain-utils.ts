type VercelDomainEnv = {
	projectId: string;
	teamId: string;
	authToken: string;
};

type DomainApiError = {
	message?: string;
	code?: string;
};

type DomainRecord = {
	type?: string;
	name?: string;
	value?: string;
};

type ProjectDomain = {
	name?: string;
	apexValue?: string;
};

type DomainApiResponse = {
	name?: string;
	apexName?: string;
	verified?: boolean;
	misconfigured?: boolean;
	error?: DomainApiError;
	aValues?: string[];
	currentAValues?: string[];
	requiredAValue?: string;
	verification?: Array<{
		type: string;
		domain: string;
		value: string;
		reason: string;
	}>;
	recommendedCNAME?: Array<{ rank: number; value: string }>;
	recommendedIPv4?: Array<{ rank: number; value: string[] | string }>;
	cnames?: string[];
	records?: DomainRecord[];
	domains?: ProjectDomain[];
	status?: string;
	serviceType?: string;
};

const normalizeHost = (input?: string | null) => {
	const trimmed = input?.trim();
	if (!trimmed) return null;

	try {
		const url = new URL(
			trimmed.includes("://") ? trimmed : `https://${trimmed}`,
		);
		return url.hostname.toLowerCase().replace(/\.$/, "");
	} catch {
		return null;
	}
};

const getAppHost = () =>
	normalizeHost(process.env.NEXT_PUBLIC_WEB_URL) ??
	normalizeHost(process.env.WEB_URL) ??
	normalizeHost(process.env.NEXTAUTH_URL);

const getVercelDomainEnv = (): VercelDomainEnv | null => {
	const projectId = process.env.VERCEL_PROJECT_ID?.trim();
	const teamId = process.env.VERCEL_TEAM_ID?.trim();
	const authToken = process.env.VERCEL_AUTH_TOKEN?.trim();

	if (!projectId || !teamId || !authToken) return null;

	return { projectId, teamId, authToken };
};

const getDomainApex = (domain: string) => {
	const parts = domain.split(".").filter(Boolean);
	return parts.slice(-2).join(".") || domain;
};

const getSelfHostedConfig = (domain: string): DomainApiResponse => {
	const normalizedDomain = normalizeHost(domain) ?? domain.toLowerCase();
	const appHost = getAppHost();
	const verified = Boolean(appHost && normalizedDomain === appHost);
	const isSubdomain = normalizedDomain.split(".").length > 2;

	return {
		name: normalizedDomain,
		apexName: getDomainApex(normalizedDomain),
		verified,
		misconfigured: !verified,
		verification: [],
		currentAValues: [],
		aValues: [],
		recommendedCNAME:
			appHost && normalizedDomain !== appHost && isSubdomain
				? [{ rank: 1, value: appHost }]
				: [],
		recommendedIPv4: [],
		cnames: [],
		serviceType: "self-hosted",
	};
};

const fetchVercelJson = async (url: string, init: RequestInit) => {
	const response = await fetch(url, init);
	const json: unknown = await response.json();

	return typeof json === "object" && json !== null
		? (json as DomainApiResponse)
		: {};
};

export const getConfigResponse = async (domain: string) => {
	const env = getVercelDomainEnv();
	if (!env) return getSelfHostedConfig(domain);

	const response = await fetchVercelJson(
		`https://api.vercel.com/v6/domains/${domain.toLowerCase()}/config?teamId=${env.teamId}&strict=true`,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${env.authToken}`,
				"Content-Type": "application/json",
			},
			cache: "no-store",
		},
	);
	return response;
};

export const getDomainResponse = async (domain: string) => {
	const env = getVercelDomainEnv();
	if (!env) return getSelfHostedConfig(domain);

	const response = await fetchVercelJson(
		`https://api.vercel.com/v9/projects/${env.projectId}/domains/${domain.toLowerCase()}?teamId=${env.teamId}`,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${env.authToken}`,
				"Content-Type": "application/json",
			},
			cache: "no-store",
		},
	);
	return response;
};

export const verifyDomain = async (domain: string) => {
	const env = getVercelDomainEnv();
	if (!env) return getSelfHostedConfig(domain);

	const response = await fetchVercelJson(
		`https://api.vercel.com/v9/projects/${env.projectId}/domains/${domain.toLowerCase()}/verify?teamId=${env.teamId}&strict=true`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.authToken}`,
				"Content-Type": "application/json",
			},
		},
	);
	return response;
};

export const addDomain = async (domain: string) => {
	const env = getVercelDomainEnv();
	if (!env) return getSelfHostedConfig(domain);

	const response = await fetchVercelJson(
		`https://api.vercel.com/v9/projects/${env.projectId}/domains?teamId=${env.teamId}`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: domain }),
			cache: "no-store",
		},
	);

	return response;
};

export const getRequiredConfig = async (domain: string) => {
	const env = getVercelDomainEnv();
	if (!env) return getSelfHostedConfig(domain);

	const recordsResponse = await fetchVercelJson(
		`https://api.vercel.com/v4/domains/${domain.toLowerCase()}/records?limit=10&teamId=${env.teamId}`,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${env.authToken}`,
				"Content-Type": "application/json",
			},
			cache: "no-store",
		},
	).catch(() => null);

	if (recordsResponse?.records) {
		const aRecord = recordsResponse.records.find(
			(record) => record.type === "A" && record.name === "",
		);

		if (aRecord?.value) {
			return {
				configuredBy: "vercel",
				aValues: [aRecord.value],
				serviceType: "vercel",
			};
		}
	}

	const response = await fetchVercelJson(
		`https://api.vercel.com/v6/domains/${domain.toLowerCase()}/config?teamId=${env.teamId}`,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${env.authToken}`,
				"Content-Type": "application/json",
			},
			cache: "no-store",
		},
	);

	if (!response.aValues || response.aValues.length === 0) {
		const projectResponse = await fetchVercelJson(
			`https://api.vercel.com/v9/projects/${env.projectId}/domains?teamId=${env.teamId}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${env.authToken}`,
					"Content-Type": "application/json",
				},
				cache: "no-store",
			},
		);

		if (projectResponse.domains) {
			const projectDomain = projectResponse.domains.find(
				(projectDomain) => projectDomain.name === domain,
			);
			if (projectDomain?.apexValue) {
				response.aValues = [projectDomain.apexValue];
			}
		}
	}

	return response;
};

export const checkDomainStatus = async (domain: string) => {
	try {
		const [domainJson, configJson, requiredConfigJson] = await Promise.all([
			getDomainResponse(domain),
			getConfigResponse(domain),
			getRequiredConfig(domain),
		]);

		let verified = false;

		if (configJson.misconfigured || domainJson?.error?.code === "not_found") {
			verified = false;
		} else if (domainJson.verified) {
			verified = true;
		} else {
			const verificationJson = await verifyDomain(domain);
			verified = Boolean(verificationJson?.verified);
		}

		const currentAValues = configJson.aValues || [];
		const requiredAValue = requiredConfigJson.aValues?.[0];

		return {
			verified,
			config: {
				...configJson,
				verification: domainJson?.verification || [],
				currentAValues,
				requiredAValue,
			},
			status: domainJson,
		};
	} catch (_error) {
		return {
			verified: false,
			error: "Failed to check domain status",
		};
	}
};
