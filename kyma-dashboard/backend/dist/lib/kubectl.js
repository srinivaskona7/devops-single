import { execSync, exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const execAsync = promisify(exec);
const _cache = new Map();
const _inflight = new Map();
export function kubectlCacheGet(key, ttlMs) {
    const e = _cache.get(key);
    if (e && Date.now() - e.ts < ttlMs)
        return e.data;
    return null;
}
export function kubectlCacheSet(key, data) {
    _cache.set(key, { data, ts: Date.now() });
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// __dirname = dashboard/backend/src/lib → repo root is 4 levels up
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const GEN_DIR = path.join(PROJECT_ROOT, 'generated');
const CLUSTERS_DIR = path.join(os.homedir(), 'Documents', 'clusters');
const TOKEN_KUBECONFIG = path.join(CLUSTERS_DIR, 'trail', 'kubeconfig-token.yaml');
const GEN_TOKEN_KUBECONFIG = path.join(GEN_DIR, 'kubeconfig-token.yaml');
const OIDC_KUBECONFIG = path.join(GEN_DIR, 'kubeconfig.yaml');
const OIDC_KUBECONFIG2 = path.join(GEN_DIR, 'kubeconfig.oidc.yaml');
let _activeKubeconfig = fs.existsSync(TOKEN_KUBECONFIG) ? TOKEN_KUBECONFIG
    : fs.existsSync(GEN_TOKEN_KUBECONFIG) ? GEN_TOKEN_KUBECONFIG
        : null;
// ── Exports ──────────────────────────────────────────────────────────────
export const paths = {
    PROJECT_ROOT, GEN_DIR, CLUSTERS_DIR,
    TOKEN_KUBECONFIG, GEN_TOKEN_KUBECONFIG, OIDC_KUBECONFIG, OIDC_KUBECONFIG2,
};
export function getActiveKubeconfig() { return _activeKubeconfig; }
export function setActiveKubeconfig(p) { _activeKubeconfig = p; }
export function getKubeconfigPath() {
    if (_activeKubeconfig && fs.existsSync(_activeKubeconfig))
        return _activeKubeconfig;
    if (fs.existsSync(TOKEN_KUBECONFIG))
        return TOKEN_KUBECONFIG;
    if (fs.existsSync(GEN_TOKEN_KUBECONFIG))
        return GEN_TOKEN_KUBECONFIG;
    if (fs.existsSync(OIDC_KUBECONFIG))
        return OIDC_KUBECONFIG;
    if (fs.existsSync(OIDC_KUBECONFIG2))
        return OIDC_KUBECONFIG2;
    return process.env.KUBECONFIG || '';
}
export function getKubectlEnv() {
    const env = { ...process.env };
    // Bypass proxy for: Kyma/SAP domains + common Helm chart registries
    const bypass = [
        'localhost,127.0.0.1,::1',
        '*.kyma.ondemand.com,*.hana.ondemand.com,*.sap.com,*.btp.cloud.sap,accounts.sap.com',
        // Helm chart registries
        'charts.jetstack.io,charts.bitnami.com,registry-1.docker.io',
        'ghcr.io,*.github.io,*.github.com',
        'kedacore.github.io,prometheus-community.github.io,grafana.github.io',
        'open-telemetry.github.io,jaegertracing.github.io,kyverno.github.io',
        'open-policy-agent.github.io,charts.helm.sh',
    ].join(',');
    for (const k of ['NO_PROXY', 'no_proxy']) {
        const existing = env[k] || '';
        // Rebuild to include chart registries (existing might only have SAP domains)
        const existing_clean = existing.split(',').filter(d => !bypass.split(',').includes(d.trim())).filter(Boolean).join(',');
        env[k] = existing_clean ? `${bypass},${existing_clean}` : bypass;
    }
    const kc = getKubeconfigPath();
    if (kc)
        env.KUBECONFIG = kc;
    return env;
}
/** Run kubectl with -o json and parse result. Synchronous. */
export function kubectlJson(args, timeoutMs = 15_000) {
    try {
        const cmd = ['kubectl', ...args, '-o', 'json', '--request-timeout=10s'].join(' ');
        const out = execSync(cmd, { env: getKubectlEnv(), timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
        return { data: JSON.parse(out.toString()), error: null, notFound: false };
    }
    catch (e) {
        const stderr = e.stderr?.toString() || e.message || '';
        const notFound = /not found|no kind|not recognized|no matches for kind|unable to recognize|does not exist|couldn't find/i.test(stderr);
        return { data: null, error: notFound ? null : stderr.slice(0, 300), notFound };
    }
}
/** Run kubectl with -o json and parse result. Async — does NOT block event loop.
 *  Deduplicates concurrent identical calls (returns same Promise). */
export async function kubectlJsonAsync(args, timeoutMs = 15_000, cacheTtlMs = 0) {
    const cacheKey = args.join(' ');
    // TTL cache hit
    if (cacheTtlMs > 0) {
        const cached = kubectlCacheGet(cacheKey, cacheTtlMs);
        if (cached !== null)
            return cached;
    }
    // Deduplicate in-flight identical calls
    if (_inflight.has(cacheKey))
        return _inflight.get(cacheKey);
    const cmd = ['kubectl', ...args, '-o', 'json', '--request-timeout=10s'].join(' ');
    const promise = execAsync(cmd, {
        env: getKubectlEnv(), timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024,
    })
        .then(({ stdout }) => {
        const result = { data: JSON.parse(stdout), error: null, notFound: false };
        if (cacheTtlMs > 0)
            kubectlCacheSet(cacheKey, result);
        return result;
    })
        .catch((e) => {
        const stderr = e.stderr?.toString() || e.message || '';
        const notFound = /not found|no kind|not recognized|no matches for kind|unable to recognize|does not exist|couldn't find/i.test(stderr);
        return { data: null, error: notFound ? null : stderr.slice(0, 300), notFound };
    })
        .finally(() => _inflight.delete(cacheKey));
    _inflight.set(cacheKey, promise);
    return promise;
}
/** Run kubectl and return raw stdout. Async — does NOT block event loop. */
export async function kubectlRawAsync(args, timeoutMs = 30_000) {
    const cmd = ['kubectl', ...args, '--request-timeout=10s'].join(' ');
    try {
        const { stdout, stderr } = await execAsync(cmd, { env: getKubectlEnv(), timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024 });
        return { stdout, stderr, ok: true };
    }
    catch (e) {
        return { stdout: e.stdout || '', stderr: e.stderr?.toString() || e.message || '', ok: false };
    }
}
/** Run kubectl and return raw stdout. Synchronous. */
export function kubectlRaw(args, timeoutMs = 30_000) {
    try {
        const cmd = ['kubectl', ...args, '--request-timeout=10s'].join(' ');
        const out = execSync(cmd, { env: getKubectlEnv(), timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
        return { stdout: out.toString(), stderr: '', ok: true };
    }
    catch (e) {
        return { stdout: e.stdout?.toString() || '', stderr: e.stderr?.toString() || e.message || '', ok: false };
    }
}
/** Run kubectl with full control: returns { stdout, stderr, returncode }. */
export function kubectlExec(args, timeoutMs = 20_000, input) {
    try {
        const out = execSync(['kubectl', ...args].join(' '), {
            env: getKubectlEnv(), timeout: timeoutMs,
            stdio: ['pipe', 'pipe', 'pipe'],
            input: input,
        });
        return { stdout: out.toString(), stderr: '', returncode: 0 };
    }
    catch (e) {
        return { stdout: e.stdout?.toString() || '', stderr: e.stderr?.toString() || e.message || '', returncode: e.status ?? 1 };
    }
}
/** Spawn a streaming child process. */
export function spawnStream(command, args, extraEnv, cwd) {
    return spawn(command, args, {
        env: { ...getKubectlEnv(), ...extraEnv },
        cwd: cwd || PROJECT_ROOT,
        stdio: ['pipe', 'pipe', 'pipe'],
    });
}
/** Convert ISO timestamp to human-readable age string. */
export function calcAge(ts) {
    if (!ts)
        return '';
    try {
        const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
        if (secs < 0)
            return '0s';
        if (secs < 60)
            return `${secs}s`;
        if (secs < 3600)
            return `${Math.floor(secs / 60)}m`;
        if (secs < 86400)
            return `${Math.floor(secs / 3600)}h`;
        return `${Math.floor(secs / 86400)}d`;
    }
    catch {
        return '';
    }
}
/** Find btp CLI in PATH or known locations. */
export function findBtp() {
    const extra = [
        path.join(os.homedir(), 'bin'),
        path.join(os.homedir(), '.local', 'bin'),
        '/usr/local/bin', '/opt/homebrew/bin', '/usr/bin',
    ];
    for (const d of extra) {
        const candidate = path.join(d, 'btp');
        if (fs.existsSync(candidate))
            return candidate;
    }
    return 'btp';
}
//# sourceMappingURL=kubectl.js.map