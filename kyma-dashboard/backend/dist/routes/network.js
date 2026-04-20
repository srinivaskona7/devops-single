import { kubectlJsonAsync, calcAge } from '../lib/kubectl.js';
export async function networkRoutes(app) {
    // GET /api/services?namespace=<ns>
    app.get('/api/services', async (req) => {
        const ns = req.query.namespace || 'default';
        const r = await kubectlJsonAsync(['get', 'svc', '-n', ns]);
        const result = { namespace: ns, items: [], error: null };
        if (!r.data) {
            result.error = r.error;
            return result;
        }
        for (const item of r.data.items || []) {
            const meta = item.metadata || {};
            const spec = item.spec || {};
            result.items.push({
                name: meta.name || '', namespace: meta.namespace || ns,
                type: spec.type || '', clusterIP: spec.clusterIP || '',
                ports: (spec.ports || []).map((p) => ({
                    port: p.port, targetPort: p.targetPort, protocol: p.protocol || 'TCP',
                })),
                selector: spec.selector || {},
            });
        }
        return result;
    });
    // GET /api/service-detail?namespace=<ns>&name=<name>
    app.get('/api/service-detail', async (req) => {
        const ns = req.query.namespace || 'default';
        const name = req.query.name || '';
        if (!name)
            return { data: null, error: 'Missing name' };
        const r = await kubectlJsonAsync(['get', 'service', name, '-n', ns]);
        if (!r.data)
            return { data: null, error: r.error };
        const item = r.data;
        const meta = item.metadata || {};
        const spec = item.spec || {};
        // Also get endpoints
        const epR = await kubectlJsonAsync(['get', 'endpoints', name, '-n', ns]);
        const endpoints = epR.data ? epR.data.subsets || [] : [];
        return {
            data: {
                name: meta.name,
                namespace: meta.namespace,
                creationTimestamp: meta.creationTimestamp,
                labels: meta.labels || {},
                annotations: meta.annotations || {},
                type: spec.type || 'ClusterIP',
                clusterIP: spec.clusterIP || '',
                externalIPs: spec.externalIPs || [],
                loadBalancerIP: spec.loadBalancerIP || '',
                selector: spec.selector || {},
                ports: (spec.ports || []).map((p) => ({
                    name: p.name || '',
                    port: p.port,
                    targetPort: p.targetPort,
                    protocol: p.protocol || 'TCP',
                    nodePort: p.nodePort,
                })),
                endpoints: endpoints.map((s) => ({
                    addresses: (s.addresses || []).map((a) => a.ip),
                    ports: (s.ports || []).map((p) => `${p.port}/${p.protocol || 'TCP'}`),
                })),
            },
            error: null,
        };
    });
    // GET /api/ingresses?namespace=<ns>
    app.get('/api/ingresses', async (req) => {
        const ns = req.query.namespace || 'default';
        const r = await kubectlJsonAsync(['get', 'ingress', '-n', ns]);
        const result = { items: [], error: null };
        if (!r.data) {
            result.error = r.error;
            return result;
        }
        for (const item of r.data.items || []) {
            const m = item.metadata || {};
            const spec = item.spec || {};
            const hosts = (spec.rules || []).map((rule) => rule.host || '*');
            result.items.push({
                name: m.name || '', namespace: m.namespace || '',
                class: (m.annotations || {})['kubernetes.io/ingress.class'] || spec.ingressClassName || '\u2014',
                hosts, age: calcAge(m.creationTimestamp),
            });
        }
        return result;
    });
    // GET /api/networkpolicies?namespace=<ns>
    app.get('/api/networkpolicies', async (req) => {
        const ns = req.query.namespace || 'default';
        const r = await kubectlJsonAsync(['get', 'networkpolicies', '-n', ns]);
        const result = { items: [], error: null };
        if (!r.data) {
            result.error = r.error;
            return result;
        }
        for (const item of r.data.items || []) {
            const m = item.metadata || {};
            const spec = item.spec || {};
            result.items.push({
                name: m.name || '', namespace: m.namespace || '', created: m.creationTimestamp,
                podSelector: JSON.stringify(spec.podSelector || {}),
                age: calcAge(m.creationTimestamp),
            });
        }
        return result;
    });
}
//# sourceMappingURL=network.js.map