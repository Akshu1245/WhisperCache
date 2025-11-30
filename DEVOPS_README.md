# WhisperCache DevOps Guide

Production deployment configuration for Docker, Kubernetes, and monitoring.

## Quick Start

### Local Development (Docker Compose)

```bash
# Start backend + frontend + redis
docker-compose up backend frontend redis

# Start with monitoring (Prometheus + Grafana)
docker-compose --profile monitoring up

# Start full production stack
docker-compose --profile production --profile monitoring up -d
```

### Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | - |
| Backend API | http://localhost:4000/api | - |
| Prometheus | http://localhost:9091 | - |
| Grafana | http://localhost:3001 | admin/admin |
| Metrics | http://localhost:4000/metrics | - |

---

## Docker Configuration

### Building Images

```bash
# Build backend
docker build -f Dockerfile.backend -t whispercache/backend:latest .

# Build frontend
docker build -f Dockerfile.frontend -t whispercache/frontend:latest .

# Build with specific target
docker build -f Dockerfile.backend --target development -t whispercache/backend:dev .
```

### Multi-Stage Build Architecture

**Backend (Dockerfile.backend)**
- Stage 1: `deps` - Install dependencies with native modules
- Stage 2: `zk-builder` - Compile ZK circuits (optional)
- Stage 3: `builder` - TypeScript compilation
- Stage 4: `production` - Minimal runtime image
- Stage 5: `development` - Dev environment with hot reload

**Frontend (Dockerfile.frontend)**
- Stage 1: `deps` - Install npm dependencies
- Stage 2: `builder` - Vite production build
- Stage 3: `production` - nginx serving static files
- Stage 4: `development` - Vite dev server

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster 1.24+
- kubectl configured
- Ingress controller (nginx-ingress recommended)
- cert-manager (for TLS)

### Deploy to Kubernetes

```bash
# Create namespace and deploy all resources
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml

# Or deploy all at once
kubectl apply -f k8s/

# Check deployment status
kubectl -n whispercache get all
```

### Kubernetes Resources

| File | Resources |
|------|-----------|
| `k8s/deployment.yaml` | Namespace, ConfigMap, Secret, Backend/Frontend Deployments, PVC |
| `k8s/service.yaml` | ClusterIP Services, Ingress, NetworkPolicy |
| `k8s/hpa.yaml` | HorizontalPodAutoscaler, PodDisruptionBudget |

### Scaling

```bash
# Manual scaling
kubectl -n whispercache scale deployment whispercache-backend --replicas=5

# Check HPA status
kubectl -n whispercache get hpa

# View autoscaling events
kubectl -n whispercache describe hpa whispercache-backend-hpa
```

### Configuration

Update secrets before production:
```bash
# Create production secrets
kubectl -n whispercache create secret generic whispercache-secrets \
  --from-literal=MIDNIGHT_API_KEY='your-key' \
  --from-literal=ENCRYPTION_KEY='your-32-byte-key' \
  --from-literal=JWT_SECRET='your-jwt-secret' \
  --dry-run=client -o yaml | kubectl apply -f -
```

---

## Monitoring Setup

### Prometheus Configuration

File: `ops/prometheus.yml`

**Scrape Targets:**
- `whispercache-backend:9090/metrics` - Application metrics
- `prometheus:9090` - Self-monitoring
- `node-exporter:9100` - Host metrics (optional)
- `redis-exporter:9121` - Redis metrics (optional)

### Alert Rules

File: `ops/alert.rules.yml`

**Alert Categories:**
1. **Health Alerts** - Service down, health check failures
2. **Error Rate Alerts** - 5xx errors > 5%, 4xx > 20%, ZK proof failures
3. **Latency Alerts** - p95 > 2s, p99 > 5s, slow ZK proof generation
4. **Resource Alerts** - CPU > 80%, Memory > 85%, event loop lag
5. **Storage Alerts** - Database size, disk space
6. **Security Alerts** - Rate limiting, auth failures, IP blocks
7. **Business Alerts** - Low request volume, slow memory operations

