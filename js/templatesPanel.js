class TemplatesPanel {
  constructor(connection) {
    this.connection = connection;
    this.templates = this._defineTemplates();
    this.activeRun = null;
  }

  init() {
    document.getElementById('templates-refresh')?.addEventListener('click', () => this.render());
    this.render();
  }

  _defineTemplates() {
    return [
      { id: 'nginx-hello', cat: 'Hello World', name: 'Nginx Hello World', icon: '🌐', desc: 'Static web server on port 8080', script: `docker run -d --name nginx-hello -p 8080:80 nginx:alpine && echo "TEMPLATE_OK: http://localhost:8080"` },
      { id: 'node-hello', cat: 'Hello World', name: 'Node.js Express', icon: '💚', desc: 'Express API on port 3000', script: `mkdir -p /tmp/node-hello && cat > /tmp/node-hello/index.js << 'SCRIPT'\nconst http = require("http");\nhttp.createServer((q,r) => { r.writeHead(200,{"Content-Type":"application/json"}); r.end(JSON.stringify({message:"Hello from Node.js!",time:new Date()})); }).listen(3000);\nconsole.log("Server on :3000");\nSCRIPT\ncd /tmp/node-hello && node index.js &\necho "TEMPLATE_OK: http://localhost:3000"` },
      { id: 'python-hello', cat: 'Hello World', name: 'Python Flask', icon: '🐍', desc: 'Flask API on port 5000', script: `pip3 install flask -q 2>/dev/null; mkdir -p /tmp/py-hello && cat > /tmp/py-hello/app.py << 'SCRIPT'\nfrom flask import Flask, jsonify\napp = Flask(__name__)\n@app.route("/")\ndef hello(): return jsonify(message="Hello from Flask!", status="running")\nif __name__ == "__main__": app.run(host="0.0.0.0", port=5000)\nSCRIPT\ncd /tmp/py-hello && python3 app.py &\necho "TEMPLATE_OK: http://localhost:5000"` },
      { id: 'go-hello', cat: 'Hello World', name: 'Go HTTP Server', icon: '\u{1F537}', desc: 'Go server on port 8081', script: 'mkdir -p /tmp/go-hello && cat > /tmp/go-hello/main.go << \'SCRIPT\'\npackage main\nimport ("fmt";"net/http")\nfunc main() {\n  http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintf(w, "{\\\"message\\\":\\\"Hello from Go!\\\"}") })\n  fmt.Println("Server on :8081")\n  http.ListenAndServe(":8081", nil)\n}\nSCRIPT\ncd /tmp/go-hello && go run main.go &\necho "TEMPLATE_OK: http://localhost:8081"' },
      { id: 'rust-hello', cat: 'Hello World', name: 'Rust Actix Web', icon: '🦀', desc: 'Rust web server on port 8082', script: `command -v cargo >/dev/null || (curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && source $HOME/.cargo/env)\necho "TEMPLATE_OK: Rust toolchain ready — create project with: cargo new myapp"` },
      { id: 'redis', cat: 'Databases', name: 'Redis', icon: '🔴', desc: 'In-memory cache on port 6379', script: `docker run -d --name redis-dev -p 6379:6379 redis:alpine && echo "TEMPLATE_OK: redis://localhost:6379"` },
      { id: 'postgres', cat: 'Databases', name: 'PostgreSQL', icon: '🐘', desc: 'Database on port 5432', script: `docker run -d --name postgres-dev -p 5432:5432 -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=devdb postgres:16-alpine && echo "TEMPLATE_OK: postgres://postgres:devpass@localhost:5432/devdb"` },
      { id: 'mysql', cat: 'Databases', name: 'MySQL', icon: '🐬', desc: 'Database on port 3306', script: `docker run -d --name mysql-dev -p 3306:3306 -e MYSQL_ROOT_PASSWORD=devpass -e MYSQL_DATABASE=devdb mysql:8 && echo "TEMPLATE_OK: mysql://root:devpass@localhost:3306/devdb"` },
      { id: 'mongo', cat: 'Databases', name: 'MongoDB', icon: '🍃', desc: 'NoSQL database on port 27017', script: `docker run -d --name mongo-dev -p 27017:27017 mongo:7 && echo "TEMPLATE_OK: mongodb://localhost:27017"` },
      { id: 'rabbitmq', cat: 'Messaging', name: 'RabbitMQ', icon: '🐰', desc: 'Message broker on port 5672, UI on 15672', script: `docker run -d --name rabbitmq-dev -p 5672:5672 -p 15672:15672 rabbitmq:3-management-alpine && echo "TEMPLATE_OK: http://localhost:15672 (guest/guest)"` },
      { id: 'kafka', cat: 'Messaging', name: 'Apache Kafka', icon: '📨', desc: 'Event streaming on port 9092', script: `docker run -d --name kafka-dev -p 9092:9092 -e KAFKA_CFG_NODE_ID=0 -e KAFKA_CFG_PROCESS_ROLES=controller,broker -e KAFKA_CFG_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093 -e KAFKA_CFG_CONTROLLER_QUORUM_VOTERS=0@localhost:9093 -e KAFKA_CFG_CONTROLLER_LISTENER_NAMES=CONTROLLER -e KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT bitnami/kafka:latest && echo "TEMPLATE_OK: kafka://localhost:9092"` },
      { id: 'nats', cat: 'Messaging', name: 'NATS', icon: '⚡', desc: 'Cloud messaging on port 4222', script: `docker run -d --name nats-dev -p 4222:4222 -p 8222:8222 nats:latest -js && echo "TEMPLATE_OK: nats://localhost:4222 monitor: http://localhost:8222"` },
      { id: 'prometheus', cat: 'CNCF Observability', name: 'Prometheus', icon: '🔥', desc: 'Metrics on port 9090', script: `docker run -d --name prometheus-dev -p 9090:9090 prom/prometheus:latest && echo "TEMPLATE_OK: http://localhost:9090"` },
      { id: 'grafana', cat: 'CNCF Observability', name: 'Grafana', icon: '📊', desc: 'Dashboards on port 3001', script: `docker run -d --name grafana-dev -p 3001:3000 -e GF_SECURITY_ADMIN_PASSWORD=admin grafana/grafana:latest && echo "TEMPLATE_OK: http://localhost:3001 (admin/admin)"` },
      { id: 'jaeger', cat: 'CNCF Observability', name: 'Jaeger', icon: '🔍', desc: 'Distributed tracing on port 16686', script: `docker run -d --name jaeger-dev -p 16686:16686 -p 4317:4317 -p 4318:4318 jaegertracing/all-in-one:latest && echo "TEMPLATE_OK: http://localhost:16686"` },
      { id: 'loki', cat: 'CNCF Observability', name: 'Loki + Promtail', icon: '📝', desc: 'Log aggregation on port 3100', script: `docker run -d --name loki-dev -p 3100:3100 grafana/loki:latest && echo "TEMPLATE_OK: http://localhost:3100/ready"` },
      { id: 'vault', cat: 'CNCF Security', name: 'HashiCorp Vault', icon: '🔐', desc: 'Secrets management on port 8200', script: `docker run -d --name vault-dev -p 8200:8200 -e VAULT_DEV_ROOT_TOKEN_ID=devtoken --cap-add=IPC_LOCK hashicorp/vault:latest && echo "TEMPLATE_OK: http://localhost:8200 (token: devtoken)"` },
      { id: 'consul', cat: 'CNCF Networking', name: 'HashiCorp Consul', icon: '🏛️', desc: 'Service mesh on port 8500', script: `docker run -d --name consul-dev -p 8500:8500 -p 8600:8600/udp hashicorp/consul:latest agent -dev -ui -client=0.0.0.0 && echo "TEMPLATE_OK: http://localhost:8500"` },
      { id: 'traefik', cat: 'CNCF Networking', name: 'Traefik Proxy', icon: '🔀', desc: 'Reverse proxy on port 80, dashboard 8888', script: `docker run -d --name traefik-dev -p 80:80 -p 8888:8080 traefik:latest --api.insecure=true --providers.docker && echo "TEMPLATE_OK: http://localhost:8888/dashboard/"` },
      { id: 'envoy', cat: 'CNCF Networking', name: 'Envoy Proxy', icon: '🛡️', desc: 'Service proxy on port 10000', script: `docker run -d --name envoy-dev -p 10000:10000 -p 9901:9901 envoyproxy/envoy:v1.28-latest && echo "TEMPLATE_OK: http://localhost:9901"` },
      { id: 'argocd', cat: 'CNCF GitOps', name: 'ArgoCD', icon: '🔄', desc: 'GitOps CD — requires K8s cluster', script: `kubectl create namespace argocd 2>/dev/null; kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml && echo "Waiting for ArgoCD..." && kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=120s && echo "TEMPLATE_OK: kubectl port-forward svc/argocd-server -n argocd 8443:443"` },
      { id: 'fluxcd', cat: 'CNCF GitOps', name: 'Flux CD', icon: '🌊', desc: 'GitOps toolkit — requires K8s cluster', script: `command -v flux >/dev/null || (curl -s https://fluxcd.io/install.sh | bash) && flux check --pre && echo "TEMPLATE_OK: flux installed — run: flux bootstrap github"` },
      { id: 'certmanager', cat: 'CNCF Security', name: 'cert-manager', icon: '📜', desc: 'TLS certificate manager for K8s', script: `kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml && echo "Waiting..." && kubectl wait --for=condition=available deployment/cert-manager -n cert-manager --timeout=120s && echo "TEMPLATE_OK: cert-manager deployed"` },
      { id: 'harbor', cat: 'CNCF Registry', name: 'Harbor Registry', icon: '⚓', desc: 'Container registry on port 8443', script: `echo "Harbor requires docker-compose. Downloading..." && curl -sL https://raw.githubusercontent.com/goharbor/harbor/main/make/harbor.yml.tmpl -o /tmp/harbor.yml && echo "TEMPLATE_OK: Edit /tmp/harbor.yml then run: ./install.sh"` },
      { id: 'minio', cat: 'Storage', name: 'MinIO S3', icon: '🪣', desc: 'S3-compatible storage on port 9000', script: `docker run -d --name minio-dev -p 9000:9000 -p 9001:9001 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin minio/minio:latest server /data --console-address ":9001" && echo "TEMPLATE_OK: http://localhost:9001 (minioadmin/minioadmin)"` },
      { id: 'etcd', cat: 'CNCF Core', name: 'etcd', icon: '🗄️', desc: 'Distributed KV store on port 2379', script: `docker run -d --name etcd-dev -p 2379:2379 -e ALLOW_NONE_AUTHENTICATION=yes bitnami/etcd:latest && echo "TEMPLATE_OK: etcdctl --endpoints=localhost:2379 put key val"` },
      { id: 'k3s', cat: 'Kubernetes', name: 'K3s Single Node', icon: '☸️', desc: 'Lightweight K8s cluster', script: `curl -sfL https://get.k3s.io | sh - && echo "Waiting for K3s..." && sleep 10 && sudo k3s kubectl get nodes && echo "TEMPLATE_OK: sudo k3s kubectl get nodes"` },
      { id: 'kind', cat: 'Kubernetes', name: 'KinD Cluster', icon: '🎯', desc: 'K8s in Docker for development', script: `command -v kind >/dev/null || (curl -Lo /usr/local/bin/kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64 && chmod +x /usr/local/bin/kind) && kind create cluster --name dev && echo "TEMPLATE_OK: kubectl cluster-info --context kind-dev"` },
      { id: 'minikube', cat: 'Kubernetes', name: 'Minikube', icon: '🚀', desc: 'Local K8s with addons', script: `command -v minikube >/dev/null || (curl -Lo /usr/local/bin/minikube https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64 && chmod +x /usr/local/bin/minikube) && minikube start --driver=docker && echo "TEMPLATE_OK: minikube status"` },
      { id: 'fullstack', cat: 'Full Stack', name: 'React + Express + Postgres', icon: '🏗️', desc: 'Full stack app template', script: `mkdir -p /tmp/fullstack/{frontend,backend} && cat > /tmp/fullstack/docker-compose.yml << 'EOF'\nversion: "3.8"\nservices:\n  db:\n    image: postgres:16-alpine\n    environment: { POSTGRES_PASSWORD: devpass, POSTGRES_DB: app }\n    ports: ["5432:5432"]\n  api:\n    image: node:20-alpine\n    working_dir: /app\n    command: sh -c "npm init -y && npm i express pg && node -e \\"const e=require('express')();e.get('/',(q,r)=>r.json({ok:true}));e.listen(4000,()=>console.log('API:4000'))\\""\n    ports: ["4000:4000"]\n    depends_on: [db]\nEOF\ncd /tmp/fullstack && docker compose up -d && echo "TEMPLATE_OK: API http://localhost:4000 DB localhost:5432"` },
    ];
  }

  render() {
    const container = document.getElementById('templates-content');
    if (!container) return;
    const cats = {};
    this.templates.forEach((t) => { if (!cats[t.cat]) cats[t.cat] = []; cats[t.cat].push(t); });

    let html = '';
    Object.entries(cats).forEach(([cat, templates]) => {
      html += `<div class="template-category"><div class="git-section-title">${cat} (${templates.length})</div>`;
      templates.forEach((t) => {
        html += `<div class="template-card" id="tpl-${t.id}">
          <div class="template-card-header" data-id="${t.id}">
            <span class="devops-card-icon" style="background:var(--bg-tertiary)">${t.icon}</span>
            <div class="devops-card-info">
              <div class="devops-card-name">${t.name}</div>
              <div class="devops-card-version">${t.desc}</div>
            </div>
          </div>
          <div class="template-card-body" id="tpl-body-${t.id}" style="display:none">
            <div class="devops-card-actions">
              <button class="devops-install-btn template-run-btn" data-id="${t.id}">Deploy</button>
              <button class="devops-install-btn secondary template-stop-btn" data-id="${t.id}">Stop</button>
              <button class="devops-install-btn secondary template-log-toggle" data-id="${t.id}">Log</button>
            </div>
            <div class="devops-log" id="tpl-log-${t.id}"></div>
            <div class="devops-result" id="tpl-result-${t.id}"></div>
          </div>
        </div>`;
      });
      html += '</div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.template-card-header').forEach((h) => {
      h.addEventListener('click', () => {
        const body = document.getElementById(`tpl-body-${h.dataset.id}`);
        body.style.display = body.style.display === 'none' ? 'flex' : 'none';
      });
    });
    container.querySelectorAll('.template-run-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.deploy(btn.dataset.id); });
    });
    container.querySelectorAll('.template-stop-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.stop(btn.dataset.id); });
    });
    container.querySelectorAll('.template-log-toggle').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const log = document.getElementById(`tpl-log-${btn.dataset.id}`);
        log.classList.toggle('visible');
      });
    });
  }

  async deploy(id) {
    const tpl = this.templates.find((t) => t.id === id);
    if (!tpl || this.activeRun) return;
    this.activeRun = id;

    const log = document.getElementById(`tpl-log-${id}`);
    const result = document.getElementById(`tpl-result-${id}`);
    log.textContent = ''; log.classList.add('visible');
    result.className = 'devops-result'; result.textContent = '';

    const btn = document.querySelector(`.template-run-btn[data-id="${id}"]`);
    if (btn) { btn.disabled = true; btn.textContent = 'Deploying...'; }

    const execId = 'tpl-' + Date.now();
    const outHandler = (e) => {
      if (e.detail.execId !== execId) return;
      log.textContent += e.detail.data;
      log.scrollTop = log.scrollHeight;
    };
    const doneHandler = (e) => {
      if (e.detail.execId !== execId) return;
      this.connection.removeEventListener('exec:stream:data', outHandler);
      this.connection.removeEventListener('exec:stream:done', doneHandler);
      const lines = log.textContent.split('\n');
      const okLine = lines.find((l) => l.includes('TEMPLATE_OK:'));
      if (okLine) {
        result.className = 'devops-result visible installed-ok';
        result.textContent = okLine.replace('TEMPLATE_OK:', '').trim();
      } else if (e.detail.code !== 0) {
        result.className = 'devops-result visible failed';
        result.textContent = `Failed (exit code ${e.detail.code})`;
      }
      if (btn) { btn.disabled = false; btn.textContent = 'Deploy'; }
      this.activeRun = null;
    };

    this.connection.addEventListener('exec:stream:data', outHandler);
    this.connection.addEventListener('exec:stream:done', doneHandler);
    this.connection.send('exec:stream', { execId, command: `bash -c '${tpl.script.replace(/'/g, "'\\''")}'`, pty: true });
  }

  async stop(id) {
    const tpl = this.templates.find((t) => t.id === id);
    if (!tpl) return;
    const containerName = id.replace(/-/g, '') + '-dev';
    try {
      await this.connection.exec(`docker stop ${id}-dev 2>/dev/null; docker rm ${id}-dev 2>/dev/null; docker stop ${containerName} 2>/dev/null; docker rm ${containerName} 2>/dev/null; pkill -f "${id}" 2>/dev/null; echo "Stopped"`);
      window.app.notify(`Stopped ${tpl.name}`, 'success');
      const result = document.getElementById(`tpl-result-${id}`);
      if (result) { result.className = 'devops-result visible no-changes'; result.textContent = 'Stopped'; }
    } catch (err) { window.app.notify(err.message, 'error'); }
  }

  dispose() {}
}
window.TemplatesPanel = TemplatesPanel;
