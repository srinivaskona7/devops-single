import { FastifyInstance } from 'fastify';
import { kubectlJsonAsync, kubectlRawAsync, calcAge, getKubectlEnv } from '../lib/kubectl.js';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

export async function configRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/configmaps?namespace=<ns>
  app.get<{ Querystring: { namespace?: string } }>('/api/configmaps', async (req) => {
    const ns = req.query.namespace || 'default';
    const r = await kubectlJsonAsync(['get', 'configmaps', '-n', ns]);
    const result: Record<string, any> = { namespace: ns, items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const meta = item.metadata || {};
      result.items.push({
        name: meta.name || '', namespace: meta.namespace || ns,
        dataKeys: Object.keys(item.data || {}), creationTimestamp: meta.creationTimestamp || '',
      });
    }
    return result;
  });

  // GET /api/secrets?namespace=<ns>
  app.get<{ Querystring: { namespace?: string } }>('/api/secrets', async (req) => {
    const ns = req.query.namespace || 'default';
    const r = await kubectlJsonAsync(['get', 'secrets', '-n', ns]);
    const result: Record<string, any> = { namespace: ns, items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const meta = item.metadata || {};
      result.items.push({
        name: meta.name || '', namespace: meta.namespace || ns,
        type: item.type || '', dataKeys: Object.keys(item.data || {}),
        creationTimestamp: meta.creationTimestamp || '',
      });
    }
    return result;
  });

  // GET /api/configmap-detail?namespace=<ns>&name=<name>
  app.get<{ Querystring: { namespace?: string; name?: string } }>('/api/configmap-detail', async (req) => {
    const ns = req.query.namespace || 'default';
    const name = req.query.name || '';
    if (!name) return { data: null, error: 'Missing name' };
    const r = await kubectlJsonAsync(['get', 'configmap', name, '-n', ns]);
    if (!r.data) return { data: null, error: r.error };
    const item = r.data as any;
    const meta = item.metadata || {};
    return {
      data: {
        name: meta.name, namespace: meta.namespace,
        creationTimestamp: meta.creationTimestamp,
        labels: meta.labels || {}, annotations: meta.annotations || {},
        data: item.data || {}, binaryData: Object.keys(item.binaryData || {}),
      }, error: null
    };
  });

  // GET /api/secret-detail?namespace=<ns>&name=<name>
  app.get<{ Querystring: { namespace?: string; name?: string } }>('/api/secret-detail', async (req) => {
    const ns = req.query.namespace || 'default';
    const name = req.query.name || '';
    if (!name) return { data: null, error: 'Missing name' };
    const r = await kubectlJsonAsync(['get', 'secret', name, '-n', ns]);
    if (!r.data) return { data: null, error: r.error };
    const item = r.data as any;
    const meta = item.metadata || {};
    return {
      data: {
        name: meta.name, namespace: meta.namespace,
        creationTimestamp: meta.creationTimestamp,
        labels: meta.labels || {}, annotations: meta.annotations || {},
        type: item.type || 'Opaque',
        dataKeys: Object.keys(item.data || {}),
        data: item.data || {},
      }, error: null
    };
  });

  // GET /api/serviceaccounts?namespace=<ns>
  app.get<{ Querystring: { namespace?: string } }>('/api/serviceaccounts', async (req) => {
    const ns = req.query.namespace || 'default';
    const r = await kubectlJsonAsync(['get', 'serviceaccounts', '-n', ns]);
    const result: Record<string, any> = { namespace: ns, items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const meta = item.metadata || {};
      result.items.push({
        name: meta.name || '', namespace: meta.namespace || ns,
        secrets: (item.secrets || []).map((s: any) => s.name || ''),
        creationTimestamp: meta.creationTimestamp || '',
      });
    }
    return result;
  });

  // GET /api/clusterroles (cluster-scoped)
  app.get('/api/clusterroles', async () => {
    const r = await kubectlJsonAsync(['get', 'clusterroles']);
    const result: Record<string, any> = { items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const meta = item.metadata || {};
      result.items.push({
        name: meta.name || '', created: meta.creationTimestamp || '',
        rules: (item.rules || []).length, labels: meta.labels || {},
      });
    }
    return result;
  });

  // GET /api/clusterrolebindings (cluster-scoped)
  app.get('/api/clusterrolebindings', async () => {
    const r = await kubectlJsonAsync(['get', 'clusterrolebindings']);
    const result: Record<string, any> = { items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const meta = item.metadata || {};
      const roleRef = item.roleRef || {};
      const subjects = item.subjects || [];
      result.items.push({
        name: meta.name || '', roleRef: roleRef.name || '', roleRefKind: roleRef.kind || '',
        subjects: subjects.map((s: any) => s.name || '—').join(', '),
        created: meta.creationTimestamp || '',
      });
    }
    return result;
  });

  // GET /api/roles?namespace=<ns>
  app.get<{ Querystring: { namespace?: string } }>('/api/roles', async (req) => {
    const ns = req.query.namespace || 'default';
    const r = await kubectlJsonAsync(['get', 'roles', '-n', ns]);
    const result: Record<string, any> = { items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const m = item.metadata || {};
      result.items.push({ name: m.name || '', namespace: m.namespace || '', age: calcAge(m.creationTimestamp) });
    }
    return result;
  });

  // GET /api/rolebindings?namespace=<ns>
  app.get<{ Querystring: { namespace?: string } }>('/api/rolebindings', async (req) => {
    const ns = req.query.namespace || 'default';
    const r = await kubectlJsonAsync(['get', 'rolebindings', '-n', ns]);
    const result: Record<string, any> = { items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const m = item.metadata || {};
      result.items.push({
        name: m.name || '', namespace: m.namespace || '',
        role: (item.roleRef || {}).name || '\u2014',
        subjects: (item.subjects || []).map((s: any) => s.name || '\u2014'),
        age: calcAge(m.creationTimestamp),
      });
    }
    return result;
  });

  // GET /api/limitranges?namespace=<ns>
  app.get<{ Querystring: { namespace?: string } }>('/api/limitranges', async (req) => {
    const ns = req.query.namespace || 'default';
    const r = await kubectlJsonAsync(['get', 'limitrange', '-n', ns]);
    const result: Record<string, any> = { items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const m = item.metadata || {};
      result.items.push({
        name: m.name || '', namespace: m.namespace || '',
        limits: item.spec?.limits || [], age: calcAge(m.creationTimestamp),
      });
    }
    return result;
  });

  // GET /api/resourcequotas?namespace=<ns>
  app.get<{ Querystring: { namespace?: string } }>('/api/resourcequotas', async (req) => {
    const ns = req.query.namespace || 'default';
    const r = await kubectlJsonAsync(['get', 'resourcequota', '-n', ns]);
    const result: Record<string, any> = { items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const m = item.metadata || {};
      result.items.push({
        name: m.name || '', namespace: m.namespace || '',
        hard: item.status?.hard || {}, used: item.status?.used || {},
        age: calcAge(m.creationTimestamp),
      });
    }
    return result;
  });

  // GET /api/horizontalpodautoscalers?namespace=<ns>
  app.get<{ Querystring: { namespace?: string } }>('/api/horizontalpodautoscalers', async (req) => {
    const ns = req.query.namespace || 'default';
    const r = await kubectlJsonAsync(['get', 'hpa', '-n', ns]);
    const result: Record<string, any> = { items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const m = item.metadata || {};
      const spec = item.spec || {};
      const st = item.status || {};
      let targetCpu: number | null = null;
      for (const metric of spec.metrics || []) {
        if (metric.type === 'Resource' && metric.resource?.name === 'cpu') {
          targetCpu = metric.resource?.target?.averageUtilization ?? null;
        }
      }
      result.items.push({
        name: m.name || '', namespace: m.namespace || '', created: m.creationTimestamp,
        minReplicas: spec.minReplicas || 1, maxReplicas: spec.maxReplicas || 1,
        currentReplicas: st.currentReplicas || 0, targetCPU: targetCpu,
        age: calcAge(m.creationTimestamp),
      });
    }
    return result;
  });

  // GET /api/poddisruptionbudgets?namespace=<ns>
  app.get<{ Querystring: { namespace?: string } }>('/api/poddisruptionbudgets', async (req) => {
    const ns = req.query.namespace || 'default';
    const r = await kubectlJsonAsync(['get', 'pdb', '-n', ns]);
    const result: Record<string, any> = { items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const m = item.metadata || {};
      const spec = item.spec || {};
      const st = item.status || {};
      result.items.push({
        name: m.name || '', namespace: m.namespace || '', created: m.creationTimestamp,
        minAvailable: spec.minAvailable ?? null, maxUnavailable: spec.maxUnavailable ?? null,
        currentHealthy: st.currentHealthy || 0, desiredHealthy: st.desiredHealthy || 0,
        age: calcAge(m.creationTimestamp),
      });
    }
    return result;
  });

  // GET /api/rbac-summary — combined roles/bindings/clusterroles/clusterrolebindings
  app.get<{ Querystring: { namespace?: string } }>('/api/rbac-summary', async (req) => {
    const ns = req.query.namespace || 'default';
    const roles = await kubectlJsonAsync(['get', 'roles', '-n', ns]);
    const bindings = await kubectlJsonAsync(['get', 'rolebindings', '-n', ns]);
    const croles = await kubectlJsonAsync(['get', 'clusterroles']);
    const cbindings = await kubectlJsonAsync(['get', 'clusterrolebindings']);
    return {
      roles: ((roles.data as any)?.items || []).length,
      rolebindings: ((bindings.data as any)?.items || []).length,
      clusterroles: ((croles.data as any)?.items || []).length,
      clusterrolebindings: ((cbindings.data as any)?.items || []).length,
      error: null,
    };
  });

  // GET /api/rbac-cani?namespace=X — check what current SA can do
  app.get<{ Querystring: { namespace?: string } }>('/api/rbac-cani', async (req) => {
    const ns = req.query.namespace || 'default';

    // Run kubectl auth can-i --list
    const r = await kubectlRawAsync(['auth', 'can-i', '--list', '-n', ns]);
    if (!r.ok) return { rows: [], error: r.stderr };

    // Parse the output table
    const rows: any[] = [];
    const lines = r.stdout.split('\n').slice(1); // skip header
    lines.forEach(line => {
      const parts = line.trim().split(/\s{2,}/);
      if (parts.length >= 3) {
        rows.push({
          resources: parts[0],
          nonResourceURLs: parts[1],
          resourceNames: parts[2] || '',
          verbs: parts[3] || '',
        });
      }
    });

    return { rows, namespace: ns, error: null };
  });

  // GET /api/crds — list all Custom Resource Definitions
  app.get('/api/crds', async () => {
    const r = await kubectlJsonAsync(['get', 'crd'], 15_000, 30_000);
    if (!r.data) return { items: [], error: r.error };
    const items = ((r.data as any).items || []).map((item: any) => ({
      name: item.metadata?.name || '',
      group: item.spec?.group || '',
      scope: item.spec?.scope || '',
      versions: (item.spec?.versions || []).map((v: any) => v.name),
      plural: item.spec?.names?.plural || '',
      kind: item.spec?.names?.kind || '',
      created: item.metadata?.creationTimestamp || '',
    }));
    return { items, error: null };
  });

  // GET /api/custom-resources?crd=X&namespace=Y — list CRs for a CRD
  app.get<{ Querystring: { crd?: string; namespace?: string } }>('/api/custom-resources', async (req) => {
    const { crd, namespace } = req.query;
    if (!crd) return { items: [], error: 'Missing crd parameter' };
    const allNs = !namespace || namespace === '-all-';
    const nsArgs = allNs ? ['--all-namespaces'] : ['-n', namespace];
    const r = await kubectlJsonAsync(['get', crd, ...nsArgs], 20_000, 15_000);
    if (!r.data) return { items: [], error: r.error };
    const items = ((r.data as any).items || []).map((item: any) => ({
      name: item.metadata?.name || '',
      namespace: item.metadata?.namespace || '',
      created: item.metadata?.creationTimestamp || '',
      status: item.status?.phase || item.status?.state || '',
    }));
    return { items, error: null };
  });

  // GET /api/resource-yaml?kind=X&name=Y&namespace=Z&cluster=true — get full YAML for any resource
  app.get<{ Querystring: { kind?: string; name?: string; namespace?: string; cluster?: string } }>(
    '/api/resource-yaml', async (req) => {
      const { kind, name, namespace, cluster } = req.query;
      if (!kind || !name) return { yaml: '', error: 'Missing kind or name' };
      const isCluster = cluster === 'true' || !namespace;
      const nsArgs = isCluster ? [] : ['-n', namespace];
      const r = await kubectlRawAsync(['get', kind, name, ...nsArgs, '-o', 'yaml'], 15_000);
      return { yaml: r.ok ? r.stdout : '', error: r.ok ? null : r.stderr };
    }
  );

  // POST /api/resource-apply — save/apply modified YAML
  app.post<{ Body: { yaml: string } }>('/api/resource-apply', async (req) => {
    const { yaml: content } = req.body;
    if (!content) return { success: false, error: 'Missing YAML content' };
    const tmpFile = join(tmpdir(), `rbac-apply-${Date.now()}.yaml`);
    try {
      writeFileSync(tmpFile, content, 'utf8');
      const out = execSync(['kubectl', 'apply', '-f', tmpFile, '--request-timeout=15s'].join(' '), {
        env: getKubectlEnv(), timeout: 20_000, maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output: out.toString(), error: null };
    } catch (e: any) {
      return { success: false, output: '', error: e.stderr?.toString() || e.message };
    } finally {
      try { unlinkSync(tmpFile); } catch {}
    }
  });
}
