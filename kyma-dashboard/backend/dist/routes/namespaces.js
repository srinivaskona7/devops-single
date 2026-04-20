import { kubectlJsonAsync, getKubectlEnv } from '../lib/kubectl.js';
export async function namespaceRoutes(app) {
    // GET /api/namespaces
    app.get('/api/namespaces', async () => {
        const r = await kubectlJsonAsync(['get', 'namespaces']);
        const result = { items: [], namespaces: [], error: null };
        if (!r.data) {
            result.error = r.error;
            return result;
        }
        const raw = r.data.items || [];
        result.namespaces = raw.map((item) => item.metadata?.name || '');
        result.items = raw.map((item) => ({
            name: item.metadata?.name || '',
            status: item.status?.phase || 'Active',
            labels: item.metadata?.labels || {},
            annotations: item.metadata?.annotations || {},
            created: item.metadata?.creationTimestamp || '',
        }));
        return result;
    });
    // GET /api/namespace-overview?namespace=<ns>
    app.get('/api/namespace-overview', async (req) => {
        const ns = req.query.namespace || 'default';
        const env = getKubectlEnv();
        const allNs = ['-all-', '--all-namespaces', '_all', ''].includes(ns);
        const nsFlag = allNs ? ['--all-namespaces'] : ['-n', ns];
        const result = {
            namespace: ns,
            pods: 0, running_pods: 0, pending_pods: 0, failed_pods: 0,
            deployments: 0, services: 0, loadbalancers: 0,
            statefulsets: 0, daemonsets: 0, replicasets: 0,
            configmaps: 0, secrets: 0, serviceaccounts: 0,
            persistentvolumes: 0, pv_capacity: '0Gi',
            jobs: 0, cronjobs: 0, networkpolicies: 0,
            limitranges: 0, resourcequotas: 0, hpa: 0, pdb: 0,
            error: null,
        };
        try {
            // Pods with phase breakdown
            const podResult = await kubectlJsonAsync(['get', 'pods', ...nsFlag]);
            if (podResult.data) {
                const items = podResult.data.items || [];
                result.pods = items.length;
                for (const p of items) {
                    const phase = (p.status?.phase || '').toLowerCase();
                    if (phase === 'running')
                        result.running_pods++;
                    else if (phase === 'pending')
                        result.pending_pods++;
                    else if (phase === 'failed' || phase === 'unknown')
                        result.failed_pods++;
                    else
                        result.running_pods++; // succeeded/other → treat as healthy
                }
            }
            // Other namespaced resources — fetch ALL in parallel
            const resources = [
                ['deployments', 'deployments'], ['services', 'svc'],
                ['statefulsets', 'statefulsets'], ['daemonsets', 'daemonsets'],
                ['replicasets', 'replicasets'], ['configmaps', 'configmaps'],
                ['secrets', 'secrets'], ['serviceaccounts', 'serviceaccounts'],
                ['jobs', 'jobs'], ['cronjobs', 'cronjobs'],
                ['networkpolicies', 'networkpolicies'],
                ['limitranges', 'limitrange'], ['resourcequotas', 'resourcequota'],
                ['hpa', 'hpa'], ['pdb', 'pdb'],
            ];
            const resourceResults = await Promise.all(resources.map(([, resource]) => kubectlJsonAsync(['get', resource, ...nsFlag], 15_000, 30_000)));
            for (let i = 0; i < resources.length; i++) {
                const [key] = resources[i];
                const r = resourceResults[i];
                if (r.data) {
                    const items = r.data.items || [];
                    result[key] = items.length;
                    if (key === 'services') {
                        result.loadbalancers = items.filter((s) => s.spec?.type === 'LoadBalancer').length;
                    }
                }
            }
            // PVs (cluster-scoped, for -all-) and PVCs (namespaced)
            if (allNs) {
                const pvResult = await kubectlJsonAsync(['get', 'pv']);
                if (pvResult.data) {
                    const pvs = pvResult.data.items || [];
                    result.persistentvolumes = pvs.length;
                    let totalGi = 0;
                    for (const pv of pvs) {
                        const cap = pv.spec?.capacity?.storage || '0';
                        if (cap.endsWith('Gi'))
                            totalGi += parseFloat(cap.slice(0, -2));
                        else if (cap.endsWith('Mi'))
                            totalGi += parseFloat(cap.slice(0, -2)) / 1024;
                        else if (cap.endsWith('Ti'))
                            totalGi += parseFloat(cap.slice(0, -2)) * 1024;
                    }
                    result.pv_capacity = totalGi > 0 ? `${totalGi.toFixed(1)}Gi` : '0Gi';
                }
            }
            else {
                // For a specific namespace, count PVCs and sum their capacity
                const pvcResult = await kubectlJsonAsync(['get', 'pvc', '-n', ns]);
                if (pvcResult.data) {
                    const pvcs = pvcResult.data.items || [];
                    result.persistentvolumes = pvcs.length;
                    let totalGi = 0;
                    for (const pvc of pvcs) {
                        const cap = pvc.spec?.resources?.requests?.storage || pvc.status?.capacity?.storage || '0';
                        if (cap.endsWith('Gi'))
                            totalGi += parseFloat(cap.slice(0, -2));
                        else if (cap.endsWith('Mi'))
                            totalGi += parseFloat(cap.slice(0, -2)) / 1024;
                        else if (cap.endsWith('Ti'))
                            totalGi += parseFloat(cap.slice(0, -2)) * 1024;
                    }
                    result.pv_capacity = totalGi > 0 ? `${totalGi.toFixed(1)}Gi` : '0Gi';
                }
            }
        }
        catch (e) {
            result.error = e.message || String(e);
        }
        return result;
    });
    // GET /api/topology?namespace=X — resource dependency graph for a namespace
    app.get('/api/topology', async (req) => {
        const ns = req.query.namespace || 'default';
        // Fetch all resources in parallel
        const [deploymentsR, podsR, servicesR, replicaSetsR] = await Promise.all([
            kubectlJsonAsync(['get', 'deployments', '-n', ns], 15_000, 10_000),
            kubectlJsonAsync(['get', 'pods', '-n', ns], 15_000, 5_000),
            kubectlJsonAsync(['get', 'services', '-n', ns], 15_000, 10_000),
            kubectlJsonAsync(['get', 'replicasets', '-n', ns], 15_000, 10_000),
        ]);
        const deployments = deploymentsR.data?.items || [];
        const pods = podsR.data?.items || [];
        const services = servicesR.data?.items || [];
        const replicaSets = replicaSetsR.data?.items || [];
        // Build nodes and edges
        const nodes = [];
        const edges = [];
        deployments.forEach((d) => {
            const name = d.metadata.name;
            nodes.push({ id: `deploy/${name}`, kind: 'Deployment', name, status: d.status?.readyReplicas === d.spec?.replicas ? 'ok' : 'warn' });
            // Find owned ReplicaSets
            replicaSets.forEach((rs) => {
                const owner = rs.metadata.ownerReferences?.find((o) => o.kind === 'Deployment' && o.name === name);
                if (owner) {
                    const rsName = rs.metadata.name;
                    nodes.push({ id: `rs/${rsName}`, kind: 'ReplicaSet', name: rsName, replicas: rs.status?.readyReplicas || 0 });
                    edges.push({ from: `deploy/${name}`, to: `rs/${rsName}` });
                    // Find owned Pods
                    pods.forEach((p) => {
                        const podOwner = p.metadata.ownerReferences?.find((o) => o.kind === 'ReplicaSet' && o.name === rsName);
                        if (podOwner) {
                            const podName = p.metadata.name;
                            const phase = p.status.phase;
                            nodes.push({ id: `pod/${podName}`, kind: 'Pod', name: podName, status: phase === 'Running' ? 'ok' : 'err', ip: p.status.podIP });
                            edges.push({ from: `rs/${rsName}`, to: `pod/${podName}` });
                        }
                    });
                }
            });
        });
        // Services → find matching pods by selector
        services.forEach((svc) => {
            const sel = svc.spec?.selector || {};
            if (Object.keys(sel).length === 0)
                return; // skip services without selector
            const svcName = svc.metadata.name;
            nodes.push({ id: `svc/${svcName}`, kind: 'Service', name: svcName, type: svc.spec.type });
            pods.forEach((p) => {
                const podLabels = p.metadata.labels || {};
                const matches = Object.entries(sel).every(([k, v]) => podLabels[k] === v);
                if (matches) {
                    edges.push({ from: `svc/${svcName}`, to: `pod/${p.metadata.name}` });
                }
            });
        });
        return { nodes: [...new Map(nodes.map(n => [n.id, n])).values()], edges, namespace: ns };
    });
}
//# sourceMappingURL=namespaces.js.map