class NavigationPanel {
  constructor(app) {
    this.app = app;
    this.gotoVisible = false;
    this.shortcutsVisible = false;
    this._chordPending = false;
    this._chordTimer = null;
    this._keyHandler = null;
    this.shortcuts = this._buildShortcuts();
  }

  init() {
    this._keyHandler = (e) => this._onKeyDown(e);
    document.addEventListener('keydown', this._keyHandler, true);
  }

  dispose() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler, true);
      this._keyHandler = null;
    }
    this.hideGoToLine();
    this.hideShortcuts();
    if (this._chordTimer) { clearTimeout(this._chordTimer); this._chordTimer = null; }
  }

  _onKeyDown(e) {
    const ctrl = e.ctrlKey || e.metaKey;

    if (this._chordPending && ctrl && e.key.toLowerCase() === 's') {
      e.preventDefault();
      this._clearChord();
      this.showShortcuts();
      return;
    }
    if (this._chordPending) {
      this._clearChord();
    }

    if (ctrl && e.key.toLowerCase() === 'k' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      this._chordPending = true;
      this._chordTimer = setTimeout(() => this._clearChord(), 1500);
      return;
    }

    if (ctrl && e.key.toLowerCase() === 'g' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      this.showGoToLine();
      return;
    }

    if (e.key === 'Escape') {
      if (this.gotoVisible) { this.hideGoToLine(); return; }
      if (this.shortcutsVisible) { this.hideShortcuts(); return; }
    }
  }

  _clearChord() {
    this._chordPending = false;
    if (this._chordTimer) { clearTimeout(this._chordTimer); this._chordTimer = null; }
  }

  showGoToLine() {
    if (this.gotoVisible) return;
    const editor = this.app?.editorManager?.editor;
    if (!editor) {
      this.app?.showNotification?.('Open a file first', 'warn');
      return;
    }
    this.gotoVisible = true;

    const pos = editor.getPosition();
    const model = editor.getModel();
    const totalLines = model ? model.getLineCount() : 0;
    const currentLine = pos ? pos.lineNumber : 1;

    const overlay = document.createElement('div');
    overlay.className = 'goto-line-overlay';
    overlay.id = 'goto-line-overlay';
    overlay.innerHTML = `
      <div class="goto-line-bar">
        <input type="text" id="goto-line-input"
          placeholder="Go to Line (current: ${currentLine}, max: ${totalLines}). Format: line or line:column"
          spellcheck="false" autocomplete="off">
        <span class="goto-line-hint" id="goto-line-hint">Enter to jump · Esc to cancel</span>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#goto-line-input');
    const hint = overlay.querySelector('#goto-line-hint');

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        this._jumpToLine(input.value, hint);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        this.hideGoToLine();
      }
    });

    input.addEventListener('input', () => {
      const parsed = this._parseLineColumn(input.value);
      if (parsed && parsed.line >= 1 && parsed.line <= totalLines) {
        hint.textContent = `Jump to line ${parsed.line}${parsed.column > 1 ? ', column ' + parsed.column : ''}`;
        hint.classList.remove('error');
      } else if (input.value.trim() === '') {
        hint.textContent = 'Enter to jump · Esc to cancel';
        hint.classList.remove('error');
      } else {
        hint.textContent = `Invalid (max line: ${totalLines})`;
        hint.classList.add('error');
      }
    });

    setTimeout(() => input.focus(), 0);
  }

  hideGoToLine() {
    const overlay = document.getElementById('goto-line-overlay');
    if (overlay) overlay.remove();
    this.gotoVisible = false;
    this.app?.editorManager?.editor?.focus();
  }

  _parseLineColumn(value) {
    const v = (value || '').trim();
    if (!v) return null;
    const m = v.match(/^(\d+)(?::(\d+))?$/);
    if (!m) return null;
    const line = parseInt(m[1], 10);
    const column = m[2] ? parseInt(m[2], 10) : 1;
    if (!line || line < 1) return null;
    return { line, column };
  }

  _jumpToLine(value, hintEl) {
    const editor = this.app?.editorManager?.editor;
    if (!editor) return;
    const model = editor.getModel();
    const totalLines = model ? model.getLineCount() : 0;
    const parsed = this._parseLineColumn(value);
    if (!parsed || parsed.line < 1 || parsed.line > totalLines) {
      if (hintEl) {
        hintEl.textContent = `Invalid line (max: ${totalLines})`;
        hintEl.classList.add('error');
      }
      return;
    }
    const lineMaxCol = model ? model.getLineMaxColumn(parsed.line) : parsed.column;
    const column = Math.min(parsed.column, lineMaxCol);
    editor.revealLineInCenter(parsed.line);
    editor.setPosition({ lineNumber: parsed.line, column });
    this.hideGoToLine();
  }

  _buildShortcuts() {
    return [
      {
        category: 'General',
        items: [
          { keys: 'Ctrl+Shift+P', desc: 'Show Command Palette' },
          { keys: 'Ctrl+P', desc: 'Quick Open File' },
          { keys: 'Ctrl+G', desc: 'Go to Line' },
          { keys: 'Ctrl+K Ctrl+S', desc: 'Show Keyboard Shortcuts' },
        ],
      },
      {
        category: 'Editor',
        items: [
          { keys: 'Ctrl+S', desc: 'Save File' },
          { keys: 'Ctrl+Z', desc: 'Undo' },
          { keys: 'Ctrl+Shift+Z', desc: 'Redo' },
          { keys: 'Ctrl+F', desc: 'Find' },
          { keys: 'Ctrl+H', desc: 'Replace' },
          { keys: 'Ctrl+D', desc: 'Select Word / Add Next Occurrence' },
          { keys: 'Ctrl+/', desc: 'Toggle Line Comment' },
        ],
      },
      {
        category: 'Search',
        items: [
          { keys: 'Ctrl+F', desc: 'Find in File' },
          { keys: 'Ctrl+H', desc: 'Replace in File' },
          { keys: 'Ctrl+Shift+F', desc: 'Search Across Files' },
        ],
      },
      {
        category: 'Terminal',
        items: [
          { keys: 'Ctrl+`', desc: 'Toggle Terminal' },
          { keys: 'Ctrl+Shift+`', desc: 'New Terminal' },
        ],
      },
      {
        category: 'File Explorer',
        items: [
          { keys: 'Ctrl+Shift+E', desc: 'Show Explorer' },
          { keys: 'Ctrl+Shift+F', desc: 'Show Search' },
        ],
      },
      {
        category: 'Panels',
        items: [
          { keys: 'Ctrl+=', desc: 'Zoom In' },
          { keys: 'Ctrl+-', desc: 'Zoom Out' },
          { keys: 'Ctrl+0', desc: 'Reset Zoom' },
          { keys: 'F11', desc: 'Toggle Fullscreen' },
        ],
      },
    ];
  }

  showShortcuts() {
    if (this.shortcutsVisible) return;
    this.shortcutsVisible = true;

    const overlay = document.createElement('div');
    overlay.className = 'shortcuts-overlay';
    overlay.id = 'shortcuts-overlay';
    overlay.innerHTML = `
      <div class="shortcuts-modal">
        <div class="shortcuts-header">
          <div class="shortcuts-title">Keyboard Shortcuts</div>
          <input type="text" id="shortcuts-search"
            placeholder="Type to filter shortcuts..." spellcheck="false" autocomplete="off">
          <button class="shortcuts-close" id="shortcuts-close" title="Close (Esc)">&times;</button>
        </div>
        <div class="shortcuts-body" id="shortcuts-body"></div>
        <div class="shortcuts-footer">
          <span>Esc to close</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    this._renderShortcuts('');

    const input = overlay.querySelector('#shortcuts-search');
    const closeBtn = overlay.querySelector('#shortcuts-close');

    input.addEventListener('input', () => this._renderShortcuts(input.value));
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { ev.preventDefault(); this.hideShortcuts(); }
    });
    closeBtn.addEventListener('click', () => this.hideShortcuts());
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) this.hideShortcuts();
    });

    setTimeout(() => input.focus(), 0);
  }

  hideShortcuts() {
    const overlay = document.getElementById('shortcuts-overlay');
    if (overlay) overlay.remove();
    this.shortcutsVisible = false;
  }

  _renderShortcuts(filter) {
    const body = document.getElementById('shortcuts-body');
    if (!body) return;
    const q = (filter || '').trim().toLowerCase();

    const matches = (item) =>
      !q || item.keys.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);

    const visible = this.shortcuts
      .map((cat) => ({ ...cat, items: cat.items.filter(matches) }))
      .filter((cat) => cat.items.length > 0 || cat.category.toLowerCase().includes(q));

    if (visible.length === 0) {
      body.innerHTML = `<div class="shortcuts-empty">No shortcuts match "${this._escape(filter)}"</div>`;
      return;
    }

    body.innerHTML = visible.map((cat) => `
      <div class="shortcuts-card">
        <div class="shortcuts-card-title">${this._escape(cat.category)}</div>
        <div class="shortcuts-card-list">
          ${cat.items.map((it) => `
            <div class="shortcuts-row">
              <span class="shortcuts-keys">${this._renderKeys(it.keys)}</span>
              <span class="shortcuts-desc">${this._escape(it.desc)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  _renderKeys(keys) {
    return keys.split(' ').map((chord) =>
      chord.split('+').map((k) => `<kbd>${this._escape(k)}</kbd>`).join('+')
    ).join(' &nbsp;then&nbsp; ');
  }

  _escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
}

window.NavigationPanel = NavigationPanel;
