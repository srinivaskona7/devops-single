#!/bin/bash
set -e

# ╔══════════════════════════════════════════════════════════════╗
# ║  Cloud IDE — Universal Installer                            ║
# ║  curl -sSL https://raw.githubusercontent.com/               ║
# ║    srinivaskona7/devops-single/main/install.sh | bash       ║
# ╚══════════════════════════════════════════════════════════════╝

REPO="sriniv7654/devops-single"
GIT_REPO="https://github.com/srinivaskona7/devops-single.git"
INSTALL_DIR="${INSTALL_DIR:-$HOME/srintest}"
PORT="${PORT:-8101}"
TAG="${IMAGE_TAG:-latest}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     Cloud IDE — DevOps Platform Installer        ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Detect OS ──────────────────────────────────────────────
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
  info "Detected: ${OS} (${ARCH})"
}

# ─── Install Docker ─────────────────────────────────────────
install_docker() {
  if command -v docker &>/dev/null; then
    log "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
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
    alpine)
      sudo apk add --no-cache docker docker-cli-compose
      ;;
    macos)
      brew install --cask docker
      warn "Open Docker Desktop to complete setup"
      ;;
    *)
      curl -fsSL https://get.docker.com | sh
      ;;
  esac
  sudo systemctl enable docker 2>/dev/null && sudo systemctl start docker 2>/dev/null || true
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  log "Docker installed"
}

# ─── Install Docker Compose ─────────────────────────────────
install_compose() {
  if docker compose version &>/dev/null; then
    log "Docker Compose $(docker compose version --short 2>/dev/null)"
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
  log "Docker Compose installed"
}

# ─── Install kubectl ────────────────────────────────────────
install_kubectl() {
  if command -v kubectl &>/dev/null; then
    log "kubectl $(kubectl version --client --short 2>/dev/null | head -1)"
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
  log "kubectl ${KVER} installed"
}

# ─── Install Helm ───────────────────────────────────────────
install_helm() {
  if command -v helm &>/dev/null; then
    log "Helm $(helm version --short 2>/dev/null)"
    return
  fi
  info "Installing Helm..."
  case $OS in
    macos) brew install helm ;;
    *) curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash ;;
  esac
  log "Helm installed"
}

# ─── Install jq ────────────────────────────────────────────
install_jq() {
  if command -v jq &>/dev/null; then
    log "jq $(jq --version 2>/dev/null)"
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
  log "jq installed"
}

# ─── Install AWS CLI ────────────────────────────────────────
install_awscli() {
  if command -v aws &>/dev/null; then
    log "AWS CLI $(aws --version 2>/dev/null | awk '{print $1}')"
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
  log "AWS CLI installed"
}

# ─── Install Terraform ──────────────────────────────────────
install_terraform() {
  if command -v terraform &>/dev/null; then
    log "Terraform $(terraform version 2>/dev/null | head -1)"
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
  log "Terraform installed"
}

# ─── Install Git ────────────────────────────────────────────
install_git() {
  if command -v git &>/dev/null; then
    log "git $(git --version | awk '{print $3}')"
    return
  fi
  info "Installing git..."
  case $OS in
    ubuntu|debian) sudo apt-get install -y -qq git ;;
    centos|rhel|amzn|fedora) sudo yum install -y git ;;
    alpine) sudo apk add --no-cache git ;;
    macos) xcode-select --install 2>/dev/null || true ;;
  esac
  log "git installed"
}

