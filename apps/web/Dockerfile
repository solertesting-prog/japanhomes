# syntax=docker/dockerfile:1.7
# Build from the repository root:  docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml* pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY packages/config/package.json packages/config/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY packages packages
COPY apps/web apps/web
COPY turbo.json ./
ENV NEXT_TELEMETRY_DISABLED=1
# Proxy target for /api/* is fixed at build time (Next writes rewrites into the
# routes manifest): build one image per environment.
ARG API_URL=http://127.0.0.1:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Pages prerendered at build read the DEMO fixtures (no API during the build);
# at runtime they revalidate from the API.
ARG JPT_DATA_SOURCE=demo
ARG NEXT_PUBLIC_DEV_TOOLS=false
ENV API_URL=$API_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL JPT_DATA_SOURCE=$JPT_DATA_SOURCE NEXT_PUBLIC_DEV_TOOLS=$NEXT_PUBLIC_DEV_TOOLS
RUN pnpm --filter @jpt/web... build

FROM node:22-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 JPT_DATA_SOURCE=api
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
