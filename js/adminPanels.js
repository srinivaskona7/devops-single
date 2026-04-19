class LogViewerPanel {
  constructor(connection) {
    this.connection = connection;
    this._streamId = null;
    this._outHandler = null;
    this._doneHandler = null;
  }

  init() {
    document.getElementById('logs-refresh')?.addEventListener('click', () => this.refresh());
  }

  async refresh() {
    const c = document.getElementById('logs-content');
    c.innerHTML = '<div class="devops-status">Loading log sources...</div>';
    try {
      const r = await this.connection.exec('ls -1 /var/log/*.log /var/log/syslog /var/log/messages /var/log/auth.log /var/log/nginx/*.log /var/log/docker.log 2>/dev/null | head -30');
      const files = r.stdout.trim().split('\n').filter(Boolean);

      let html = `<div class="helm-search-bar">
        <input type="text" id="log-path" placeholder="/var/log/syslog" value="${files[0] || '/var/log/syslog'}" style="flex:1;padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:12px;outline:none">
        <input type="text" id="log-filter" placeholder="Filter (grep)" style="width:100px;padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:12px;outline:none">
        <button class="devops-install-btn" id="log-tail">Tail</button>
        <button class="devops-install-btn secondary" id="log-stop">Stop</button>
      </div>`;

      html += `<div class="helm-search-bar" style="flex-wrap:wrap">
        <button class="devops-install-btn secondary" id="log-journalctl">journalctl</button>`;
      files.slice(0, 8).forEach((f) => {
        const name = f.split('/').pop();
        html += `<button class="devops-install-btn secondary log-quick" data-path="${f}" style="font-size:10px;padding:3px 8px">${name}</button>`;
      });
      html += '</div>';

      html += '<div class="devops-log visible" id="log-output" style="max-height:500px;display:block;flex:1;min-height:200px"></div>';
      html += '<div class="admin-pre" id="log-status" style="font-size:10px;color:var(--text-muted);padding:4px 8px"></div>';

      c.innerHTML = html;

      document.getElementById('log-tail')?.addEventListener('click', () => this.startTail());
      document.getElementById('log-stop')?.addEventListener('click', () => this.stopTail());
      document.getElementById('log-journalctl')?.addEventListener('click', () => this.showJournalctl());
      c.querySelectorAll('.log-quick').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.getElementById('log-path').value = btn.dataset.path;
          this.startTail();
        });
      });
    } catch (err) {
      c.innerHTML = `<div class="devops-status error">${err.message}</div>`;
    }
  }

  startTail() {
    this.stopTail();
    const path = document.getElementById('log-path')?.value.trim();
    const filter = document.getElementById('log-filter')?.value.trim();
    if (!path) return;

    const output = document.getElementById('log-output');
    const status = document.getElementById('log-status');
    output.textContent = '';
    status.textContent = `Tailing ${path}...`;

    const cmd = filter
      ? `sudo tail -f -n 100 '${path}' 2>&1 | grep --line-buffered '${filter}'`
      : `sudo tail -f -n 100 '${path}' 2>&1`;

    this._streamId = 'log-' + Date.now();
    this._outHandler = (e) => {
      if (e.detail.execId !== this._streamId) return;
      output.textContent += e.detail.data;
      if (output.textContent.length > 500000) output.textContent = output.textContent.slice(-250000);
      output.scrollTop = output.scrollHeight;
    };
    this._doneHandler = (e) => {
      if (e.detail.execId !== this._streamId) return;
      status.textContent = `Stream ended (code ${e.detail.code})`;
      this._cleanup();
    };

    this.connection.addEventListener('exec:stream:data', this._outHandler);
    this.connection.addEventListener('exec:stream:done', this._doneHandler);
    this.connection.send('exec:stream', { execId: this._streamId, command: cmd, pty: false });
  }

  stopTail() {
    if (this._streamId) {
      this.connection.exec(`pkill -f "tail -f" 2>/dev/null`).catch(() => {});
      this._cleanup();
      const status = document.getElementById('log-status');
      if (status) status.textContent = 'Stopped';
    }
  }

  async showJournalctl() {
    const output = document.getElementById('log-output');
    if (output) output.textContent = 'Loading journalctl...';
    try {
      const r = await this.connection.exec('sudo journalctl --no-pager -n 200 --output short-iso 2>&1');
      if (output) { output.textContent = r.stdout || r.stderr; output.scrollTop = output.scrollHeight; }
    } catch (err) { if (output) output.textContent = err.message; }
  }

  _cleanup() {
    if (this._outHandler) this.connection.removeEventListener('exec:stream:data', this._outHandler);
    if (this._doneHandler) this.connection.removeEventListener('exec:stream:done', this._doneHandler);
    this._streamId = null; this._outHandler = null; this._doneHandler = null;
  }

  dispose() { this.stopTail(); }
}

