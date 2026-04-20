class ExplorerActions {
  constructor(app) {
    this.app = app;
    this.actions = [
      { id: 'copy-path', label: 'Copy Path', handler: (entry) => this.copyPath(entry) },
      { id: 'copy-relative-path', label: 'Copy Relative Path', handler: (entry) => this.copyRelativePath(entry) },
      { id: 'duplicate', label: 'Duplicate', handler: (entry) => this.duplicateFile(entry), fileOnly: true },
      { id: 'download', label: 'Download', handler: (entry) => this.downloadFile(entry), fileOnly: true },
    ];
    this._injected = false;
  }

  init() {
    this._injectMenuItems();

    document.addEventListener('contextmenu', () => {
      requestAnimationFrame(() => this._refreshVisibility());
    }, true);
  }

  _injectMenuItems() {
    const menu = document.getElementById('context-menu');
    if (!menu || this._injected) return;

    const existingActions = new Set(
      Array.from(menu.querySelectorAll('.context-menu-item[data-action]'))
        .map((el) => el.dataset.action)
    );

    let separator = null;

    this.actions.forEach((action) => {
      if (existingActions.has(action.id)) return;

      if (!separator) {
        separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        menu.appendChild(separator);
      }

      const item = document.createElement('div');
      item.className = 'context-menu-item';
      item.dataset.action = action.id;
      item.dataset.extra = '1';
      item.textContent = action.label;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const entry = {
          path: menu.dataset.path,
          type: menu.dataset.type,
          name: menu.dataset.name,
        };
        this.app.hideContextMenu();
        action.handler(entry);
      });
      menu.appendChild(item);
    });

    this._injected = true;
  }

  _refreshVisibility() {
    const menu = document.getElementById('context-menu');
    if (!menu || !menu.classList.contains('visible')) return;

    const isFile = menu.dataset.type === 'file';
    this.actions.forEach((action) => {
      const el = menu.querySelector(`.context-menu-item[data-action="${action.id}"]`);
      if (!el) return;
      el.style.display = action.fileOnly && !isFile ? 'none' : '';
    });
  }

  async copyPath(entry) {
    if (!entry.path) return;
    try {
      await navigator.clipboard.writeText(entry.path);
      this.app.notify('Path copied to clipboard', 'success');
    } catch (err) {
      this.app.notify(`Copy failed: ${err.message}`, 'error');
    }
  }

  async copyRelativePath(entry) {
    if (!entry.path) return;
    const home = this._homeDir();
    let rel = entry.path;
    if (home && entry.path.startsWith(home)) {
      rel = entry.path.slice(home.length).replace(/^\/+/, '') || '.';
      rel = '~/' + rel;
    }
    try {
      await navigator.clipboard.writeText(rel);
      this.app.notify('Relative path copied to clipboard', 'success');
    } catch (err) {
      this.app.notify(`Copy failed: ${err.message}`, 'error');
    }
  }

  async duplicateFile(entry) {
    if (!entry.path || entry.type !== 'file') return;
    try {
      const result = await this.app.connection.readFile(entry.path);
      const content = result?.content ?? result;
      const newPath = this._duplicatePath(entry.path);
      await this.app.connection.writeFile(newPath, content);
      this.app.notify(`Duplicated to ${this._basename(newPath)}`, 'success');
      this._refreshParent(entry.path);
    } catch (err) {
      this.app.notify(`Duplicate failed: ${err.message}`, 'error');
    }
  }

  async downloadFile(entry) {
    if (!entry.path || entry.type !== 'file') return;
    try {
      const result = await this.app.connection.readFile(entry.path);
      const content = result?.content ?? result ?? '';
      const encoding = result?.encoding;
      const name = entry.name || this._basename(entry.path);

      let blob;
      if (encoding === 'base64' || (typeof content === 'string' && this._looksLikeBase64Binary(name))) {
        const binary = atob(content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        blob = new Blob([bytes], { type: 'application/octet-stream' });
      } else {
        blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      this.app.notify(`Downloaded ${name}`, 'success');
    } catch (err) {
      this.app.notify(`Download failed: ${err.message}`, 'error');
    }
  }

  _duplicatePath(path) {
    const dir = path.substring(0, path.lastIndexOf('/') + 1);
    const base = this._basename(path);
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.substring(0, dot) : base;
    const ext = dot > 0 ? base.substring(dot) : '';
    return `${dir}${stem} copy${ext}`;
  }

  _basename(path) {
    const idx = path.lastIndexOf('/');
    return idx >= 0 ? path.substring(idx + 1) : path;
  }

  _homeDir() {
    return this.app.homeDir
      || this.app.home
      || this.app.connection?.home
      || this.app.connection?.config?.home
      || '';
  }

  _refreshParent(path) {
    const fe = this.app.fileExplorer;
    if (!fe) return;
    const parent = typeof fe.getParentPath === 'function'
      ? fe.getParentPath(path)
      : path.substring(0, path.lastIndexOf('/')) || '/';
    if (typeof fe.refreshDirectory === 'function') {
      fe.refreshDirectory(parent);
    } else if (typeof fe.refresh === 'function') {
      fe.refresh();
    }
  }

  _looksLikeBase64Binary(name) {
    return /\.(png|jpe?g|gif|bmp|webp|ico|pdf|zip|tar|gz|tgz|bz2|7z|rar|mp[34]|wav|mov|mkv|avi|webm|exe|bin|so|dylib|dll|class|jar|wasm)$/i.test(name);
  }

  dispose() {
    const menu = document.getElementById('context-menu');
    if (!menu) return;
    menu.querySelectorAll('.context-menu-item[data-extra="1"]').forEach((el) => el.remove());
    menu.querySelectorAll('.context-menu-separator').forEach((el) => el.remove());
    this._injected = false;
  }
}

window.ExplorerActions = ExplorerActions;
