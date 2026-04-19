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
│  Cloud IDE (ws://proxy:3456)  ←→  SSH Server (sshd:22)     │
│  Kyma Dashboard (:8100)       ←→  K8s API (kubeconfig)     │
└─────────────────────────────────────────────────────────────┘
```

## Docker Images (Single Repo)

All images live under `sriniv7654/devops-single` with different tags:

| Tag | Size | Description |
|-----|------|-------------|
| `cloud-ide` / `cloud-ide-v1` | ~190MB | IDE proxy + 16 panels + static frontend |
| `kyma-backend` / `kyma-backend-v1` | ~250MB | Fastify API + kubectl + helm |
| `kyma-frontend` / `kyma-frontend-v1` | ~40MB | React SPA via nginx |

## Quick Start

### Option 1: Run from Docker Hub (fastest)
```bash
# IDE only (no K8s dashboard)
docker run -d -p 3456:3456 --name cloud-ide sriniv7654/devops-single:cloud-ide
# Open: http://localhost:3456 — Login: admin / sri@123

# Full stack (IDE + Kyma Dashboard)
docker run -d -p 3456:3456 --name cloud-ide sriniv7654/devops-single:cloud-ide
docker run -d -p 8100:8100 --name kyma-backend sriniv7654/devops-single:kyma-backend
docker run -d -p 3000:80 --name kyma-frontend -e BACKEND_URL=kyma-backend:8100 sriniv7654/devops-single:kyma-frontend
```

### Option 2: Docker Compose (Recommended)
```bash
git clone <repo> cloud-ide && cd cloud-ide

# Start everything (IDE + Kyma Dashboard)
docker compose up -d

# Open: http://localhost:3456
# Login: admin / sri@123
```

### Option 2: Docker Run (IDE Only)
```bash
docker build -t cloud-ide .
docker run -d --name cloud-ide \
  -p 3456:3456 \
  -v cloud-ide-data:/app/data \
  -v ~/.kube:/app/.kube:ro \
  --restart unless-stopped \
  cloud-ide:latest

# Open: http://localhost:3456
```

### Option 3: EC2 Deployment
```bash
# One-click deploy script
chmod +x deploy-ec2.sh && ./deploy-ec2.sh

# Or manually:
sudo yum install -y docker && sudo systemctl start docker
docker compose up -d
# Open: http://<ec2-ip>:3456
```

### Option 4: Local Development (No Docker)
```bash
cd proxy && npm install && PORT=3456 node server.js
# Open: http://localhost:3456
```

---

## Features (15 Panels + Kyma Dashboard)

### IDE Core
| Feature | Shortcut | Description |
|---------|----------|-------------|
| Monaco Editor | — | Syntax highlighting, 50+ languages, v0.55.1 |
| Terminal | Ctrl+\` | xterm.js with search, unicode11, multi-tab |
| File Explorer | Ctrl+Shift+E | Tree view, drag-drop upload, download |
| Quick Open | Ctrl+P | Fuzzy file search |
| Command Palette | Ctrl+Shift+P | All commands + 5 themes |
| Fullscreen | F11 / button | Fullscreen toggle |
| Search | Ctrl+Shift+F | Grep across files with highlighting |

### DevOps Panels
| Panel | Features |
|-------|----------|
| **DevOps Tools** | One-click install: Docker, Terraform, AWS CLI, kubectl, Helm |
| **Git** | Branch, status, stage, commit, push, pull, history |
| **Docker** | Containers, images, start/stop/restart/logs/exec/rm |
| **Kubernetes** | 11 resource tabs, YAML editor, exec, port-forward, scale, Helm |
| **Helm Charts** | Search, install, releases, repos, upgrade, uninstall, values |
| **Templates** | 30 CNCF templates (databases, monitoring, service mesh, K8s clusters) |
| **Nginx** | Config viewer/editor, test, reload, virtual host creator |
| **Certificates** | Let's Encrypt via certbot, generate/renew/revoke/download ZIP |
| **Linux Admin** | CPU/RAM/disk, processes, services, users, cron, firewall |
| **Log Viewer** | Tail any log, filter, journalctl, quick file picker |
| **Network Tools** | Ping, dig, traceroute, curl, port scan, SSL check, whois |
| **CI/CD & Ansible** | GitHub Actions, GitLab Runner, Ansible playbook runner |
| **Settings** | Font size, tab size, word wrap, minimap, 5 color themes |

### Kyma Dashboard (Embedded)
| Feature | Description |
|---------|-------------|
| Cluster Overview | Resource donuts, node stats, health indicators |
| 34 Resource Pages | Pods, Deployments, StatefulSets, Services, Ingresses, ConfigMaps, Secrets, etc. |
| Helm Management | Install, upgrade, rollback with streaming output |
| Istio | VirtualServices, Gateways, DestinationRules, AuthorizationPolicies |
| Kyma Extensions | API Rules, Functions, Subscriptions, Modules |
| Terminal | kubectl/helm command runner |
| YAML Editor | Apply manifests with dry-run |
| OIDC Auth | Keycloak integration |

### 30 One-Click Deploy Templates

**Hello World:** Nginx, Node.js Express, Python Flask, Go HTTP, Rust Actix

**Databases:** Redis, PostgreSQL, MySQL, MongoDB

**Messaging:** RabbitMQ, Apache Kafka, NATS

**CNCF Observability:** Prometheus, Grafana, Jaeger, Loki

**CNCF Security:** HashiCorp Vault, cert-manager

**CNCF Networking:** Consul, Traefik, Envoy

**CNCF GitOps:** ArgoCD, Flux CD

**Storage:** MinIO S3, etcd

**Kubernetes:** K3s, KinD, Minikube

**Full Stack:** React + Express + PostgreSQL

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
│                                                          │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │  cloud-ide:3456  │  │  kyma-dashboard-backend:8100 │  │
│  │  Node.js Proxy   │  │  Fastify + kubectl + helm    │  │
│  │  + Static Files  │  │  60+ K8s API endpoints       │  │
│  │  + WebSocket SSH │  │  JWT/OIDC auth               │  │
│  └────────┬─────────┘  └──────────┬───────────────────┘  │
│           │                       │                      │
│  ┌────────┴─────────┐  ┌─────────┴───────────────────┐  │
│  │  Frontend (HTML)  │  │  kyma-dashboard-frontend    │  │
│  │  15 vanilla JS    │  │  React 18 + Vite + Tailwind │  │
│  │  panels           │  │  34 pages (code-split)      │  │
│  │  Monaco + xterm   │  │  Embedded via iframe        │  │
│  └──────────────────┘  └─────────────────────────────┘  │
│                                                          │
│  Volumes: /app/data, /app/.kube (kubeconfig)             │
└──────────────────────────────────────────────────────────┘
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3456` | Cloud IDE proxy port |
| `DASHBOARD_URL` | `http://kyma-backend:8100` | Kyma dashboard backend URL |
| `KUBECONFIG` | `/app/.kube/config` | Path to kubeconfig file |
| `DEV_SKIP_AUTH` | `false` | Skip OIDC auth in dev mode |
| `NODE_ENV` | `production` | Environment |

## Build & Push (for maintainers)

```bash
# Login to Docker Hub
docker login

# Build and push all images to sriniv7654/devops-single
./build-push.sh v1

# This pushes:
#   sriniv7654/devops-single:cloud-ide-v1
#   sriniv7654/devops-single:cloud-ide
#   sriniv7654/devops-single:kyma-backend-v1
#   sriniv7654/devops-single:kyma-backend
#   sriniv7654/devops-single:kyma-frontend-v1
#   sriniv7654/devops-single:kyma-frontend

# Deploy a specific version
IMAGE_TAG=v1 docker compose up -d

# Deploy latest
docker compose up -d
```

## Docker Image Details

| Property | Value |
|----------|-------|
| Base | `node:20-alpine` |
| Init | `tini` (PID 1 signal handling) |
| User | `node` (non-root, uid=1000) |
| Stages | 3 (deps → minify → runtime) |
| Size | ~190MB (IDE only), ~450MB (with dashboard) |
| Health | `GET /health` every 15s |
| Graceful shutdown | SIGTERM → close connections → exit |

## Ports

| Port | Service |
|------|---------|
| 3456 | Cloud IDE (proxy + frontend) |
| 8100 | Kyma Dashboard backend API |
| 3000 | Kyma Dashboard frontend (nginx) |

## Volume Mounts

```yaml
volumes:
  - cloud-ide-data:/app/data          # Persistent IDE config
  - cloud-ide-templates:/app/templates # Custom templates
  - ~/.kube:/app/.kube:ro             # Kubeconfig (read-only)
```

## Security

- Auth: admin/sri@123 (configurable)
- Non-root container (uid=1000)
- Read-only filesystem + tmpfs
- No-new-privileges security option
- Graceful shutdown on SIGTERM/SIGINT
- Gzip compression + ETag caching
- WebSocket keepalive (30s ping/pong)
- Input escaping for SSH commands

## Browser Support

- Chrome 90+, Firefox 88+, Safari 15+, Edge 90+
- Mobile responsive (390px — 4K)
- Touch-friendly (44px+ touch targets)
- Keyboard accessible (focus-visible)
- Reduced motion support
- 5 themes: Dark (default), Monokai, Dracula, Nord, Solarized

## Development

```bash
# Run proxy with hot reload
cd proxy && npm install
PORT=3456 node server.js

# Run Kyma dashboard in dev mode
cd ../btp-terraform/dashboard
docker compose -f docker-compose.dev.yml up

# All services
docker compose up --build
```

## License

MIT
