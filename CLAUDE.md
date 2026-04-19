# CLAUDE.md — Cloud IDE Project Context

> Single source of truth for ALL AI coding assistants. Read this FIRST before any changes.
>
> **Claude:** Auto-loaded from CLAUDE.md (keep both files in sync).
> **Gemini:** Paste this file as context or use @AGENTS.md.
> **Codex/Copilot:** Auto-indexed from repo root.
> **Cursor:** Add to .cursorrules or paste as context.
>
> **RULE:** Update BOTH AGENTS.md and CLAUDE.md when adding panels, message types, or architecture changes.

## What This Project Is

A browser-based DevOps IDE that connects to remote servers via SSH. No install needed — runs in any browser. Ships as a single Docker image (~190MB). Has 16 sidebar panels, 30 deploy templates, embedded Kyma/K8s dashboard, and full Linux admin tools.

**Login:** admin / sri@123
**URL:** http://localhost:3456
**Stack:** Vanilla JS (no framework, no build step) + Node.js WebSocket proxy + Docker

## How It Works

```
User opens browser → Auth Screen → Home Screen (5 options) → SSH Login → IDE loads
                                                                          ↓
Browser ←──WebSocket──→ Node.js Proxy (:3456) ←──SSH2──→ Remote Server (:22)
                                               ←──SFTP──→ Remote Files
                        Kyma Backend (:8100) ←──kubectl──→ K8s API
                        Kyma Frontend (:3000) ←──iframe──→ Browser
```

## File Map (every file, what it does)

### HTML
- `index.html` — Single page. Contains 3 screens (auth, home, SSH login), IDE workspace with 16 sidebar panels, activity bar, editor, terminal, status bar, context menu. No build step — loads scripts directly.

### JavaScript (20 files, all vanilla ES2020, no imports)
| File | Class | What It Does |
|------|-------|-------------|
| `js/connection.js` | `Connection` | WebSocket client. SSH auth, file ops (SFTP), exec commands, auto-reconnect with backoff. Extends EventTarget. |
| `js/app.js` | `App` | Main orchestrator. Auth flow, init/dispose all panels, keyboard shortcuts, settings persistence, notifications. Entry: `window.app = new App()` |
| `js/editor.js` | `EditorManager` | Monaco Editor wrapper. Tabs, models, save (Ctrl+S), language detection, file size guard (>5MB blocked). |
| `js/terminal.js` | `TerminalManager` | xterm.js wrapper. UTF-8 binary decode, debounced resize, ResizeObserver. |
| `js/fileExplorer.js` | `FileExplorer` | SFTP file tree. Expand/collapse dirs, select, context menu, hidden files toggle, file cache. |
| `js/splitPane.js` | `SplitPane` | Mouse drag to resize sidebar width and terminal height. |
| `js/features.js` | `MultiTerminal, FileTransfer, SSHKeyManager, Breadcrumbs, NotificationCenter` | 5 utility classes. Multi-tab terminals, drag-drop upload, file download, path breadcrumbs, notification history. |
| `js/commandPalette.js` | `CommandPalette` | Ctrl+Shift+P overlay. Fuzzy search all commands. 5 theme switcher (Dark, Monokai, Dracula, Nord, Solarized). Saves to localStorage. |
| `js/devopsPanel.js` | `DevOpsPanel` | Installs Docker, Terraform, AWS CLI, kubectl, Helm. Idempotent scripts for apt/yum/dnf/apk/brew. Streaming output. |
| `js/gitPanel.js` | `GitPanel` | Git branch viewer, status, stage, commit, push, pull, log history. |
| `js/dockerPanel.js` | `DockerPanel` | Docker containers + images list. Start/stop/restart/logs/exec/rm. |
| `js/k8sPanel.js` | `K8sPanel` | Full K8s dashboard. 11 resource tabs (pods, deployments, services, ingresses, configmaps, secrets, statefulsets, daemonsets, nodes, events, helm). YAML editor with apply. Exec, port-forward, scale, Helm install. |
| `js/helmPanel.js` | `HelmPanel` | Helm chart search, install with values override, release list, repos add/remove, upgrade, uninstall. |
| `js/templatesPanel.js` | `TemplatesPanel` | 30 one-click deploy templates. Categories: Hello World, Databases, Messaging, Observability, Security, Networking, GitOps, Storage, Kubernetes, Full Stack. |
| `js/nginxPanel.js` | `NginxPanel` | Nginx config viewer/editor, test (`nginx -t`), reload, virtual host creator (proxy_pass or static root), log viewer. |
| `js/certPanel.js` | `CertPanel` | Let's Encrypt via certbot. Generate certs (HTTP-01, webroot, nginx plugin, DNS-01), list, renew, revoke, download as tar.gz. |
| `js/linuxAdminPanel.js` | `LinuxAdminPanel` | System dashboard: CPU/RAM/disk, top processes (kill), services (start/stop), users (add), cron (add job), firewall (allow/deny port). |
| `js/adminPanels.js` | `LogViewerPanel, NetworkToolsPanel, CICDPanel` | Log tail with filter + journalctl. Network: ping/dig/traceroute/curl/port-check/SSL-check/whois. CI/CD: GitHub Actions, GitLab Runner, Ansible playbook runner. |
| `js/kymaPanel.js` | `KymaPanel` | Embeds Kyma Dashboard (port 3000) as iframe. Falls back to kubectl cluster info if dashboard unavailable. |
| `js/kymaConsole.js` | `KymaConsole` | Full Busola-compatible console with Cluster View + Namespace View. Cluster: Overview, Namespaces, Events, Storage (PV/SC), Configuration (ClusterRoles/CRDs/Modules), Kyma (APIGateway/Telemetry/Pipelines). Namespace: Workloads (7 types), Discovery & Network (7 types), Istio (8 types), Service Management, Storage (PVC), Apps (Helm), Configuration (11 types including Certificates/DNS/Issuers). |

