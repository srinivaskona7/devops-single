class GitPanel {
  constructor(connection, homePath) {
    this.connection = connection;
    this.homePath = homePath;
    this.branch = '';
    this.status = [];
    this.log = [];
    this.diff = '';
    this.repoDetected = false;
  }

  init() {
    document.getElementById('git-refresh')?.addEventListener('click', () => this.refresh());
    document.getElementById('git-commit-btn')?.addEventListener('click', () => this.commit());
    document.getElementById('git-push-btn')?.addEventListener('click', () => this.push());
    document.getElementById('git-pull-btn')?.addEventListener('click', () => this.pull());
  }

  async refresh() {
    const container = document.getElementById('git-content');
    container.innerHTML = '<div class="devops-status">Loading...</div>';
    try {
      const check = await this.connection.exec(`cd '${this.homePath}' && git rev-parse --is-inside-work-tree 2>/dev/null`);
      if (check.stdout.trim() !== 'true') {
        this.repoDetected = false;
        container.innerHTML = '<div class="devops-status error">Not a git repository</div>';
        return;
      }
      this.repoDetected = true;
      const [branchR, statusR, logR] = await Promise.all([
        this.connection.exec(`cd '${this.homePath}' && git branch --show-current 2>/dev/null`),
        this.connection.exec(`cd '${this.homePath}' && git status --porcelain 2>/dev/null`),
        this.connection.exec(`cd '${this.homePath}' && git log --oneline -20 --format='%h|%s|%ar|%an' 2>/dev/null`),
      ]);
      this.branch = branchR.stdout.trim() || 'detached';
      this.status = statusR.stdout.trim().split('\n').filter(Boolean).map((l) => ({
        flag: l.substring(0, 2), path: l.substring(3),
      }));
      this.log = logR.stdout.trim().split('\n').filter(Boolean).map((l) => {
        const [hash, msg, time, author] = l.split('|');
        return { hash, msg, time, author };
      });
      this.render();
      document.querySelector('#status-branch span').textContent = this.branch;
    } catch (err) {
      container.innerHTML = `<div class="devops-status error">${err.message}</div>`;
    }
  }

  render() {
    const container = document.getElementById('git-content');
    const staged = this.status.filter((s) => s.flag[0] !== ' ' && s.flag[0] !== '?');
    const unstaged = this.status.filter((s) => s.flag[0] === ' ' || s.flag[0] === '?');

    let html = `<div class="git-branch-bar"><span class="git-branch-icon">⎇</span> <strong>${this.branch}</strong><span class="git-file-count">${this.status.length} changed</span></div>`;

    if (this.status.length > 0) {
      html += '<div class="git-section"><div class="git-section-title">Changes</div>';
      this.status.forEach((s) => {
        const color = s.flag.includes('M') ? 'var(--accent-orange)' : s.flag.includes('D') ? 'var(--accent-red)' : s.flag.includes('?') ? 'var(--accent-green)' : 'var(--text-secondary)';
        html += `<div class="git-file-item" data-path="${s.path}">
          <span class="git-flag" style="color:${color}">${s.flag}</span>
          <span class="git-file-name">${s.path}</span>
          <button class="git-stage-btn" data-path="${s.path}" title="Stage">+</button>
        </div>`;
      });
      html += '</div>';
    }

    html += `<div class="git-commit-area">
      <input type="text" id="git-commit-msg" placeholder="Commit message..." spellcheck="false">
      <div class="git-commit-actions">
        <button class="devops-install-btn" id="git-commit-btn">Commit</button>
        <button class="devops-install-btn secondary" id="git-push-btn">Push</button>
        <button class="devops-install-btn secondary" id="git-pull-btn">Pull</button>
      </div>
    </div>`;

    if (this.log.length > 0) {
      html += '<div class="git-section"><div class="git-section-title">History</div>';
      this.log.forEach((c) => {
        html += `<div class="git-commit-item" data-hash="${c.hash}">
          <span class="git-hash">${c.hash}</span>
          <span class="git-msg">${this._esc(c.msg)}</span>
          <span class="git-time">${c.time}</span>
        </div>`;
      });
      html += '</div>';
    }

    container.innerHTML = html;

    container.querySelectorAll('.git-stage-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.stage(btn.dataset.path); });
    });
    container.querySelectorAll('.git-commit-item').forEach((el) => {
      el.addEventListener('click', () => this.showDiff(el.dataset.hash));
    });
    document.getElementById('git-commit-btn')?.addEventListener('click', () => this.commit());
    document.getElementById('git-push-btn')?.addEventListener('click', () => this.push());
    document.getElementById('git-pull-btn')?.addEventListener('click', () => this.pull());
  }

  async stage(path) {
    await this.connection.exec(`cd '${this.homePath}' && git add '${path}'`);
    this.refresh();
  }

  async commit() {
    const input = document.getElementById('git-commit-msg');
    const msg = input?.value.trim();
    if (!msg) { window.app.notify('Enter a commit message', 'error'); return; }
    try {
      const r = await this.connection.exec(`cd '${this.homePath}' && git add -A && git commit -m '${msg.replace(/'/g, "'\\''")}'`);
      if (r.code === 0) {
        window.app.notify('Committed successfully', 'success');
        input.value = '';
        this.refresh();
      } else {
        window.app.notify(r.stderr || r.stdout || 'Commit failed', 'error');
      }
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  async push() {
    try {
      const r = await this.connection.exec(`cd '${this.homePath}' && git push 2>&1`);
      window.app.notify(r.code === 0 ? 'Pushed successfully' : (r.stderr || 'Push failed'), r.code === 0 ? 'success' : 'error');
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  async pull() {
    try {
      const r = await this.connection.exec(`cd '${this.homePath}' && git pull 2>&1`);
      window.app.notify(r.code === 0 ? 'Pulled successfully' : (r.stderr || 'Pull failed'), r.code === 0 ? 'success' : 'error');
      if (r.code === 0) this.refresh();
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  async showDiff(hash) {
    try {
      const r = await this.connection.exec(`cd '${this.homePath}' && git show --stat --format='%H%n%s%n%an <%ae>%n%ar' ${hash}`);
      window.app.notify(`${hash}: ${r.stdout.split('\n')[1] || ''}`, 'info');
    } catch {}
  }

  _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  dispose() {}
}
window.GitPanel = GitPanel;
