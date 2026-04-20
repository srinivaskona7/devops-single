import { execSync, exec, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);

// ── TTL cache: prevents duplicate concurrent kubectl calls ────────────────
interface CacheEntry { data: any; ts: number }
const _cache = new Map<string, CacheEntry>();
const _inflight = new Map<string, Promise<any>>();

export function kubectlCacheGet(key: string, ttlMs: number): any | null {
  const e = _cache.get(key);
  if (e && Date.now() - e.ts < ttlMs) return e.data;
  return null;
}
export function kubectlCacheSet(key: string, data: any): void {
  _cache.set(key, { data, ts: Date.now() });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Dev:       __dirname = dashboard/backend/src/lib → 4 levels up = btp-terraform root
// Container: __dirname = /app/dist/lib → 4 levels up = / (wrong!)
// Fix: override via GEN_DIR env var in Docker/K8s (set GEN_DIR=/app/generated)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const GEN_DIR = process.env.GEN_DIR
  ? path.resolve(process.env.GEN_DIR)
  : path.join(PROJECT_ROOT, 'generated');
const CLUSTERS_DIR = path.join(os.homedir(), 'Documents', 'clusters');
const TOKEN_KUBECONFIG = path.join(CLUSTERS_DIR, 'trail', 'kubeconfig-token.yaml');
const GEN_TOKEN_KUBECONFIG = path.join(GEN_DIR, 'kubeconfig-token.yaml');
const OIDC_KUBECONFIG = path.join(GEN_DIR, 'kubeconfig.yaml');
const OIDC_KUBECONFIG2 = path.join(GEN_DIR, 'kubeconfig.oidc.yaml');

let _activeKubeconfig: string | null =
  fs.existsSync(TOKEN_KUBECONFIG) ? TOKEN_KUBECONFIG
  : fs.existsSync(GEN_TOKEN_KUBECONFIG) ? GEN_TOKEN_KUBECONFIG
  : null;

// ── Exports ──────────────────────────────────────────────────────────────

export const paths = {
  PROJECT_ROOT, GEN_DIR, CLUSTERS_DIR,
  TOKEN_KUBECONFIG, GEN_TOKEN_KUBECONFIG, OIDC_KUBECONFIG, OIDC_KUBECONFIG2,
} as const;

export function getActiveKubeconfig(): string | null { return _activeKubeconfig; }
export function setActiveKubeconfig(p: string | null): void {
  _activeKubeconfig = p;
  _envCache = null; // invalidate memoized env
}

export function getKubeconfigPath(): string {
  if (_activeKubeconfig && fs.existsSync(_activeKubeconfig)) return _activeKubeconfig;
  if (fs.existsSync(TOKEN_KUBECONFIG)) return TOKEN_KUBECONFIG;
  if (fs.existsSync(GEN_TOKEN_KUBECONFIG)) return GEN_TOKEN_KUBECONFIG;
  if (fs.existsSync(OIDC_KUBECONFIG)) return OIDC_KUBECONFIG;
  if (fs.existsSync(OIDC_KUBECONFIG2)) return OIDC_KUBECONFIG2;
  return process.env.KUBECONFIG || '';
}

// Memoized NO_PROXY bypass string — computed once (static list, never changes)
const _NO_PROXY_BYPASS = [
  'localhost,127.0.0.1,::1',
  '*.kyma.ondemand.com,*.hana.ondemand.com,*.sap.com,*.btp.cloud.sap,accounts.sap.com',
  'charts.jetstack.io,charts.bitnami.com,registry-1.docker.io',
  'ghcr.io,*.github.io,*.github.com',
  'kedacore.github.io,prometheus-community.github.io,grafana.github.io',
  'open-telemetry.github.io,jaegertracing.github.io,kyverno.github.io',
  'open-policy-agent.github.io,charts.helm.sh',
].join(',');

// Cache the env object; invalidated when kubeconfig changes
let _envCache: NodeJS.ProcessEnv | null = null;
let _envCacheKubeconfig: string | null = null;

export function getKubectlEnv(): NodeJS.ProcessEnv {
  const kc = getKubeconfigPath();
  // Return cached env if kubeconfig hasn't changed
  if (_envCache && _envCacheKubeconfig === kc) return _envCache;

  const env: NodeJS.ProcessEnv = { ...process.env };
  const bypassSet = new Set(_NO_PROXY_BYPASS.split(','));

  for (const k of ['NO_PROXY', 'no_proxy'] as const) {
    const existing = env[k] || '';
    // Merge: keep any extra user-defined entries, skip duplicates
    const extra = existing.split(',').filter(d => d.trim() && !bypassSet.has(d.trim())).join(',');
    env[k] = extra ? `${_NO_PROXY_BYPASS},${extra}` : _NO_PROXY_BYPASS;
  }
  if (kc) env.KUBECONFIG = kc;

  _envCache = env;
  _envCacheKubeconfig = kc;
  return env;
}

/** Run kubectl with -o json and parse result. Synchronous. */
export function kubectlJson<T = any>(
  args: string[], timeoutMs = 15_000,
): { data: T | null; error: string | null; notFound: boolean } {
  try {
    const cmd = ['kubectl', ...args, '-o', 'json', '--request-timeout=10s'].join(' ');
    const out = execSync(cmd, { env: getKubectlEnv(), timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
    return { data: JSON.parse(out.toString()) as T, error: null, notFound: false };
  } catch (e: any) {
    const stderr: string = e.stderr?.toString() || e.message || '';
    const notFound = /not found|no kind|not recognized|no matches for kind|unable to recognize|does not exist|couldn't find/i.test(stderr);
    return { data: null, error: notFound ? null : stderr.slice(0, 300), notFound };
  }
}

/** Run kubectl with -o json and parse result. Async — does NOT block event loop.
 *  Deduplicates concurrent identical calls (returns same Promise). */
export async function kubectlJsonAsync<T = any>(
  args: string[], timeoutMs = 15_000, cacheTtlMs = 0,
): Promise<{ data: T | null; error: string | null; notFound: boolean }> {
  // Use JSON array as cache key — unambiguous, no collision between arg boundaries
  const cacheKey = JSON.stringify(args);

  // TTL cache hit
  if (cacheTtlMs > 0) {
    const cached = kubectlCacheGet(cacheKey, cacheTtlMs);
    if (cached !== null) return cached;
  }

  // Deduplicate in-flight identical calls
  if (_inflight.has(cacheKey)) return _inflight.get(cacheKey)!;

  const cmd = ['kubectl', ...args, '-o', 'json', '--request-timeout=10s'].join(' ');
  const promise = execAsync(cmd, {
    env: getKubectlEnv(), timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024,
  })
    .then(({ stdout }) => {
      const result = { data: JSON.parse(stdout) as T, error: null, notFound: false };
      if (cacheTtlMs > 0) kubectlCacheSet(cacheKey, result);
      return result;
    })
    .catch((e: any) => {
      const stderr: string = e.stderr?.toString() || e.message || '';
      const notFound = /not found|no kind|not recognized|no matches for kind|unable to recognize|does not exist|couldn't find/i.test(stderr);
      return { data: null as T | null, error: notFound ? null : stderr.slice(0, 300), notFound };
    })
    .finally(() => _inflight.delete(cacheKey));

  _inflight.set(cacheKey, promise);
  return promise;
}

/** Run kubectl and return raw stdout. Async — does NOT block event loop. */
export async function kubectlRawAsync(
  args: string[], timeoutMs = 30_000,
): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  const cmd = ['kubectl', ...args, '--request-timeout=10s'].join(' ');
  try {
    const { stdout, stderr } = await execAsync(cmd, { env: getKubectlEnv(), timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024 });
    return { stdout, stderr, ok: true };
  } catch (e: any) {
    return { stdout: e.stdout || '', stderr: e.stderr?.toString() || e.message || '', ok: false };
  }
}

/** Run kubectl and return raw stdout. Synchronous. */
export function kubectlRaw(args: string[], timeoutMs = 30_000): { stdout: string; stderr: string; ok: boolean } {
  try {
    const cmd = ['kubectl', ...args, '--request-timeout=10s'].join(' ');
    const out = execSync(cmd, { env: getKubectlEnv(), timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
    return { stdout: out.toString(), stderr: '', ok: true };
  } catch (e: any) {
    return { stdout: e.stdout?.toString() || '', stderr: e.stderr?.toString() || e.message || '', ok: false };
  }
}

/** Run kubectl with full control: returns { stdout, stderr, returncode }. */
export function kubectlExec(
  args: string[], timeoutMs = 20_000, input?: string,
): { stdout: string; stderr: string; returncode: number } {
  try {
    const out = execSync(['kubectl', ...args].join(' '), {
      env: getKubectlEnv(), timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
      input: input,
    });
    return { stdout: out.toString(), stderr: '', returncode: 0 };
  } catch (e: any) {
    return { stdout: e.stdout?.toString() || '', stderr: e.stderr?.toString() || e.message || '', returncode: e.status ?? 1 };
  }
}

/** Spawn a streaming child process. */
export function spawnStream(command: string, args: string[], extraEnv?: NodeJS.ProcessEnv, cwd?: string): ChildProcess {
  return spawn(command, args, {
    env: { ...getKubectlEnv(), ...extraEnv },
    cwd: cwd || PROJECT_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/** Convert ISO timestamp to human-readable age string. */
export function calcAge(ts?: string | null): string {
  if (!ts) return '';
  try {
    const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (secs < 0) return '0s';
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
    return `${Math.floor(secs / 86400)}d`;
  } catch { return ''; }
}

/** Find btp CLI in PATH or known locations. */
export function findBtp(): string {
  const extra = [
    path.join(os.homedir(), 'bin'),
    path.join(os.homedir(), '.local', 'bin'),
    '/usr/local/bin', '/opt/homebrew/bin', '/usr/bin',
  ];
  for (const d of extra) {
    const candidate = path.join(d, 'btp');
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'btp';
}