class NetworkToolsPanel {
  constructor(connection) {
    this.connection = connection;
  }

  init() {
    document.getElementById('network-refresh')?.addEventListener('click', () => this.refresh());
  }

  async refresh() {
    const c = document.getElementById('network-content');
    try {
      const [ifR, connR, listenR] = await Promise.all([
        this.connection.exec('ip -br addr 2>/dev/null || ifconfig 2>/dev/null | head -30'),
        this.connection.exec('ss -tunp 2>/dev/null | head -20 || netstat -tunp 2>/dev/null | head -20'),
        this.connection.exec('ss -tlnp 2>/dev/null | head -20 || netstat -tlnp 2>/dev/null | head -20'),
      ]);

      let html = `<pre class="admin-pre" style="max-height:100px">${this._esc(ifR.stdout.trim())}</pre>`;

      html += `<div class="git-section"><div class="git-section-title">Tools</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div class="helm-search-bar">
            <input type="text" id="net-host" placeholder="Host/IP" style="flex:1;padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:12px;outline:none">
            <button class="devops-install-btn secondary net-tool" data-tool="ping">Ping</button>
            <button class="devops-install-btn secondary net-tool" data-tool="dig">DNS</button>
            <button class="devops-install-btn secondary net-tool" data-tool="trace">Trace</button>
            <button class="devops-install-btn secondary net-tool" data-tool="curl">cURL</button>
          </div>
          <div class="helm-search-bar">
            <input type="text" id="net-port" placeholder="Port (e.g. 443)" style="width:80px;padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:12px;outline:none">
            <button class="devops-install-btn secondary net-tool" data-tool="port">Port Check</button>
            <button class="devops-install-btn secondary net-tool" data-tool="ssl">SSL Check</button>
            <button class="devops-install-btn secondary net-tool" data-tool="whois">Whois</button>
          </div>
        </div>
      </div>`;

      html += '<div class="devops-log visible" id="net-output" style="max-height:300px;display:block"></div>';

      html += `<div class="git-section"><div class="git-section-title">Listening Ports</div><pre class="admin-pre" style="max-height:150px">${this._esc(listenR.stdout.trim())}</pre></div>`;

      c.innerHTML = html;

      c.querySelectorAll('.net-tool').forEach((btn) => {
        btn.addEventListener('click', () => this.runTool(btn.dataset.tool));
      });
    } catch (err) {
      c.innerHTML = `<div class="devops-status error">${err.message}</div>`;
    }
  }

  async runTool(tool) {
    const host = document.getElementById('net-host')?.value.trim();
    const port = document.getElementById('net-port')?.value.trim();
    const output = document.getElementById('net-output');
    if (!host && tool !== 'port') { window.app.notify('Enter a host', 'error'); return; }

    const cmds = {
      ping: `ping -c 4 ${host} 2>&1`,
      dig: `dig ${host} +short 2>&1 && dig ${host} ANY +short 2>&1`,
      trace: `traceroute -m 15 ${host} 2>&1 || tracepath ${host} 2>&1`,
      curl: `curl -sI -w "\\n\\nHTTP Code: %{http_code}\\nTime: %{time_total}s\\nSize: %{size_download} bytes" ${host} 2>&1`,
      port: `timeout 3 bash -c "echo >/dev/tcp/${host}/${port || 80}" 2>&1 && echo "Port ${port || 80} OPEN on ${host}" || echo "Port ${port || 80} CLOSED on ${host}"`,
      ssl: `echo | openssl s_client -connect ${host}:${port || 443} -servername ${host} 2>/dev/null | openssl x509 -noout -dates -subject -issuer 2>&1`,
      whois: `whois ${host} 2>&1 | head -40`,
    };

    if (output) output.textContent = `Running ${tool}...`;
    try {
      const r = await this.connection.exec(cmds[tool]);
      if (output) output.textContent = r.stdout || r.stderr;
    } catch (err) { if (output) output.textContent = err.message; }
  }

  _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  dispose() {}
}

class CICDPanel {
  constructor(connection) {
    this.connection = connection;
  }

  init() {
    document.getElementById('cicd-refresh')?.addEventListener('click', () => this.refresh());
  }

