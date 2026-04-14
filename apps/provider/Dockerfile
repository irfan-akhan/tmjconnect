FROM node:20-alpine AS builder

WORKDIR /app

# Workspace manifests
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/provider/package.json ./apps/provider/
COPY tsconfig.base.json ./

RUN npm install --workspaces

# Source
COPY packages/shared/ ./packages/shared/
COPY apps/provider/ ./apps/provider/

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=@tmjconnect/provider

# ─── Static serving image ─────────────────────────────────────────────────────────
# The main nginx container in docker-compose.yml mounts this image's /dist as a
# volume, so this image is a build artifact carrier, not a running server.
FROM nginx:1.25-alpine AS production

# Copy build output to a well-known path.
COPY --from=builder /app/apps/provider/dist /usr/share/nginx/html

# Health endpoint for orchestrators that treat this as a runnable container.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/ > /dev/null 2>&1 || exit 1

EXPOSE 80
