class App {
  constructor() {
    this.connection = new Connection();
    this.fileExplorer = null;
    this.editorManager = null;
    this.terminalManager = null;
    this.splitPane = null;
    this.devopsPanel = null;
    this.gitPanel = null;
    this.dockerPanel = null;
    this.k8sPanel = null;
    this.helmPanel = null;
    this.templatesPanel = null;
    this.commandPalette = null;
    this.nginxPanel = null;
    this.certPanel = null;
    this.kymaPanel = null;
    this.kymaConsole = null;
    this.notificationCenter = null;
    this.breadcrumbs = null;
    this.fileTransfer = null;
    this.findReplace = null;
    this.tabManager = null;
    this.navigationPanel = null;
    this.statusBarExtra = null;
    this.explorerActions = null;
    this.editorExtras = null;
    this.dragDrop = null;
    this.welcomeTab = null;
    this.breadcrumbNav = null;
    this.homePath = '/';
    this.notificationTimeout = null;
    this.authenticated = false;
  }

  init() {
    this.notificationCenter = new NotificationCenter();
    this.bindAuthEvents();
    this.bindLoginEvents();
    this.bindConnectionEvents();
    this.bindSettingsEvents();
    this.loadSavedConnection();

    const savedTheme = localStorage.getItem('cloud-ide-theme');
    if (savedTheme) {
      const cp = new CommandPalette(this);
      cp._setTheme(savedTheme);
    }
  }

