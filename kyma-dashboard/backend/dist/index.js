import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import staticFiles from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { clusterRoutes } from './routes/cluster.js';
import { namespaceRoutes } from './routes/namespaces.js';
import { workloadRoutes } from './routes/workloads.js';
import { networkRoutes } from './routes/network.js';
import { storageRoutes } from './routes/storage.js';
import { configRoutes } from './routes/config.js';
import { helmRoutes } from './routes/helm.js';
import { istioRoutes } from './routes/istio.js';
import { kymaRoutes } from './routes/kyma.js';
import { terminalRoutes } from './routes/terminal.js';
import { authRoutes } from './routes/auth.js';
import { kubeconfigRoutes } from './routes/kubeconfig.js';
import { moduleRoutes } from './routes/modules.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '8100', 10);
const SESSION_SECRET = process.env.SESSION_SECRET || 'btp-kyma-manager-secret-key-32ch!!';
const app = Fastify({
    logger: {
        level: process.env.LOG_LEVEL || 'info',
        transport: process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
            : undefined,
    },
});
// CORS
await app.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
});
// Cookie + Session
await app.register(cookie);
await app.register(session, {
    secret: SESSION_SECRET,
    cookie: { secure: false, httpOnly: true, maxAge: 86400000 * 7 },
    saveUninitialized: false,
});
// Serve built frontend from dist/
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
    await app.register(staticFiles, {
        root: frontendDist,
        prefix: '/',
        decorateReply: false,
    });
    // SPA fallback: all non-API routes → index.html
    app.setNotFoundHandler((_req, reply) => {
        const indexHtml = path.join(frontendDist, 'index.html');
        if (fs.existsSync(indexHtml)) {
            reply.type('text/html').send(fs.readFileSync(indexHtml));
        }
        else {
            reply.code(404).send({ error: 'Not found' });
        }
    });
}
// Register route modules
await app.register(clusterRoutes);
await app.register(namespaceRoutes);
await app.register(workloadRoutes);
await app.register(networkRoutes);
await app.register(storageRoutes);
await app.register(configRoutes);
await app.register(helmRoutes);
await app.register(istioRoutes);
await app.register(kymaRoutes);
await app.register(terminalRoutes);
await app.register(authRoutes);
await app.register(kubeconfigRoutes);
await app.register(moduleRoutes);
// Start
try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`BTP Kyma Manager backend running on http://localhost:${PORT}`);
}
catch (err) {
    app.log.error(err);
    process.exit(1);
}
//# sourceMappingURL=index.js.map