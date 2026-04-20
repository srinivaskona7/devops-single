#!/bin/bash
set -e

# ╔══════════════════════════════════════════════════════════════╗
# ║  Cloud IDE — Interactive Installer & Manager                 ║
# ║  curl -sSL https://raw.githubusercontent.com/               ║
# ║    srinivaskona7/devops-single/main/install.sh | bash        ║
# ║  Interactive: ./install.sh                                   ║
# ╚══════════════════════════════════════════════════════════════╝

# ─── Constants ──────────────────────────────────────────────
REPO="sriniv7654/devops-single"
GIT_REPO="https://github.com/srinivaskona7/devops-single.git"
INSTALL_DIR="${INSTALL_DIR:-/opt/cloud-ide}"
IDE_PORT="${IDE_PORT:-8101}"
KYMA_API_PORT="${KYMA_API_PORT:-8100}"
KYMA_UI_PORT="${KYMA_UI_PORT:-3000}"
TAG="${IMAGE_TAG:-latest}"
SERVICE_NAME="cloud-ide-proxy"

# ─── Colors & Logging ──────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'; DIM='\033[2m'

log()        { echo -e "${GREEN}[✓]${NC} $1"; }
warn()       { echo -e "${YELLOW}[!]${NC} $1"; }
err()        { echo -e "${RED}[✗]${NC} $1"; }
info()       { echo -e "${CYAN}[→]${NC} $1"; }
configured() { echo -e "${GREEN}  CONFIGURED:${NC} $1"; }
no_change()  { echo -e "${DIM}  NO CHANGES:${NC} $1"; }
destroyed()  { echo -e "${RED}  DESTROYED:${NC}  $1"; }

# ─── State Detection ───────────────────────────────────────
state_check() {
  HAS_DOCKER="no";    command -v docker &>/dev/null && HAS_DOCKER="yes"
  HAS_COMPOSE="no";   docker compose version &>/dev/null 2>&1 && HAS_COMPOSE="yes"
  HAS_KUBECTL="no";   command -v kubectl &>/dev/null && HAS_KUBECTL="yes"
  HAS_HELM="no";      command -v helm &>/dev/null && HAS_HELM="yes"
  HAS_JQ="no";        command -v jq &>/dev/null && HAS_JQ="yes"
  HAS_AWS="no";       command -v aws &>/dev/null && HAS_AWS="yes"
  HAS_TERRAFORM="no"; command -v terraform &>/dev/null && HAS_TERRAFORM="yes"
  HAS_GIT="no";       command -v git &>/dev/null && HAS_GIT="yes"
  HAS_NODE="no";      command -v node &>/dev/null && HAS_NODE="yes"

  IDE_INSTALLED="no"
  IDE_RUNNING="no"
  [ -f "${INSTALL_DIR}/proxy/server.js" ] && IDE_INSTALLED="yes"
  if systemctl is-active "${SERVICE_NAME}" &>/dev/null 2>&1; then
    IDE_RUNNING="yes"
  elif pgrep -f "node.*proxy/server.js" &>/dev/null; then
    IDE_RUNNING="yes"
  fi

  KYMA_BACKEND_RUNNING="no"
  KYMA_FRONTEND_RUNNING="no"
  if [ "$HAS_DOCKER" = "yes" ]; then
    docker ps --format '{{.Names}}' 2>/dev/null | grep -q "kyma-manager-backend" && KYMA_BACKEND_RUNNING="yes" || true
    docker ps --format '{{.Names}}' 2>/dev/null | grep -q "kyma-manager-frontend" && KYMA_FRONTEND_RUNNING="yes" || true
  fi
}

# ─── OS Detection ──────────────────────────────────────────
detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
  elif command -v brew &>/dev/null; then
    OS="macos"
  else
    OS="unknown"
  fi
  ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')
}

# ─── Tool Installers ───────────────────────────────────────

install_git() {
  if command -v git &>/dev/null; then
    no_change "git $(git --version | awk '{print $3}')"
    return
  fi
  info "Installing git..."
  case $OS in
    ubuntu|debian) sudo apt-get install -y -qq git ;;
    centos|rhel|amzn|fedora) sudo yum install -y git ;;
    alpine) sudo apk add --no-cache git ;;
    macos) xcode-select --install 2>/dev/null || true ;;
  esac
  configured "git $(git --version 2>/dev/null | awk '{print $3}')"
}

install_docker() {
  if command -v docker &>/dev/null; then
    no_change "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
    return
  fi
  info "Installing Docker..."
  case $OS in
    ubuntu|debian)
      sudo apt-get update -qq
      sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release
      sudo install -m 0755 -d /etc/apt/keyrings
      curl -fsSL "https://download.docker.com/linux/${OS}/gpg" | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
      echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${OS} $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
      sudo apt-get update -qq
      sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      ;;
    amzn)
      sudo rm -f /etc/yum.repos.d/docker-ce.repo /etc/yum.repos.d/hashicorp.repo 2>/dev/null
      sudo yum install -y docker
      sudo systemctl enable docker && sudo systemctl start docker
      sudo usermod -aG docker "$USER" 2>/dev/null || true
      ;;
    centos|rhel)
      sudo yum install -y yum-utils
      sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
      sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      ;;
    fedora)
      sudo dnf -y install dnf-plugins-core
      sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
      sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      ;;
    alpine) sudo apk add --no-cache docker docker-cli-compose ;;
    macos)
      brew install --cask docker
      warn "Open Docker Desktop to complete setup"
      ;;
    *) curl -fsSL https://get.docker.com | sh ;;
  esac
  sudo systemctl enable docker 2>/dev/null && sudo systemctl start docker 2>/dev/null || true
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  configured "Docker $(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',')"
}

