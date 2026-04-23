# Production build of the admin SPA. Mirrors apps/provider/Dockerfile —
# same multi-stage pattern: build the bundle, then hand `/dist` to nginx as
# a read-only volume via docker-compose.
#
# The build is parameterised by VITE_API_BASE_URL so the same image can target
# different environments (staging/prod/etc.). Vite inlines env vars at build
# time, so this has to be an ARG, not a runtime env var.

FROM node:20-alpine AS builder

ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/admin/package.json ./apps/admin/

RUN npm install --workspaces --include-workspace-root

COPY packages/shared/ ./packages/shared/
COPY apps/admin/ ./apps/admin/

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=@tmjconnect/admin

# ─── Static serving image ─────────────────────────────────────────────────────────
# The main nginx container in docker-compose.yml mounts this image's /dist as a
# volume, so this image is a build artifact carrier, not a running server.
FROM nginx:1.25-alpine AS production

COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/ > /dev/null 2>&1 || exit 1

EXPOSE 80
