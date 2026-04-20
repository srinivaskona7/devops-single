/**
 * FindReplacePanel — VS Code-style floating find & replace overlay for Monaco.
 *
 * Usage:
 *   const fr = new FindReplacePanel();
 *   fr.init();
 *   fr.openFind();         // Ctrl+F
 *   fr.openFindReplace();  // Ctrl+H
 *   fr.close();            // Escape
 *
 * Depends on window.app.editorManager.editor being a Monaco editor instance.
 */
(function () {
  const STYLE_ID = 'find-replace-panel-styles';
  const PANEL_ID = 'find-replace-panel';

  const CSS = `
    #${PANEL_ID} {
      position: absolute;
      top: 8px;
      right: 28px;
      z-index: 1000;
      display: none;
      flex-direction: column;
      gap: 4px;
      padding: 6px 8px;
      background: var(--bg-secondary, #1a1f2e);
      border: 1px solid var(--bg-tertiary, #212736);
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      font-size: 13px;
      color: var(--text-primary, #b8c0cc);
      min-width: 360px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #${PANEL_ID}.visible { display: flex; }
    #${PANEL_ID} .frp-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    #${PANEL_ID} .frp-input-wrap {
      display: flex;
      align-items: center;
      flex: 1;
      background: var(--bg-tertiary, #212736);
      border: 1px solid transparent;
      border-radius: 3px;
      padding: 0 4px;
      height: 26px;
    }
    #${PANEL_ID} .frp-input-wrap:focus-within {
      border-color: var(--accent, #7578e8);
    }
    #${PANEL_ID} input[type="text"] {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-primary, #b8c0cc);
      font-size: 13px;
      padding: 0 4px;
      height: 100%;
      font-family: inherit;
    }
    #${PANEL_ID} input[type="text"]::placeholder {
      color: var(--text-muted, #5c6470);
    }
    #${PANEL_ID} .frp-count {
      color: var(--text-muted, #5c6470);
      font-size: 12px;
      padding: 0 6px;
      white-space: nowrap;
      min-width: 70px;
      text-align: right;
    }
    #${PANEL_ID} .frp-count.no-match {
      color: var(--accent-red, #f87171);
    }
    #${PANEL_ID} .frp-count.has-match {
      color: var(--accent-green, #34d399);
    }
    #${PANEL_ID} button.frp-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-primary, #b8c0cc);
      cursor: pointer;
      border-radius: 3px;
      height: 22px;
      min-width: 22px;
      padding: 0 5px;
      font-size: 12px;
      font-family: inherit;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 120ms;
    }
    #${PANEL_ID} button.frp-btn:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    #${PANEL_ID} button.frp-btn.active {
      background: rgba(117, 120, 232, 0.25);
      color: var(--accent, #7578e8);
      border-color: var(--accent, #7578e8);
    }
    #${PANEL_ID} button.frp-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    #${PANEL_ID} button.frp-action {
      background: var(--bg-tertiary, #212736);
      padding: 0 8px;
      height: 26px;
    }
    #${PANEL_ID} button.frp-action:hover {
      background: rgba(117, 120, 232, 0.25);
    }
    #${PANEL_ID} .frp-close {
      margin-left: 4px;
    }
    #${PANEL_ID} .frp-toggle-replace {
      width: 18px;
      min-width: 18px;
      padding: 0;
      align-self: stretch;
      height: auto;
      font-size: 10px;
    }
    .frp-match-decoration {
      background-color: rgba(117, 120, 232, 0.25);
      border-radius: 2px;
    }
    .frp-current-match-decoration {
      background-color: rgba(251, 191, 36, 0.45);
      border: 1px solid var(--accent-orange, #fbbf24);
      border-radius: 2px;
      box-sizing: border-box;
    }
  `;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function buildPanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) return existing;
    const el = document.createElement('div');
    el.id = PANEL_ID;
    el.innerHTML = `
      <div class="frp-row">
        <button class="frp-btn frp-toggle-replace" data-act="toggle-replace" title="Toggle Replace">▸</button>
        <div class="frp-input-wrap">
          <input type="text" class="frp-find-input" placeholder="Find" spellcheck="false" autocomplete="off" />
          <button class="frp-btn" data-opt="case" title="Match Case (Alt+C)">Aa</button>
          <button class="frp-btn" data-opt="word" title="Match Whole Word (Alt+W)">Ab|</button>
          <button class="frp-btn" data-opt="regex" title="Use Regular Expression (Alt+R)">.*</button>
        </div>
        <span class="frp-count">No results</span>
        <button class="frp-btn" data-act="prev" title="Previous Match (Shift+Enter)">↑</button>
        <button class="frp-btn" data-act="next" title="Next Match (Enter)">↓</button>
        <button class="frp-btn frp-close" data-act="close" title="Close (Escape)">✕</button>
      </div>
      <div class="frp-row frp-replace-row" style="display: none;">
        <span style="width: 18px; min-width: 18px;"></span>
        <div class="frp-input-wrap">
          <input type="text" class="frp-replace-input" placeholder="Replace" spellcheck="false" autocomplete="off" />
        </div>
        <button class="frp-btn frp-action" data-act="replace" title="Replace (Enter)">Replace</button>
        <button class="frp-btn frp-action" data-act="replace-all" title="Replace All (Ctrl+Alt+Enter)">All</button>
      </div>
    `;
    return el;
  }

  class FindReplacePanel {
    constructor() {
      this.panel = null;
      this.findInput = null;
      this.replaceInput = null;
      this.replaceRow = null;
      this.toggleReplaceBtn = null;
      this.countEl = null;
      this.editor = null;
      this.matches = [];
      this.currentIndex = -1;
      this.decorationIds = [];
      this.options = { caseSensitive: false, wholeWord: false, regex: false };
      this.replaceVisible = false;
      this._modelChangeListener = null;
      this._keydownHandler = null;
      this._initialized = false;
    }

    init() {
      if (this._initialized) return;
      injectStyles();
      this.panel = buildPanel();

      const editorContainer =
        document.getElementById('editor') ||
        document.querySelector('.editor-area') ||
        document.querySelector('.workspace') ||
        document.body;

      // Ensure container can host an absolutely-positioned child
      const cs = window.getComputedStyle(editorContainer);
      if (cs.position === 'static') {
        editorContainer.style.position = 'relative';
      }
      editorContainer.appendChild(this.panel);

      this.findInput = this.panel.querySelector('.frp-find-input');
      this.replaceInput = this.panel.querySelector('.frp-replace-input');
      this.replaceRow = this.panel.querySelector('.frp-replace-row');
      this.toggleReplaceBtn = this.panel.querySelector('[data-act="toggle-replace"]');
      this.countEl = this.panel.querySelector('.frp-count');

      this._wireEvents();
      this._wireGlobalKeys();
      this._overrideMonacoFind();
      this._initialized = true;
    }

    _overrideMonacoFind() {
      const self = this;
      const tryOverride = () => {
        const editor = self._getEditor();
        if (!editor || typeof monaco === 'undefined') return false;
        try {
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => self.openFind());
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => self.openFindReplace());
        } catch (_) {}
        return true;
      };
      if (!tryOverride()) {
        this._monacoOverrideTimer = setInterval(() => {
          if (tryOverride()) clearInterval(self._monacoOverrideTimer);
        }, 1000);
      }
    }

    _getEditor() {
      try {
        const e = window.app && window.app.editorManager && window.app.editorManager.editor;
        return e || null;
      } catch (_) {
        return null;
      }
    }

    _wireEvents() {
      this.panel.addEventListener('click', (ev) => {
        const optBtn = ev.target.closest('[data-opt]');
        if (optBtn) {
          const opt = optBtn.dataset.opt;
          if (opt === 'case') this.options.caseSensitive = !this.options.caseSensitive;
          if (opt === 'word') this.options.wholeWord = !this.options.wholeWord;
          if (opt === 'regex') this.options.regex = !this.options.regex;
          optBtn.classList.toggle('active');
          this._updateMatches();
          return;
        }
        const actBtn = ev.target.closest('[data-act]');
        if (!actBtn) return;
        const act = actBtn.dataset.act;
        if (act === 'close') this.close();
        else if (act === 'next') this.next();
        else if (act === 'prev') this.prev();
        else if (act === 'replace') this.replaceCurrent();
        else if (act === 'replace-all') this.replaceAll();
        else if (act === 'toggle-replace') this._setReplaceVisible(!this.replaceVisible);
      });

      this.findInput.addEventListener('input', () => this._updateMatches());

      this.findInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          if (ev.shiftKey) this.prev();
          else this.next();
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          this.close();
        } else if (ev.altKey && (ev.key === 'c' || ev.key === 'C')) {
          ev.preventDefault();
          this._toggleOption('case');
        } else if (ev.altKey && (ev.key === 'w' || ev.key === 'W')) {
          ev.preventDefault();
          this._toggleOption('word');
        } else if (ev.altKey && (ev.key === 'r' || ev.key === 'R')) {
          ev.preventDefault();
          this._toggleOption('regex');
        }
      });

      this.replaceInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          if (ev.ctrlKey && ev.altKey) this.replaceAll();
          else this.replaceCurrent();
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          this.close();
        }
      });
    }

    _toggleOption(opt) {
      const btn = this.panel.querySelector(`[data-opt="${opt}"]`);
      if (!btn) return;
      btn.click();
    }

    _wireGlobalKeys() {
      this._keydownHandler = (ev) => {
        const ctrl = ev.ctrlKey || ev.metaKey;
        if (ctrl && !ev.shiftKey && !ev.altKey && (ev.key === 'f' || ev.key === 'F')) {
          ev.preventDefault();
          this.openFind();
        } else if (ctrl && !ev.shiftKey && !ev.altKey && (ev.key === 'h' || ev.key === 'H')) {
          ev.preventDefault();
          this.openFindReplace();
        } else if (ev.key === 'Escape' && this._isVisible()) {
          // Only close if focus is within the panel
          if (this.panel.contains(document.activeElement)) {
            ev.preventDefault();
            this.close();
          }
        }
      };
      document.addEventListener('keydown', this._keydownHandler, true);
    }

    _isVisible() {
      return this.panel && this.panel.classList.contains('visible');
    }

    _setReplaceVisible(visible) {
      this.replaceVisible = visible;
      this.replaceRow.style.display = visible ? 'flex' : 'none';
      this.toggleReplaceBtn.textContent = visible ? '▾' : '▸';
    }

    openFind() {
      this.init();
      this._setReplaceVisible(false);
      this._show();
    }

    openFindReplace() {
      this.init();
      this._setReplaceVisible(true);
      this._show();
    }

    _show() {
      this.editor = this._getEditor();
      if (!this.editor) {
        this.panel.classList.add('visible');
        this.findInput.focus();
        return;
      }

      // Pre-fill with current selection if any
      const sel = this.editor.getSelection();
      const model = this.editor.getModel();
      if (sel && model && !sel.isEmpty()) {
        const text = model.getValueInRange(sel);
        if (text && !text.includes('\n') && text.length < 200) {
          this.findInput.value = text;
        }
      }

      this._attachModelListener();
      this.panel.classList.add('visible');
      this.findInput.focus();
      this.findInput.select();
      this._updateMatches();
    }

    close() {
      if (!this.panel) return;
      this.panel.classList.remove('visible');
      this._clearDecorations();
      this._detachModelListener();
      this.matches = [];
      this.currentIndex = -1;
      const editor = this._getEditor();
      if (editor) editor.focus();
    }

    _attachModelListener() {
      this._detachModelListener();
      const editor = this._getEditor();
      if (!editor) return;
      const model = editor.getModel();
      if (!model || !model.onDidChangeContent) return;
      this._modelChangeListener = model.onDidChangeContent(() => {
        if (this._isVisible()) this._updateMatches({ keepIndex: true });
      });
    }

    _detachModelListener() {
      if (this._modelChangeListener && typeof this._modelChangeListener.dispose === 'function') {
        this._modelChangeListener.dispose();
      }
      this._modelChangeListener = null;
    }

    _updateMatches(opts = {}) {
      const editor = this._getEditor();
      this.editor = editor;
      if (!editor) {
        this._renderCount();
        return;
      }
      const model = editor.getModel();
      if (!model) {
        this.matches = [];
        this.currentIndex = -1;
        this._clearDecorations();
        this._renderCount();
        return;
      }

      const search = this.findInput.value;
      if (!search) {
        this.matches = [];
        this.currentIndex = -1;
        this._clearDecorations();
        this._renderCount();
        return;
      }

      let found;
      try {
        found = model.findMatches(
          search,
          false,
          this.options.regex,
          this.options.caseSensitive,
          this.options.wholeWord ? ' \t\n.,;:?!()[]{}<>"\'`' : null,
          false
        );
      } catch (_) {
        // Invalid regex
        this.matches = [];
        this.currentIndex = -1;
        this._clearDecorations();
        this.countEl.textContent = 'Invalid regex';
        this.countEl.classList.add('no-match');
        this.countEl.classList.remove('has-match');
        return;
      }

      this.matches = found || [];

      if (this.matches.length === 0) {
        this.currentIndex = -1;
      } else if (opts.keepIndex && this.currentIndex >= 0) {
        this.currentIndex = Math.min(this.currentIndex, this.matches.length - 1);
      } else {
        // Pick first match at or after current cursor
        const pos = editor.getPosition();
        let idx = 0;
        if (pos) {
          for (let i = 0; i < this.matches.length; i++) {
            const r = this.matches[i].range;
            if (
              r.startLineNumber > pos.lineNumber ||
              (r.startLineNumber === pos.lineNumber && r.startColumn >= pos.column)
            ) {
              idx = i;
              break;
            }
            idx = (i + 1) % this.matches.length;
          }
        }
        this.currentIndex = idx;
      }

      this._renderDecorations();
      this._renderCount();
      if (this.currentIndex >= 0 && !opts.keepIndex) {
        this._revealCurrent(false);
      }
    }

    _renderDecorations() {
      const editor = this._getEditor();
      if (!editor) return;
      const monaco = window.monaco;
      const newDecs = this.matches.map((m, i) => ({
        range: m.range,
        options: {
          stickiness: monaco
            ? monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
            : 1,
          className:
            i === this.currentIndex
              ? 'frp-current-match-decoration'
              : 'frp-match-decoration',
        },
      }));
      this.decorationIds = editor.deltaDecorations(this.decorationIds, newDecs);
    }

    _clearDecorations() {
      const editor = this._getEditor();
      if (editor && this.decorationIds.length) {
        this.decorationIds = editor.deltaDecorations(this.decorationIds, []);
      }
      this.decorationIds = [];
    }

    _renderCount() {
      if (!this.countEl) return;
      this.countEl.classList.remove('no-match', 'has-match');
      if (!this.findInput.value) {
        this.countEl.textContent = '';
        return;
      }
      if (this.matches.length === 0) {
        this.countEl.textContent = 'No results';
        this.countEl.classList.add('no-match');
        return;
      }
      this.countEl.textContent = `${this.currentIndex + 1} of ${this.matches.length}`;
      this.countEl.classList.add('has-match');
    }

    _revealCurrent(focusEditor) {
      const editor = this._getEditor();
      if (!editor || this.currentIndex < 0 || !this.matches[this.currentIndex]) return;
      const range = this.matches[this.currentIndex].range;
      editor.setPosition({ lineNumber: range.startLineNumber, column: range.startColumn });
      editor.revealLineInCenter(range.startLineNumber);
      if (focusEditor) editor.focus();
    }

    next() {
      if (this.matches.length === 0) {
        this._updateMatches();
        return;
      }
      this.currentIndex = (this.currentIndex + 1) % this.matches.length;
      this._renderDecorations();
      this._renderCount();
      this._revealCurrent(false);
    }

    prev() {
      if (this.matches.length === 0) {
        this._updateMatches();
        return;
      }
      this.currentIndex =
        (this.currentIndex - 1 + this.matches.length) % this.matches.length;
      this._renderDecorations();
      this._renderCount();
      this._revealCurrent(false);
    }

    replaceCurrent() {
      const editor = this._getEditor();
      if (!editor) return;
      if (this.matches.length === 0 || this.currentIndex < 0) return;
      const model = editor.getModel();
      if (!model) return;

      const match = this.matches[this.currentIndex];
      const replacement = this._computeReplacement(match);

      editor.executeEdits('find-replace', [
        {
          range: match.range,
          text: replacement,
          forceMoveMarkers: true,
        },
      ]);
      // After edit, recalc matches and try to advance
      const prevIndex = this.currentIndex;
      this._updateMatches({ keepIndex: false });
      if (this.matches.length > 0) {
        // Position cursor naturally lands on the next match via _updateMatches
        this._renderDecorations();
        this._renderCount();
        this._revealCurrent(false);
      } else {
        this.currentIndex = -1;
        this._renderCount();
      }
      // Avoid unused warning
      void prevIndex;
    }

    replaceAll() {
      const editor = this._getEditor();
      if (!editor) return;
      if (this.matches.length === 0) return;
      const model = editor.getModel();
      if (!model) return;

      const edits = this.matches.map((m) => ({
        range: m.range,
        text: this._computeReplacement(m),
        forceMoveMarkers: true,
      }));
      editor.executeEdits('find-replace-all', edits);
      this._updateMatches();
    }

    _computeReplacement(match) {
      const replacement = this.replaceInput.value;
      if (!this.options.regex) return replacement;
      // For regex, support $1, $2, ... backreferences using the matched text.
      try {
        const flags = this.options.caseSensitive ? '' : 'i';
        const re = new RegExp(this._maybeWholeWord(this.findInput.value), flags);
        const matchedText =
          match.matches && match.matches[0]
            ? match.matches[0]
            : this._getEditor().getModel().getValueInRange(match.range);
        return matchedText.replace(re, replacement);
      } catch (_) {
        return replacement;
      }
    }

    _maybeWholeWord(pattern) {
      if (!this.options.wholeWord) return pattern;
      return `\\b(?:${pattern})\\b`;
    }

    dispose() {
      if (this._monacoOverrideTimer) {
        clearInterval(this._monacoOverrideTimer);
        this._monacoOverrideTimer = null;
      }
      if (this._keydownHandler) {
        document.removeEventListener('keydown', this._keydownHandler, true);
        this._keydownHandler = null;
      }
      this._detachModelListener();
      this._clearDecorations();
      if (this.panel && this.panel.parentNode) {
        this.panel.parentNode.removeChild(this.panel);
      }
      this.panel = null;
      this._initialized = false;
    }
  }

  window.FindReplacePanel = FindReplacePanel;
})();