install_compose() {
  if docker compose version &>/dev/null; then
    no_change "Docker Compose $(docker compose version --short 2>/dev/null)"
    return
  fi
  info "Installing Docker Compose..."
  sudo mkdir -p /usr/local/lib/docker/cli-plugins /usr/libexec/docker/cli-plugins
  COMPOSE_ARCH=$(uname -m)
  sudo curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${COMPOSE_ARCH}" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  sudo cp /usr/local/lib/docker/cli-plugins/docker-compose /usr/libexec/docker/cli-plugins/docker-compose 2>/dev/null || true
  sudo ln -sf /usr/local/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose 2>/dev/null || true
  configured "Docker Compose $(docker compose version --short 2>/dev/null)"
}

install_kubectl() {
  if command -v kubectl &>/dev/null; then
    no_change "kubectl $(kubectl version --client --short 2>/dev/null | head -1)"
    return
  fi
  info "Installing kubectl..."
  KVER=$(curl -sL https://dl.k8s.io/release/stable.txt)
  case $OS in
    macos) brew install kubernetes-cli ;;
    *)
      curl -fsSLO "https://dl.k8s.io/release/${KVER}/bin/linux/${ARCH}/kubectl"
      sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
      rm -f kubectl
      ;;
  esac
  configured "kubectl ${KVER}"
}

install_helm() {
  if command -v helm &>/dev/null; then
    no_change "Helm $(helm version --short 2>/dev/null)"
    return
  fi
  info "Installing Helm..."
  case $OS in
    macos) brew install helm ;;
    *) curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash ;;
  esac
  configured "Helm $(helm version --short 2>/dev/null)"
}

install_jq() {
  if command -v jq &>/dev/null; then
    no_change "jq $(jq --version 2>/dev/null)"
    return
  fi
  info "Installing jq..."
  case $OS in
    ubuntu|debian) sudo apt-get install -y -qq jq ;;
    centos|rhel|amzn|fedora) sudo yum install -y jq ;;
    alpine) sudo apk add --no-cache jq ;;
    macos) brew install jq ;;
    *) sudo apt-get install -y jq 2>/dev/null || sudo yum install -y jq 2>/dev/null ;;
  esac
  configured "jq $(jq --version 2>/dev/null)"
}

install_awscli() {
  if command -v aws &>/dev/null; then
    no_change "AWS CLI $(aws --version 2>/dev/null | awk '{print $1}')"
    return
  fi
  info "Installing AWS CLI..."
  case $OS in
    macos) brew install awscli ;;
    alpine) pip3 install --break-system-packages awscli 2>/dev/null || pip3 install awscli ;;
    *)
      curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip
      cd /tmp && unzip -qo awscliv2.zip && sudo ./aws/install --update
      rm -rf /tmp/aws /tmp/awscliv2.zip
      ;;
  esac
  configured "AWS CLI $(aws --version 2>/dev/null | awk '{print $1}')"
}

install_terraform() {
  if command -v terraform &>/dev/null; then
    no_change "Terraform $(terraform version 2>/dev/null | head -1)"
    return
  fi
  info "Installing Terraform..."
  case $OS in
    ubuntu|debian)
      wget -qO- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg > /dev/null
      echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
      sudo apt-get update -qq && sudo apt-get install -y -qq terraform
      ;;
    centos|rhel)
      sudo yum install -y yum-utils
      sudo yum-config-manager --add-repo https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo
      sudo yum -y install terraform
      ;;
    macos) brew install hashicorp/tap/terraform ;;
    amzn|fedora|alpine|*)
      sudo yum install -y unzip 2>/dev/null || sudo dnf install -y unzip 2>/dev/null || sudo apk add unzip 2>/dev/null || true
      TF_VER=$(curl -sL https://checkpoint-api.hashicorp.com/v1/check/terraform 2>/dev/null | grep -o '"current_version":"[^"]*"' | cut -d'"' -f4)
      [ -z "$TF_VER" ] && TF_VER="1.12.0"
      curl -fsSL "https://releases.hashicorp.com/terraform/${TF_VER}/terraform_${TF_VER}_linux_${ARCH}.zip" -o /tmp/tf.zip
      cd /tmp && unzip -qo tf.zip && sudo mv terraform /usr/local/bin/ && rm -f tf.zip
      ;;
  esac
  configured "Terraform $(terraform version 2>/dev/null | head -1 | awk '{print $2}')"
}

