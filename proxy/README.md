# Cloud IDE Proxy

Lightweight WebSocket-to-SSH bridge. Run this on any server to connect the browser IDE to SSH.

## Quick Start

```bash
npm install
node server.js
```

The proxy starts on `ws://localhost:3456` by default.

## Configuration

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `PORT` | `3456` | WebSocket server port |

## How It Works

```
Browser (GitHub Pages)     This Proxy          SSH Server
┌──────────────┐          ┌──────────┐        ┌──────────┐
│  WebSocket   │◄────────►│ ws ↔ ssh2│───────►│ sshd:22  │
│  xterm.js    │          │ sftp ops │        │ filesystem│
└──────────────┘          └──────────┘        └──────────┘
```

## Deploy Options

**Local machine:**
```bash
node server.js
```

**Docker:**
```bash
docker run -d -p 3456:3456 node:20-slim sh -c "npm install && node server.js"
```

**Cloud (Render/Railway/Fly.io):**
Just deploy this `proxy/` folder as a Node.js app.

## Security Notes

- Run behind HTTPS/WSS in production (use nginx or Caddy as reverse proxy)
- Credentials pass through WebSocket — always use TLS in production
- The proxy does NOT store any credentials
