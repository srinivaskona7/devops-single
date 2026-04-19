class MultiTerminal {
  constructor(container, connection) {
    this.container = container;
    this.connection = connection;
    this.sessions = [];
    this.activeSession = null;
    this.nextId = 1;
  }

  createTab(name) {
    const id = 'term-' + this.nextId++;
    const termContainer = document.createElement('div');
    termContainer.className = 'terminal-session';
    termContainer.id = id;
    termContainer.style.display = 'none';
    this.container.appendChild(termContainer);

    const terminal = new Terminal({
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
      fontSize: 14, lineHeight: 1.4, cursorBlink: true, cursorStyle: 'bar',
      theme: {
        background: '#0a0e14', foreground: '#c9d1d9', cursor: '#a78bfa', selectionBackground: '#6366f133',
        black: '#0d1117', red: '#f87171', green: '#34d399', yellow: '#fbbf24',
        blue: '#818cf8', magenta: '#f0abfc', cyan: '#22d3ee', white: '#c9d1d9',
      },
      allowProposedApi: true, scrollback: 10000, convertEol: true,
    });
    const fitAddon = new FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon.WebLinksAddon());
    terminal.open(termContainer);

    const session = { id, name: name || `Terminal ${this.nextId - 1}`, terminal, fitAddon, termContainer, isExtra: true };
    this.sessions.push(session);

    terminal.onData((data) => {
      this.connection.send('terminal:write', { termId: id, data: btoa(data) });
    });
    terminal.onResize(({ cols, rows }) => {
      this.connection.send('terminal:resize:extra', { termId: id, cols, rows });
    });

    this.connection.addEventListener('terminal:data', (e) => {
      if (e.detail.termId === id) {
        const binary = atob(e.detail.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        terminal.write(bytes);
      }
    });

    this.connection.request('terminal:new', { termId: id, cols: 120, rows: 30 }).catch(() => {
      terminal.writeln('\x1b[31mFailed to create terminal session\x1b[0m');
    });

    this.activateSession(session);
    this.renderTabs();
    setTimeout(() => fitAddon.fit(), 100);
    return session;
  }

  activateSession(session) {
    this.sessions.forEach((s) => { s.termContainer.style.display = 'none'; });
    session.termContainer.style.display = '';
    this.activeSession = session;
    session.terminal.focus();
    try { session.fitAddon.fit(); } catch {}
    this.renderTabs();
  }

  closeSession(id) {
    const idx = this.sessions.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const session = this.sessions[idx];
    this.connection.send('terminal:close:extra', { termId: id });
    session.terminal.dispose();
    session.termContainer.remove();
    this.sessions.splice(idx, 1);
    if (this.activeSession === session && this.sessions.length > 0) {
      this.activateSession(this.sessions[Math.min(idx, this.sessions.length - 1)]);
    }
    this.renderTabs();
  }

  renderTabs() {
    const tabBar = document.getElementById('terminal-tabs');
    if (!tabBar) return;
    tabBar.innerHTML = '';
    this.sessions.forEach((s) => {
      const tab = document.createElement('span');
      tab.className = `panel-tab ${s === this.activeSession ? 'active' : ''}`;
      tab.innerHTML = `${s.name} <button class="term-tab-close" data-id="${s.id}">&times;</button>`;
      tab.addEventListener('click', (e) => {
        if (!e.target.classList.contains('term-tab-close')) this.activateSession(s);
      });
      tab.querySelector('.term-tab-close').addEventListener('click', (e) => {
        e.stopPropagation(); this.closeSession(s.id);
      });
      tabBar.appendChild(tab);
    });
  }

  fitAll() { this.sessions.forEach((s) => { try { s.fitAddon.fit(); } catch {} }); }
  dispose() { this.sessions.forEach((s) => { s.terminal.dispose(); }); this.sessions = []; }
}

class FileTransfer {
  constructor(connection, app) {
    this.connection = connection;
    this.app = app;
  }