install_tools() {
  echo -e "\n${BOLD}  Installing DevOps tools...${NC}\n"
  install_git
  install_docker
  install_compose
  install_kubectl
  install_helm
  install_jq
  install_awscli
  install_terraform
  echo ""
  log "All DevOps tools ready"
}

# ─── Node.js Installer ─────────────────────────────────────
install_nodejs() {
  if command -v node &>/dev/null; then
    NODE_VER=$(node --version 2>/dev/null)
    NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
      no_change "Node.js ${NODE_VER}"
      return
    fi
    warn "Node.js ${NODE_VER} found but need 18+. Upgrading..."
  fi
  info "Installing Node.js 20 LTS..."
  case $OS in
    ubuntu|debian)
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y -qq nodejs
      ;;
    amzn|centos|rhel|fedora)
      curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
      sudo yum install -y nodejs 2>/dev/null || sudo dnf install -y nodejs
      ;;
    alpine) sudo apk add --no-cache nodejs npm ;;
    macos) brew install node@20 ;;
    *)
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null \
        || curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
      sudo apt-get install -y nodejs 2>/dev/null || sudo yum install -y nodejs
      ;;
  esac
  configured "Node.js $(node --version 2>/dev/null)"
}

# ─── Health Check Helper ───────────────────────────────────
health_check() {
  local url="$1" name="$2"
  info "Waiting for ${name}..."
  for i in $(seq 1 15); do
    if curl -sf "$url" >/dev/null 2>&1; then
      log "${name} is healthy"
      return 0
    fi
    sleep 2
    printf "."
  done
  echo ""
  warn "${name} did not respond within 30s"
  return 1
}

# ─── IDE Native Deployment ─────────────────────────────────
create_systemd_service() {
  local SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
  local NODE_BIN
  NODE_BIN=$(command -v node)

  if [ -f "$SERVICE_FILE" ]; then
    no_change "systemd service ${SERVICE_NAME}"
    return
  fi

  sudo tee "$SERVICE_FILE" > /dev/null <<UNIT
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
ExecStart=${NODE_BIN} ${INSTALL_DIR}/proxy/server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cloud-ide-proxy

[Install]
WantedBy=multi-user.target
UNIT

  sudo systemctl daemon-reload
  sudo systemctl enable "${SERVICE_NAME}" 2>/dev/null
  configured "systemd service ${SERVICE_NAME}"
}

start_ide_service() {
  if [ "$IDE_RUNNING" = "yes" ]; then
    no_change "Cloud IDE already running"
    return
  fi

  if command -v systemctl &>/dev/null; then
    sudo systemctl start "${SERVICE_NAME}"
  else
    cd "${INSTALL_DIR}"
    PORT="${IDE_PORT}" STATIC_DIR="${INSTALL_DIR}" nohup node proxy/server.js \
      > /var/log/cloud-ide-proxy.log 2>&1 &
    echo $! > "${INSTALL_DIR}/.proxy.pid"
  fi
  configured "Cloud IDE started on port ${IDE_PORT}"
}

stop_ide_service() {
  if command -v systemctl &>/dev/null; then
    sudo systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
  elif [ -f "${INSTALL_DIR}/.proxy.pid" ]; then
    kill "$(cat "${INSTALL_DIR}/.proxy.pid")" 2>/dev/null || true
    rm -f "${INSTALL_DIR}/.proxy.pid"
  else
    pkill -f "node.*proxy/server.js" 2>/dev/null || true
  fi
}

deploy_ide_native() {
  echo -e "\n${BOLD}  Deploying Cloud IDE (native proxy)...${NC}\n"

  install_git
  install_nodejs

  if [ -d "${INSTALL_DIR}/.git" ]; then
    cd "${INSTALL_DIR}"
    local OLD_HEAD
    OLD_HEAD=$(git rev-parse HEAD 2>/dev/null)
    git pull --ff-only 2>/dev/null || true
    local NEW_HEAD
    NEW_HEAD=$(git rev-parse HEAD 2>/dev/null)
    if [ "$OLD_HEAD" = "$NEW_HEAD" ]; then
      no_change "Repository at ${INSTALL_DIR}"
    else
      configured "Updated ${OLD_HEAD:0:8} → ${NEW_HEAD:0:8}"
    fi
  else
    sudo mkdir -p "$(dirname "${INSTALL_DIR}")" 2>/dev/null || true
    git clone "${GIT_REPO}" "${INSTALL_DIR}"
    configured "Repository cloned to ${INSTALL_DIR}"
  fi

  cd "${INSTALL_DIR}/proxy"
  if [ -d node_modules ] && [ -f package-lock.json ]; then
    no_change "npm dependencies"
  else
    npm install --omit=dev
    configured "npm dependencies installed"
  fi

  if command -v systemctl &>/dev/null; then
    create_systemd_service
  fi

  stop_ide_service 2>/dev/null || true
  sleep 1
  state_check
  start_ide_service

  health_check "http://localhost:${IDE_PORT}/health" "Cloud IDE"
  echo ""
  log "Cloud IDE proxy running on port ${IDE_PORT}"
}

