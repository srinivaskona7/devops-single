import { execSync } from 'node:child_process';
import { getHealthData } from '../lib/tfstate.js';
import { kubectlJsonAsync, kubectlRawAsync, getKubeconfigPath, calcAge, findBtp } from '../lib/kubectl.js';
// Background BTP status poller
const _btpAuth = { authenticated: false, user: null, global_account: null, subaccount: null, last_check: 0 };
const BTP_CMD = findBtp();
function pollBtpStatus() {
    try {
        const res = execSync(`${BTP_CMD} --format json list accounts/subaccount`, {
            timeout: 15_000, stdio: ['pipe', 'pipe', 'pipe'],
        });
        _btpAuth.authenticated = true;
        _btpAuth.user = 'Active Session';
        _btpAuth.last_check = Date.now() / 1000;
    }
    catch {
        _btpAuth.authenticated = false;
        _btpAuth.last_check = Date.now() / 1000;
    }
}
// Start polling every 30s
setInterval(pollBtpStatus, 30_000);
setTimeout(pollBtpStatus, 2_000); // first check after 2s
export async function clusterRoutes(app) {
    // GET /health — cluster state from tfstate
    app.get('/health', async () => getHealthData());
    // GET /api/btp-status
    app.get('/api/btp-status', async () => ({ ..._btpAuth }));
    // GET /api/k8s-status
    app.get('/api/k8s-status', async () => {
        const kc = getKubeconfigPath();
        if (!kc)
            return { connected: false };
        const r = await kubectlRawAsync(['version', '--request-timeout=5s'], 8_000);
        return { connected: r.ok };
    });
    // GET /api/cluster-status — detailed cluster + connection info
    app.get('/api/cluster-status', async () => {
        const health = getHealthData();
        const kc = getKubeconfigPath();
        const clusterState = health.state || 'UNKNOWN';
        const clusterActive = ['OK', 'READY'].includes(clusterState) || clusterState.toUpperCase().includes('PROVISIONED');
        const result = {
            cluster_active: clusterActive,
            cluster_state: clusterState,
            cluster_name: health.name || 'N/A',
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
            connection_latency_ms: null,
            kubectl_server_version: null,
            namespaces: [],
            node_count: null,
            node_resources: [],
            avg_cpu_percent: null,
            avg_memory_percent: null,
            last_checked: new Date().toISOString().replace('+00:00', 'Z'),
        };
        if (!kc)
            return result;
        // Run all kubectl calls in PARALLEL (was sequential — 4x slower)
        const t0 = Date.now();
        const [verResult, nsResult, nodesResult, topResult] = await Promise.allSettled([
            kubectlJsonAsync(['version'], 10_000, 20_000),
            kubectlRawAsync(['get', 'namespaces', '--no-headers', '-o', 'custom-columns=NAME:.metadata.name', '--request-timeout=5s'], 10_000),
            kubectlRawAsync(['get', 'nodes', '--no-headers', '--request-timeout=5s'], 10_000),
            kubectlRawAsync(['top', 'nodes', '--no-headers', '--request-timeout=10s'], 15_000),
        ]);
        // Version / connection
        if (verResult.status === 'fulfilled' && verResult.value.data) {
            const srv = verResult.value.data.serverVersion;
            if (srv) {
                result.connection_alive = true;
                result.connection_latency_ms = Date.now() - t0;
                result.kubectl_server_version = srv.gitVersion || '';
            }
        }
        // Namespaces
        if (nsResult.status === 'fulfilled' && nsResult.value.ok) {
            result.namespaces = nsResult.value.stdout.trim().split('\n').map((l) => l.trim()).filter(Boolean);
        }
        // Node count
        if (nodesResult.status === 'fulfilled' && nodesResult.value.ok) {
            result.node_count = nodesResult.value.stdout.trim().split('\n').filter((l) => l.trim()).length;
        }
        // CPU / Memory from kubectl top nodes
        if (topResult.status === 'fulfilled' && topResult.value.ok) {
            const nodeResources = [];
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
                        totalCpu += cpuPct;
                        totalMem += memPct;
                        count++;
                    }
                    catch { }
                }
            }
            if (count > 0) {
                result.node_resources = nodeResources;
                result.avg_cpu_percent = Math.round(totalCpu / count);
                result.avg_memory_percent = Math.round(totalMem / count);
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
        const result = { nodes: [], error: null };
        if (r.status === 'rejected' || !r.value.data) {
            result.error = r.status === 'fulfilled' ? r.value.error : String(r.reason);
            return result;
        }
        const items = r.value.data.items || [];
        for (const item of items) {
            const meta = item.metadata || {};
            const status = item.status || {};
            const nodeInfo = status.nodeInfo || {};
            const allocatable = status.allocatable || {};
            const labels = meta.labels || {};
            let nodeStatus = 'Unknown';
            for (const cond of status.conditions || []) {
                if (cond.type === 'Ready') {
                    nodeStatus = cond.status === 'True' ? 'Ready' : 'NotReady';
                    break;
                }
            }
            const roles = [];
            for (const lk of Object.keys(labels)) {
                if (lk.startsWith('node-role.kubernetes.io/'))
                    roles.push(lk.split('/')[1]);
            }
            const conditions = (status.conditions || []).map((c) => ({
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
            const usageMap = {};
            for (const line of topResult.value.stdout.trim().split('\n')) {
                const parts = line.split(/\s+/);
                if (parts.length >= 5) {
                    try {
                        usageMap[parts[0]] = {
                            cpu_percent: parseInt(parts[2].replace('%', ''), 10),
                            memory_percent: parseInt(parts[4].replace('%', ''), 10),
                        };
                    }
                    catch { }
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
    app.get('/api/node-detail', async (req) => {
        const name = req.query.name || '';
        if (!name)
            return { data: null, error: 'Missing name' };
        const r = await kubectlJsonAsync(['get', 'node', name]);
        if (!r.data)
            return { data: null, error: r.error };
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
                conditions: (status.conditions || []).map((c) => ({
                    type: c.type, status: c.status, reason: c.reason, message: c.message,
                })),
                capacity: status.capacity || {},
                allocatable: status.allocatable || {},
                nodeInfo: status.nodeInfo || {},
                addresses: (status.addresses || []).map((a) => ({ type: a.type, address: a.address })),
            }, error: null,
        };
    });
    // GET /api/events?namespace=<ns>
    app.get('/api/events', async (req) => {
        const ns = req.query.namespace || 'default';
        const allNs = ['-all-', '--all-namespaces', '_all', ''].includes(ns);
        const nsArgs = allNs
            ? ['get', 'events', '--all-namespaces', '--sort-by=.lastTimestamp']
            : ['get', 'events', '-n', ns, '--sort-by=.lastTimestamp'];
        const r = await kubectlJsonAsync(nsArgs, 15_000, 10_000);
        const result = { items: [], events: [], error: null };
        if (!r.data) {
            result.error = r.error;
            return result;
        }
        const rawItems = (r.data.items || []).slice(-50).reverse();
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
//# sourceMappingURL=cluster.js.map