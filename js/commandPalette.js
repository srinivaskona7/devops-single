class CommandPalette {
  constructor(app) {
    this.app = app;
    this.commands = [];
    this.visible = false;
  }

  init() {
    this.commands = [
      { id: 'file.save', label: 'Save File', shortcut: 'Ctrl+S', action: () => this.app.editorManager?.saveCurrentFile() },
      { id: 'file.quickOpen', label: 'Quick Open File', shortcut: 'Ctrl+P', action: () => this.app.showQuickOpen() },
      { id: 'view.explorer', label: 'Toggle Explorer', shortcut: 'Ctrl+Shift+E', action: () => this._togglePanel('explorer') },
      { id: 'view.search', label: 'Toggle Search', shortcut: 'Ctrl+Shift+F', action: () => this._togglePanel('search') },
      { id: 'view.git', label: 'Open Git Panel', action: () => this._togglePanel('git') },
      { id: 'view.docker', label: 'Open Docker Panel', action: () => this._togglePanel('docker') },
      { id: 'view.k8s', label: 'Open Kubernetes Panel', action: () => this._togglePanel('k8s') },
      { id: 'view.devops', label: 'Open DevOps Tools', action: () => this._togglePanel('devops') },
      { id: 'view.settings', label: 'Open Settings', action: () => this._togglePanel('settings') },
      { id: 'view.terminal', label: 'Toggle Terminal', shortcut: 'Ctrl+`', action: () => { const p = document.getElementById('panel-area'); p.style.display = p.style.display === 'none' ? '' : 'none'; this.app.terminalManager?.focus(); }},
      { id: 'terminal.clear', label: 'Clear Terminal', action: () => this.app.terminalManager?.clear() },
      { id: 'git.refresh', label: 'Git: Refresh Status', action: () => this.app.gitPanel?.refresh() },
      { id: 'git.push', label: 'Git: Push', action: () => this.app.gitPanel?.push() },
      { id: 'git.pull', label: 'Git: Pull', action: () => this.app.gitPanel?.pull() },
      { id: 'docker.refresh', label: 'Docker: Refresh', action: () => this.app.dockerPanel?.refresh() },
      { id: 'k8s.refresh', label: 'K8s: Refresh', action: () => this.app.k8sPanel?.refresh() },
      { id: 'devops.detect', label: 'DevOps: Detect OS', action: () => this.app.devopsPanel?.detectOS() },
      { id: 'file.newFile', label: 'New File', action: () => this.app.promptNewFile() },
      { id: 'file.newFolder', label: 'New Folder', action: () => this.app.promptNewFolder() },
      { id: 'view.refreshTree', label: 'Refresh File Explorer', action: () => this.app.fileExplorer?.refresh() },
      { id: 'view.toggleHidden', label: 'Toggle Hidden Files', action: () => this.app.fileExplorer?.toggleHidden() },
      { id: 'theme.dark', label: 'Theme: Dark (Default)', action: () => this._setTheme('dark') },
      { id: 'theme.monokai', label: 'Theme: Monokai', action: () => this._setTheme('monokai') },
      { id: 'theme.dracula', label: 'Theme: Dracula', action: () => this._setTheme('dracula') },
      { id: 'theme.nord', label: 'Theme: Nord', action: () => this._setTheme('nord') },
      { id: 'theme.solarized', label: 'Theme: Solarized Dark', action: () => this._setTheme('solarized') },
      { id: 'app.disconnect', label: 'Disconnect', action: () => document.getElementById('btn-disconnect')?.click() },
    ];
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    const overlay = document.createElement('div');
    overlay.className = 'input-overlay';
    overlay.id = 'command-palette-overlay';
    overlay.innerHTML = `<div class="quick-open-dialog command-palette">
      <div class="command-palette-prefix">></div>
      <input type="text" placeholder="Type a command..." spellcheck="false" id="cmd-palette-input">
      <div class="quick-open-results" id="cmd-palette-results"></div>
    </div>`;

    const input = overlay.querySelector('#cmd-palette-input');
    const results = overlay.querySelector('#cmd-palette-results');

    const render = (q) => {
      results.innerHTML = '';
      const query = q.toLowerCase();
      const matches = query ? this.commands.filter((c) => c.label.toLowerCase().includes(query)) : this.commands;
      matches.slice(0, 15).forEach((cmd, i) => {
        const item = document.createElement('div');
        item.className = `quick-open-item ${i === 0 ? 'selected' : ''}`;
        item.innerHTML = `<span class="quick-open-name">${cmd.label}</span>${cmd.shortcut ? `<span class="quick-open-path">${cmd.shortcut}</span>` : ''}`;
        item.addEventListener('click', () => { this.hide(); cmd.action(); });
        results.appendChild(item);
      });
      if (matches.length === 0) results.innerHTML = '<div class="quick-open-empty">No matching commands</div>';
    };

    const close = () => this.hide();

    input.addEventListener('input', () => render(input.value.trim()));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { close(); return; }
      const items = results.querySelectorAll('.quick-open-item');
      const cur = results.querySelector('.quick-open-item.selected');
      const idx = Array.from(items).indexOf(cur);
      if (e.key === 'ArrowDown' && idx < items.length - 1) {
        e.preventDefault(); cur?.classList.remove('selected'); items[idx + 1].classList.add('selected'); items[idx + 1].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp' && idx > 0) {
        e.preventDefault(); cur?.classList.remove('selected'); items[idx - 1].classList.add('selected'); items[idx - 1].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && cur) {
        close(); const cmd = this.commands.find((c) => c.label === cur.querySelector('.quick-open-name').textContent);
        if (cmd) cmd.action();
      }
    });

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    input.focus();
    render('');
  }

  hide() {
    document.getElementById('command-palette-overlay')?.remove();
    this.visible = false;
  }

  _togglePanel(panel) {
    const btn = document.querySelector(`.activity-btn[data-panel="${panel}"]`);
    if (btn) btn.click();
  }

  _setTheme(name) {
    const themes = {
      dark: { '--bg-primary': '#0d1117', '--bg-secondary': '#161b22', '--bg-tertiary': '#1c2128', '--bg-terminal': '#0a0e14', '--text-primary': '#c9d1d9', '--text-secondary': '#8b949e', '--text-bright': '#ecf0f5', '--accent': '#6366f1', '--accent-hover': '#818cf8' },
      monokai: { '--bg-primary': '#272822', '--bg-secondary': '#2d2e27', '--bg-tertiary': '#3e3d32', '--bg-terminal': '#1e1f1c', '--text-primary': '#f8f8f2', '--text-secondary': '#a6a998', '--text-bright': '#ffffff', '--accent': '#a6e22e', '--accent-hover': '#b6f23e' },
      dracula: { '--bg-primary': '#282a36', '--bg-secondary': '#2d2f3f', '--bg-tertiary': '#343746', '--bg-terminal': '#21222c', '--text-primary': '#f8f8f2', '--text-secondary': '#8b92ab', '--text-bright': '#ffffff', '--accent': '#bd93f9', '--accent-hover': '#caa4fa' },
      nord: { '--bg-primary': '#2e3440', '--bg-secondary': '#3b4252', '--bg-tertiary': '#434c5e', '--bg-terminal': '#242933', '--text-primary': '#d8dee9', '--text-secondary': '#8b95a7', '--text-bright': '#eceff4', '--accent': '#88c0d0', '--accent-hover': '#8fbcbb' },
      solarized: { '--bg-primary': '#002b36', '--bg-secondary': '#073642', '--bg-tertiary': '#0a4050', '--bg-terminal': '#001f27', '--text-primary': '#839496', '--text-secondary': '#657b83', '--text-bright': '#fdf6e3', '--accent': '#268bd2', '--accent-hover': '#2aa198' },
    };
    const vars = themes[name];
    if (!vars) return;
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    localStorage.setItem('cloud-ide-theme', name);
    window.app.notify(`Theme: ${name}`, 'success');
  }

  loadSavedTheme() {
    const t = localStorage.getItem('cloud-ide-theme');
    if (t && t !== 'dark') this._setTheme(t);
  }

  dispose() { this.hide(); }
}
window.CommandPalette = CommandPalette;
