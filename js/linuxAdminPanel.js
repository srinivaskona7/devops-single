class LinuxAdminPanel {
  constructor(connection) {
    this.connection = connection;
    this._refreshTimer = null;
  }

  init() {
    document.getElementById('admin-refresh')?.addEventListener('click', () => this.refresh());
  }

  async refresh() {
    const c = document.getElementById('admin-content');
    c.innerHTML = '<div class="devops-status">Loading system info...</div>';
    try {
      const [sysR, memR, diskR, loadR, uptimeR, procR, svcR, usersR, cronR, fwR] = await Promise.all([
        this.connection.exec('uname -a 2>/dev/null'),
        this.connection.exec('free -h 2>/dev/null || vm_stat 2>/dev/null'),
        this.connection.exec('df -h --total 2>/dev/null | tail -1 || df -h 2>/dev/null | tail -1'),
        this.connection.exec('cat /proc/loadavg 2>/dev/null || sysctl -n vm.loadavg 2>/dev/null'),
        this.connection.exec('uptime -p 2>/dev/null || uptime 2>/dev/null'),
        this.connection.exec('ps aux --sort=-%mem 2>/dev/null | head -16 || ps aux 2>/dev/null | head -16'),
        this.connection.exec('systemctl list-units --type=service --state=running --no-legend 2>/dev/null | head -20 || service --status-all 2>/dev/null | grep "+" | head -20'),
        this.connection.exec('cat /etc/passwd 2>/dev/null | grep -v nologin | grep -v /bin/false | awk -F: \'{print $1"|"$3"|"$6"|"$7}\''),
        this.connection.exec('crontab -l 2>/dev/null || echo "No crontab"'),
        this.connection.exec('sudo ufw status 2>/dev/null || sudo iptables -L -n --line-numbers 2>/dev/null | head -30 || echo "No firewall detected"'),
      ]);

      const mem = memR.stdout.trim().split('\n');
      const disk = diskR.stdout.trim();
      const load = loadR.stdout.trim().split(' ').slice(0, 3).join(' ');
      const procs = procR.stdout.trim().split('\n');
      const svcs = svcR.stdout.trim().split('\n').filter(Boolean);
      const users = usersR.stdout.trim().split('\n').filter(Boolean).map((l) => {
        const [name, uid, home, shell] = l.split('|');
        return { name, uid, home, shell };
      });

      let html = `<div class="admin-grid">
        <div class="admin-stat"><div class="admin-stat-label">Load</div><div class="admin-stat-value">${load}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Uptime</div><div class="admin-stat-value">${this._esc(uptimeR.stdout.trim().replace('up ', ''))}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Disk</div><div class="admin-stat-value">${this._esc(disk)}</div></div>
      </div>`;

      html += `<div class="admin-mem"><div class="git-section-title">Memory</div><pre class="admin-pre">${this._esc(mem.slice(0, 4).join('\n'))}</pre></div>`;

      html += `<div class="git-section"><div class="git-section-title">Top Processes (by memory)</div>`;
      html += '<div class="admin-table"><div class="admin-table-head">USER | PID | %CPU | %MEM | COMMAND</div>';
      procs.slice(1, 11).forEach((p) => {
        const cols = p.trim().split(/\s+/);
        const cmd = cols.slice(10).join(' ').substring(0, 40);
        html += `<div class="admin-table-row">${cols[0]} | ${cols[1]} | ${cols[2]} | ${cols[3]} | ${this._esc(cmd)}
          <button class="docker-action-btn danger admin-kill" data-pid="${cols[1]}" title="Kill">&#x2715;</button></div>`;
      });
      html += '</div></div>';

      html += `<div class="git-section"><div class="git-section-title">Running Services (${svcs.length})</div>`;
      svcs.slice(0, 15).forEach((s) => {
        const name = s.trim().split(/\s+/)[0]?.replace('.service', '') || s.trim();
        html += `<div class="docker-item" style="padding:4px 8px">
          <span class="docker-dot" style="background:var(--accent-green)"></span>
          <span class="docker-item-name" style="font-size:11px">${this._esc(name)}</span>
          <div class="docker-item-actions">
            <button class="docker-action-btn admin-svc" data-svc="${this._esc(name)}" data-action="restart" title="Restart">🔄</button>
            <button class="docker-action-btn danger admin-svc" data-svc="${this._esc(name)}" data-action="stop" title="Stop">⏹</button>
          </div>
        </div>`;
      });
      html += '</div>';

      html += `<div class="git-section"><div class="git-section-title">Users (${users.length})</div>`;
      users.forEach((u) => {
        html += `<div class="docker-item" style="padding:4px 8px"><div class="docker-item-info"><div class="docker-item-name" style="font-size:11px">${this._esc(u.name)}</div><div class="docker-item-detail">uid:${u.uid} ${u.home} ${u.shell}</div></div></div>`;
      });
      html += `<div class="devops-card-actions" style="margin-top:6px"><button class="devops-install-btn secondary" id="admin-add-user">Add User</button></div></div>`;

      html += `<div class="git-section"><div class="git-section-title">Cron Jobs</div><pre class="admin-pre">${this._esc(cronR.stdout.trim())}</pre>
        <div class="devops-card-actions" style="margin-top:6px"><button class="devops-install-btn secondary" id="admin-edit-cron">Edit Crontab</button></div></div>`;

      html += `<div class="git-section"><div class="git-section-title">Firewall</div><pre class="admin-pre">${this._esc(fwR.stdout.trim())}</pre>
        <div class="devops-card-actions" style="margin-top:6px">
          <input type="text" id="admin-fw-port" placeholder="80/tcp" style="padding:4px 8px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:11px;width:80px;outline:none">
          <button class="devops-install-btn secondary" id="admin-fw-allow">Allow Port</button>
          <button class="devops-install-btn secondary" id="admin-fw-deny" style="color:var(--accent-red)">Deny Port</button>
        </div></div>`;

      c.innerHTML = html;
      this._bindEvents();
    } catch (err) {
      c.innerHTML = `<div class="devops-status error">${err.message}</div>`;
    }
  }

  _bindEvents() {
    document.querySelectorAll('.admin-kill').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Kill PID ${btn.dataset.pid}?`)) return;
        await this.connection.exec(`kill -9 ${btn.dataset.pid} 2>&1`);
        window.app.notify(`Killed PID ${btn.dataset.pid}`, 'success');
        this.refresh();
      });
    });
    document.querySelectorAll('.admin-svc').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const r = await this.connection.exec(`sudo systemctl ${btn.dataset.action} ${btn.dataset.svc} 2>&1`);
        window.app.notify(`${btn.dataset.action} ${btn.dataset.svc}: ${r.code === 0 ? 'OK' : 'Failed'}`, r.code === 0 ? 'success' : 'error');
        this.refresh();
      });
    });
    document.getElementById('admin-add-user')?.addEventListener('click', () => {
      window.app.showInputDialog('Add User', 'Username', async (name) => {
        if (!name) return;
        const r = await this.connection.exec(`sudo useradd -m -s /bin/bash ${name} 2>&1`);
        window.app.notify(r.code === 0 ? `Created user ${name}` : r.stderr, r.code === 0 ? 'success' : 'error');
        this.refresh();
      });
    });
    document.getElementById('admin-edit-cron')?.addEventListener('click', async () => {
      const r = await this.connection.exec('crontab -l 2>/dev/null');
      window.app.showInputDialog('Edit Crontab (one line)', 'e.g. */5 * * * * /path/to/script', async (line) => {
        if (!line) return;
        await this.connection.exec(`(crontab -l 2>/dev/null; echo "${line}") | crontab - 2>&1`);
        window.app.notify('Cron job added', 'success');
        this.refresh();
      });
    });
    const fwAllow = document.getElementById('admin-fw-allow');
    const fwDeny = document.getElementById('admin-fw-deny');
    const fwPort = document.getElementById('admin-fw-port');
    fwAllow?.addEventListener('click', async () => {
      const port = fwPort?.value.trim();
      if (!port) return;
      const r = await this.connection.exec(`sudo ufw allow ${port} 2>/dev/null || sudo iptables -A INPUT -p tcp --dport ${port.split('/')[0]} -j ACCEPT 2>&1`);
      window.app.notify(r.code === 0 ? `Allowed ${port}` : r.stderr, r.code === 0 ? 'success' : 'error');
      this.refresh();
    });
    fwDeny?.addEventListener('click', async () => {
      const port = fwPort?.value.trim();
      if (!port) return;
      const r = await this.connection.exec(`sudo ufw deny ${port} 2>/dev/null || sudo iptables -A INPUT -p tcp --dport ${port.split('/')[0]} -j DROP 2>&1`);
      window.app.notify(r.code === 0 ? `Denied ${port}` : r.stderr, r.code === 0 ? 'success' : 'error');
      this.refresh();
    });
  }

  _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  dispose() { if (this._refreshTimer) clearInterval(this._refreshTimer); }
}
window.LinuxAdminPanel = LinuxAdminPanel;
