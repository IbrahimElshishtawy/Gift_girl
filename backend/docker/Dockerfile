# Multi-stage Dockerfile for NestJS backend application

# --- Stage 1: Build ---
FROM node:24-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies including devDependencies for build
RUN npm ci

# Copy source code and config
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN npm run build

# --- Stage 2: Production Dependencies ---
FROM node:24-alpine AS production-deps

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --only=production
RUN npx prisma generate

# --- Stage 3: Runtime ---
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy node_modules from production-deps stage
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/prisma ./prisma
# Copy dist from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

USER node

CMD ["node", "dist/src/main"]
