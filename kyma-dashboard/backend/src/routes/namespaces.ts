import { FastifyInstance } from 'fastify';
import { kubectlJsonAsync, kubectlRawAsync, getKubectlEnv } from '../lib/kubectl.js';
import { execSync } from 'node:child_process';

function parseCpuToMillicores(cpu: string): number {
  if (!cpu || cpu === '0') return 0;
  if (cpu.endsWith('m')) return parseFloat(cpu);
  return parseFloat(cpu) * 1000;
}

function parseMemToMi(mem: string): number {
  if (!mem || mem === '0') return 0;
  if (mem.endsWith('Ki')) return parseFloat(mem) / 1024;
  if (mem.endsWith('Mi')) return parseFloat(mem);
  if (mem.endsWith('Gi')) return parseFloat(mem) * 1024;
  if (mem.endsWith('Ti')) return parseFloat(mem) * 1024 * 1024;
  if (mem.endsWith('K'))  return parseFloat(mem) / 1024;
  if (mem.endsWith('M'))  return parseFloat(mem);
  if (mem.endsWith('G'))  return parseFloat(mem) * 1024;
  return parseFloat(mem) / (1024 * 1024);
}

function fmtCpu(m: number): string {
  if (m === 0) return '0m';
  if (m >= 1000) return `${(m / 1000).toFixed(2)}`;
  return `${Math.round(m)}m`;
}

function fmtMem(mi: number): string {
  if (mi === 0) return '0Mi';
  if (mi >= 1024) return `${(mi / 1024).toFixed(1)}Gi`;
  return `${Math.round(mi)}Mi`;
}


