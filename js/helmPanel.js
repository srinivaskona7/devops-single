class HelmPanel {
  constructor(connection) {
    this.connection = connection;
    this.releases = [];
    this.repos = [];
    this.searchResults = [];
  }

  init() {
    document.getElementById('helm-refresh')?.addEventListener('click', () => this.refresh());
    document.getElementById('helm-search-btn')?.addEventListener('click', () => this.search());
    document.getElementById('helm-search-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.search();
    });
  }

  async refresh() {
    const content = document.getElementById('helm-content');
    content.innerHTML = '<div class="devops-status">Loading...</div>';
    try {
      const check = await this.connection.exec('command -v helm >/dev/null 2>&1 && echo "ok" || echo "no"');
      if (check.stdout.trim() !== 'ok') {
        content.innerHTML = '<div class="devops-status error">Helm not installed — install from DevOps Tools panel</div>';
        return;
      }
      const [relR, repoR] = await Promise.all([
        this.connection.exec('helm list -A --output json 2>/dev/null || echo "[]"'),
        this.connection.exec('helm repo list --output json 2>/dev/null || echo "[]"'),
      ]);
      try { this.releases = JSON.parse(relR.stdout.trim()); } catch { this.releases = []; }
      try { this.repos = JSON.parse(repoR.stdout.trim()); } catch { this.repos = []; }
      this.render();
    } catch (err) {
      content.innerHTML = `<div class="devops-status error">${err.message}</div>`;
    }
  }

  render() {
    const content = document.getElementById('helm-content');
    let html = `<div class="helm-search-bar">
      <input type="text" id="helm-search-input" placeholder="Search charts (e.g. nginx, redis)..." spellcheck="false">
      <button class="devops-install-btn" id="helm-search-btn">Search</button>
    </div>
    <div id="helm-search-results"></div>`;

    html += `<div class="git-section"><div class="git-section-title">Releases (${this.releases.length})</div>`;
    if (this.releases.length === 0) {
      html += '<div class="search-status">No Helm releases found</div>';
    }
    this.releases.forEach((r) => {
      const statusColor = r.status === 'deployed' ? 'var(--accent-green)' : r.status === 'failed' ? 'var(--accent-red)' : 'var(--accent-orange)';
      html += `<div class="docker-item">
        <div class="docker-item-header">
          <span class="docker-dot" style="background:${statusColor}"></span>
          <div class="docker-item-info">
            <div class="docker-item-name">${this._esc(r.name)}</div>
            <div class="docker-item-detail">${this._esc(r.chart)} · ns:${this._esc(r.namespace)} · rev:${r.revision}</div>
          </div>
        </div>
        <div class="docker-item-actions">
          <button class="docker-action-btn" data-action="values" data-name="${r.name}" data-ns="${r.namespace}" title="Values">📋</button>
          <button class="docker-action-btn" data-action="upgrade" data-name="${r.name}" data-ns="${r.namespace}" data-chart="${r.chart}" title="Upgrade">⬆</button>
          <button class="docker-action-btn danger" data-action="uninstall" data-name="${r.name}" data-ns="${r.namespace}" title="Uninstall">🗑</button>
        </div>
      </div>`;
    });
    html += '</div>';

    html += `<div class="git-section"><div class="git-section-title">Repos (${this.repos.length})</div>`;
    html += `<div class="helm-add-repo"><input type="text" id="helm-repo-name" placeholder="repo name"><input type="text" id="helm-repo-url" placeholder="https://charts.example.com"><button class="devops-install-btn secondary" id="helm-add-repo-btn">Add Repo</button></div>`;
    this.repos.forEach((repo) => {
      html += `<div class="docker-item"><div class="docker-item-header"><div class="docker-item-info"><div class="docker-item-name">${this._esc(repo.name)}</div><div class="docker-item-detail">${this._esc(repo.url)}</div></div></div>
        <div class="docker-item-actions"><button class="docker-action-btn danger" data-action="remove-repo" data-name="${repo.name}" title="Remove">🗑</button></div></div>`;
    });
    html += '</div>';

    content.innerHTML = html;

    document.getElementById('helm-search-btn')?.addEventListener('click', () => this.search());
    document.getElementById('helm-search-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.search(); });
    document.getElementById('helm-add-repo-btn')?.addEventListener('click', () => this.addRepo());

    content.querySelectorAll('.docker-action-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.handleAction(btn.dataset.action, btn.dataset));
    });
  }

  async search() {
    const query = document.getElementById('helm-search-input')?.value.trim();
    if (!query) return;
    const results = document.getElementById('helm-search-results');
    results.innerHTML = '<div class="search-status">Searching...</div>';
    try {
      const r = await this.connection.exec(`helm search hub "${query}" --output json --max-col-width 60 2>/dev/null || helm search repo "${query}" --output json 2>/dev/null || echo "[]"`);
      let charts = [];
      try { charts = JSON.parse(r.stdout.trim()); } catch {}
      if (charts.length === 0) { results.innerHTML = '<div class="search-status">No charts found</div>'; return; }
      results.innerHTML = charts.slice(0, 15).map((c) => `<div class="docker-item">
        <div class="docker-item-header"><div class="docker-item-info">
          <div class="docker-item-name">${this._esc(c.name || c.repository?.name || '')}</div>
          <div class="docker-item-detail">${this._esc((c.description || '').substring(0, 80))}</div>
        </div></div>
        <div class="docker-item-actions">
          <button class="docker-action-btn helm-install-chart" data-chart="${this._esc(c.name || c.repository?.name || '')}" title="Install">📥</button>
        </div>
      </div>`).join('');
      results.querySelectorAll('.helm-install-chart').forEach((btn) => {
        btn.addEventListener('click', () => this.installChart(btn.dataset.chart));
      });
    } catch (err) { results.innerHTML = `<div class="search-status">${err.message}</div>`; }
  }

  async installChart(chart) {
    const name = chart.split('/').pop().replace(/[^a-z0-9-]/g, '');
    window.app.showInputDialog('Install Helm Chart', `Release name for ${chart}`, async (releaseName) => {
      if (!releaseName) return;
      try {
        const r = await this.connection.exec(`helm install ${releaseName} ${chart} 2>&1`);
        window.app.notify(r.code === 0 ? `Installed ${releaseName}` : r.stderr, r.code === 0 ? 'success' : 'error');
        this.refresh();
      } catch (err) { window.app.notify(err.message, 'error'); }
    }, name);
  }

  async addRepo() {
    const nameEl = document.getElementById('helm-repo-name');
    const urlEl = document.getElementById('helm-repo-url');
    if (!nameEl?.value || !urlEl?.value) { window.app.notify('Enter repo name and URL', 'error'); return; }
    try {
      const r = await this.connection.exec(`helm repo add ${nameEl.value} ${urlEl.value} && helm repo update 2>&1`);
      window.app.notify(r.code === 0 ? `Added repo ${nameEl.value}` : r.stderr, r.code === 0 ? 'success' : 'error');
      nameEl.value = ''; urlEl.value = '';
      this.refresh();
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  async handleAction(action, data) {
    try {
      if (action === 'values') {
        const r = await this.connection.exec(`helm get values ${data.name} -n ${data.ns} 2>&1`);
        const overlay = document.createElement('div');
        overlay.className = 'input-overlay';
        overlay.innerHTML = `<div class="quick-open-dialog" style="width:640px"><div style="padding:12px;font-weight:600;color:var(--text-bright)">Values: ${data.name}</div><div class="devops-log visible" style="max-height:400px;display:block">${this._esc(r.stdout || r.stderr)}</div></div>`;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
      } else if (action === 'upgrade') {
        const r = await this.connection.exec(`helm upgrade ${data.name} ${data.chart} -n ${data.ns} 2>&1`);
        window.app.notify(r.code === 0 ? `Upgraded ${data.name}` : r.stderr, r.code === 0 ? 'success' : 'error');
        this.refresh();
      } else if (action === 'uninstall') {
        if (!confirm(`Uninstall release "${data.name}"?`)) return;
        const r = await this.connection.exec(`helm uninstall ${data.name} -n ${data.ns} 2>&1`);
        window.app.notify(r.code === 0 ? `Uninstalled ${data.name}` : r.stderr, r.code === 0 ? 'success' : 'error');
        this.refresh();
      } else if (action === 'remove-repo') {
        const r = await this.connection.exec(`helm repo remove ${data.name} 2>&1`);
        window.app.notify(r.code === 0 ? `Removed ${data.name}` : r.stderr, r.code === 0 ? 'success' : 'error');
        this.refresh();
      }
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  dispose() {}
}
window.HelmPanel = HelmPanel;