  init() {
    const fileTree = document.getElementById('file-tree');
    if (fileTree) {
      fileTree.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; fileTree.classList.add('drag-over'); });
      fileTree.addEventListener('dragleave', () => fileTree.classList.remove('drag-over'));
      fileTree.addEventListener('drop', (e) => { e.preventDefault(); fileTree.classList.remove('drag-over'); this.handleDrop(e); });
    }
  }

  async handleDrop(e) {
    const files = e.dataTransfer.files;
    if (!files.length) return;
    const targetPath = this.app.fileExplorer?.selectedPath || this.app.homePath;
    for (const file of files) {
      try {
        const content = await this._readFileAsBase64(file);
        const remotePath = targetPath.replace(/\/$/, '') + '/' + file.name;
        await this.connection.uploadFile(remotePath, content);
        this.app.notify(`Uploaded ${file.name}`, 'success');
      } catch (err) {
        this.app.notify(`Upload failed: ${err.message}`, 'error');
      }
    }
    this.app.fileExplorer?.refresh();
  }

  async download(path) {
    try {
      const r = await this.connection.downloadFile(path);
      const binary = atob(r.content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = r.name; a.click();
      URL.revokeObjectURL(url);
      this.app.notify(`Downloaded ${r.name}`, 'success');
    } catch (err) {
      this.app.notify(`Download failed: ${err.message}`, 'error');
    }
  }

  _readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

class SSHKeyManager {
  constructor(connection) {
    this.connection = connection;
    this.keys = [];
  }

  async refresh() {
    try {
      const r = await this.connection.exec('ls -la ~/.ssh/*.pub 2>/dev/null && echo "---" && cat ~/.ssh/authorized_keys 2>/dev/null | wc -l');
      const lines = r.stdout.trim().split('\n');
      this.keys = lines.filter((l) => l.endsWith('.pub')).map((l) => {
        const parts = l.trim().split(/\s+/);
        return { name: parts[parts.length - 1], size: parts[4] || '' };
      });
      return this.keys;
    } catch { return []; }
  }

  async generateKey(name, type = 'ed25519') {
    const path = `~/.ssh/${name}`;
    try {
      const r = await this.connection.exec(`ssh-keygen -t ${type} -f ${path} -N "" -q && cat ${path}.pub`);
      if (r.code === 0) return r.stdout.trim();
      throw new Error(r.stderr || 'Key generation failed');
    } catch (err) { throw err; }
  }

  async getPublicKey(name) {
    const r = await this.connection.exec(`cat ~/.ssh/${name}.pub 2>/dev/null || cat ~/.ssh/${name} 2>/dev/null`);
    return r.stdout.trim();
  }
}

class Breadcrumbs {
  constructor(container) {
    this.container = container;
  }

  update(filePath) {
    if (!filePath) { this.container.innerHTML = ''; return; }
    const parts = filePath.split('/').filter(Boolean);
    this.container.innerHTML = parts.map((p, i) => {
      const isLast = i === parts.length - 1;
      return `<span class="breadcrumb-item ${isLast ? 'active' : ''}">${p}</span>`;
    }).join('<span class="breadcrumb-sep">/</span>');
  }
}

class NotificationCenter {
  constructor() {
    this.history = [];
    this.maxHistory = 50;
  }

  add(message, type) {
    this.history.unshift({ message, type, time: new Date() });
    if (this.history.length > this.maxHistory) this.history.pop();
    this._updateBadge();
  }

  show() {
    const overlay = document.createElement('div');
    overlay.className = 'input-overlay';
    overlay.innerHTML = `<div class="quick-open-dialog" style="width:480px">
      <div style="padding:12px 16px;font-weight:600;color:var(--text-bright);border-bottom:1px solid var(--border)">Notifications (${this.history.length})</div>
      <div class="quick-open-results" style="max-height:400px">
        ${this.history.length === 0 ? '<div class="quick-open-empty">No notifications</div>' :
          this.history.map((n) => `<div class="notification-item ${n.type}">
            <span class="notification-time">${this._timeAgo(n.time)}</span>
            <span class="notification-msg">${n.message}</span>
          </div>`).join('')}
      </div>
    </div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  _updateBadge() {
    const badge = document.getElementById('notification-badge');
    if (badge) { badge.textContent = this.history.length; badge.style.display = this.history.length > 0 ? '' : 'none'; }
  }

  _timeAgo(d) {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    return Math.floor(s / 3600) + 'h ago';
  }
}

window.MultiTerminal = MultiTerminal;
window.FileTransfer = FileTransfer;
window.SSHKeyManager = SSHKeyManager;
window.Breadcrumbs = Breadcrumbs;
window.NotificationCenter = NotificationCenter;
