# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy all package.json files for lockfile consistency
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/exercise-parser/package.json ./packages/exercise-parser/
COPY tools/content-importer/package.json ./tools/content-importer/
COPY tools/exercise-generator/package.json ./tools/exercise-generator/

# Install dependencies (ignore scripts to skip lefthook which needs git)
RUN bun install --frozen-lockfile --ignore-scripts

# Copy turbo config and source code needed for web
COPY turbo.json ./
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./

# Build shared package first with Turbo
RUN bunx turbo build --filter=@blankcode/shared

# Build web app (skip vue-tsc in Docker, types verified in CI)
WORKDIR /app/apps/web
RUN ./node_modules/.bin/vite build

# Production stage with nginx
FROM nginx:alpine AS runner

# Copy nginx config
COPY apps/web/nginx.conf /etc/nginx/nginx.conf

# Copy built files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Create non-root user
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
