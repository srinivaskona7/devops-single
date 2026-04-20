import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import staticFiles from '@fastify/static';
import websocket from '@fastify/websocket';
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

import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: 'https://keycloak.c-8bd426f.kyma.ondemand.com/auth/realms/kyma/protocol/openid-connect/certs',
  cache: true,
  cacheMaxEntries: 10,
  cacheMaxAge: 10 * 60 * 1000, // 10 min — reuse keys, reduce JWKS roundtrips
  timeout: 5000,               // fail fast if Keycloak unreachable
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key?.getPublicKey();
    if (!signingKey) return callback(new Error(`No public key found for kid: ${header.kid}`));
    callback(null, signingKey);
  });
}

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

// WebSocket support (for pod exec terminal)
await app.register(websocket);

// Cookie + Session
await app.register(cookie);
await app.register(session, {
  secret: SESSION_SECRET,
  cookie: { secure: false, httpOnly: true, maxAge: 86400000 * 7 },
  saveUninitialized: false,
});

// Serve built frontend from dist/
const frontendDist = fs.existsSync('/app/frontend/dist')
  ? '/app/frontend/dist'                                     // Docker container
  : path.resolve(__dirname, '../../frontend/dist');           // Local dev
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
    } else {
      reply.code(404).send({ error: 'Not found' });
    }
  });
}

// JWT Verification Middleware
app.addHook('preHandler', async (request, reply) => {
  if (request.url.startsWith('/api')) {
    // DEV bypass: set DEV_SKIP_AUTH=true to skip JWT verification (testing only)
    if (process.env.DEV_SKIP_AUTH === 'true') {
      (request as any).user = { sub: 'dev-user', email: 'dev@test.com' };
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
      await new Promise((resolve, reject) => {
        // Hard timeout: if JWKS fetch stalls, don't hold the request forever
        const timeout = setTimeout(() => reject(new Error('JWT verification timed out')), 8_000);
        jwt.verify(token, getKey, {
          issuer: 'https://keycloak.c-8bd426f.kyma.ondemand.com/auth/realms/kyma',
          audience: 'account',
        }, (err, decoded) => {
          clearTimeout(timeout);
          if (err) return reject(err);
          (request as any).user = decoded;
          resolve(decoded);
        });
      });
    } catch (err: any) {
      app.log.error(`JWT Verification failed: ${err.message}`);
      return reply.code(401).send({ error: `Unauthorized: ${err.message}` });
    }
  }
});

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
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
