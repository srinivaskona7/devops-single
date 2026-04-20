import { FastifyInstance } from 'fastify';
import { execSync } from 'node:child_process';
import { getHealthData } from '../lib/tfstate.js';
import { kubectlJson, kubectlRaw, kubectlJsonAsync, kubectlRawAsync, getKubectlEnv, getKubeconfigPath, calcAge, findBtp } from '../lib/kubectl.js';

// Background BTP status poller
const _btpAuth: Record<string, any> = { authenticated: false, user: null, global_account: null, subaccount: null, last_check: 0 };
const BTP_CMD = findBtp();

function pollBtpStatus() {
  try {
    const res = execSync(`${BTP_CMD} --format json list accounts/subaccount`, {
      timeout: 15_000, stdio: ['pipe', 'pipe', 'pipe'],
    });
    _btpAuth.authenticated = true;
    _btpAuth.user = 'Active Session';
    _btpAuth.last_check = Date.now() / 1000;
  } catch {
    _btpAuth.authenticated = false;
    _btpAuth.last_check = Date.now() / 1000;
  }
}
// Start polling every 30s
setInterval(pollBtpStatus, 30_000);
setTimeout(pollBtpStatus, 2_000); // first check after 2s

export async function clusterRoutes(app: FastifyInstance): Promise<void> {

  // GET /health — cluster state from tfstate
  app.get('/health', async () => getHealthData());

  // GET /api/btp-status
  app.get('/api/btp-status', async () => ({ ..._btpAuth }));

  // GET /api/k8s-status
  app.get('/api/k8s-status', async () => {
    const kc = getKubeconfigPath();
    if (!kc) return { connected: false };
    const r = await kubectlRawAsync(['version', '--request-timeout=5s'], 8_000);
    return { connected: r.ok };
  });

  // GET /api/cluster-status — detailed cluster + connection info
  app.get('/api/cluster-status', async () => {
    const health = getHealthData();
    const kc = getKubeconfigPath();
    const clusterState = health.state || 'UNKNOWN';
    const clusterActive = ['OK', 'READY'].includes(clusterState) || clusterState.toUpperCase().includes('PROVISIONED');

    // Derive cluster name: prefer tfstate, then fall back to kubeconfig context/cluster name
    let clusterName = (health.name && health.name !== 'N/A') ? health.name : null;
    if (!clusterName && kc) {
      try {
        const { readFileSync } = await import('node:fs');
        const raw = readFileSync(kc, 'utf8');
        // Try current-context first, then first cluster name
        const ctxMatch  = raw.match(/^current-context:\s*(\S+)/m);
        const clsMatch  = raw.match(/^\s+name:\s*(\S+)/m);
        clusterName = ctxMatch?.[1] || clsMatch?.[1] || null;
      } catch {}
    }

    const result: Record<string, any> = {
      cluster_active: clusterActive,
      cluster_state: clusterState,
      cluster_name: clusterName || 'N/A',
      api_server: health.api_server,
      dashboard_url: health.dashboard !== 'N/A' ? health.dashboard : null,
      plan: health.plan || 'N/A',
      region: health.region || 'N/A',
      created_date: health.created_date,
      age_days: health.age_days,
      expiry_msg: health.expiry_msg,
      days_left: health.days_left,
      expiry_date: health.expiry_date,
      expiry_datetime: health.expiry_datetime,
      expiry_iso: health.expiry_iso,
      kubeconfig_available: !!kc,
      kubeconfig_type: health.kubeconfig_type,
      connection_alive: false,
      connection_latency_ms: null as number | null,
      kubectl_server_version: null as string | null,
      namespaces: [] as string[],
      node_count: null as number | null,
      node_resources: [] as any[],
      avg_cpu_percent: null as number | null,
      avg_memory_percent: null as number | null,
      nat_gateway_ips: [] as string[],
      ingress_hostname: null as string | null,
      last_checked: new Date().toISOString().replace('+00:00', 'Z'),
    };

    if (!kc) return result;

    // Run all kubectl calls in PARALLEL (was sequential — 4x slower)
    const t0 = Date.now();
    const [verResult, nsResult, nodesResult, topResult, ingressResult] = await Promise.allSettled([
      kubectlJsonAsync(['version'], 10_000, 20_000),
      kubectlRawAsync(['get', 'namespaces', '--no-headers', '-o', 'custom-columns=NAME:.metadata.name', '--request-timeout=5s'], 10_000),
      kubectlRawAsync(['get', 'nodes', '--no-headers', '--request-timeout=5s'], 10_000),
      kubectlRawAsync(['top', 'nodes', '--no-headers', '--request-timeout=10s'], 15_000),
      kubectlJsonAsync(['get', 'svc', 'istio-ingressgateway', '-n', 'istio-system'], 10_000, 10_000),
    ]);

    // Version / connection
    if (verResult.status === 'fulfilled' && verResult.value.data) {
      const srv = (verResult.value.data as any).serverVersion;
      if (srv) {
        result.connection_alive = true;
        result.connection_latency_ms = Date.now() - t0;
        result.kubectl_server_version = srv.gitVersion || '';
      }
    }

    // Namespaces
    if (nsResult.status === 'fulfilled' && nsResult.value.ok) {
      result.namespaces = nsResult.value.stdout.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
    }

    // Node count
    if (nodesResult.status === 'fulfilled' && nodesResult.value.ok) {
      result.node_count = nodesResult.value.stdout.trim().split('\n').filter((l: string) => l.trim()).length;
    }

    // CPU / Memory from kubectl top nodes
    if (topResult.status === 'fulfilled' && topResult.value.ok) {
      const nodeResources: any[] = [];
      let totalCpu = 0, totalMem = 0, count = 0;
      for (const line of topResult.value.stdout.trim().split('\n')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 5) {
          try {
            const cpuPct = parseInt(parts[2].replace('%', ''), 10);
            const memPct = parseInt(parts[4].replace('%', ''), 10);
            nodeResources.push({
              name: parts[0], cpu_cores: parts[1], cpu_percent: cpuPct,
              memory_bytes: parts[3], memory_percent: memPct,
            });
            totalCpu += cpuPct; totalMem += memPct; count++;
          } catch {}
        }
      }
      if (count > 0) {
        result.node_resources = nodeResources;
        result.avg_cpu_percent = Math.round(totalCpu / count);
        result.avg_memory_percent = Math.round(totalMem / count);
      }
    }

    // Istio ingress gateway — get external IPs / hostname (these are the cluster's external egress IPs)
    if (ingressResult.status === 'fulfilled' && ingressResult.value.data) {
      const svc = ingressResult.value.data as any;
      const ingresses: any[] = svc.status?.loadBalancer?.ingress || [];
      const ips: string[]      = ingresses.map((i: any) => i.ip).filter(Boolean);
      const hostnames: string[] = ingresses.map((i: any) => i.hostname).filter(Boolean);
      result.ingress_hostname = hostnames[0] || ips[0] || null;

      // Resolve hostname → IPs via DNS
      if (ips.length > 0) {
        result.nat_gateway_ips = ips;
      } else if (hostnames.length > 0) {
        try {
          const dns = await import('node:dns/promises');
          const resolved = await Promise.race([
            dns.resolve4(hostnames[0]),
            new Promise<string[]>((_, rej) => setTimeout(() => rej(new Error('DNS timeout')), 5_000)),
          ]) as string[];
          result.nat_gateway_ips = resolved.slice(0, 4); // max 4 IPs shown
        } catch {
          // Hostname is fine even if DNS resolution fails
          result.nat_gateway_ips = [];
        }
      }
    }

    return result;
  });

  // GET /api/nodes
  app.get('/api/nodes', async () => {
    // Fetch nodes + top nodes in parallel, nodes cached 15s
    const [r, topResult] = await Promise.allSettled([
      kubectlJsonAsync(['get', 'nodes'], 15_000, 15_000),
      kubectlRawAsync(['top', 'nodes', '--no-headers', '--request-timeout=10s'], 15_000),
    ]);
    const result: Record<string, any> = { nodes: [], error: null };
    if (r.status === 'rejected' || !r.value.data) {
      result.error = r.status === 'fulfilled' ? r.value.error : String(r.reason);
      return result;
    }

    const items = (r.value.data as any).items || [];
    for (const item of items) {
      const meta = item.metadata || {};
      const status = item.status || {};
      const nodeInfo = status.nodeInfo || {};
      const allocatable = status.allocatable || {};
      const labels = meta.labels || {};

      let nodeStatus = 'Unknown';
      for (const cond of status.conditions || []) {
        if (cond.type === 'Ready') { nodeStatus = cond.status === 'True' ? 'Ready' : 'NotReady'; break; }
      }

      const roles: string[] = [];
      for (const lk of Object.keys(labels)) {
        if (lk.startsWith('node-role.kubernetes.io/')) roles.push(lk.split('/')[1]);
      }

      const conditions = (status.conditions || []).map((c: any) => ({
        type: c.type || '', status: c.status || '', reason: c.reason || '', message: c.message || '',
      }));

      const pool = labels['nodepool'] || labels['cloud.google.com/gke-nodepool'] || labels['eks.amazonaws.com/nodegroup'] || labels['agentpool'] || '';
      const machine_type = labels['beta.kubernetes.io/instance-type'] || labels['node.kubernetes.io/instance-type'] || labels['cloud.google.com/machine-family'] || '';
      const zone = labels['failure-domain.beta.kubernetes.io/zone'] || labels['topology.kubernetes.io/zone'] || '';

      result.nodes.push({
        name: meta.name || '', status: nodeStatus, roles: roles.join(',') || '<none>',
        age: calcAge(meta.creationTimestamp), version: nodeInfo.kubeletVersion || '',
        os: nodeInfo.osImage || '', arch: nodeInfo.architecture || '',
        cpu: allocatable.cpu || '', memory: allocatable.memory || '',
        kernel_version: nodeInfo.kernelVersion || '', container_runtime: nodeInfo.containerRuntimeVersion || '',
        pool, machine_type, zone,
        conditions,
      });
    }

    // Add cpu/mem usage from kubectl top nodes (already fetched in parallel)
    if (topResult.status === 'fulfilled' && topResult.value.ok) {
      const usageMap: Record<string, { cpu_percent: number; memory_percent: number }> = {};
      for (const line of topResult.value.stdout.trim().split('\n')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 5) {
          try {
            usageMap[parts[0]] = {
              cpu_percent: parseInt(parts[2].replace('%', ''), 10),
              memory_percent: parseInt(parts[4].replace('%', ''), 10),
            };
          } catch {}
        }
      }
      for (const node of result.nodes) {
        if (usageMap[node.name]) {
          node.cpu_percent = usageMap[node.name].cpu_percent;
          node.memory_percent = usageMap[node.name].memory_percent;
        }
      }
    }

    return result;
  });

  // GET /api/node-detail?name=<node>
  app.get<{ Querystring: { name?: string } }>('/api/node-detail', async (req) => {
    const name = req.query.name || '';
    if (!name) return { data: null, error: 'Missing name' };
    const r = await kubectlJsonAsync(['get', 'node', name]);
    if (!r.data) return { data: null, error: r.error };
    const meta = r.data.metadata || {};
    const status = r.data.status || {};
    const spec = r.data.spec || {};
    return {
      data: {
        name: meta.name,
        creationTimestamp: meta.creationTimestamp,
        labels: meta.labels || {},
        annotations: meta.annotations || {},
        taints: spec.taints || [],
        conditions: (status.conditions || []).map((c: any) => ({
          type: c.type, status: c.status, reason: c.reason, message: c.message,
        })),
        capacity: status.capacity || {},
        allocatable: status.allocatable || {},
        nodeInfo: status.nodeInfo || {},
        addresses: (status.addresses || []).map((a: any) => ({ type: a.type, address: a.address })),
      }, error: null,
    };
  });

    // GET /api/events?namespace=<ns>
  app.get<{ Querystring: { namespace?: string } }>('/api/events', async (req) => {
    const ns = req.query.namespace || 'default';
    const allNs = ['-all-', '--all-namespaces', '_all', ''].includes(ns);
    const nsArgs = allNs
      ? ['get', 'events', '--all-namespaces', '--sort-by=.lastTimestamp']
      : ['get', 'events', '-n', ns, '--sort-by=.lastTimestamp'];
    const r = await kubectlJsonAsync(nsArgs, 15_000, 10_000);
    const result: Record<string, any> = { items: [], events: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    const rawItems = ((r.data as any).items || []).slice(-50).reverse();
    for (const item of rawItems) {
      const meta = item.metadata || {};
      const involved = item.involvedObject || {};
      const ev = {
        // Frontend KEvent interface fields
        type: item.type || '',
        reason: item.reason || '',
        message: item.message || '',
        involvedObject: `${involved.kind || ''}/${involved.name || ''}`,
        involvedObjectKind: involved.kind || '',
        involvedObjectName: involved.name || '',
        source: item.source?.component || '',
        count: item.count || 0,
        firstTimestamp: item.firstTimestamp || '',
        lastTimestamp: item.lastTimestamp || '',
        // Extra fields
        namespace: meta.namespace || ns,
        name: meta.name || '',
        last_seen: item.lastTimestamp || '',
        object: `${involved.kind || ''}/${involved.name || ''}`,
      };
      result.items.push(ev);
      result.events.push(ev);
    }
    return result;
  });
}
