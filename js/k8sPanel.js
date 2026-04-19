class K8sPanel {
  constructor(connection) {
    this.connection = connection;
    this.namespace = 'default';
    this.namespaces = [];
    this.activeTab = 'pods';
    this.data = {};
  }

  init() {
    document.getElementById('k8s-refresh')?.addEventListener('click', () => this.refresh());
  }

  async refresh() {
    const content = document.getElementById('k8s-content');
    content.innerHTML = '<div class="devops-status">Loading cluster...</div>';
    try {
      const check = await this.connection.exec('command -v kubectl >/dev/null 2>&1 && echo "ok" || echo "no"');
      if (check.stdout.trim() !== 'ok') {
        content.innerHTML = '<div class="devops-status error">kubectl not installed — install from DevOps Tools panel</div>';
        return;
      }
      const ctxR = await this.connection.exec('kubectl config current-context 2>/dev/null || echo "none"');
      const nsR = await this.connection.exec('kubectl get ns -o jsonpath="{.items[*].metadata.name}" 2>/dev/null');
      this.namespaces = nsR.stdout.trim().split(/\s+/).filter(Boolean);
      if (this.namespaces.length === 0) {
        content.innerHTML = '<div class="devops-status error">No cluster access</div>';
        return;
      }
      this.clusterCtx = ctxR.stdout.trim();
      await this.loadTab();
    } catch (err) {
      content.innerHTML = `<div class="devops-status error">${err.message}</div>`;
    }
  }

  async loadTab() {
    const ns = this.namespace;
    const tab = this.activeTab;
    const cmds = {
      pods: `kubectl get pods -n ${ns} -o wide --no-headers 2>/dev/null`,
      deployments: `kubectl get deploy -n ${ns} --no-headers 2>/dev/null`,
      services: `kubectl get svc -n ${ns} --no-headers 2>/dev/null`,
      ingresses: `kubectl get ingress -n ${ns} --no-headers 2>/dev/null`,
      configmaps: `kubectl get cm -n ${ns} --no-headers 2>/dev/null`,
      secrets: `kubectl get secrets -n ${ns} --no-headers 2>/dev/null`,
      statefulsets: `kubectl get sts -n ${ns} --no-headers 2>/dev/null`,
      daemonsets: `kubectl get ds -n ${ns} --no-headers 2>/dev/null`,
      nodes: `kubectl get nodes -o wide --no-headers 2>/dev/null`,
      events: `kubectl get events -n ${ns} --sort-by=.lastTimestamp --no-headers 2>/dev/null | tail -30`,
      helm: `helm list -n ${ns} --output json 2>/dev/null || echo "[]"`,
    };
    const r = await this.connection.exec(cmds[tab] || cmds.pods);
    this.data[tab] = r.stdout.trim();
    this.render();
  }

  render() {
    const content = document.getElementById('k8s-content');
    const tabs = ['pods', 'deployments', 'services', 'ingresses', 'configmaps', 'secrets', 'statefulsets', 'daemonsets', 'nodes', 'events', 'helm'];

    let html = `<div class="devops-status detected" style="margin-bottom:6px">
      <span>\u2388</span> ${this._esc(this.clusterCtx || 'cluster')}
    </div>`;

    html += `<div class="k8s-ns-bar" style="margin-bottom:6px"><select id="k8s-ns-select">`;
    this.namespaces.forEach((ns) => { html += `<option value="${ns}" ${ns === this.namespace ? 'selected' : ''}>${ns}</option>`; });
    html += '</select></div>';

    html += '<div class="docker-tabs" style="flex-wrap:wrap;gap:2px">';
    tabs.forEach((t) => {
      html += `<button class="docker-tab ${this.activeTab === t ? 'active' : ''}" data-tab="${t}" style="font-size:10px;padding:3px 8px">${t}</button>`;
    });
    html += '</div>';

    html += `<div class="devops-card-actions" style="margin:6px 0;flex-wrap:wrap">
      <button class="devops-install-btn secondary" id="k8s-apply" style="font-size:10px;padding:3px 8px">Apply YAML</button>
      <button class="devops-install-btn secondary" id="k8s-exec" style="font-size:10px;padding:3px 8px">Exec Pod</button>
      <button class="devops-install-btn secondary" id="k8s-portfwd" style="font-size:10px;padding:3px 8px">Port Forward</button>
      <button class="devops-install-btn secondary" id="k8s-scale" style="font-size:10px;padding:3px 8px">Scale</button>
      <button class="devops-install-btn secondary" id="k8s-helm-install" style="font-size:10px;padding:3px 8px">Helm Install</button>
    </div>`;

    const raw = this.data[this.activeTab] || '';
    if (this.activeTab === 'helm') {
      html += this._renderHelm(raw);
    } else {
      html += this._renderResources(raw);
    }

    content.innerHTML = html;
    this._bindEvents(content);
  }

  _renderResources(raw) {
    const lines = raw.split('\n').filter(Boolean);
    if (lines.length === 0) return '<div class="search-status">No resources found</div>';

    let html = '<div class="docker-list">';
    lines.forEach((line) => {
      const cols = line.trim().split(/\s+/);
      const name = cols[0] || '';
      const rest = cols.slice(1).join(' ');
      const isRunning = line.includes('Running') || line.includes('Active') || line.includes('Ready') || line.includes('1/1') || line.includes('2/2') || line.includes('3/3');
      const isFailed = line.includes('Error') || line.includes('CrashLoop') || line.includes('Failed') || line.includes('Evicted');
      const color = isFailed ? 'var(--accent-red)' : isRunning ? 'var(--accent-green)' : 'var(--accent-orange)';

      html += `<div class="docker-item">
        <div class="docker-item-header">
          <span class="docker-dot" style="background:${color}"></span>
          <div class="docker-item-info">
            <div class="docker-item-name">${this._esc(name)}</div>
            <div class="docker-item-detail">${this._esc(rest)}</div>
          </div>
        </div>
        <div class="docker-item-actions">
          <button class="docker-action-btn k8s-action" data-action="describe" data-name="${this._esc(name)}" title="Describe">📄</button>
          <button class="docker-action-btn k8s-action" data-action="yaml" data-name="${this._esc(name)}" title="YAML">{ }</button>
          <button class="docker-action-btn k8s-action" data-action="logs" data-name="${this._esc(name)}" title="Logs">📋</button>
          <button class="docker-action-btn danger k8s-action" data-action="delete" data-name="${this._esc(name)}" title="Delete">\u2715</button>
        </div>
      </div>`;
    });
    html += '</div>';
    return html;
  }

  _renderHelm(raw) {
    let releases = [];
    try { releases = JSON.parse(raw); } catch {}
    if (releases.length === 0) return '<div class="search-status">No Helm releases in this namespace</div>';

    let html = '<div class="docker-list">';
    releases.forEach((r) => {
      const color = r.status === 'deployed' ? 'var(--accent-green)' : r.status === 'failed' ? 'var(--accent-red)' : 'var(--accent-orange)';
      html += `<div class="docker-item">
        <div class="docker-item-header">
          <span class="docker-dot" style="background:${color}"></span>
          <div class="docker-item-info">
            <div class="docker-item-name">${this._esc(r.name)}</div>
            <div class="docker-item-detail">${this._esc(r.chart)} · rev:${r.revision} · ${r.status}</div>
          </div>
        </div>
        <div class="docker-item-actions">
          <button class="docker-action-btn k8s-action" data-action="helm-values" data-name="${this._esc(r.name)}" title="Values">📋</button>
          <button class="docker-action-btn k8s-action" data-action="helm-history" data-name="${this._esc(r.name)}" title="History">🕐</button>
          <button class="docker-action-btn k8s-action" data-action="helm-upgrade" data-name="${this._esc(r.name)}" data-chart="${this._esc(r.chart)}" title="Upgrade">\u2B06</button>
          <button class="docker-action-btn danger k8s-action" data-action="helm-uninstall" data-name="${this._esc(r.name)}" title="Uninstall">\u2715</button>
        </div>
      </div>`;
    });
    html += '</div>';
    return html;
  }

  _bindEvents(content) {
    document.getElementById('k8s-ns-select')?.addEventListener('change', (e) => {
      this.namespace = e.target.value;
      this.refresh();
    });
    content.querySelectorAll('.docker-tab').forEach((t) => {
      t.addEventListener('click', () => { this.activeTab = t.dataset.tab; this.loadTab(); });
    });
    content.querySelectorAll('.k8s-action').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this._handleAction(btn.dataset.action, btn.dataset.name, btn.dataset); });
    });
    document.getElementById('k8s-apply')?.addEventListener('click', () => this._applyYAML());
    document.getElementById('k8s-exec')?.addEventListener('click', () => this._execPod());
    document.getElementById('k8s-portfwd')?.addEventListener('click', () => this._portForward());
    document.getElementById('k8s-scale')?.addEventListener('click', () => this._scaleDeploy());
    document.getElementById('k8s-helm-install')?.addEventListener('click', () => this._helmInstall());
  }

  async _handleAction(action, name, dataset) {
    const ns = this.namespace;
    const kindMap = { pods: 'pod', deployments: 'deploy', services: 'svc', ingresses: 'ingress', configmaps: 'cm', secrets: 'secret', statefulsets: 'sts', daemonsets: 'ds', nodes: 'node', events: 'event' };
    const kind = kindMap[this.activeTab] || 'pod';

    try {
      switch (action) {
        case 'describe': {
          const r = await this.connection.exec(`kubectl describe ${kind} ${name} -n ${ns} 2>&1`);
          this._overlay(`Describe: ${name}`, r.stdout || r.stderr);
          break;
        }
        case 'yaml': {
          const r = await this.connection.exec(`kubectl get ${kind} ${name} -n ${ns} -o yaml 2>&1`);
          this._overlayEditable(`YAML: ${name}`, r.stdout || r.stderr, kind, name);
          break;
        }
        case 'logs': {
          if (['pod', 'deploy', 'sts', 'ds'].includes(kind)) {
            const r = await this.connection.exec(`kubectl logs --tail=200 ${kind}/${name} -n ${ns} --all-containers 2>&1`);
            this._overlay(`Logs: ${name}`, r.stdout || r.stderr);
          }
          break;
        }
        case 'delete': {
          if (!confirm(`Delete ${kind} "${name}" in ${ns}?`)) return;
          const r = await this.connection.exec(`kubectl delete ${kind} ${name} -n ${ns} 2>&1`);
          window.app.notify(r.code === 0 ? `Deleted ${name}` : r.stderr, r.code === 0 ? 'success' : 'error');
          this.loadTab();
          break;
        }
        case 'helm-values': {
          const r = await this.connection.exec(`helm get values ${name} -n ${ns} 2>&1`);
          this._overlay(`Values: ${name}`, r.stdout || r.stderr);
          break;
        }
        case 'helm-history': {
          const r = await this.connection.exec(`helm history ${name} -n ${ns} 2>&1`);
          this._overlay(`History: ${name}`, r.stdout || r.stderr);
          break;
        }
        case 'helm-upgrade': {
          window.app.showInputDialog('Helm Upgrade', `Chart for ${name} (e.g. bitnami/nginx)`, async (chart) => {
            if (!chart) return;
            const r = await this.connection.exec(`helm upgrade ${name} ${chart} -n ${ns} 2>&1`);
            window.app.notify(r.code === 0 ? `Upgraded ${name}` : r.stderr, r.code === 0 ? 'success' : 'error');
            this.loadTab();
          }, dataset?.chart || '');
          break;
        }
        case 'helm-uninstall': {
          if (!confirm(`Uninstall Helm release "${name}"?`)) return;
          const r = await this.connection.exec(`helm uninstall ${name} -n ${ns} 2>&1`);
          window.app.notify(r.code === 0 ? `Uninstalled ${name}` : r.stderr, r.code === 0 ? 'success' : 'error');
          this.loadTab();
          break;
        }
      }
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  async _applyYAML() {
    const overlay = document.createElement('div');
    overlay.className = 'input-overlay';
    overlay.innerHTML = `<div class="quick-open-dialog" style="width:680px">
      <div style="padding:12px;font-weight:600;color:var(--text-bright)">Apply YAML to ${this.namespace}</div>
      <textarea id="k8s-yaml-input" style="width:100%;height:300px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font-code);font-size:12px;padding:10px;resize:vertical;outline:none" placeholder="apiVersion: v1\nkind: Pod\nmetadata:\n  name: my-pod\nspec:\n  containers:\n  - name: nginx\n    image: nginx:alpine"></textarea>
      <div style="padding:8px 12px;display:flex;gap:6px">
        <button class="devops-install-btn" id="k8s-yaml-apply">kubectl apply</button>
        <button class="devops-install-btn secondary" id="k8s-yaml-dry">Dry Run</button>
        <button class="devops-install-btn secondary" id="k8s-yaml-cancel">Cancel</button>
      </div>
      <div class="devops-log" id="k8s-yaml-result"></div>
    </div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    document.getElementById('k8s-yaml-cancel')?.addEventListener('click', () => overlay.remove());
    document.getElementById('k8s-yaml-apply')?.addEventListener('click', async () => {
      const yaml = document.getElementById('k8s-yaml-input')?.value;
      if (!yaml) return;
      const r = await this.connection.exec(`echo '${yaml.replace(/'/g, "'\\''")}' | kubectl apply -n ${this.namespace} -f - 2>&1`);
      const result = document.getElementById('k8s-yaml-result');
      result.textContent = r.stdout || r.stderr;
      result.classList.add('visible');
      if (r.code === 0) { window.app.notify('Applied successfully', 'success'); this.loadTab(); }
    });
    document.getElementById('k8s-yaml-dry')?.addEventListener('click', async () => {
      const yaml = document.getElementById('k8s-yaml-input')?.value;
      if (!yaml) return;
      const r = await this.connection.exec(`echo '${yaml.replace(/'/g, "'\\''")}' | kubectl apply -n ${this.namespace} --dry-run=client -f - 2>&1`);
      const result = document.getElementById('k8s-yaml-result');
      result.textContent = r.stdout || r.stderr;
      result.classList.add('visible');
    });
  }

  async _execPod() {
    window.app.showInputDialog('Exec into Pod', 'Pod name', async (pod) => {
      if (!pod) return;
      window.app.showInputDialog('Command', 'Command to run (default: /bin/sh)', async (cmd) => {
        const command = cmd || '/bin/sh';
        const r = await this.connection.exec(`kubectl exec ${pod} -n ${this.namespace} -- ${command} -c 'echo "Connected to ${pod}" && cat /etc/os-release 2>/dev/null | head -3' 2>&1`);
        this._overlay(`Exec: ${pod}`, r.stdout || r.stderr);
      }, '/bin/sh');
    });
  }

  async _portForward() {
    window.app.showInputDialog('Port Forward', 'resource:port (e.g. svc/nginx:8080:80)', async (spec) => {
      if (!spec) return;
      const parts = spec.split(':');
      const resource = parts[0];
      const localPort = parts[1] || '8080';
      const remotePort = parts[2] || parts[1] || '80';
      const r = await this.connection.exec(`kubectl port-forward ${resource} ${localPort}:${remotePort} -n ${this.namespace} --address 0.0.0.0 &>/dev/null &
echo "Port-forwarding ${resource} ${localPort}:${remotePort} (PID: $!)"
echo "Access: http://localhost:${localPort}"`);
      window.app.notify(r.stdout.trim(), 'success');
    }, 'svc/my-service:8080:80');
  }

  async _scaleDeploy() {
    window.app.showInputDialog('Scale Deployment', 'deployment-name replicas (e.g. nginx 3)', async (input) => {
      if (!input) return;
      const [name, replicas] = input.split(/\s+/);
      if (!name || !replicas) { window.app.notify('Format: name replicas', 'error'); return; }
      const r = await this.connection.exec(`kubectl scale deploy/${name} --replicas=${replicas} -n ${this.namespace} 2>&1`);
      window.app.notify(r.code === 0 ? `Scaled ${name} to ${replicas}` : r.stderr, r.code === 0 ? 'success' : 'error');
      this.loadTab();
    });
  }

  async _helmInstall() {
    const overlay = document.createElement('div');
    overlay.className = 'input-overlay';
    overlay.innerHTML = `<div class="quick-open-dialog" style="width:520px">
      <div style="padding:12px;font-weight:600;color:var(--text-bright)">Helm Install</div>
      <div style="padding:0 12px 12px;display:flex;flex-direction:column;gap:8px">
        <input type="text" id="helm-i-name" placeholder="Release name (e.g. my-nginx)" style="padding:8px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:12px;outline:none">
        <input type="text" id="helm-i-chart" placeholder="Chart (e.g. bitnami/nginx or oci://)" style="padding:8px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:12px;outline:none">
        <input type="text" id="helm-i-version" placeholder="Version (optional)" style="padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-size:12px;outline:none">
        <textarea id="helm-i-values" placeholder="values.yaml override (optional)" style="height:100px;padding:8px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-bright);font-family:var(--font-code);font-size:11px;resize:vertical;outline:none"></textarea>
        <div style="display:flex;gap:6px">
          <button class="devops-install-btn" id="helm-i-run">Install</button>
          <button class="devops-install-btn secondary" id="helm-i-dry">Dry Run</button>
          <button class="devops-install-btn secondary" id="helm-i-cancel">Cancel</button>
        </div>
        <div class="devops-log" id="helm-i-result"></div>
      </div>
    </div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    const run = async (dryRun) => {
      const name = document.getElementById('helm-i-name')?.value.trim();
      const chart = document.getElementById('helm-i-chart')?.value.trim();
      const version = document.getElementById('helm-i-version')?.value.trim();
      const values = document.getElementById('helm-i-values')?.value.trim();
      if (!name || !chart) { window.app.notify('Name and chart required', 'error'); return; }

      let cmd = `helm install ${name} ${chart} -n ${this.namespace}`;
      if (version) cmd += ` --version ${version}`;
      if (dryRun) cmd += ' --dry-run';
      if (values) cmd = `echo '${values.replace(/'/g, "'\\''")}' | ${cmd} -f -`;
      cmd += ' 2>&1';

      const result = document.getElementById('helm-i-result');
      result.textContent = 'Running...'; result.classList.add('visible');
      const r = await this.connection.exec(cmd);
      result.textContent = r.stdout || r.stderr;
      if (r.code === 0 && !dryRun) {
        window.app.notify(`Installed ${name}`, 'success');
        this.activeTab = 'helm';
        this.loadTab();
      }
    };

    document.getElementById('helm-i-run')?.addEventListener('click', () => run(false));
    document.getElementById('helm-i-dry')?.addEventListener('click', () => run(true));
    document.getElementById('helm-i-cancel')?.addEventListener('click', () => overlay.remove());
  }

  _overlay(title, text) {
    const overlay = document.createElement('div');
    overlay.className = 'input-overlay';
    overlay.innerHTML = `<div class="quick-open-dialog" style="width:700px"><div style="padding:12px;font-weight:600;color:var(--text-bright)">${title}</div><div class="devops-log visible" style="max-height:500px;display:block">${this._esc(text)}</div></div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  _overlayEditable(title, yaml, kind, name) {
    const overlay = document.createElement('div');
    overlay.className = 'input-overlay';
    overlay.innerHTML = `<div class="quick-open-dialog" style="width:700px">
      <div style="padding:12px;display:flex;justify-content:space-between;align-items:center"><span style="font-weight:600;color:var(--text-bright)">${title}</span><button class="devops-install-btn" id="k8s-yaml-save" style="font-size:10px;padding:4px 10px">Apply Changes</button></div>
      <textarea id="k8s-yaml-edit" style="width:100%;height:400px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);font-family:var(--font-code);font-size:11px;padding:10px;outline:none;resize:vertical">${this._esc(yaml)}</textarea>
    </div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    document.getElementById('k8s-yaml-save')?.addEventListener('click', async () => {
      const edited = document.getElementById('k8s-yaml-edit')?.value;
      if (!edited) return;
      const r = await this.connection.exec(`echo '${edited.replace(/'/g, "'\\''")}' | kubectl apply -n ${this.namespace} -f - 2>&1`);
      window.app.notify(r.code === 0 ? 'Applied' : r.stderr, r.code === 0 ? 'success' : 'error');
      if (r.code === 0) { overlay.remove(); this.loadTab(); }
    });
  }

  _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  dispose() {}
}
window.K8sPanel = K8sPanel;