# ─── Kyma Docker Deployment ────────────────────────────────
deploy_kyma_docker() {
  echo -e "\n${BOLD}  Deploying Kyma Dashboard (Docker)...${NC}\n"

  install_docker
  install_compose

  info "Pulling Kyma images..."
  docker pull "${REPO}:kyma-backend-${TAG}" 2>/dev/null \
    || docker pull sriniv7654/kyma-dashboard-backend:latest 2>/dev/null \
    || { warn "Kyma backend image not available — skipping"; return 1; }

  docker pull "${REPO}:kyma-frontend-${TAG}" 2>/dev/null \
    || docker pull sriniv7654/kyma-dashboard-frontend:latest 2>/dev/null \
    || { warn "Kyma frontend image not available — skipping"; return 1; }

  docker stop kyma-manager-backend kyma-manager-frontend 2>/dev/null || true
  docker rm kyma-manager-backend kyma-manager-frontend 2>/dev/null || true

  local KYMA_BE_IMAGE="${REPO}:kyma-backend-${TAG}"
  docker image inspect "$KYMA_BE_IMAGE" &>/dev/null || KYMA_BE_IMAGE="sriniv7654/kyma-dashboard-backend:latest"

  local KYMA_FE_IMAGE="${REPO}:kyma-frontend-${TAG}"
  docker image inspect "$KYMA_FE_IMAGE" &>/dev/null || KYMA_FE_IMAGE="sriniv7654/kyma-dashboard-frontend:latest"

  info "Starting Kyma Backend..."
  docker run -d --name kyma-manager-backend \
    -p "${KYMA_API_PORT}:8100" \
    -e NODE_ENV=production \
    -e PORT=8100 \
    -e DEV_SKIP_AUTH=true \
    -e "SESSION_SECRET=${SESSION_SECRET:-cloud-ide-kyma-session-secret-32ch!!}" \
    -e KUBECONFIG=/kubeconfig/config.yaml \
    -v "${KUBECONFIG_PATH:-$HOME/.kube/config}:/kubeconfig/config.yaml:ro" \
    --restart unless-stopped \
    "$KYMA_BE_IMAGE"

  info "Starting Kyma Frontend..."
  docker run -d --name kyma-manager-frontend \
    -p "${KYMA_UI_PORT}:80" \
    -e "BACKEND_URL=kyma-manager-backend:8100" \
    --link kyma-manager-backend \
    --restart unless-stopped \
    "$KYMA_FE_IMAGE"

  health_check "http://localhost:${KYMA_API_PORT}/health" "Kyma Backend"
  health_check "http://localhost:${KYMA_UI_PORT}/health" "Kyma Frontend"
  echo ""
  log "Kyma Dashboard running on ports ${KYMA_API_PORT}/${KYMA_UI_PORT}"
}

# ─── Service Control ───────────────────────────────────────
service_control() {
  local action="$1"
  state_check

  case "$action" in
    start)
      echo -e "\n${BOLD}  Starting services...${NC}\n"
      start_ide_service
      if [ "$HAS_DOCKER" = "yes" ]; then
        docker start kyma-manager-backend kyma-manager-frontend 2>/dev/null \
          && configured "Kyma services started" \
          || warn "Kyma containers not found — install first"
      fi
      ;;
    stop)
      echo -e "\n${BOLD}  Stopping services...${NC}\n"
      stop_ide_service
      configured "Cloud IDE stopped"
      if [ "$HAS_DOCKER" = "yes" ]; then
        docker stop kyma-manager-backend kyma-manager-frontend 2>/dev/null \
          && configured "Kyma services stopped" || true
      fi
      ;;
    restart)
      service_control stop
      sleep 2
      service_control start
      ;;
  esac
}

# ─── Update ────────────────────────────────────────────────
update_all() {
  echo -e "\n${BOLD}  Updating Cloud IDE...${NC}\n"

  if [ -d "${INSTALL_DIR}/.git" ]; then
    cd "${INSTALL_DIR}"
    local OLD_HEAD
    OLD_HEAD=$(git rev-parse HEAD 2>/dev/null)
    git pull --ff-only 2>/dev/null || { warn "git pull failed"; return 1; }
    local NEW_HEAD
    NEW_HEAD=$(git rev-parse HEAD 2>/dev/null)
    if [ "$OLD_HEAD" = "$NEW_HEAD" ]; then
      no_change "Repository already at latest"
    else
      configured "Updated ${OLD_HEAD:0:8} → ${NEW_HEAD:0:8}"
      cd proxy && npm install --omit=dev
    fi
  else
    warn "No installation found at ${INSTALL_DIR}"
    return 1
  fi

  service_control restart

  if [ "$HAS_DOCKER" = "yes" ]; then
    info "Pulling latest Kyma images..."
    docker pull "${REPO}:kyma-backend-${TAG}" 2>/dev/null || true
    docker pull "${REPO}:kyma-frontend-${TAG}" 2>/dev/null || true
    docker stop kyma-manager-backend kyma-manager-frontend 2>/dev/null || true
    docker rm kyma-manager-backend kyma-manager-frontend 2>/dev/null || true
    deploy_kyma_docker
  fi

  echo ""
  log "Update complete"
}

