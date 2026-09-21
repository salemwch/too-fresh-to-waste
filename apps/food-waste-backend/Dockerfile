# ============================================
# FOOD WASTE BACKEND - PRODUCTION DOCKERFILE
# ============================================
#
# Multi-stage build optimised for a pnpm workspace monorepo.
#
# Design decisions:
#
#   1. .npmrc is NOT copied into Docker.
#      The repo's .npmrc sets node-linker=hoisted (Metro requires it). Without
#      it, pnpm defaults to isolated node_modules, where each workspace package
#      gets the exact dependency versions declared in its own package.json.
#      This avoids a hoisting conflict between Zod 3 (used by @foodwaste/shared)
#      and Zod 4 (pulled transitively by eslint-plugin-react-hooks). In hoisted
#      mode, the wrong major can win the root position and break compilation.
#
#   2. Native addons are rebuilt with npm, not pnpm.
#      pnpm rebuild validates .modules.yaml metadata, which records the workspace
#      scope at install time. Any mismatch between the deps and builder stages
#      (even a missing package.json) triggers ERR_PNPM_MISSING_HOISTED_LOCATIONS.
#      npm rebuild targets individual packages without that validation.
#
#   3. Only workspace packages in the backend's dependency graph are present.
#      Mobile, web, and UI packages are excluded via .dockerignore so their
#      heavyweight dependency trees (react-native, next.js) are never installed.
#
# Build: docker build -t foodwaste/backend:latest -f apps/food-waste-backend/Dockerfile .
# Run:   docker run -p 3000:3000 --env-file .env.production foodwaste/backend:latest
# ============================================

# ============================================
# STAGE 1: Dependencies
# ============================================
FROM node:26.9.0-alpine AS deps

LABEL maintainer="FoodWaste Team <dev@foodwaste.com>"
LABEL description="Food Waste Backend API"
LABEL version="1.0.0"

WORKDIR /app

# pnpm treats a missing TTY as "cannot confirm destructive actions" and aborts
# (ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY). CI=true is pnpm's documented
# non-interactive signal and is required for the --prod prune in the builder.
ENV CI=true

RUN npm install -g pnpm@10.17.0

# Copy workspace root manifests (no .npmrc — see header comment #1).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ ./patches/

# Every workspace package the backend's dependency graph reaches.
# turbo prune @foodwaste/backend --docker produces this same set.
COPY apps/food-waste-backend/package.json ./apps/food-waste-backend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/email-templates/package.json ./packages/email-templates/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/jest-config/package.json ./packages/jest-config/

# Install ALL dependencies (dev + prod) for the build.
# --ignore-scripts: postinstall runs build:deps (tsc), which needs source files
# not present yet. Native addons are rebuilt in the builder stage.
RUN pnpm install --frozen-lockfile --prefer-offline --ignore-scripts

# ============================================
# STAGE 2: Builder
# ============================================
FROM node:26.9.0-alpine AS builder

WORKDIR /app

# See the deps stage — required for the --prod prune below.
ENV CI=true

RUN npm install -g pnpm@10.17.0

# Copy the full dependency tree from deps.
# In isolated mode each workspace package has its own node_modules with symlinks
# into the root .pnpm store, so all of them must be copied.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/food-waste-backend/node_modules ./apps/food-waste-backend/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/email-templates/node_modules ./packages/email-templates/node_modules

# Copy source code (.dockerignore excludes apps/mobile, apps/web, packages/ui,
# node_modules, .npmrc, and build artifacts).
COPY . .

# Build shared + email-templates (backend imports from both).
RUN pnpm run build:deps

# Build the backend.
RUN pnpm --filter @foodwaste/backend build

# Strip devDependencies across the workspace to reduce the final image.
# --ignore-scripts: TypeScript (a devDep) is being removed by this command,
# so any script that invokes tsc would fail.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Rebuild native addons LAST — order is load-bearing.
#
# The prune above re-links node_modules from the pnpm store, discarding any
# binary produced before it. Rebuilding earlier therefore ships argon2 and
# @mongodb-js/zstd without their compiled .node files, and the container dies
# on the first password hash rather than at build time.
#
# Build tools are temporary, for @mongodb-js/zstd's node-gyp fallback on musl.
#
# `pnpm -r rebuild`, and every part of that matters.
#
# `npm rebuild` cannot navigate pnpm's store layout: the packages live under
# node_modules/.pnpm/<name>@<version>/node_modules/<name>, npm looks at the top
# level, finds nothing, and exits 0. Plain `pnpm rebuild` exits 0 too — without
# -r it only considers the root project's own dependencies, and these are
# transitive dependencies of the backend *workspace* project. Only the recursive
# form walks all workspace projects, finds them, and runs their install scripts.
#
# Both silent forms are the whole problem: the step looked like it worked for as
# long as it has existed, while producing no binaries at all.
#
# argon2 survived anyway because it ships prebuilt binaries for every platform.
# @mongodb-js/zstd ships none, so the image had no zstd addon — and since the
# Mongoose config negotiates `compressors: ['zstd', ...]`, the driver selected
# zstd and then threw MongoMissingDependencyError on every single command. The
# container could not run one query.
#
# The build must also be verified rather than assumed: a rebuild that fails to
# emit a .node file has to fail the image build, or this exact class of silent
# no-op comes straight back.
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && pnpm -r rebuild argon2 @mongodb-js/zstd \
    && find node_modules/.pnpm -path '*zstd*' -name '*.node' -print -quit | grep -q . \
    && apk del .build-deps

# ============================================
# STAGE 3: Production Runtime
# ============================================
FROM node:26.9.0-alpine AS runner

WORKDIR /app

RUN apk add --no-cache dumb-init

# PM2 in cluster mode — one worker per detected CPU core.
# Pinned to the mature 6.x line; revisit when 7.x stabilises.
RUN npm install -g pm2@6.0.14 && npm cache clean --force

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Copy production node_modules.
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/food-waste-backend/node_modules ./apps/food-waste-backend/node_modules

# Copy built workspace packages that the backend imports at runtime.
# node_modules/@foodwaste/shared symlinks to packages/shared/, so the
# compiled output and its own node_modules must be present.
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared ./packages/shared
COPY --from=builder --chown=nestjs:nodejs /app/packages/email-templates ./packages/email-templates

# Copy built backend.
COPY --from=builder --chown=nestjs:nodejs /app/apps/food-waste-backend/dist ./apps/food-waste-backend/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/food-waste-backend/package.json ./apps/food-waste-backend/
COPY --from=builder --chown=nestjs:nodejs /app/apps/food-waste-backend/ecosystem.config.js ./apps/food-waste-backend/

RUN mkdir -p /app/logs /app/uploads && \
    chown -R nestjs:nodejs /app/logs /app/uploads

USER nestjs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV PROCESS_ROLE=all

HEALTHCHECK --interval=30s \
            --timeout=10s \
            --start-period=40s \
            --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health/liveness', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

WORKDIR /app/apps/food-waste-backend

CMD ["dumb-init", "pm2-runtime", "start", "ecosystem.config.js", "--only", "food-waste-api", "--env", "production"]
