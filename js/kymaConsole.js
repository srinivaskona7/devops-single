class KymaConsole {
  constructor(connection) {
    this.connection = connection;
    this.activeView = 'cluster';
    this.namespace = 'default';
    this.namespaces = [];
    this.openSections = new Set();
  }

  init() {
    document.getElementById('kyma-console-refresh')?.addEventListener('click', () => this.refresh());
  }

  async refresh() {
    const c = document.getElementById('kyma-console-content');
    if (!c) return;
    c.style.display = '';
    document.getElementById('kyma-content').style.display = 'none';
    c.innerHTML = '<div class="devops-status">Loading cluster...</div>';
    try {
      const check = await this.connection.exec('kubectl cluster-info 2>&1 | head -1');
      if (check.code !== 0) { c.innerHTML = '<div class="devops-status error">No cluster access</div>'; return; }
      const nsRaw = await this._exec('kubectl get ns --no-headers -o custom-columns=NAME:.metadata.name 2>/dev/null');
      this.namespaces = (nsRaw || '').split('\n').filter(Boolean);
      this.renderView(c);
    } catch (err) { c.innerHTML = `<div class="devops-status error">${err.message}</div>`; }
  }

  /* ── view definition ── */

  _clusterGroups() {
    return [
      { group: 'Cluster Overview', items: [
        { id: 'c-overview', title: 'Cluster Overview', load: () => this._clusterOverview() },
      ]},
      { group: 'Namespaces', items: [
        { id: 'c-namespaces', title: 'Namespaces', load: () => this._resource('namespaces', false) },
      ]},
      { group: 'Events', items: [
        { id: 'c-events', title: 'Cluster Events', load: () => this._clusterEvents() },
      ]},
      { group: 'Storage', items: [
        { id: 'c-pv', title: 'Persistent Volumes', load: () => this._resource('pv', false) },
        { id: 'c-sc', title: 'Storage Classes', load: () => this._resource('storageclasses', false) },
      ]},
      { group: 'Configuration', items: [
        { id: 'c-crb', title: 'Cluster Role Bindings', load: () => this._resource('clusterrolebindings', false) },
        { id: 'c-cr', title: 'Cluster Roles', load: () => this._resource('clusterroles', false) },
        { id: 'c-crds', title: 'Custom Resource Definitions', load: () => this._resource('customresourcedefinitions', false) },
        { id: 'c-cres', title: 'Custom Resources', load: () => this._customResources() },
        { id: 'c-ext', title: 'Extensions', load: () => this._extensions() },
        { id: 'c-mod', title: 'Modules', load: () => this._modules() },
      ]},
      { group: 'Kyma', items: [
        { id: 'c-apigw', title: 'APIGateway', load: () => this._resource('apirules.gateway.kyma-project.io', false) },
        { id: 'c-tele', title: 'Telemetry', load: () => this._resource('telemetries.telemetry.istio.io', false) },
        { id: 'c-logp', title: 'Log Pipelines', load: () => this._resource('logpipelines.telemetry.kyma-project.io', false) },
        { id: 'c-metp', title: 'Metric Pipelines', load: () => this._resource('metricpipelines.telemetry.kyma-project.io', false) },
        { id: 'c-trp', title: 'Trace Pipelines', load: () => this._resource('tracepipelines.telemetry.kyma-project.io', false) },
      ]},
    ];
  }

  _namespaceGroups() {
    return [
      { group: 'Namespace Overview', items: [
        { id: 'n-overview', title: 'Namespace Overview', load: () => this._namespaceOverview() },
      ]},
      { group: 'Events', items: [
        { id: 'n-events', title: 'Events', load: () => this._nsEvents() },
      ]},
      { group: 'Workloads', items: [
        { id: 'n-pods', title: 'Pods', load: () => this._resource('pods', true) },
        { id: 'n-deploy', title: 'Deployments', load: () => this._resource('deployments', true) },
        { id: 'n-sts', title: 'StatefulSets', load: () => this._resource('statefulsets', true) },
        { id: 'n-ds', title: 'DaemonSets', load: () => this._resource('daemonsets', true) },
        { id: 'n-rs', title: 'ReplicaSets', load: () => this._resource('replicasets', true) },
        { id: 'n-jobs', title: 'Jobs', load: () => this._resource('jobs', true) },
        { id: 'n-cj', title: 'CronJobs', load: () => this._resource('cronjobs', true) },
      ]},
      { group: 'Discovery and Network', items: [
        { id: 'n-apir', title: 'API Rules', load: () => this._resource('apirules.gateway.kyma-project.io', true) },
        { id: 'n-hpa', title: 'Horizontal Pod Autoscalers', load: () => this._resource('hpa', true) },
        { id: 'n-ing', title: 'Ingresses', load: () => this._resource('ingresses', true) },
        { id: 'n-lr', title: 'Limit Ranges', load: () => this._resource('limitranges', true) },
        { id: 'n-np', title: 'Network Policies', load: () => this._resource('networkpolicies', true) },
        { id: 'n-rq', title: 'Resource Quotas', load: () => this._resource('resourcequotas', true) },
        { id: 'n-svc', title: 'Services', load: () => this._resource('services', true) },
      ]},
      { group: 'Istio', items: [
        { id: 'n-ap', title: 'Authorization Policies', load: () => this._resource('authorizationpolicies.security.istio.io', true) },
        { id: 'n-dr', title: 'Destination Rules', load: () => this._resource('destinationrules.networking.istio.io', true) },
        { id: 'n-gw', title: 'Gateways', load: () => this._resource('gateways.networking.istio.io', true) },
        { id: 'n-ra', title: 'Request Authentications', load: () => this._resource('requestauthentications.security.istio.io', true) },
        { id: 'n-se', title: 'Service Entries', load: () => this._resource('serviceentries.networking.istio.io', true) },
        { id: 'n-sc', title: 'Sidecars', load: () => this._resource('sidecars.networking.istio.io', true) },
        { id: 'n-tel', title: 'Telemetries', load: () => this._resource('telemetries.telemetry.istio.io', true) },
        { id: 'n-vs', title: 'Virtual Services', load: () => this._resource('virtualservices.networking.istio.io', true) },
      ]},
      { group: 'Service Management', items: [
        { id: 'n-sb', title: 'Service Bindings', load: () => this._resource('servicebindings.services.cloud.sap', true) },
        { id: 'n-si', title: 'Service Instances', load: () => this._resource('serviceinstances.services.cloud.sap', true) },
      ]},
      { group: 'Storage', items: [
        { id: 'n-pvc', title: 'Persistent Volume Claims', load: () => this._resource('pvc', true) },
      ]},
      { group: 'Apps', items: [
        { id: 'n-helm', title: 'Helm Releases', load: () => this._helmReleases() },
      ]},
      { group: 'Configuration', items: [
        { id: 'n-cert', title: 'Certificates', load: () => this._resource('certificates.cert.gardener.cloud', true) },
        { id: 'n-cm', title: 'Config Maps', load: () => this._resource('configmaps', true) },
        { id: 'n-cres', title: 'Custom Resources', load: () => this._customResourcesNs() },
        { id: 'n-dns', title: 'DNS Entries', load: () => this._resource('dnsentries.dns.gardener.cloud', true) },
        { id: 'n-dnsp', title: 'DNS Providers', load: () => this._resource('dnsproviders.dns.gardener.cloud', true) },
        { id: 'n-iss', title: 'Issuers', load: () => this._resource('issuers.cert.gardener.cloud', true) },
        { id: 'n-mod', title: 'Modules', load: () => this._modules() },
        { id: 'n-rb', title: 'Role Bindings', load: () => this._resource('rolebindings', true) },
        { id: 'n-roles', title: 'Roles', load: () => this._resource('roles', true) },
        { id: 'n-sec', title: 'Secrets', load: () => this._resource('secrets', true) },
        { id: 'n-sa', title: 'Service Accounts', load: () => this._resource('serviceaccounts', true) },
      ]},
    ];
  }

  /* ── render ── */

  renderView(c) {
    let html = this._renderViewSwitcher();
    const groups = this.activeView === 'cluster' ? this._clusterGroups() : this._namespaceGroups();
    const allItems = groups.flatMap(g => g.items);

    groups.forEach(g => {
      const groupOpen = g.items.some(i => this.openSections.has(i.id));
      html += `<div class="kyma-group ${groupOpen ? 'open' : ''}">
        <div class="kyma-group-header" data-group="${g.group}">
          <span class="kyma-dropdown-chevron">\u25B6</span>
          <span class="kyma-group-title">${g.group}</span>
          <span class="kyma-group-count">${g.items.length}</span>
        </div>
        <div class="kyma-group-body">`;

      g.items.forEach(s => {
        const isOpen = this.openSections.has(s.id);
        html += `<div class="kyma-dropdown ${isOpen ? 'open' : ''}" id="kd-${s.id}">
          <div class="kyma-dropdown-header" data-id="${s.id}">
            <span class="kyma-dropdown-chevron">\u25B6</span>
            <span class="kyma-dropdown-title">${s.title}</span>
          </div>
          <div class="kyma-dropdown-body" id="kdb-${s.id}"></div>
        </div>`;
      });

      html += '</div></div>';
    });

    c.innerHTML = html;
    this._bindViewSwitcher(c);
    this._bindDropdowns(c, allItems);

    // reload open sections
    this.openSections.forEach(async id => {
      const body = document.getElementById(`kdb-${id}`);
      const s = allItems.find(x => x.id === id);
      if (s && body) { body.innerHTML = await s.load(); }
    });
  }

  _renderViewSwitcher() {
    const cActive = this.activeView === 'cluster' ? 'detected' : '';
    const nActive = this.activeView === 'namespace' ? 'detected' : '';
    let html = `<div style="display:flex;gap:4px;margin-bottom:6px;align-items:center">
      <button class="devops-status ${cActive}" data-view="cluster" style="cursor:pointer;flex:1;text-align:center;padding:4px 0;font-size:11px">Cluster</button>
      <button class="devops-status ${nActive}" data-view="namespace" style="cursor:pointer;flex:1;text-align:center;padding:4px 0;font-size:11px">Namespace</button>
    </div>`;
    if (this.activeView === 'namespace') {
      html += `<div style="margin-bottom:6px">
        <select id="kyma-ns-select" class="kyma-input" style="width:100%;font-size:11px">
          ${this.namespaces.map(ns => `<option value="${this._esc(ns)}" ${ns === this.namespace ? 'selected' : ''}>${this._esc(ns)}</option>`).join('')}
        </select>
      </div>`;
    }
    return html;
  }

  _bindViewSwitcher(c) {
    c.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view === this.activeView) return;
        this.activeView = view;
        this.openSections.clear();
        this.renderView(c);
      });
    });
    const sel = document.getElementById('kyma-ns-select');
    if (sel) {
      sel.addEventListener('change', () => {
        this.namespace = sel.value;
        this.openSections.clear();
        this.renderView(c);
      });
    }
  }

  _bindDropdowns(c, allItems) {
    c.querySelectorAll('.kyma-group-header').forEach(h => {
      h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
    });

    c.querySelectorAll('.kyma-dropdown-header').forEach(h => {
      h.addEventListener('click', async e => {
        e.stopPropagation();
        const id = h.dataset.id;
        const dd = document.getElementById(`kd-${id}`);
        const body = document.getElementById(`kdb-${id}`);
        if (dd.classList.contains('open')) {
          dd.classList.remove('open');
          this.openSections.delete(id);
          body.innerHTML = '';
        } else {
          dd.classList.add('open');
          this.openSections.add(id);
          body.innerHTML = '<div class="search-status">Loading...</div>';
          const s = allItems.find(x => x.id === id);
          if (s) body.innerHTML = await s.load();
        }
      });
    });
  }

  /* ── overview pages ── */

  async _clusterOverview() {
    const [ver, nodes, pods, cpuMem] = await Promise.all([
      this._exec('kubectl version --short 2>/dev/null | head -2 || kubectl version 2>/dev/null | head -2'),
      this._exec('kubectl get nodes --no-headers 2>/dev/null | wc -l'),
      this._exec('kubectl get pods -A --no-headers 2>/dev/null | wc -l'),
      this._exec('kubectl top nodes --no-headers 2>/dev/null | head -5 || echo "Metrics unavailable"'),
    ]);
    const vLine = (ver || '').split('\n').find(l => l.toLowerCase().includes('server')) || ver.split('\n')[0] || 'Unknown';
    return `<div class="admin-grid">
      <div class="admin-stat"><div class="admin-stat-label">K8s Version</div><div class="admin-stat-value" style="font-size:10px">${this._esc(vLine.replace(/.*:\s*/, ''))}</div></div>
      <div class="admin-stat"><div class="admin-stat-label">Nodes</div><div class="admin-stat-value">${this._esc(nodes)}</div></div>
      <div class="admin-stat"><div class="admin-stat-label">Pods</div><div class="admin-stat-value">${this._esc(pods)}</div></div>
    </div>
    <div class="git-section-title" style="margin-top:6px">CPU / Memory</div>
    <pre class="admin-pre" style="max-height:120px">${this._esc(cpuMem)}</pre>`;
  }

  async _namespaceOverview() {
    const ns = this.namespace;
    const [pods, deploys, svcs, sts, jobs] = await Promise.all([
      this._exec(`kubectl get pods -n ${ns} --no-headers 2>/dev/null | wc -l`),
      this._exec(`kubectl get deploy -n ${ns} --no-headers 2>/dev/null | wc -l`),
      this._exec(`kubectl get svc -n ${ns} --no-headers 2>/dev/null | wc -l`),
      this._exec(`kubectl get statefulsets -n ${ns} --no-headers 2>/dev/null | wc -l`),
      this._exec(`kubectl get jobs -n ${ns} --no-headers 2>/dev/null | wc -l`),
    ]);
    return `<div class="admin-grid">
      <div class="admin-stat"><div class="admin-stat-label">Pods</div><div class="admin-stat-value">${this._esc(pods)}</div></div>
      <div class="admin-stat"><div class="admin-stat-label">Deployments</div><div class="admin-stat-value">${this._esc(deploys)}</div></div>
      <div class="admin-stat"><div class="admin-stat-label">Services</div><div class="admin-stat-value">${this._esc(svcs)}</div></div>
      <div class="admin-stat"><div class="admin-stat-label">StatefulSets</div><div class="admin-stat-value">${this._esc(sts)}</div></div>
      <div class="admin-stat"><div class="admin-stat-label">Jobs</div><div class="admin-stat-value">${this._esc(jobs)}</div></div>
    </div>`;
  }

  /* ── events ── */

  async _clusterEvents() {
    const r = await this._exec('kubectl get events -A --sort-by=.lastTimestamp --no-headers 2>/dev/null | tail -25');
    return this._renderResourceList(r, 'events');
  }

  async _nsEvents() {
    const r = await this._exec(`kubectl get events -n ${this.namespace} --sort-by=.lastTimestamp --no-headers 2>/dev/null | tail -25`);
    return this._renderResourceList(r, 'events');
  }

  /* ── generic resource loader ── */

  async _resource(kind, namespaced) {
    const ns = namespaced ? `-n ${this.namespace}` : '';
    const r = await this._exec(`kubectl get ${kind} ${ns} --no-headers 2>/dev/null | head -25`);
    return this._renderResourceList(r, kind);
  }

  /* ── specialised loaders ── */

  async _modules() {
    const r = await this._exec('kubectl get kyma -A -o jsonpath=\'{.items[*].spec.modules[*].name}\' 2>/dev/null || echo ""');
    const available = ['api-gateway','istio','serverless','eventing','telemetry','nats','keda','btp-operator','application-connector'];
    let h = '';
    available.forEach(m => {
      const on = r.toLowerCase().includes(m);
      h += `<div class="docker-item">
        <span class="docker-dot" style="background:${on ? 'var(--accent-green)' : 'var(--text-muted)'}"></span>
        <div class="docker-item-info">
          <div class="docker-item-name" style="font-size:10px">${m}</div>
          <div class="docker-item-detail">${on ? 'Enabled' : 'Disabled'}</div>
        </div>
      </div>`;
    });
    return h || '<div class="search-status">No modules</div>';
  }

  async _extensions() {
    const r = await this._exec('kubectl get apiservices --no-headers 2>/dev/null | head -25');
    return this._renderResourceList(r, 'apiservices');
  }

  async _customResources() {
    const r = await this._exec('kubectl get crds --no-headers 2>/dev/null | head -25');
    return this._renderResourceList(r, 'crds');
  }

  async _customResourcesNs() {
    // list CRDs then show namespaced ones
    const r = await this._exec(`kubectl api-resources --namespaced=true --no-headers 2>/dev/null | awk '{print $1}' | head -25`);
    const lines = (r || '').split('\n').filter(Boolean);
    if (!lines.length) return '<div class="search-status">No custom resources</div>';
    let h = '';
    lines.forEach(l => {
      h += `<div class="docker-item">
        <span class="docker-dot" style="background:var(--accent-blue)"></span>
        <div class="docker-item-info">
          <div class="docker-item-name" style="font-size:10px">${this._esc(l.trim())}</div>
        </div>
      </div>`;
    });
    return h;
  }

  async _helmReleases() {
    const ns = this.activeView === 'namespace' ? `-n ${this.namespace}` : '-A';
    const r = await this._exec(`helm list ${ns} --output json 2>/dev/null || echo "[]"`);
    let releases = [];
    try { releases = JSON.parse(r); } catch { /* ignore */ }
    if (!releases.length) return '<div class="search-status">No Helm releases</div>';
    let h = '';
    releases.forEach(rl => {
      const color = rl.status === 'deployed' ? 'var(--accent-green)' : 'var(--accent-red)';
      h += `<div class="docker-item">
        <span class="docker-dot" style="background:${color}"></span>
        <div class="docker-item-info">
          <div class="docker-item-name" style="font-size:10px">${this._esc(rl.name)}</div>
          <div class="docker-item-detail">ns:${this._esc(rl.namespace)} chart:${this._esc(rl.chart)} rev:${rl.revision}</div>
        </div>
      </div>`;
    });
    return h;
  }

  /* ── rendering ── */

  _renderResourceList(raw, kind) {
    const lines = (raw || '').split('\n').filter(Boolean);
    if (!lines.length) return '<div class="search-status">No resources</div>';
    let h = '';
    lines.forEach(l => {
      const cols = l.trim().split(/\s+/);
      const name = cols[0];
      const running = l.includes('Running') || l.includes('Active') || l.includes('Ready') || l.includes('1/1') || l.includes('Bound');
      const failed = l.includes('Error') || l.includes('CrashLoop') || l.includes('Failed') || l.includes('Evicted');
      const color = failed ? 'var(--accent-red)' : running ? 'var(--accent-green)' : 'var(--accent-orange)';
      h += `<div class="docker-item">
        <span class="docker-dot" style="background:${color}"></span>
        <div class="docker-item-info">
          <div class="docker-item-name" style="font-size:10px">${this._esc(name)}</div>
          <div class="docker-item-detail">${this._esc(cols.slice(1).join(' ').substring(0, 60))}</div>
        </div>
      </div>`;
    });
    return h;
  }

  /* ── helpers ── */

  async _exec(cmd) {
    try {
      const r = await this.connection.exec(cmd);
      return r.stdout?.trim() || r.stderr?.trim() || '';
    } catch { return ''; }
  }

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  dispose() {}
}

window.KymaConsole = KymaConsole;
