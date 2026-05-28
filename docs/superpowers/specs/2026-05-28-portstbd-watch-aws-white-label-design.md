# Port & Starboard Watch White Label and AWS Deployment Design

Date: 2026-05-28

## Approved Direction

- Domain: `watch.portstbd.com`
- Visible brand: `Port & Starboard`
- Visual direction: `Watch Command`
- Scope: web app only
- Deployment target: PSCICD contract onboarding, EC2, Docker Compose, CaddyKeeper, Caddy
- Database: existing Aurora MySQL RDS through `DATABASE_URL`
- Storage: AWS S3 through Cap S3 environment variables

## Objectives

- Deploy the Cap web app as a Port & Starboard branded video watch/share service.
- Remove visible Cap branding from the web user experience used by customers and internal users.
- Preserve internal package names, crate names, and desktop app branding for this phase.
- Use PSCICD as the deploy source of truth rather than app-repo deploy scripts.
- Keep the first production release small enough to validate DNS, auth, DB, storage, upload, processing, and playback.

## Confirmed Facts

- The repo is a Turborepo monorepo with `apps/web` as the Next.js web app and `apps/media-server` as the media processing service.
- The database layer already uses MySQL through Drizzle and `mysql2`.
- Existing deploy artifacts include `apps/web/Dockerfile`, `apps/media-server/Dockerfile.standalone`, `docker-compose.yml`, and `docker-compose.coolify.yml`.
- The media server exposes `GET /health`.
- The web app currently has no dedicated PSCICD-compatible `GET /api/health` route.
- The current working tree contains unrelated dirty files from prior work.
- `package.json` is currently modified to Loom desktop package metadata and dependencies, which blocks reliable install, check, and deploy work until repaired.

## Assumptions

- PSCICD can access the GitHub repo through the existing CodeConnections ARN used by other P&S projects.
- `watch.portstbd.com` and optional `staging-watch.portstbd.com` will be managed through Route 53 and CaddyKeeper.
- Aurora MySQL is reachable from the PSCICD EC2 host network or will be made reachable by security group rules.
- AWS S3 will store recording assets, thumbnails, exports, and upload parts.
- Google OAuth, WorkOS, email, Stripe, PostHog, Sentry, and AI providers can be disabled for MVP unless required for login or core playback.

## Non-Goals

- No desktop app rename, app signing change, updater change, or installer work.
- No Rust crate rename or workspace package rename.
- No migration from MySQL to PostgreSQL.
- No rewrite of public marketing pages beyond launch-needed visible branding.
- No new billing/product model.
- No production data import beyond existing Loom import work unless separately approved.

## Product and Brand Design

### Brand Surface

The web app should present as `Port & Starboard` on customer-visible surfaces:

- root metadata
- favicon and touch icons
- Open Graph image
- manifest names
- share pages under `/s/:videoId`
- dashboard navigation and empty states
- email templates sent by web flows
- default recording names that users see
- public error pages

Internal names can stay as `cap` when they are not user-visible.

### Visual Tokens

- Atlantic Blue: `#163760`, primary navigation and high-emphasis text
- Caribbean Blue: `#63A1B4`, secondary accents and links
- Off Starboard: `#C7D857`, positive action and completion accents
- Off Port: `#CF1C9C`, rare alert or contrast accent
- Typography: Lato on brand surfaces when practical, falling back to the existing local font stack where replacing typography would create layout churn

### Copy Tone

Tone should stay professional, candid, and trustworthy. Copy should frame the app as a video watch/share service for Port & Starboard work. Avoid public claims that depend on Cap SaaS infrastructure, pricing, or desktop app branding.

## Architecture

### Runtime Topology

PSCICD should deploy one compose stack with two services:

- `web`: Next.js app from `apps/web/Dockerfile`, listening on `3000`
- `media-server`: Bun/Hono media processor from `apps/media-server/Dockerfile.standalone`, listening on `3456`

Both services join the PSCICD/Caddy proxy network. CaddyKeeper registers the public route to the web service after deploy verification.

### Data Flow