# ─── View Logs ─────────────────────────────────────────────
view_logs() {
  echo -e "\n${BOLD}  Select log source:${NC}\n"
  echo -e "  ${BOLD}1)${NC}  Cloud IDE proxy"
  echo -e "  ${BOLD}2)${NC}  Kyma Backend"
  echo -e "  ${BOLD}3)${NC}  Kyma Frontend"
  echo -e "  ${BOLD}0)${NC}  Back"
  echo ""
  read -rp "  Select [0-3]: " log_choice

  case "$log_choice" in
    1)
      if command -v journalctl &>/dev/null; then
        sudo journalctl -u "${SERVICE_NAME}" --no-pager -n 50
      elif [ -f /var/log/cloud-ide-proxy.log ]; then
        tail -50 /var/log/cloud-ide-proxy.log
      else
        warn "No logs found"
      fi
      ;;
    2) docker logs kyma-manager-backend --tail 50 2>&1 || warn "Container not found" ;;
    3) docker logs kyma-manager-frontend --tail 50 2>&1 || warn "Container not found" ;;
    0) return ;;
    *) warn "Invalid option" ;;
  esac
}

# ─── Uninstall ─────────────────────────────────────────────
uninstall() {
  echo -e "\n${RED}${BOLD}  UNINSTALL CLOUD IDE${NC}\n"
  echo "  This will remove:"
  echo "    - Cloud IDE proxy service"
  echo "    - Kyma Dashboard containers"
  echo "    - Source code at ${INSTALL_DIR}"
  echo ""
  read -rp "  Are you sure? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    info "Uninstall cancelled"
    return
  fi

  stop_ide_service
  if command -v systemctl &>/dev/null; then
    sudo systemctl disable "${SERVICE_NAME}" 2>/dev/null || true
    sudo rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
    sudo systemctl daemon-reload
  fi
  destroyed "Cloud IDE proxy service"

  docker stop kyma-manager-backend kyma-manager-frontend 2>/dev/null || true
  docker rm kyma-manager-backend kyma-manager-frontend 2>/dev/null || true
  destroyed "Kyma Docker containers"

  if [ -d "${INSTALL_DIR}" ]; then
    read -rp "  Delete source code at ${INSTALL_DIR}? (yes/no): " DEL_SRC
    if [ "$DEL_SRC" = "yes" ]; then
      sudo rm -rf "${INSTALL_DIR}"
      destroyed "Source code at ${INSTALL_DIR}"
    fi
  fi

  echo ""
  log "Uninstall complete"
}

# ─── Status Display ────────────────────────────────────────
get_server_ip() {
  local TOKEN IP
  TOKEN=$(curl -sf -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null)
  IP=$(curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null \
    || curl -sf http://checkip.amazonaws.com 2>/dev/null \
    || curl -sf http://ifconfig.me 2>/dev/null \
    || hostname -I 2>/dev/null | awk '{print $1}' \
    || echo "localhost")
  echo "$IP"
}

show_status() {
  state_check
  local IP
  IP=$(get_server_ip)

  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║            Cloud IDE — System Status              ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
  echo ""

  echo -e "${BOLD}  Services:${NC}"
  if [ "$IDE_RUNNING" = "yes" ]; then
    echo -e "  ${GREEN}● RUNNING${NC}   Cloud IDE       →  ${CYAN}http://${IP}:${IDE_PORT}${NC}"
  else
    echo -e "  ${RED}○ STOPPED${NC}   Cloud IDE"
  fi
  if [ "$KYMA_BACKEND_RUNNING" = "yes" ]; then
    echo -e "  ${GREEN}● RUNNING${NC}   Kyma API        →  ${CYAN}http://${IP}:${KYMA_API_PORT}${NC}"
  else
    echo -e "  ${RED}○ STOPPED${NC}   Kyma API"
  fi
  if [ "$KYMA_FRONTEND_RUNNING" = "yes" ]; then
    echo -e "  ${GREEN}● RUNNING${NC}   Kyma Dashboard  →  ${CYAN}http://${IP}:${KYMA_UI_PORT}${NC}"
  else
    echo -e "  ${RED}○ STOPPED${NC}   Kyma Dashboard"
  fi

  echo ""
  echo -e "${BOLD}  Tools:${NC}"
  local tools=(
    "Docker:HAS_DOCKER:$(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',')"
    "Compose:HAS_COMPOSE:$(docker compose version --short 2>/dev/null)"
    "Node.js:HAS_NODE:$(node --version 2>/dev/null)"
    "kubectl:HAS_KUBECTL:$(kubectl version --client --short 2>/dev/null | head -1)"
    "Helm:HAS_HELM:$(helm version --short 2>/dev/null)"
    "jq:HAS_JQ:$(jq --version 2>/dev/null)"
    "AWS CLI:HAS_AWS:$(aws --version 2>/dev/null | awk '{print $1}')"
    "Terraform:HAS_TERRAFORM:$(terraform version 2>/dev/null | head -1 | awk '{print $2}')"
    "git:HAS_GIT:$(git --version 2>/dev/null | awk '{print $3}')"
  )
  for entry in "${tools[@]}"; do
    IFS=: read -r name var ver <<< "$entry"
    eval "val=\${$var:-no}"
    if [ "$val" = "yes" ]; then
      printf "  ${GREEN}✓${NC} %-12s %s\n" "$name" "$ver"
    else
      printf "  ${RED}✗${NC} %-12s %s\n" "$name" "(not installed)"
    fi
  done

  echo ""
  echo -e "${BOLD}  Credentials:${NC}"
  echo -e "  Username: ${BOLD}admin${NC}    Password: ${BOLD}sri@123${NC}"
  echo ""
}

