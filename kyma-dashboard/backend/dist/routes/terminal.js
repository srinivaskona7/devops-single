import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getKubectlEnv, getKubeconfigPath, paths } from '../lib/kubectl.js';
export async function terminalRoutes(app) {
    // GET /run?action=X&arg=X — Server-Sent Events (SSE) streaming from manage.sh
    app.get('/run', async (req, reply) => {
        const action = req.query.action || '';
        const arg = req.query.arg || '';
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.setHeader('X-Accel-Buffering', 'no');
        const manageSh = path.join(paths.PROJECT_ROOT, 'manage.sh');
        const env = {
            ...process.env,
            TERM: 'xterm-color',
            FORCE_COLOR: '1',
            TF_FORCE_COLOR: '1',
            WEBUI_MODE: '1',
        };
        const kc = getKubeconfigPath();
        if (kc)
            env.KUBECONFIG = kc;
        let commandToRun;
        if (action === 'k8s' && arg) {
            const safeArg = arg.replace(/'/g, "'\\''").trim();
            let rawCmd = '';
            let isRaw = false;
            if (safeArg.startsWith('kubectl ')) {
                isRaw = true;
                rawCmd = safeArg;
            }
            else if (/^(get|describe|delete|logs|exec|apply|top|rollout|scale|create)\b/.test(safeArg)) {
                isRaw = true;
                rawCmd = `kubectl ${safeArg}`;
            }
            else if (/^helm\b/.test(safeArg) || /&&\s*helm\b/.test(safeArg)) {
                isRaw = true;
                rawCmd = safeArg;
            }
            if (isRaw) {
                const bashEval = `echo -e "\\033[36m→ ${rawCmd}\\033[0m\\n"; ${rawCmd}`;
                commandToRun = ['bash', '-c', bashEval];
            }
            else {
                // Natural language → translate_prompt
                const bashEval = `source ${manageSh} 2>/dev/null; cmd=$(translate_prompt '${safeArg}'); if [ -z "$cmd" ] || [[ "$cmd" == "#"* ]]; then echo "\\033[33m Could not map to a command. Try rephrasing or use: helm <cmd> / kubectl <cmd>.\\033[0m"; else echo -e "\\033[36m→ $cmd\\033[0m\\n"; eval "$cmd"; fi`;
                commandToRun = ['bash', '-c', bashEval];
            }
        }
        else {
            commandToRun = [manageSh];
            if (action)
                commandToRun.push(action);
        }
        const child = spawn(commandToRun[0], commandToRun.slice(1), {
            env, cwd: paths.PROJECT_ROOT, stdio: ['pipe', 'pipe', 'pipe'],
        });
        const sendSSE = (data) => {
            const lines = data.split('\n');
            for (const line of lines) {
                try {
                    reply.raw.write(`data: ${line}\n\n`);
                }
                catch { }
            }
        };
        child.stdout?.on('data', (chunk) => sendSSE(chunk.toString()));
        child.stderr?.on('data', (chunk) => sendSSE(chunk.toString()));
        child.on('close', () => {
            try {
                reply.raw.write('data: [DONE]\n\n');
                reply.raw.end();
            }
            catch { }
        });
        child.on('error', (e) => {
            try {
                reply.raw.write(`data: [Error] ${e.message}\n\n`);
                reply.raw.write('data: [DONE]\n\n');
                reply.raw.end();
            }
            catch { }
        });
        req.raw.on('close', () => { try {
            child.kill();
        }
        catch { } });
        // Prevent Fastify from sending its own response
        await new Promise(() => { }); // never resolves — SSE stream
    });
    // POST /api/execute — sync manage.sh command
    app.post('/api/execute', async (req) => {
        const command = req.body.command || '';
        const manageSh = path.join(paths.PROJECT_ROOT, 'manage.sh');
        const env = {
            ...process.env, TERM: 'xterm-color', FORCE_COLOR: '1', TF_FORCE_COLOR: '1', WEBUI_MODE: '1',
        };
        const kc = getKubeconfigPath();
        if (kc)
            env.KUBECONFIG = kc;
        try {
            const out = execSync(`${manageSh} ${command}`, {
                env, cwd: paths.PROJECT_ROOT, timeout: 300_000, stdio: ['pipe', 'pipe', 'pipe'],
            });
            return { success: true, output: out.toString(), error: null };
        }
        catch (e) {
            if (e.killed)
                return { success: false, output: '', error: 'Command timed out after 5 minutes' };
            return { success: false, output: e.stdout?.toString() || '', error: e.stderr?.toString() || e.message };
        }
    });
    // POST /api/exec-pod — kubectl exec in pod
    app.post('/api/exec-pod', async (req) => {
        const { namespace = 'default', pod, container, command } = req.body;
        if (!pod)
            return { output: '', error: 'Missing pod name' };
        // Build kubectl exec args — timeout MUST be before '--'
        const kubectlArgs = ['exec', '-n', namespace, '--request-timeout=15s', pod];
        if (container)
            kubectlArgs.push('-c', container);
        kubectlArgs.push('--');
        // Wrap complex commands in sh -c (pipes, spaces, env vars)
        const cmdStr = Array.isArray(command) ? command.join(' ') : command;
        if (/[|;&><$`]/.test(cmdStr)) {
            kubectlArgs.push('sh', '-c', cmdStr);
        }
        else {
            kubectlArgs.push(...cmdStr.split(' ').filter(Boolean));
        }
        try {
            const { execSync: exec } = await import('node:child_process');
            const env = getKubectlEnv();
            const out = exec(['kubectl', ...kubectlArgs].join(' '), {
                env, timeout: 15_000, maxBuffer: 10 * 1024 * 1024,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            return { output: out.toString() || '(no output)', error: null };
        }
        catch (e) {
            const stderr = e.stderr?.toString() || '';
            const stdout = e.stdout?.toString() || '';
            return { output: stdout || '', error: stderr || e.message || 'Command failed' };
        }
    });
    // POST /api/create-pod — create pod from JSON payload
    app.post('/api/create-pod', async (req) => {
        const { name, namespace = 'default', image, command: cmd, args: cmdArgs, env: envVars, labels, cpu_request, memory_request, cpu_limit, memory_limit, restart_policy = 'Never', image_pull_policy = 'IfNotPresent' } = req.body;
        const manifest = {
            apiVersion: 'v1', kind: 'Pod',
            metadata: { name, namespace },
            spec: { restartPolicy: restart_policy, containers: [{ name, image, imagePullPolicy: image_pull_policy }] },
        };
        if (labels)
            manifest.metadata.labels = labels;
        const containerSpec = manifest.spec.containers[0];
        if (cmd)
            containerSpec.command = cmd;
        if (cmdArgs)
            containerSpec.args = cmdArgs;
        if (envVars)
            containerSpec.env = Object.entries(envVars).map(([k, v]) => ({ name: k, value: v }));
        const resources = {};
        const requests = {};
        const limits = {};
        if (cpu_request)
            requests.cpu = cpu_request;
        if (memory_request)
            requests.memory = memory_request;
        if (cpu_limit)
            limits.cpu = cpu_limit;
        if (memory_limit)
            limits.memory = memory_limit;
        if (Object.keys(requests).length)
            resources.requests = requests;
        if (Object.keys(limits).length)
            resources.limits = limits;
        if (Object.keys(resources).length)
            containerSpec.resources = resources;
        try {
            const out = execSync('kubectl apply -f -', {
                input: JSON.stringify(manifest), env: getKubectlEnv(), timeout: 30_000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            return { success: true, output: out.toString().trim(), error: null };
        }
        catch (e) {
            return { success: false, output: '', error: e.stderr?.toString() || e.message };
        }
    });
    // POST /api/run-script — run arbitrary script, stream output via SSE
    app.post('/api/run-script', async (req, reply) => {
        const script = req.body.script || '';
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        const tmpFile = path.join(os.tmpdir(), `kyma-script-${Date.now()}.sh`);
        fs.writeFileSync(tmpFile, script, { mode: 0o755 });
        const env = { ...getKubectlEnv(), TERM: 'xterm-color', FORCE_COLOR: '1' };
        const child = spawn('bash', [tmpFile], { env, cwd: paths.PROJECT_ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
        child.stdout?.on('data', (chunk) => {
            for (const line of chunk.toString().split('\n')) {
                try {
                    reply.raw.write(`data: ${line}\n\n`);
                }
                catch { }
            }
        });
        child.stderr?.on('data', (chunk) => {
            for (const line of chunk.toString().split('\n')) {
                try {
                    reply.raw.write(`data: ${line}\n\n`);
                }
                catch { }
            }
        });
        child.on('close', () => {
            try {
                fs.unlinkSync(tmpFile);
            }
            catch { }
            try {
                reply.raw.write('data: [DONE]\n\n');
                reply.raw.end();
            }
            catch { }
        });
        child.on('error', (e) => {
            try {
                fs.unlinkSync(tmpFile);
            }
            catch { }
            try {
                reply.raw.write(`data: [Error] ${e.message}\n\n`);
                reply.raw.write('data: [DONE]\n\n');
                reply.raw.end();
            }
            catch { }
        });
        req.raw.on('close', () => { try {
            child.kill();
        }
        catch { } try {
            fs.unlinkSync(tmpFile);
        }
        catch { } });
        await new Promise(() => { });
    });
}
//# sourceMappingURL=terminal.js.map