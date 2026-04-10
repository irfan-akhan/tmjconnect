FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY tsconfig.base.json ./

# Install all dependencies (including dev for build)
RUN npm install --workspaces

# Copy source files
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Build shared package first, then API
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

# ─── Production image ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copy workspace manifests for production install
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY tsconfig.base.json ./

# Production deps only
RUN npm install --workspaces --omit=dev

# Copy built output from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Run as non-root for HIPAA / least privilege
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
