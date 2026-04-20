import { kubectlJson, kubectlExec } from '../lib/kubectl.js';
export async function moduleRoutes(app) {
    // POST /api/toggle-module — enable/disable Kyma module
    app.post('/api/toggle-module', async (req) => {
        const { module, action, channel } = req.body;
        if (!module || !action) {
            return { error: 'module and action (enable/disable) required' };
        }
        const kymaResult = kubectlJson(['get', 'kyma', 'default', '-n', 'kyma-system']);
        if (!kymaResult.data) {
            return { error: kymaResult.error || 'Failed to read Kyma CR' };
        }
        const kyma = kymaResult.data;
        const modules = kyma.spec?.modules || [];
        if (action === 'enable') {
            const exists = modules.find((m) => m.name === module);
            if (!exists) {
                modules.push({ name: module, channel: channel || 'regular' });
            }
        }
        else {
            const idx = modules.findIndex((m) => m.name === module);
            if (idx >= 0)
                modules.splice(idx, 1);
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
    });
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
        const kyma = kymaResult.data;
        const existing = kyma.spec?.modules || [];
        const existingNames = new Set(existing.map((m) => m.name));
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
//# sourceMappingURL=modules.js.map