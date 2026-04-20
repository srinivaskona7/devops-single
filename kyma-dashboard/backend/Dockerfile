# ── Stage 1: Install kubectl + helm ──────────────────────────────────────────
FROM node:20-alpine AS tools
ARG KUBECTL_VERSION=v1.29.0
ARG HELM_VERSION=v3.14.4
RUN apk add --no-cache curl \
  && curl -fsSL "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" \
       -o /usr/local/bin/kubectl && chmod +x /usr/local/bin/kubectl \
  && curl -fsSL "https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz" \
       | tar xz --strip-components=1 -C /usr/local/bin linux-amd64/helm

# ── Stage 2: Production dependencies ────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# ── Stage 3: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine

COPY --from=tools /usr/local/bin/kubectl /usr/local/bin/kubectl
COPY --from=tools /usr/local/bin/helm /usr/local/bin/helm

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY dist/ ./dist/

RUN mkdir -p /root/.kube /root/.helm

ENV NODE_ENV=production \
    PORT=8100 \
    DEV_SKIP_AUTH=true \
    LOG_LEVEL=info

EXPOSE 8100

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8100/health || exit 1

CMD ["node", "dist/index.js"]