1. User opens `https://watch.portstbd.com`.
2. Caddy routes traffic to the `web` service.
3. `web` reads app data from Aurora MySQL.
4. Upload and playback assets use AWS S3 signed URLs or the existing proxy path where browser playback needs app-controlled responses.
5. `web` calls `media-server` over the compose network for processing work.
6. `media-server` calls back to `web` using internal webhook URL and shared webhook secret.

### Required Environment Variables

Production secrets should live in AWS Secrets Manager at `portstbd-watch/production`. Staging secrets should live at `portstbd-watch/staging`.

Required app keys:

- `DATABASE_URL`
- `WEB_URL`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_WEB_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_ENCRYPTION_KEY`
- `MEDIA_SERVER_WEBHOOK_SECRET`
- `MEDIA_SERVER_URL`
- `MEDIA_SERVER_WEBHOOK_URL`
- `CAP_AWS_ACCESS_KEY`
- `CAP_AWS_SECRET_KEY`
- `CAP_AWS_BUCKET`
- `CAP_AWS_REGION`
- `S3_PUBLIC_ENDPOINT`
- `S3_INTERNAL_ENDPOINT`
- `S3_PATH_STYLE`

Optional keys can be added only when used:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_DOMAIN`
- `POSTHOG_KEY`
- `POSTHOG_HOST`
- `SENTRY_DSN`
- `DEEPGRAM_API_KEY`
- `OPENAI_API_KEY`

Production domain values:

- `WEB_URL=https://watch.portstbd.com`
- `NEXTAUTH_URL=https://watch.portstbd.com`
- `NEXT_PUBLIC_WEB_URL=https://watch.portstbd.com`
- `MEDIA_SERVER_URL=http://portstbd-watch-media-server:3456`
- `MEDIA_SERVER_WEBHOOK_URL=http://portstbd-watch-web:3000`

Exact internal container names should follow generated PSCICD compose-stack output.

## PSCICD Contract

### App Repo Contract Work

The app repo must satisfy PSCICD before onboarding:

- Restore valid root `package.json`.
- Add a canonical `check:cicd` command.
- Add `GET /api/health` in `apps/web`.
- Expose `BUILD_SHA` in health output and `X-Commit-Sha` response header.
- Ensure Docker build passes `BUILD_SHA` into runtime.
- Document required environment variables.
- Keep health checks non-interactive and independent of browser rendering.

Recommended web health response:

```json
{
	"ready": true,
	"status": "ok",
	"buildSha": "runtime BUILD_SHA value",
	"db": { "status": "ok" },
	"mediaServer": { "status": "ok" }
}
```

The route should return `200` only when the web app, database, and media server checks pass. It should return `503` with diagnostic status when a dependency fails.

### PSCICD Manifest Shape

Use the compose-stack manifest path because the app needs two long-running services.

Manifest target:

- file: `/Users/jeff/DevelopmentProjects/PSCICD/manifests/portstbd-watch.json`
- project slug: `portstbd-watch`
- display name: `Port & Starboard Watch`
- template: `http-service`
- repository: confirm exact GitHub owner and repo before manifest generation
- branch: confirm deployment branch before manifest generation
- production route: `https://watch.portstbd.com`
- staging route: `https://staging-watch.portstbd.com`
- production secret: `portstbd-watch/production`
- staging secret: `portstbd-watch/staging`

Smoke expression:

```text
.ready == true and .status == "ok" and .buildSha == env.EXPECTED_BUILD_SHA
```

### Generated PSCICD Assets

After manifest approval, run PSCICD generation and review:

- `configs/portstbd-watch/*`
- `projects/portstbd-watch/*`
- generated buildspecs
- generated compose files
- generated deploy script
- CaddyKeeper routing configuration

PSCICD remains the deploy source of truth. App repo deploy scripts should not compete with generated PSCICD behavior.

## AWS Resources

### DNS and Routing

- Create Route 53 `A` or CaddyKeeper-managed route for `watch.portstbd.com`.
- Create staging route for `staging-watch.portstbd.com` if staging uses public smoke.
- Require DNS propagation evidence before production rollout if DNS changes during release.

