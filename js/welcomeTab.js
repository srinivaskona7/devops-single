class WelcomeTab {
  constructor(app) {
    this.app = app;
    this.storageKey = 'cloud-ide-recent';
    this.maxRecent = 10;
    this.container = null;
  }

  init() {
    this.container = document.querySelector('.editor-welcome');
    if (!this.container) return;
    this.render();
    this.attachEvents();
    this.show();
  }

  render() {
    const recent = this.getRecentFiles();
    const recentHtml = recent.length
      ? recent.map((f) => `
          <div class="welcome-recent-item" data-path="${this.escape(f.path)}" data-name="${this.escape(f.name)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span class="welcome-recent-name">${this.escape(f.name)}</span>
            <span class="welcome-recent-path">${this.escape(f.path)}</span>
          </div>`).join('')
      : '<div class="welcome-empty">No recent files</div>';

    this.container.innerHTML = `
      <div class="welcome-tab">
        <div class="welcome-header">
          <div class="welcome-logo">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
            </svg>
          </div>
          <h1 class="welcome-title">Welcome</h1>
          <p class="welcome-subtitle">Cloud IDE — Browser-based DevOps workspace</p>
        </div>

        <div class="welcome-grid">
          <div class="welcome-col">
            <h2 class="welcome-section-title">Start</h2>
            <div class="welcome-actions">
              <button class="welcome-btn" data-action="new-file">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="13" x2="12" y2="19"></line>
                  <line x1="9" y1="16" x2="15" y2="16"></line>
                </svg>
                New File
              </button>
              <button class="welcome-btn" data-action="open-folder">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                Open Folder
              </button>
              <button class="welcome-btn" data-action="open-terminal">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="4 17 10 11 4 5"></polyline>
                  <line x1="12" y1="19" x2="20" y2="19"></line>
                </svg>
                Open Terminal
              </button>
            </div>

            <h2 class="welcome-section-title">Recent</h2>
            <div class="welcome-recent">
              ${recentHtml}
            </div>
          </div>

          <div class="welcome-col">
            <h2 class="welcome-section-title">Help</h2>
            <div class="welcome-shortcuts">
              <div class="welcome-shortcut">
                <kbd>Ctrl</kbd><kbd>P</kbd>
                <span>Quick open file</span>
              </div>
              <div class="welcome-shortcut">
                <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>P</kbd>
                <span>Command palette</span>
              </div>
              <div class="welcome-shortcut">
                <kbd>Ctrl</kbd><kbd>\`</kbd>
                <span>Toggle terminal</span>
              </div>
              <div class="welcome-shortcut">
                <kbd>Ctrl</kbd><kbd>G</kbd>
                <span>Go to line</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    this.injectStyles();
  }

  injectStyles() {
    if (document.getElementById('welcome-tab-styles')) return;
    const style = document.createElement('style');
    style.id = 'welcome-tab-styles';
    style.textContent = `
      .welcome-tab {
        max-width: 700px;
        margin: 0 auto;
        padding: 48px 24px;
        color: var(--text-primary);
        font-family: inherit;
      }
      .welcome-header {
        text-align: center;
        margin-bottom: 40px;
      }
      .welcome-logo {
        color: var(--accent);
        margin-bottom: 12px;
        display: inline-flex;
      }
      .welcome-title {
        font-size: 28px;
        font-weight: 300;
        color: var(--text-bright);
        margin: 0 0 6px 0;
      }
      .welcome-subtitle {
        color: var(--text-muted);
        font-size: 13px;
        margin: 0;
      }
      .welcome-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
      }
      .welcome-section-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-bright);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 12px 0;
      }
      .welcome-col > .welcome-section-title:not(:first-child) {
        margin-top: 24px;
      }
      .welcome-actions {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .welcome-btn {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 16px;
        background: var(--bg-tertiary);
        color: var(--text-primary);
        border: 1px solid transparent;
        border-radius: 999px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: left;
        width: fit-content;
      }
      .welcome-btn:hover {
        background: var(--accent);
        color: #fff;
      }
      .welcome-btn svg {
        flex-shrink: 0;
      }
      .welcome-recent {
        display: flex;
        flex-direction: column;
        background: var(--bg-secondary);
        border-radius: 6px;
        overflow: hidden;
      }
      .welcome-recent-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 12px;
        color: var(--text-primary);
        border-bottom: 1px solid var(--bg-primary);
        transition: background 0.1s ease;
      }
      .welcome-recent-item:last-child {
        border-bottom: none;
      }
      .welcome-recent-item:hover {
        background: var(--bg-tertiary);
        color: var(--text-bright);
      }
      .welcome-recent-item svg {
        flex-shrink: 0;
        color: var(--text-muted);
      }
      .welcome-recent-name {
        font-weight: 500;
        white-space: nowrap;
      }
      .welcome-recent-path {
        color: var(--text-muted);
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
        min-width: 0;
      }
      .welcome-empty {
        padding: 12px;
        color: var(--text-muted);
        font-size: 12px;
        font-style: italic;
        text-align: center;
      }
      .welcome-shortcuts {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .welcome-shortcut {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text-primary);
      }
      .welcome-shortcut span {
        color: var(--text-muted);
        margin-left: 4px;
      }
      .welcome-shortcut kbd {
        background: var(--bg-tertiary);
        color: var(--text-bright);
        border: 1px solid var(--bg-primary);
        border-radius: 4px;
        padding: 2px 8px;
        font-size: 11px;
        font-family: 'SF Mono', Menlo, Consolas, monospace;
        min-width: 20px;
        text-align: center;
      }
      @media (max-width: 600px) {
        .welcome-grid {
          grid-template-columns: 1fr;
          gap: 24px;
        }
        .welcome-tab {
          padding: 32px 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  attachEvents() {
    if (!this.container) return;

    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        this.handleAction(btn.dataset.action);
        return;
      }
      const item = e.target.closest('.welcome-recent-item');
      if (item) {
        this.openRecent(item.dataset.path, item.dataset.name);
      }
    });
  }

  handleAction(action) {
    switch (action) {
      case 'new-file':
        if (this.app?.editor?.openUntitled) {
          this.app.editor.openUntitled();
        } else if (this.app?.editor?.newFile) {
          this.app.editor.newFile();
        } else {
          this.app?.notify?.('New File', 'Create a file in the explorer to begin', 'info');
        }
        break;
      case 'open-folder': {
        const btn = document.querySelector('[data-panel="explorer"]');
        btn?.click();
        break;
      }
      case 'open-terminal': {
        const term = document.querySelector('.terminal-container, #terminal');
        term?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
        this.app?.terminal?.focus?.();
        break;
      }
    }
  }

  openRecent(path, name) {
    if (!path) return;
    if (this.app?.editor?.openFile) {
      this.app.editor.openFile(path, name);
    } else if (this.app?.openFile) {
      this.app.openFile(path);
    }
  }

  show() {
    if (!this.container) return;
    const tabs = document.querySelectorAll('.editor-tab');
    if (tabs.length === 0) {
      this.container.style.display = '';
    }
  }

  hide() {
    if (!this.container) return;
    this.container.style.display = 'none';
  }

  addRecentFile(path, name) {
    if (!path) return;
    const fileName = name || path.split('/').pop() || path;
    const recent = this.getRecentFiles().filter((f) => f.path !== path);
    recent.unshift({ path, name: fileName, ts: Date.now() });
    const trimmed = recent.slice(0, this.maxRecent);
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(trimmed));
    } catch (_) {}
    this.render();
    this.attachEvents();
  }

  getRecentFiles() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list.slice(0, this.maxRecent) : [];
    } catch (_) {
      return [];
    }
  }

  escape(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  dispose() {
    this.container = null;
  }
}

window.WelcomeTab = WelcomeTab;
