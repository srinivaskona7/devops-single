import { FastifyInstance } from 'fastify';
import { kubectlJson } from '../lib/kubectl.js';

export async function kymaRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/kyma-apirules?namespace=<ns>
  app.get<{ Querystring: { namespace?: string } }>('/api/kyma-apirules', async (req) => {
    const ns = req.query.namespace || 'default';
    const r = kubectlJson(['get', 'apirules.gateway.kyma-project.io', '-n', ns]);
    const result: Record<string, any> = { items: [], error: null };
    if (r.notFound) { result.not_found = true; return result; }
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const m = item.metadata || {};
      const spec = item.spec || {};
      const st = item.status || {};
      const apiStatus = st.APIRuleStatus?.code || st.lastProcessedTime || 'Unknown';
      result.items.push({
        name: m.name || '', namespace: m.namespace || '', created: m.creationTimestamp,
        host: spec.host || '\u2014', status: apiStatus,
      });
    }
    return result;
  });

  // GET /api/kyma-subscriptions?namespace=<ns>
  app.get<{ Querystring: { namespace?: string } }>('/api/kyma-subscriptions', async (req) => {
    const ns = req.query.namespace || 'default';
    const r = kubectlJson(['get', 'subscriptions.eventing.kyma-project.io', '-n', ns]);
    const result: Record<string, any> = { items: [], error: null };
    if (r.notFound) { result.not_found = true; return result; }
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const m = item.metadata || {};
      result.items.push({
        name: m.name || '', namespace: m.namespace || '', created: m.creationTimestamp,
        source: item.spec?.source || '\u2014',
        status: item.status?.ready ? 'Ready' : 'NotReady',
      });
    }
    return result;
  });

  // GET /api/kyma-functions?namespace=<ns>
  app.get<{ Querystring: { namespace?: string } }>('/api/kyma-functions', async (req) => {
    const ns = req.query.namespace || 'default';
    const r = kubectlJson(['get', 'functions.serverless.kyma-project.io', '-n', ns]);
    const result: Record<string, any> = { items: [], error: null };
    if (r.notFound) { result.not_found = true; return result; }
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      const m = item.metadata || {};
      result.items.push({
        name: m.name || '', namespace: m.namespace || '', created: m.creationTimestamp,
        runtime: item.spec?.runtime || '\u2014',
        status: item.status?.phase || 'Unknown',
      });
    }
    return result;
  });

  // GET /api/tf-kyma-modules — from health data (terraform modules)
  app.get('/api/tf-kyma-modules', async () => {
    const { getHealthData } = await import('../lib/tfstate.js');
    const health = getHealthData();
    return {
      modules: health.modules || [],
      modules_configured: health.modules_configured || [],
    };
  });
}
