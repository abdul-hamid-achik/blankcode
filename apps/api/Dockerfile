# Stage 1: Dependencies
FROM oven/bun:1 AS deps

# Install build essentials (git for lefthook, python/make for native modules like bcrypt)
RUN apt-get update && \
    apt-get install -y --no-install-recommends git python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all package.json files for workspace resolution
COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/exercise-parser/package.json ./packages/exercise-parser/
COPY tools/content-importer/package.json ./tools/content-importer/
COPY tools/exercise-generator/package.json ./tools/exercise-generator/

# Initialize a git repo for lefthook (it expects to be in a git repo)
RUN git init

# Install all dependencies
RUN bun install --frozen-lockfile

# Stage 2: Builder
FROM deps AS builder

# Copy source code
COPY apps/api ./apps/api
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./

# Build API with Turbo (handles dependency order)
RUN bunx turbo build --filter=@blankcode/api

# Stage 3: Runner
FROM oven/bun:1-debian AS runner

# Install Docker CLI for code execution
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
    chmod a+r /etc/apt/keyrings/docker.asc && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends docker-ce-cli && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root node_modules (includes .bun cache with all packages)
COPY --from=deps /app/node_modules ./node_modules

# Copy workspace node_modules (contains symlinks to .bun cache)
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy built artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy package.json files for module resolution
COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Use existing bun user
USER bun

ENV NODE_ENV=production
ENV API_PORT=3000
ENV API_HOST=0.0.0.0

EXPOSE 3000

CMD ["bun", "run", "apps/api/dist/main.js"]
