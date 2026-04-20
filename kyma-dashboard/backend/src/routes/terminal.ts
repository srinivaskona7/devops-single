import { FastifyInstance } from 'fastify';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getKubectlEnv, getKubeconfigPath, paths } from '../lib/kubectl.js';

// ── Message protocol (frontend ↔ backend) ────────────────────────────────────
// Browser → Backend:
//   { type: 'input',  data: '<keystrokes>' }
//   { type: 'resize', cols: N, rows: N }
//   { type: 'ping' }
// Backend → Browser:
//   { type: 'output', data: '<terminal output>' }
//   { type: 'exit',   code: N }
//   { type: 'error',  message: '...' }
//   { type: 'pong' }


export async function terminalRoutes(app: FastifyInstance): Promise<void> {

  // GET /run?action=X&arg=X — Server-Sent Events (SSE) streaming from manage.sh
  app.get<{ Querystring: { action?: string; arg?: string } }>('/run', async (req, reply) => {
    const action = req.query.action || '';
    const arg = req.query.arg || '';

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');

    const manageSh = path.join(paths.PROJECT_ROOT, 'manage.sh');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TERM: 'xterm-color',
      FORCE_COLOR: '1',
      TF_FORCE_COLOR: '1',
      WEBUI_MODE: '1',
    };
    const kc = getKubeconfigPath();
    if (kc) env.KUBECONFIG = kc;

    let commandToRun: string[];

    if (action === 'k8s' && arg) {
      const safeArg = arg.replace(/'/g, "'\\''").trim();
      let rawCmd = '';
      let isRaw = false;

      if (safeArg.startsWith('kubectl ')) {
        isRaw = true; rawCmd = safeArg;
      } else if (/^(get|describe|delete|logs|exec|apply|top|rollout|scale|create)\b/.test(safeArg)) {
        isRaw = true; rawCmd = `kubectl ${safeArg}`;
      } else if (/^helm\b/.test(safeArg) || /&&\s*helm\b/.test(safeArg)) {
        isRaw = true; rawCmd = safeArg;
      }

      if (isRaw) {
        const bashEval = `echo -e "\\033[36m→ ${rawCmd}\\033[0m\\n"; ${rawCmd}`;
        commandToRun = ['bash', '-c', bashEval];
      } else {
        // Natural language → translate_prompt
        const bashEval = `source ${manageSh} 2>/dev/null; cmd=$(translate_prompt '${safeArg}'); if [ -z "$cmd" ] || [[ "$cmd" == "#"* ]]; then echo "\\033[33m Could not map to a command. Try rephrasing or use: helm <cmd> / kubectl <cmd>.\\033[0m"; else echo -e "\\033[36m→ $cmd\\033[0m\\n"; eval "$cmd"; fi`;
        commandToRun = ['bash', '-c', bashEval];
      }
    } else {
      commandToRun = [manageSh];
      if (action) commandToRun.push(action);
    }

    const child = spawn(commandToRun[0], commandToRun.slice(1), {
      env, cwd: paths.PROJECT_ROOT, stdio: ['pipe', 'pipe', 'pipe'],
    });

    const sendSSE = (data: string) => {
      const lines = data.split('\n');
      for (const line of lines) {
        try { reply.raw.write(`data: ${line}\n\n`); } catch {}
      }
    };

    child.stdout?.on('data', (chunk: Buffer) => sendSSE(chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => sendSSE(chunk.toString()));
    child.on('close', () => {
      try {
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
      } catch {}
    });
    child.on('error', (e) => {
      try {
        reply.raw.write(`data: [Error] ${e.message}\n\n`);
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
      } catch {}
    });

    req.raw.on('close', () => { try { child.kill(); } catch {} });
    // Prevent Fastify from sending its own response
    await new Promise(() => {}); // never resolves — SSE stream
  });

  // POST /api/execute — sync manage.sh command
  app.post<{ Body: { command: string } }>('/api/execute', async (req) => {
    const command = req.body.command || '';
    const manageSh = path.join(paths.PROJECT_ROOT, 'manage.sh');
    const env: NodeJS.ProcessEnv = {
      ...process.env, TERM: 'xterm-color', FORCE_COLOR: '1', TF_FORCE_COLOR: '1', WEBUI_MODE: '1',
    };
    const kc = getKubeconfigPath();
    if (kc) env.KUBECONFIG = kc;

    // SECURITY: Validate command against allowlist to prevent injection
    const ALLOWED_ACTIONS = [
      'status', 'deploy', 'destroy', 'plan', 'apply', 'health',
      'kyma-status', 'logs', 'info', 'version', 'help',
    ];
    const action = command.split(/\s+/)[0] || '';
    if (action && !ALLOWED_ACTIONS.includes(action)) {
      return { success: false, output: '', error: `Action "${action}" is not allowed. Valid: ${ALLOWED_ACTIONS.join(', ')}` };
    }

    try {
      // Use spawn array form to prevent shell injection — never interpolate user input into a shell string
      const args = command ? command.split(/\s+/).filter(Boolean) : [];
      const escapedArgs = args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
      const out = execSync(`bash -c "source ${manageSh} && ${escapedArgs}"`, {
        env, cwd: paths.PROJECT_ROOT, timeout: 300_000, stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output: out.toString(), error: null };
    } catch (e: unknown) {
      const err = e as { killed?: boolean; stdout?: Buffer; stderr?: Buffer; message?: string };
      if (err.killed) return { success: false, output: '', error: 'Command timed out after 5 minutes' };
      return { success: false, output: err.stdout?.toString() || '', error: err.stderr?.toString() || err.message || 'Unknown error' };
    }
  });

  // POST /api/exec-pod — kubectl exec in pod
  app.post<{ Body: { namespace?: string; pod: string; container?: string; command: string[] | string } }>(
    '/api/exec-pod', async (req) => {
      const { namespace = 'default', pod, container, command } = req.body;
      if (!pod) return { output: '', error: 'Missing pod name' };

      // Build kubectl exec args — timeout MUST be before '--'
      const kubectlArgs = ['exec', '-n', namespace, '--request-timeout=15s', pod];
      if (container) kubectlArgs.push('-c', container);
      kubectlArgs.push('--');

      // Wrap complex commands in sh -c (pipes, spaces, env vars)
      const cmdStr = Array.isArray(command) ? command.join(' ') : command;
      if (/[|;&><$`]/.test(cmdStr)) {
        kubectlArgs.push('sh', '-c', cmdStr);
      } else {
        kubectlArgs.push(...cmdStr.split(' ').filter(Boolean));
      }

      try {
        const env = getKubectlEnv();
        const out = execSync(['kubectl', ...kubectlArgs].join(' '), {
          env, timeout: 15_000, maxBuffer: 10 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { output: out.toString() || '(no output)', error: null };
      } catch (e: unknown) {
        const err = e as { stderr?: Buffer; stdout?: Buffer; message?: string };
        const stderr = err.stderr?.toString() || '';
        const stdout = err.stdout?.toString() || '';
        return { output: stdout || '', error: stderr || err.message || 'Command failed' };
      }
    }
  );

  // POST /api/create-pod — create pod from JSON payload
  app.post<{ Body: Record<string, unknown> }>('/api/create-pod', async (req) => {
    const body = req.body as Record<string, unknown>;
    const { name, image, command: cmd, args: cmdArgs, env: envVars,
      labels, cpu_request, memory_request, cpu_limit, memory_limit,
      restart_policy = 'Never', image_pull_policy = 'IfNotPresent' } = body;
    const namespace = (body.namespace as string) || 'default';

    // Input validation
    if (!name || typeof name !== 'string') return { success: false, output: '', error: 'Missing pod name' };
    if (!image || typeof image !== 'string') return { success: false, output: '', error: 'Missing image' };
    // Validate name format (RFC 1123)
    if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(name as string)) {
      return { success: false, output: '', error: 'Pod name must be a valid RFC 1123 label' };
    }

    const manifest: Record<string, unknown> = {
      apiVersion: 'v1', kind: 'Pod',
      metadata: { name, namespace },
      spec: { restartPolicy: restart_policy, containers: [{ name, image, imagePullPolicy: image_pull_policy }] },
    };
    if (labels) manifest.metadata.labels = labels;
    const containerSpec = manifest.spec.containers[0];
    if (cmd) containerSpec.command = cmd;
    if (cmdArgs) containerSpec.args = cmdArgs;
    if (envVars && typeof envVars === 'object') containerSpec.env = Object.entries(envVars as Record<string, string>).map(([k, v]) => ({ name: k, value: v }));

    const resources: Record<string, Record<string, string>> = {};
    const requests: Record<string, string> = {};
    const limits: Record<string, string> = {};
    if (cpu_request) requests.cpu = cpu_request;
    if (memory_request) requests.memory = memory_request;
    if (cpu_limit) limits.cpu = cpu_limit;
    if (memory_limit) limits.memory = memory_limit;
    if (Object.keys(requests).length) resources.requests = requests;
    if (Object.keys(limits).length) resources.limits = limits;
    if (Object.keys(resources).length) containerSpec.resources = resources;

    try {
      const out = execSync('kubectl apply -f -', {
        input: JSON.stringify(manifest), env: getKubectlEnv(), timeout: 30_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output: out.toString().trim(), error: null };
    } catch (e: unknown) {
      const err = e as { stderr?: Buffer; message?: string };
      return { success: false, output: '', error: err.stderr?.toString() || err.message || 'Unknown error' };
    }
  });

  // POST /api/run-script — run arbitrary script, stream output via SSE
  app.post<{ Body: { script: string } }>('/api/run-script', async (req, reply) => {
    const script = req.body.script || '';

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    const tmpFile = path.join(os.tmpdir(), `kyma-script-${Date.now()}.sh`);
    fs.writeFileSync(tmpFile, script, { mode: 0o755 });

    const env: NodeJS.ProcessEnv = { ...getKubectlEnv(), TERM: 'xterm-color', FORCE_COLOR: '1' };
    const child = spawn('bash', [tmpFile], { env, cwd: paths.PROJECT_ROOT, stdio: ['pipe', 'pipe', 'pipe'] });

    child.stdout?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) {
        try { reply.raw.write(`data: ${line}\n\n`); } catch {}
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) {
        try { reply.raw.write(`data: ${line}\n\n`); } catch {}
      }
    });
    child.on('close', () => {
      try { fs.unlinkSync(tmpFile); } catch {}
      try { reply.raw.write('data: [DONE]\n\n'); reply.raw.end(); } catch {}
    });
    child.on('error', (e) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      try { reply.raw.write(`data: [Error] ${e.message}\n\n`); reply.raw.write('data: [DONE]\n\n'); reply.raw.end(); } catch {}
    });

    req.raw.on('close', () => { try { child.kill(); } catch {} try { fs.unlinkSync(tmpFile); } catch {} });
    await new Promise(() => {});
  });

  // ── WebSocket /ws/exec — interactive pod terminal ─────────────────────────
  // Query params: ?namespace=X&pod=Y&container=Z&shell=/bin/sh
  app.get('/ws/exec', { websocket: true }, (connection, req) => {
    const socket = connection.socket;
    const params = new URLSearchParams((req.url || '').split('?')[1] || '');
    const namespace  = params.get('namespace')  || 'default';
    const pod        = params.get('pod')         || '';
    const container  = params.get('container')   || '';
    const shell      = params.get('shell')       || '/bin/sh';

    const send = (obj: Record<string, unknown>) => {
      try { socket.send(JSON.stringify(obj)); } catch {}
    };

    if (!pod) {
      send({ type: 'error', message: 'Missing pod name' });
      socket.close();
      return;
    }

    // Build kubectl exec args — -i for stdin piping
    const args = ['exec', '-i', '-n', namespace, pod];
    if (container) args.push('-c', container);
    args.push('--', shell);

    const env: NodeJS.ProcessEnv = {
      ...getKubectlEnv(),
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    };

    const child = spawn('kubectl', args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // kubectl stdout → browser
    child.stdout?.on('data', (chunk: Buffer) => {
      send({ type: 'output', data: chunk.toString('base64'), encoding: 'base64' });
    });
    // kubectl stderr → browser (show errors inline)
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      // Filter noisy kubectl warnings
      if (!/Use tokens from the TokenRequest API/i.test(text)) {
        send({ type: 'output', data: Buffer.from(text).toString('base64'), encoding: 'base64' });
      }
    });
    child.on('close', (code) => {
      send({ type: 'exit', code: code ?? 0 });
      try { socket.close(); } catch {}
    });
    child.on('error', (e) => {
      send({ type: 'error', message: e.message });
      try { socket.close(); } catch {}
    });

    // Browser → kubectl stdin
    socket.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'input' && msg.data) {
          child.stdin?.write(msg.data);
        } else if (msg.type === 'resize') {
          // Send terminal resize via SIGWINCH is not straightforward with kubectl exec -i
          // Instead, send stty resize command to shell
          const cols = msg.cols || 80;
          const rows = msg.rows || 24;
          child.stdin?.write(`stty cols ${cols} rows ${rows}\n`);
        } else if (msg.type === 'ping') {
          send({ type: 'pong' });
        }
      } catch {}
    });

    socket.on('close', () => {
      try { child.stdin?.end(); } catch {}
      try { child.kill('SIGTERM'); } catch {}
    });

    socket.on('error', () => {
      try { child.kill('SIGTERM'); } catch {}
    });
  });

  // ── WebSocket /ws/shell — generic kubectl shell (no pod) ──────────────────
  // Opens a bash shell on the backend machine with kubectl + helm available
  app.get('/ws/shell', { websocket: true }, (connection, _req) => {
    const socket = connection.socket;
    const send = (obj: Record<string, unknown>) => {
      try { socket.send(JSON.stringify(obj)); } catch {}
    };

    const env: NodeJS.ProcessEnv = {
      ...getKubectlEnv(),
      TERM: 'xterm-256color',
      PS1: '\\[\\033[1;32m\\]kyma\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]$ ',
    };

    const child = spawn('bash', ['--norc', '--noprofile'], {
      env,
      cwd: paths.PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (c: Buffer) => send({ type: 'output', data: c.toString('base64'), encoding: 'base64' }));
    child.stderr?.on('data', (c: Buffer) => send({ type: 'output', data: c.toString('base64'), encoding: 'base64' }));
    child.on('close', (code) => { send({ type: 'exit', code: code ?? 0 }); try { socket.close(); } catch {} });
    child.on('error', (e) => { send({ type: 'error', message: e.message }); try { socket.close(); } catch {} });

    socket.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'input') child.stdin?.write(msg.data);
        else if (msg.type === 'ping') send({ type: 'pong' });
      } catch {}
    });
    socket.on('close', () => { try { child.stdin?.end(); child.kill(); } catch {} });
  });
}
