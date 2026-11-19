# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/api/Dockerfile .
# (The root package-lock.json is needed, so the build context is the whole monorepo.)

FROM node:24-bookworm-slim AS base
WORKDIR /app

# ---------- build: all dependencies, Prisma client, compiled JavaScript ----------
FROM base AS build
# Prisma's migration engine needs OpenSSL to run (used by the migrate and seed services).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Manifests first: this layer (the slow npm ci) is reused until a dependency changes.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=@foodflow/api --include-workspace-root --ignore-scripts

COPY apps/api apps/api
WORKDIR /app/apps/api
# prisma.config.ts reads DATABASE_URL, but generate never connects, so a placeholder is fine.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
  && npm run build

# ---------- runtime: production dependencies + compiled code only ----------
FROM base AS runtime
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=@foodflow/api --omit=dev --ignore-scripts \
  && npm cache clean --force

COPY --from=build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api

# Don't run as root inside the container.
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]