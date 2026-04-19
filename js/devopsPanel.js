class DevOpsPanel {
  constructor(connection) {
    this.connection = connection;
    this.osInfo = null;
    this.tools = this._defineTools();
    this.toolStatus = {};
    this.activeInstall = null;
    this._execId = null;
    this._outputHandler = null;
    this._doneHandler = null;
  }

  _defineTools() {
    return [
      { id: 'docker', name: 'Docker', icon: '\u{1F433}', iconBg: 'rgba(34,211,238,0.12)', checkCmd: 'docker --version 2>/dev/null', versionRe: /Docker version ([^\s,]+)/ },
      { id: 'terraform', name: 'Terraform', icon: '\u{1F3D7}', iconBg: 'rgba(99,102,241,0.12)', checkCmd: 'terraform version 2>/dev/null | head -1', versionRe: /v([0-9.]+)/ },
      { id: 'awscli', name: 'AWS CLI', icon: '\u2601', iconBg: 'rgba(251,191,36,0.12)', checkCmd: 'aws --version 2>/dev/null', versionRe: /aws-cli\/([^\s]+)/ },
      { id: 'kubectl', name: 'kubectl', icon: '\u2388', iconBg: 'rgba(52,211,153,0.12)', checkCmd: 'kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1', versionRe: /v?([0-9]+\.[0-9]+\.[0-9]+)/ },
      { id: 'helm', name: 'Helm', icon: '\u26F5', iconBg: 'rgba(167,139,250,0.12)', checkCmd: 'helm version --short 2>/dev/null', versionRe: /v?([0-9]+\.[0-9]+\.[0-9]+)/ },
    ];
  }

  init() {
    this._outputHandler = (e) => this._onOutput(e.detail);
    this._doneHandler = (e) => this._onDone(e.detail);
    this.connection.addEventListener('devops:output', this._outputHandler);
    this.connection.addEventListener('devops:done', this._doneHandler);

    document.getElementById('devops-refresh')?.addEventListener('click', () => this.detectOS());
    document.getElementById('devops-install-all')?.addEventListener('click', () => this.installAll());
  }

  async detectOS() {
    const statusEl = document.getElementById('devops-status');
    statusEl.className = 'devops-status';
    statusEl.innerHTML = '<span class="devops-status-text">Detecting remote OS...</span>';
    try {
      const r = await this.connection.request('devops:detect', {});
      if (r.error) throw new Error(r.error);
      this.osInfo = { osId: r.osId, pkgManager: r.pkgManager, shellRc: r.shellRc, hasSudo: r.hasSudo, arch: r.arch };
      const label = this._osLabel(r.osId);
      let html = `<span class="devops-status-text">${label} \u2022 ${r.pkgManager} \u2022 ${r.arch}`;
      if (!r.hasSudo) html += ' \u2022 <span style="color:var(--accent-orange)">no sudo</span>';
      html += '</span>';
      statusEl.innerHTML = html;
      statusEl.className = 'devops-status detected';
      await this.checkAllTools();
    } catch (err) {
      statusEl.className = 'devops-status error';
      statusEl.innerHTML = `<span class="devops-status-text">Detection failed: ${err.message}</span>`;
    }
  }

  _osLabel(id) {
    const m = { ubuntu: 'Ubuntu', debian: 'Debian', centos: 'CentOS', rhel: 'RHEL', fedora: 'Fedora', alpine: 'Alpine', amzn: 'Amazon Linux', macos: 'macOS' };
    return m[id] || id;
  }

  async checkAllTools() {
    const promises = this.tools.map(async (tool) => {
      try {
        const r = await this.connection.request('devops:detect-tool', { tool: tool.id, command: tool.checkCmd });
        let ver = '';
        if (r.installed && r.version && tool.versionRe) {
          const match = r.version.match(tool.versionRe);
          if (match) ver = match[1];
        }
        this.toolStatus[tool.id] = { installed: r.installed, version: ver };
      } catch {
        this.toolStatus[tool.id] = { installed: false, version: '' };
      }
    });
    await Promise.all(promises);
    this.render();
  }

  render() {
    const container = document.getElementById('devops-cards');
    container.innerHTML = '';
    this.tools.forEach((tool) => {
      const s = this.toolStatus[tool.id] || { installed: false, version: '' };
      const card = document.createElement('div');
      card.className = 'devops-card';
      card.id = `devops-card-${tool.id}`;

      const badgeClass = s.installed ? 'installed' : 'not-installed';
      const badgeText = s.installed ? 'Installed' : 'Not Installed';
      const versionText = s.installed && s.version ? `v${s.version}` : 'Not found';

      card.innerHTML = `
        <div class="devops-card-header" data-tool="${tool.id}">
          <div class="devops-card-icon" style="background:${tool.iconBg}">${tool.icon}</div>
          <div class="devops-card-info">
            <div class="devops-card-name">${tool.name}</div>
            <div class="devops-card-version">${versionText}</div>
          </div>
          <span class="devops-card-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="devops-card-body">
          <div class="devops-card-actions">
            <button class="devops-install-btn" data-tool="${tool.id}">${s.installed ? 'Reinstall' : 'Install'}</button>
            <button class="devops-install-btn secondary devops-log-toggle" data-tool="${tool.id}">Show Log</button>
          </div>
          <div class="devops-result" id="devops-result-${tool.id}"></div>
          <div class="devops-log" id="devops-log-${tool.id}"></div>
        </div>
      `;

      card.querySelector('.devops-card-header').addEventListener('click', () => card.classList.toggle('expanded'));
      card.querySelector('.devops-install-btn[data-tool]').addEventListener('click', (e) => {
        e.stopPropagation();
        this.installTool(tool.id);
      });
      card.querySelector('.devops-log-toggle').addEventListener('click', (e) => {
        e.stopPropagation();
        const log = document.getElementById(`devops-log-${tool.id}`);
        log.classList.toggle('visible');
        e.target.textContent = log.classList.contains('visible') ? 'Hide Log' : 'Show Log';
      });

      container.appendChild(card);
    });
  }

  installTool(toolId) {
    if (this.activeInstall) return;
    if (!this.osInfo) { window.app.notify('Detect OS first (click refresh)', 'error'); return; }
    if (!this.osInfo.hasSudo) { window.app.notify('Sudo access required. Run as root or configure passwordless sudo.', 'error'); return; }

    const script = this._getInstallScript(toolId);
    if (!script) { window.app.notify(`No install script for ${toolId} on ${this.osInfo.osId}`, 'error'); return; }

    this.activeInstall = toolId;
    this._execId = 'devops-' + Date.now();
    this._logBuffer = '';

    const card = document.getElementById(`devops-card-${toolId}`);
    card.classList.add('expanded');
    const badge = card.querySelector('.devops-card-badge');
    badge.className = 'devops-card-badge installing';
    badge.textContent = 'Installing';

    const log = document.getElementById(`devops-log-${toolId}`);
    log.textContent = '';
    log.classList.add('visible');
    const logToggle = card.querySelector('.devops-log-toggle');
    logToggle.textContent = 'Hide Log';

    const result = document.getElementById(`devops-result-${toolId}`);
    result.className = 'devops-result';
    result.textContent = '';

    document.querySelectorAll('.devops-install-btn:not(.secondary)').forEach((b) => b.disabled = true);

    this.connection.send('devops:exec', { execId: this._execId, tool: toolId, script });
  }

  async installAll() {
    if (!this.osInfo) { window.app.notify('Detect OS first (click refresh)', 'error'); return; }
    for (const tool of this.tools) {
      const s = this.toolStatus[tool.id];
      if (!s || !s.installed) {
        await new Promise((resolve) => {
          this._installResolve = resolve;
          this.installTool(tool.id);
          if (!this.activeInstall) resolve();
        });
      }
    }
  }

  _onOutput(detail) {
    if (detail.execId !== this._execId) return;
    const toolId = this.activeInstall;
    if (!toolId) return;
    this._logBuffer += detail.data;
    const log = document.getElementById(`devops-log-${toolId}`);
    if (log) {
      log.textContent += detail.data;
      log.scrollTop = log.scrollHeight;
    }
  }

  _onDone(detail) {
    if (detail.execId !== this._execId) return;
    const toolId = this.activeInstall;
    if (!toolId) return;

    const result = document.getElementById(`devops-result-${toolId}`);
    const card = document.getElementById(`devops-card-${toolId}`);
    const badge = card.querySelector('.devops-card-badge');

    const lines = this._logBuffer.split('\n');
    let statusLine = '';
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('DEVOPS_STATUS:')) { statusLine = lines[i].trim(); break; }
    }

    if (statusLine.includes('NO_CHANGES')) {
      const ver = statusLine.split(':')[2] || '';
      result.className = 'devops-result visible no-changes';
      result.textContent = `${toolId}: No changes. Already installed${ver ? ` (${ver})` : ''}`;
      badge.className = 'devops-card-badge installed';
      badge.textContent = 'Installed';
      this.toolStatus[toolId] = { installed: true, version: ver };
    } else if (statusLine.includes('INSTALLED')) {
      const ver = statusLine.split(':')[2] || '';
      result.className = 'devops-result visible installed-ok';
      result.textContent = `${toolId}: Installed successfully${ver ? ` (${ver})` : ''}`;
      badge.className = 'devops-card-badge installed';
      badge.textContent = 'Installed';
      this.toolStatus[toolId] = { installed: true, version: ver };
      const verEl = card.querySelector('.devops-card-version');
      if (verEl) verEl.textContent = ver ? `v${ver}` : 'Installed';
    } else if (statusLine.includes('CONFIGURED')) {
      result.className = 'devops-result visible configured-ok';
      result.textContent = `${toolId}: Configured (PATH updated)`;
      badge.className = 'devops-card-badge configured';
      badge.textContent = 'Configured';
    } else {
      result.className = 'devops-result visible failed';
      result.textContent = `${toolId}: Failed (exit code ${detail.code})`;
      badge.className = 'devops-card-badge not-installed';
      badge.textContent = 'Failed';
    }

    const installBtn = card.querySelector('.devops-install-btn:not(.secondary)');
    if (installBtn) installBtn.textContent = this.toolStatus[toolId]?.installed ? 'Reinstall' : 'Install';

    this.activeInstall = null;
    this._execId = null;
    this._logBuffer = '';
    document.querySelectorAll('.devops-install-btn:not(.secondary)').forEach((b) => b.disabled = false);

    if (this._installResolve) { this._installResolve(); this._installResolve = null; }
  }

  _getInstallScript(toolId) {
    const pkg = this.osInfo.pkgManager;
    const rc = this.osInfo.shellRc || '.bashrc';
    const arch = this.osInfo.arch || 'amd64';
    const sudo = 'sudo';

    const scripts = {
      docker: {
        apt: `#!/bin/bash
set -e
if command -v docker &>/dev/null; then VER=$(docker --version 2>/dev/null); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing Docker..."
${sudo} apt-get update -qq
${sudo} apt-get install -y -qq ca-certificates curl gnupg lsb-release
${sudo} install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg | ${sudo} gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
${sudo} chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") $(lsb_release -cs) stable" | ${sudo} tee /etc/apt/sources.list.d/docker.list > /dev/null
${sudo} apt-get update -qq
${sudo} apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
${sudo} usermod -aG docker $USER 2>/dev/null || true
VER=$(docker --version 2>/dev/null)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        yum: `#!/bin/bash
set -e
if command -v docker &>/dev/null; then VER=$(docker --version 2>/dev/null); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing Docker..."
${sudo} yum install -y yum-utils
${sudo} yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
${sudo} yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
${sudo} systemctl start docker
${sudo} systemctl enable docker
${sudo} usermod -aG docker $USER 2>/dev/null || true
VER=$(docker --version 2>/dev/null)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        dnf: `#!/bin/bash
set -e
if command -v docker &>/dev/null; then VER=$(docker --version 2>/dev/null); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing Docker..."
${sudo} dnf -y install dnf-plugins-core
${sudo} dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
${sudo} dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
${sudo} systemctl start docker
${sudo} systemctl enable docker
${sudo} usermod -aG docker $USER 2>/dev/null || true
VER=$(docker --version 2>/dev/null)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        apk: `#!/bin/sh
set -e
if command -v docker >/dev/null 2>&1; then VER=$(docker --version 2>/dev/null); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing Docker..."
${sudo} apk add --no-cache docker docker-cli-compose
${sudo} rc-update add docker default 2>/dev/null || true
${sudo} service docker start 2>/dev/null || true
VER=$(docker --version 2>/dev/null)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        brew: `#!/bin/bash
set -e
if command -v docker &>/dev/null; then VER=$(docker --version 2>/dev/null); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing Docker Desktop..."
brew install --cask docker
echo "NOTE: Open Docker Desktop app to complete setup"
VER=$(docker --version 2>/dev/null || echo "pending restart")
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
      },
      terraform: {
        apt: `#!/bin/bash
set -e
if command -v terraform &>/dev/null; then VER=$(terraform version 2>/dev/null | head -1); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing Terraform..."
${sudo} apt-get update -qq && ${sudo} apt-get install -y -qq gnupg software-properties-common
wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | ${sudo} tee /usr/share/keyrings/hashicorp-archive-keyring.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | ${sudo} tee /etc/apt/sources.list.d/hashicorp.list
${sudo} apt-get update -qq && ${sudo} apt-get install -y -qq terraform
VER=$(terraform version 2>/dev/null | head -1)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        yum: `#!/bin/bash
set -e
if command -v terraform &>/dev/null; then VER=$(terraform version 2>/dev/null | head -1); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing Terraform..."
${sudo} yum install -y yum-utils
${sudo} yum-config-manager --add-repo https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo
${sudo} yum -y install terraform
VER=$(terraform version 2>/dev/null | head -1)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        dnf: `#!/bin/bash
set -e
if command -v terraform &>/dev/null; then VER=$(terraform version 2>/dev/null | head -1); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing Terraform..."
${sudo} dnf install -y dnf-plugins-core
${sudo} dnf config-manager --add-repo https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo
${sudo} dnf -y install terraform
VER=$(terraform version 2>/dev/null | head -1)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        apk: `#!/bin/sh
set -e
if command -v terraform >/dev/null 2>&1; then VER=$(terraform version 2>/dev/null | head -1); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing Terraform..."
ARCH=${arch}; [ "$ARCH" = "amd64" ] && ARCH="amd64" || ARCH="arm64"
TF_VER=$(wget -qO- https://checkpoint-api.hashicorp.com/v1/check/terraform | grep -o '"current_version":"[^"]*"' | cut -d'"' -f4)
wget -qO /tmp/tf.zip "https://releases.hashicorp.com/terraform/\${TF_VER}/terraform_\${TF_VER}_linux_\${ARCH}.zip"
cd /tmp && unzip -qo tf.zip && ${sudo} mv terraform /usr/local/bin/ && rm tf.zip
VER=$(terraform version 2>/dev/null | head -1)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        brew: `#!/bin/bash
set -e
if command -v terraform &>/dev/null; then VER=$(terraform version 2>/dev/null | head -1); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing Terraform..."
brew install hashicorp/tap/terraform
VER=$(terraform version 2>/dev/null | head -1)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
      },
      awscli: {
        apt: `#!/bin/bash
set -e
if command -v aws &>/dev/null; then VER=$(aws --version 2>/dev/null); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing AWS CLI..."
${sudo} apt-get install -y -qq unzip curl
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip
cd /tmp && unzip -qo awscliv2.zip && ${sudo} ./aws/install --update && rm -rf /tmp/aws /tmp/awscliv2.zip
VER=$(aws --version 2>/dev/null)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        yum: `#!/bin/bash
set -e
if command -v aws &>/dev/null; then VER=$(aws --version 2>/dev/null); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing AWS CLI..."
${sudo} yum install -y unzip curl
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip
cd /tmp && unzip -qo awscliv2.zip && ${sudo} ./aws/install --update && rm -rf /tmp/aws /tmp/awscliv2.zip
VER=$(aws --version 2>/dev/null)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        dnf: `#!/bin/bash
set -e
if command -v aws &>/dev/null; then VER=$(aws --version 2>/dev/null); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing AWS CLI..."
${sudo} dnf install -y unzip curl
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip
cd /tmp && unzip -qo awscliv2.zip && ${sudo} ./aws/install --update && rm -rf /tmp/aws /tmp/awscliv2.zip
VER=$(aws --version 2>/dev/null)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        apk: `#!/bin/sh
set -e
if command -v aws >/dev/null 2>&1; then VER=$(aws --version 2>/dev/null); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing AWS CLI..."
${sudo} apk add --no-cache python3 py3-pip
pip3 install --break-system-packages awscli 2>/dev/null || pip3 install awscli
VER=$(aws --version 2>/dev/null)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        brew: `#!/bin/bash
set -e
if command -v aws &>/dev/null; then VER=$(aws --version 2>/dev/null); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing AWS CLI..."
brew install awscli
VER=$(aws --version 2>/dev/null)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
      },
      kubectl: {
        apt: `#!/bin/bash
set -e
if command -v kubectl &>/dev/null; then VER=$(kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing kubectl..."
KVER=$(curl -sL https://dl.k8s.io/release/stable.txt)
curl -fsSLO "https://dl.k8s.io/release/\${KVER}/bin/linux/${arch}/kubectl"
${sudo} install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && rm -f kubectl
VER=$(kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        yum: `#!/bin/bash
set -e
if command -v kubectl &>/dev/null; then VER=$(kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing kubectl..."
KVER=$(curl -sL https://dl.k8s.io/release/stable.txt)
curl -fsSLO "https://dl.k8s.io/release/\${KVER}/bin/linux/${arch}/kubectl"
${sudo} install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && rm -f kubectl
VER=$(kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        dnf: `#!/bin/bash
set -e
if command -v kubectl &>/dev/null; then VER=$(kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing kubectl..."
KVER=$(curl -sL https://dl.k8s.io/release/stable.txt)
curl -fsSLO "https://dl.k8s.io/release/\${KVER}/bin/linux/${arch}/kubectl"
${sudo} install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && rm -f kubectl
VER=$(kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        apk: `#!/bin/sh
set -e
if command -v kubectl >/dev/null 2>&1; then VER=$(kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing kubectl..."
KVER=$(wget -qO- https://dl.k8s.io/release/stable.txt)
wget -qO /usr/local/bin/kubectl "https://dl.k8s.io/release/\${KVER}/bin/linux/${arch}/kubectl"
chmod +x /usr/local/bin/kubectl
VER=$(kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        brew: `#!/bin/bash
set -e
if command -v kubectl &>/dev/null; then VER=$(kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing kubectl..."
brew install kubernetes-cli
VER=$(kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
      },
      helm: {
        apt: `#!/bin/bash
set -e
if command -v helm &>/dev/null; then VER=$(helm version --short 2>/dev/null); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing Helm..."
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
VER=$(helm version --short 2>/dev/null)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        yum: `#!/bin/bash
set -e
if command -v helm &>/dev/null; then VER=$(helm version --short 2>/dev/null); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing Helm..."
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
VER=$(helm version --short 2>/dev/null)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        dnf: `#!/bin/bash
set -e
if command -v helm &>/dev/null; then VER=$(helm version --short 2>/dev/null); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing Helm..."
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
VER=$(helm version --short 2>/dev/null)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        apk: `#!/bin/sh
set -e
if command -v helm >/dev/null 2>&1; then VER=$(helm version --short 2>/dev/null); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing Helm..."
wget -qO- https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | sh
VER=$(helm version --short 2>/dev/null)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
        brew: `#!/bin/bash
set -e
if command -v helm &>/dev/null; then VER=$(helm version --short 2>/dev/null); echo "DEVOPS_STATUS:NO_CHANGES:$VER"; exit 0; fi
echo ">>> Installing Helm..."
brew install helm
VER=$(helm version --short 2>/dev/null)
echo "DEVOPS_STATUS:INSTALLED:$VER"`,
      },
    };

    const toolScripts = scripts[toolId];
    if (!toolScripts) return null;

    let script = toolScripts[pkg];
    if (!script && (pkg === 'dnf' || pkg === 'yum')) script = toolScripts.yum || toolScripts.dnf;
    if (!script) return null;

    const pathBlock = `
# Update PATH in shell config
TOOL_PATH="/usr/local/bin"
if [ -n "${rc}" ] && [ -f "$HOME/${rc}" ]; then
  if ! grep -q "export PATH=.*$TOOL_PATH" "$HOME/${rc}" 2>/dev/null; then
    echo 'export PATH="$TOOL_PATH:$PATH"' >> "$HOME/${rc}"
    echo "DEVOPS_STATUS:CONFIGURED"
  fi
fi`;

    return script + '\n' + pathBlock;
  }

  dispose() {
    if (this._outputHandler) this.connection.removeEventListener('devops:output', this._outputHandler);
    if (this._doneHandler) this.connection.removeEventListener('devops:done', this._doneHandler);
  }
}

window.DevOpsPanel = DevOpsPanel;
