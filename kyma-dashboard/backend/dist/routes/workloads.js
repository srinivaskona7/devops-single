import { spawn } from 'node:child_process';
import { kubectlJsonAsync, kubectlRawAsync, calcAge, getKubectlEnv } from '../lib/kubectl.js';
export async function workloadRoutes(app) {
    // GET /api/pods?namespace=<ns>
    app.get('/api/pods', async (req) => {
        const ns = req.query.namespace || 'default';
        const allNs = ['-all-', '--all-namespaces', '_all', ''].includes(ns);
        const nsFlag = allNs ? ['--all-namespaces'] : ['-n', ns];
        const r = await kubectlJsonAsync(['get', 'pods', ...nsFlag], 15_000, 5_000);
        const result = { namespace: ns, items: [], error: null };
        if (!r.data) {
            result.error = r.error;
            return result;
        }
        for (const item of r.data.items || []) {
            const meta = item.metadata || {};
            const spec = item.spec || {};
            const status = item.status || {};
            const containers = (spec.containers || []).map((c) => ({ name: c.name || '', image: c.image || '' }));
            const csList = status.containerStatuses || [];
            const readyCount = csList.filter((c) => c.ready).length;
            const totalCount = (spec.containers || []).length;
            const restarts = csList.reduce((s, c) => s + (c.restartCount || 0), 0);
            let phase = status.phase || 'Unknown';
            for (const cs of csList) {
                const waiting = cs.state?.waiting;
                if (waiting?.reason) {
                    phase = waiting.reason;
                    break;
                }
            }
            result.items.push({
                name: meta.name || '', namespace: meta.namespace || ns,
                phase, ready: `${readyCount}/${totalCount}`, restarts,
                created: meta.creationTimestamp || '', nodeName: spec.nodeName || '',
                podIP: status.podIP || '', containers,
                ownerKind: (meta.ownerReferences || [])[0]?.kind || '',
                ownerName: (meta.ownerReferences || [])[0]?.name || '',
            });
        }
        return result;
    });
    // GET /api/deployments?namespace=<ns>
    app.get('/api/deployments', async (req) => {
        const ns = req.query.namespace || 'default';
        const r = await kubectlJsonAsync(['get', 'deployments', '-n', ns], 15_000, 5_000);
        const result = { namespace: ns, items: [], error: null };
        if (!r.data) {
            result.error = r.error;
            return result;
        }
        for (const item of r.data.items || []) {
            const meta = item.metadata || {};
            const spec = item.spec || {};
            const status = item.status || {};
            result.items.push({
                name: meta.name || '', namespace: meta.namespace || ns,
                replicas: spec.replicas || 0, readyReplicas: status.readyReplicas || 0,
                availableReplicas: status.availableReplicas || 0, updatedReplicas: status.updatedReplicas || 0,
                creationTimestamp: meta.creationTimestamp || '',
            });
        }
        return result;
    });
    // GET /api/statefulsets?namespace=<ns>
    app.get('/api/statefulsets', async (req) => {
        const ns = req.query.namespace || 'default';
        const r = await kubectlJsonAsync(['get', 'statefulsets', '-n', ns], 15_000, 5_000);
        const result = { namespace: ns, items: [], error: null };
        if (!r.data) {
            result.error = r.error;
            return result;
        }
        for (const item of r.data.items || []) {
            const meta = item.metadata || {};
            result.items.push({
                name: meta.name || '', namespace: meta.namespace || ns,
                replicas: item.spec?.replicas || 0, readyReplicas: item.status?.readyReplicas || 0,
                currentReplicas: item.status?.currentReplicas || 0, creationTimestamp: meta.creationTimestamp || '',
            });
        }
        return result;
    });
    // GET /api/daemonsets?namespace=<ns>
    app.get('/api/daemonsets', async (req) => {
        const ns = req.query.namespace || 'default';
        const r = await kubectlJsonAsync(['get', 'daemonsets', '-n', ns], 15_000, 5_000);
        const result = { namespace: ns, items: [], error: null };
        if (!r.data) {
            result.error = r.error;
            return result;
        }
        for (const item of r.data.items || []) {
            const meta = item.metadata || {};
            const st = item.status || {};
            result.items.push({
                name: meta.name || '', namespace: meta.namespace || ns,
                desiredNumberScheduled: st.desiredNumberScheduled || 0, currentNumberScheduled: st.currentNumberScheduled || 0,
                numberReady: st.numberReady || 0, numberAvailable: st.numberAvailable || 0,
                creationTimestamp: meta.creationTimestamp || '',
            });
        }
        return result;
    });
    // GET /api/replicasets?namespace=<ns>
    app.get('/api/replicasets', async (req) => {
        const ns = req.query.namespace || 'default';
        const r = await kubectlJsonAsync(['get', 'replicasets', '-n', ns], 15_000, 5_000);
        const result = { namespace: ns, items: [], error: null };
        if (!r.data) {
            result.error = r.error;
            return result;
        }
        for (const item of r.data.items || []) {
            const meta = item.metadata || {};
            const ownerRefs = meta.ownerReferences || [];
            result.items.push({
                name: meta.name || '', namespace: meta.namespace || ns,
                replicas: item.spec?.replicas || 0, readyReplicas: item.status?.readyReplicas || 0,
                availableReplicas: item.status?.availableReplicas || 0,
                ownerName: ownerRefs[0]?.name || '', ownerKind: ownerRefs[0]?.kind || '',
                creationTimestamp: meta.creationTimestamp || '',
            });
        }
        return result;
    });
    // GET /api/jobs?namespace=<ns>
    app.get('/api/jobs', async (req) => {
        const ns = req.query.namespace || 'default';
        const r = await kubectlJsonAsync(['get', 'jobs', '-n', ns], 15_000, 10_000);
        const result = { items: [], error: null };
        if (!r.data) {
            result.error = r.error;
            return result;
        }
        for (const item of r.data.items || []) {
            const meta = item.metadata || {};
            const st = item.status || {};
            const sp = item.spec || {};
            result.items.push({
                name: meta.name || '', namespace: meta.namespace || '',
                completions: `${st.succeeded || 0}/${sp.completions || 1}`, duration: '\u2014',
                status: st.completionTime ? 'Complete' : (st.active || 0) > 0 ? 'Running' : 'Failed',
                age: calcAge(meta.creationTimestamp),
            });
        }
        return result;
    });
    // GET /api/cronjobs?namespace=<ns>
    app.get('/api/cronjobs', async (req) => {
        const ns = req.query.namespace || 'default';
        const allNs = ['-all-', '--all-namespaces', '_all', ''].includes(ns);
        const nsFlag = allNs ? ['--all-namespaces'] : ['-n', ns];
        const r = await kubectlJsonAsync(['get', 'cronjobs', ...nsFlag], 15_000, 30_000);
        const result = { items: [], error: null };
        if (!r.data) {
            result.error = r.error;
            return result;
        }
        for (const item of r.data.items || []) {
            const meta = item.metadata || {};
            const spec = item.spec || {};
            const st = item.status || {};
            result.items.push({
                name: meta.name || '', namespace: meta.namespace || '', created: meta.creationTimestamp,
                schedule: spec.schedule || '\u2014', lastSchedule: st.lastScheduleTime || '\u2014',
                active: (st.active || []).length, suspended: spec.suspend || false,
                age: calcAge(meta.creationTimestamp),
            });
        }
        return result;
    });
    // GET /api/deployment-detail?namespace=<ns>&name=<name>
    app.get('/api/deployment-detail', async (req) => {
        const ns = req.query.namespace || 'default';
        const name = req.query.name || '';
        if (!name)
            return { data: null, error: 'Missing name' };
        const r = await kubectlJsonAsync(['get', 'deployment', name, '-n', ns]);
        if (!r.data)
            return { data: null, error: r.error };
        const item = r.data;
        const meta = item.metadata || {};
        const spec = item.spec || {};
        const status = item.status || {};
        return {
            data: {
                name: meta.name,
                namespace: meta.namespace,
                creationTimestamp: meta.creationTimestamp,
                labels: meta.labels || {},
                annotations: meta.annotations || {},
                replicas: spec.replicas || 0,
                readyReplicas: status.readyReplicas || 0,
                availableReplicas: status.availableReplicas || 0,
                updatedReplicas: status.updatedReplicas || 0,
                strategy: spec.strategy?.type || 'RollingUpdate',
                selector: spec.selector?.matchLabels || {},
                containers: (spec.template?.spec?.containers || []).map((c) => ({
                    name: c.name,
                    image: c.image,
                    imagePullPolicy: c.imagePullPolicy,
                    requests: c.resources?.requests || {},
                    limits: c.resources?.limits || {},
                    ports: (c.ports || []).map((p) => `${p.containerPort}/${p.protocol || 'TCP'}`),
                })),
                conditions: (status.conditions || []).map((c) => ({
                    type: c.type,
                    status: c.status,
                    reason: c.reason,
                    message: c.message,
                    lastUpdateTime: c.lastUpdateTime,
                })),
            },
            error: null,
        };
    });
    // GET /api/pod-detail?namespace=<ns>&pod=<name>
    app.get('/api/pod-detail', async (req) => {
        const ns = req.query.namespace || 'default';
        const podName = req.query.pod || '';
        if (!podName)
            return { data: null, error: 'Missing pod name' };
        const r = await kubectlJsonAsync(['get', 'pod', podName, '-n', ns]);
        if (!r.data)
            return { data: null, error: r.error };
        const item = r.data;
        const meta = item.metadata || {};
        const spec = item.spec || {};
        const status = item.status || {};
        return {
            data: {
                name: meta.name,
                namespace: meta.namespace,
                creationTimestamp: meta.creationTimestamp,
                labels: meta.labels || {},
                annotations: meta.annotations || {},
                ownerReferences: meta.ownerReferences || [],
                phase: status.phase,
                hostIP: status.hostIP,
                podIP: status.podIP,
                podIPs: (status.podIPs || []).map((p) => p.ip),
                qosClass: status.qosClass,
                conditions: (status.conditions || []).map((c) => ({
                    type: c.type,
                    status: c.status,
                    lastTransitionTime: c.lastTransitionTime,
                })),
                volumes: (spec.volumes || []).map((v) => ({
                    name: v.name,
                    type: Object.keys(v).find((k) => k !== 'name') || 'unknown',
                })),
                containers: (spec.containers || []).map((c) => {
                    const cs = (status.containerStatuses || []).find((s) => s.name === c.name) || {};
                    return {
                        name: c.name,
                        image: c.image,
                        imagePullPolicy: c.imagePullPolicy,
                        status: cs.state?.running ? 'Running' : cs.state?.terminated?.reason || 'Waiting',
                        startedAt: cs.state?.running?.startedAt || cs.state?.terminated?.finishedAt,
                        ready: cs.ready || false,
                        restartCount: cs.restartCount || 0,
                    };
                }),
                initContainers: (spec.initContainers || []).map((c) => {
                    const cs = (status.initContainerStatuses || []).find((s) => s.name === c.name) || {};
                    return {
                        name: c.name,
                        image: c.image,
                        imagePullPolicy: c.imagePullPolicy,
                        status: cs.state?.terminated?.reason === 'Completed' ? 'Completed' : cs.state?.running ? 'Running' : 'Waiting',
                        startedAt: cs.state?.running?.startedAt || cs.state?.terminated?.finishedAt,
                        ready: cs.ready || false,
                    };
                }),
            },
            error: null,
        };
    });
    // GET /api/manifest?kind=pod|deployment&namespace=X&name=X
    app.get('/api/manifest', async (req) => {
        const kind = req.query.kind || 'pod';
        const ns = req.query.namespace || 'default';
        const name = req.query.name || '';
        if (!name)
            return { yaml: '', error: 'Missing name' };
        const r = await kubectlJsonAsync([`get`, kind, name, '-n', ns]);
        if (!r.data)
            return { yaml: '', error: r.error };
        const obj = r.data;
        const meta = obj.metadata || {};
        delete meta.resourceVersion;
        delete meta.uid;
        delete meta.generation;
        delete meta.creationTimestamp;
        delete meta.managedFields;
        const annotations = meta.annotations || {};
        const systemAnnotationPrefixes = [
            'kubectl.kubernetes.io', 'deployment.kubernetes.io', 'meta.helm.sh', 'helm.sh', 'checksum/',
        ];
        for (const key of Object.keys(annotations)) {
            if (systemAnnotationPrefixes.some(p => key.startsWith(p)))
                delete annotations[key];
        }
        if (Object.keys(annotations).length === 0)
            delete meta.annotations;
        const labels = meta.labels || {};
        for (const key of ['pod-template-hash', 'controller-revision-hash', 'statefulset.kubernetes.io/pod-name'])
            delete labels[key];
        delete obj.status;
        obj.apiVersion = obj.apiVersion || 'v1';
        return { yaml: JSON.stringify(obj, null, 2), name, kind, namespace: ns, error: null };
    });
    // Lines to suppress from kubectl stderr — non-fatal informational warnings
    const KUBECTL_NOISE = [
        /^Warning: Use tokens from the TokenRequest API/,
        /^Warning: resource .* is deprecated/,
        /^Warning: extensions\/v1beta1 .* is deprecated/,
    ];
    function isKubectlNoise(line) {
        return KUBECTL_NOISE.some(r => r.test(line.trim()));
    }
    app.get('/api/pod-logs', async (req) => {
        const ns = req.query.namespace || 'default';
        const pod = req.query.pod || '';
        const container = req.query.container || '';
        const lines = Math.min(parseInt(req.query.lines || '100', 10) || 100, 10000).toString();
        if (!pod)
            return { logs: '', error: 'Missing required parameter: pod' };
        const args = ['logs', '-n', ns, pod, `--tail=${lines}`, '--timestamps=true', '--request-timeout=10s'];
        if (container)
            args.push('-c', container);
        const r = await kubectlRawAsync(args);
        const stderr = (r.stderr || '').split('\n').filter(l => l && !isKubectlNoise(l)).join('\n');
        return { logs: r.ok ? r.stdout : '', error: r.ok ? null : (stderr || r.stdout) };
    });
    // GET /api/pod-logs-stream?namespace=X&pod=X&container=X&lines=N — SSE streaming
    app.get('/api/pod-logs-stream', async (req, reply) => {
        const ns = req.query.namespace || 'default';
        const pod = req.query.pod || '';
        const container = req.query.container || '';
        const lines = req.query.lines || '100';
        if (!pod) {
            reply.status(400).send({ error: 'Missing pod' });
            return;
        }
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.setHeader('X-Accel-Buffering', 'no');
        const env = getKubectlEnv();
        const args = ['logs', '-f', '-n', ns, pod, `--tail=${lines}`, '--timestamps=true'];
        if (container)
            args.push('-c', container);
        const child = spawn('kubectl', args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
        const send = (data) => {
            try {
                reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
            }
            catch { }
        };
        child.stdout?.on('data', (chunk) => {
            chunk.toString().split('\n').filter(Boolean).forEach(line => send(line));
        });
        child.stderr?.on('data', (chunk) => {
            chunk.toString().split('\n')
                .filter(line => line && !isKubectlNoise(line))
                .forEach(line => send(`[stderr] ${line}`));
        });
        child.on('close', () => {
            try {
                reply.raw.write('event: end\ndata: {}\n\n');
                reply.raw.end();
            }
            catch { }
        });
        child.on('error', (e) => {
            send(`[error] ${e.message}`);
            try {
                reply.raw.end();
            }
            catch { }
        });
        req.raw.on('close', () => { try {
            child.kill('SIGTERM');
        }
        catch { } });
        await new Promise(() => { }); // Keep alive
    });
    // POST /api/apply-manifest — apply YAML/JSON to cluster
    app.post('/api/apply-manifest', async (req) => {
        const { yaml: content, namespace } = req.body;
        if (!content)
            return { success: false, error: 'Missing content' };
        const { execSync } = await import('node:child_process');
        const { writeFileSync, unlinkSync } = await import('node:fs');
        const { join } = await import('node:path');
        const { tmpdir } = await import('node:os');
        const { getKubectlEnv: getEnv } = await import('../lib/kubectl.js');
        const tmpFile = join(tmpdir(), `apply-${Date.now()}.yaml`);
        try {
            writeFileSync(tmpFile, content, 'utf8');
            const ns = namespace ? ['-n', namespace] : [];
            const out = execSync(['kubectl', 'apply', '-f', tmpFile, ...ns, '--request-timeout=30s'].join(' '), {
                env: getEnv(), timeout: 30_000, maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
            });
            return { success: true, output: out.toString(), error: null };
        }
        catch (e) {
            return { success: false, output: '', error: e.stderr?.toString() || e.message };
        }
        finally {
            try {
                unlinkSync(tmpFile);
            }
            catch { }
        }
    });
}
//# sourceMappingURL=workloads.js.map