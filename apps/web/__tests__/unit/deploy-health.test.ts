import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	db: vi.fn(),
	execute: vi.fn(),
	serverEnv: vi.fn(),
	sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
		strings: Array.from(strings),
		values,
	})),
}));

vi.mock("@cap/database", () => ({
	db: mocks.db,
}));

vi.mock("@cap/env", () => ({
	serverEnv: mocks.serverEnv,
}));

vi.mock("drizzle-orm", () => ({
	sql: mocks.sql,
}));

import {
	checkDatabaseHealth,
	checkMediaServerHealthForDeploy,
	collectDeployHealth,
	type DependencyHealth,
	resolveBuildSha,
} from "@/lib/deploy-health";

const ok = { status: "ok" } satisfies DependencyHealth;

describe("resolveBuildSha", () => {
	it("prefers BUILD_SHA", () => {
		expect(
			resolveBuildSha({
				BUILD_SHA: "build-sha",
				CODEBUILD_RESOLVED_SOURCE_VERSION: "codebuild-sha",
			}),
		).toBe("build-sha");
	});

	it("falls back to CodeBuild SHA, Vercel SHA, and then unknown", () => {
		expect(
			resolveBuildSha({ CODEBUILD_RESOLVED_SOURCE_VERSION: "codebuild-sha" }),
		).toBe("codebuild-sha");
		expect(resolveBuildSha({ VERCEL_GIT_COMMIT_SHA: "vercel-sha" })).toBe(
			"vercel-sha",
		);
		expect(resolveBuildSha({})).toBe("unknown");
	});

	it("treats blank SHA values as missing", () => {
		expect(
			resolveBuildSha({
				BUILD_SHA: "  ",
				CODEBUILD_RESOLVED_SOURCE_VERSION: "\t",
				VERCEL_GIT_COMMIT_SHA: "\n",
			}),
		).toBe("unknown");
	});
});

describe("collectDeployHealth", () => {
	it("returns ready when database and media server are ok", async () => {
		const health = await collectDeployHealth({
			env: { BUILD_SHA: "abc123" },
			checkDatabase: async () => ok,
			checkMediaServer: async () => ok,
		});

		expect(health).toEqual({
			ready: true,
			status: "ok",
			buildSha: "abc123",
			db: ok,
			mediaServer: ok,
		});
	});

	it("returns not ready when database fails", async () => {
		const health = await collectDeployHealth({
			env: { BUILD_SHA: "abc123" },
			checkDatabase: async () => ({ status: "error", message: "db down" }),
			checkMediaServer: async () => ok,
		});

		expect(health.ready).toBe(false);
		expect(health.status).toBe("error");
		expect(health.db).toEqual({ status: "error", message: "db down" });
	});

	it("runs dependency checks concurrently", async () => {
		const order: string[] = [];
		let resolveDatabaseCheck: (value: DependencyHealth) => void = () => {};
		const databaseCheck = new Promise<DependencyHealth>((resolve) => {
			resolveDatabaseCheck = resolve;
		});

		const healthPromise = collectDeployHealth({
			env: { BUILD_SHA: "abc123" },
			checkDatabase: async () => {
				order.push("db-start");
				return databaseCheck;
			},
			checkMediaServer: async () => {
				order.push("media-start");
				return ok;
			},
		});

		expect(order).toEqual(["db-start", "media-start"]);
		resolveDatabaseCheck(ok);
		await expect(healthPromise).resolves.toMatchObject({ ready: true });
	});

	it("normalizes thrown dependency errors", async () => {
		const checkDatabase = vi.fn(async () => {
			throw new Error("connection refused");
		});

		const health = await collectDeployHealth({
			env: { BUILD_SHA: "abc123" },
			checkDatabase,
			checkMediaServer: async () => ok,
		});

		expect(health.db).toEqual({
			status: "error",
			message: "connection refused",
		});
	});
});

