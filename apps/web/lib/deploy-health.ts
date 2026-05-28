import { db } from "@cap/database";
import { serverEnv } from "@cap/env";
import { sql } from "drizzle-orm";

export type DependencyHealth =
	| { status: "ok" }
	| { status: "error"; message: string };

export type DeployHealth = {
	ready: boolean;
	status: "ok" | "error";
	buildSha: string;
	db: DependencyHealth;
	mediaServer: DependencyHealth;
};

type DeployHealthOptions = {
	env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
	checkDatabase?: () => Promise<DependencyHealth>;
	checkMediaServer?: () => Promise<DependencyHealth>;
};

const MEDIA_SERVER_HEALTH_TIMEOUT_MS = 3000;

const toErrorMessage = (error: unknown) => {
	if (error instanceof Error && error.message.trim()) return error.message;
	if (typeof error === "string" && error.trim()) return error;
	return "Unknown error";
};

const normalizeDependencyCheck = async (
	check: () => Promise<DependencyHealth>,
): Promise<DependencyHealth> => {
	try {
		return await check();
	} catch (error) {
		return { status: "error", message: toErrorMessage(error) };
	}
};

const firstPresent = (...values: Array<string | undefined>) =>
	values.map((value) => value?.trim()).find(Boolean) ?? "unknown";

const buildMediaServerHealthUrl = (mediaServerUrl: string) =>
	new URL("health", `${mediaServerUrl.replace(/\/+$/, "")}/`).toString();

export const resolveBuildSha = (
	env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) =>
	firstPresent(
		env.BUILD_SHA,
		env.CODEBUILD_RESOLVED_SOURCE_VERSION,
		env.VERCEL_GIT_COMMIT_SHA,
	);

export const checkDatabaseHealth = async (): Promise<DependencyHealth> =>
	normalizeDependencyCheck(async () => {
		await db().execute(sql`select 1`);
		return { status: "ok" };
	});

export const checkMediaServerHealthForDeploy = async (
	fetcher: typeof fetch = fetch,
): Promise<DependencyHealth> =>
	normalizeDependencyCheck(async () => {
		const mediaServerUrl = serverEnv().MEDIA_SERVER_URL?.trim();
		if (!mediaServerUrl) {
			return { status: "error", message: "MEDIA_SERVER_URL is not configured" };
		}

		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			MEDIA_SERVER_HEALTH_TIMEOUT_MS,
		);

		try {
			const response = await fetcher(
				buildMediaServerHealthUrl(mediaServerUrl),
				{
					method: "GET",
					cache: "no-store",
					signal: controller.signal,
				},
			);

			if (!response.ok) {
				return {
					status: "error",
					message: `Media server health check failed: ${response.status}`,
				};
			}

			const body = (await response.json()) as { status?: unknown };
			if (body.status !== "ok") {
				return {
					status: "error",
					message: `Media server status is ${String(body.status ?? "missing")}`,
				};
			}

			return { status: "ok" };
		} finally {
			clearTimeout(timeout);
		}
	});

export const collectDeployHealth = async ({
	env = process.env,
	checkDatabase = checkDatabaseHealth,
	checkMediaServer = checkMediaServerHealthForDeploy,
}: DeployHealthOptions = {}): Promise<DeployHealth> => {
	const [dbHealth, mediaServerHealth] = await Promise.all([
		normalizeDependencyCheck(checkDatabase),
		normalizeDependencyCheck(checkMediaServer),
	]);
	const ready = dbHealth.status === "ok" && mediaServerHealth.status === "ok";

	return {
		ready,
		status: ready ? "ok" : "error",
		buildSha: resolveBuildSha(env),
		db: dbHealth,
		mediaServer: mediaServerHealth,
	};
};
