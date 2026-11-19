# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/web/Dockerfile .

# ---------- build the static site ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# The root workspace is included for TypeScript (the build runs tsc first).
RUN npm ci --workspace=@foodflow/web --include-workspace-root --ignore-scripts

COPY apps/web apps/web
# The API is reached on the same origin through nginx, so the default /api/v1 is right.
RUN npm run build --workspace=@foodflow/web

# ---------- serve it with nginx ----------
FROM nginx:1.28-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80