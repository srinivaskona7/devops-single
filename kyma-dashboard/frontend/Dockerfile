# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY . .
ENV VITE_SKIP_AUTH=true
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Copy built SPA
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config template — BACKEND_URL substituted at container startup
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Entrypoint: runs envsubst then starts nginx
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh \
  && chown -R nginx:nginx /usr/share/nginx/html

# Default backend URL (override at runtime via env var)
ENV BACKEND_URL=backend:8100

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