# ─── Deploy Cloud IDE ───────────────────────────────────────
deploy_ide() {
  info "Setting up Cloud IDE at ${INSTALL_DIR}..."
  mkdir -p "${INSTALL_DIR}" 2>/dev/null || sudo mkdir -p "${INSTALL_DIR}"

  if [ -d "${INSTALL_DIR}/.git" ]; then
    info "Updating existing repo..."
    cd "${INSTALL_DIR}" && git pull 2>/dev/null || true
  else
    info "Cloning repo into ${INSTALL_DIR}..."
    git clone "${GIT_REPO}" "${INSTALL_DIR}" 2>/dev/null || {
      warn "Clone failed — pulling images directly"
    }
  fi

  cd "${INSTALL_DIR}"
  info "Working directory: $(pwd)"

  # Build cloud-ide from source
  if [ -f Dockerfile ]; then
    info "Building Cloud IDE image..."
    docker build -t "${REPO}:cloud-ide-${TAG}" -t "${REPO}:cloud-ide" .

    # Push if logged in
    if docker info 2>/dev/null | grep -q "Username"; then
      info "Pushing cloud-ide image to Docker Hub..."
      docker push "${REPO}:cloud-ide-${TAG}" 2>/dev/null && docker push "${REPO}:cloud-ide" 2>/dev/null && log "Pushed ${REPO}:cloud-ide-${TAG}" || warn "Push failed (login may be needed)"
    fi
  fi

  # Try pulling kyma images — if not available, skip (IDE works standalone)
  KYMA_AVAILABLE=false
  if docker pull "${REPO}:kyma-backend-${TAG}" 2>/dev/null || docker pull "${REPO}:kyma-backend" 2>/dev/null; then
    if docker pull "${REPO}:kyma-frontend-${TAG}" 2>/dev/null || docker pull "${REPO}:kyma-frontend" 2>/dev/null; then
      KYMA_AVAILABLE=true
    fi
  fi

  # Try pulling from original repos if single repo doesn't have them
  if [ "$KYMA_AVAILABLE" = false ]; then
    info "Kyma images not in single repo — trying original repos..."
    if docker pull sriniv7654/kyma-dashboard-backend:latest 2>/dev/null; then
      docker tag sriniv7654/kyma-dashboard-backend:latest "${REPO}:kyma-backend-${TAG}"
      docker tag sriniv7654/kyma-dashboard-backend:latest "${REPO}:kyma-backend"
      if docker pull sriniv7654/kyma-dashboard-frontend:latest 2>/dev/null; then
        docker tag sriniv7654/kyma-dashboard-frontend:latest "${REPO}:kyma-frontend-${TAG}"
        docker tag sriniv7654/kyma-dashboard-frontend:latest "${REPO}:kyma-frontend"
        KYMA_AVAILABLE=true
      fi
    fi
  fi

  # Stop existing
  docker compose down 2>/dev/null || true
  docker stop cloud-ide kyma-manager-backend kyma-manager-frontend 2>/dev/null || true
  docker rm cloud-ide kyma-manager-backend kyma-manager-frontend 2>/dev/null || true

  # Start — IDE only if kyma images unavailable
  if [ "$KYMA_AVAILABLE" = true ] && [ -f docker-compose.yml ]; then
    info "Starting full stack (IDE + Kyma Dashboard)..."
    IMAGE_TAG="${TAG}" KUBECONFIG_PATH="${KUBECONFIG_PATH:-$HOME/.kube/config}" docker compose up -d
  else
    if [ "$KYMA_AVAILABLE" = false ]; then
      warn "Kyma Dashboard images not available — starting IDE only"
    fi
    info "Starting Cloud IDE..."
    docker run -d --name cloud-ide \
      -p "${PORT}:3456" \
      -v cloud-ide-data:/app/data \
      --restart unless-stopped \
      "${REPO}:cloud-ide-${TAG}"
  fi

  # Health check
  info "Waiting for health..."
  for i in $(seq 1 15); do
    if curl -sf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
      break
    fi
    sleep 2
    printf "."
  done
  echo ""
}

