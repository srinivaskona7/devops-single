class EditorExtras {
  constructor(app) {
    this.app = app;
    this.defaultFontSize = 14;
    this.minFontSize = 10;
    this.maxFontSize = 40;
    this.fontSize = this.defaultFontSize;

    this.autoSaveDelay = 1500;
    this.autoSaveEnabled = true;
    this.autoSaveTimer = null;
    this.modelListeners = new WeakMap();
    this.modelChangeUnwatch = null;

    this.zoomNotifyTimeout = null;
    this.statusTimeout = null;
    this.statusEl = null;
    this.zoomEl = null;
    this.keyHandler = null;
  }

  init() {
    this.loadSettings();
    this.createStatusIndicator();
    this.bindKeyboard();
    this.applyFontSize();
    this.attachAutoSaveWatchers();
  }

  loadSettings() {
    const savedZoom = parseInt(localStorage.getItem('cloud-ide-zoom'), 10);
    if (Number.isFinite(savedZoom) && savedZoom >= this.minFontSize && savedZoom <= this.maxFontSize) {
      this.fontSize = savedZoom;
    }
    const savedAuto = localStorage.getItem('cloud-ide-autosave');
    if (savedAuto !== null) {
      this.autoSaveEnabled = savedAuto === 'true';
    }
  }

  createStatusIndicator() {
    const statusbar = document.querySelector('.statusbar');
    if (!statusbar) return;

    const spacer = statusbar.querySelector('.statusbar-spacer');

    this.zoomEl = document.createElement('div');
    this.zoomEl.className = 'statusbar-section';
    this.zoomEl.id = 'status-zoom';
    this.zoomEl.title = 'Editor zoom (Ctrl+= / Ctrl+- / Ctrl+0)';
    this.zoomEl.textContent = `${this.fontSize}px`;
    this.zoomEl.style.cursor = 'pointer';
    this.zoomEl.addEventListener('click', () => this.zoomReset());

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'statusbar-section';
    this.statusEl.id = 'status-autosave';
    this.statusEl.title = 'Toggle auto-save';
    this.statusEl.textContent = this.autoSaveEnabled ? 'Auto-save: On' : 'Auto-save: Off';
    this.statusEl.style.cursor = 'pointer';
    this.statusEl.addEventListener('click', () => this.toggleAutoSave());

    if (spacer && spacer.parentNode === statusbar) {
      statusbar.insertBefore(this.zoomEl, spacer.nextSibling);
      statusbar.insertBefore(this.statusEl, this.zoomEl.nextSibling);
    } else {
      statusbar.appendChild(this.zoomEl);
      statusbar.appendChild(this.statusEl);
    }
  }

  bindKeyboard() {
    this.keyHandler = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key;
      if (key === '=' || key === '+') {
        e.preventDefault();
        this.zoomIn();
      } else if (key === '-' || key === '_') {
        e.preventDefault();
        this.zoomOut();
      } else if (key === '0') {
        e.preventDefault();
        this.zoomReset();
      }
    };
    window.addEventListener('keydown', this.keyHandler, true);
  }

  zoomIn() {
    this.fontSize = Math.min(this.maxFontSize, this.fontSize + 1);
    this.applyFontSize();
  }

  zoomOut() {
    this.fontSize = Math.max(this.minFontSize, this.fontSize - 1);
    this.applyFontSize();
  }

  zoomReset() {
    this.fontSize = this.defaultFontSize;
    this.applyFontSize();
  }

  applyFontSize() {
    const editor = this.app?.editorManager?.editor;
    if (editor && typeof editor.updateOptions === 'function') {
      editor.updateOptions({ fontSize: this.fontSize });
    }

    const termFont = `${this.fontSize}px`;
    document.querySelectorAll('.xterm').forEach((el) => {
      el.style.fontSize = termFont;
    });
    const tm = this.app?.terminalManager;
    if (tm?.term?.options) {
      try { tm.term.options.fontSize = this.fontSize; } catch (_) {}
      try { tm.fitAddon?.fit(); } catch (_) {}
    }

    localStorage.setItem('cloud-ide-zoom', String(this.fontSize));
    if (this.zoomEl) this.zoomEl.textContent = `${this.fontSize}px`;
    this.showZoomNotice(`Zoom: ${this.fontSize}px`);
  }

  showZoomNotice(text) {
    if (!this.zoomEl) return;
    this.zoomEl.classList.add('flash');
    this.zoomEl.textContent = text;
    clearTimeout(this.zoomNotifyTimeout);
    this.zoomNotifyTimeout = setTimeout(() => {
      this.zoomEl.classList.remove('flash');
      this.zoomEl.textContent = `${this.fontSize}px`;
    }, 1200);
  }

  toggleAutoSave() {
    this.autoSaveEnabled = !this.autoSaveEnabled;
    localStorage.setItem('cloud-ide-autosave', String(this.autoSaveEnabled));
    if (this.statusEl) {
      this.statusEl.textContent = this.autoSaveEnabled ? 'Auto-save: On' : 'Auto-save: Off';
    }
    if (!this.autoSaveEnabled) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.app?.notify?.(`Auto-save ${this.autoSaveEnabled ? 'enabled' : 'disabled'}`, 'info');
  }

  attachAutoSaveWatchers() {
    const em = this.app?.editorManager;
    if (!em) return;

    const watchTab = (tab) => {
      if (!tab?.model || this.modelListeners.has(tab.model)) return;
      const sub = tab.model.onDidChangeContent(() => this.scheduleAutoSave());
      this.modelListeners.set(tab.model, sub);
    };

    em.tabs?.forEach(watchTab);

    const origOpen = em.openFile?.bind(em);
    if (origOpen && !em._extrasOpenWrapped) {
      em.openFile = async (...args) => {
        const result = await origOpen(...args);
        em.tabs?.forEach(watchTab);
        return result;
      };
      em._extrasOpenWrapped = true;
    }
  }

  scheduleAutoSave() {
    if (!this.autoSaveEnabled) return;
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => this.performAutoSave(), this.autoSaveDelay);
  }

  async performAutoSave() {
    const em = this.app?.editorManager;
    const tab = em?.activeTab;
    if (!em || !tab || !tab.modified) return;

    this.setStatus('Saving...');
    try {
      await em.saveCurrentFile();
      this.setStatus('Saved', 1200);
    } catch (err) {
      this.setStatus('Save failed', 2000);
    }
  }

  setStatus(text, revertAfter = 0) {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    clearTimeout(this.statusTimeout);
    if (revertAfter > 0) {
      this.statusTimeout = setTimeout(() => {
        this.statusEl.textContent = this.autoSaveEnabled ? 'Auto-save: On' : 'Auto-save: Off';
      }, revertAfter);
    }
  }

  dispose() {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
    clearTimeout(this.autoSaveTimer);
    clearTimeout(this.zoomNotifyTimeout);
    clearTimeout(this.statusTimeout);
    this.autoSaveTimer = null;
    this.zoomEl?.remove();
    this.statusEl?.remove();
    this.zoomEl = null;
    this.statusEl = null;
  }
}

window.EditorExtras = EditorExtras;
