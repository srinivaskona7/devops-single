#!/bin/bash
set -e

# ╔══════════════════════════════════════════════════════════════╗
# ║  Cloud IDE + Kyma Dashboard — Full Deploy Script             ║
# ║                                                              ║
# ║  Clones repo, builds images, pushes to Docker Hub,           ║
# ║  deploys containers with volumes, OIDC support,              ║
# ║  and kubeconfig upload                                       ║
# ║                                                              ║
# ║  Usage: ./deploy.sh [--tag=v1] [--port=8101]                 ║
# ╚══════════════════════════════════════════════════════════════╝

# ─── Configuration ─────────────────────────────────────────
DOCKER_USER="sriniv7654"
REPO="${DOCKER_USER}/devops-single"
GIT_REPO="https://github.com/srinivaskona7/devops-single.git"
TAG="${IMAGE_TAG:-latest}"
INSTALL_DIR="${INSTALL_DIR:-/opt/cloud-ide}"
IDE_PORT="${IDE_PORT:-8101}"
KYMA_API_PORT="${KYMA_API_PORT:-8100}"
KYMA_UI_PORT="${KYMA_UI_PORT:-3000}"
KUBECONFIG_DIR="${INSTALL_DIR}/kubeconfigs"
DATA_DIR="${INSTALL_DIR}/data"

# ─── Colors ────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'; DIM='\033[2m'

log()        { echo -e "${GREEN}[✓]${NC} $1"; }
warn()       { echo -e "${YELLOW}[!]${NC} $1"; }
err()        { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()       { echo -e "${CYAN}[→]${NC} $1"; }
configured() { echo -e "${GREEN}  CONFIGURED:${NC} $1"; }
no_change()  { echo -e "${DIM}  NO CHANGES:${NC} $1"; }

# ─── Parse args ────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --tag=*)         TAG="${arg#*=}" ;;
    --port=*)        IDE_PORT="${arg#*=}" ;;
    --repo=*)        REPO="${arg#*=}" ;;
    --user=*)        DOCKER_USER="${arg#*=}" ;;
    --install-dir=*) INSTALL_DIR="${arg#*=}" ;;
    --help|-h)
      echo "Usage: deploy.sh [OPTIONS]"
      echo ""
      echo "  --tag=VERSION      Image tag (default: latest)"
      echo "  --port=PORT        IDE port (default: 8101)"
      echo "  --repo=REPO        Docker Hub repo (default: sriniv7654/devops-single)"
      echo "  --user=USER        Docker Hub username (default: sriniv7654)"
      echo "  --install-dir=PATH Install directory (default: /opt/cloud-ide)"
      exit 0 ;;
  esac
done

# ─── Header ────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     Cloud IDE + Kyma Dashboard — Full Deploy Pipeline       ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║  Repo:  ${CYAN}${REPO}:${TAG}${NC}"
echo -e "${BOLD}║  IDE:   ${CYAN}:${IDE_PORT}${NC}  Kyma: ${CYAN}:${KYMA_API_PORT}/${KYMA_UI_PORT}${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Step 1: Clone / Update Repository ────────────────────
echo -e "${BOLD}━━━ Step 1/7: Clone Repository ━━━${NC}"
echo ""

if [ -d "${INSTALL_DIR}/.git" ]; then
  cd "${INSTALL_DIR}"
  OLD_HEAD=$(git rev-parse HEAD 2>/dev/null)
  git pull --ff-only 2>/dev/null || git pull
  NEW_HEAD=$(git rev-parse HEAD 2>/dev/null)
  if [ "$OLD_HEAD" = "$NEW_HEAD" ]; then
    no_change "Repository already at latest (${NEW_HEAD:0:8})"
  else
    configured "Updated ${OLD_HEAD:0:8} → ${NEW_HEAD:0:8}"
  fi
else
  mkdir -p "$(dirname "${INSTALL_DIR}")" 2>/dev/null || true
  git clone "${GIT_REPO}" "${INSTALL_DIR}"
  cd "${INSTALL_DIR}"
  configured "Cloned to ${INSTALL_DIR}"
fi
echo ""

# ─── Step 2: Docker Hub Login ─────────────────────────────
echo -e "${BOLD}━━━ Step 2/7: Docker Hub Login ━━━${NC}"
echo ""

if docker info 2>/dev/null | grep -q "Username: ${DOCKER_USER}"; then
  no_change "Already logged in as ${DOCKER_USER}"