# ─── Print Summary ──────────────────────────────────────────
print_summary() {
  TOKEN=$(curl -sf -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null)
  IP=$(curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null \
    || curl -sf http://checkip.amazonaws.com 2>/dev/null \
    || curl -sf http://ifconfig.me 2>/dev/null \
    || hostname -I 2>/dev/null | awk '{print $1}' \
    || echo "localhost")

  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║                 INSTALLATION COMPLETE                        ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BOLD}Tools:${NC}"
  command -v docker    &>/dev/null && echo -e "  ${GREEN}✓${NC} Docker       $(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',')" || echo -e "  ${RED}✗${NC} Docker"
  command -v docker    &>/dev/null && docker compose version &>/dev/null && echo -e "  ${GREEN}✓${NC} Compose      $(docker compose version --short 2>/dev/null)" || echo -e "  ${RED}✗${NC} Compose"
  command -v kubectl   &>/dev/null && echo -e "  ${GREEN}✓${NC} kubectl      $(kubectl version --client --short 2>/dev/null | head -1)" || echo -e "  ${RED}✗${NC} kubectl"
  command -v helm      &>/dev/null && echo -e "  ${GREEN}✓${NC} Helm         $(helm version --short 2>/dev/null)" || echo -e "  ${RED}✗${NC} Helm"
  command -v jq        &>/dev/null && echo -e "  ${GREEN}✓${NC} jq           $(jq --version 2>/dev/null)" || echo -e "  ${RED}✗${NC} jq"
  command -v aws       &>/dev/null && echo -e "  ${GREEN}✓${NC} AWS CLI      $(aws --version 2>/dev/null | awk '{print $1}')" || echo -e "  ${RED}✗${NC} AWS CLI"
  command -v terraform &>/dev/null && echo -e "  ${GREEN}✓${NC} Terraform    $(terraform version 2>/dev/null | head -1 | awk '{print $2}')" || echo -e "  ${RED}✗${NC} Terraform"
  command -v git       &>/dev/null && echo -e "  ${GREEN}✓${NC} git          $(git --version 2>/dev/null | awk '{print $3}')" || echo -e "  ${RED}✗${NC} git"

  echo ""
  echo -e "────────────────────────────────────────────────────────────────"
  echo ""
  echo -e "  ${BOLD}${GREEN}>>> OPEN THIS IN YOUR BROWSER <<<${NC}"
  echo ""
  echo -e "      ${BOLD}${CYAN}http://${IP}:${PORT}${NC}"
  echo ""
  echo -e "      Username: ${BOLD}admin${NC}"
  echo -e "      Password: ${BOLD}sri@123${NC}"
  echo ""
  echo -e "────────────────────────────────────────────────────────────────"
  echo ""
  echo -e "${BOLD}All Services:${NC}"
  echo -e "  ${CYAN}Cloud IDE        →  http://${IP}:${PORT}${NC}"
  echo -e "  ${CYAN}Kyma Dashboard   →  http://${IP}:3000${NC}  (if available)"
  echo -e "  ${CYAN}Kyma API         →  http://${IP}:8100${NC}  (if available)"
  echo ""
  echo -e "${BOLD}Commands:${NC}"
  echo -e "  Logs:      ${CYAN}cd ${INSTALL_DIR} && docker compose logs -f${NC}"
  echo -e "  Stop:      ${CYAN}cd ${INSTALL_DIR} && docker compose down${NC}"
  echo -e "  Restart:   ${CYAN}cd ${INSTALL_DIR} && docker compose restart${NC}"
  echo -e "  Update:    ${CYAN}cd ${INSTALL_DIR} && git pull && docker compose up -d${NC}"
  echo ""
}

# ─── Main ───────────────────────────────────────────────────
main() {
  detect_os
  echo ""

  # Parse args
  SKIP_TOOLS=false
  TOOLS_ONLY=false
  for arg in "$@"; do
    case $arg in
      --tools-only) TOOLS_ONLY=true ;;
      --skip-tools) SKIP_TOOLS=true ;;
      --tag=*) TAG="${arg#*=}" ;;
      --port=*) PORT="${arg#*=}" ;;
      --help|-h)
        echo "Usage: install.sh [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --tools-only    Install tools only (no Cloud IDE)"
        echo "  --skip-tools    Skip tool installation (IDE only)"
        echo "  --tag=v1        Specify image tag (default: latest)"
        echo "  --port=3456     Specify IDE port (default: 3456)"
        echo ""
        echo "One-liner:"
        echo "  curl -sSL https://raw.githubusercontent.com/srinivaskona7/devops-single/main/install.sh | bash"
        echo "  curl -sSL ... | bash -s -- --tools-only"
        echo "  curl -sSL ... | bash -s -- --tag=v1 --port=8080"
        exit 0
        ;;
    esac
  done

  if [ "$SKIP_TOOLS" = false ]; then
    echo -e "${BOLD}Installing DevOps tools...${NC}"
    echo ""
    install_git
    install_docker
    install_compose
    install_kubectl
    install_helm
    install_jq
    install_awscli
    install_terraform
  fi

  if [ "$TOOLS_ONLY" = false ]; then
    echo ""
    echo -e "${BOLD}Deploying Cloud IDE...${NC}"
    echo ""
    deploy_ide
  fi

  print_summary
}

main "$@"
