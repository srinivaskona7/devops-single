import { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  paths, getActiveKubeconfig, setActiveKubeconfig, getKubeconfigPath,
} from '../lib/kubectl.js';

function detectAuthType(filepath: string): string {
  try {
    const raw = fs.readFileSync(filepath, 'utf8');
    if (/^\s+token:/m.test(raw)) return 'token';
    if (/^\s+exec:/m.test(raw)) return 'exec/oidc';
    if (/client-certificate/.test(raw)) return 'certificate';
  } catch {}
  return 'unknown';
}

function parseKubeconfig(filepath: string): { contexts: string[]; current_context: string | null; clusters: string[] } {
  const result = { contexts: [] as string[], current_context: null as string | null, clusters: [] as string[] };
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const ccMatch = content.match(/^current-context:\s*(\S+)/m);
    if (ccMatch) result.current_context = ccMatch[1];
    for (const m of content.matchAll(/^\s*- name:\s*(\S+)/gm)) {
      const val = m[1];
      if (!result.contexts.includes(val)) result.contexts.push(val);
      if (!result.clusters.includes(val)) result.clusters.push(val);
    }
  } catch {}
  return result;
}

export async function kubeconfigRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/kubeconfig-info
  app.get('/api/kubeconfig-info', async () => {
    const candidatePaths: [string, string][] = [
      [paths.TOKEN_KUBECONFIG, 'trail-token'],
      [paths.GEN_TOKEN_KUBECONFIG, 'generated-token'],
      [paths.OIDC_KUBECONFIG, 'generated-oidc'],
      [paths.OIDC_KUBECONFIG2, 'generated-oidc-alt'],
    ];

    const activeKc = getActiveKubeconfig();
    if (activeKc) {
      const absActive = path.resolve(activeKc);
      const existing = candidatePaths.map(c => path.resolve(c[0]));
      if (!existing.includes(absActive)) {
        candidatePaths.push([activeKc, 'session-active']);
      }
    }

    const activeKubeconfig = getKubeconfigPath() || null;

    // Deduplicate
    const seen = new Set<string>();
    const unique: [string, string][] = [];
    for (const [p, label] of candidatePaths) {
      const ap = path.resolve(p);
      if (!seen.has(ap)) { seen.add(ap); unique.push([ap, label]); }
    }

    const files = unique.map(([p, label]) => {
      const exists = fs.existsSync(p);
      const size = exists ? fs.statSync(p).size : 0;
      const parsed = exists ? parseKubeconfig(p) : { contexts: [], current_context: null, clusters: [] };
      const authType = exists ? detectAuthType(p) : null;
      return {
        path: p, label, exists, size_bytes: size,
        contexts: parsed.contexts, current_context: parsed.current_context, clusters: parsed.clusters,
        auth_type: authType, active: p === activeKubeconfig,
      };
    });

    return { files, active_kubeconfig: activeKubeconfig, error: null };
  });

  // GET /api/kubeconfig-content?path=<abs-path>
  app.get<{ Querystring: { path?: string } }>('/api/kubeconfig-content', async (req, reply) => {
    const kcPath = req.query.path;
    const result: Record<string, any> = { path: kcPath, content: null, contexts: [], current_context: null, clusters: [], error: null };

    if (!kcPath) { result.error = 'Missing required query parameter: path'; reply.code(400); return result; }

    const abs = path.resolve(kcPath);
    result.path = abs;

    // Security: only allow paths inside approved directories
    const homeKube = path.resolve(os.homedir(), '.kube');
    const genDir = path.resolve(paths.GEN_DIR);
    const clustersDir = path.resolve(paths.CLUSTERS_DIR);
    const homeKubeCfg = path.resolve(homeKube, 'config');

    const allowed = abs === homeKubeCfg ||
      abs.startsWith(homeKube + path.sep) ||
      abs.startsWith(genDir + path.sep) ||
      abs.startsWith(clustersDir + path.sep);

    if (!allowed) {
      result.error = 'Path not permitted: must be inside ~/.kube/, generated/, or ~/Documents/clusters/';
      reply.code(403);
      return result;
    }

    if (!fs.existsSync(abs)) { result.error = `Path does not exist: ${abs}`; reply.code(404); return result; }
    if (!fs.statSync(abs).isFile()) { result.error = `Path is not a file: ${abs}`; reply.code(400); return result; }

    try {
      result.content = fs.readFileSync(abs, 'utf8');
      const parsed = parseKubeconfig(abs);
      result.contexts = parsed.contexts;
      result.current_context = parsed.current_context;
      result.clusters = parsed.clusters;
    } catch (e: any) {
      result.error = `Failed to read file: ${e.message}`;
      reply.code(500);
    }
    return result;
  });

  // POST /api/set-kubeconfig — switch active kubeconfig
  app.post<{ Body: { path: string } }>('/api/set-kubeconfig', async (req) => {
    const kcPath = req.body.path;
    if (!kcPath) return { success: false, path: null, error: "Missing 'path' in request body" };
    if (!path.isAbsolute(kcPath)) return { success: false, path: null, error: 'Path must be absolute' };
    if (!fs.existsSync(kcPath)) return { success: false, path: null, error: `File not found: ${kcPath}` };

    setActiveKubeconfig(kcPath);
    return { success: true, path: kcPath, error: null };
  });

  // POST /api/save-kubeconfig — save kubeconfig content to file
  app.post<{ Body: { content: string; name?: string; merge?: boolean; set_active?: boolean } }>(
    '/api/save-kubeconfig', async (req) => {
      const { content, name, merge, set_active } = req.body;
      const result: Record<string, any> = { success: false, path: null, auth_type: null, error: null };
      const kcContent = (content || '').trim();
      if (!kcContent) { result.error = "Missing 'content'"; return result; }

      let safeName = (name || 'kubeconfig-custom.yaml').replace(/[^a-zA-Z0-9._-]/g, '-');
      if (!safeName.endsWith('.yaml') && !safeName.endsWith('.yml')) safeName += '.yaml';

      // Detect auth type
      let authType = 'unknown';
      if (/^\s+token:/m.test(kcContent)) authType = 'token';
      else if (/^\s+exec:/m.test(kcContent)) authType = 'exec/oidc';
      else if (/client-certificate/.test(kcContent)) authType = 'certificate';
      result.auth_type = authType;

      try {
        if (merge) {
          // Merge into ~/.kube/config
          const kubeDir = path.join(os.homedir(), '.kube');
          fs.mkdirSync(kubeDir, { recursive: true });
          const tmpPath = path.join(kubeDir, '.kc-tmp-merge.yaml');
          fs.writeFileSync(tmpPath, kcContent, { mode: 0o600 });
          const defaultCfg = path.join(kubeDir, 'config');
          if (fs.existsSync(defaultCfg)) {
            const { execSync } = await import('node:child_process');
            const merged = execSync('kubectl config view --merge --flatten', {
              env: { ...process.env, KUBECONFIG: `${defaultCfg}:${tmpPath}` },
              stdio: ['pipe', 'pipe', 'pipe'],
            });
            fs.writeFileSync(defaultCfg, merged.toString(), { mode: 0o600 });
            result.path = defaultCfg;
          } else {
            fs.copyFileSync(tmpPath, defaultCfg);
            fs.chmodSync(defaultCfg, 0o600);
            result.path = defaultCfg;
          }
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } else {
          fs.mkdirSync(paths.GEN_DIR, { recursive: true });
          const savePath = path.join(paths.GEN_DIR, safeName);
          fs.writeFileSync(savePath, kcContent, { mode: 0o600 });
          result.path = savePath;
          if (set_active !== false) setActiveKubeconfig(savePath);
        }
        result.success = true;
      } catch (e: any) {
        result.error = e.message;
      }
      return result;
    }
  );

  // GET /api/download/kubeconfig
  app.get('/api/download/kubeconfig', async (_req, reply) => {
    const candidates = [paths.TOKEN_KUBECONFIG, paths.OIDC_KUBECONFIG, paths.OIDC_KUBECONFIG2];
    const kcFile = candidates.find(f => fs.existsSync(f));
    if (!kcFile) { reply.code(404); return 'No kubeconfig found'; }
    const content = fs.readFileSync(kcFile);
    reply.header('Content-Type', 'application/x-yaml');
    reply.header('Content-Disposition', 'attachment; filename="kubeconfig.yaml"');
    return reply.send(content);
  });

  // GET /api/list-kubeconfigs — scan generated/ and ~/Documents/clusters/ for kubeconfig files
  app.get('/api/list-kubeconfigs', async () => {
    const files: string[] = [];
    const scanDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      try {
        for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
          if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml') || entry.name === 'config')) {
            const fullPath = path.join(entry.parentPath || entry.path || dir, entry.name);
            // Quick check: does it look like a kubeconfig?
            try {
              const head = fs.readFileSync(fullPath, 'utf8').slice(0, 200);
              if (head.includes('clusters:') || head.includes('kubeconfig') || head.includes('apiVersion:')) {
                files.push(fullPath);
              }
            } catch {}
          }
        }
      } catch {}
    };
    scanDir(paths.GEN_DIR);
    scanDir(paths.CLUSTERS_DIR);
    return { files, error: null };
  });

  // GET /api/all-kubeconfigs — alias
  app.get('/api/all-kubeconfigs', async (_req, reply) => reply.redirect('/api/list-kubeconfigs'));

  // POST /api/switch-cluster — write kubeconfig YAML to temp file and activate it
  app.post<{ Body: { kubeconfig: string; clusterName: string } }>('/api/switch-cluster', async (req) => {
    const { kubeconfig: kubeconfigYaml, clusterName } = req.body;
    if (!kubeconfigYaml) return { success: false, error: 'Missing kubeconfig' };
    const safeName = (clusterName || 'cluster').replace(/[^a-z0-9-]/gi, '-');
    const tmpFile = path.join(os.tmpdir(), `kubeconfig-${safeName}.yaml`);
    try {
      fs.writeFileSync(tmpFile, kubeconfigYaml, { mode: 0o600 });
      setActiveKubeconfig(tmpFile);
      return { success: true, path: tmpFile, name: safeName };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // GET /api/cluster-info — return current active cluster name and API server
  app.get('/api/cluster-info', async () => {
    const kc = getKubeconfigPath();
    if (!kc || !fs.existsSync(kc)) return { name: null, apiServer: null, path: null };
    try {
      const content = fs.readFileSync(kc, 'utf8');
      const ctxMatch = content.match(/^current-context:\s*(\S+)/m);
      const serverMatch = content.match(/^\s+server:\s*(\S+)/m);
      return {
        name: ctxMatch?.[1] ?? null,
        apiServer: serverMatch?.[1] ?? null,
        path: kc,
      };
    } catch {
      return { name: null, apiServer: null, path: kc };
    }
  });
}
