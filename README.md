# Cloud IDE — Browser-Based DevOps Platform

A production-ready, browser-based IDE with SSH connectivity, 16 DevOps panels, Kyma/K8s dashboard, and 30 one-click deploy templates. Single Docker repo, zero install.

**Docker Hub:** `sriniv7654/devops-single`

```
┌─────────────────────────────────────────────────────────────┐
│  Browser  →  Auth (admin/sri@123)  →  Home Page             │
│                                        ├── SSH Connect      │
│                                        ├── K8s Dashboard    │
│                                        ├── DevOps Templates │
│                                        ├── Srinivas App     │
│                                        └── Kyma Dashboard   │
│                                                             │
│  Cloud IDE (ws://proxy:8101)  ←→  SSH Server (sshd:22)     │
│  Kyma Dashboard (:8100)       ←→  K8s API (kubeconfig)     │
└─────────────────────────────────────────────────────────────┘
```

---

## Installation Methods

### Method 1: Full Deploy Pipeline (Recommended)

Complete CI/CD pipeline — clones repo, builds images, pushes to Docker Hub, deploys with volumes and kubeconfig support.

```bash
curl -sSL https://raw.githubusercontent.com/srinivaskona7/devops-single/main/deploy.sh | bash
```

**What it does (7 steps):**
1. Clones the repo to `/opt/cloud-ide`
2. Prompts for Docker Hub password (username: `sriniv7654`)
3. Builds all 3 Docker images from source
4. Pushes images to Docker Hub with `latest` tag
5. Prompts for kubeconfig file upload (paste path or skip)
6. Deploys containers with persistent volumes (always pulls latest)
7. Runs health checks and displays access URLs

**With options:**
```bash
# Custom tag and port
curl -sSL https://raw.githubusercontent.com/srinivaskona7/devops-single/main/deploy.sh | bash -s -- --tag=v2 --port=8101

# Custom Docker Hub repo
curl -sSL https://raw.githubusercontent.com/srinivaskona7/devops-single/main/deploy.sh | bash -s -- --user=myuser --repo=myuser/myrepo

# All options
curl -sSL https://raw.githubusercontent.com/srinivaskona7/devops-single/main/deploy.sh | bash -s -- \
  --tag=latest \
  --port=8101 \
  --user=sriniv7654 \
  --repo=sriniv7654/devops-single \
  --install-dir=/opt/cloud-ide
```

---

### Method 2: Interactive Installer (Menu-Based)

Interactive menu with 13 options — install, start/stop, update, build, cleanup, uninstall.

```bash
curl -sSL https://raw.githubusercontent.com/srinivaskona7/devops-single/main/install.sh | bash -s -- --menu
```

**Or run directly:**
```bash
git clone https://github.com/srinivaskona7/devops-single.git /opt/cloud-ide
cd /opt/cloud-ide
./install.sh
```

**Menu options:**
```
╔══════════════════════════════════════════════════╗
║        Cloud IDE — Installation Manager          ║
╚══════════════════════════════════════════════════╝

  1)  Install full stack (IDE + Kyma)
  2)  Install IDE only
  3)  Install Kyma Dashboard only
  4)  Install DevOps tools
  5)  Build Kyma Dashboard from source
  6)  Start all services
  7)  Stop all services
  8)  Restart all services
  9)  Update to latest version
 10)  View status
 11)  View logs
 12)  Cleanup (remove caches, dangling images)
 13)  Uninstall
  0)  Exit
```

**Non-interactive flags:**
```bash
# Full install (no menu)
curl -sSL .../install.sh | bash

# IDE only (no Kyma, no Docker needed)
curl -sSL .../install.sh | bash -s -- --ide-only

# Tools only (Docker, kubectl, Helm, Terraform, AWS CLI, jq, git)
curl -sSL .../install.sh | bash -s -- --tools-only

# Check status
./install.sh --status

# Uninstall everything
./install.sh --uninstall
```

---

### Method 3: Quick Docker Run (Pre-built Images)

No build required — pulls from Docker Hub directly.

