# Built from the repo root (`docker compose build server` / `docker build -f server/Dockerfile .`),
# not from server/ — @sora/server is an npm workspace member and needs the root
# lockfile plus its @sora/contracts sibling to install and build at all.

FROM node:22-alpine AS manifests
WORKDIR /repo
# argon2 falls back to compiling from source when no prebuilt binary matches
# this musl-based image; the toolchain only exists in these discarded stages.
RUN apk add --no-cache python3 make g++
# mobile/package.json is copied only so npm can resolve the workspaces list in
# the root package.json; --workspace below still keeps its dependency tree out
# of this image entirely.
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY mobile/package.json ./mobile/package.json

FROM manifests AS deps
RUN npm ci --workspace=@sora/server --workspace=@sora/contracts --include-workspace-root

# Runtime dependencies only: no typescript, @types or dev tooling in the shipped image.
FROM manifests AS prod-deps
RUN npm ci --omit=dev --workspace=@sora/server --workspace=@sora/contracts --include-workspace-root

FROM deps AS build
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/contracts ./packages/contracts
COPY server ./server
RUN npm run build --workspace @sora/contracts \
    && npm run build --workspace @sora/server

FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S serveruser -u 1001 -G nodejs

COPY --from=prod-deps --chown=serveruser:nodejs /repo/node_modules ./node_modules
# npm nests a server dependency here when its version can't be hoisted (@nestjs/* 12 today).
COPY --from=prod-deps --chown=serveruser:nodejs /repo/server/node_modules ./server/node_modules
COPY --from=build --chown=serveruser:nodejs /repo/package.json ./package.json
COPY --from=build --chown=serveruser:nodejs /repo/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=serveruser:nodejs /repo/packages/contracts/src ./packages/contracts/src
COPY --from=build --chown=serveruser:nodejs /repo/server/package.json ./server/package.json
COPY --from=build --chown=serveruser:nodejs /repo/server/dist ./server/dist
# The same image runs the one-shot `migrate` service in docker-compose.yml.
COPY --chown=serveruser:nodejs scripts/migrate.mjs ./scripts/migrate.mjs
COPY --chown=serveruser:nodejs db/migrations ./db/migrations

USER serveruser
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["node", "server/dist/src/main.js"]
