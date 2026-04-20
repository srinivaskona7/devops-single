class TabManager {
  constructor(editorManager) {
    this.editor = editorManager;
    this.tabsBar = editorManager.tabsBar;
    this.menuEl = null;
    this.closeAllBtn = null;
    this.savedContent = new Map();
    this.modelListeners = new Map();
    this.originalRenderTabs = null;
    this.originalSaveCurrentFile = null;
    this.originalCloseTab = null;
    this.boundDocumentClick = null;
    this.boundEscape = null;
    this.boundContextMenu = null;
  }

  init() {
    this.installCloseAllButton();
    this.wrapEditorMethods();
    this.attachContextMenu();
    this.refreshAllTabs();
  }

  installCloseAllButton() {
    if (!this.tabsBar || !this.tabsBar.parentElement) return;
    const parent = this.tabsBar.parentElement;
    if (parent.querySelector('.tabs-close-all')) return;

    const btn = document.createElement('button');
    btn.className = 'tabs-close-all';
    btn.title = 'Close All Tabs';
    btn.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 8.707l3.646 3.647.708-.708L8.707 8l3.647-3.646-.708-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z"/></svg>`;
    btn.addEventListener('click', () => this.closeAll());

    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }
    parent.appendChild(btn);
    this.injectStyles();
    this.closeAllBtn = btn;
  }

  injectStyles() {
    if (document.getElementById('tab-manager-styles')) return;
    const style = document.createElement('style');
    style.id = 'tab-manager-styles';
    style.textContent = `
      .tabs-close-all {
        position: absolute;
        right: 6px;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        border: none;
        color: var(--text-muted, #5c6470);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 5;
      }
      .tabs-close-all:hover {
        background: var(--bg-tertiary, #212736);
        color: var(--text-bright, #e2e8f0);
      }
      .tab .tab-modified-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent, #7578e8);
        margin-right: 4px;
        flex-shrink: 0;
      }
      .tab.modified .tab-close { display: none; }
      .tab:not(.modified) .tab-modified-dot { display: none; }
      .tab.modified:hover .tab-close { display: flex; }
      .tab.modified:hover .tab-modified-dot { display: none; }
      .context-menu.tab-menu {
        position: fixed;
        background: var(--bg-secondary, #1a1f2e);
        border: 1px solid var(--bg-tertiary, #212736);
        border-radius: 6px;
        padding: 4px 0;
        min-width: 200px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        z-index: 10000;
        font-size: 13px;
      }
      .context-menu.tab-menu .context-menu-item {
        padding: 6px 14px;
        cursor: pointer;
        color: var(--text-primary, #b8c0cc);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        user-select: none;
      }
      .context-menu.tab-menu .context-menu-item:hover {
        background: var(--accent, #7578e8);
        color: #fff;
      }
      .context-menu.tab-menu .context-menu-item.disabled {
        opacity: 0.4;
        pointer-events: none;
      }
      .context-menu.tab-menu .context-menu-shortcut {
        color: var(--text-muted, #5c6470);
        font-size: 11px;
      }
      .context-menu.tab-menu .context-menu-separator {
        height: 1px;
        background: var(--bg-tertiary, #212736);
        margin: 4px 0;
      }
    `;
    document.head.appendChild(style);
  }

  wrapEditorMethods() {
    this.originalRenderTabs = this.editor.renderTabs.bind(this.editor);
    this.editor.renderTabs = () => {
      this.originalRenderTabs();
      this.refreshAllTabs();
    };

    this.originalSaveCurrentFile = this.editor.saveCurrentFile.bind(this.editor);
    this.editor.saveCurrentFile = async () => {
      const tab = this.editor.activeTab;
      await this.originalSaveCurrentFile();
      if (tab && !tab.modified) {
        this.savedContent.set(tab.path, tab.model.getValue());
      }
    };

    this.originalCloseTab = this.editor.closeTab.bind(this.editor);
    this.editor.closeTab = (path, force = false) => {
      this.originalCloseTab(path, force);
      if (!this.editor.tabs.find((t) => t.path === path)) {
        this.cleanupTab(path);
      }
    };
  }

  refreshAllTabs() {
    this.editor.tabs.forEach((tab) => this.attachTab(tab));
    this.editor.tabs.forEach((tab) => this.decorateTabEl(tab));
  }

  attachTab(tab) {
    if (!this.savedContent.has(tab.path)) {
      this.savedContent.set(tab.path, tab.model.getValue());
    }
    if (this.modelListeners.has(tab.path)) return;

    const listener = tab.model.onDidChangeContent(() => {
      const current = tab.model.getValue();
      const saved = this.savedContent.get(tab.path) ?? '';
      const isModified = current !== saved;
      if (tab.modified !== isModified) {
        tab.modified = isModified;
      }
      this.editor.updateTabUI(tab);
      this.decorateTabEl(tab);
    });
    this.modelListeners.set(tab.path, listener);
  }

  decorateTabEl(tab) {
    const tabEl = this.tabsBar.querySelector(`.tab[data-path="${CSS.escape(tab.path)}"]`);
    if (!tabEl) return;

    if (!tabEl.querySelector('.tab-modified-dot')) {
      const dot = document.createElement('span');
      dot.className = 'tab-modified-dot';
      dot.title = 'Unsaved changes';
      const closeBtn = tabEl.querySelector('.tab-close');
      if (closeBtn) {
        tabEl.insertBefore(dot, closeBtn);
      } else {
        tabEl.appendChild(dot);
      }
    }
    tabEl.classList.toggle('modified', !!tab.modified);
  }

  cleanupTab(path) {
    const listener = this.modelListeners.get(path);
    if (listener && typeof listener.dispose === 'function') {
      listener.dispose();
    }
    this.modelListeners.delete(path);
    this.savedContent.delete(path);
  }

  attachContextMenu() {
    this.boundContextMenu = (e) => {
      const tabEl = e.target.closest('.tab');
      if (!tabEl || !this.tabsBar.contains(tabEl)) return;
      e.preventDefault();
      const path = tabEl.dataset.path;
      if (!path) return;
      this.showMenu(e.clientX, e.clientY, path);
    };
    this.tabsBar.addEventListener('contextmenu', this.boundContextMenu);
  }

  showMenu(x, y, path) {
    this.closeMenu();
    const tab = this.editor.tabs.find((t) => t.path === path);
    if (!tab) return;

    const idx = this.editor.tabs.findIndex((t) => t.path === path);
    const hasOthers = this.editor.tabs.length > 1;
    const hasRight = idx >= 0 && idx < this.editor.tabs.length - 1;

    const items = [
      { label: 'Close', action: () => this.editor.closeTab(path) },
      { label: 'Close Others', action: () => this.closeOthers(path), disabled: !hasOthers },
      { label: 'Close All', action: () => this.closeAll() },
      { label: 'Close to the Right', action: () => this.closeToRight(path), disabled: !hasRight },
      { separator: true },
      { label: 'Copy Path', action: () => this.copyToClipboard(path, 'Path') },
      { label: 'Copy Relative Path', action: () => this.copyToClipboard(this.getRelativePath(path), 'Relative path') },
      { label: 'Reveal in Explorer', action: () => this.revealInExplorer(path) },
    ];

    const menu = document.createElement('div');
    menu.className = 'context-menu tab-menu';

    items.forEach((item) => {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'context-menu-separator';
        menu.appendChild(sep);
        return;
      }
      const el = document.createElement('div');
      el.className = 'context-menu-item' + (item.disabled ? ' disabled' : '');
      el.innerHTML = `<span>${item.label}</span>`;
      el.addEventListener('click', () => {
        if (item.disabled) return;
        this.closeMenu();
        try {
          item.action();
        } catch (err) {
          console.error('[TabManager] menu action failed', err);
        }
      });
      menu.appendChild(el);
    });

    document.body.appendChild(menu);
    this.menuEl = menu;

    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width - 4;
      const maxY = window.innerHeight - rect.height - 4;
      menu.style.left = `${Math.max(4, Math.min(x, maxX))}px`;
      menu.style.top = `${Math.max(4, Math.min(y, maxY))}px`;
    });

    this.boundDocumentClick = (e) => {
      if (this.menuEl && !this.menuEl.contains(e.target)) this.closeMenu();
    };
    this.boundEscape = (e) => {
      if (e.key === 'Escape') this.closeMenu();
    };
    setTimeout(() => {
      document.addEventListener('mousedown', this.boundDocumentClick);
      document.addEventListener('keydown', this.boundEscape);
    }, 0);
  }

  closeMenu() {
    if (this.menuEl) {
      this.menuEl.remove();
      this.menuEl = null;
    }
    if (this.boundDocumentClick) {
      document.removeEventListener('mousedown', this.boundDocumentClick);
      this.boundDocumentClick = null;
    }
    if (this.boundEscape) {
      document.removeEventListener('keydown', this.boundEscape);
      this.boundEscape = null;
    }
  }

  closeOthers(keepPath) {
    const targets = this.editor.tabs.filter((t) => t.path !== keepPath).map((t) => t.path);
    targets.forEach((p) => this.editor.closeTab(p));
  }

  closeAll() {
    const targets = this.editor.tabs.map((t) => t.path);
    targets.forEach((p) => this.editor.closeTab(p));
  }

  closeToRight(path) {
    const idx = this.editor.tabs.findIndex((t) => t.path === path);
    if (idx === -1) return;
    const targets = this.editor.tabs.slice(idx + 1).map((t) => t.path);
    targets.forEach((p) => this.editor.closeTab(p));
  }

  async copyToClipboard(text, label) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      this.notify(`${label} copied: ${text}`, 'success');
    } catch (err) {
      this.notify(`Failed to copy: ${err.message}`, 'error');
    }
  }

  getRelativePath(path) {
    const home = (window.app && window.app.connection && window.app.connection.homePath) || '';
    if (home && path.startsWith(home)) {
      const rel = path.slice(home.length);
      return rel.startsWith('/') ? '.' + rel : './' + rel;
    }
    const explorer = window.app && window.app.fileExplorer;
    const cwd = explorer && explorer.currentPath;
    if (cwd && path.startsWith(cwd)) {
      const rel = path.slice(cwd.length);
      return rel.startsWith('/') ? rel.slice(1) : rel;
    }
    return path;
  }

  revealInExplorer(path) {
    const app = window.app;
    if (!app) return;

    const activityBtn = document.querySelector('.activity-btn[data-panel="explorer"]');
    if (activityBtn) activityBtn.click();

    const explorer = app.fileExplorer;
    if (!explorer) return;

    const dir = path.substring(0, path.lastIndexOf('/')) || '/';
    if (typeof explorer.expandTo === 'function') {
      explorer.expandTo(dir).then(() => this.highlightInExplorer(path));
    } else if (typeof explorer.navigate === 'function') {
      explorer.navigate(dir);
      this.highlightInExplorer(path);
    } else {
      this.highlightInExplorer(path);
    }
  }

  highlightInExplorer(path) {
    setTimeout(() => {
      const node = document.querySelector(`[data-path="${CSS.escape(path)}"]`);
      if (node && typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        node.classList.add('highlight');
        setTimeout(() => node.classList.remove('highlight'), 1500);
      }
    }, 100);
  }

  notify(message, type) {
    if (window.app && typeof window.app.notify === 'function') {
      window.app.notify(message, type);
    }
  }

  dispose() {
    this.closeMenu();

    if (this.boundContextMenu && this.tabsBar) {
      this.tabsBar.removeEventListener('contextmenu', this.boundContextMenu);
      this.boundContextMenu = null;
    }

    this.modelListeners.forEach((listener) => {
      if (listener && typeof listener.dispose === 'function') listener.dispose();
    });
    this.modelListeners.clear();
    this.savedContent.clear();

    if (this.closeAllBtn) {
      this.closeAllBtn.remove();
      this.closeAllBtn = null;
    }

    if (this.originalRenderTabs) {
      this.editor.renderTabs = this.originalRenderTabs;
      this.originalRenderTabs = null;
    }
    if (this.originalSaveCurrentFile) {
      this.editor.saveCurrentFile = this.originalSaveCurrentFile;
      this.originalSaveCurrentFile = null;
    }
    if (this.originalCloseTab) {
      this.editor.closeTab = this.originalCloseTab;
      this.originalCloseTab = null;
    }
  }
}

window.TabManager = TabManager;
