class BreadcrumbNav {
  constructor(app) {
    this.app = app;
    this.dropdown = null;
    this.activeSegment = null;
    this.onDocClick = null;
    this.onKeyDown = null;
    this.onBarClick = null;
  }

  init() {
    const bar = document.querySelector('.breadcrumb-bar');
    if (!bar) return;

    this.onBarClick = (e) => {
      const seg = e.target.closest('.breadcrumb-segment');
      if (!seg || !bar.contains(seg)) return;
      e.stopPropagation();
      if (this.activeSegment === seg) {
        this.hideDropdown();
        return;
      }
      const path = this.resolvePath(bar, seg);
      if (path === null) return;
      this.showDropdown(seg, path);
    };
    bar.addEventListener('click', this.onBarClick);

    this.onDocClick = (e) => {
      if (!this.dropdown) return;
      if (this.dropdown.contains(e.target)) return;
      if (e.target.closest('.breadcrumb-segment')) return;
      this.hideDropdown();
    };
    document.addEventListener('click', this.onDocClick);

    this.onKeyDown = (e) => {
      if (e.key === 'Escape' && this.dropdown) this.hideDropdown();
    };
    document.addEventListener('keydown', this.onKeyDown);
  }

  resolvePath(bar, seg) {
    const segments = Array.from(bar.querySelectorAll('.breadcrumb-segment'));
    const idx = segments.indexOf(seg);
    if (idx === -1) return null;
    const parts = segments.slice(0, idx + 1).map(s => s.textContent.trim()).filter(Boolean);
    if (parts.length === 0) return '/';
    if (parts[0] === '/' || parts[0] === '') return '/' + parts.slice(1).join('/');
    return '/' + parts.join('/');
  }

  async showDropdown(segment, path) {
    this.hideDropdown();
    this.activeSegment = segment;

    const dd = document.createElement('div');
    dd.className = 'breadcrumb-dropdown';
    Object.assign(dd.style, {
      position: 'fixed',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--bg-tertiary)',
      borderRadius: '4px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      maxHeight: '300px',
      minWidth: '200px',
      overflowY: 'auto',
      zIndex: '1000',
      padding: '4px 0',
      fontSize: '13px',
    });

    const loading = document.createElement('div');
    loading.textContent = 'Loading...';
    Object.assign(loading.style, {
      padding: '0 12px', height: '26px', lineHeight: '26px', color: 'var(--text-muted)',
    });
    dd.appendChild(loading);

    const rect = segment.getBoundingClientRect();
    dd.style.left = `${rect.left}px`;
    dd.style.top = `${rect.bottom + 2}px`;
    document.body.appendChild(dd);
    this.dropdown = dd;

    let result;
    try {
      result = await this.app.connection.listFiles(path, false);
    } catch (err) {
      loading.textContent = `Error: ${err.message || err}`;
      loading.style.color = 'var(--accent-red)';
      return;
    }

    if (this.dropdown !== dd) return;

    const entries = (result && result.entries) || [];
    const folders = entries.filter(e => e.type === 'directory' || e.type === 'folder').sort((a, b) => a.name.localeCompare(b.name));
    const files = entries.filter(e => !(e.type === 'directory' || e.type === 'folder')).sort((a, b) => a.name.localeCompare(b.name));
    const sorted = [...folders, ...files];

    dd.innerHTML = '';

    if (sorted.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = '(empty)';
      Object.assign(empty.style, {
        padding: '0 12px', height: '26px', lineHeight: '26px', color: 'var(--text-muted)', fontStyle: 'italic',
      });
      dd.appendChild(empty);
      return;
    }

    const fe = this.app.fileExplorer;
    for (const entry of sorted) {
      const isDir = entry.type === 'directory' || entry.type === 'folder';
      const item = document.createElement('div');
      item.className = 'breadcrumb-dropdown-item';
      Object.assign(item.style, {
        display: 'flex', alignItems: 'center', gap: '8px', height: '26px',
        padding: '0 12px', cursor: 'pointer', color: 'var(--text-primary)', userSelect: 'none',
      });
      item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg-hover, var(--bg-tertiary))'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });

      const icon = document.createElement('span');
      Object.assign(icon.style, { width: '16px', height: '16px', display: 'inline-flex', flexShrink: '0' });
      icon.innerHTML = isDir
        ? (fe?.getFolderIcon ? fe.getFolderIcon(entry.name, false) : '')
        : (fe?.getFileIcon ? fe.getFileIcon(entry.name) : '');

      const label = document.createElement('span');
      label.textContent = entry.name;
      Object.assign(label.style, { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });

      item.appendChild(icon);
      item.appendChild(label);

      const targetPath = entry.path || (path === '/' ? `/${entry.name}` : `${path}/${entry.name}`);
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideDropdown();
        if (isDir) this.navigateTo(targetPath);
        else this.app.editorManager?.openFile(targetPath, entry.name);
      });

      dd.appendChild(item);
    }
  }

  navigateTo(path) {
    const fe = this.app.fileExplorer;
    if (!fe) return;
    if (typeof fe.navigateTo === 'function') fe.navigateTo(path);
    else if (typeof fe.expandTo === 'function') fe.expandTo(path);
    else if (typeof fe.refresh === 'function') fe.refresh(path);
  }

  hideDropdown() {
    if (this.dropdown) {
      this.dropdown.remove();
      this.dropdown = null;
    }
    this.activeSegment = null;
  }

  dispose() {
    this.hideDropdown();
    const bar = document.querySelector('.breadcrumb-bar');
    if (bar && this.onBarClick) bar.removeEventListener('click', this.onBarClick);
    if (this.onDocClick) document.removeEventListener('click', this.onDocClick);
    if (this.onKeyDown) document.removeEventListener('keydown', this.onKeyDown);
    this.onBarClick = this.onDocClick = this.onKeyDown = null;
  }
}

window.BreadcrumbNav = BreadcrumbNav;
