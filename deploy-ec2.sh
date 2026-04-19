#!/bin/bash
set -e

# Cloud IDE + Kyma Dashboard — EC2 Deployment Script (idempotent)
# Usage: curl -sSL https://your-repo/deploy-ec2.sh | bash

APP_NAME="cloud-ide"
PORT="${PORT:-3456}"
DATA_DIR="${DATA_DIR:-/opt/cloud-ide/data}"
TEMPLATE_DIR="${TEMPLATE_DIR:-/opt/cloud-ide/templates}"

echo "========================================"
echo "  Cloud IDE + Kyma Dashboard — EC2 Deploy"
echo "========================================"

# Install Docker if not present
if ! command -v docker &>/dev/null; then
  echo ">>> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo systemctl enable docker && sudo systemctl start docker
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  echo "CONFIGURED: Docker installed"
else
  echo "NO CHANGES: Docker $(docker --version | awk '{print $3}')"
fi

# Install Docker Compose plugin
if ! docker compose version &>/dev/null; then
  echo ">>> Installing Docker Compose..."
  ARCH=$(uname -m | sed 's/x86_64/x86_64/;s/aarch64/aarch64/')
  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  sudo curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${ARCH}" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  echo "CONFIGURED: Docker Compose installed"
else
  echo "NO CHANGES: Docker Compose installed"
fi

# Create directories
sudo mkdir -p "$DATA_DIR" "$TEMPLATE_DIR"
sudo chown -R 1000:1000 "$DATA_DIR" "$TEMPLATE_DIR"

# Stop existing containers
echo ">>> Stopping existing containers..."
docker compose down 2>/dev/null || true
docker stop cloud-ide kyma-manager-backend kyma-manager-frontend 2>/dev/null || true
docker rm cloud-ide kyma-manager-backend kyma-manager-frontend 2>/dev/null || true

# Pull images from single repo
REPO="sriniv7654/devops-single"
TAG="${IMAGE_TAG:-latest}"
echo ">>> Pulling images from ${REPO}..."
docker pull "${REPO}:cloud-ide-${TAG}"
docker pull "${REPO}:kyma-backend-${TAG}"
docker pull "${REPO}:kyma-frontend-${TAG}"

# Build Cloud IDE if Dockerfile exists and no pre-built image
if [ -f "Dockerfile" ] && ! docker image inspect "${REPO}:cloud-ide-${TAG}" >/dev/null 2>&1; then
  echo ">>> Building Cloud IDE image..."
  docker build -t "${REPO}:cloud-ide-${TAG}" .
fi

# Start all services
echo ">>> Starting services..."
IMAGE_TAG="${TAG}" KUBECONFIG_PATH="${KUBECONFIG_PATH:-$HOME/.kube/config}" docker compose up -d

# Wait for health
echo ">>> Waiting for health checks..."
for i in $(seq 1 20); do
  IDE_OK=$(curl -sf "http://localhost:${PORT}/health" 2>/dev/null && echo "yes" || echo "no")
  DASH_OK=$(curl -sf "http://localhost:8100/health" 2>/dev/null && echo "yes" || echo "no")
  if [ "$IDE_OK" = "yes" ] && [ "$DASH_OK" = "yes" ]; then
    IP=$(curl -sf http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || hostname -I | awk '{print $1}')
    echo ""
    echo "========================================"
    echo "  DEPLOYED SUCCESSFULLY"
    echo "========================================"
    echo "  Cloud IDE:      http://${IP}:${PORT}"
    echo "  Kyma Dashboard: http://${IP}:3000"
    echo "  Kyma API:       http://${IP}:8100"
    echo "  Login:          admin / sri@123"
    echo "  Data:           ${DATA_DIR}"
    echo "========================================"
    exit 0
  fi
  sleep 3
  printf "."
done

echo ""
echo "WARNING: Not all services healthy after 60s"
docker compose ps
docker compose logs --tail 10
exit 1
