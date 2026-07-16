FROM public.ecr.aws/docker/library/node:24-alpine AS base
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .

RUN corepack enable pnpm
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm i --frozen-lockfile

ARG NEXT_PUBLIC_DOCKER_BUILD=true
ARG NEXT_PUBLIC_WEB_URL=http://localhost:3000
ARG BUILD_SHA=unknown

ENV NEXT_PUBLIC_DOCKER_BUILD=$NEXT_PUBLIC_DOCKER_BUILD
ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL
ENV BUILD_SHA=$BUILD_SHA

RUN pnpm run build:web

RUN pnpm --filter @cap/web exec esbuild migrate-entry.ts \
  --bundle --platform=node --format=cjs \
  --outfile=run-migrations.cjs


# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001


# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/packages/database/migrations ./apps/web/migrations
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/run-migrations.cjs ./apps/web/run-migrations.cjs

ARG NEXT_PUBLIC_DOCKER_BUILD=true
ARG NEXT_PUBLIC_WEB_URL=http://localhost:3000
ARG BUILD_SHA=unknown

ENV NEXT_PUBLIC_DOCKER_BUILD=$NEXT_PUBLIC_DOCKER_BUILD
ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL
ENV BUILD_SHA=$BUILD_SHA
ENV NODE_ENV=production

USER nextjs

EXPOSE 3000

CMD HOSTNAME="0.0.0.0" node apps/web/server.js
