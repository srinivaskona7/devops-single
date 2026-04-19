class CertPanel {
  constructor(connection) {
    this.connection = connection;
    this.certs = [];
    this.certbotInstalled = false;
  }

  init() {
    document.getElementById('certs-refresh')?.addEventListener('click', () => this.refresh());
  }

  async refresh() {
    const content = document.getElementById('certs-content');
    content.innerHTML = '<div class="devops-status">Loading...</div>';
    try {
      const check = await this.connection.exec('certbot --version 2>&1');
      this.certbotInstalled = check.code === 0;

      if (!this.certbotInstalled) {
        this.renderInstallPrompt(content);
        return;
      }

      const certsR = await this.connection.exec('sudo certbot certificates 2>/dev/null');
      this.certs = this._parseCerts(certsR.stdout || '');
      this.render(check.stdout.trim() || check.stderr.trim());
    } catch (err) {
      content.innerHTML = `<div class="devops-status error">${err.message}</div>`;
    }
  }

  renderInstallPrompt(content) {
    content.innerHTML = `<div class="devops-status error">Certbot not installed</div>
      <button class="devops-install-btn" id="cert-install-certbot" style="margin-top:8px">Install Certbot</button>`;
    document.getElementById('cert-install-certbot')?.addEventListener('click', () => this.installCertbot());
  }

  render(version) {
    const content = document.getElementById('certs-content');
    let html = `<div class="devops-status detected">${version} \u2022 ${this.certs.length} certificate(s)</div>`;

    html += `<div class="git-section">
      <div class="git-section-title">Generate New Certificate</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <input type="text" id="cert-domain" placeholder="example.com (comma-separate multiple)" spellcheck="false" style="padding:8px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:12px;outline:none">
        <div style="display:flex;gap:6px">
          <select id="cert-method" style="flex:1;padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:12px;outline:none">
            <option value="standalone">HTTP-01 (Standalone)</option>
            <option value="webroot">HTTP-01 (Webroot)</option>
            <option value="nginx">Nginx Plugin</option>
            <option value="dns">DNS-01 (Manual)</option>
          </select>
        </div>
        <input type="text" id="cert-email" placeholder="admin@example.com (for Let's Encrypt)" spellcheck="false" style="padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:12px;outline:none">
        <input type="text" id="cert-webroot" placeholder="/var/www/html (for webroot method)" spellcheck="false" style="padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:12px;outline:none;display:none">
        <div class="devops-card-actions">
          <button class="devops-install-btn" id="cert-generate">Generate Certificate</button>
          <button class="devops-install-btn secondary" id="cert-dry-run">Dry Run</button>
        </div>
      </div>
    </div>`;

    html += '<div class="devops-log" id="cert-log"></div>';
    html += '<div class="devops-result" id="cert-result"></div>';

    if (this.certs.length > 0) {
      html += '<div class="git-section"><div class="git-section-title">Existing Certificates</div>';
      this.certs.forEach((c) => {
        const isExpired = c.expiry && new Date(c.expiry) < new Date();
        const color = isExpired ? 'var(--accent-red)' : 'var(--accent-green)';
        const badge = isExpired ? 'Expired' : 'Valid';
        html += `<div class="devops-card" style="margin-bottom:4px">
          <div class="devops-card-header" data-cert="${c.name}" style="cursor:pointer">
            <span class="docker-dot" style="background:${color}"></span>
            <div class="devops-card-info">
              <div class="devops-card-name">${this._esc(c.name)}</div>
              <div class="devops-card-version">${c.domains.join(', ')} \u2022 ${c.expiry || 'unknown'}</div>
            </div>
            <span class="devops-card-badge ${isExpired ? 'not-installed' : 'installed'}">${badge}</span>
          </div>
          <div class="devops-card-body" id="cert-body-${c.name.replace(/\./g, '-')}">
            <div class="docker-item-detail" style="padding:4px 0">
              Path: ${c.certPath || 'N/A'}<br>
              Key: ${c.keyPath || 'N/A'}
            </div>
            <div class="devops-card-actions">
              <button class="devops-install-btn cert-download" data-cert="${c.name}" data-certpath="${c.certPath}" data-keypath="${c.keyPath}">Download ZIP</button>
              <button class="devops-install-btn secondary cert-renew" data-cert="${c.name}">Renew</button>
              <button class="devops-install-btn secondary cert-revoke" data-cert="${c.name}" style="color:var(--accent-red)">Revoke</button>
            </div>
          </div>
        </div>`;
      });
      html += '</div>';
    }

    content.innerHTML = html;

    document.getElementById('cert-method')?.addEventListener('change', (e) => {
      const webroot = document.getElementById('cert-webroot');
      if (webroot) webroot.style.display = e.target.value === 'webroot' ? '' : 'none';
    });
    document.getElementById('cert-generate')?.addEventListener('click', () => this.generateCert(false));
    document.getElementById('cert-dry-run')?.addEventListener('click', () => this.generateCert(true));

    content.querySelectorAll('.devops-card-header[data-cert]').forEach((el) => {
      el.addEventListener('click', () => {
        const body = document.getElementById(`cert-body-${el.dataset.cert.replace(/\./g, '-')}`);
        if (body) body.style.display = body.style.display === 'flex' ? 'none' : 'flex';
      });
    });
    content.querySelectorAll('.cert-download').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.downloadCert(btn.dataset.cert, btn.dataset.certpath, btn.dataset.keypath); });
    });
    content.querySelectorAll('.cert-renew').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.renewCert(btn.dataset.cert); });
    });
    content.querySelectorAll('.cert-revoke').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.revokeCert(btn.dataset.cert); });
    });
  }

  async generateCert(dryRun) {
    const domain = document.getElementById('cert-domain')?.value.trim();
    const method = document.getElementById('cert-method')?.value;
    const email = document.getElementById('cert-email')?.value.trim();
    const webroot = document.getElementById('cert-webroot')?.value.trim();

    if (!domain) { window.app.notify('Enter a domain name', 'error'); return; }
    if (!email) { window.app.notify('Enter an email for Let\'s Encrypt', 'error'); return; }

    const domains = domain.split(',').map((d) => d.trim()).filter(Boolean);
    const domainFlags = domains.map((d) => `-d ${d}`).join(' ');

    let cmd = `sudo certbot certonly --non-interactive --agree-tos --email ${email} ${domainFlags}`;
    if (method === 'standalone') cmd += ' --standalone';
    else if (method === 'webroot') cmd += ` --webroot -w ${webroot || '/var/www/html'}`;
    else if (method === 'nginx') cmd += ' --nginx';
    else if (method === 'dns') cmd += ' --manual --preferred-challenges dns';
    if (dryRun) cmd += ' --dry-run';
    cmd += ' 2>&1';

    const log = document.getElementById('cert-log');
    const result = document.getElementById('cert-result');
    log.textContent = `$ ${cmd}\n`;
    log.classList.add('visible');
    result.className = 'devops-result';

    const execId = 'cert-' + Date.now();
    const outHandler = (e) => {
      if (e.detail.execId !== execId) return;
      log.textContent += e.detail.data;
      log.scrollTop = log.scrollHeight;
    };
    const doneHandler = (e) => {
      if (e.detail.execId !== execId) return;
      this.connection.removeEventListener('exec:stream:data', outHandler);
      this.connection.removeEventListener('exec:stream:done', doneHandler);
      if (e.detail.code === 0) {
        result.className = 'devops-result visible installed-ok';
        result.textContent = dryRun ? 'Dry run successful — cert would be issued' : `Certificate generated for ${domains.join(', ')}`;
        if (!dryRun) this.refresh();
      } else {
        result.className = 'devops-result visible failed';
        result.textContent = `Failed (exit code ${e.detail.code})`;
      }
    };

    this.connection.addEventListener('exec:stream:data', outHandler);
    this.connection.addEventListener('exec:stream:done', doneHandler);
    this.connection.send('exec:stream', { execId, command: cmd, pty: true });
  }

  async downloadCert(name, certPath, keyPath) {
    try {
      const certDir = certPath ? certPath.substring(0, certPath.lastIndexOf('/')) : `/etc/letsencrypt/live/${name}`;
      const zipCmd = `cd ${certDir} && tar czf /tmp/certs-${name}.tar.gz fullchain.pem privkey.pem chain.pem cert.pem 2>/dev/null && base64 /tmp/certs-${name}.tar.gz && rm -f /tmp/certs-${name}.tar.gz`;
      const r = await this.connection.exec(zipCmd);
      if (r.code !== 0 || !r.stdout.trim()) { window.app.notify('Failed to bundle certificates', 'error'); return; }
      const binary = atob(r.stdout.trim());
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/gzip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certs-${name}.tar.gz`;
      a.click();
      URL.revokeObjectURL(url);
      window.app.notify(`Downloaded certs for ${name}`, 'success');
    } catch (err) { window.app.notify(`Download failed: ${err.message}`, 'error'); }
  }

  async renewCert(name) {
    try {
      const r = await this.connection.exec(`sudo certbot renew --cert-name ${name} 2>&1`);
      window.app.notify(r.code === 0 ? `Renewed ${name}` : (r.stderr || r.stdout || 'Renew failed'), r.code === 0 ? 'success' : 'error');
      if (r.code === 0) this.refresh();
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  async revokeCert(name) {
    if (!confirm(`Revoke certificate for "${name}"? This cannot be undone.`)) return;
    try {
      const r = await this.connection.exec(`sudo certbot revoke --cert-name ${name} --delete-after-revoke 2>&1`);
      window.app.notify(r.code === 0 ? `Revoked ${name}` : (r.stderr || 'Revoke failed'), r.code === 0 ? 'success' : 'error');
      if (r.code === 0) this.refresh();
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  async installCertbot() {
    try {
      const r = await this.connection.exec('command -v apt-get >/dev/null && sudo apt-get install -y certbot python3-certbot-nginx 2>&1 || command -v yum >/dev/null && sudo yum install -y certbot python3-certbot-nginx 2>&1 || command -v apk >/dev/null && sudo apk add certbot certbot-nginx 2>&1 || brew install certbot 2>&1');
      window.app.notify(r.code === 0 ? 'Certbot installed' : 'Install failed', r.code === 0 ? 'success' : 'error');
      if (r.code === 0) this.refresh();
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  _parseCerts(output) {
    const certs = [];
    const blocks = output.split('Certificate Name:').slice(1);
    blocks.forEach((block) => {
      const lines = block.split('\n');
      const name = lines[0].trim();
      let domains = [], expiry = '', certPath = '', keyPath = '';
      lines.forEach((l) => {
        if (l.includes('Domains:')) domains = l.split('Domains:')[1].trim().split(/\s+/);
        if (l.includes('Expiry Date:')) expiry = l.split('Expiry Date:')[1].trim().split('(')[0].trim();
        if (l.includes('Certificate Path:')) certPath = l.split('Certificate Path:')[1].trim();
        if (l.includes('Private Key Path:')) keyPath = l.split('Private Key Path:')[1].trim();
      });
      if (name) certs.push({ name, domains, expiry, certPath, keyPath });
    });
    return certs;
  }

  _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  dispose() {}
}
window.CertPanel = CertPanel;
