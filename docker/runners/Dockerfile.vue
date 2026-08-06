FROM node:22-alpine

# Install dependencies in a temp dir, then move node_modules to root
# Node.js resolution from /app/ walks up and finds /node_modules/
#
# Vue exercises come in two shapes and both must run here:
#   - `.vue` single-file components mounted with @vue/test-utils, which need
#     the SFC compiler plus the Vite plugin that drives it from vitest
#   - `.ts` composables / Pinia stores, which need `vue` and `pinia` at runtime
# jsdom backs every mount(); without it `document` is undefined.
RUN mkdir -p /tmp/deps && cd /tmp/deps && npm init -y && \
    npm install \
    vitest typescript @types/node \
    vue @vue/test-utils @vue/compiler-sfc @vitejs/plugin-vue \
    pinia jsdom && \
    mv /tmp/deps/node_modules /node_modules && \
    rm -rf /tmp/deps

ENV PATH="/node_modules/.bin:$PATH"

WORKDIR /app

# Create non-root user for security
RUN adduser -D -u 10000 runner
USER runner

CMD ["vitest", "run"]
