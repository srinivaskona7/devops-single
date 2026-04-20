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
    this.renameInProgress = false;
    this.inlineInputActive = false;
    this.lastClickTime = 0;
    this.lastClickPath = null;
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

      if (result.entries.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'tree-empty';
        emptyEl.style.paddingLeft = `${(depth + 1) * 16 + 8}px`;
        emptyEl.textContent = 'This folder is empty';
        parentEl.appendChild(emptyEl);
        return;
      }

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
      errorEl.className = 'tree-item tree-error';
      errorEl.style.cssText = `padding-left:${depth * 16 + 8}px;`;
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

    const indent = document.createElement('span');
    indent.className = 'tree-indent';
    indent.style.width = `${depth * 16}px`;
    item.appendChild(indent);

    if (entry.type === 'directory') {
      const isOpen = this.expandedPaths.has(entry.path);
      const chevron = document.createElement('span');
      chevron.className = `tree-chevron ${isOpen ? 'open' : ''}`;
      chevron.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M6 4l4 4-4 4"/></svg>';
      item.appendChild(chevron);

      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.innerHTML = this.getFolderIcon(entry.name, isOpen);
      item.appendChild(icon);

      const label = document.createElement('span');
      label.className = 'tree-label';
      label.textContent = entry.name;
      item.appendChild(label);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectItem(item);
        this.toggleDirectory(entry.path, item);
      });
    } else {
      const chevron = document.createElement('span');
      chevron.className = 'tree-chevron';
      item.appendChild(chevron);

      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.innerHTML = this.getFileIcon(entry.name);
      item.appendChild(icon);

      const label = document.createElement('span');
      label.className = 'tree-label';
      label.textContent = entry.name;
      item.appendChild(label);

      const sizeEl = document.createElement('span');
      sizeEl.className = 'tree-meta';
      sizeEl.textContent = this.formatSize(entry.size);
      item.appendChild(sizeEl);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectItem(item);
        if (this.onFileOpen) this.onFileOpen(entry.path, entry.name);
      });
    }

    item.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (!this.renameInProgress) {
        this.startInlineRename(item, entry);
      }
    });

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

  startInlineRename(item, entry) {
    if (this.renameInProgress) return;
    this.renameInProgress = true;

    const label = item.querySelector('.tree-label');
    const oldName = entry.name;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tree-rename-input';
    input.value = oldName;

    const ext = oldName.lastIndexOf('.');
    label.replaceWith(input);
    input.focus();
    if (ext > 0 && entry.type !== 'directory') {
      input.setSelectionRange(0, ext);
    } else {
      input.select();
    }

    const finishRename = async () => {
      const newName = input.value.trim();
      this.renameInProgress = false;

      if (!newName || newName === oldName) {
        const newLabel = document.createElement('span');
        newLabel.className = 'tree-label';
        newLabel.textContent = oldName;
        input.replaceWith(newLabel);
        return;
      }

      const parentPath = this.getParentPath(entry.path);
      const newPath = parentPath.replace(/\/$/, '') + '/' + newName;
      try {
        await this.connection.renameFile(entry.path, newPath);
        await this.refreshDirectory(parentPath);
        window.app.notify(`Renamed to ${newName}`, 'success');
      } catch (err) {
        window.app.notify(`Rename failed: ${err.message}`, 'error');
        const newLabel = document.createElement('span');
        newLabel.className = 'tree-label';
        newLabel.textContent = oldName;
        input.replaceWith(newLabel);
      }
    };

    input.addEventListener('blur', finishRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = oldName; input.blur(); }
    });
  }

  async addInlineInput(parentPath, type) {
    if (this.inlineInputActive) return;

    let targetDir = parentPath;
    let targetItem = null;

    if (!targetDir) {
      if (this.selectedPath) {
        const selectedEl = this.container.querySelector(`.tree-item[data-path="${CSS.escape(this.selectedPath)}"]`);
        if (selectedEl) {
          if (selectedEl.dataset.type === 'directory') {
            targetDir = this.selectedPath;
            targetItem = selectedEl;
          } else {
            targetDir = this.getParentPath(this.selectedPath);
          }
        }
      }
    } else {
      targetItem = this.container.querySelector(`.tree-item[data-path="${CSS.escape(targetDir)}"]`);
    }

    if (!targetDir) {
      targetDir = this.rootPath;
    }

    let childContainer = null;
    let depth = 0;

    if (targetDir === this.rootPath && !targetItem) {
      childContainer = this.container;
      depth = 0;
    } else if (targetItem && targetItem.dataset.type === 'directory') {
      if (!this.expandedPaths.has(targetDir)) {
        await this.toggleDirectory(targetDir, targetItem);
      }
      const next = targetItem.nextElementSibling;
      if (next && next.classList.contains('tree-children')) {
        childContainer = next;
      } else {
        childContainer = document.createElement('div');
        childContainer.className = 'tree-children';
        targetItem.after(childContainer);
      }
      depth = parseInt(targetItem.style.getPropertyValue('--depth')) + 1;
    } else {
      const parentItem = this.container.querySelector(`.tree-item[data-path="${CSS.escape(targetDir)}"]`);
      if (parentItem) {
        const next = parentItem.nextElementSibling;
        if (next && next.classList.contains('tree-children')) {
          childContainer = next;
          depth = parseInt(parentItem.style.getPropertyValue('--depth')) + 1;
        }
      }
      if (!childContainer) {
        childContainer = this.container;
        depth = 0;
      }
    }

    const emptyEl = childContainer.querySelector(':scope > .tree-empty');
    if (emptyEl) emptyEl.remove();

    this.inlineInputActive = true;

    const row = document.createElement('div');
    row.className = `tree-item ${type === 'directory' ? 'directory' : 'file'} tree-inline-new`;
    row.style.setProperty('--depth', depth);

    const indent = document.createElement('span');
    indent.className = 'tree-indent';
    indent.style.width = `${depth * 16}px`;
    row.appendChild(indent);

    const chevron = document.createElement('span');
    chevron.className = 'tree-chevron';
    if (type === 'directory') {
      chevron.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M6 4l4 4-4 4"/></svg>';
    }
    row.appendChild(chevron);

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.innerHTML = type === 'directory' ? this.getFolderIcon('', false) : this.getFileIcon('newfile');
    row.appendChild(icon);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tree-rename-input';
    input.value = '';
    input.placeholder = type === 'directory' ? 'folder name' : 'file name';
    row.appendChild(input);

    childContainer.insertBefore(row, childContainer.firstChild);

    input.focus();

    let finished = false;

    const cleanup = () => {
      if (row.parentNode) row.parentNode.removeChild(row);
      this.inlineInputActive = false;
    };

    const commit = async () => {
      if (finished) return;
      finished = true;

      const name = input.value.trim();
      if (!name) {
        cleanup();
        return;
      }

      const newPath = targetDir.replace(/\/$/, '') + '/' + name;

      try {
        if (type === 'directory') {
          await this.connection.mkdir(newPath);
        } else {
          await this.connection.writeFile(newPath, '');
        }
        cleanup();
        if (targetDir === this.rootPath && childContainer === this.container) {
          await this.refresh();
        } else {
          await this.refreshDirectory(targetDir);
        }
        if (window.app && window.app.notify) {
          window.app.notify(`${type === 'directory' ? 'Folder' : 'File'} created: ${name}`, 'success');
        }
        if (type === 'file' && this.onFileOpen) {
          this.onFileOpen(newPath, name);
        }
      } catch (err) {
        cleanup();
        if (window.app && window.app.notify) {
          window.app.notify(`Create failed: ${err.message}`, 'error');
        }
      }
    };

    const cancel = () => {
      if (finished) return;
      finished = true;
      cleanup();
    };

    input.addEventListener('blur', () => { commit(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
  }

  addInlineFile(parentPath) {
    return this.addInlineInput(parentPath, 'file');
  }

  addInlineFolder(parentPath) {
    return this.addInlineInput(parentPath, 'directory');
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

  collapseAll() {
    this.expandedPaths.clear();
    this.expandedPaths.add(this.rootPath);
    this.refresh();
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
    } else {
      await this.refresh();
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

  formatSize(bytes) {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
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
      'css': '#563d7c', 'js': '#f1e05a', 'proxy': '#68a063',
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
