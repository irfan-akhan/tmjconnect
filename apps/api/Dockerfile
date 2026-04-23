# Production API image. Two-stage build: compile TypeScript in the builder
# stage, then copy just the built output + production deps into a slim image.
#
# The `scripts/` directory is also copied so one-shot tasks (db:migrate,
# db:seed) can run inside the container via `docker compose run migrate`.

FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN npm install --workspaces --include-workspace-root

COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

# ─── Production image ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# wget — used by HEALTHCHECK. tini — proper signal handling for node in PID 1.
RUN apk add --no-cache wget tini

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Production deps only. ts-node is a runtime dep (not devDep) because the
# migrate/seed scripts still run as .ts — they exit quickly, so the tsc
# transpile cost is one-shot.
RUN npm install --workspaces --include-workspace-root --omit=dev

# Built output from the builder stage.
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# One-shot scripts + migration SQL — needed by the `migrate` init service.
COPY apps/api/scripts/ ./apps/api/scripts/
COPY apps/api/drizzle/ ./apps/api/drizzle/

# Run as non-root for HIPAA / least privilege. `node` user is created by the
# base image; give it ownership of the app dir so the runtime can write to
# /data/uploads (mounted as a separate volume — not under /app).
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/index.js"]
