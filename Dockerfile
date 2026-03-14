# ╔═══════════════════════════════════════════════════════════════════╗
# ║  Alpha Ultimate ERP v13 — Multi-stage Production Dockerfile       ║
# ╚═══════════════════════════════════════════════════════════════════╝

# Stage 1: Build frontend
FROM node:18-alpine as frontend-builder

WORKDIR /build

# Copy package files
COPY package*.json ./
COPY vite.config.ts tsconfig.json tsconfig.node.json ./
COPY index.html ./
COPY src ./src
COPY public ./public
COPY postcss.config.js tailwind.config.js ./
COPY css ./css

# Install dependencies and build
RUN npm install --break-system-packages && \
    npm run build

# Stage 2: Build backend
FROM node:18-alpine as backend-builder

WORKDIR /build

COPY package*.json ./
COPY api ./api
COPY sql ./sql

# Install only production dependencies
RUN npm ci --only=production --break-system-packages

# Stage 3: Runtime
FROM node:18-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init postgresql-client curl

# Copy built frontend from stage 1
COPY --from=frontend-builder /build/dist ./dist

# Copy backend code and dependencies from stage 2
COPY --from=backend-builder /build/api ./api
COPY --from=backend-builder /build/node_modules ./node_modules
COPY --from=backend-builder /build/sql ./sql

# Copy essential files
COPY package.json server.js .env* ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/api/health || exit 1

# Expose port
EXPOSE ${PORT:-3000}

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start server
CMD ["node", "server.js"]