### Alertmanager

File: `ops/alertmanager.yml`, `k8s/alertmanager-deployment.yaml`

**Alert Routing:**
- Critical alerts → PagerDuty/webhook
- Warning alerts → Slack
- Default → Email

**Kubernetes Deployment:**
```bash
# Deploy Alertmanager
kubectl apply -f k8s/alertmanager-deployment.yaml
kubectl apply -f k8s/alertmanager-service.yaml

# Check status
kubectl -n whispercache get pods -l app=alertmanager
```

### Grafana Dashboards

Files: `ops/grafana/dashboards/*.json`

**Pre-built Dashboards:**
- **WhisperCache API** - Request rates, latency histograms, error rates, ZK proof metrics
- **Infrastructure Overview** - CPU, memory, pod health, HPA metrics, network I/O

**Dashboard Provisioning:**
```yaml
# ops/grafana/dashboards.yml - Auto-loads dashboards on startup
```

**Access Grafana:**
- URL: http://localhost:3001
- Credentials: admin/admin (change in production)

### Grafana Datasources

File: `ops/datasources.yml`

Pre-configured datasources:
- Prometheus (default)
- Alertmanager
- Loki (log aggregation)

---

## Centralized Logging

### Loki + Promtail Stack

Files: `ops/logging/loki-config.yaml`, `ops/logging/promtail-config.yaml`

**Architecture:**
- **Loki** - Log aggregation and storage
- **Promtail** - Log collection agent (runs as DaemonSet)

**Docker Compose:**
```bash
# Start with logging
docker-compose --profile monitoring up loki promtail
```

**Kubernetes Deployment:**
```bash
kubectl apply -f k8s/loki-deployment.yaml
kubectl apply -f k8s/loki-service.yaml
```

**Log Queries in Grafana:**
```logql
# All backend logs
{app="whispercache-backend"}

# Error logs only
{app="whispercache-backend"} |= "error"

# Logs by request ID
{app="whispercache-backend"} | json | requestId="req_abc123"

# Slow requests (>1s)
{app="whispercache-backend"} | json | duration > 1000
```

---

## Backup & Disaster Recovery

### Automated Backups

File: `k8s/db-backup-cronjob.yaml`

**Schedule:** Daily at 2:00 AM UTC

**Features:**
- PostgreSQL pg_dump with compression
- SHA-256 checksums
- Optional S3 upload
- Configurable retention (7 days default)

```bash
# Deploy backup CronJob
kubectl apply -f k8s/db-backup-cronjob.yaml

# Trigger manual backup
kubectl create job --from=cronjob/db-backup manual-backup-$(date +%Y%m%d) -n whispercache

# View backup logs
kubectl logs -n whispercache job/db-backup-<timestamp>
```

**Documentation:** See `docs/backup-restore.md` for full procedures.

---

## CI/CD Pipeline

### GitHub Actions

Files: `.github/workflows/ci.yml`, `.github/workflows/deploy-staging.yml`

**CI Pipeline (`ci.yml`):**
1. **Lint & Type Check** - ESLint, TypeScript
2. **Unit Tests** - Jest with coverage
3. **Integration Tests** - With Redis/PostgreSQL services
4. **Build Docker Images** - Multi-arch builds
5. **Security Scan** - Trivy vulnerability scanning

**Staging Deployment (`deploy-staging.yml`):**
- Triggered on successful CI (develop branch)
- Manual approval support
- Health check validation

```bash
# Trigger manual CI run
gh workflow run ci.yml

# View workflow status
gh run list --workflow=ci.yml
```

---

## Metrics Reference

### Available Metrics Endpoints

| Endpoint | Format | Description |
|----------|--------|-------------|
| `/metrics` | Prometheus | Prometheus scrape endpoint |
| `/api/metrics/stats` | JSON | Performance statistics |
| `/api/metrics/prometheus` | Prometheus | Alternative metrics endpoint |
| `/api/metrics/health` | JSON | Detailed health check |

### Key Metrics