else
  info "Login to Docker Hub as ${DOCKER_USER}"
  echo -e "  ${YELLOW}Enter Docker Hub password:${NC}"
  docker login -u "${DOCKER_USER}"
fi
echo ""

# ─── Step 3: Build Images ─────────────────────────────────
echo -e "${BOLD}━━━ Step 3/7: Build Docker Images ━━━${NC}"
echo ""

# Build Cloud IDE
info "Building Cloud IDE image..."
docker build --no-cache \
  -t "${REPO}:cloud-ide-${TAG}" \
  -t "${REPO}:cloud-ide" \
  -f Dockerfile . 2>&1 | tail -5
configured "Cloud IDE image → ${REPO}:cloud-ide-${TAG}"
echo ""

# Build Kyma Backend
if [ -d "kyma-dashboard/backend" ]; then
  info "Building Kyma Backend image (DEV_SKIP_AUTH=true)..."
  cd kyma-dashboard
  docker build --no-cache \
    -t "${REPO}:kyma-backend-${TAG}" \
    -t "${REPO}:kyma-backend" \
    -f backend/Dockerfile . 2>&1 | tail -5
  configured "Kyma Backend image → ${REPO}:kyma-backend-${TAG}"
  echo ""

  # Build Kyma Frontend
  info "Building Kyma Frontend image (VITE_SKIP_AUTH=true)..."
  docker build --no-cache \
    -t "${REPO}:kyma-frontend-${TAG}" \
    -t "${REPO}:kyma-frontend" \
    -f frontend/Dockerfile . 2>&1 | tail -5
  configured "Kyma Frontend image → ${REPO}:kyma-frontend-${TAG}"
  cd ..
else
  warn "kyma-dashboard/ not found — pulling pre-built images"
  docker pull "${REPO}:kyma-backend-${TAG}" 2>/dev/null || docker pull "${REPO}:kyma-backend" 2>/dev/null || true
  docker pull "${REPO}:kyma-frontend-${TAG}" 2>/dev/null || docker pull "${REPO}:kyma-frontend" 2>/dev/null || true
fi
echo ""

# ─── Step 4: Push Images to Docker Hub ────────────────────
echo -e "${BOLD}━━━ Step 4/7: Push Images to Docker Hub ━━━${NC}"
echo ""

info "Pushing Cloud IDE..."
docker push "${REPO}:cloud-ide-${TAG}"
docker push "${REPO}:cloud-ide"
configured "Pushed ${REPO}:cloud-ide-${TAG}"

if docker image inspect "${REPO}:kyma-backend-${TAG}" &>/dev/null; then
  info "Pushing Kyma Backend..."
  docker push "${REPO}:kyma-backend-${TAG}"
  docker push "${REPO}:kyma-backend"
  configured "Pushed ${REPO}:kyma-backend-${TAG}"

  info "Pushing Kyma Frontend..."
  docker push "${REPO}:kyma-frontend-${TAG}"
  docker push "${REPO}:kyma-frontend"
  configured "Pushed ${REPO}:kyma-frontend-${TAG}"
fi
echo ""

# ─── Step 5: Kubeconfig Setup ─────────────────────────────
echo -e "${BOLD}━━━ Step 5/7: Kubeconfig Setup ━━━${NC}"
echo ""

mkdir -p "${KUBECONFIG_DIR}"
mkdir -p "${DATA_DIR}"

# Check existing kubeconfigs
EXISTING_KUBECONFIGS=$(find "${KUBECONFIG_DIR}" -name "*.yaml" -o -name "*.yml" -o -name "config" 2>/dev/null | wc -l | tr -d ' ')

if [ "$EXISTING_KUBECONFIGS" -gt 0 ]; then
  log "Found ${EXISTING_KUBECONFIGS} kubeconfig(s) in ${KUBECONFIG_DIR}/"
  find "${KUBECONFIG_DIR}" -name "*.yaml" -o -name "*.yml" -o -name "config" 2>/dev/null | while read -r f; do
    echo -e "    ${CYAN}$(basename "$f")${NC}"
  done
else
  # Check default locations
  if [ -f "$HOME/.kube/config" ]; then
    cp "$HOME/.kube/config" "${KUBECONFIG_DIR}/default.yaml"
    configured "Copied ~/.kube/config → ${KUBECONFIG_DIR}/default.yaml"
  fi
fi

echo ""
echo -e "  ${BOLD}Upload a kubeconfig file?${NC}"
echo -e "  ${DIM}(Paste full path or drag file here, or press Enter to skip)${NC}"
read -rp "  Kubeconfig path: " KUBE_UPLOAD

