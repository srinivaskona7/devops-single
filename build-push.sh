#!/bin/bash
set -e

# Cloud IDE — Build, Push & Run Script
# Repo: sriniv7654/devops-single
# Tags: cloud-ide, kyma-backend, kyma-frontend

REPO="sriniv7654/devops-single"
VERSION="${1:-latest}"

echo "========================================"
echo "  Cloud IDE — Build & Push"
echo "  Repo: ${REPO}"
echo "  Version: ${VERSION}"
echo "========================================"

# Check docker login
if ! docker info 2>/dev/null | grep -q "Username"; then
  echo ">>> Docker login required"
  docker login
fi

# ─── Build Cloud IDE ────────────────────────────
echo ""
echo ">>> [1/3] Building Cloud IDE image..."
docker build -t "${REPO}:cloud-ide-${VERSION}" -t "${REPO}:cloud-ide" .
echo "BUILT: ${REPO}:cloud-ide-${VERSION}"

# ─── Push all tags ──────────────────────────────
echo ""
echo ">>> [2/3] Pushing images..."
docker push "${REPO}:cloud-ide-${VERSION}"
docker push "${REPO}:cloud-ide"
echo "PUSHED: ${REPO}:cloud-ide-${VERSION}"
echo "PUSHED: ${REPO}:cloud-ide"

# ─── Tag Kyma images to single repo ────────────
echo ""
echo ">>> [3/3] Pulling & re-tagging Kyma images..."

docker pull sriniv7654/kyma-dashboard-backend:latest
docker pull sriniv7654/kyma-dashboard-frontend:latest

docker tag sriniv7654/kyma-dashboard-backend:latest "${REPO}:kyma-backend-${VERSION}"
docker tag sriniv7654/kyma-dashboard-backend:latest "${REPO}:kyma-backend"
docker tag sriniv7654/kyma-dashboard-frontend:latest "${REPO}:kyma-frontend-${VERSION}"
docker tag sriniv7654/kyma-dashboard-frontend:latest "${REPO}:kyma-frontend"

docker push "${REPO}:kyma-backend-${VERSION}"
docker push "${REPO}:kyma-backend"
docker push "${REPO}:kyma-frontend-${VERSION}"
docker push "${REPO}:kyma-frontend"

echo "PUSHED: ${REPO}:kyma-backend-${VERSION}"
echo "PUSHED: ${REPO}:kyma-frontend-${VERSION}"

# ─── Verify ─────────────────────────────────────
echo ""
echo ">>> Verifying pushed images..."
echo ""
echo "Images in ${REPO}:"
echo "  ${REPO}:cloud-ide-${VERSION}"
echo "  ${REPO}:cloud-ide"
echo "  ${REPO}:kyma-backend-${VERSION}"
echo "  ${REPO}:kyma-backend"
echo "  ${REPO}:kyma-frontend-${VERSION}"
echo "  ${REPO}:kyma-frontend"

echo ""
echo "========================================"
echo "  BUILD & PUSH COMPLETE"
echo "========================================"
echo ""
echo "To run on any server:"
echo "  docker run -d -p 3456:3456 ${REPO}:cloud-ide-${VERSION}"
echo ""
echo "To run full stack (IDE + Kyma Dashboard):"
echo "  IMAGE_TAG=${VERSION} docker compose up -d"
echo ""
echo "To deploy on EC2:"
echo "  IMAGE_TAG=${VERSION} ./deploy-ec2.sh"
