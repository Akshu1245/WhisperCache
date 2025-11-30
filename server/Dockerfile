# ============================================================================
# WhisperCache Server Dockerfile
# ============================================================================
# Multi-stage build for optimized production image

# ============================================================================
# Stage 1: Build
# ============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# ============================================================================
# Stage 2: ZK Circuit Build (optional)
# ============================================================================
FROM node:22-alpine AS zk-builder

WORKDIR /app/zk

# Install circom dependencies
RUN apk add --no-cache python3 make g++ git

# Copy ZK package files
COPY zk/package*.json ./
RUN npm ci

# Copy circuit source
COPY zk/circuits ./circuits
COPY zk/scripts ./scripts

# Build circuits (if needed)
# RUN npm run compile

# ============================================================================
# Stage 3: Production
# ============================================================================
FROM node:22-alpine AS production

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache tini

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S whispercache -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy ZK artifacts (if built)
# COPY --from=zk-builder /app/zk/circuits ./zk/circuits

# Create data directory
RUN mkdir -p data && chown -R whispercache:nodejs data

# Switch to non-root user
USER whispercache

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "dist/index.js"]

# ============================================================================
# Stage 4: Development
# ============================================================================
FROM node:22-alpine AS development

WORKDIR /app

# Install development dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies
RUN npm ci

# Copy source (will be overridden by volume mount)
COPY src ./src

# Expose port
EXPOSE 4000

# Start with ts-node-dev for hot reload
CMD ["npm", "run", "dev"]
