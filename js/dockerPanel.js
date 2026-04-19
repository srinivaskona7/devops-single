class DockerPanel {
  constructor(connection) {
    this.connection = connection;
    this.containers = [];
    this.images = [];
    this.activeTab = 'containers';
  }

  init() {
    document.getElementById('docker-refresh')?.addEventListener('click', () => this.refresh());
  }

  async refresh() {
    const content = document.getElementById('docker-content');
    content.innerHTML = '<div class="devops-status">Loading...</div>';
    try {
      const check = await this.connection.exec('command -v docker >/dev/null 2>&1 && echo "ok" || echo "no"');
      if (check.stdout.trim() !== 'ok') {
        content.innerHTML = '<div class="devops-status error">Docker not installed</div>';
        return;
      }
      const [cR, iR] = await Promise.all([
        this.connection.exec('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.State}}" 2>/dev/null'),
        this.connection.exec('docker images --format "{{.Repository}}:{{.Tag}}|{{.ID}}|{{.Size}}|{{.CreatedSince}}" 2>/dev/null'),
      ]);
      this.containers = cR.stdout.trim().split('\n').filter(Boolean).map((l) => {
        const [id, name, image, status, ports, state] = l.split('|');
        return { id, name, image, status, ports, state };
      });
      this.images = iR.stdout.trim().split('\n').filter(Boolean).map((l) => {
        const [repo, id, size, created] = l.split('|');
        return { repo, id, size, created };
      });
      this.render();
    } catch (err) {
      content.innerHTML = `<div class="devops-status error">${err.message}</div>`;
    }
  }

  render() {
    const content = document.getElementById('docker-content');
    let html = `<div class="docker-tabs">
      <button class="docker-tab ${this.activeTab === 'containers' ? 'active' : ''}" data-tab="containers">Containers (${this.containers.length})</button>
      <button class="docker-tab ${this.activeTab === 'images' ? 'active' : ''}" data-tab="images">Images (${this.images.length})</button>
    </div><div class="docker-list">`;

    if (this.activeTab === 'containers') {
      if (this.containers.length === 0) html += '<div class="search-status">No containers</div>';
      this.containers.forEach((c) => {
        const running = c.state === 'running';
        const dot = running ? 'var(--accent-green)' : 'var(--text-muted)';
        html += `<div class="docker-item">
          <div class="docker-item-header">
            <span class="docker-dot" style="background:${dot}"></span>
            <div class="docker-item-info">
              <div class="docker-item-name">${this._esc(c.name)}</div>
              <div class="docker-item-detail">${this._esc(c.image)} · ${this._esc(c.status)}</div>
            </div>
          </div>
          <div class="docker-item-actions">
            ${running
              ? `<button class="docker-action-btn" data-action="stop" data-id="${c.id}" title="Stop">⏹</button>
                 <button class="docker-action-btn" data-action="restart" data-id="${c.id}" title="Restart">🔄</button>`
              : `<button class="docker-action-btn" data-action="start" data-id="${c.id}" title="Start">▶</button>`}
            <button class="docker-action-btn" data-action="logs" data-id="${c.id}" title="Logs">📋</button>
            <button class="docker-action-btn danger" data-action="rm" data-id="${c.id}" title="Remove">🗑</button>
          </div>
        </div>`;
      });
    } else {
      if (this.images.length === 0) html += '<div class="search-status">No images</div>';
      this.images.forEach((img) => {
        html += `<div class="docker-item">
          <div class="docker-item-header">
            <div class="docker-item-info">
              <div class="docker-item-name">${this._esc(img.repo)}</div>
              <div class="docker-item-detail">${img.id.substring(0, 12)} · ${img.size} · ${img.created}</div>
            </div>
          </div>
          <div class="docker-item-actions">
            <button class="docker-action-btn danger" data-action="rmi" data-id="${img.id}" title="Remove">🗑</button>
          </div>
        </div>`;
      });
    }
    html += '</div>';
    content.innerHTML = html;

    content.querySelectorAll('.docker-tab').forEach((t) => {
      t.addEventListener('click', () => { this.activeTab = t.dataset.tab; this.render(); });
    });
    content.querySelectorAll('.docker-action-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.handleAction(btn.dataset.action, btn.dataset.id));
    });
  }

  async handleAction(action, id) {
    const cmds = {
      start: `docker start ${id}`, stop: `docker stop ${id}`, restart: `docker restart ${id}`,
      rm: `docker rm -f ${id}`, rmi: `docker rmi ${id}`,
      logs: `docker logs --tail 50 ${id} 2>&1`,
    };
    try {
      const r = await this.connection.exec(cmds[action]);
      if (action === 'logs') {
        window.app.notify(`Logs for ${id.substring(0, 8)}`, 'info');
        const overlay = document.createElement('div');
        overlay.className = 'input-overlay';
        overlay.innerHTML = `<div class="quick-open-dialog" style="width:640px"><div style="padding:12px;font-weight:600;color:var(--text-bright)">Container Logs</div><div class="devops-log visible" style="max-height:400px;display:block">${this._esc(r.stdout || r.stderr)}</div></div>`;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
      } else {
        window.app.notify(`${action} ${id.substring(0, 8)}: ${r.code === 0 ? 'OK' : 'Failed'}`, r.code === 0 ? 'success' : 'error');
        this.refresh();
      }
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  dispose() {}
}
window.DockerPanel = DockerPanel;
