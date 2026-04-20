const { Server } = require('ws');
const { Client } = require('ssh2');
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PORT = process.env.PORT || 3456;
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg']);

const fileCache = new Map();
const MAX_CACHE_SIZE = 50 * 1024 * 1024;
let cacheSize = 0;

function getCachedFile(filePath) {
  if (fileCache.has(filePath)) {
    const entry = fileCache.get(filePath);
    const stat = fs.statSync(filePath, { throwIfNoEntry: false });
    if (stat && stat.mtimeMs === entry.mtime) return entry;
    fileCache.delete(filePath);
    cacheSize -= entry.raw.length;
  }
  try {
    const stat = fs.statSync(filePath);
    const raw = fs.readFileSync(filePath);
    const etag = crypto.createHash('md5').update(raw).digest('hex').substring(0, 16);
    const ext = path.extname(filePath);
    let gzipped = null;
    if (COMPRESSIBLE.has(ext) && raw.length > 1024) {
      gzipped = zlib.gzipSync(raw, { level: 6 });
    }
    const entry = { raw, gzipped, etag, mtime: stat.mtimeMs, mime: MIME[ext] || 'application/octet-stream' };
    if (cacheSize + raw.length < MAX_CACHE_SIZE) {
      fileCache.set(filePath, entry);
      cacheSize += raw.length;
    }
    return entry;
  } catch { return null; }
}

const httpServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: '2.0.0', uptime: process.uptime() | 0, connections: wss.clients.size }));
    return;
  }

  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(STATIC_DIR, urlPath);
  if (!filePath.startsWith(STATIC_DIR)) { res.writeHead(403); res.end(); return; }

  const entry = getCachedFile(filePath);
  if (!entry) { res.writeHead(404); res.end('Not Found'); return; }

  if (req.headers['if-none-match'] === entry.etag) {
    res.writeHead(304);
    res.end();
    return;
  }

  const headers = {
    'Content-Type': entry.mime,
    'ETag': entry.etag,
    'Cache-Control': 'no-cache',
    'Vary': 'Accept-Encoding',
  };

  const acceptGzip = (req.headers['accept-encoding'] || '').includes('gzip');
  if (entry.gzipped && acceptGzip) {
    headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = entry.gzipped.length;
    res.writeHead(200, headers);
    res.end(entry.gzipped);
  } else {
    headers['Content-Length'] = entry.raw.length;
    res.writeHead(200, headers);
    res.end(entry.raw);
  }
});

const wss = new Server({
  server: httpServer,
  perMessageDeflate: false,
  maxPayload: 10 * 1024 * 1024,
});

const PING_INTERVAL = 30000;
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws._isAlive === false) { ws.terminate(); return; }
    ws._isAlive = false;
    ws.ping();
  });
}, PING_INTERVAL);