if [ -n "$KUBE_UPLOAD" ] && [ -f "$KUBE_UPLOAD" ]; then
  KUBE_NAME=$(basename "$KUBE_UPLOAD")
  cp "$KUBE_UPLOAD" "${KUBECONFIG_DIR}/${KUBE_NAME}"
  configured "Uploaded ${KUBE_NAME} to ${KUBECONFIG_DIR}/"
elif [ -n "$KUBE_UPLOAD" ]; then
  warn "File not found: ${KUBE_UPLOAD}"
fi

# Determine active kubeconfig
ACTIVE_KUBECONFIG=""
if [ -f "${KUBECONFIG_DIR}/default.yaml" ]; then
  ACTIVE_KUBECONFIG="${KUBECONFIG_DIR}/default.yaml"
elif [ -f "${KUBECONFIG_DIR}/kubeconfig-token.yaml" ]; then
  ACTIVE_KUBECONFIG="${KUBECONFIG_DIR}/kubeconfig-token.yaml"
else
  ACTIVE_KUBECONFIG=$(find "${KUBECONFIG_DIR}" -name "*.yaml" -o -name "*.yml" 2>/dev/null | head -1)
fi

if [ -n "$ACTIVE_KUBECONFIG" ]; then
  log "Active kubeconfig: $(basename "$ACTIVE_KUBECONFIG")"
else
  warn "No kubeconfig found — Kyma Dashboard will run without cluster access"
  ACTIVE_KUBECONFIG="/dev/null"
fi
echo ""

# ─── Step 6: Deploy Containers ────────────────────────────
echo -e "${BOLD}━━━ Step 6/7: Deploy Containers (pull latest) ━━━${NC}"
echo ""

# Stop existing
info "Stopping existing containers..."
docker stop cloud-ide kyma-manager-backend kyma-manager-frontend 2>/dev/null || true
docker rm cloud-ide kyma-manager-backend kyma-manager-frontend 2>/dev/null || true

# Always pull latest
info "Pulling latest images..."
docker pull "${REPO}:cloud-ide-${TAG}" 2>/dev/null || true
docker pull "${REPO}:kyma-backend-${TAG}" 2>/dev/null || true
docker pull "${REPO}:kyma-frontend-${TAG}" 2>/dev/null || true

# Deploy Cloud IDE (native mode preferred, Docker fallback)
if command -v node &>/dev/null && [ -f "${INSTALL_DIR}/proxy/server.js" ]; then
  info "Starting Cloud IDE natively (Node.js)..."

  cd "${INSTALL_DIR}/proxy"
  [ -d node_modules ] || npm install --omit=dev

  # Create/update systemd service
  cat > /etc/systemd/system/cloud-ide-proxy.service <<UNIT
[Unit]
Description=Cloud IDE SSH Proxy
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
Environment=PORT=${IDE_PORT}
Environment=STATIC_DIR=${INSTALL_DIR}
Environment=NODE_ENV=production
ExecStart=$(command -v node) ${INSTALL_DIR}/proxy/server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable cloud-ide-proxy 2>/dev/null
  systemctl restart cloud-ide-proxy
  configured "Cloud IDE proxy (native) on port ${IDE_PORT}"
else
  info "Starting Cloud IDE container..."
  docker run -d --name cloud-ide \
    --network host \
    -e "PORT=${IDE_PORT}" \
    -e NODE_ENV=production \
    -v "${DATA_DIR}:/app/data" \
    -v "${KUBECONFIG_DIR}:/app/.kube:ro" \
    --restart unless-stopped \
    "${REPO}:cloud-ide-${TAG}"
  configured "Cloud IDE container on port ${IDE_PORT}"
fi

# Deploy Kyma Backend
info "Starting Kyma Backend..."
docker run -d --name kyma-manager-backend \
  -p "${KYMA_API_PORT}:8100" \
  -e NODE_ENV=production \
  -e PORT=8100 \
  -e DEV_SKIP_AUTH=true \
  -e "SESSION_SECRET=${SESSION_SECRET:-cloud-ide-kyma-session-$(openssl rand -hex 16 2>/dev/null || echo 'default-secret-32chars!!')}" \
  -e "KUBECONFIG=/kubeconfig/config.yaml" \
  -e "GEN_DIR=/app/generated" \
  -v "${ACTIVE_KUBECONFIG}:/kubeconfig/config.yaml:ro" \
  -v "${KUBECONFIG_DIR}:/app/kubeconfigs:ro" \
  -v kyma-generated:/app/generated \
  --restart unless-stopped \
  "${REPO}:kyma-backend-${TAG}"
