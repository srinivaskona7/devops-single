class Connection extends EventTarget {
  constructor() {
    super();
    this.ws = null;
    this.connected = false;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.config = null;
  }

  connect(config) {
    this.config = config;
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(config.proxyUrl);
      } catch (e) {
        reject(new Error('Invalid proxy URL'));
        return;
      }

      const timeout = setTimeout(() => {
        this.ws.close();
        reject(new Error('Connection timed out'));
      }, 15000);

      this.ws.onopen = () => {
        const authMsg = {
          type: 'auth',
          host: config.host,
          port: parseInt(config.port) || 22,
          username: config.username,
          cols: 120,
          rows: 30,
        };
        if (config.authMethod === 'key') {
          authMsg.privateKey = config.privateKey;
          if (config.passphrase) authMsg.passphrase = config.passphrase;
        } else {
          authMsg.password = config.password;
        }
        this.ws.send(JSON.stringify(authMsg));
      };

      this.ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === 'auth:success') {
          clearTimeout(timeout);
          this.connected = true;
          this.reconnectAttempts = 0;
          this._emit('connected', { home: msg.home });
          resolve(msg);
          return;
        }

        if (msg.type === 'auth:error') {
          clearTimeout(timeout);
          reject(new Error(msg.message || 'Authentication failed'));
          return;
        }

        if (msg.type === 'terminal') {
          this._emit('terminal:data', { data: msg.data });
          return;
        }

        if (msg.type === 'terminal:close') {
          this._emit('terminal:close');
          return;
        }

        if (msg.type === 'disconnected') {
          this.connected = false;
          this._emit('disconnected');
          return;
        }

        if (msg.id && this.pendingRequests.has(msg.id)) {
          const { resolve: res, reject: rej } = this.pendingRequests.get(msg.id);
          this.pendingRequests.delete(msg.id);
          if (msg.type === 'fs:error') {
            rej(new Error(msg.message));
          } else {
            res(msg);
          }
          return;
        }

        this._emit(msg.type, msg);
      };

      this.ws.onerror = () => {
        clearTimeout(timeout);
        if (!this.connected) {
          reject(new Error('Failed to connect to proxy server'));
        }
      };

      this.ws.onclose = () => {
        clearTimeout(timeout);
        const wasConnected = this.connected;
        this.connected = false;
        this.pendingRequests.forEach(({ reject: rej }) => rej(new Error('Connection lost')));
        this.pendingRequests.clear();
        if (wasConnected) {
          this._emit('disconnected');
          this._attemptReconnect();
        }
      };
    });
  }

  _attemptReconnect() {
    if (!this.config || this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
    this._emit('reconnecting', { attempt: this.reconnectAttempts, maxAttempts: this.maxReconnectAttempts });
    this._reconnectTimer = setTimeout(() => {
      this.connect(this.config)
        .then(() => { this.reconnectAttempts = 0; })
        .catch(() => { this._attemptReconnect(); });
    }, delay);
  }

  send(type, data = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, ...data }));
  }

  request(type, data = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }
      const id = ++this.requestId;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timed out'));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: (msg) => { clearTimeout(timeout); resolve(msg); },
        reject: (err) => { clearTimeout(timeout); reject(err); },
      });
      this.ws.send(JSON.stringify({ type, id, ...data }));
    });
  }

  sendTerminal(data) {
    this.send('terminal', { data: btoa(data) });
  }

  sendTerminalRaw(base64Data) {
    this.send('terminal', { data: base64Data });
  }

  resizeTerminal(cols, rows) {
    this.send('terminal:resize', { cols, rows });
  }

  listFiles(path, showHidden = false) {
    return this.request('fs:list', { path, showHidden });
  }

  readFile(path) {
    return this.request('fs:read', { path });
  }

  writeFile(path, content) {
    return this.request('fs:write', { path, content });
  }

  mkdir(path) {
    return this.request('fs:mkdir', { path });
  }

  deleteFile(path) {
    return this.request('fs:delete', { path });
  }

  renameFile(oldPath, newPath) {
    return this.request('fs:rename', { oldPath, newPath });
  }

  search(path, query, caseSensitive = false) {
    return this.request('search', { path, query, caseSensitive });
  }

  exec(command) {
    return this.request('exec', { command });
  }

  uploadFile(path, base64Content) {
    return this.request('fs:upload', { path, content: base64Content });
  }

  downloadFile(path) {
    return this.request('fs:download', { path });
  }

  disconnect() {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this.reconnectAttempts = this.maxReconnectAttempts;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  _emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

window.Connection = Connection;
