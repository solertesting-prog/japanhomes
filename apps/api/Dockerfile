# syntax=docker/dockerfile:1.7
# Build from the repository root:  docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache openssl
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml* pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/database/package.json packages/database/
COPY packages/config/package.json packages/config/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY packages packages
COPY apps/api apps/api
COPY turbo.json ./
RUN pnpm --filter @jpt/api... build && pnpm deploy --filter @jpt/api --prod --legacy /out
# `pnpm deploy` reinstalls @prisma/client without the client generated from our
# schema (that lives next to it as .prisma/); copy the generated client over.
RUN set -e; src="$(ls -d /repo/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma | head -n1)"; \
    test -n "$src"; \
    for d in /out/node_modules/.pnpm/@prisma+client@*/node_modules; do cp -R "$src" "$d/"; done; \
    ls /out/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/schema.prisma

# One-off migration task: `prisma migrate deploy` with the full toolchain.
FROM build AS migrate
COPY infra/docker/migrate-entrypoint.sh /usr/local/bin/migrate
RUN chmod +x /usr/local/bin/migrate
USER node
ENTRYPOINT ["/usr/local/bin/migrate"]

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl tini && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=app:app /out ./
COPY --from=build --chown=app:app /repo/apps/api/dist ./dist
USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:4000/health/live || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
