class DragDropUpload {
  constructor(app) {
    this.app = app;
    this.overlay = null;
    this.progressPanel = null;
    this.progressList = null;
    this.dragCounter = 0;
    this.activeUploads = 0;
    this._onDragEnter = this._onDragEnter.bind(this);
    this._onDragOver = this._onDragOver.bind(this);
    this._onDragLeave = this._onDragLeave.bind(this);
    this._onDrop = this._onDrop.bind(this);
    this._onWindowDragEnd = this._onWindowDragEnd.bind(this);
  }

  init() {
    this._injectStyles();
    this._buildOverlay();
    this._buildProgressPanel();

    window.addEventListener('dragenter', this._onDragEnter);
    window.addEventListener('dragover', this._onDragOver);
    window.addEventListener('dragleave', this._onDragLeave);
    window.addEventListener('drop', this._onDrop);
    window.addEventListener('dragend', this._onWindowDragEnd);
    window.addEventListener('mouseleave', this._onWindowDragEnd);
  }

  dispose() {
    window.removeEventListener('dragenter', this._onDragEnter);
    window.removeEventListener('dragover', this._onDragOver);
    window.removeEventListener('dragleave', this._onDragLeave);
    window.removeEventListener('drop', this._onDrop);
    window.removeEventListener('dragend', this._onWindowDragEnd);
    window.removeEventListener('mouseleave', this._onWindowDragEnd);

    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    if (this.progressPanel) { this.progressPanel.remove(); this.progressPanel = null; }
    this.progressList = null;
    const styleEl = document.getElementById('dragdrop-styles');
    if (styleEl) styleEl.remove();
  }

  _injectStyles() {
    if (document.getElementById('dragdrop-styles')) return;
    const style = document.createElement('style');
    style.id = 'dragdrop-styles';
    style.textContent = `
      .dd-overlay {
        position: fixed; inset: 0;
        background: var(--bg-primary);
        background-color: rgba(19, 23, 32, 0.8);
        z-index: 9999;
        display: none;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.18s ease-out;
        pointer-events: none;
      }
      .dd-overlay.active {
        display: flex;
        opacity: 1;
        pointer-events: auto;
      }
      .dd-overlay-inner {
        border: 3px dashed var(--accent, #7578e8);
        border-radius: 14px;
        padding: 60px 100px;
        background: rgba(33, 39, 54, 0.6);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        color: var(--text-bright, #e2e8f0);
        text-align: center;
        max-width: 80%;
        pointer-events: none;
      }
      .dd-overlay-icon {
        width: 72px; height: 72px;
        color: var(--accent, #7578e8);
        animation: dd-bounce 1.4s ease-in-out infinite;
      }
      @keyframes dd-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      .dd-overlay-title {
        font-size: 22px;
        font-weight: 600;
        letter-spacing: 0.3px;
      }
      .dd-overlay-sub {
        font-size: 13px;
        color: var(--text-primary, #b8c0cc);
        opacity: 0.85;
      }

      .dd-progress {
        position: fixed;
        right: 20px; bottom: 20px;
        width: 340px;
        max-height: 60vh;
        background: var(--bg-secondary, #1a1f2e);
        border: 1px solid var(--bg-tertiary, #212736);
        border-radius: 10px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.45);
        z-index: 9998;
        display: none;
        flex-direction: column;
        overflow: hidden;
        font-family: inherit;
      }
      .dd-progress.visible { display: flex; }
      .dd-progress-header {
        padding: 10px 14px;
        background: var(--bg-tertiary, #212736);
        color: var(--text-bright, #e2e8f0);
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255,255,255,0.04);
      }
      .dd-progress-close {
        background: transparent;
        border: none;
        color: var(--text-muted, #5c6470);
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 0 4px;
      }
      .dd-progress-close:hover { color: var(--text-bright, #e2e8f0); }
      .dd-progress-list {
        list-style: none;
        margin: 0;
        padding: 6px 0;
        overflow-y: auto;
        max-height: 50vh;
      }
      .dd-progress-item {
        padding: 8px 14px;
        display: flex;
        flex-direction: column;
        gap: 5px;
        border-bottom: 1px solid rgba(255,255,255,0.03);
      }
      .dd-progress-item:last-child { border-bottom: none; }
      .dd-progress-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        font-size: 12px;
        color: var(--text-primary, #b8c0cc);
      }
      .dd-progress-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
      }
      .dd-progress-status {
        font-size: 11px;
        color: var(--text-muted, #5c6470);
        flex-shrink: 0;
      }
      .dd-progress-status.done { color: var(--accent-green, #34d399); }
      .dd-progress-status.error { color: var(--accent-red, #f87171); }
      .dd-progress-bar {
        height: 4px;
        background: var(--bg-tertiary, #212736);
        border-radius: 2px;
        overflow: hidden;
      }
      .dd-progress-fill {
        height: 100%;
        width: 0%;
        background: var(--accent, #7578e8);
        transition: width 0.15s ease-out;
      }
      .dd-progress-fill.done { background: var(--accent-green, #34d399); }
      .dd-progress-fill.error { background: var(--accent-red, #f87171); }
    `;
    document.head.appendChild(style);
  }