# ─── Build Kyma from Source ────────────────────────────────
build_kyma_from_source() {
  echo -e "\n${BOLD}  Building Kyma Dashboard from source (auth bypass)...${NC}\n"

  install_docker
  install_git

  local KYMA_SRC="${INSTALL_DIR}/kyma-dashboard"

  if [ ! -d "${KYMA_SRC}/backend" ]; then
    warn "Kyma Dashboard source not found at ${KYMA_SRC}"
    warn "Run 'git pull' in ${INSTALL_DIR} first to get the source"
    _build_kyma_embedded
    return
  fi

  cd "${KYMA_SRC}"

  info "Building backend image with DEV_SKIP_AUTH=true..."
  docker build -f backend/Dockerfile -t "${REPO}:kyma-backend-${TAG}" backend/ 2>&1 | tail -5
  configured "Kyma Backend image"

  info "Building frontend image with VITE_SKIP_AUTH=true..."
  docker build -f frontend/Dockerfile -t "${REPO}:kyma-frontend-${TAG}" frontend/ 2>&1 | tail -5
  configured "Kyma Frontend image"

  docker stop kyma-manager-backend kyma-manager-frontend 2>/dev/null || true
  docker rm kyma-manager-backend kyma-manager-frontend 2>/dev/null || true
  deploy_kyma_docker

  echo ""
  read -rp "  Push images to Docker Hub? (yes/no): " PUSH_CHOICE
  if [ "$PUSH_CHOICE" = "yes" ]; then
    info "Login to Docker Hub (username: sriniv7654)..."
    docker login -u sriniv7654
    docker push "${REPO}:kyma-backend-${TAG}"
    docker push "${REPO}:kyma-frontend-${TAG}"
    configured "Images pushed to Docker Hub"
  fi

  # Cleanup dangling images from build
  docker image prune -f 2>/dev/null || true

  log "Kyma Dashboard built and deployed (auth bypassed)"
}

_build_kyma_embedded() {
  info "Building minimal Kyma images with auth bypass..."

  docker stop kyma-manager-backend kyma-manager-frontend 2>/dev/null || true
  docker rm kyma-manager-backend kyma-manager-frontend 2>/dev/null || true

  info "Pulling base images and patching..."
  if docker pull sriniv7654/kyma-dashboard-backend:latest 2>/dev/null; then
    docker tag sriniv7654/kyma-dashboard-backend:latest "${REPO}:kyma-backend-${TAG}"
  fi
  if docker pull sriniv7654/kyma-dashboard-frontend:latest 2>/dev/null; then
    docker tag sriniv7654/kyma-dashboard-frontend:latest "${REPO}:kyma-frontend-${TAG}"
  fi

  deploy_kyma_docker
  warn "Using pre-built images — Keycloak login may still appear"
  warn "To fix: run option 5 again after git pull brings kyma-dashboard/ source"
}

# ─── Cleanup ──────────────────────────────────────────────
post_install_cleanup() {
  echo -e "\n${BOLD}  Post-installation cleanup...${NC}\n"

  if [ "$HAS_DOCKER" = "yes" ]; then
    local DANGLING
    DANGLING=$(docker images -f "dangling=true" -q 2>/dev/null | wc -l | tr -d ' ')
    if [ "$DANGLING" -gt 0 ]; then
      docker image prune -f 2>/dev/null
      configured "Removed ${DANGLING} dangling Docker images"
    else
      no_change "No dangling Docker images"
    fi

    local UNUSED_VOLUMES
    UNUSED_VOLUMES=$(docker volume ls -f "dangling=true" -q 2>/dev/null | wc -l | tr -d ' ')
    if [ "$UNUSED_VOLUMES" -gt 0 ]; then
      read -rp "  Remove ${UNUSED_VOLUMES} unused Docker volumes? (yes/no): " VOL_CHOICE
      if [ "$VOL_CHOICE" = "yes" ]; then
        docker volume prune -f 2>/dev/null
        configured "Removed unused volumes"
      fi
    else
      no_change "No unused Docker volumes"
    fi
  fi

  if [ -d "/tmp/kyma-dashboard-build" ]; then
    rm -rf /tmp/kyma-dashboard-build
    configured "Removed temp build files"
  fi

  if command -v npm &>/dev/null; then
    npm cache clean --force 2>/dev/null
    configured "Cleared npm cache"
  fi

  if command -v yum &>/dev/null; then
    sudo yum clean all 2>/dev/null
    configured "Cleared yum cache"
  elif command -v apt-get &>/dev/null; then
    sudo apt-get clean 2>/dev/null
    configured "Cleared apt cache"
  fi

  echo ""
  log "Cleanup complete"
}

