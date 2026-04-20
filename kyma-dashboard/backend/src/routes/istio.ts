import { FastifyInstance } from 'fastify';
import { kubectlJsonAsync } from '../lib/kubectl.js';

function isCrdNotFound(stderr: string): boolean {
  return /no kind|not found|not recognized|does not exist|couldn't find/i.test(stderr);
}

async function istioResource(
  app: FastifyInstance, path: string, crd: string,
  mapper: (item: any) => Record<string, any>,
  allNamespaces = false,
) {
  app.get<{ Querystring: { namespace?: string } }>(path, async (req) => {
    const ns = req.query.namespace || 'default';
    const isAll = allNamespaces || ['-all-', '--all-namespaces', ''].includes(ns);
    const nsArgs = isAll ? ['--all-namespaces'] : ['-n', ns];
    const r = await kubectlJsonAsync(['get', crd, ...nsArgs], 15_000, 20_000);
    const result: Record<string, any> = { items: [], error: null };
    if (r.notFound) { result.not_found = true; return result; }
    if (!r.data) { result.error = r.error; return result; }
    for (const item of (r.data as any).items || []) {
      result.items.push(mapper(item));
    }
    return result;
  });
}

export async function istioRoutes(app: FastifyInstance): Promise<void> {

  // /api/istio-virtualservices
  await istioResource(app, '/api/istio-virtualservices', 'virtualservices.networking.istio.io', (item) => {
    const m = item.metadata || {};
    const spec = item.spec || {};
    return {
      name: m.name || '', namespace: m.namespace || '', created: m.creationTimestamp,
      hosts: spec.hosts || [], gateways: spec.gateways || [],
    };
  });

  // /api/istio-gateways
  await istioResource(app, '/api/istio-gateways', 'gateways.networking.istio.io', (item) => {
    const m = item.metadata || {};
    const spec = item.spec || {};
    const servers = spec.servers || [];
    const ports = servers.map((s: any) => `${s.port?.protocol || ''}/${s.port?.number || ''}`).join(', ');
    return {
      name: m.name || '', namespace: m.namespace || '', created: m.creationTimestamp,
      selector: JSON.stringify(spec.selector || {}),
      ports,
      hosts: servers.flatMap((s: any) => s.hosts || []).slice(0, 2),
    };
  });

  // /api/istio-destinationrules
  await istioResource(app, '/api/istio-destinationrules', 'destinationrules.networking.istio.io', (item) => {
    const m = item.metadata || {};
    return {
      name: m.name || '', namespace: m.namespace || '', created: m.creationTimestamp,
      host: item.spec?.host || '\u2014',
      trafficPolicy: item.spec?.trafficPolicy ? 'configured' : 'none',
    };
  });

  // /api/istio-peerauthentications
  await istioResource(app, '/api/istio-peerauthentications', 'peerauthentications.security.istio.io', (item) => {
    const m = item.metadata || {};
    return {
      name: m.name || '', namespace: m.namespace || '', created: m.creationTimestamp,
      mtlsMode: item.spec?.mtls?.mode || 'STRICT',
    };
  });

  // /api/istio-authorizationpolicies
  await istioResource(app, '/api/istio-authorizationpolicies', 'authorizationpolicies.security.istio.io', (item) => {
    const m = item.metadata || {};
    const spec = item.spec || {};
    return {
      name: m.name || '', namespace: m.namespace || '', created: m.creationTimestamp,
      action: spec.action || 'ALLOW',
      rules: (spec.rules || []).length,
    };
  });

  // /api/istio-serviceentries
  await istioResource(app, '/api/istio-serviceentries', 'serviceentries.networking.istio.io', (item) => {
    const m = item.metadata || {};
    const spec = item.spec || {};
    return {
      name: m.name || '', namespace: m.namespace || '', created: m.creationTimestamp,
      hosts: spec.hosts || [], ports: spec.ports || [],
    };
  });

  // /api/istio-requestauthentications
  await istioResource(app, '/api/istio-requestauthentications', 'requestauthentications.security.istio.io', (item) => {
    const m = item.metadata || {};
    const spec = item.spec || {};
    const rules = spec.jwtRules || [];
    return {
      name: m.name || '', namespace: m.namespace || '', created: m.creationTimestamp,
      issuer: rules[0]?.issuer || '—',
      jwksUri: rules[0]?.jwksUri || '—',
      rules: rules.length,
    };
  });

  // /api/istio-sidecars
  await istioResource(app, '/api/istio-sidecars', 'sidecars.networking.istio.io', (item) => {
    const m = item.metadata || {};
    const spec = item.spec || {};
    return {
      name: m.name || '', namespace: m.namespace || '', created: m.creationTimestamp,
      egress: (spec.egress || []).length,
      ingress: (spec.ingress || []).length,
      workloadSelector: JSON.stringify(spec.workloadSelector?.labels || {}),
    };
  });
}
