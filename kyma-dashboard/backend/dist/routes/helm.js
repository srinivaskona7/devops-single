import { execSync, exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getKubectlEnv } from '../lib/kubectl.js';
const execAsync = promisify(exec);
// Filter helm/kubectl stderr noise
function filterHelmStderr(stderr) {
    return stderr.split('\n')
        .filter(l => !/Use tokens from the TokenRequest API|auto-generated secret-based tokens/i.test(l))
        .join('\n')
        .trim();
}
export async function helmRoutes(app) {
    // GET /api/helm-releases?namespace=<ns>
    app.get('/api/helm-releases', async (req) => {
        const ns = req.query.namespace || 'default';
        const result = { items: [], error: null };
        try {
            const args = ns === '-all-' ? ['-A'] : ['-n', ns];
            const out = execSync(`helm list ${args.join(' ')} -o json`, {
                env: getKubectlEnv(), timeout: 20_000, stdio: ['pipe', 'pipe', 'pipe'],
            });
            const releases = JSON.parse(out.toString()) || [];
            result.items = releases.map((r) => ({
                name: r.name || '', namespace: r.namespace || '',
                chart: r.chart || '', version: r.app_version || '',
                status: r.status || '', updated: r.updated || '',
            }));
        }
        catch (e) {
            result.error = e.stderr?.toString() || e.message || 'helm list failed';
        }
        return result;
    });
    // GET /api/helm-charts — curated chart catalog
    app.get('/api/helm-charts', async () => {
        return {
            charts: [
                { name: 'nginx', repo: 'bitnami', chart: 'bitnami/nginx', description: 'NGINX web server' },
                { name: 'cert-manager', repo: 'jetstack', chart: 'jetstack/cert-manager', description: 'TLS certificate management' },
                { name: 'prometheus', repo: 'prometheus-community', chart: 'prometheus-community/prometheus', description: 'Monitoring & alerting toolkit' },
                { name: 'redis', repo: 'bitnami', chart: 'bitnami/redis', description: 'In-memory data store' },
                { name: 'grafana', repo: 'grafana', chart: 'grafana/grafana', description: 'Observability dashboards' },
                { name: 'ingress-nginx', repo: 'ingress-nginx', chart: 'ingress-nginx/ingress-nginx', description: 'NGINX Ingress Controller' },
            ],
            error: null,
        };
    });
    // POST /api/helm-install
    app.post('/api/helm-install', async (req, reply) => {
        const { chart, releaseName, namespace, version, values } = req.body;
        if (!chart || !releaseName || !namespace) {
            return reply.code(400).send({ error: 'chart, releaseName, namespace required' });
        }
        reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        let valuesFile = null;
        try {
            const args = ['install', releaseName, chart, '-n', namespace, '--create-namespace'];
            if (version)
                args.push('--version', version);
            // Support both YAML string values and key=value object values
            if (values && typeof values === 'string' && values.trim()) {
                valuesFile = join(tmpdir(), `helm-values-${Date.now()}.yaml`);
                writeFileSync(valuesFile, values);
                args.push('-f', valuesFile);
            }
            else if (values && typeof values === 'object') {
                const setArgs = Object.entries(values).map(([k, v]) => `--set ${k}=${v}`).join(' ');
                if (setArgs)
                    args.push(...setArgs.split(' '));
            }
            reply.raw.write(`data: $ helm ${args.join(' ')}\n\n`);
            const out = execSync(`helm ${args.join(' ')}`, {
                env: getKubectlEnv(), timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'],
            });
            const lines = out.toString().split('\n');
            for (const line of lines) {
                reply.raw.write(`data: ${line}\n\n`);
            }
            reply.raw.write(`data: \n\n`);
        }
        catch (e) {
            const errLines = (e.stderr?.toString() || e.message || 'helm install failed').split('\n');
            for (const line of errLines) {
                reply.raw.write(`data: ERROR: ${line}\n\n`);
            }
        }
        finally {
            if (valuesFile) {
                try {
                    unlinkSync(valuesFile);
                }
                catch { }
            }
            reply.raw.end();
        }
    });
    // POST /api/helm-upgrade
    app.post('/api/helm-upgrade', async (req) => {
        const { releaseName, namespace, chart, version, values } = req.body;
        if (!releaseName || !namespace)
            return { output: '', error: 'releaseName and namespace required' };
        const result = { output: '', error: null };
        let valuesFile = null;
        try {
            const args = ['upgrade', releaseName, chart || releaseName, '-n', namespace];
            if (version)
                args.push('--version', version);
            // values can be YAML string or object — write to temp file
            if (values) {
                const yamlContent = typeof values === 'string' ? values : Object.entries(values).map(([k, v]) => `${k}: ${v}`).join('\n');
                valuesFile = join(tmpdir(), `helm-values-${Date.now()}.yaml`);
                writeFileSync(valuesFile, yamlContent, 'utf8');
                args.push('-f', valuesFile);
            }
            const out = execSync(`helm ${args.join(' ')}`, {
                env: getKubectlEnv(), timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'],
            });
            result.output = out.toString();
        }
        catch (e) {
            result.error = filterHelmStderr(e.stderr?.toString() || e.message);
        }
        finally {
            if (valuesFile) {
                try {
                    unlinkSync(valuesFile);
                }
                catch { }
            }
        }
        return result;
    });
    // POST /api/helm-rollback
    app.post('/api/helm-rollback', async (req, reply) => {
        const { releaseName, namespace, revision } = req.body;
        if (!releaseName || !namespace) {
            return reply.code(400).send({ error: 'releaseName and namespace required' });
        }
        const result = { output: '', error: null };
        try {
            const args = ['rollback', releaseName, '-n', namespace];
            if (revision)
                args.push(String(revision));
            const out = execSync(`helm ${args.join(' ')}`, {
                env: getKubectlEnv(), timeout: 60_000, stdio: ['pipe', 'pipe', 'pipe'],
            });
            result.output = out.toString();
        }
        catch (e) {
            result.error = filterHelmStderr(e.stderr?.toString() || e.message);
        }
        return result;
    });
    // POST /api/helm-uninstall
    app.post('/api/helm-uninstall', async (req, reply) => {
        const { releaseName, namespace } = req.body;
        if (!releaseName || !namespace) {
            return reply.code(400).send({ error: 'releaseName and namespace required' });
        }
        const result = { output: '', error: null };
        try {
            const out = execSync(`helm uninstall ${releaseName} -n ${namespace}`, {
                env: getKubectlEnv(), timeout: 60_000, stdio: ['pipe', 'pipe', 'pipe'],
            });
            result.output = out.toString();
        }
        catch (e) {
            result.error = filterHelmStderr(e.stderr?.toString() || e.message);
        }
        return result;
    });
    // GET /api/helm-repo/list — list all added repos
    app.get('/api/helm-repo/list', async () => {
        try {
            const out = execSync('helm repo list -o json', {
                env: getKubectlEnv(), timeout: 15_000, stdio: ['pipe', 'pipe', 'pipe'],
            });
            const repos = JSON.parse(out.toString()) || [];
            return { repos: repos.map((r) => ({ name: r.name, url: r.url })), error: null };
        }
        catch (e) {
            const msg = e.stderr?.toString() || e.message || '';
            if (msg.includes('no repositories') || msg.includes('Error: no repo')) {
                return { repos: [], error: null };
            }
            return { repos: [], error: msg };
        }
    });
    // POST /api/helm-repo/add — add a registry
    app.post('/api/helm-repo/add', async (req) => {
        const { name, url } = req.body;
        if (!name || !url)
            return { success: false, error: 'name and url required' };
        try {
            const out = execSync(`helm repo add ${name} ${url}`, {
                env: getKubectlEnv(), timeout: 30_000, maxBuffer: 5 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
            });
            return { success: true, output: out.toString(), error: null };
        }
        catch (e) {
            return { success: false, output: '', error: e.stderr?.toString() || e.message };
        }
    });
    // POST /api/helm-repo/remove — remove a registry
    app.post('/api/helm-repo/remove', async (req) => {
        const { name } = req.body;
        if (!name)
            return { success: false, error: 'name required' };
        try {
            execSync(`helm repo remove ${name}`, {
                env: getKubectlEnv(), timeout: 15_000, stdio: ['pipe', 'pipe', 'pipe'],
            });
            return { success: true, error: null };
        }
        catch (e) {
            return { success: false, error: e.stderr?.toString() || e.message };
        }
    });
    // POST /api/helm-repo/update — update all repos
    app.post('/api/helm-repo/update', async () => {
        try {
            const out = execSync('helm repo update', {
                env: getKubectlEnv(), timeout: 60_000, maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
            });
            return { success: true, output: out.toString(), error: null };
        }
        catch (e) {
            return { success: false, output: e.stdout?.toString() || '', error: e.stderr?.toString() || e.message };
        }
    });
    // GET /api/helm-search?query=X&repo=X — search charts across repos
    app.get('/api/helm-search', async (req) => {
        const query = req.query.query || '';
        const repo = req.query.repo || '';
        if (!query && !repo)
            return { charts: [], error: 'query required' };
        try {
            const searchTerm = repo ? `${repo}/${query}` : query;
            const out = execSync(`helm search repo ${searchTerm} -o json --devel`, {
                env: getKubectlEnv(), timeout: 30_000, maxBuffer: 20 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
            });
            const results = JSON.parse(out.toString()) || [];
            return {
                charts: results.map((c) => ({
                    name: c.name || '',
                    version: c.version || '',
                    appVersion: c.app_version || '',
                    description: c.description || '',
                    repo: c.name?.split('/')[0] || '',
                    chart: c.name?.split('/')[1] || '',
                })),
                error: null,
            };
        }
        catch (e) {
            return { charts: [], error: e.stderr?.toString() || e.message };
        }
    });
    // GET /api/helm-chart-versions?chart=X — get all versions of a chart
    app.get('/api/helm-chart-versions', async (req) => {
        const chart = req.query.chart || '';
        if (!chart)
            return { versions: [], error: 'chart required' };
        try {
            const out = execSync(`helm search repo ${chart} --versions -o json --devel`, {
                env: getKubectlEnv(), timeout: 30_000, maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
            });
            const results = JSON.parse(out.toString()) || [];
            return { versions: results.map((r) => r.version).filter(Boolean), error: null };
        }
        catch (e) {
            return { versions: [], error: e.stderr?.toString() || e.message };
        }
    });
    // GET /api/helm-detail?release=X&namespace=Y — full release detail
    app.get('/api/helm-detail', async (req) => {
        const release = req.query.release || '';
        const namespace = req.query.namespace || 'default';
        if (!release)
            return { error: 'release query param required' };
        const env = getKubectlEnv();
        const execOpts = { env, timeout: 30_000, maxBuffer: 10 * 1024 * 1024 };
        const [valuesResult, manifestResult, statusResult, historyResult] = await Promise.allSettled([
            execAsync(`helm get values ${release} -n ${namespace}`, execOpts),
            execAsync(`helm get manifest ${release} -n ${namespace}`, execOpts),
            execAsync(`helm status ${release} -n ${namespace} --output json`, execOpts),
            execAsync(`helm history ${release} -n ${namespace} --output json`, execOpts),
        ]);
        // Extract values YAML
        const values = valuesResult.status === 'fulfilled'
            ? valuesResult.value.stdout
            : '';
        // Extract raw manifest and parse resources
        const manifest = manifestResult.status === 'fulfilled'
            ? manifestResult.value.stdout
            : '';
        const resources = [];
        if (manifest) {
            const docs = manifest.split(/^---$/m);
            for (const doc of docs) {
                const trimmed = doc.trim();
                if (!trimmed)
                    continue;
                const kindMatch = trimmed.match(/^kind:\s*(\S+)/m);
                const apiMatch = trimmed.match(/^apiVersion:\s*(\S+)/m);
                const nameMatch = trimmed.match(/^metadata:\s*\n\s+name:\s*(\S+)/m);
                const nsMatch = trimmed.match(/^metadata:[\s\S]*?\n\s+namespace:\s*(\S+)/m);
                if (kindMatch) {
                    resources.push({
                        kind: kindMatch[1],
                        name: nameMatch ? nameMatch[1] : '',
                        namespace: nsMatch ? nsMatch[1] : namespace,
                        apiVersion: apiMatch ? apiMatch[1] : '',
                    });
                }
            }
        }
        // Extract notes from status JSON
        let notes = '';
        if (statusResult.status === 'fulfilled') {
            try {
                const statusJson = JSON.parse(statusResult.value.stdout);
                notes = statusJson.info?.notes || statusJson.notes || '';
            }
            catch { }
        }
        // Extract history array
        let history = [];
        if (historyResult.status === 'fulfilled') {
            try {
                history = JSON.parse(historyResult.value.stdout) || [];
            }
            catch { }
        }
        // Collect errors from failed commands
        const errors = [];
        if (valuesResult.status === 'rejected')
            errors.push(filterHelmStderr(valuesResult.reason?.stderr || valuesResult.reason?.message));
        if (manifestResult.status === 'rejected')
            errors.push(filterHelmStderr(manifestResult.reason?.stderr || manifestResult.reason?.message));
        if (statusResult.status === 'rejected')
            errors.push(filterHelmStderr(statusResult.reason?.stderr || statusResult.reason?.message));
        if (historyResult.status === 'rejected')
            errors.push(filterHelmStderr(historyResult.reason?.stderr || historyResult.reason?.message));
        return {
            name: release,
            namespace,
            values,
            manifest,
            resources,
            notes,
            history,
            error: errors.length > 0 ? errors.join('; ') : null,
        };
    });
    // GET /api/helm-history?release=X&namespace=Y — release revision history
    app.get('/api/helm-history', async (req) => {
        const release = req.query.release || '';
        const namespace = req.query.namespace || 'default';
        if (!release)
            return { items: [], error: 'release query param required' };
        try {
            const { stdout } = await execAsync(`helm history ${release} -n ${namespace} --output json`, {
                env: getKubectlEnv(), timeout: 30_000, maxBuffer: 10 * 1024 * 1024,
            });
            const items = JSON.parse(stdout) || [];
            return { items, error: null };
        }
        catch (e) {
            return { items: [], error: filterHelmStderr(e.stderr || e.message) };
        }
    });
}
//# sourceMappingURL=helm.js.map