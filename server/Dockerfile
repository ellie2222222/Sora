# Built from the repo root (`docker compose build server` / `docker build -f server/Dockerfile .`),
# not from server/ — @sora/server is an npm workspace member and needs the root
# lockfile plus its @sora/contracts sibling to install and build at all.

FROM node:22-alpine AS deps
WORKDIR /repo

# mobile/package.json is copied only so npm can resolve the workspaces list in
# the root package.json; --workspace below still keeps its dependency tree out
# of this image entirely.
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY mobile/package.json ./mobile/package.json

# argon2 falls back to compiling from source when no prebuilt binary matches
# this musl-based image; toolchain only exists in this discarded stage.
RUN apk add --no-cache python3 make g++ \
    && npm ci --workspace=@sora/server --workspace=@sora/contracts --include-workspace-root

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

COPY --from=build --chown=serveruser:nodejs /repo/node_modules ./node_modules
COPY --from=build --chown=serveruser:nodejs /repo/package.json ./package.json
COPY --from=build --chown=serveruser:nodejs /repo/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=serveruser:nodejs /repo/packages/contracts/src ./packages/contracts/src
COPY --from=build --chown=serveruser:nodejs /repo/server/package.json ./server/package.json
COPY --from=build --chown=serveruser:nodejs /repo/server/dist ./server/dist

USER serveruser
EXPOSE 3000

CMD ["node", "server/dist/src/main.js"]