wss.on('connection', (ws) => {
  ws._isAlive = true;
  ws.on('pong', () => { ws._isAlive = true; });

  let sshClient = null;
  let sshStream = null;
  let sftpSession = null;
  let sftpPending = null;

  const send = (msg) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  };

  const getSftp = () => {
    if (sftpSession) return Promise.resolve(sftpSession);
    if (sftpPending) return sftpPending;
    sftpPending = new Promise((resolve, reject) => {
      sshClient.sftp((err, sftp) => {
        sftpPending = null;
        if (err) return reject(err);
        sftpSession = sftp;
        resolve(sftp);
      });
    });
    return sftpPending;
  };

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'auth') {
      sshClient = new Client();
      const config = {
        host: msg.host,
        port: msg.port || 22,
        username: msg.username,
        readyTimeout: 10000,
      };
      if (msg.privateKey) {
        config.privateKey = msg.privateKey;
        if (msg.passphrase) config.passphrase = msg.passphrase;
      } else {
        config.password = msg.password;
      }

      sshClient.on('ready', () => {
        sshClient.exec('echo $HOME', (execErr, stream) => {
          let homePath = msg.username === 'root' ? '/root' : `/home/${msg.username}`;
          if (!execErr) {
            let output = '';
            stream.on('data', (data) => { output += data.toString(); });
            stream.on('close', () => {
              const detected = output.trim();
              if (detected && detected.startsWith('/')) homePath = detected;
              send({ type: 'auth:success', home: homePath });
            });
          } else {
            send({ type: 'auth:success', home: homePath });
          }
        });
        sshClient.shell(
          { term: 'xterm-256color', cols: msg.cols || 80, rows: msg.rows || 24 },
          (err, stream) => {
            if (err) return send({ type: 'terminal:error', message: err.message });
            sshStream = stream;
            stream.on('data', (data) => send({ type: 'terminal', data: data.toString('base64') }));
            stream.stderr.on('data', (data) => send({ type: 'terminal', data: data.toString('base64') }));
            stream.on('close', () => send({ type: 'terminal:close' }));
          }
        );
      });

      sshClient.on('error', (err) => {
        send({ type: 'auth:error', message: err.message });
      });

      sshClient.on('end', () => {
        send({ type: 'disconnected' });
      });

      sshClient.connect(config);
      return;
    }

    if (msg.type === 'terminal' && sshStream) {
      sshStream.write(Buffer.from(msg.data, 'base64'));
      return;
    }

    if (msg.type === 'terminal:resize' && sshStream) {
      sshStream.setWindow(msg.rows, msg.cols, 0, 0);
      return;
    }

    if (msg.type === 'devops:detect') {
      const cmd = `bash -c 'OS_ID="unknown"; PKG="unknown"; SHELL_RC=""; HAS_SUDO="false"; if [ -f /etc/os-release ]; then . /etc/os-release; OS_ID="$ID"; fi; if command -v apt-get >/dev/null 2>&1; then PKG="apt"; elif command -v dnf >/dev/null 2>&1; then PKG="dnf"; elif command -v yum >/dev/null 2>&1; then PKG="yum"; elif command -v apk >/dev/null 2>&1; then PKG="apk"; elif command -v brew >/dev/null 2>&1; then PKG="brew"; OS_ID="macos"; fi; if [ -f "$HOME/.zshrc" ]; then SHELL_RC=".zshrc"; elif [ -f "$HOME/.bashrc" ]; then SHELL_RC=".bashrc"; elif [ -f "$HOME/.bash_profile" ]; then SHELL_RC=".bash_profile"; fi; if [ "$(id -u)" = "0" ] || sudo -n true 2>/dev/null; then HAS_SUDO="true"; fi; ARCH=$(uname -m | sed "s/x86_64/amd64/;s/aarch64/arm64/"); echo "$OS_ID|$PKG|$SHELL_RC|$HAS_SUDO|$ARCH"'`;
      sshClient.exec(cmd, (execErr, stream) => {
        if (execErr) return send({ type: 'devops:detect', id: msg.id, error: execErr.message });
        let output = '';
        stream.on('data', (d) => { output += d.toString(); });
        stream.stderr.on('data', () => {});
        stream.on('close', () => {
          const p = output.trim().split('|');
          send({ type: 'devops:detect', id: msg.id, osId: p[0] || 'unknown', pkgManager: p[1] || 'unknown', shellRc: p[2] || '', hasSudo: p[3] === 'true', arch: p[4] || 'amd64' });
        });
      });
      return;
    }

    if (msg.type === 'devops:detect-tool') {
      sshClient.exec(msg.command, (execErr, stream) => {
        if (execErr) return send({ type: 'devops:detect-tool', id: msg.id, tool: msg.tool, installed: false, version: '' });
        let output = '';
        stream.on('data', (d) => { output += d.toString(); });
        stream.stderr.on('data', (d) => { output += d.toString(); });
        stream.on('close', (code) => {
          send({ type: 'devops:detect-tool', id: msg.id, tool: msg.tool, installed: code === 0 && output.trim().length > 0, version: output.trim() });
        });
      });
      return;
    }

    if (msg.type === 'devops:exec') {
      const execId = msg.execId;
      sshClient.exec(msg.script, { pty: true }, (execErr, stream) => {
        if (execErr) {
          send({ type: 'devops:output', execId, data: `Error: ${execErr.message}\n` });
          send({ type: 'devops:done', execId, code: 1, tool: msg.tool });
          return;
        }
        stream.on('data', (data) => send({ type: 'devops:output', execId, data: data.toString() }));
        stream.stderr.on('data', (data) => send({ type: 'devops:output', execId, data: data.toString() }));
        stream.on('close', (code) => send({ type: 'devops:done', execId, code: code || 0, tool: msg.tool }));
      });
      return;
    }

    if (msg.type === 'exec') {
      sshClient.exec(msg.command, (execErr, stream) => {
        if (execErr) return send({ type: 'exec:result', id: msg.id, error: execErr.message, code: 1 });
        let stdout = '', stderr = '';
        stream.on('data', (d) => { stdout += d.toString(); });
        stream.stderr.on('data', (d) => { stderr += d.toString(); });
        stream.on('close', (code) => send({ type: 'exec:result', id: msg.id, stdout, stderr, code: code || 0 }));
      });
      return;
    }

    if (msg.type === 'exec:stream') {
      const execId = msg.execId || ('stream-' + Date.now());
      sshClient.exec(msg.command, { pty: !!msg.pty }, (execErr, stream) => {
        if (execErr) {
          send({ type: 'exec:stream:data', execId, data: `Error: ${execErr.message}\n` });
          send({ type: 'exec:stream:done', execId, code: 1 });
          return;
        }
        stream.on('data', (d) => send({ type: 'exec:stream:data', execId, data: d.toString() }));
        stream.stderr.on('data', (d) => send({ type: 'exec:stream:data', execId, data: d.toString() }));
        stream.on('close', (code) => send({ type: 'exec:stream:done', execId, code: code || 0 }));
      });
      return;
    }

    if (msg.type === 'fs:upload') {
      try {
        const sftp = await getSftp();
        const buf = Buffer.from(msg.content, 'base64');
        const ws = sftp.createWriteStream(msg.path);
        ws.end(buf, () => send({ type: 'fs:upload:success', path: msg.path, size: buf.length, id: msg.id }));
        ws.on('error', (err) => send({ type: 'fs:error', message: err.message, id: msg.id }));
      } catch (err) {
        send({ type: 'fs:error', message: err.message, id: msg.id });
      }
      return;
    }

    if (msg.type === 'fs:download') {
      try {
        const sftp = await getSftp();
        const chunks = [];
        const rs = sftp.createReadStream(msg.path);
        rs.on('data', (c) => chunks.push(c));
        rs.on('end', () => {
          const b64 = Buffer.concat(chunks).toString('base64');
          send({ type: 'fs:download', content: b64, path: msg.path, name: msg.path.split('/').pop(), id: msg.id });
        });
        rs.on('error', (err) => send({ type: 'fs:error', message: err.message, id: msg.id }));
      } catch (err) {
        send({ type: 'fs:error', message: err.message, id: msg.id });
      }
      return;
    }

    if (msg.type === 'terminal:new') {
      sshClient.shell(
        { term: 'xterm-256color', cols: msg.cols || 80, rows: msg.rows || 24 },
        (err, stream) => {
          if (err) return send({ type: 'terminal:error', message: err.message, id: msg.id });
          const tid = msg.termId;
          stream.on('data', (data) => send({ type: 'terminal:data', termId: tid, data: data.toString('base64') }));
          stream.stderr.on('data', (data) => send({ type: 'terminal:data', termId: tid, data: data.toString('base64') }));
          stream.on('close', () => send({ type: 'terminal:closed', termId: tid }));
          if (!ws._extraTerminals) ws._extraTerminals = {};
          ws._extraTerminals[tid] = stream;
          send({ type: 'terminal:new:success', termId: tid, id: msg.id });
        }
      );
      return;
    }

    if (msg.type === 'terminal:write' && ws._extraTerminals && ws._extraTerminals[msg.termId]) {
      ws._extraTerminals[msg.termId].write(Buffer.from(msg.data, 'base64'));
      return;
    }

    if (msg.type === 'terminal:resize:extra' && ws._extraTerminals && ws._extraTerminals[msg.termId]) {
      ws._extraTerminals[msg.termId].setWindow(msg.rows, msg.cols, 0, 0);
      return;
    }

    if (msg.type === 'terminal:close:extra' && ws._extraTerminals && ws._extraTerminals[msg.termId]) {
      ws._extraTerminals[msg.termId].end();
      delete ws._extraTerminals[msg.termId];
      return;
    }

    if (msg.type === 'search') {
      const escapedPath = msg.path.replace(/'/g, "'\\''");
      const escapedQuery = msg.query.replace(/'/g, "'\\''");
      const flags = msg.caseSensitive ? '' : '-i';
      const cmd = `grep -rn ${flags} --include='*' -l '${escapedQuery}' '${escapedPath}' 2>/dev/null | head -50`;
      sshClient.exec(cmd, (execErr, stream) => {
        if (execErr) return send({ type: 'search:error', message: execErr.message, id: msg.id });
        let output = '';
        stream.on('data', (d) => { output += d.toString(); });
        stream.stderr.on('data', () => {});
        stream.on('close', () => {
          const files = output.trim().split('\n').filter(Boolean);
          if (files.length === 0) return send({ type: 'search:results', results: [], id: msg.id });
          let pending = files.length;
          const results = [];
          files.forEach((file) => {
            const escapedFile = file.replace(/'/g, "'\\''");
            const lineCmd = `grep -n ${flags} '${escapedQuery}' '${escapedFile}' 2>/dev/null | head -10`;
            sshClient.exec(lineCmd, (err2, stream2) => {
              if (err2) { if (--pending === 0) send({ type: 'search:results', results, id: msg.id }); return; }
              let lineOut = '';
              stream2.on('data', (d) => { lineOut += d.toString(); });
              stream2.on('close', () => {
                const lines = lineOut.trim().split('\n').filter(Boolean).map((l) => {
                  const sep = l.indexOf(':');
                  return { line: parseInt(l.substring(0, sep)), text: l.substring(sep + 1) };
                });
                if (lines.length > 0) results.push({ file, matches: lines });
                if (--pending === 0) send({ type: 'search:results', results, id: msg.id });
              });
            });
          });
        });
      });
      return;
    }

    if (msg.type.startsWith('fs:')) {
      try {
        const sftp = await getSftp();
        switch (msg.type) {
          case 'fs:list': {
            sftp.readdir(msg.path, (err, list) => {
              if (err) return send({ type: 'fs:error', message: err.message, id: msg.id });
              const entries = list
                .filter((item) => !item.filename.startsWith('.') || msg.showHidden)
                .map((item) => ({
                  name: item.filename,
                  path: msg.path.replace(/\/$/, '') + '/' + item.filename,
                  type: item.attrs.isDirectory() ? 'directory' : 'file',
                  size: item.attrs.size,
                  modified: item.attrs.mtime * 1000,
                }))
                .sort((a, b) => {
                  if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                  return a.name.localeCompare(b.name);
                });
              send({ type: 'fs:list', entries, path: msg.path, id: msg.id });
            });
            break;
          }
          case 'fs:read': {
            const chunks = [];
            const stream = sftp.createReadStream(msg.path);
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => {
              const content = Buffer.concat(chunks).toString('utf-8');
              send({ type: 'fs:read', content, path: msg.path, id: msg.id });
            });
            stream.on('error', (err) =>
              send({ type: 'fs:error', message: err.message, id: msg.id })
            );
            break;
          }
          case 'fs:write': {
            const writeStream = sftp.createWriteStream(msg.path);
            writeStream.end(msg.content, 'utf-8', () => {
              send({ type: 'fs:write:success', path: msg.path, id: msg.id });
            });
            writeStream.on('error', (err) =>
              send({ type: 'fs:error', message: err.message, id: msg.id })
            );
            break;
          }
          case 'fs:mkdir': {
            sftp.mkdir(msg.path, (err) => {
              if (err) return send({ type: 'fs:error', message: err.message, id: msg.id });
              send({ type: 'fs:mkdir:success', path: msg.path, id: msg.id });
            });
            break;
          }
          case 'fs:delete': {
            sftp.stat(msg.path, (err, stats) => {
              if (err) return send({ type: 'fs:error', message: err.message, id: msg.id });
              if (stats.isDirectory()) {
                const escapedPath = msg.path.replace(/'/g, "'\\''");
                sshClient.exec(`rm -rf '${escapedPath}'`, (execErr, stream) => {
                  if (execErr) return send({ type: 'fs:error', message: execErr.message, id: msg.id });
                  let stderr = '';
                  stream.stderr.on('data', (d) => { stderr += d.toString(); });
                  stream.on('close', (code) => {
                    if (code !== 0) return send({ type: 'fs:error', message: stderr || 'Delete failed', id: msg.id });
                    send({ type: 'fs:delete:success', path: msg.path, id: msg.id });
                  });
                });
              } else {
                sftp.unlink(msg.path, (err2) => {
                  if (err2) return send({ type: 'fs:error', message: err2.message, id: msg.id });
                  send({ type: 'fs:delete:success', path: msg.path, id: msg.id });
                });
              }
            });
            break;
          }
          case 'fs:rename': {
            sftp.rename(msg.oldPath, msg.newPath, (err) => {
              if (err) return send({ type: 'fs:error', message: err.message, id: msg.id });
              send({ type: 'fs:rename:success', oldPath: msg.oldPath, newPath: msg.newPath, id: msg.id });
            });
            break;
          }
          case 'fs:stat': {
            sftp.stat(msg.path, (err, stats) => {
              if (err) return send({ type: 'fs:error', message: err.message, id: msg.id });
              send({
                type: 'fs:stat',
                path: msg.path,
                isDirectory: stats.isDirectory(),
                size: stats.size,
                modified: stats.mtime * 1000,
                id: msg.id,
              });
            });
            break;
          }
        }
      } catch (err) {
        send({ type: 'fs:error', message: err.message, id: msg.id });
      }
    }
  });

  ws.on('close', () => {
    if (ws._extraTerminals) Object.values(ws._extraTerminals).forEach((s) => s.end());
    if (sshStream) sshStream.end();
    if (sshClient) sshClient.end();
    sftpSession = null;
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Cloud IDE Proxy listening on http://0.0.0.0:${PORT}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
});

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`Port ${PORT} already in use`);
  else console.error('Server error:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
  gracefulShutdown();
});

function gracefulShutdown() {
  console.log('Shutting down gracefully...');
  wss.clients.forEach((ws) => {
    try { ws.close(1001, 'Server shutting down'); } catch {}
  });
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