  async refresh() {
    const c = document.getElementById('cicd-content');
    c.innerHTML = '<div class="devops-status">Checking CI/CD tools...</div>';
    try {
      const [ghR, glR, jenkinsR] = await Promise.all([
        this.connection.exec('command -v gh >/dev/null 2>&1 && gh --version 2>/dev/null | head -1 || echo "not installed"'),
        this.connection.exec('command -v gitlab-runner >/dev/null 2>&1 && gitlab-runner --version 2>/dev/null | head -1 || echo "not installed"'),
        this.connection.exec('curl -sf http://localhost:8080/login 2>/dev/null | head -1 && echo "Jenkins detected" || echo "no jenkins"'),
      ]);

      let html = '<div class="git-section"><div class="git-section-title">CI/CD Tools</div>';
      html += this._toolRow('GitHub CLI', ghR.stdout.trim(), ghR.stdout.includes('not installed'));
      html += this._toolRow('GitLab Runner', glR.stdout.trim(), glR.stdout.includes('not installed'));
      html += this._toolRow('Jenkins', jenkinsR.stdout.includes('detected') ? 'Running on :8080' : 'Not detected', !jenkinsR.stdout.includes('detected'));
      html += '</div>';

      const hasGH = !ghR.stdout.includes('not installed');
      if (hasGH) {
        const actionsR = await this.connection.exec('cd $(git rev-parse --show-toplevel 2>/dev/null || echo .) && gh run list --limit 10 2>/dev/null || echo "No repo or not authenticated"');
        html += `<div class="git-section"><div class="git-section-title">GitHub Actions</div><pre class="admin-pre" style="max-height:200px">${this._esc(actionsR.stdout.trim())}</pre>
          <div class="devops-card-actions" style="margin-top:6px">
            <button class="devops-install-btn secondary" id="cicd-gh-run">Trigger Workflow</button>
            <button class="devops-install-btn secondary" id="cicd-gh-status">PR Status</button>
          </div></div>`;
      }

      html += `<div class="git-section"><div class="git-section-title">Ansible</div>`;
      const ansibleR = await this.connection.exec('command -v ansible >/dev/null 2>&1 && ansible --version 2>/dev/null | head -1 || echo "not installed"');
      html += this._toolRow('Ansible', ansibleR.stdout.trim(), ansibleR.stdout.includes('not installed'));

      if (!ansibleR.stdout.includes('not installed')) {
        html += `<div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">
          <input type="text" id="cicd-playbook" placeholder="/path/to/playbook.yml" style="padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:12px;outline:none">
          <input type="text" id="cicd-inventory" placeholder="inventory (default: localhost,)" value="localhost," style="padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:12px;outline:none">
          <button class="devops-install-btn" id="cicd-run-playbook">Run Playbook</button>
        </div>`;
      }
      html += '</div>';

      html += '<div class="devops-log" id="cicd-log"></div>';
      c.innerHTML = html;

      document.getElementById('cicd-run-playbook')?.addEventListener('click', () => this.runPlaybook());
      document.getElementById('cicd-gh-run')?.addEventListener('click', () => this.triggerWorkflow());
      document.getElementById('cicd-gh-status')?.addEventListener('click', () => this.prStatus());
    } catch (err) {
      c.innerHTML = `<div class="devops-status error">${err.message}</div>`;
    }
  }

  async runPlaybook() {
    const playbook = document.getElementById('cicd-playbook')?.value.trim();
    const inventory = document.getElementById('cicd-inventory')?.value.trim() || 'localhost,';
    if (!playbook) { window.app.notify('Enter playbook path', 'error'); return; }

    const log = document.getElementById('cicd-log');
    log.textContent = ''; log.classList.add('visible');
    const execId = 'ansible-' + Date.now();
    const out = (e) => { if (e.detail.execId === execId) { log.textContent += e.detail.data; log.scrollTop = log.scrollHeight; }};
    const done = (e) => { if (e.detail.execId === execId) { this.connection.removeEventListener('exec:stream:data', out); this.connection.removeEventListener('exec:stream:done', done); }};
    this.connection.addEventListener('exec:stream:data', out);
    this.connection.addEventListener('exec:stream:done', done);
    this.connection.send('exec:stream', { execId, command: `ansible-playbook -i ${inventory} ${playbook} 2>&1`, pty: true });
  }

  async triggerWorkflow() {
    window.app.showInputDialog('Trigger Workflow', 'Workflow file (e.g. deploy.yml)', async (wf) => {
      if (!wf) return;
      const r = await this.connection.exec(`cd $(git rev-parse --show-toplevel) && gh workflow run ${wf} 2>&1`);
      window.app.notify(r.code === 0 ? 'Workflow triggered' : r.stderr, r.code === 0 ? 'success' : 'error');
    });
  }

  async prStatus() {
    try {
      const r = await this.connection.exec('cd $(git rev-parse --show-toplevel) && gh pr status 2>&1');
      const log = document.getElementById('cicd-log');
      if (log) { log.textContent = r.stdout || r.stderr; log.classList.add('visible'); }
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  _toolRow(name, version, missing) {
    return `<div class="docker-item" style="padding:4px 8px"><span class="docker-dot" style="background:${missing ? 'var(--text-muted)' : 'var(--accent-green)'}"></span><div class="docker-item-info"><div class="docker-item-name" style="font-size:11px">${name}</div><div class="docker-item-detail">${this._esc(version)}</div></div></div>`;
  }

  _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  dispose() {}
}

window.LogViewerPanel = LogViewerPanel;
window.NetworkToolsPanel = NetworkToolsPanel;
window.CICDPanel = CICDPanel;