  bindAuthEvents() {
    const authBtn = document.getElementById('auth-btn');
    const authError = document.getElementById('auth-error');
    if (!authBtn) return;

    const doAuth = () => {
      const user = document.getElementById('auth-username').value.trim();
      const pass = document.getElementById('auth-password').value;
      if ((user === 'admin' && pass === 'sri@123') || (user === 'root' && pass === 'root@123')) {
        this.authenticated = true;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('home-screen').style.display = '';
        document.getElementById('home-user').textContent = user;
      } else {
        authError.classList.add('visible');
        document.getElementById('auth-error-text').textContent = 'Invalid credentials';
      }
    };

    authBtn.addEventListener('click', doAuth);
    document.querySelectorAll('#auth-screen input').forEach((i) => {
      i.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAuth(); });
    });

    document.getElementById('home-logout')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.authenticated = false;
      document.getElementById('home-screen').style.display = 'none';
      document.getElementById('auth-screen').style.display = '';
    });

    document.getElementById('opt-ssh')?.addEventListener('click', () => {
      document.getElementById('home-screen').style.display = 'none';
      document.getElementById('login-screen').style.display = '';
    });

    document.getElementById('opt-k8s')?.addEventListener('click', () => {
      document.getElementById('home-screen').style.display = 'none';
      document.getElementById('login-screen').style.display = '';
    });

    document.getElementById('opt-templates')?.addEventListener('click', () => {
      document.getElementById('home-screen').style.display = 'none';
      document.getElementById('login-screen').style.display = '';
    });

    document.getElementById('opt-srinivas')?.addEventListener('click', () => {
      document.getElementById('home-screen').style.display = 'none';
      document.getElementById('login-screen').style.display = '';
    });

    document.getElementById('opt-kyma')?.addEventListener('click', () => {
      document.getElementById('home-screen').style.display = 'none';
      document.getElementById('login-screen').style.display = '';
    });

    document.getElementById('status-notifications')?.addEventListener('click', () => {
      this.notificationCenter?.show();
    });
  }

  bindLoginEvents() {
    const authBtns = document.querySelectorAll('.auth-toggle-btn');
    authBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        authBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const method = btn.dataset.method;
        document.querySelector('.password-area').classList.toggle('active', method === 'password');
        document.querySelector('.key-upload-area').classList.toggle('active', method === 'key');
      });
    });

    document.getElementById('key-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          document.getElementById('ssh-key').value = ev.target.result;
        };
        reader.readAsText(file);
      }
    });

    document.getElementById('connect-btn').addEventListener('click', () => this.handleConnect());

    document.querySelectorAll('#login-screen input').forEach((input) => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleConnect();
      });
    });
  }

  bindConnectionEvents() {
    this.connection.addEventListener('connected', (e) => {
      this.homePath = e.detail.home || '/root';
      this.showIDE();
    });

    this.connection.addEventListener('disconnected', () => {
      this.notify('Disconnected from server', 'error');
      const statusIcon = document.querySelector('#status-connection svg');
      const statusText = document.getElementById('status-host');
      if (statusIcon) {
        statusIcon.classList.remove('connected');
        statusIcon.classList.add('disconnected');
      }
      if (statusText) statusText.textContent = 'Disconnected';
    });

    this.connection.addEventListener('reconnecting', (e) => {
      const { attempt, maxAttempts } = e.detail;
      this.notify(`Reconnecting... (${attempt}/${maxAttempts})`, 'info');
      const statusText = document.getElementById('status-host');
      if (statusText) statusText.textContent = 'Reconnecting...';
    });
  }

  async handleConnect() {
    const btn = document.getElementById('connect-btn');
    const errorEl = document.getElementById('login-error');
    const errorText = document.getElementById('login-error-text');

    errorEl.classList.remove('visible');
    btn.classList.add('loading');
    btn.disabled = true;

    const authMethod = document.querySelector('.auth-toggle-btn.active').dataset.method;

    const config = {
      proxyUrl: document.getElementById('proxy-url').value.trim(),
      host: document.getElementById('ssh-host').value.trim(),
      port: document.getElementById('ssh-port').value.trim(),
      username: document.getElementById('ssh-username').value.trim(),
      authMethod,
    };

    if (authMethod === 'key') {
      config.privateKey = document.getElementById('ssh-key').value;
      config.passphrase = document.getElementById('ssh-passphrase').value;
    } else {
      config.password = document.getElementById('ssh-password').value;
    }

    if (!config.proxyUrl || !config.host || !config.username) {
      errorText.textContent = 'Please fill in all required fields';
      errorEl.classList.add('visible');
      btn.classList.remove('loading');
      btn.disabled = false;
      return;
    }

    if (document.getElementById('remember-conn').checked) {
      const saved = { ...config };
      delete saved.password;
      delete saved.privateKey;
      delete saved.passphrase;
      localStorage.setItem('cloud-ide-conn', JSON.stringify(saved));
    }

    try {
      await this.connection.connect(config);
    } catch (err) {
      errorText.textContent = err.message;
      errorEl.classList.add('visible');
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  loadSavedConnection() {
    try {
      const saved = JSON.parse(localStorage.getItem('cloud-ide-conn'));
      if (saved) {
        if (saved.proxyUrl) document.getElementById('proxy-url').value = saved.proxyUrl;
        if (saved.host) document.getElementById('ssh-host').value = saved.host;
        if (saved.port) document.getElementById('ssh-port').value = saved.port;
        if (saved.username) document.getElementById('ssh-username').value = saved.username;
        if (saved.authMethod === 'key') {
          document.querySelector('.auth-toggle-btn[data-method="key"]').click();
        }
      }
    } catch {}
    
    if (!document.getElementById('proxy-url').value) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      document.getElementById('proxy-url').value = protocol + '//' + window.location.host;
    }
  }

  showIDE() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.add('active');

    const statusText = document.getElementById('status-host');
    const config = this.connection.config;
    if (statusText && config) {
      statusText.textContent = `${config.username}@${config.host}`;
    }

    document.getElementById('titlebar-path').textContent = ` — ${config.username}@${config.host}`;

    this.initIDE();
  }

  initIDE() {
    const fileTreeEl = document.getElementById('file-tree');
    this.fileExplorer = new FileExplorer(fileTreeEl, this.connection);
    this.fileExplorer.onFileOpen = (path, name) => {
      this.editorManager.openFile(path, name);
    };
    this.fileExplorer.init(this.homePath);

    const editorContainer = document.getElementById('editor-container');
    const tabsBar = document.getElementById('tabs-bar');
    this.editorManager = new EditorManager(editorContainer, tabsBar, this.connection);

    this.editorManager.onCursorChange = (line, col) => {
      document.querySelector('#status-cursor span').textContent = `Ln ${line}, Col ${col}`;
    };
    this.editorManager.onLanguageChange = (lang) => {
      const displayName = lang.charAt(0).toUpperCase() + lang.slice(1);
      document.querySelector('#status-language span').textContent = displayName;
    };

    const terminalContainer = document.getElementById('terminal-container');
    this.terminalManager = new TerminalManager(terminalContainer, this.connection);
    this.terminalManager.init();

    this.splitPane = new SplitPane();
    this.splitPane.onResize = () => {
      this.editorManager.layout();
      this.terminalManager.fit();
    };
    this.splitPane.init();

    this.devopsPanel = new DevOpsPanel(this.connection);
    this.devopsPanel.init();

    this.gitPanel = new GitPanel(this.connection, this.homePath);
    this.gitPanel.init();

    this.dockerPanel = new DockerPanel(this.connection);
    this.dockerPanel.init();

    this.k8sPanel = new K8sPanel(this.connection);
    this.k8sPanel.init();

    this.helmPanel = new HelmPanel(this.connection);
    this.helmPanel.init();

    this.templatesPanel = new TemplatesPanel(this.connection);
    this.templatesPanel.init();

    this.nginxPanel = new NginxPanel(this.connection);
    this.nginxPanel.init();

    this.certPanel = new CertPanel(this.connection);
    this.certPanel.init();

    this.kymaPanel = new KymaPanel(this.connection);
    this.kymaPanel.init();

    this.kymaConsole = new KymaConsole(this.connection);
    this.kymaConsole.init();
    document.getElementById('kyma-console-refresh')?.addEventListener('click', () => {
      document.getElementById('kyma-content').style.display = 'none';
      document.getElementById('kyma-console-content').style.display = '';
      this.kymaConsole.refresh();
    });

    this.linuxAdminPanel = new LinuxAdminPanel(this.connection);
    this.linuxAdminPanel.init();

    this.logViewerPanel = new LogViewerPanel(this.connection);
    this.logViewerPanel.init();

    this.networkToolsPanel = new NetworkToolsPanel(this.connection);
    this.networkToolsPanel.init();

    this.cicdPanel = new CICDPanel(this.connection);
    this.cicdPanel.init();

    this.commandPalette = new CommandPalette(this);
    this.commandPalette.init();
    this.commandPalette.loadSavedTheme();

    this.breadcrumbs = new Breadcrumbs(document.getElementById('breadcrumb-bar'));

    this.fileTransfer = new FileTransfer(this.connection, this);
    this.fileTransfer.init();

    this.findReplace = new FindReplacePanel();
    this.findReplace.init();

    this.tabManager = new TabManager(this.editorManager);
    this.tabManager.init();

    this.navigationPanel = new NavigationPanel(this);
    this.navigationPanel.init();

    this.statusBarExtra = new StatusBarExtra(this);
    this.statusBarExtra.init();

    this.explorerActions = new ExplorerActions(this);
    this.explorerActions.init();

    this.editorExtras = new EditorExtras(this);
    this.editorExtras.init();

    this.dragDrop = new DragDropUpload(this);
    this.dragDrop.init();

    this.welcomeTab = new WelcomeTab(this);
    this.welcomeTab.init();

    this.breadcrumbNav = new BreadcrumbNav(this);
    this.breadcrumbNav.init();

    const origOpenFile = this.editorManager.openFile.bind(this.editorManager);
    this.editorManager.openFile = (path, name) => {
      origOpenFile(path, name);
      if (this.breadcrumbs) this.breadcrumbs.update(path);
      if (this.welcomeTab) this.welcomeTab.addRecentFile(path, name);
      if (this.welcomeTab) this.welcomeTab.hide();
    };

    this.bindIDEEvents();
    this.bindKeyboardShortcuts();
  }

  bindIDEEvents() {
    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
    document.addEventListener('fullscreenchange', () => {
      const icon = document.getElementById('fullscreen-icon');
      if (icon) {
        icon.innerHTML = document.fullscreenElement
          ? '<path d="M5.5 1a.5.5 0 01.5.5v3a.5.5 0 01-.5.5h-3a.5.5 0 010-1H5V1.5a.5.5 0 01.5-.5zm5 0a.5.5 0 01.5.5V4h2.5a.5.5 0 010 1h-3a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5zM1 10.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v3a.5.5 0 01-1 0V11H1.5a.5.5 0 01-.5-.5zm9 0a.5.5 0 01.5-.5h3a.5.5 0 010 1H11v2.5a.5.5 0 01-1 0v-3z"/>'
          : '<path d="M1.5 1a.5.5 0 00-.5.5v4a.5.5 0 001 0V2h3.5a.5.5 0 000-1h-4zm13 0h-4a.5.5 0 000 1H14v3.5a.5.5 0 001 0v-4a.5.5 0 00-.5-.5zM1 10.5a.5.5 0 011 0V14h3.5a.5.5 0 010 1h-4a.5.5 0 01-.5-.5v-4zm14 0a.5.5 0 00-1 0V14h-3.5a.5.5 0 000 1h4a.5.5 0 00.5-.5v-4z"/>';
      }
      setTimeout(() => {
        if (this.editorManager) this.editorManager.layout();
        if (this.terminalManager) this.terminalManager.fit();
      }, 100);
    });

    document.getElementById('btn-disconnect').addEventListener('click', () => {
      this.connection.disconnect();
      this.cleanupIDE();
      document.getElementById('app').classList.remove('active');
      document.getElementById('login-screen').classList.remove('hidden');
      const btn = document.getElementById('connect-btn');
      btn.classList.remove('loading');
      btn.disabled = false;
    });

    document.getElementById('btn-new-file').addEventListener('click', () => {
      this.fileExplorer.addInlineFile();
    });

    document.getElementById('btn-new-folder').addEventListener('click', () => {
      this.fileExplorer.addInlineFolder();
    });

    document.getElementById('btn-refresh-tree').addEventListener('click', () => {
      this.fileExplorer.refresh();
    });

    document.getElementById('btn-collapse-all')?.addEventListener('click', () => {
      this.fileExplorer.collapseAll();
    });

    document.getElementById('btn-toggle-hidden').addEventListener('click', () => {
      this.fileExplorer.toggleHidden();
    });

    document.querySelectorAll('.activity-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.panel;
        const sidebar = document.getElementById('sidebar');
        const isActive = btn.classList.contains('active');

        document.querySelectorAll('.activity-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.sidebar-panel').forEach((p) => p.classList.remove('active'));

        if (isActive) {
          sidebar.classList.add('collapsed');
        } else {
          sidebar.classList.remove('collapsed');
          btn.classList.add('active');
          const targetPanel = document.getElementById(`panel-${panel}`);
          if (targetPanel) targetPanel.classList.add('active');
          this.autoRefreshPanel(panel);
        }

        setTimeout(() => {
          if (this.editorManager) this.editorManager.layout();
          if (this.terminalManager) this.terminalManager.fit();
        }, 300);
      });
    });

    document.getElementById('btn-close-panel').addEventListener('click', () => {
      const panel = document.getElementById('panel-area');
      panel.style.display = panel.style.display === 'none' ? '' : 'none';
      setTimeout(() => {
        this.editorManager.layout();
      }, 50);
    });

    document.getElementById('btn-maximize-terminal').addEventListener('click', () => {
      const panel = document.getElementById('panel-area');
      if (panel.style.height === '100%') {
        panel.style.height = '250px';
      } else {
        panel.style.height = '100%';
      }
      setTimeout(() => {
        this.editorManager.layout();
        this.terminalManager.fit();
      }, 50);
    });

    document.addEventListener('click', () => {
      this.hideContextMenu();
    });

    const contextMenu = document.getElementById('context-menu');
    contextMenu.querySelectorAll('.context-menu-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleContextAction(item.dataset.action);
        this.hideContextMenu();
      });
    });
  }

  autoRefreshPanel(panel) {
    const map = {
      docker: this.dockerPanel,
      git: this.gitPanel,
      k8s: this.k8sPanel,
      helm: this.helmPanel,
      admin: this.linuxAdminPanel,
      devops: this.devopsPanel,
      nginx: this.nginxPanel,
      certs: this.certPanel,
      logs: this.logViewerPanel,
      network: this.networkToolsPanel,
      cicd: this.cicdPanel,
    };
    const instance = map[panel];
    if (instance && typeof instance.refresh === 'function') {
      instance.refresh();
    }
  }

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        const panel = document.getElementById('panel-area');
        if (panel.style.display === 'none') {
          panel.style.display = '';
          this.terminalManager.focus();
        } else {
          this.terminalManager.focus();
        }
        this.terminalManager.fit();
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        document.querySelector('.activity-btn[data-panel="explorer"]').classList.toggle('active');
        setTimeout(() => {
          this.editorManager.layout();
          this.terminalManager.fit();
        }, 250);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        this.showQuickOpen();
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        if (this.commandPalette) this.commandPalette.show();
      }
    });
  }

  showContextMenu(x, y, entry) {
    const menu = document.getElementById('context-menu');
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('visible');
    menu.dataset.path = entry.path;
    menu.dataset.type = entry.type;
    menu.dataset.name = entry.name;

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (y - rect.height) + 'px';
    }
  }

  hideContextMenu() {
    document.getElementById('context-menu').classList.remove('visible');
  }

  handleContextAction(action) {
    const menu = document.getElementById('context-menu');
    const path = menu.dataset.path;
    const type = menu.dataset.type;
    const name = menu.dataset.name;

    switch (action) {
      case 'new-file':
        this.promptNewFile(type === 'directory' ? path : this.fileExplorer.getParentPath(path));
        break;
      case 'new-folder':
        this.promptNewFolder(type === 'directory' ? path : this.fileExplorer.getParentPath(path));
        break;
      case 'rename':
        this.promptRename(path, name);
        break;
      case 'delete':
        this.promptDelete(path, name);
        break;
      case 'copy-path':
        navigator.clipboard.writeText(path);
        this.notify('Path copied to clipboard', 'info');
        break;
      case 'download':
        if (this.fileTransfer) this.fileTransfer.download(path);
        break;
    }
  }

  promptNewFile(basePath) {
    const dir = basePath || this.fileExplorer.selectedPath || this.homePath;
    this.showInputDialog('New File', 'Enter file name', async (name) => {
      if (!name) return;
      const fullPath = dir.replace(/\/$/, '') + '/' + name;
      try {
        await this.connection.writeFile(fullPath, '');
        await this.fileExplorer.refreshDirectory(dir);
        this.editorManager.openFile(fullPath, name);
        this.notify(`Created ${name}`, 'success');
      } catch (err) {
        this.notify(`Failed to create file: ${err.message}`, 'error');
      }
    });
  }

  promptNewFolder(basePath) {
    const dir = basePath || this.fileExplorer.selectedPath || this.homePath;
    this.showInputDialog('New Folder', 'Enter folder name', async (name) => {
      if (!name) return;
      const fullPath = dir.replace(/\/$/, '') + '/' + name;
      try {
        await this.connection.mkdir(fullPath);
        await this.fileExplorer.refreshDirectory(dir);
        this.notify(`Created folder ${name}`, 'success');
      } catch (err) {
        this.notify(`Failed to create folder: ${err.message}`, 'error');
      }
    });
  }

  promptRename(oldPath, oldName) {
    this.showInputDialog('Rename', 'Enter new name', async (newName) => {
      if (!newName || newName === oldName) return;
      const parentPath = this.fileExplorer.getParentPath(oldPath);
      const newPath = parentPath.replace(/\/$/, '') + '/' + newName;
      try {
        await this.connection.renameFile(oldPath, newPath);
        await this.fileExplorer.refreshDirectory(parentPath);
        this.notify(`Renamed to ${newName}`, 'success');
      } catch (err) {
        this.notify(`Failed to rename: ${err.message}`, 'error');
      }
    }, oldName);
  }

  promptDelete(path, name) {
    if (confirm(`Delete "${name}"? This cannot be undone.`)) {
      const parentPath = this.fileExplorer.getParentPath(path);
      this.connection.deleteFile(path)
        .then(() => {
          this.fileExplorer.refreshDirectory(parentPath);
          this.editorManager.closeTab(path, true);
          this.notify(`Deleted ${name}`, 'success');
        })
        .catch((err) => {
          this.notify(`Failed to delete: ${err.message}`, 'error');
        });
    }
  }

  showInputDialog(title, placeholder, callback, defaultValue = '') {
    const overlay = document.createElement('div');
    overlay.className = 'input-overlay';
    overlay.innerHTML = `
      <div class="input-dialog">
        <input type="text" placeholder="${placeholder}" value="${this.escapeAttr(defaultValue)}" spellcheck="false">
      </div>
    `;

    const input = overlay.querySelector('input');

    const close = () => {
      overlay.remove();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        callback(input.value.trim());
        close();
      }
      if (e.key === 'Escape') {
        close();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    document.body.appendChild(overlay);
    input.focus();
    input.select();
  }

  notify(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    if (this.notificationTimeout) clearTimeout(this.notificationTimeout);

    if (this.notificationCenter) this.notificationCenter.add(message, type);

    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.textContent = message;
    document.body.appendChild(el);

    this.notificationTimeout = setTimeout(() => {
      el.style.animation = 'fadeOut 200ms ease forwards';
      setTimeout(() => el.remove(), 200);
    }, 3000);
  }

  cleanupIDE() {
    if (this.terminalManager) {
      this.terminalManager.dispose();
      this.terminalManager = null;
    }
    if (this.editorManager) {
      this.editorManager.dispose();
      this.editorManager = null;
    }
    if (this.devopsPanel) {
      this.devopsPanel.dispose();
      this.devopsPanel = null;
    }
    if (this.gitPanel) { this.gitPanel.dispose(); this.gitPanel = null; }
    if (this.dockerPanel) { this.dockerPanel.dispose(); this.dockerPanel = null; }
    if (this.k8sPanel) { this.k8sPanel.dispose(); this.k8sPanel = null; }
    if (this.helmPanel) { this.helmPanel.dispose(); this.helmPanel = null; }
    if (this.templatesPanel) { this.templatesPanel.dispose(); this.templatesPanel = null; }
    if (this.commandPalette) { this.commandPalette.dispose(); this.commandPalette = null; }
    if (this.nginxPanel) { this.nginxPanel.dispose(); this.nginxPanel = null; }
    if (this.certPanel) { this.certPanel.dispose(); this.certPanel = null; }
    if (this.kymaPanel) { this.kymaPanel.dispose(); this.kymaPanel = null; }
    if (this.kymaConsole) { this.kymaConsole.dispose(); this.kymaConsole = null; }
    if (this.linuxAdminPanel) { this.linuxAdminPanel.dispose(); this.linuxAdminPanel = null; }
    if (this.logViewerPanel) { this.logViewerPanel.dispose(); this.logViewerPanel = null; }
    if (this.networkToolsPanel) { this.networkToolsPanel.dispose(); this.networkToolsPanel = null; }
    if (this.cicdPanel) { this.cicdPanel.dispose(); this.cicdPanel = null; }
    if (this.findReplace) { this.findReplace.dispose(); this.findReplace = null; }
    if (this.tabManager) { this.tabManager.dispose(); this.tabManager = null; }
    if (this.navigationPanel) { this.navigationPanel.dispose(); this.navigationPanel = null; }
    if (this.statusBarExtra) { this.statusBarExtra.dispose(); this.statusBarExtra = null; }
    if (this.explorerActions) { this.explorerActions.dispose(); this.explorerActions = null; }
    if (this.editorExtras) { this.editorExtras.dispose(); this.editorExtras = null; }
    if (this.dragDrop) { this.dragDrop.dispose(); this.dragDrop = null; }
    if (this.welcomeTab) { this.welcomeTab.dispose(); this.welcomeTab = null; }
    if (this.breadcrumbNav) { this.breadcrumbNav.dispose(); this.breadcrumbNav = null; }
    this.fileExplorer = null;
    this.splitPane = null;

    document.getElementById('file-tree').innerHTML = '';
    document.getElementById('tabs-bar').innerHTML = '';
    document.getElementById('terminal-container').innerHTML = '';

    const welcome = document.getElementById('editor-welcome');
    if (welcome) welcome.style.display = '';

    const panel = document.getElementById('panel-area');
    panel.style.display = '';
    panel.style.height = '250px';

    document.querySelectorAll('.activity-btn').forEach((b) => b.classList.remove('active'));
    document.querySelector('.activity-btn[data-panel="explorer"]').classList.add('active');
    document.querySelectorAll('.sidebar-panel').forEach((p) => p.classList.remove('active'));
    document.getElementById('panel-explorer').classList.add('active');
    document.getElementById('sidebar').classList.remove('collapsed');
  }

  bindSettingsEvents() {
    this.loadSettings();

    const fontSizeSlider = document.getElementById('setting-font-size');
    if (fontSizeSlider) {
      fontSizeSlider.addEventListener('input', () => {
        if (this.editorManager && this.editorManager.editor) {
          this.editorManager.editor.updateOptions({ fontSize: parseInt(fontSizeSlider.value) });
        }
        this.saveSettings();
      });
    }

    const tabSizeSelect = document.getElementById('setting-tab-size');
    if (tabSizeSelect) {
      tabSizeSelect.addEventListener('change', () => {
        if (this.editorManager && this.editorManager.editor) {
          this.editorManager.editor.updateOptions({ tabSize: parseInt(tabSizeSelect.value) });
        }
        this.saveSettings();
      });
    }

    const wordWrapToggle = document.getElementById('setting-word-wrap');
    if (wordWrapToggle) {
      wordWrapToggle.addEventListener('click', () => {
        wordWrapToggle.classList.toggle('active');
        if (this.editorManager && this.editorManager.editor) {
          this.editorManager.editor.updateOptions({ wordWrap: wordWrapToggle.classList.contains('active') ? 'on' : 'off' });
        }
        this.saveSettings();
      });
    }

    const minimapToggle = document.getElementById('setting-minimap');
    if (minimapToggle) {
      minimapToggle.addEventListener('click', () => {
        minimapToggle.classList.toggle('active');
        if (this.editorManager && this.editorManager.editor) {
          this.editorManager.editor.updateOptions({ minimap: { enabled: minimapToggle.classList.contains('active') } });
        }
        this.saveSettings();
      });
    }

    const termFontSlider = document.getElementById('setting-term-font-size');
    if (termFontSlider) {
      termFontSlider.addEventListener('input', () => {
        if (this.terminalManager && this.terminalManager.terminal) {
          this.terminalManager.terminal.options.fontSize = parseInt(termFontSlider.value);
          this.terminalManager.fit();
        }
        this.saveSettings();
      });
    }

    document.querySelectorAll('.search-option-btn').forEach((btn) => {
      btn.addEventListener('click', () => btn.classList.toggle('active'));
    });

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      let searchTimer = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => this.performSearch(), 400);
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { clearTimeout(searchTimer); this.performSearch(); }
      });
    }
  }

  saveSettings() {
    const settings = {
      fontSize: document.getElementById('setting-font-size')?.value,
      tabSize: document.getElementById('setting-tab-size')?.value,
      wordWrap: document.getElementById('setting-word-wrap')?.classList.contains('active'),
      minimap: document.getElementById('setting-minimap')?.classList.contains('active'),
      termFontSize: document.getElementById('setting-term-font-size')?.value,
    };
    localStorage.setItem('cloud-ide-settings', JSON.stringify(settings));
  }

  loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('cloud-ide-settings'));
      if (!settings) return;
      const fs = document.getElementById('setting-font-size');
      if (fs && settings.fontSize) fs.value = settings.fontSize;
      const ts = document.getElementById('setting-tab-size');
      if (ts && settings.tabSize) ts.value = settings.tabSize;
      const ww = document.getElementById('setting-word-wrap');
      if (ww) ww.classList.toggle('active', !!settings.wordWrap);
      const mm = document.getElementById('setting-minimap');
      if (mm) mm.classList.toggle('active', settings.minimap !== false);
      const tf = document.getElementById('setting-term-font-size');
      if (tf && settings.termFontSize) tf.value = settings.termFontSize;
    } catch {}
  }

  escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  async performSearch() {
    const query = document.getElementById('search-input').value.trim();
    const results = document.getElementById('search-results');
    if (!query || !this.connection.connected) {
      results.innerHTML = '<div class="search-status">Type to search across files</div>';
      return;
    }
    const caseSensitive = document.getElementById('search-case').classList.contains('active');
    results.innerHTML = '<div class="search-status">Searching...</div>';
    try {
      const resp = await this.connection.search(this.homePath, query, caseSensitive);
      if (!resp.results || resp.results.length === 0) {
        results.innerHTML = '<div class="search-status">No results found</div>';
        return;
      }
      results.innerHTML = '';
      resp.results.forEach((r) => {
        const fileEl = document.createElement('div');
        fileEl.className = 'search-result-file';
        fileEl.textContent = r.file.replace(this.homePath + '/', '');
        results.appendChild(fileEl);
        r.matches.forEach((m) => {
          const lineEl = document.createElement('div');
          lineEl.className = 'search-result-line';
          const escaped = m.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, caseSensitive ? 'g' : 'gi');
          lineEl.innerHTML = `<span style="color:var(--text-muted);margin-right:8px;">${m.line}</span>${escaped.replace(re, '<span class="match">$1</span>')}`;
          lineEl.addEventListener('click', () => {
            const name = r.file.split('/').pop();
            this.editorManager.openFile(r.file, name);
          });
          results.appendChild(lineEl);
        });
      });
    } catch (err) {
      results.innerHTML = `<div class="search-status">Error: ${err.message}</div>`;
    }
  }

  showQuickOpen() {
    if (!this.fileExplorer) return;
    const overlay = document.createElement('div');
    overlay.className = 'input-overlay';
    overlay.innerHTML = `
      <div class="quick-open-dialog">
        <input type="text" placeholder="Search files by name..." spellcheck="false">
        <div class="quick-open-results"></div>
      </div>
    `;

    const input = overlay.querySelector('input');
    const results = overlay.querySelector('.quick-open-results');
    let allFiles = [];

    const collectFiles = (cache) => {
      const files = [];
      cache.forEach((entries, dirPath) => {
        entries.forEach((e) => {
          if (e.type === 'file') files.push(e);
        });
      });
      return files;
    };

    allFiles = collectFiles(this.fileExplorer.fileCache);

    const render = (query) => {
      results.innerHTML = '';
      const q = query.toLowerCase();
      const matches = q
        ? allFiles.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 20)
        : allFiles.slice(0, 20);
      if (matches.length === 0) {
        results.innerHTML = '<div class="quick-open-empty">No matching files</div>';
        return;
      }
      matches.forEach((file, i) => {
        const item = document.createElement('div');
        item.className = `quick-open-item ${i === 0 ? 'selected' : ''}`;
        item.dataset.path = file.path;
        item.dataset.name = file.name;
        item.innerHTML = `<span class="quick-open-name">${this.fileExplorer.escapeHtml(file.name)}</span><span class="quick-open-path">${this.fileExplorer.escapeHtml(file.path)}</span>`;
        item.addEventListener('click', () => {
          this.editorManager.openFile(file.path, file.name);
          close();
        });
        results.appendChild(item);
      });
    };

    const close = () => overlay.remove();

    input.addEventListener('input', () => render(input.value.trim()));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { close(); return; }
      const items = results.querySelectorAll('.quick-open-item');
      const current = results.querySelector('.quick-open-item.selected');
      const idx = Array.from(items).indexOf(current);
      if (e.key === 'ArrowDown' && idx < items.length - 1) {
        e.preventDefault();
        if (current) current.classList.remove('selected');
        items[idx + 1].classList.add('selected');
        items[idx + 1].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp' && idx > 0) {
        e.preventDefault();
        if (current) current.classList.remove('selected');
        items[idx - 1].classList.add('selected');
        items[idx - 1].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && current) {
        this.editorManager.openFile(current.dataset.path, current.dataset.name);
        close();
      }
    });

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    input.focus();
    render('');
  }
}

window.app = new App();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