# ─── Full Build + Push + Deploy Pipeline ──────────────────
full_build_push_deploy() {
  echo -e "\n${BOLD}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║     Full Pipeline: Build → Push → Deploy          ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}\n"

  install_docker
  install_git
  install_nodejs

  # Step 1: Clone/update repo
  info "Step 1/5: Repository..."
  if [ -d "${INSTALL_DIR}/.git" ]; then
    cd "${INSTALL_DIR}" && git pull --ff-only 2>/dev/null || git pull
    configured "Repository updated"
  else
    mkdir -p "$(dirname "${INSTALL_DIR}")" 2>/dev/null || true
    git clone "https://github.com/srinivaskona7/devops-single.git" "${INSTALL_DIR}"
    cd "${INSTALL_DIR}"
    configured "Repository cloned"
  fi
  echo ""

  # Step 2: Docker Hub login
  info "Step 2/5: Docker Hub login (username: sriniv7654)..."
  echo -e "  ${YELLOW}Enter Docker Hub password:${NC}"
  docker login -u sriniv7654
  echo ""

  # Step 3: Build all images
  info "Step 3/5: Building images..."
  echo ""

  info "  Building Cloud IDE..."
  docker build --no-cache -t "${REPO}:cloud-ide-${TAG}" -t "${REPO}:cloud-ide" -f Dockerfile . 2>&1 | tail -3
  configured "Cloud IDE image"

  if [ -d "kyma-dashboard/backend" ]; then
    info "  Building Kyma Backend (DEV_SKIP_AUTH=true)..."
    docker build --no-cache -t "${REPO}:kyma-backend-${TAG}" -t "${REPO}:kyma-backend" -f kyma-dashboard/backend/Dockerfile kyma-dashboard/backend 2>&1 | tail -3
    configured "Kyma Backend image"

    info "  Building Kyma Frontend (VITE_SKIP_AUTH=true)..."
    docker build --no-cache -t "${REPO}:kyma-frontend-${TAG}" -t "${REPO}:kyma-frontend" -f kyma-dashboard/frontend/Dockerfile kyma-dashboard/frontend 2>&1 | tail -3
    configured "Kyma Frontend image"
  fi
  echo ""

  # Step 4: Push to Docker Hub
  info "Step 4/5: Pushing to Docker Hub..."
  docker push "${REPO}:cloud-ide-${TAG}"
  docker push "${REPO}:cloud-ide"
  configured "Pushed cloud-ide"

  if docker image inspect "${REPO}:kyma-backend-${TAG}" &>/dev/null; then
    docker push "${REPO}:kyma-backend-${TAG}"
    docker push "${REPO}:kyma-backend"
    configured "Pushed kyma-backend"
    docker push "${REPO}:kyma-frontend-${TAG}"
    docker push "${REPO}:kyma-frontend"
    configured "Pushed kyma-frontend"
  fi
  echo ""

  # Step 5: Deploy
  info "Step 5/5: Deploying services..."
  echo ""

  # Deploy IDE natively
  cd "${INSTALL_DIR}/proxy"
  [ -d node_modules ] || npm install --omit=dev
  if command -v systemctl &>/dev/null; then
    create_systemd_service
    sudo systemctl restart cloud-ide-proxy
  else
    stop_ide_service 2>/dev/null || true
    PORT="${IDE_PORT}" STATIC_DIR="${INSTALL_DIR}" nohup node server.js > /var/log/cloud-ide-proxy.log 2>&1 &
  fi
  configured "Cloud IDE on port ${IDE_PORT}"

  # Deploy Kyma containers (pull latest, fresh deploy)
  docker stop kyma-manager-backend kyma-manager-frontend 2>/dev/null || true
  docker rm kyma-manager-backend kyma-manager-frontend 2>/dev/null || true
  cd "${INSTALL_DIR}"
  deploy_kyma_docker

  # Cleanup
  docker image prune -f 2>/dev/null || true
  docker builder prune -f 2>/dev/null || true

  echo ""
  show_status
  log "Full pipeline complete: Build → Push → Deploy"
}

