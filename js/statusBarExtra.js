class StatusBarExtra {
  constructor(app) {
    this.app = app;
    this.statusBar = null;
    this.selectionEl = null;
    this.lineEndingEl = null;
    this.selectionListener = null;
    this.contentListener = null;
    this.modelListener = null;
    this.lineEndings = new WeakMap();
    this.styleEl = null;
  }

  init() {
    this.statusBar = document.querySelector('.statusbar');
    if (!this.statusBar) return;

    this.injectStyles();
    this.createSelectionItem();
    this.createLineEndingItem();
    this.attachEditorListeners();
  }

  injectStyles() {
    if (document.getElementById('statusbar-extra-styles')) return;
    const style = document.createElement('style');
    style.id = 'statusbar-extra-styles';
    style.textContent = `
      .statusbar-extra {
        font-size: 12px;
        color: var(--text-muted);
      }
      .statusbar-extra.statusbar-extra-clickable { cursor: pointer; }
      .statusbar-extra.statusbar-extra-clickable:hover {
        background: var(--bg-secondary);
        color: var(--text-primary);
      }
      .statusbar-extra.statusbar-extra-selection { color: var(--accent); }
      .statusbar-extra[hidden] { display: none !important; }
    `;
    document.head.appendChild(style);
    this.styleEl = style;
  }

  createSelectionItem() {
    const cursorItem = document.getElementById('status-cursor');
    const el = document.createElement('div');
    el.className = 'statusbar-section statusbar-extra statusbar-extra-selection';
    el.id = 'status-selection';
    el.hidden = true;
    el.innerHTML = '<span></span>';
    if (cursorItem && cursorItem.parentNode) {
      cursorItem.parentNode.insertBefore(el, cursorItem.nextSibling);
    } else {
      this.statusBar.appendChild(el);
    }
    this.selectionEl = el;
  }

  createLineEndingItem() {
    const encodingItem = document.getElementById('status-encoding');
    const languageItem = document.getElementById('status-language');
    const el = document.createElement('div');
    el.className = 'statusbar-section statusbar-extra statusbar-extra-clickable';
    el.id = 'status-line-ending';
    el.title = 'Click to toggle line ending (LF / CRLF)';
    el.innerHTML = '<span>LF</span>';
    el.addEventListener('click', () => this.toggleLineEnding());

    const insertBefore = encodingItem || languageItem;
    if (insertBefore && insertBefore.parentNode) {
      insertBefore.parentNode.insertBefore(el, insertBefore);
    } else {
      this.statusBar.appendChild(el);
    }
    this.lineEndingEl = el;
  }

  attachEditorListeners() {
    const editor = this.app?.editorManager?.editor;
    if (!editor) {
      this.editorWaitTimer = setTimeout(() => this.attachEditorListeners(), 500);
      return;
    }

    this.selectionListener = editor.onDidChangeCursorSelection(() => this.updateSelection());
    this.contentListener = editor.onDidChangeModelContent(() => this.updateLineEnding());
    this.modelListener = editor.onDidChangeModel(() => {
      this.detectLineEndingFromModel();
      this.updateSelection();
      this.updateLineEnding();
    });

    this.detectLineEndingFromModel();
    this.updateSelection();
    this.updateLineEnding();
  }

  updateSelection() {
    const editor = this.app?.editorManager?.editor;
    if (!editor || !this.selectionEl) return;

    const selection = editor.getSelection();
    const model = editor.getModel();
    if (!selection || !model || selection.isEmpty()) {
      this.selectionEl.hidden = true;
      return;
    }

    const selected = model.getValueInRange(selection);
    const chars = selected.length;
    const startLine = selection.startLineNumber;
    const endLine = selection.endLineNumber;
    const lines = endLine - startLine + 1;

    const span = this.selectionEl.querySelector('span');
    if (lines > 1) {
      span.textContent = `${lines} lines, ${chars} chars selected`;
    } else {
      span.textContent = `${chars} selected`;
    }
    this.selectionEl.hidden = false;
  }

  detectLineEndingFromModel() {
    const editor = this.app?.editorManager?.editor;
    const model = editor?.getModel();
    if (!model) return;

    if (this.lineEndings.has(model)) return;

    const eol = model.getEOL();
    const ending = eol === '\r\n' ? 'CRLF' : 'LF';
    this.lineEndings.set(model, ending);
  }

  updateLineEnding() {
    const editor = this.app?.editorManager?.editor;
    const model = editor?.getModel();
    if (!model || !this.lineEndingEl) {
      if (this.lineEndingEl) this.lineEndingEl.querySelector('span').textContent = 'LF';
      return;
    }

    const eol = model.getEOL();
    const ending = eol === '\r\n' ? 'CRLF' : 'LF';
    this.lineEndings.set(model, ending);
    this.lineEndingEl.querySelector('span').textContent = ending;
  }

  toggleLineEnding() {
    const editor = this.app?.editorManager?.editor;
    const model = editor?.getModel();
    if (!model) return;

    const current = model.getEOL();
    const next = current === '\r\n' ? '\n' : '\r\n';
    const nextLabel = next === '\r\n' ? 'CRLF' : 'LF';
    const eolEnum = next === '\r\n' ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF;

    model.setEOL(eolEnum);
    this.lineEndings.set(model, nextLabel);
    this.updateLineEnding();

    if (window.app?.notify) {
      window.app.notify(`Line ending set to ${nextLabel}`, 'info');
    }
  }

  dispose() {
    if (this.editorWaitTimer) {
      clearTimeout(this.editorWaitTimer);
      this.editorWaitTimer = null;
    }
    this.selectionListener?.dispose?.();
    this.contentListener?.dispose?.();
    this.modelListener?.dispose?.();
    this.selectionListener = null;
    this.contentListener = null;
    this.modelListener = null;

    this.selectionEl?.remove();
    this.lineEndingEl?.remove();
    this.styleEl?.remove();
    this.selectionEl = null;
    this.lineEndingEl = null;
    this.styleEl = null;
  }
}

window.StatusBarExtra = StatusBarExtra;
