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

# Install dumb-init (proper signal handling)
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Copy production dependencies
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/food-waste-backend/node_modules ./apps/food-waste-backend/node_modules

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/apps/food-waste-backend/dist ./apps/food-waste-backend/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/food-waste-backend/package.json ./apps/food-waste-backend/

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

# Health check
HEALTHCHECK --interval=30s \
            --timeout=10s \
            --start-period=40s \
            --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health/liveness', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Set working directory to backend
WORKDIR /app/apps/food-waste-backend

# Start application using dumb-init for proper signal handling
CMD ["dumb-init", "node", "dist/main.js"]