### CSS (2 files)
- `css/theme.css` — Full design system. CSS variables for colors/spacing/transitions. Soft dark palette (#131720 base). Styles for all 16 panels, dropdown accordions, admin grids, responsive breakpoints (768px, 480px), touch targets, focus-visible, reduced-motion, fullscreen.
- `css/login.css` — Auth screen + SSH login form styles.

### Backend
- `proxy/server.js` — Node.js HTTP + WebSocket server. Serves static files with gzip + ETag cache. WebSocket handles 17 message types (auth, terminal, file ops, exec, search, devops). Graceful shutdown. SFTP race condition guard.
- `proxy/package.json` — Dependencies: `ssh2` ^1.17.0, `ws` ^8.20.0 only.

### Docker
- `Dockerfile` — 3-stage build (deps → minify → runtime). node:20-alpine. tini init. Non-root. ~190MB.
- `docker-compose.yml` — 3 services: cloud-ide (:3456), kyma-backend (:8100), kyma-frontend (:3000).
- `.dockerignore` — Excludes .git, node_modules, images, docs, playwright cache.

### Deployment
- `deploy-ec2.sh` — Idempotent EC2 deploy. Installs Docker + Compose, pulls Kyma images, builds IDE, starts all services, waits for health checks.

## Kyma Console Structure (1:1 with dashboard.kyma.cloud.sap)

### Cluster View
```
▶ Cluster Overview (K8s version, nodes, CPU/mem, API server)
▶ Namespaces
▶ Events
▶ Storage
│   ├── Persistent Volumes
│   └── Storage Classes
▶ Configuration
│   ├── Cluster Role Bindings    ├── Custom Resources
│   ├── Cluster Roles            ├── Extensions
│   └── Custom Resource Definitions  └── Modules
▶ Kyma
    ├── APIGateway               ├── Metric Pipelines
    ├── Telemetry                └── Trace Pipelines
    └── Log Pipelines
```

### Namespace View
```
▶ Namespace Overview (health counts)
▶ Events
▶ Workloads
│   Pods · Deployments · StatefulSets · DaemonSets · ReplicaSets · Jobs · CronJobs
▶ Discovery & Network
│   API Rules · HPAs · Ingresses · LimitRanges · NetworkPolicies · ResourceQuotas · Services
▶ Istio
│   AuthorizationPolicies · DestinationRules · Gateways · RequestAuthentications
│   ServiceEntries · Sidecars · Telemetries · VirtualServices
▶ Service Management
│   Service Bindings · Service Instances
▶ Storage
│   PersistentVolumeClaims
▶ Apps
│   Helm Releases
▶ Configuration
│   Certificates · ConfigMaps · CustomResources · DNS Entries · DNS Providers
│   Issuers · Modules · RoleBindings · Roles · Secrets · ServiceAccounts
```

## Panel Responsibility Map

The IDE has 16 sidebar panels split into two contexts:

### Linux Server Panels (work via SSH on ANY server)
| # | Panel | Domain |
|---|-------|--------|
| 1 | **Explorer** | File tree, drag-drop upload/download |
| 2 | **Search** | Remote grep with highlighting |
| 3 | **DevOps Tools** | Install Docker/Terraform/AWS CLI/kubectl/Helm |
| 4 | **Git** | Branch, commit, push, pull, history |
| 5 | **Docker** | Containers + images management |
| 8 | **Templates** | 30 one-click CNCF deploy templates |
| 9 | **Nginx** | Config editor, vhost creator, test/reload |
| 10 | **Certificates** | Let's Encrypt certbot generation/download |
| 11 | **Linux Admin** | CPU/RAM, processes, services, firewall, users, cron |
| 12 | **Log Viewer** | Tail files, journalctl, filter |
| 13 | **Network Tools** | ping, dig, curl, SSL check, port scan, whois |
| 14 | **CI/CD & Ansible** | GitHub Actions, GitLab Runner, Ansible playbook runner |
| 16 | **Settings** | Font size, tab size, word wrap, minimap, 5 themes |

### Kubernetes Panels (require kubeconfig on the server)
| # | Panel | Domain |
|---|-------|--------|
| 6 | **K8s** | Quick kubectl ops: YAML apply, exec pod, port-forward, scale |
| 7 | **Helm** | Chart search, install, releases, repos, upgrade, uninstall |
| 15 | **Kyma Dashboard** | Busola-compatible: Cluster View (6 groups) + Namespace View (9 groups), iframe embed |

**Do NOT mix features between panels.** Linux panels should not contain K8s resources. K8s/Kyma panels should not contain Linux admin tools.

## App Flow (step by step)

1. **Auth Screen** (`#auth-screen`) — Username/password form. Hardcoded check: admin/sri@123. On success → hide auth, show home.
2. **Home Screen** (`#home-screen`) — 5 clickable options: SSH Connect, K8s Dashboard, DevOps Templates, Srinivas App, Kyma Dashboard. All route to SSH login (for now).
3. **SSH Login** (`#login-screen`) — Proxy URL, SSH host/port, username, password or SSH key. "Remember" saves to localStorage (no secrets).
4. **Connect** — `Connection.connect(config)` → WebSocket to proxy → proxy does SSH2 handshake → auth:success with home path → `App.showIDE()`.
5. **IDE Init** (`App.initIDE()`) — Creates all managers/panels in order: FileExplorer → EditorManager → TerminalManager → SplitPane → DevOpsPanel → GitPanel → DockerPanel → K8sPanel → HelmPanel → TemplatesPanel → NginxPanel → CertPanel → KymaPanel → KymaConsole → LinuxAdminPanel → LogViewerPanel → NetworkToolsPanel → CICDPanel → CommandPalette → Breadcrumbs → FileTransfer.
6. **Panel Toggle** — Activity bar buttons have `data-panel="X"`. Click handler removes active from all, adds to clicked, shows `#panel-X`. Automatic — no per-panel wiring needed.
7. **Cleanup** (`App.cleanupIDE()`) — Disposes all panels, clears DOM, resets state. Called on disconnect.

## WebSocket Protocol

All messages are JSON. Client sends `{ type, ...data }`. Server responds with matching type.

| Type | Direction | Purpose |
|------|-----------|---------|
| `auth` | Client→Server | SSH credentials (host, port, user, password/key) |
| `auth:success` | Server→Client | SSH connected, includes home path |
| `auth:error` | Server→Client | SSH auth failed |
| `terminal` | Bidirectional | Terminal I/O (base64 encoded) |
| `terminal:resize` | Client→Server | PTY window resize |
| `terminal:new` | Client→Server | Create additional terminal session |
| `terminal:write` | Client→Server | Write to extra terminal |
| `terminal:data` | Server→Client | Data from extra terminal |
| `fs:list` | Request/Response | SFTP readdir |
| `fs:read` | Request/Response | SFTP read file |
| `fs:write` | Request/Response | SFTP write file |
| `fs:mkdir` | Request/Response | SFTP mkdir |
| `fs:delete` | Request/Response | SSH rm -rf (recursive) |
| `fs:rename` | Request/Response | SFTP rename |
| `fs:stat` | Request/Response | SFTP stat |
| `fs:upload` | Request/Response | Binary upload (base64) |
| `fs:download` | Request/Response | Binary download (base64) |
| `exec` | Request/Response | One-shot SSH command, returns stdout/stderr/code |
| `exec:stream` | Client→Server | Streaming SSH command |
| `exec:stream:data` | Server→Client | Stream output line |
| `exec:stream:done` | Server→Client | Stream finished with exit code |
| `search` | Request/Response | Remote grep across files |
| `devops:detect` | Request/Response | Detect OS, package manager, shell, sudo, arch |
| `devops:detect-tool` | Request/Response | Check if tool installed + version |
| `devops:exec` | Client→Server | Streaming install script |
| `devops:output` | Server→Client | Install output line |
| `devops:done` | Server→Client | Install finished |

## How to Add a New Panel

1. **Create `js/newPanel.js`** with a class:
```javascript
class NewPanel {
  constructor(connection) { this.connection = connection; }
  init() { document.getElementById('new-refresh')?.addEventListener('click', () => this.refresh()); }
  async refresh() { /* use this.connection.exec('command') */ }
  dispose() {}
}
window.NewPanel = NewPanel;
```

2. **Add to `index.html`:**
   - Activity bar button: `<button class="activity-btn" data-panel="new" title="New Panel"><svg>...</svg></button>` (before `activity-spacer`)
   - Sidebar panel: `<div class="sidebar-panel" id="panel-new">...</div>` (before sidebar close)
   - Script tag: `<script src="js/newPanel.js"></script>` (before app.js)

3. **Wire in `js/app.js`:**
   - Constructor: `this.newPanel = null;`
   - `initIDE()`: `this.newPanel = new NewPanel(this.connection); this.newPanel.init();`
   - `cleanupIDE()`: `if (this.newPanel) { this.newPanel.dispose(); this.newPanel = null; }`

4. **Panel auto-toggles** — the `data-panel="new"` attribute + `id="panel-new"` makes it work automatically with the existing activity bar click handler. No extra JS needed.

## How to Add a New Proxy Message Type

1. In `proxy/server.js`, add handler before the `fs:` block:
```javascript
if (msg.type === 'mytype') {
  sshClient.exec(msg.command, (err, stream) => {
    if (err) return send({ type: 'mytype:result', id: msg.id, error: err.message });
    let output = '';
    stream.on('data', (d) => { output += d.toString(); });
    stream.on('close', (code) => { send({ type: 'mytype:result', id: msg.id, output, code }); });
  });
  return;
}
```

2. In `js/connection.js`, add method:
```javascript
myMethod(args) { return this.request('mytype', { ...args }); }
```

## CSS Theme System

All colors use CSS custom properties. The 5 themes override these at runtime via `document.documentElement.style.setProperty()`. Key variables:

| Variable | Default (Dark) | Purpose |
|----------|---------------|---------|
| `--bg-primary` | `#131720` | Main background |
| `--bg-secondary` | `#1a1f2e` | Sidebar, tab bar |
| `--bg-tertiary` | `#212736` | Cards, inputs |
| `--bg-terminal` | `#0f1319` | Terminal background |
| `--text-primary` | `#b8c0cc` | Body text |
| `--text-bright` | `#e2e8f0` | Headings |
| `--text-muted` | `#5c6470` | Secondary text |
| `--accent` | `#7578e8` | Primary accent (indigo) |
| `--accent-green` | `#34d399` | Success states |
| `--accent-red` | `#f87171` | Error states |
| `--accent-orange` | `#fbbf24` | Warning states |

## Docker Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `cloud-ide` | `cloud-ide:latest` (built) | 3456 | IDE proxy + frontend |
| `kyma-backend` | `sriniv7654/kyma-dashboard-backend:latest` | 8100 | Fastify API + kubectl + helm |
| `kyma-frontend` | `sriniv7654/kyma-dashboard-frontend:latest` | 3000 | React SPA via nginx |

## Quick Reference

```bash
# Run locally (no Docker)
cd proxy && npm install && PORT=3456 node server.js

# Run with Docker
docker compose up -d

# Deploy to EC2
./deploy-ec2.sh

# Check health
curl http://localhost:3456/health

# Open browser
open http://localhost:3456
```

## Known Constraints

- SSH proxy runs commands via `sshClient.exec()` — needs SSH access to target server
- Kyma Dashboard iframe requires `sriniv7654/kyma-dashboard-*` images running (docker compose)
- No persistent backend database — all state is on the remote server or in browser localStorage
- Auth is client-side only (admin/sri@123) — add proper auth for production
- File operations use SFTP — binary files work but large files (>5MB) are blocked in editor

## Update This File When

- Adding a new panel (add to File Map table + "How to Add a New Panel" if pattern changes)
- Adding a new WebSocket message type (add to Protocol table)
- Changing the init order in app.js
- Adding new CSS variables
- Adding new Docker services
- Changing auth flow or credentials