### Aurora MySQL

- Create or select a database/schema for `portstbd_watch`.
- Create least-privilege app user.
- Allow inbound MySQL from the EC2 host security group only.
- Run migrations as a PSCICD migration step or explicit release step before production traffic.

### S3

- Create bucket or prefix for `portstbd-watch` assets.
- Configure CORS for browser upload/playback paths.
- Use IAM access scoped to required bucket actions.
- Confirm signed GET, signed PUT, multipart upload, and range requests before launch.

### Secrets

- Store staging and production secrets separately.
- Include only required keys for MVP.
- Add optional provider keys after the base deployment works.

## MVP Acceptance Criteria

- `https://watch.portstbd.com/api/health` returns `200` with `ready: true`, `status: "ok"`, and matching `buildSha`.
- CaddyKeeper runtime verification maps `watch.portstbd.com` to the intended `portstbd-watch` container.
- User can sign in through an enabled auth method.
- User can upload or create a test video.
- Media server processes the test video.
- Share page loads under `watch.portstbd.com/s/:videoId`.
- Video playback supports range requests and seeking.
- Download and thumbnail routes work.
- No visible Cap logo, Cap metadata, or `cap.so` public URL appears in the MVP watch/share path.
- Rollback by prior image tag restores the previous healthy deployment.

## Testing and Validation

### Local and CI Checks

- `pnpm exec biome check --write` scoped to files changed in the implementation commit.
- `pnpm run check:cicd` after the command exists.
- Targeted unit tests for health route and brand config.
- Existing web tests for affected share/dashboard components.

### Deployment Checks

- PSCICD build gate passes.
- PSCICD staging deploy passes.
- Staging smoke passes health expression.
- Staging manual smoke covers auth, upload, processing, playback, and share page branding.
- Production deploy passes health expression.
- CaddyKeeper runtime verification confirms correct route-to-container mapping.

### S3 Checks

- Upload signed URL accepts expected content types.
- Playback signed URL or proxy path supports byte ranges.
- Thumbnail read works from public app route.
- Multipart upload cleanup works after failure.

## Error Handling

- Health route should fail closed with `503` when DB or media server is unavailable.
- Media webhook failures should retain enough logs to replay or retry processing.
- S3 errors should remain typed through existing storage error handling.
- CaddyKeeper registration failures should persist in PSCICD while allowing operator review according to PSCICD policy.

## Rollout Plan

1. Repair repo state and restore `package.json`.
2. Add app repo PSCICD contract pieces.
3. Implement web white-label pass.
4. Create AWS secrets, S3 bucket, and Aurora database access.
5. Add PSCICD manifest and generate project assets.
6. Deploy to staging through PSCICD.
7. Run staging smoke and manual MVP tests.
8. Create production DNS route and deploy through PSCICD.
9. Verify production health, playback, CaddyKeeper mapping, and visible branding.

## Risks

- Dirty worktree can mix prior Loom import or Portless changes into this deployment. Mitigation: isolate or cleanly commit unrelated work before implementation.
- Current `package.json` blocks dependency and CI commands. Mitigation: restore root package metadata before any deployment work.
- S3 range behavior can break video seeking. Mitigation: include byte-range playback in staging smoke.
- Aurora connectivity can fail at security group or subnet level. Mitigation: validate from EC2 host before deploy.
- CaddyKeeper can route to the wrong container if metadata is ambiguous. Mitigation: expose build SHA and verify route-to-container mapping after deploy.
- White-label copy can miss long-tail Cap references. Mitigation: scan visible surfaces and defer non-MVP marketing pages explicitly.

## Implementation Boundaries

Implementation should happen in small commits:

1. repo repair and health contract
2. brand config and assets
3. web visible string replacements
4. Docker and PSCICD app contract
5. PSCICD manifest and generated assets
6. deployment docs and runbook

Each commit should have scoped verification before moving to the next one.

## Review Gate

This design requires user approval before implementation planning begins. After approval, create an implementation plan using the writing-plans workflow and keep PSCICD repo changes separate from Cap app repo changes unless a single branch strategy is explicitly chosen.
