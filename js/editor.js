class EditorManager {
  constructor(container, tabsBar, connection) {
    this.container = container;
    this.tabsBar = tabsBar;
    this.connection = connection;
    this.tabs = [];
    this.activeTab = null;
    this.editor = null;
    this.monacoReady = false;
    this.pendingOpen = null;
    this.onCursorChange = null;
    this.onLanguageChange = null;

    this.initMonaco();
  }

  initMonaco() {
    require(['vs/editor/editor.main'], () => {
      monaco.editor.defineTheme('cloud-ide-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
          { token: 'keyword', foreground: '818CF8' },
          { token: 'string', foreground: 'F0ABFC' },
          { token: 'number', foreground: '34D399' },
          { token: 'type', foreground: '22D3EE' },
          { token: 'function', foreground: 'FBBF24' },
          { token: 'variable', foreground: 'C9D1D9' },
          { token: 'constant', foreground: 'A78BFA' },
        ],
        colors: {
          'editor.background': '#0d1117',
          'editor.foreground': '#c9d1d9',
          'editor.lineHighlightBackground': '#161b2280',
          'editor.selectionBackground': '#6366f133',
          'editorCursor.foreground': '#a78bfa',
          'editorWhitespace.foreground': '#1c212880',
          'editorIndentGuide.background': '#1c2128',
          'editorIndentGuide.activeBackground': '#6366f140',
          'editor.selectionHighlightBackground': '#6366f120',
          'editorLineNumber.foreground': '#484f58',
          'editorLineNumber.activeForeground': '#8b949e',
          'editorGutter.background': '#0d1117',
          'minimap.background': '#0d1117',
          'scrollbarSlider.background': '#6366f125',
          'scrollbarSlider.hoverBackground': '#6366f140',
          'scrollbarSlider.activeBackground': '#6366f160',
        },
      });

      this.monacoReady = true;

      if (this.pendingOpen) {
        this.openFile(this.pendingOpen.path, this.pendingOpen.name);
        this.pendingOpen = null;
      }
    });
  }

  createEditor(container) {
    this.editor = monaco.editor.create(container, {
      theme: 'cloud-ide-dark',
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
      fontLigatures: true,
      minimap: { enabled: true, maxColumn: 80 },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      renderLineHighlight: 'all',
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      padding: { top: 8 },
      automaticLayout: true,
      wordWrap: 'off',
      tabSize: 2,
      insertSpaces: true,
      formatOnPaste: true,
      suggest: { showMethods: true, showFunctions: true, showConstructors: true },
    });

    this.editor.onDidChangeCursorPosition((e) => {
      if (this.onCursorChange) {
        this.onCursorChange(e.position.lineNumber, e.position.column);
      }
    });

    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      this.saveCurrentFile();
    });

    return this.editor;
  }

  async openFile(path, name) {
    if (!this.monacoReady) {
      this.pendingOpen = { path, name };
      return;
    }

    const existing = this.tabs.find((t) => t.path === path);
    if (existing) {
      this.activateTab(existing);
      return;
    }

    try {
      const stat = await this.connection.request('fs:stat', { path });
      const sizeMB = (stat.size || 0) / (1024 * 1024);
      if (sizeMB > 5) {
        window.app.notify(`File too large (${sizeMB.toFixed(1)} MB). Max 5 MB.`, 'error');
        return;
      }
      if (sizeMB > 1 && !confirm(`This file is ${sizeMB.toFixed(1)} MB. Open anyway?`)) return;

      const result = await this.connection.readFile(path);
      const language = this.detectLanguage(name);
      const model = monaco.editor.createModel(result.content, language);

      const tab = {
        path,
        name,
        language,
        model,
        modified: false,
        viewState: null,
      };

      model.onDidChangeContent(() => {
        tab.modified = true;
        this.updateTabUI(tab);
      });

      this.tabs.push(tab);
      this.renderTabs();
      this.activateTab(tab);

      if (this.onLanguageChange) {
        this.onLanguageChange(language);
      }
    } catch (err) {
      window.app.notify(`Failed to open ${name}: ${err.message}`, 'error');
    }
  }

  activateTab(tab) {
    if (this.activeTab) {
      this.activeTab.viewState = this.editor?.saveViewState();
    }

    this.activeTab = tab;

    const welcomeEl = document.getElementById('editor-welcome');
    if (welcomeEl) welcomeEl.style.display = 'none';

    if (!this.editor) {
      this.createEditor(this.container);
    }

    this.editor.setModel(tab.model);
    if (tab.viewState) {
      this.editor.restoreViewState(tab.viewState);
    }
    this.editor.focus();

    this.renderTabs();

    if (this.onLanguageChange) {
      this.onLanguageChange(tab.language);
    }

    const pos = this.editor.getPosition();
    if (pos && this.onCursorChange) {
      this.onCursorChange(pos.lineNumber, pos.column);
    }
  }

  closeTab(path, force = false) {
    const idx = this.tabs.findIndex((t) => t.path === path);
    if (idx === -1) return;

    const tab = this.tabs[idx];
    if (tab.modified && !force) {
      if (!confirm(`"${tab.name}" has unsaved changes. Close anyway?`)) return;
    }
    tab.model.dispose();
    this.tabs.splice(idx, 1);

    if (this.activeTab === tab) {
      if (this.tabs.length > 0) {
        const newIdx = Math.min(idx, this.tabs.length - 1);
        this.activateTab(this.tabs[newIdx]);
      } else {
        this.activeTab = null;
        if (this.editor) {
          this.editor.setModel(null);
        }
        const welcomeEl = document.getElementById('editor-welcome');
        if (welcomeEl) welcomeEl.style.display = '';
      }
    }

    this.renderTabs();
  }

  async saveCurrentFile() {
    if (!this.activeTab) return;
    const tab = this.activeTab;
    try {
      const content = tab.model.getValue();
      await this.connection.writeFile(tab.path, content);
      tab.modified = false;
      this.updateTabUI(tab);
      window.app.notify(`Saved ${tab.name}`, 'success');
    } catch (err) {
      window.app.notify(`Failed to save: ${err.message}`, 'error');
    }
  }

  renderTabs() {
    this.tabsBar.innerHTML = '';
    this.tabs.forEach((tab) => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab ${tab === this.activeTab ? 'active' : ''} ${tab.modified ? 'modified' : ''}`;
      tabEl.dataset.path = tab.path;

      tabEl.innerHTML = `
        <span class="tab-icon">${this.getTabIcon(tab.name)}</span>
        <span class="tab-name">${this.escapeHtml(tab.name)}</span>
        <button class="tab-close" title="Close">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 8.707l3.646 3.647.708-.708L8.707 8l3.647-3.646-.708-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z"/></svg>
        </button>
      `;

      tabEl.addEventListener('click', (e) => {
        if (!e.target.closest('.tab-close')) {
          this.activateTab(tab);
        }
      });

      tabEl.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          this.closeTab(tab.path);
        }
      });

      const closeBtn = tabEl.querySelector('.tab-close');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.path);
      });

      this.tabsBar.appendChild(tabEl);
    });
  }

  updateTabUI(tab) {
    const tabEl = this.tabsBar.querySelector(`.tab[data-path="${CSS.escape(tab.path)}"]`);
    if (tabEl) {
      tabEl.classList.toggle('modified', tab.modified);
    }
  }

  getTabIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const colors = {
      js: '#f1e05a', ts: '#3178c6', jsx: '#61dafb', tsx: '#3178c6',
      py: '#3572a5', go: '#00add8', rs: '#dea584', rb: '#cc342d',
      css: '#563d7c', html: '#e34c26', json: '#f1e05a', md: '#083fa1',
      sh: '#89e051', yml: '#cb171e', yaml: '#cb171e', sql: '#e38c00',
    };
    const color = colors[ext] || '#8b949e';
    return `<svg viewBox="0 0 16 16" fill="${color}"><path d="M3.5 1h6.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V14.5a1 1 0 01-1 1h-9a1 1 0 01-1-1v-12a1 1 0 011-1z" opacity="0.8"/></svg>`;
  }

  detectLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      js: 'javascript', mjs: 'javascript', cjs: 'javascript',
      jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
      py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
      java: 'java', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
      cs: 'csharp', swift: 'swift', kt: 'kotlin',
      css: 'css', scss: 'scss', less: 'less',
      html: 'html', htm: 'html', vue: 'html', svelte: 'html',
      json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'ini',
      md: 'markdown', txt: 'plaintext',
      sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
      sql: 'sql', graphql: 'graphql',
      dockerfile: 'dockerfile', makefile: 'makefile',
      r: 'r', php: 'php', lua: 'lua', perl: 'perl',
    };
    const lowerName = filename.toLowerCase();
    if (lowerName === 'dockerfile') return 'dockerfile';
    if (lowerName === 'makefile' || lowerName === 'gnumakefile') return 'makefile';
    if (lowerName.endsWith('.env') || lowerName.startsWith('.env')) return 'ini';
    if (lowerName === '.gitignore' || lowerName === '.dockerignore') return 'plaintext';
    return map[ext] || 'plaintext';
  }

  layout() {
    if (this.editor) {
      this.editor.layout();
    }
  }

  dispose() {
    this.tabs.forEach((t) => t.model.dispose());
    this.tabs = [];
    this.activeTab = null;
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.EditorManager = EditorManager;