configured "Kyma Backend on port ${KYMA_API_PORT}"

# Deploy Kyma Frontend
info "Starting Kyma Frontend..."
docker run -d --name kyma-manager-frontend \
  -p "${KYMA_UI_PORT}:80" \
  -e "BACKEND_URL=kyma-manager-backend:8100" \
  --link kyma-manager-backend \
  --restart unless-stopped \
  "${REPO}:kyma-frontend-${TAG}"
configured "Kyma Frontend on port ${KYMA_UI_PORT}"
echo ""

# ─── Step 7: Health Check & Summary ──────────────────────
echo -e "${BOLD}━━━ Step 7/7: Health Check & Summary ━━━${NC}"
echo ""

# Health checks
check_health() {
  local url="$1" name="$2"
  for i in $(seq 1 15); do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo -e "  ${GREEN}●${NC} ${name}"
      return 0
    fi
    sleep 2
    printf "."
  done
  echo ""
  echo -e "  ${RED}○${NC} ${name} — not responding"
  return 1
}

info "Checking services..."
echo ""
check_health "http://localhost:${IDE_PORT}/health" "Cloud IDE        → :${IDE_PORT}"
check_health "http://localhost:${KYMA_API_PORT}/health" "Kyma Backend     → :${KYMA_API_PORT}"
check_health "http://localhost:${KYMA_UI_PORT}/health" "Kyma Frontend    → :${KYMA_UI_PORT}"

# Get public IP
TOKEN=$(curl -sf -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null)
IP=$(curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null \
  || curl -sf http://checkip.amazonaws.com 2>/dev/null \
  || curl -sf http://ifconfig.me 2>/dev/null \
  || hostname -I 2>/dev/null | awk '{print $1}' \
  || echo "localhost")

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                   DEPLOY COMPLETE                            ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║                                                              ║${NC}"
echo -e "${BOLD}║  ${GREEN}Cloud IDE${NC}        ${CYAN}http://${IP}:${IDE_PORT}${NC}"
echo -e "${BOLD}║  ${GREEN}Kyma Dashboard${NC}   ${CYAN}http://${IP}:${KYMA_UI_PORT}${NC}"
echo -e "${BOLD}║  ${GREEN}Kyma API${NC}         ${CYAN}http://${IP}:${KYMA_API_PORT}${NC}"
echo -e "${BOLD}║                                                              ║${NC}"
echo -e "${BOLD}║  ${DIM}Login: admin / sri@123${NC}"
echo -e "${BOLD}║  ${DIM}Docker Hub: ${REPO}:${TAG}${NC}"
echo -e "${BOLD}║  ${DIM}Kubeconfig: ${ACTIVE_KUBECONFIG:-none}${NC}"
echo -e "${BOLD}║                                                              ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║  Images pushed:                                              ║${NC}"
echo -e "${BOLD}║    ${CYAN}${REPO}:cloud-ide-${TAG}${NC}"
echo -e "${BOLD}║    ${CYAN}${REPO}:kyma-backend-${TAG}${NC}"
echo -e "${BOLD}║    ${CYAN}${REPO}:kyma-frontend-${TAG}${NC}"
echo -e "${BOLD}║                                                              ║${NC}"
echo -e "${BOLD}║  Volumes:                                                    ║${NC}"
echo -e "${BOLD}║    ${DIM}${DATA_DIR} → /app/data${NC}"
echo -e "${BOLD}║    ${DIM}${KUBECONFIG_DIR} → /app/kubeconfigs${NC}"
echo -e "${BOLD}║    ${DIM}kyma-generated → /app/generated${NC}"
echo -e "${BOLD}║                                                              ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Cleanup ──────────────────────────────────────────────
info "Cleaning up build cache..."
docker image prune -f 2>/dev/null || true
docker builder prune -f 2>/dev/null || true

echo ""
log "Deploy pipeline complete"
echo ""
echo -e "${BOLD}Commands:${NC}"
echo -e "  ${CYAN}Logs:${NC}      docker logs -f kyma-manager-backend"
echo -e "  ${CYAN}Status:${NC}    docker ps"
echo -e "  ${CYAN}Restart:${NC}   systemctl restart cloud-ide-proxy"
echo -e "  ${CYAN}Update:${NC}    cd ${INSTALL_DIR} && git pull && ./deploy.sh"
echo -e "  ${CYAN}Kubeconfig:${NC} cp /path/to/kubeconfig.yaml ${KUBECONFIG_DIR}/"
echo ""
