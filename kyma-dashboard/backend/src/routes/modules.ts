import { FastifyInstance } from 'fastify';
import { kubectlJson, kubectlExec } from '../lib/kubectl.js';

const MODULE_CATALOG = [
  { name: 'istio',               description: 'Service mesh — secure, observable microservices' },
  { name: 'api-gateway',         description: 'Expose services via APIRules and OAuth2' },
  { name: 'serverless',          description: 'Deploy Functions in Node.js or Python' },
  { name: 'eventing',            description: 'Publish/subscribe events using CloudEvents' },
  { name: 'btp-operator',        description: 'Provision SAP BTP services via Service Catalog' },
  { name: 'keda',                description: 'Event-driven autoscaling for workloads' },
  { name: 'nats',                description: 'High-performance messaging for Eventing' },
  { name: 'telemetry',           description: 'Logs, traces, metrics via OpenTelemetry' },
  { name: 'application-connector', description: 'Connect external systems to the cluster' },
  { name: 'ory',                 description: 'Identity & access management (Hydra, Oathkeeper)' },
];

export async function moduleRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/kyma-modules
  app.get('/api/kyma-modules', async () => {
    const kymaResult = kubectlJson(['get', 'kyma', 'default', '-n', 'kyma-system']);
    if (!kymaResult.data) {
      return {
        items: MODULE_CATALOG.map(m => ({ ...m, enabled: false, channel: '', state: '' })),
        kymaFound: false,
        error: kymaResult.error || 'Kyma CR not found',
      };
    }
    const kyma = kymaResult.data as any;
    const specModules: { name: string; channel?: string }[] = kyma.spec?.modules || [];
    const statusModules: { name: string; state?: string }[] = kyma.status?.modules || [];
    const enabledMap = new Map(specModules.map(m => [m.name, m.channel || 'regular']));
    const stateMap   = new Map(statusModules.map(m => [m.name, m.state || '']));
    return {
      items: MODULE_CATALOG.map(m => ({
        ...m,
        enabled: enabledMap.has(m.name),
        channel: enabledMap.get(m.name) || '',
        state:   stateMap.get(m.name) || '',
      })),
      kymaFound: true,
      error: null,
    };
  });

  // POST /api/toggle-module — enable/disable Kyma module
  app.post<{ Body: { module: string; action: 'enable' | 'disable'; channel?: string } }>(
    '/api/toggle-module', async (req) => {
      const { module, action, channel } = req.body;
      if (!module || !action) {
        return { error: 'module and action (enable/disable) required' };
      }

      const kymaResult = kubectlJson(['get', 'kyma', 'default', '-n', 'kyma-system']);
      if (!kymaResult.data) {
        return { error: kymaResult.error || 'Failed to read Kyma CR' };
      }

      const kyma = kymaResult.data as any;
      const modules: any[] = kyma.spec?.modules || [];

      if (action === 'enable') {
        const exists = modules.find((m: any) => m.name === module);
        if (!exists) {
          modules.push({ name: module, channel: channel || 'regular' });
        }
      } else {
        const idx = modules.findIndex((m: any) => m.name === module);
        if (idx >= 0) modules.splice(idx, 1);
      }

      const patch = JSON.stringify({ spec: { modules } });
      const r = kubectlExec([
        'patch', 'kyma', 'default', '-n', 'kyma-system',
        '--type=merge', '-p', patch,
      ]);

      if (r.returncode !== 0) {
        return { error: r.stderr || 'Patch failed' };
      }

      return { success: true, module, action, output: r.stdout };
    },
  );

  // POST /api/enable-all-modules — enable all available Kyma modules
  app.post('/api/enable-all-modules', async () => {
    const defaultModules = [
      'api-gateway', 'istio', 'serverless', 'eventing',
      'btp-operator', 'keda', 'nats', 'telemetry',
    ];

    const kymaResult = kubectlJson(['get', 'kyma', 'default', '-n', 'kyma-system']);
    if (!kymaResult.data) {
      return { error: kymaResult.error || 'Failed to read Kyma CR' };
    }

    const kyma = kymaResult.data as any;
    const existing: any[] = kyma.spec?.modules || [];
    const existingNames = new Set(existing.map((m: any) => m.name));

    for (const mod of defaultModules) {
      if (!existingNames.has(mod)) {
        existing.push({ name: mod, channel: 'regular' });
      }
    }

    const patch = JSON.stringify({ spec: { modules: existing } });
    const r = kubectlExec([
      'patch', 'kyma', 'default', '-n', 'kyma-system',
      '--type=merge', '-p', patch,
    ]);

    if (r.returncode !== 0) {
      return { error: r.stderr || 'Patch failed' };
    }

    return { success: true, modules: existing, output: r.stdout };
  });
}
