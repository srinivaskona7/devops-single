#!/bin/bash
set -e

# ╔══════════════════════════════════════════════════════════════╗
# ║  Kyma Dashboard — Build with Auth Bypass                     ║
# ║  Builds frontend & backend images with DEV_SKIP_AUTH=true    ║
# ╚══════════════════════════════════════════════════════════════╝

REPO="sriniv7654/devops-single"
TAG="${1:-latest}"
DASHBOARD_SRC="${DASHBOARD_SRC:-/tmp/kyma-dashboard-src}"
GIT_DASHBOARD="https://github.com/srinivaskona7/devops-single.git"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Kyma Dashboard — Build (Auth Bypass Mode)      ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Build Backend ─────────────────────────────────────────
info "Building Kyma Backend with DEV_SKIP_AUTH..."

cat > /tmp/Dockerfile.kyma-backend <<'DOCKERFILE'
FROM node:20-alpine

RUN apk add --no-cache curl bash \
    && curl -LO "https://dl.k8s.io/release/v1.29.0/bin/linux/amd64/kubectl" \
    && install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl \
    && rm kubectl \
    && curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./

ENV PORT=8100 \
    NODE_ENV=production \
    DEV_SKIP_AUTH=true

EXPOSE 8100

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8100/health || exit 1

CMD ["node", "src/index.js"]
DOCKERFILE

# ─── Build Frontend ────────────────────────────────────────
info "Building Kyma Frontend with VITE_SKIP_AUTH..."

cat > /tmp/Dockerfile.kyma-frontend <<'DOCKERFILE'
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
ENV VITE_SKIP_AUTH=true
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template

ENV BACKEND_URL=localhost:8100

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
DOCKERFILE

# ─── Clone Source ──────────────────────────────────────────
if [ -d "${DASHBOARD_SRC}" ] && [ -f "${DASHBOARD_SRC}/backend/package.json" ]; then
  info "Using existing source at ${DASHBOARD_SRC}"
  cd "${DASHBOARD_SRC}"
  git pull 2>/dev/null || true
else
  info "Cloning Kyma Dashboard source..."
  rm -rf "${DASHBOARD_SRC}"
  git clone https://github.com/srinivaskona7/kyma-dashboard.git "${DASHBOARD_SRC}" 2>/dev/null \
    || git clone https://github.com/srinivaskona7/devops-single.git "${DASHBOARD_SRC}" 2>/dev/null \
    || { err "Failed to clone dashboard source"; exit 1; }
  cd "${DASHBOARD_SRC}"
fi

# Check if dashboard source structure exists
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
  err "Dashboard source not found. Expected backend/ and frontend/ directories."
  err "Set DASHBOARD_SRC to the path containing the Kyma dashboard source"
  exit 1
fi

# ─── Build Images ──────────────────────────────────────────
info "Building backend image..."
docker build -f /tmp/Dockerfile.kyma-backend -t "${REPO}:kyma-backend-${TAG}" .
log "Backend image built: ${REPO}:kyma-backend-${TAG}"

info "Building frontend image..."
docker build -f /tmp/Dockerfile.kyma-frontend -t "${REPO}:kyma-frontend-${TAG}" .
log "Frontend image built: ${REPO}:kyma-frontend-${TAG}"

# ─── Push (optional) ──────────────────────────────────────
echo ""
read -rp "Push images to Docker Hub? (yes/no): " PUSH_CHOICE
if [ "$PUSH_CHOICE" = "yes" ]; then
  info "Pushing to Docker Hub..."
  docker push "${REPO}:kyma-backend-${TAG}"
  docker push "${REPO}:kyma-frontend-${TAG}"
  log "Images pushed to Docker Hub"
fi

# ─── Restart Containers ───────────────────────────────────
echo ""
read -rp "Restart Kyma containers with new images? (yes/no): " RESTART_CHOICE
if [ "$RESTART_CHOICE" = "yes" ]; then
  info "Stopping existing containers..."
  docker stop kyma-manager-backend kyma-manager-frontend 2>/dev/null || true
  docker rm kyma-manager-backend kyma-manager-frontend 2>/dev/null || true

  info "Starting Kyma Backend..."
  docker run -d --name kyma-manager-backend \
    -p 8100:8100 \
    -e NODE_ENV=production \
    -e PORT=8100 \
    -e DEV_SKIP_AUTH=true \
    -e "SESSION_SECRET=cloud-ide-kyma-session-secret-32ch!!" \
    -v "${HOME}/.kube/config:/kubeconfig/config.yaml:ro" \
    --restart unless-stopped \
    "${REPO}:kyma-backend-${TAG}"

  info "Starting Kyma Frontend..."
  docker run -d --name kyma-manager-frontend \
    -p 3000:80 \
    -e "BACKEND_URL=kyma-manager-backend:8100" \
    --link kyma-manager-backend \
    --restart unless-stopped \
    "${REPO}:kyma-frontend-${TAG}"

  sleep 5
  log "Kyma Dashboard running at http://localhost:3000"
fi

# ─── Cleanup ──────────────────────────────────────────────
rm -f /tmp/Dockerfile.kyma-backend /tmp/Dockerfile.kyma-frontend

echo ""
log "Build complete"
echo ""
