class TerminalManager {
  constructor(container, connection) {
    this.container = container;
    this.connection = connection;
    this.terminal = null;
    this.fitAddon = null;
    this.resizeObserver = null;
    this._fitTimer = null;
  }

  init() {
    this.terminal = new Terminal({
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
      fontSize: 14,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      theme: {
        background: '#0a0e14',
        foreground: '#c9d1d9',
        cursor: '#a78bfa',
        cursorAccent: '#0a0e14',
        selectionBackground: '#6366f133',
        black: '#0d1117',
        red: '#f87171',
        green: '#34d399',
        yellow: '#fbbf24',
        blue: '#818cf8',
        magenta: '#f0abfc',
        cyan: '#22d3ee',
        white: '#c9d1d9',
        brightBlack: '#484f58',
        brightRed: '#fca5a5',
        brightGreen: '#6ee7b7',
        brightYellow: '#fde68a',
        brightBlue: '#a5b4fc',
        brightMagenta: '#f5d0fe',
        brightCyan: '#67e8f9',
        brightWhite: '#ecf0f5',
      },
      allowProposedApi: true,
      scrollback: 10000,
      convertEol: true,
    });

    this.fitAddon = new FitAddon.FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    const webLinksAddon = new WebLinksAddon.WebLinksAddon();
    this.terminal.loadAddon(webLinksAddon);

    this.terminal.open(this.container);

    setTimeout(() => {
      this.fit();
    }, 100);

    this.terminal.onData((data) => {
      this.connection.sendTerminal(data);
    });

    this.terminal.onResize(({ cols, rows }) => {
      this.connection.resizeTerminal(cols, rows);
    });

    this.connection.addEventListener('terminal:data', (e) => {
      const binary = atob(e.detail.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      this.terminal.write(bytes);
    });

    this.connection.addEventListener('terminal:close', () => {
      this.terminal.writeln('\r\n\x1b[31m[Connection closed]\x1b[0m');
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.fit();
    });
    this.resizeObserver.observe(this.container);
  }

  fit() {
    if (this._fitTimer) clearTimeout(this._fitTimer);
    this._fitTimer = setTimeout(() => {
      if (this.fitAddon && this.container.offsetHeight > 0 && this.container.offsetWidth > 0) {
        try {
          this.fitAddon.fit();
        } catch (e) {
          console.warn('Terminal fit failed:', e.message);
        }
      }
    }, 50);
  }

  focus() {
    if (this.terminal) {
      this.terminal.focus();
    }
  }

  clear() {
    if (this.terminal) {
      this.terminal.clear();
    }
  }

  dispose() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.terminal) {
      this.terminal.dispose();
    }
  }
}

window.TerminalManager = TerminalManager;
