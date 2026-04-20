import { FastifyInstance } from 'fastify';
import { kubectlJsonAsync, kubectlRawAsync, calcAge } from '../lib/kubectl.js';

export async function storageRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/persistentvolumes (cluster-scoped)
  app.get('/api/persistentvolumes', async () => {
    const r = await kubectlJsonAsync(['get', 'pv']);
    const result: Record<string, any> = { items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const m = item.metadata || {};
      const spec = item.spec || {};
      const status = item.status || {};
      const claimRef = spec.claimRef;
      result.items.push({
        name: m.name || '',
        capacity: spec.capacity?.storage || '\u2014',
        accessModes: spec.accessModes || [],
        reclaimPolicy: spec.persistentVolumeReclaimPolicy || '\u2014',
        status: status.phase || '\u2014',
        storageClass: spec.storageClassName || '\u2014',
        claim: claimRef ? `${claimRef.name || '\u2014'}/${claimRef.namespace || ''}` : '\u2014',
        age: calcAge(m.creationTimestamp),
      });
    }
    return result;
  });

  // GET /api/pvs — alias (direct handler, no redirect)
  app.get('/api/pvs', async () => {
    const r = await kubectlJsonAsync(['get', 'pv']);
    const result: Record<string, any> = { items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const m = item.metadata || {};
      const spec = item.spec || {};
      const status = item.status || {};
      const claimRef = spec.claimRef;
      result.items.push({
        name: m.name || '',
        capacity: spec.capacity?.storage || '\u2014',
        accessModes: spec.accessModes || [],
        reclaimPolicy: spec.persistentVolumeReclaimPolicy || '\u2014',
        status: status.phase || '\u2014',
        storageClass: spec.storageClassName || '\u2014',
        claim: claimRef ? `${claimRef.name || '\u2014'}/${claimRef.namespace || ''}` : '\u2014',
        age: calcAge(m.creationTimestamp),
      });
    }
    return result;
  });

  // GET /api/persistentvolumeclaims?namespace=<ns>
  app.get<{ Querystring: { namespace?: string } }>('/api/persistentvolumeclaims', async (req) => {
    const ns = req.query.namespace || 'default';
    const r = await kubectlJsonAsync(['get', 'pvc', '-n', ns]);
    const result: Record<string, any> = { items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const m = item.metadata || {};
      const spec = item.spec || {};
      const status = item.status || {};
      result.items.push({
        name: m.name || '', namespace: m.namespace || '',
        status: status.phase || '\u2014', volume: spec.volumeName || '\u2014',
        capacity: status.capacity?.storage || '\u2014', accessModes: spec.accessModes || [],
        storageClass: spec.storageClassName || '\u2014', age: calcAge(m.creationTimestamp),
      });
    }
    return result;
  });

  // GET /api/pvcs — alias (direct handler)
  app.get<{ Querystring: { namespace?: string } }>('/api/pvcs', async (req) => {
    const ns = req.query.namespace || 'default';
    const r = await kubectlJsonAsync(['get', 'pvc', '-n', ns]);
    const result: Record<string, any> = { items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const m = item.metadata || {};
      const spec = item.spec || {};
      const status = item.status || {};
      result.items.push({
        name: m.name || '', namespace: m.namespace || '',
        status: status.phase || '\u2014', volume: spec.volumeName || '\u2014',
        capacity: status.capacity?.storage || '\u2014', accessModes: spec.accessModes || [],
        storageClass: spec.storageClassName || '\u2014', age: calcAge(m.creationTimestamp),
        created: m.creationTimestamp || '',
        labels: m.labels || {},
        annotations: m.annotations || {},
      });
    }
    return result;
  });

  // GET /api/storageclasses (cluster-scoped)
  app.get('/api/storageclasses', async () => {
    const r = await kubectlJsonAsync(['get', 'storageclass']);
    const result: Record<string, any> = { items: [], error: null };
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const m = item.metadata || {};
      result.items.push({
        name: m.name || '', provisioner: item.provisioner || '\u2014',
        reclaimPolicy: item.reclaimPolicy || '\u2014', volumeBindingMode: item.volumeBindingMode || '\u2014',
        isDefault: (m.annotations || {})['storageclass.kubernetes.io/is-default-class'] || 'false',
        age: calcAge(m.creationTimestamp),
      });
    }
    return result;
  });
}