describe("checkDatabaseHealth", () => {
	it("executes a select 1 probe", async () => {
		mocks.db.mockReturnValue({ execute: mocks.execute });
		mocks.execute.mockResolvedValueOnce([{ value: 1 }]);

		await expect(checkDatabaseHealth()).resolves.toEqual(ok);
		expect(mocks.sql).toHaveBeenCalledWith(["select 1"]);
		expect(mocks.execute).toHaveBeenCalledWith({
			strings: ["select 1"],
			values: [],
		});
	});
});

describe("checkMediaServerHealthForDeploy", () => {
	it("checks the media server health endpoint", async () => {
		mocks.serverEnv.mockReturnValue({
			MEDIA_SERVER_URL: "https://media.example.com/",
		});
		const fetcher = vi.fn(
			async () =>
				new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
		);

		await expect(
			checkMediaServerHealthForDeploy(fetcher as unknown as typeof fetch),
		).resolves.toEqual(ok);
		expect(fetcher).toHaveBeenCalledWith(
			"https://media.example.com/health",
			expect.objectContaining({ cache: "no-store", method: "GET" }),
		);
	});

	it("times out slow media server health checks", async () => {
		mocks.serverEnv.mockReturnValue({
			MEDIA_SERVER_URL: "https://media.example.com",
		});
		vi.useFakeTimers();
		const fetcher = vi.fn(
			(_url: string | URL | Request, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(new Error("aborted"));
					});
				}),
		);

		try {
			const healthPromise = checkMediaServerHealthForDeploy(
				fetcher as unknown as typeof fetch,
			);

			await vi.advanceTimersByTimeAsync(3000);
			await expect(healthPromise).resolves.toEqual({
				status: "error",
				message: "aborted",
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it("reports media server failures", async () => {
		mocks.serverEnv.mockReturnValue({ MEDIA_SERVER_URL: undefined });
		await expect(checkMediaServerHealthForDeploy()).resolves.toEqual({
			status: "error",
			message: "MEDIA_SERVER_URL is not configured",
		});

		mocks.serverEnv.mockReturnValue({
			MEDIA_SERVER_URL: "https://media.example.com",
		});
		await expect(
			checkMediaServerHealthForDeploy(
				vi.fn(
					async () => new Response("", { status: 503 }),
				) as unknown as typeof fetch,
			),
		).resolves.toEqual({
			status: "error",
			message: "Media server health check failed: 503",
		});

		await expect(
			checkMediaServerHealthForDeploy(
				vi.fn(
					async () =>
						new Response(JSON.stringify({ status: "degraded" }), {
							status: 200,
						}),
				) as unknown as typeof fetch,
			),
		).resolves.toEqual({
			status: "error",
			message: "Media server status is degraded",
		});
	});
});

describe("GET /api/health", () => {
	it("returns readiness response with deploy headers", async () => {
		const health = {
			ready: true,
			status: "ok",
			buildSha: "route-sha",
			db: ok,
			mediaServer: ok,
		};
		vi.resetModules();
		vi.doMock("@/lib/deploy-health", () => ({
			collectDeployHealth: vi.fn(async () => health),
		}));

		const { GET, dynamic } = await import("@/app/api/health/route");
		const response = await GET();

		expect(dynamic).toBe("force-dynamic");
		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("X-Commit-Sha")).toBe("route-sha");
		await expect(response.json()).resolves.toEqual(health);
	});

	it("returns 503 when not ready", async () => {
		const health = {
			ready: false,
			status: "error",
			buildSha: "route-sha",
			db: ok,
			mediaServer: { status: "error", message: "media down" },
		};
		vi.resetModules();
		vi.doMock("@/lib/deploy-health", () => ({
			collectDeployHealth: vi.fn(async () => health),
		}));

		const { GET } = await import("@/app/api/health/route");
		const response = await GET();

		expect(response.status).toBe(503);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("X-Commit-Sha")).toBe("route-sha");
		await expect(response.json()).resolves.toEqual(health);
	});
});