```bash
# IDE only
docker run -d -p 8101:3456 --name cloud-ide sriniv7654/devops-single:cloud-ide-latest
# Open: http://localhost:8101 — Login: admin / sri@123

# Full stack (IDE + Kyma Dashboard)
docker run -d -p 8101:3456 --name cloud-ide sriniv7654/devops-single:cloud-ide-latest
docker run -d -p 8100:8100 -e DEV_SKIP_AUTH=true --name kyma-backend sriniv7654/devops-single:kyma-backend-latest
docker run -d -p 3000:80 --link kyma-backend -e BACKEND_URL=kyma-backend:8100 --name kyma-frontend sriniv7654/devops-single:kyma-frontend-latest
```

---

### Method 4: Local Development (No Docker)

```bash
git clone https://github.com/srinivaskona7/devops-single.git && cd devops-single
cd proxy && npm install
PORT=8101 node server.js
# Open: http://localhost:8101
```

---

## Docker Images

All images live under `sriniv7654/devops-single` with different tags:

| Tag | Size | Description |
|-----|------|-------------|
| `cloud-ide-latest` | ~190MB | IDE proxy + 16 panels + static frontend |
| `kyma-backend-latest` | ~250MB | Fastify API + kubectl + helm |
| `kyma-frontend-latest` | ~40MB | React SPA via nginx |

## Ports

| Port | Service | Description |
|------|---------|-------------|
| 8101 | Cloud IDE | Browser IDE with SSH proxy |
| 8100 | Kyma API | Backend REST API + kubectl |
| 3000 | Kyma Dashboard | React frontend via nginx |

## Credentials

| Service | Username | Password |
|---------|----------|----------|
| Cloud IDE | `admin` | `sri@123` |
| SSH (example) | `root` | (your server password) |

---

## Features (20 VS Code-like + 16 Panels)

### Editor Features
| Feature | Shortcut | Description |
|---------|----------|-------------|
| Find & Replace | `Ctrl+F` / `Ctrl+H` | Regex, case-sensitive, whole word, replace all |
| Go to Line | `Ctrl+G` | Jump to line:column |
| Font Zoom | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | Zoom in/out/reset |
| Auto-save | — | 1.5s debounce, status indicator |
| Tab Context Menu | Right-click tab | Close, Close Others, Close All, Copy Path |
| Modified Indicator | — | Dot on unsaved tabs |
| Keyboard Shortcuts | `Ctrl+K Ctrl+S` | Full shortcut reference panel |
| Command Palette | `Ctrl+Shift+P` | All commands + 5 themes |
| Quick Open | `Ctrl+P` | Fuzzy file search |

### Explorer Features
| Feature | Description |
|---------|-------------|
| Inline Add File/Folder | Input appears directly in tree (VS Code style) |
| Inline Rename | Double-click to rename |
| Copy Path | Right-click → Copy Path / Copy Relative Path |
| Duplicate File | Right-click → Duplicate |
| Download File | Right-click → Download |
| Drag & Drop Upload | Overlay with progress indicators |
| File Size Display | Shown on hover |
| Collapse All | Button in toolbar |
| Breadcrumb Navigation | Click path segments for sibling dropdown |

### DevOps Panels (16 total)
| Panel | Features |
|-------|----------|
| **DevOps Tools** | One-click install: Docker, Terraform, AWS CLI, kubectl, Helm |
| **Git** | Branch, status, stage, commit, push, pull, history |
| **Docker** | Containers, images, start/stop/restart/logs/exec/rm |
| **Kubernetes** | 11 resource tabs, YAML editor, exec, port-forward, scale |
| **Helm Charts** | Search, install, releases, repos, upgrade, uninstall |
| **Templates** | 30 CNCF templates (databases, monitoring, service mesh) |
| **Nginx** | Config viewer/editor, test, reload, virtual host creator |
| **Certificates** | Let's Encrypt via certbot, generate/renew/revoke |
| **Linux Admin** | CPU/RAM/disk, processes, services, users, cron, firewall |
| **Log Viewer** | Tail any log, filter, journalctl |
| **Network Tools** | Ping, dig, traceroute, curl, port scan, SSL check, whois |
| **CI/CD & Ansible** | GitHub Actions, GitLab Runner, Ansible playbook runner |
| **Kyma Dashboard** | Full K8s management (34 pages, Helm, Istio, OIDC) |
| **Settings** | Font size, tab size, word wrap, minimap, 5 themes |

