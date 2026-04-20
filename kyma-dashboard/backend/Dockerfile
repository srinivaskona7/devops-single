# ── Stage 1: Download kubectl + helm ─────────────────────────────────────────
FROM node:20-alpine AS tools
ARG KUBECTL_VERSION=v1.29.0
ARG HELM_VERSION=v3.14.4
ARG TARGETARCH=amd64
RUN apk add --no-cache curl ca-certificates \
  && curl -fsSL "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${TARGETARCH}/kubectl" \
       -o /usr/local/bin/kubectl \
  && chmod +x /usr/local/bin/kubectl \
  && curl -fsSL "https://get.helm.sh/helm-${HELM_VERSION}-linux-${TARGETARCH}.tar.gz" \
       | tar xz --strip-components=1 -C /usr/local/bin "linux-${TARGETARCH}/helm"

# ── Stage 2: Build frontend static assets ────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --legacy-peer-deps
COPY frontend/ ./
ENV VITE_SKIP_AUTH=true
RUN npm run build

# ── Stage 3: Compile TypeScript (all deps needed for tsc) ────────────────────
FROM node:20-alpine AS backend-builder
# kubectl + helm needed at runtime (both in dev and prod image)
COPY --from=tools /usr/local/bin/kubectl /usr/local/bin/kubectl
COPY --from=tools /usr/local/bin/helm    /usr/local/bin/helm
WORKDIR /build
COPY backend/package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install
COPY backend/ ./
# Compile TS; strip maps + declarations — not needed at runtime
RUN npx tsc \
  && find dist -name '*.map' -delete \
  && find dist -name '*.d.ts' -delete

# ── Stage 4: Production-only deps (no devDependencies) ───────────────────────
FROM node:20-alpine AS prod-deps
WORKDIR /build
COPY backend/package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev

# ── Stage 5: Minimal runtime image ───────────────────────────────────────────
FROM node:20-alpine AS runtime

# CLI tools from tiny alpine stage
COPY --from=tools /usr/local/bin/kubectl /usr/local/bin/kubectl
COPY --from=tools /usr/local/bin/helm    /usr/local/bin/helm

# Least-privilege user
RUN addgroup -S app && adduser -S -G app app

WORKDIR /app

# Compiled backend (no source, no maps, no type declarations)
COPY --chown=app:app --from=backend-builder /build/dist         ./dist
# Production node_modules only (no devDeps)
COPY --chown=app:app --from=prod-deps       /build/node_modules  ./node_modules
COPY --chown=app:app --from=backend-builder /build/package.json  ./package.json

# Frontend served as static files by backend (@fastify/static)
COPY --chown=app:app --from=frontend-builder /build/dist         ./frontend/dist

# Kube/Helm config dirs for the app user
RUN mkdir -p /home/app/.kube /home/app/.helm \
  && chown -R app:app /home/app

USER app

ENV NODE_ENV=production \
    PORT=8100 \
    DEV_SKIP_AUTH=true \
    LOG_LEVEL=info

EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8100/health || exit 1

CMD ["node", "dist/index.js"]