```prometheus
# Request metrics
whispercache_requests_total
whispercache_requests_success
whispercache_requests_error
whispercache_request_latency_ms{quantile="0.95"}

# Proof metrics  
whispercache_proofs_generated
whispercache_proofs_verified
whispercache_proof_cache_hit_rate

# Memory metrics
whispercache_memory_heap_used_mb
whispercache_memory_heap_total_mb
whispercache_memory_rss_mb

# Uptime
whispercache_uptime_seconds
```

---

## Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | production | Environment mode |
| `PORT` | 4000 | API server port |
| `METRICS_PORT` | 9090 | Metrics server port |
| `DATABASE_PATH` | /app/data/whispercache.db | SQLite database path |
| `BLOCKCHAIN_MODE` | simulation | Blockchain mode |
| `LOG_LEVEL` | info | Logging level |
| `CORS_ORIGINS` | localhost | Allowed CORS origins |
| `REDIS_URL` | - | Redis connection URL |
| `METRICS_ENABLED` | true | Enable metrics collection |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | http://localhost:4000 | Backend API URL |
| `VITE_WS_URL` | ws://localhost:4000 | WebSocket URL |
| `VITE_APP_ENV` | production | App environment |

---

## Production Checklist

### Security
- [ ] Replace default secrets in ConfigMaps/Secrets
- [ ] Enable TLS on Ingress
- [ ] Configure NetworkPolicy
- [ ] Set up RBAC for service accounts
- [ ] Review rate limiting settings
- [ ] Configure Alertmanager receivers (email/Slack/PagerDuty)

### Reliability
- [ ] Configure resource requests/limits
- [ ] Set up PodDisruptionBudget
- [ ] Enable HPA with appropriate thresholds
- [ ] Configure liveness/readiness probes
- [ ] Set up persistent storage
- [ ] Configure database backups (see `k8s/db-backup-cronjob.yaml`)

### Monitoring
- [ ] Deploy Prometheus and Grafana
- [ ] Configure alert notification channels (Alertmanager)
- [ ] Import Grafana dashboards (`ops/grafana/dashboards/`)
- [ ] Set up log aggregation (Loki + Promtail)
- [ ] Enable distributed tracing (optional)

### Operations
- [ ] Document runbooks for alerts
- [ ] Set up CI/CD pipeline (`.github/workflows/`)
- [ ] Configure backup strategy (`docs/backup-restore.md`)
- [ ] Plan disaster recovery
- [ ] Establish on-call rotation

---

## Troubleshooting

### Common Issues

**Backend not starting:**
```bash
# Check logs
docker-compose logs backend
kubectl -n whispercache logs -l app.kubernetes.io/component=backend

# Check health
curl http://localhost:4000/api/health
```

**Prometheus not scraping:**
```bash
# Check targets
curl http://localhost:9091/api/v1/targets

# Verify metrics endpoint
curl http://localhost:4000/metrics
```

**High memory usage:**
```bash
# Check memory stats
curl http://localhost:4000/api/metrics/stats | jq .stats.memory

# In Kubernetes
kubectl -n whispercache top pods
```

---

## Architecture Diagram

```
                                    ┌─────────────────┐
                                    │   Prometheus    │
                                    │   :9091         │
                                    └────────┬────────┘
                                             │ scrape
┌─────────────────┐                          ▼
│    Ingress      │──────────┬──────────────────────────┐
│   (nginx)       │          │                          │
└────────┬────────┘          │                          │
         │                   │                          │
         ▼                   ▼                          ▼
┌─────────────────┐  ┌─────────────────┐        ┌─────────────────┐
│    Frontend     │  │    Backend      │        │    Grafana      │
│   :80 (nginx)   │  │   :4000 (API)   │        │   :3001         │
└─────────────────┘  │   :9090 (metrics)│        └─────────────────┘
                     └────────┬────────┘
                              │
                     ┌────────┴────────┐
                     ▼                 ▼
              ┌───────────┐     ┌───────────┐
              │   Redis   │     │  SQLite   │
              │   :6379   │     │  (PVC)    │
              └───────────┘     └───────────┘
```
