# ============================================
# FOOD WASTE BACKEND - PRODUCTION DOCKERFILE
# ============================================
#
# Multi-stage build for optimal image size and security
# Target: Production deployment
# Base Image: node:24-alpine (minimal footprint)
#
# Build: docker build -t foodwaste/backend:latest -f apps/food-waste-backend/Dockerfile .
# Run: docker run -p 3000:3000 --env-file .env.production foodwaste/backend:latest
# ============================================

# ============================================
# STAGE 1: Dependencies
# ============================================
FROM node:24.11.1-alpine AS deps

# Add metadata
LABEL maintainer="FoodWaste Team <dev@foodwaste.com>"
LABEL description="Food Waste Backend API"
LABEL version="1.0.0"

# Set working directory
WORKDIR /app

# Install pnpm globally (must match engines.pnpm in package.json)
RUN npm install -g pnpm@10.17.0

# Copy package management files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ ./patches/
COPY apps/food-waste-backend/package.json ./apps/food-waste-backend/
COPY packages/shared/package.json ./packages/shared/

# Install ALL dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile --prefer-offline

# ============================================
# STAGE 2: Builder
# ============================================
FROM node:24.11.1-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.17.0

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/food-waste-backend/node_modules ./apps/food-waste-backend/node_modules

# Copy source code
COPY . .

# Set working directory to backend
WORKDIR /app/apps/food-waste-backend

# Build the application
RUN pnpm build

# Remove devDependencies to reduce size
RUN pnpm install --prod --frozen-lockfile

# ============================================
# STAGE 3: Production Runtime
# ============================================
FROM node:24.11.1-alpine AS runner

# Set working directory
WORKDIR /app

# Install dumb-init (reaps zombies as PID 1)
RUN apk add --no-cache dumb-init

# PM2 runs the app in cluster mode — one worker per core. Without it the
# container uses a single core no matter how large the instance is, because
# Node is single-threaded.
#
# Pinned to the mature 6.x line rather than 7.x: this process supervises
# production, and a brand-new major is not where to find out about regressions.
# Revisit once 7.x has settled.
RUN npm install -g pm2@6.0.14 && npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Copy production dependencies
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/food-waste-backend/node_modules ./apps/food-waste-backend/node_modules

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/apps/food-waste-backend/dist ./apps/food-waste-backend/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/food-waste-backend/package.json ./apps/food-waste-backend/
COPY --from=builder --chown=nestjs:nodejs /app/apps/food-waste-backend/ecosystem.config.js ./apps/food-waste-backend/

# Create directories for logs and uploads
RUN mkdir -p /app/logs /app/uploads && \
    chown -R nestjs:nodejs /app/logs /app/uploads

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Which responsibilities this container carries — see src/config/process-role.ts.
# `all` keeps a single-container deployment behaving exactly as before. Once a
# dedicated worker container is running, set this to `api` here and `worker`
# there, so scheduled jobs stop competing with requests for the event loop.
ENV PROCESS_ROLE=all

# WEB_CONCURRENCY is deliberately NOT set here.
#
# ecosystem.config.js derives the worker count from this container's cgroup CPU
# limit (src/config/container-resources.ts), so the same image is sized
# correctly on a 0.1-CPU free instance and on an 8-core one. Baking a value in
# would override that detection everywhere and silently reintroduce the problem
# it solves — the variable wins whenever it is set.
#
# Set it at deploy time only to override a measured workload, and remember it
# multiplies the Mongo pool: total sockets are
# MONGO_MAX_POOL_SIZE × WEB_CONCURRENCY × replicas.

# Health check
HEALTHCHECK --interval=30s \
            --timeout=10s \
            --start-period=40s \
            --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health/liveness', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Set working directory to backend
WORKDIR /app/apps/food-waste-backend

# Start under pm2-runtime (not `pm2 start`, which daemonises and exits — the
# container would read that as a crash). dumb-init stays as PID 1 to reap
# zombies; pm2-runtime forwards signals to the workers for graceful shutdown.
#
# `--only food-waste-api` is required: the config also defines a worker app, and
# without it pm2 would start both in this one container. With PROCESS_ROLE
# defaulting to `all`, this single app runs the scheduled jobs too — identical
# behaviour to the previous `node dist/main.js`, just across every core.
#
# To run this same image as the dedicated worker, override at deploy time:
#   command: dumb-init pm2-runtime start ecosystem.config.js \
#              --only food-waste-worker --env production
# and set PROCESS_ROLE=api on the API container at the same time.
CMD ["dumb-init", "pm2-runtime", "start", "ecosystem.config.js", "--only", "food-waste-api", "--env", "production"]