export async function namespaceRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/namespaces
  app.get('/api/namespaces', async () => {
    const [nsResult, podsResult] = await Promise.all([
      kubectlJsonAsync(['get', 'namespaces']),
      kubectlJsonAsync(['get', 'pods', '--all-namespaces'], 15_000, 20_000),
    ]);

    const result: Record<string, any> = { items: [], namespaces: [], error: null };
    if (!nsResult.data) { result.error = nsResult.error; return result; }

    // Aggregate pod stats per namespace
    const nsStats: Record<string, { pods: number; running: number; cpuMi: number; memMi: number }> = {};
    if (podsResult.data) {
      for (const p of ((podsResult.data as any).items || [])) {
        const ns = p.metadata?.namespace || '';
        if (!nsStats[ns]) nsStats[ns] = { pods: 0, running: 0, cpuMi: 0, memMi: 0 };
        nsStats[ns].pods++;
        if ((p.status?.phase || '').toLowerCase() === 'running') nsStats[ns].running++;
        for (const c of [...(p.spec?.containers || []), ...(p.spec?.initContainers || [])]) {
          nsStats[ns].cpuMi  += parseCpuToMillicores(c.resources?.requests?.cpu    || '0');
          nsStats[ns].memMi  += parseMemToMi(        c.resources?.requests?.memory || '0');
        }
      }
    }

    const raw = (nsResult.data as any).items || [];
    result.namespaces = raw.map((item: any) => item.metadata?.name || '');
    result.items = raw.map((item: any) => {
      const name = item.metadata?.name || '';
      const s = nsStats[name] || { pods: 0, running: 0, cpuMi: 0, memMi: 0 };
      return {
        name,
        status:       item.status?.phase || 'Active',
        labels:       item.metadata?.labels || {},
        annotations:  item.metadata?.annotations || {},
        created:      item.metadata?.creationTimestamp || '',
        pods:         s.pods,
        running_pods: s.running,
        cpu_requests: fmtCpu(s.cpuMi),
        mem_requests: fmtMem(s.memMi),
      };
    });
    return result;
  });

  // GET /api/namespace-overview?namespace=<ns>
  app.get<{ Querystring: { namespace?: string } }>('/api/namespace-overview', async (req) => {
    const ns = req.query.namespace || 'default';
    const env = getKubectlEnv();
    const allNs = ['-all-', '--all-namespaces', '_all', ''].includes(ns);
    const nsFlag = allNs ? ['--all-namespaces'] : ['-n', ns];

    const result: Record<string, any> = {
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
        const items = (podResult.data as any).items || [];
        result.pods = items.length;
        for (const p of items) {
          const phase = (p.status?.phase || '').toLowerCase();
          if (phase === 'running') result.running_pods++;
          else if (phase === 'pending') result.pending_pods++;
          else if (phase === 'failed' || phase === 'unknown') result.failed_pods++;
          else result.running_pods++; // succeeded/other → treat as healthy
        }
      }

      // Other namespaced resources — fetch ALL in parallel
      const resources: [string, string][] = [
        ['deployments', 'deployments'], ['services', 'svc'],
        ['statefulsets', 'statefulsets'], ['daemonsets', 'daemonsets'],
        ['replicasets', 'replicasets'], ['configmaps', 'configmaps'],
        ['secrets', 'secrets'], ['serviceaccounts', 'serviceaccounts'],
        ['jobs', 'jobs'], ['cronjobs', 'cronjobs'],
        ['networkpolicies', 'networkpolicies'],
        ['limitranges', 'limitrange'], ['resourcequotas', 'resourcequota'],
        ['hpa', 'hpa'], ['pdb', 'pdb'],
      ];

      const resourceResults = await Promise.all(
        resources.map(([, resource]) => kubectlJsonAsync(['get', resource, ...nsFlag], 15_000, 30_000))
      );
      for (let i = 0; i < resources.length; i++) {
        const [key] = resources[i];
        const r = resourceResults[i];
        if (r.data) {
          const items = (r.data as any).items || [];
          result[key] = items.length;
          if (key === 'services') {
            result.loadbalancers = items.filter((s: any) => s.spec?.type === 'LoadBalancer').length;
          }
        }
      }

      // PVs (cluster-scoped, for -all-) and PVCs (namespaced)
      if (allNs) {
        const pvResult = await kubectlJsonAsync(['get', 'pv']);
        if (pvResult.data) {
          const pvs = (pvResult.data as any).items || [];
          result.persistentvolumes = pvs.length;
          let totalGi = 0;
          for (const pv of pvs) {
            const cap = pv.spec?.capacity?.storage || '0';
            if (cap.endsWith('Gi')) totalGi += parseFloat(cap.slice(0, -2));
            else if (cap.endsWith('Mi')) totalGi += parseFloat(cap.slice(0, -2)) / 1024;
            else if (cap.endsWith('Ti')) totalGi += parseFloat(cap.slice(0, -2)) * 1024;
          }
          result.pv_capacity = totalGi > 0 ? `${totalGi.toFixed(1)}Gi` : '0Gi';
        }
      } else {
        // For a specific namespace, count PVCs and sum their capacity
        const pvcResult = await kubectlJsonAsync(['get', 'pvc', '-n', ns]);
        if (pvcResult.data) {
          const pvcs = (pvcResult.data as any).items || [];
          result.persistentvolumes = pvcs.length;
          let totalGi = 0;
          for (const pvc of pvcs) {
            const cap = pvc.spec?.resources?.requests?.storage || pvc.status?.capacity?.storage || '0';
            if (cap.endsWith('Gi')) totalGi += parseFloat(cap.slice(0, -2));
            else if (cap.endsWith('Mi')) totalGi += parseFloat(cap.slice(0, -2)) / 1024;
            else if (cap.endsWith('Ti')) totalGi += parseFloat(cap.slice(0, -2)) * 1024;
          }
          result.pv_capacity = totalGi > 0 ? `${totalGi.toFixed(1)}Gi` : '0Gi';
        }
      }
    } catch (e: any) {
      result.error = e.message || String(e);
    }

    return result;
  });

  // GET /api/topology?namespace=X — resource dependency graph for a namespace
  app.get<{ Querystring: { namespace?: string } }>('/api/topology', async (req) => {
    const ns = req.query.namespace || 'default';

    // Fetch all resources in parallel
    const [deploymentsR, podsR, servicesR, replicaSetsR] = await Promise.all([
      kubectlJsonAsync(['get', 'deployments', '-n', ns], 15_000, 10_000),
      kubectlJsonAsync(['get', 'pods', '-n', ns], 15_000, 5_000),
      kubectlJsonAsync(['get', 'services', '-n', ns], 15_000, 10_000),
      kubectlJsonAsync(['get', 'replicasets', '-n', ns], 15_000, 10_000),
    ]);

    const deployments = (deploymentsR.data as any)?.items || [];
    const pods = (podsR.data as any)?.items || [];
    const services = (servicesR.data as any)?.items || [];
    const replicaSets = (replicaSetsR.data as any)?.items || [];

    // Build nodes and edges
    const nodes: any[] = [];
    const edges: any[] = [];

    deployments.forEach((d: any) => {
      const name = d.metadata.name;
      nodes.push({ id: `deploy/${name}`, kind: 'Deployment', name, status: d.status?.readyReplicas === d.spec?.replicas ? 'ok' : 'warn' });

      // Find owned ReplicaSets
      replicaSets.forEach((rs: any) => {
        const owner = rs.metadata.ownerReferences?.find((o: any) => o.kind === 'Deployment' && o.name === name);
        if (owner) {
          const rsName = rs.metadata.name;
          nodes.push({ id: `rs/${rsName}`, kind: 'ReplicaSet', name: rsName, replicas: rs.status?.readyReplicas || 0 });
          edges.push({ from: `deploy/${name}`, to: `rs/${rsName}` });

          // Find owned Pods
          pods.forEach((p: any) => {
            const podOwner = p.metadata.ownerReferences?.find((o: any) => o.kind === 'ReplicaSet' && o.name === rsName);
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
    services.forEach((svc: any) => {
      const sel = svc.spec?.selector || {};
      if (Object.keys(sel).length === 0) return; // skip services without selector
      const svcName = svc.metadata.name;
      nodes.push({ id: `svc/${svcName}`, kind: 'Service', name: svcName, type: svc.spec.type });

      pods.forEach((p: any) => {
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
