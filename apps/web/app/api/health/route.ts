import { collectDeployHealth } from "@/lib/deploy-health";

export const dynamic = "force-dynamic";

export async function GET() {
	const health = await collectDeployHealth();

	return Response.json(health, {
		status: health.ready ? 200 : 503,
		headers: {
			"Cache-Control": "no-store",
			"X-Commit-Sha": health.buildSha,
		},
	});
}
