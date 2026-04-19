class NginxPanel {
  constructor(connection) {
    this.connection = connection;
    this.configs = [];
    this.activeConfig = null;
    this.nginxInstalled = false;
  }

  init() {
    document.getElementById('nginx-refresh')?.addEventListener('click', () => this.refresh());
  }

  async refresh() {
    const content = document.getElementById('nginx-content');
    content.innerHTML = '<div class="devops-status">Loading...</div>';
    try {
      const check = await this.connection.exec('nginx -v 2>&1');
      if (check.code !== 0 && !check.stderr.includes('nginx')) {
        content.innerHTML = '<div class="devops-status error">Nginx not installed</div>';
        return;
      }
      this.nginxInstalled = true;
      const version = (check.stderr || check.stdout).trim();

      const [statusR, sitesR, confR] = await Promise.all([
        this.connection.exec('systemctl is-active nginx 2>/dev/null || service nginx status 2>/dev/null | head -1 || echo "unknown"'),
        this.connection.exec('ls /etc/nginx/sites-available/ 2>/dev/null || echo ""'),
        this.connection.exec('ls /etc/nginx/conf.d/*.conf 2>/dev/null || echo ""'),
      ]);

      const status = statusR.stdout.trim().split('\n')[0];
      const sites = sitesR.stdout.trim().split('\n').filter(Boolean);
      const confs = confR.stdout.trim().split('\n').filter(Boolean);

      this.configs = [];
      sites.forEach((s) => this.configs.push({ name: s, path: `/etc/nginx/sites-available/${s}`, type: 'site' }));
      confs.forEach((c) => this.configs.push({ name: c.split('/').pop(), path: c, type: 'conf' }));
      this.configs.push({ name: 'nginx.conf', path: '/etc/nginx/nginx.conf', type: 'main' });

      this.render(version, status);
    } catch (err) {
      content.innerHTML = `<div class="devops-status error">${err.message}</div>`;
    }
  }

  render(version, status) {
    const content = document.getElementById('nginx-content');
    const statusColor = status === 'active' ? 'var(--accent-green)' : 'var(--accent-red)';
    const statusLabel = status === 'active' ? 'Running' : status;

    let html = `<div class="devops-status detected">
      <span style="color:${statusColor}">\u25CF</span> ${version} \u2022 ${statusLabel}
    </div>`;

    html += `<div class="devops-card-actions" style="margin:8px 0">
      <button class="devops-install-btn" id="nginx-test">Test Config</button>
      <button class="devops-install-btn secondary" id="nginx-reload">Reload</button>
      <button class="devops-install-btn secondary" id="nginx-logs">Logs</button>
    </div>`;

    html += '<div class="git-section"><div class="git-section-title">Configuration Files</div>';
    this.configs.forEach((c) => {
      const badge = c.type === 'main' ? 'main' : c.type === 'site' ? 'site' : 'conf.d';
      html += `<div class="docker-item" style="cursor:pointer" data-path="${c.path}">
        <div class="docker-item-header">
          <div class="docker-item-info">
            <div class="docker-item-name">${this._esc(c.name)}</div>
            <div class="docker-item-detail">${c.path}</div>
          </div>
          <span class="devops-card-badge installed" style="font-size:9px">${badge}</span>
        </div>
      </div>`;
    });
    html += '</div>';

    html += `<div class="git-section" id="nginx-new-vhost">
      <div class="git-section-title">Quick Create Virtual Host</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <input type="text" id="nginx-domain" placeholder="example.com" style="padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:12px;outline:none">
        <input type="text" id="nginx-proxy" placeholder="http://localhost:3000 (or /var/www/html)" style="padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:12px;outline:none">
        <button class="devops-install-btn" id="nginx-create-vhost">Create VHost</button>
      </div>
    </div>`;

    html += '<div class="devops-log" id="nginx-editor-area"></div>';

    content.innerHTML = html;

    document.getElementById('nginx-test')?.addEventListener('click', () => this.testConfig());
    document.getElementById('nginx-reload')?.addEventListener('click', () => this.reloadNginx());
    document.getElementById('nginx-logs')?.addEventListener('click', () => this.showLogs());
    document.getElementById('nginx-create-vhost')?.addEventListener('click', () => this.createVHost());

    content.querySelectorAll('.docker-item[data-path]').forEach((el) => {
      el.addEventListener('click', () => this.viewConfig(el.dataset.path));
    });
  }

  async viewConfig(path) {
    const editor = document.getElementById('nginx-editor-area');
    editor.classList.add('visible');
    editor.textContent = 'Loading...';
    try {
      const r = await this.connection.readFile(path);
      editor.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="color:var(--accent-cyan);font-weight:600">${path}</span>
        <button class="devops-install-btn" id="nginx-save-btn" style="font-size:10px;padding:4px 10px">Save</button>
      </div>
      <textarea id="nginx-config-editor" style="width:100%;height:200px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font-code);font-size:12px;padding:8px;resize:vertical;outline:none">${this._esc(r.content)}</textarea>`;
      this.activeConfig = path;
      document.getElementById('nginx-save-btn')?.addEventListener('click', () => this.saveConfig());
    } catch (err) {
      editor.textContent = `Error: ${err.message}`;
    }
  }

  async saveConfig() {
    if (!this.activeConfig) return;
    const textarea = document.getElementById('nginx-config-editor');
    if (!textarea) return;
    try {
      await this.connection.writeFile(this.activeConfig, textarea.value);
      window.app.notify(`Saved ${this.activeConfig}`, 'success');
    } catch (err) {
      window.app.notify(`Save failed: ${err.message}`, 'error');
    }
  }

  async testConfig() {
    try {
      const r = await this.connection.exec('sudo nginx -t 2>&1');
      const ok = r.stdout.includes('successful') || r.stderr.includes('successful');
      window.app.notify(ok ? 'Config test passed' : (r.stderr || r.stdout), ok ? 'success' : 'error');
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  async reloadNginx() {
    try {
      const r = await this.connection.exec('sudo systemctl reload nginx 2>&1 || sudo nginx -s reload 2>&1');
      window.app.notify(r.code === 0 ? 'Nginx reloaded' : (r.stderr || 'Reload failed'), r.code === 0 ? 'success' : 'error');
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  async showLogs() {
    try {
      const r = await this.connection.exec('sudo tail -50 /var/log/nginx/error.log 2>/dev/null && echo "---ACCESS---" && sudo tail -30 /var/log/nginx/access.log 2>/dev/null');
      const overlay = document.createElement('div');
      overlay.className = 'input-overlay';
      overlay.innerHTML = `<div class="quick-open-dialog" style="width:700px"><div style="padding:12px;font-weight:600;color:var(--text-bright)">Nginx Logs</div><div class="devops-log visible" style="max-height:450px;display:block">${this._esc(r.stdout || r.stderr)}</div></div>`;
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  async createVHost() {
    const domain = document.getElementById('nginx-domain')?.value.trim();
    const proxy = document.getElementById('nginx-proxy')?.value.trim();
    if (!domain) { window.app.notify('Enter a domain name', 'error'); return; }

    const isProxy = proxy && proxy.startsWith('http');
    const root = isProxy ? '' : (proxy || `/var/www/${domain}`);

    const config = isProxy ? `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass ${proxy};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}` : `server {
    listen 80;
    server_name ${domain};
    root ${root};
    index index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }
}`;

    try {
      const path = `/etc/nginx/sites-available/${domain}`;
      await this.connection.writeFile(path, config);
      await this.connection.exec(`sudo ln -sf ${path} /etc/nginx/sites-enabled/${domain} 2>/dev/null`);
      if (!isProxy && root) await this.connection.exec(`sudo mkdir -p ${root}`);
      window.app.notify(`Created vhost for ${domain}`, 'success');
      this.refresh();
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  dispose() {}
}
window.NginxPanel = NginxPanel;
