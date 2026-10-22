# ==========================================
# Multi-Stage Production Dockerfile for TrustVault
# ==========================================

# ------------------------------------------
# Stage 1: Build Application
# ------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root and workspace package files
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/
COPY apps/web/ ./apps/web/
COPY database/ ./database/

# Build shared types, API, and web frontend
RUN npm run build

# ------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Install security utilities and wget for healthchecks
RUN apk add --no-cache wget

# Create isolated storage directories owned by unprivileged node user
RUN mkdir -p /app/storage/files /app/storage/temp && \
    chown -R node:node /app/storage

# Copy production artifacts from builder
COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=node:node /app/apps/web/dist ./apps/web/dist
COPY --from=builder --chown=node:node /app/database ./database

# Enforce non-root execution
USER node

# Production environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_FILES_DIR=/app/storage/files
ENV STORAGE_TEMP_DIR=/app/storage/temp

EXPOSE 3000

# Automated container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Launch production server
CMD ["node", "apps/api/dist/server.js"]