# ─── Menu System ───────────────────────────────────────────
show_menu() {
  while true; do
    state_check

    local IDE_ICON="${RED}○${NC}"; [ "$IDE_RUNNING" = "yes" ] && IDE_ICON="${GREEN}●${NC}"
    local KYMA_ICON="${RED}○${NC}"; [ "$KYMA_BACKEND_RUNNING" = "yes" ] && [ "$KYMA_FRONTEND_RUNNING" = "yes" ] && KYMA_ICON="${GREEN}●${NC}"
    local TOOLS_COUNT=0
    for t in HAS_DOCKER HAS_KUBECTL HAS_HELM HAS_JQ HAS_AWS HAS_TERRAFORM HAS_GIT; do
      eval "[ \"\${$t:-no}\" = \"yes\" ]" && TOOLS_COUNT=$((TOOLS_COUNT + 1)) || true
    done

    echo ""
    echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║        Cloud IDE — Installation Manager          ║${NC}"
    echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${BOLD} 1)${NC}  Install full stack (IDE + Kyma)      ${IDE_ICON}  ${KYMA_ICON}"
    echo -e "  ${BOLD} 2)${NC}  Install IDE only                     ${IDE_ICON}"
    echo -e "  ${BOLD} 3)${NC}  Install Kyma Dashboard only             ${KYMA_ICON}"
    echo -e "  ${BOLD} 4)${NC}  Install DevOps tools                 [${TOOLS_COUNT}/7]"
    echo -e "  ${BOLD} 5)${NC}  Build Kyma Dashboard from source"
    echo -e "  ${BOLD} 6)${NC}  ${BOLD}Build + Push + Deploy (full pipeline)${NC}"
    echo -e "  ${BOLD} 7)${NC}  Start all services"
    echo -e "  ${BOLD} 8)${NC}  Stop all services"
    echo -e "  ${BOLD} 9)${NC}  Restart all services"
    echo -e "  ${BOLD}10)${NC}  Update to latest version"
    echo -e "  ${BOLD}11)${NC}  View status"
    echo -e "  ${BOLD}12)${NC}  View logs"
    echo -e "  ${BOLD}13)${NC}  Cleanup (remove caches, dangling images)"
    echo -e "  ${BOLD}14)${NC}  Uninstall"
    echo -e "  ${BOLD} 0)${NC}  Exit"
    echo ""
    read -rp "  Select option [0-14]: " choice

    case "$choice" in
      1)  install_tools; deploy_ide_native; deploy_kyma_docker; show_status ;;
      2)  deploy_ide_native; show_status ;;
      3)  deploy_kyma_docker; show_status ;;
      4)  install_tools ;;
      5)  build_kyma_from_source ;;
      6)  full_build_push_deploy ;;
      7)  service_control start ;;
      8)  service_control stop ;;
      9)  service_control restart ;;
      10) update_all ;;
      11) show_status ;;
      12) view_logs ;;
      13) post_install_cleanup ;;
      14) uninstall ;;
      0)  echo -e "\n  ${GREEN}Goodbye!${NC}\n"; exit 0 ;;
      *)  warn "Invalid option" ;;
    esac

    echo ""
    read -rp "  Press Enter to continue..." _
  done
}

# ─── Help ──────────────────────────────────────────────────
print_help() {
  echo "Usage: install.sh [OPTIONS]"
  echo ""
  echo "Interactive (default when run in terminal):"
  echo "  ./install.sh                     Show interactive menu"
  echo ""
  echo "Non-interactive:"
  echo "  ./install.sh --install           Full install (IDE + Kyma + tools)"
  echo "  ./install.sh --ide-only          Install IDE proxy only"
  echo "  ./install.sh --kyma-only         Install Kyma Dashboard only"
  echo "  ./install.sh --tools-only        Install DevOps tools only"
  echo "  ./install.sh --status            Show system status"
  echo "  ./install.sh --uninstall         Remove everything"
  echo ""
  echo "Options:"
  echo "  --tag=VERSION                    Image tag (default: latest)"
  echo "  --port=PORT                      IDE port (default: 8101)"
  echo "  --install-dir=PATH               Install directory (default: /opt/cloud-ide)"
  echo ""
  echo "One-liner install:"
  echo "  curl -sSL https://raw.githubusercontent.com/srinivaskona7/devops-single/main/install.sh | bash"
  echo ""
  echo "Interactive via curl:"
  echo "  curl -sSL URL | bash -s -- --menu"
}

# ─── Main ──────────────────────────────────────────────────
main() {
  detect_os

  for arg in "$@"; do
    case $arg in
      --tag=*)         TAG="${arg#*=}" ;;
      --port=*)        IDE_PORT="${arg#*=}" ;;
      --install-dir=*) INSTALL_DIR="${arg#*=}" ;;
      --help|-h)       print_help; exit 0 ;;
    esac
  done

  for arg in "$@"; do
    case $arg in
      --install)     install_tools; deploy_ide_native; deploy_kyma_docker; show_status; exit 0 ;;
      --ide-only)    deploy_ide_native; show_status; exit 0 ;;
      --kyma-only)   deploy_kyma_docker; show_status; exit 0 ;;
      --tools-only)  install_tools; exit 0 ;;
      --status)      show_status; exit 0 ;;
      --uninstall)   uninstall; exit 0 ;;
      --menu)        [ ! -t 0 ] && exec < /dev/tty; show_menu; exit 0 ;;
    esac
  done

  if [ ! -t 0 ]; then
    install_tools
    deploy_ide_native
    deploy_kyma_docker
    show_status
    exit 0
  fi

  show_menu
}

main "$@"
