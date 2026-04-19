class KymaPanel {
  constructor(connection) {
    this.connection = connection;
    this.dashboardUrl = null;
    this.iframeLoaded = false;
  }

  init() {
    document.getElementById('kyma-refresh')?.addEventListener('click', () => this.refresh());
    document.getElementById('kyma-open-external')?.addEventListener('click', () => {
      if (this.dashboardUrl) window.open(this.dashboardUrl, '_blank');
    });
  }

  async refresh() {
    const content = document.getElementById('kyma-content');
    content.innerHTML = '<div class="devops-status">Detecting Kyma Dashboard...</div>';

    // Try the embedded dashboard first (docker-compose service)
    const dashUrls = [
      window.location.origin.replace(':3456', ':3000'),
      'http://localhost:3000',
      'http://kyma-manager-frontend:80',
    ];

    for (const url of dashUrls) {
      try {
        const resp = await fetch(`${url}/health`, { mode: 'no-cors', signal: AbortSignal.timeout(3000) });
        this.dashboardUrl = url;
        this.renderIframe(content, url);
        return;
      } catch {}
    }

    // Fallback: show cluster info via SSH kubectl
    if (this.connection?.connected) {
      await this.renderFallback(content);
    } else {
      content.innerHTML = `<div class="devops-status error">
        Kyma Dashboard not reachable. Start it with:<br>
        <code style="font-family:var(--font-code);color:var(--accent-cyan);font-size:11px;margin-top:4px;display:block">docker compose up -d</code>
      </div>
      <div style="padding:8px;font-size:11px;color:var(--text-muted)">
        Or connect via SSH first to use kubectl-based fallback.
      </div>`;
    }
  }

  renderIframe(content, url) {
    content.innerHTML = `
      <div class="devops-status detected" style="margin-bottom:0;border-radius:var(--radius-sm) var(--radius-sm) 0 0">
        <span>\u2388 Kyma Dashboard</span>
        <span style="margin-left:auto;font-size:10px;color:var(--text-muted)">${url}</span>
        <button class="docker-action-btn" id="kyma-open-external" title="Open in new tab" style="margin-left:4px">\u2197</button>
        <button class="docker-action-btn" id="kyma-fullscreen-dash" title="Fullscreen" style="margin-left:2px">\u26F6</button>
      </div>
      <iframe id="kyma-iframe" src="${url}" style="width:100%;flex:1;border:none;border-radius:0 0 var(--radius-sm) var(--radius-sm);min-height:calc(100vh - 200px);background:var(--bg-primary)"></iframe>
    `;

    document.getElementById('kyma-open-external')?.addEventListener('click', () => window.open(url, '_blank'));
    document.getElementById('kyma-fullscreen-dash')?.addEventListener('click', () => {
      const iframe = document.getElementById('kyma-iframe');
      if (iframe) {
        if (!document.fullscreenElement) iframe.requestFullscreen().catch(() => {});
        else document.exitFullscreen();
      }
    });

    const iframe = document.getElementById('kyma-iframe');
    if (iframe) {
      iframe.addEventListener('load', () => { this.iframeLoaded = true; });
      iframe.addEventListener('error', () => {
        content.innerHTML = '<div class="devops-status error">Failed to load Kyma Dashboard iframe</div>';
      });
    }
  }

  async renderFallback(content) {
    content.innerHTML = '<div class="devops-status">Loading cluster info via kubectl...</div>';
    try {
      const [clusterR, nsR, nodesR, podsR] = await Promise.all([
        this.connection.exec('kubectl cluster-info 2>&1 | head -5'),
        this.connection.exec('kubectl get ns --no-headers 2>/dev/null | wc -l'),
        this.connection.exec('kubectl get nodes --no-headers 2>/dev/null'),
        this.connection.exec('kubectl get pods --all-namespaces --no-headers 2>/dev/null | wc -l'),
      ]);

      const nodes = nodesR.stdout.trim().split('\n').filter(Boolean);

      let html = '<div class="devops-status detected" style="margin-bottom:6px">\u2388 Kyma Cluster (kubectl fallback)</div>';

      html += '<div class="admin-grid">';
      html += `<div class="admin-stat"><div class="admin-stat-label">Namespaces</div><div class="admin-stat-value">${nsR.stdout.trim()}</div></div>`;
      html += `<div class="admin-stat"><div class="admin-stat-label">Nodes</div><div class="admin-stat-value">${nodes.length}</div></div>`;
      html += `<div class="admin-stat"><div class="admin-stat-label">Pods</div><div class="admin-stat-value">${podsR.stdout.trim()}</div></div>`;
      html += '</div>';

      html += '<div class="git-section"><div class="git-section-title">Cluster Info</div>';
      html += `<pre class="admin-pre">${this._esc(clusterR.stdout.trim())}</pre></div>`;

      html += '<div class="git-section"><div class="git-section-title">Nodes</div>';
      nodes.forEach((n) => {
        const cols = n.trim().split(/\s+/);
        const status = cols[1] || '';
        const color = status === 'Ready' ? 'var(--accent-green)' : 'var(--accent-red)';
        html += `<div class="docker-item"><span class="docker-dot" style="background:${color}"></span><div class="docker-item-info"><div class="docker-item-name" style="font-size:11px">${this._esc(cols[0])}</div><div class="docker-item-detail">${this._esc(cols.slice(1).join(' '))}</div></div></div>`;
      });
      html += '</div>';

      html += `<div style="padding:8px;font-size:11px;color:var(--text-muted)">
        For the full Kyma Dashboard UI, run: <code style="color:var(--accent-cyan)">docker compose up -d</code>
      </div>`;

      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = `<div class="devops-status error">${err.message}</div>`;
    }
  }

  _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  dispose() {}
}
window.KymaPanel = KymaPanel;
