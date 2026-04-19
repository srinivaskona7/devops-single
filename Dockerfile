# ─── Stage 1: Install dependencies ───────────────────────
FROM node:20-alpine AS deps
WORKDIR /deps
COPY proxy/package.json ./
RUN npm install --omit=dev --registry https://registry.npmjs.org \
    && npm cache clean --force \
    && rm -rf /root/.npm /tmp/*

# ─── Stage 2: Minify static assets ──────────────────────
FROM node:20-alpine AS minify
WORKDIR /src
COPY css/ ./css/
COPY js/ ./js/
COPY index.html ./
# Inline minification: strip comments, collapse whitespace in CSS/JS
RUN apk add --no-cache findutils \
    && find css/ -name '*.css' -exec sh -c 'sed -e "s|/\*[^*]*\*\+\([^/*][^*]*\*\+\)*/||g" -e "s/^[[:space:]]*//" -e "/^$/d" "$1" > "$1.min" && mv "$1.min" "$1"' _ {} \; \
    && find js/ -name '*.js' -exec sh -c 'sed -e "s|//[^'\''\"]*$||" -e "s/^[[:space:]]*//" -e "/^$/d" "$1" > "$1.min" && mv "$1.min" "$1"' _ {} \;

# ─── Stage 3: Final production image ────────────────────
FROM node:20-alpine

# tini for proper PID 1 signal handling (15KB)
RUN apk add --no-cache tini \
    && rm -rf /var/cache/apk/* /tmp/* /root/.cache

LABEL org.opencontainers.image.title="Cloud IDE" \
      org.opencontainers.image.description="Browser-based SSH IDE with 15 DevOps panels" \
      org.opencontainers.image.version="2.0.0"

WORKDIR /app

# Copy only production artifacts
COPY --from=deps /deps/node_modules ./proxy/node_modules
COPY --from=minify /src/index.html ./
COPY --from=minify /src/css/ ./css/
COPY --from=minify /src/js/ ./js/
COPY proxy/server.js proxy/package.json ./proxy/

# Non-root user (node uid=1000 already exists in alpine)
RUN chown -R node:node /app \
    && mkdir -p /app/data /app/templates \
    && chown -R node:node /app/data /app/templates

ENV PORT=3456 \
    STATIC_DIR=/app \
    NODE_ENV=production \
    UV_THREADPOOL_SIZE=16 \
    NODE_OPTIONS="--max-old-space-size=256 --max-semi-space-size=32"

EXPOSE 3456

VOLUME ["/app/data", "/app/templates"]

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3456/health || exit 1

STOPSIGNAL SIGTERM

USER node

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "proxy/server.js"]