### Kyma Dashboard
| Feature | Description |
|---------|-------------|
| Cluster Overview | Resource donuts, node stats, health indicators |
| 34 Resource Pages | Pods, Deployments, Services, Ingresses, ConfigMaps, Secrets... |
| Cluster Connect | Upload kubeconfig, switch clusters (like dashboard.kyma.cloud.sap) |
| Helm Management | Install, upgrade, rollback with streaming output |
| Istio | VirtualServices, Gateways, DestinationRules |
| YAML Editor | Apply manifests with dry-run |
| OIDC Support | Keycloak or bypass mode |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Production Stack                       │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Cloud IDE (Native Node.js on host)                 │ │
│  │  Port: 8101                                         │ │
│  │  - HTTP static server (index.html, JS, CSS)         │ │
│  │  - WebSocket SSH proxy (ssh2 library)               │ │
│  │  - SFTP file operations                             │ │
│  │  - systemd managed (auto-restart)                   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │  Kyma Backend (:8100) │  │  Kyma Frontend (:3000)   │ │
│  │  Docker container     │  │  Docker container        │ │
│  │  Fastify + kubectl    │  │  React + nginx           │ │
│  │  + helm + 60 APIs     │  │  + Vite + Tailwind       │ │
│  │  DEV_SKIP_AUTH=true   │  │  VITE_SKIP_AUTH=true     │ │
│  └──────────────────────┘  └──────────────────────────┘ │
│                                                          │
│  Volumes:                                                │
│    /opt/cloud-ide/data         → IDE persistent config   │
│    /opt/cloud-ide/kubeconfigs  → uploaded kubeconfigs     │
│    kyma-generated              → backend generated files  │
└──────────────────────────────────────────────────────────┘
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8101` | Cloud IDE proxy port |
| `IDE_PORT` | `8101` | Same as PORT (for install.sh) |
| `KYMA_API_PORT` | `8100` | Kyma backend API port |
| `KYMA_UI_PORT` | `3000` | Kyma frontend port |
| `DEV_SKIP_AUTH` | `true` | Skip OIDC/Keycloak auth |
| `VITE_SKIP_AUTH` | `true` | Skip frontend auth (build-time) |
| `KUBECONFIG` | `/kubeconfig/config.yaml` | Kubeconfig path in backend |
| `IMAGE_TAG` | `latest` | Docker image tag |
| `INSTALL_DIR` | `/opt/cloud-ide` | Installation directory |
| `NODE_ENV` | `production` | Environment |

## Volumes

| Path | Purpose |
|------|---------|
| `/opt/cloud-ide/data` | IDE persistent configuration |
| `/opt/cloud-ide/kubeconfigs` | Uploaded kubeconfig files |
| `kyma-generated` (Docker volume) | Backend generated files |

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `install.sh` | Interactive installer (13 menu options) |
| `deploy.sh` | Full CI/CD pipeline (clone → build → push → deploy) |
| `build-kyma.sh` | Build Kyma images only (with auth bypass) |
| `build-push.sh` | Build and push all images to Docker Hub |
| `deploy-ec2.sh` | EC2-specific deployment |

## Commands Cheat Sheet

```bash
# Check status
./install.sh --status

# View logs
docker logs -f kyma-manager-backend
journalctl -u cloud-ide-proxy -f

# Restart services
sudo systemctl restart cloud-ide-proxy
docker restart kyma-manager-backend kyma-manager-frontend

# Update to latest
cd /opt/cloud-ide && git pull && sudo systemctl restart cloud-ide-proxy

# Upload kubeconfig
cp /path/to/kubeconfig.yaml /opt/cloud-ide/kubeconfigs/

# Cleanup
docker image prune -f && docker builder prune -f
```

## Browser Support

- Chrome 90+, Firefox 88+, Safari 15+, Edge 90+
- Mobile responsive (390px — 4K)
- 5 themes: Dark (default), Monokai, Dracula, Nord, Solarized

## License

MIT