  _buildOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'dd-overlay';
    overlay.id = 'drag-drop-overlay';
    overlay.innerHTML = `
      <div class="dd-overlay-inner">
        <svg class="dd-overlay-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <div class="dd-overlay-title">Drop files to upload</div>
        <div class="dd-overlay-sub">Files will be uploaded to the current directory</div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  _buildProgressPanel() {
    const panel = document.createElement('div');
    panel.className = 'dd-progress';
    panel.id = 'drag-drop-progress';
    panel.innerHTML = `
      <div class="dd-progress-header">
        <span id="dd-progress-title">Uploads</span>
        <button class="dd-progress-close" type="button" aria-label="Close">&times;</button>
      </div>
      <ul class="dd-progress-list"></ul>
    `;
    document.body.appendChild(panel);
    this.progressPanel = panel;
    this.progressList = panel.querySelector('.dd-progress-list');
    panel.querySelector('.dd-progress-close').addEventListener('click', () => {
      this.progressPanel.classList.remove('visible');
      this.progressList.innerHTML = '';
    });
  }

  _hasFiles(e) {
    if (!e.dataTransfer) return false;
    const types = e.dataTransfer.types;
    if (!types) return false;
    for (let i = 0; i < types.length; i++) {
      if (types[i] === 'Files' || types[i] === 'application/x-moz-file') return true;
    }
    return false;
  }

  _onDragEnter(e) {
    if (!this._hasFiles(e)) return;
    e.preventDefault();
    this.dragCounter++;
    this.showOverlay();
  }

  _onDragOver(e) {
    if (!this._hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }

  _onDragLeave(e) {
    if (!this._hasFiles(e)) return;
    e.preventDefault();
    this.dragCounter--;
    if (this.dragCounter <= 0) {
      this.dragCounter = 0;
      this.hideOverlay();
    }
  }

  _onDrop(e) {
    if (!this._hasFiles(e)) return;
    e.preventDefault();
    this.dragCounter = 0;
    this.hideOverlay();
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) this.uploadFiles(files);
  }

  _onWindowDragEnd() {
    this.dragCounter = 0;
    this.hideOverlay();
  }

  showOverlay() { if (this.overlay) this.overlay.classList.add('active'); }
  hideOverlay() { if (this.overlay) this.overlay.classList.remove('active'); }

  _resolveTargetDir() {
    const fe = this.app && this.app.fileExplorer;
    if (fe) {
      if (fe.selectedPath) {
        const sel = fe.selectedPath;
        const cache = fe.fileCache && fe.fileCache.get && fe.fileCache.get(sel);
        const isDir = cache && Array.isArray(cache);
        if (isDir) return sel;
        const idx = sel.lastIndexOf('/');
        if (idx > 0) return sel.substring(0, idx);
        if (idx === 0) return '/';
      }
      if (fe.rootPath) return fe.rootPath;
    }
    return (this.app && this.app.homePath) || '.';
  }

  _joinPath(dir, name) {
    if (!dir || dir === '.') return name;
    if (dir.endsWith('/')) return dir + name;
    return dir + '/' + name;
  }

  _readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result || '';
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.substring(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader error'));
      reader.readAsDataURL(file);
    });
  }

  _addProgressItem(file) {
    const li = document.createElement('li');
    li.className = 'dd-progress-item';
    li.innerHTML = `
      <div class="dd-progress-row">
        <span class="dd-progress-name"></span>
        <span class="dd-progress-status">queued</span>
      </div>
      <div class="dd-progress-bar"><div class="dd-progress-fill"></div></div>
    `;
    li.querySelector('.dd-progress-name').textContent = `${file.name} (${this._formatSize(file.size)})`;
    this.progressList.appendChild(li);
    this.progressPanel.classList.add('visible');
    return {
      el: li,
      status: li.querySelector('.dd-progress-status'),
      fill: li.querySelector('.dd-progress-fill'),
    };
  }

  _formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  async uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const targetDir = this._resolveTargetDir();
    const conn = this.app && this.app.connection;
    if (!conn) {
      this._notify('Not connected', 'error');
      return;
    }

    this.activeUploads += files.length;
    let success = 0;
    let failed = 0;

    for (const file of files) {
      const item = this._addProgressItem(file);
      const remotePath = this._joinPath(targetDir, file.name);

      try {
        item.status.textContent = 'reading';
        item.fill.style.width = '15%';

        const base64 = await this._readFileAsBase64(file);

        item.status.textContent = 'uploading';
        item.fill.style.width = '60%';

        if (typeof conn.uploadFile === 'function') {
          await conn.uploadFile(remotePath, base64);
        } else if (typeof conn.writeFile === 'function') {
          const text = atob(base64);
          await conn.writeFile(remotePath, text);
        } else {
          throw new Error('No upload method available on connection');
        }

        item.status.textContent = 'done';
        item.status.classList.add('done');
        item.fill.style.width = '100%';
        item.fill.classList.add('done');
        success++;
      } catch (err) {
        item.status.textContent = 'error: ' + (err && err.message ? err.message : 'failed');
        item.status.classList.add('error');
        item.fill.style.width = '100%';
        item.fill.classList.add('error');
        failed++;
      } finally {
        this.activeUploads--;
      }
    }

    if (success > 0) {
      this._notify(
        `Uploaded ${success} file${success === 1 ? '' : 's'}` + (failed ? `, ${failed} failed` : ''),
        failed ? 'warning' : 'success'
      );
    } else if (failed > 0) {
      this._notify(`Upload failed (${failed} file${failed === 1 ? '' : 's'})`, 'error');
    }

    const fe = this.app && this.app.fileExplorer;
    if (fe && typeof fe.refreshDirectory === 'function') {
      try { await fe.refreshDirectory(targetDir); } catch (_) {}
    } else if (fe && typeof fe.refresh === 'function') {
      try { await fe.refresh(); } catch (_) {}
    }
  }

  _notify(message, type) {
    if (this.app && typeof this.app.notify === 'function') {
      this.app.notify(message, type || 'info');
    }
  }
}

window.DragDropUpload = DragDropUpload;
