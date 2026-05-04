# GNPS Civic Readiness Portal — self-hosted Docker image.
# Multi-stage build: build the SvelteKit app with adapter-node, then run on a slim Node 22 base.
# Used by docker-compose.yml as the `app` service.

ARG NODE_VERSION=22

# ─── Stage 1: build ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /repo

# Install pnpm via corepack (matches dev environment)
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

# Copy workspace metadata first to maximize Docker layer cache reuse
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/pathway-rules/package.json ./packages/pathway-rules/
COPY packages/nysed-export/package.json ./packages/nysed-export/

RUN pnpm install --frozen-lockfile

# Copy source and config
COPY scripts ./scripts
COPY packages ./packages
COPY apps/web ./apps/web

# Build with the Node adapter
ENV SVELTE_ADAPTER=node
RUN pnpm run sync-vendored \
  && pnpm --filter ./apps/web build

# ─── Stage 2: runtime ───────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime

WORKDIR /app

# Non-root user for the runtime
RUN addgroup -S app && adduser -S app -G app

# adapter-node produces a self-contained build/ directory with package.json
COPY --from=builder --chown=app:app /repo/apps/web/build ./build
COPY --from=builder --chown=app:app /repo/apps/web/package.json ./build/package.json

# Production deps only for runtime
RUN cd build && npm install --omit=dev --no-package-lock --silent && rm -rf /tmp/* /root/.npm

# Evidence-files persistent dir (mounted as a volume in docker-compose)
RUN mkdir -p /app/evidence-data && chown -R app:app /app/evidence-data

USER app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    BODY_SIZE_LIMIT=10485760

EXPOSE 3000

# Health check that the orchestrator can use
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "build/index.js"]
