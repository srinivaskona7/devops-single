class FileExplorer {
  constructor(container, connection) {
    this.container = container;
    this.connection = connection;
    this.rootPath = '/';
    this.expandedPaths = new Set();
    this.selectedPath = null;
    this.showHidden = false;
    this.contextTarget = null;
    this.onFileOpen = null;
    this.fileCache = new Map();
  }

  async init(rootPath) {
    this.rootPath = rootPath;
    this.expandedPaths.add(rootPath);
    await this.refresh();
  }

  async refresh() {
    this.fileCache.clear();
    this.container.innerHTML = '';
    await this.renderDirectory(this.rootPath, this.container, 0);
  }

  async renderDirectory(path, parentEl, depth) {
    try {
      const result = await this.connection.listFiles(path, this.showHidden);
      this.fileCache.set(path, result.entries);

      result.entries.forEach((entry) => {
        const item = this.createTreeItem(entry, depth);
        parentEl.appendChild(item);

        if (entry.type === 'directory' && this.expandedPaths.has(entry.path)) {
          const childContainer = document.createElement('div');
          childContainer.className = 'tree-children';
          parentEl.appendChild(childContainer);
          this.renderDirectory(entry.path, childContainer, depth + 1);
        }
      });
    } catch (err) {
      const errorEl = document.createElement('div');
      errorEl.className = 'tree-item';
      errorEl.style.cssText = `padding-left:${depth * 16 + 8}px;color:var(--accent-red);font-size:12px;`;
      errorEl.textContent = `Error: ${err.message}`;
      parentEl.appendChild(errorEl);
    }
  }

  createTreeItem(entry, depth) {
    const item = document.createElement('div');
    item.className = `tree-item ${entry.type === 'directory' ? 'directory' : 'file'}`;
    item.style.setProperty('--depth', depth);
    item.dataset.path = entry.path;
    item.dataset.type = entry.type;
    item.dataset.name = entry.name;

    if (entry.type === 'directory') {
      const isOpen = this.expandedPaths.has(entry.path);
      item.innerHTML = `
        <span class="tree-chevron ${isOpen ? 'open' : ''}">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M6 4l4 4-4 4"/></svg>
        </span>
        <span class="tree-icon">${this.getFolderIcon(entry.name, isOpen)}</span>
        <span class="tree-label">${this.escapeHtml(entry.name)}</span>
      `;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDirectory(entry.path, item);
      });
    } else {
      item.innerHTML = `
        <span class="tree-chevron"></span>
        <span class="tree-icon">${this.getFileIcon(entry.name)}</span>
        <span class="tree-label">${this.escapeHtml(entry.name)}</span>
      `;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectItem(item);
        if (this.onFileOpen) this.onFileOpen(entry.path, entry.name);
      });
    }

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectItem(item);
      this.contextTarget = entry;
      window.app.showContextMenu(e.clientX, e.clientY, entry);
    });

    if (this.selectedPath === entry.path) {
      item.classList.add('selected');
    }

    return item;
  }

  selectItem(item) {
    this.container.querySelectorAll('.tree-item.selected').forEach((el) => el.classList.remove('selected'));
    item.classList.add('selected');
    this.selectedPath = item.dataset.path;
  }

  async toggleDirectory(path, item) {
    if (this.expandedPaths.has(path)) {
      this.expandedPaths.delete(path);
      const chevron = item.querySelector('.tree-chevron');
      if (chevron) chevron.classList.remove('open');
      const icon = item.querySelector('.tree-icon');
      const name = item.dataset.name;
      if (icon) icon.innerHTML = this.getFolderIcon(name, false);
      let next = item.nextElementSibling;
      if (next && next.classList.contains('tree-children')) {
        next.remove();
      }
    } else {
      this.expandedPaths.add(path);
      const chevron = item.querySelector('.tree-chevron');
      if (chevron) chevron.classList.add('open');
      const icon = item.querySelector('.tree-icon');
      const name = item.dataset.name;
      if (icon) icon.innerHTML = this.getFolderIcon(name, true);
      let next = item.nextElementSibling;
      if (next && next.classList.contains('tree-children')) {
        next.remove();
      }
      const childContainer = document.createElement('div');
      childContainer.className = 'tree-children';
      item.after(childContainer);
      await this.renderDirectory(path, childContainer, parseInt(item.style.getPropertyValue('--depth')) + 1);
    }
  }

  async refreshDirectory(path) {
    const items = this.container.querySelectorAll(`.tree-item[data-path="${CSS.escape(path)}"]`);
    if (items.length > 0) {
      const item = items[0];
      const depth = parseInt(item.style.getPropertyValue('--depth'));
      let next = item.nextElementSibling;
      if (next && next.classList.contains('tree-children')) {
        next.remove();
      }
      if (this.expandedPaths.has(path)) {
        const childContainer = document.createElement('div');
        childContainer.className = 'tree-children';
        item.after(childContainer);
        await this.renderDirectory(path, childContainer, depth + 1);
      }
    }
  }

  getParentPath(filePath) {
    const parts = filePath.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }

  toggleHidden() {
    this.showHidden = !this.showHidden;
    this.refresh();
  }

  getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const colors = {
      js: '#f1e05a', ts: '#3178c6', jsx: '#61dafb', tsx: '#3178c6',
      py: '#3572a5', rb: '#cc342d', go: '#00add8', rs: '#dea584',
      java: '#b07219', c: '#555555', cpp: '#f34b7d', h: '#555555',
      css: '#563d7c', scss: '#c6538c', html: '#e34c26', vue: '#41b883',
      json: '#f1e05a', yaml: '#cb171e', yml: '#cb171e', toml: '#9c4221',
      xml: '#0060ac', md: '#083fa1', txt: '#6a737d',
      sh: '#89e051', bash: '#89e051', zsh: '#89e051',
      sql: '#e38c00', graphql: '#e535ab',
      svg: '#ffb13b', png: '#a074c4', jpg: '#a074c4', gif: '#a074c4',
      dockerfile: '#384d54', makefile: '#427819',
      lock: '#6a737d', env: '#f1e05a', gitignore: '#f05133',
    };
    const lowerName = name.toLowerCase();
    let color = colors[ext] || '#8b949e';
    if (lowerName === 'dockerfile') color = colors.dockerfile;
    if (lowerName === 'makefile') color = colors.makefile;
    if (lowerName.startsWith('.env')) color = colors.env;
    if (lowerName === '.gitignore') color = colors.gitignore;

    return `<svg viewBox="0 0 16 16" fill="${color}"><path d="M3.5 1h6.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V14.5a1 1 0 01-1 1h-9a1 1 0 01-1-1v-12a1 1 0 011-1z" opacity="0.8"/></svg>`;
  }

  getFolderIcon(name, isOpen) {
    const specialFolders = {
      'node_modules': '#6a737d', 'src': '#42a5f5', 'lib': '#42a5f5',
      'test': '#66bb6a', 'tests': '#66bb6a', '__tests__': '#66bb6a',
      'dist': '#ff7043', 'build': '#ff7043', 'out': '#ff7043',
      '.git': '#f05133', '.github': '#6e7681', '.vscode': '#007acc',
      'public': '#ffca28', 'assets': '#ffca28', 'static': '#ffca28',
      'config': '#78909c', 'docs': '#42a5f5', 'scripts': '#66bb6a',
    };
    const color = specialFolders[name.toLowerCase()] || '#dcb67a';
    if (isOpen) {
      return `<svg viewBox="0 0 16 16" fill="${color}"><path d="M1.5 14h13a.5.5 0 00.49-.41l1-5A.5.5 0 0015.5 8H14V5.5a.5.5 0 00-.5-.5H7.71l-.85-1.7A.5.5 0 006.41 3H1.5a.5.5 0 00-.5.5v10a.5.5 0 00.5.5z"/></svg>`;
    }
    return `<svg viewBox="0 0 16 16" fill="${color}"><path d="M14.5 5H7.71l-.85-1.7A.5.5 0 006.41 3H1.5a.5.5 0 00-.5.5v9a.5.5 0 00.5.5h13a.5.5 0 00.5-.5v-7a.5.5 0 00-.5-.5z"/></svg>`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.FileExplorer = FileExplorer;
