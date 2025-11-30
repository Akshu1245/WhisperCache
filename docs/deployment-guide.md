# WhisperCache Deployment Guide

## Overview

This guide covers deploying WhisperCache in various environments:
- Local development
- Docker (single-node)
- Production (staging/production)

## Prerequisites

### Required

- Node.js 18+ (20+ recommended)
- npm 9+
- Git

### Optional

- Docker & Docker Compose
- PostgreSQL (production)
- Redis (caching)

## Local Development

### 1. Clone Repository

```bash
git clone https://github.com/your-org/whispercache.git
cd whispercache
```

### 2. Install Dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install

# ZK Circuits (if modifying)
cd ../zk
npm install
```

### 3. Configure Environment

```bash
# Copy example config
cp server/.env.example server/.env

# Edit with your values
# Minimum required:
# - ENCRYPTION_KEY (generate with: openssl rand -hex 32)
```

### 4. Build ZK Circuits (if needed)

```bash
cd zk
npm run compile
```

### 5. Start Development Servers

```bash
# Terminal 1: Backend
cd server
npm run dev

# Terminal 2: Frontend
cd client
npm run dev
```

### 6. Verify Installation

```bash
# Health check
curl http://localhost:4000/api/health

# Expected response:
# {"status":"healthy","services":{...}}
```

## Docker Deployment

### Development Mode

```bash
# Start with hot-reload
docker-compose -f docker-compose.dev.yml up --build

# Access:
# - API: http://localhost:4000
# - Frontend: http://localhost:5173
```

### Production Mode

```bash
# Build and start
docker-compose up --build -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f server
```

### With PostgreSQL & Redis

```bash
# Start with production profile
COMPOSE_PROFILES=production docker-compose up --build -d
```

## Production Deployment

### Infrastructure Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 2 GB | 8+ GB |
| Storage | 10 GB | 50+ GB SSD |
| Network | 100 Mbps | 1 Gbps |

### Environment Variables

```bash
# Required for production
NODE_ENV=production
PORT=4000
ENCRYPTION_KEY=<32-byte-hex-key>

# Database
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://user:pass@host:5432/whispercache

# Blockchain
BLOCKCHAIN_MODE=real
MIDNIGHT_NETWORK=testnet
MIDNIGHT_API_KEY=<your-api-key>
BLOCKFROST_API_KEY=<your-blockfrost-key>

# Security
CORS_ORIGINS=https://your-domain.com
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_SECONDS=60

# Logging
LOG_LEVEL=info
```

### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name api.whispercache.io;

    ssl_certificate /etc/letsencrypt/live/api.whispercache.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.whispercache.io/privkey.pem;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Systemd Service

```ini
[Unit]
Description=WhisperCache Server
After=network.target

[Service]
Type=simple
User=whispercache
WorkingDirectory=/opt/whispercache/server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=whispercache
Environment=NODE_ENV=production
EnvironmentFile=/opt/whispercache/server/.env

[Install]
WantedBy=multi-user.target
```

### Database Setup (PostgreSQL)

```sql
-- Create database
CREATE DATABASE whispercache;

-- Create user
CREATE USER whispercache WITH ENCRYPTED PASSWORD 'your-secure-password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE whispercache TO whispercache;
```

## Monitoring

### Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| GET /api/health | Overall health status |
| GET /api/health/live | Kubernetes liveness probe |
| GET /api/health/ready | Kubernetes readiness probe |

### Metrics (Prometheus)

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'whispercache'
    static_configs:
      - targets: ['localhost:4000']
    metrics_path: '/api/metrics'
```

### Logging

```bash
# View logs (Docker)
docker-compose logs -f server

# View logs (systemd)
journalctl -u whispercache -f

# Log format (production)
{"level":"info","timestamp":"2024-01-15T10:30:00Z","message":"Request completed",...}
```

## Backup & Recovery

### SQLite Backup

```bash
# Create backup
sqlite3 data/whispercache.db ".backup 'backup-$(date +%Y%m%d).db'"

# Restore
cp backup-20240115.db data/whispercache.db
```

### PostgreSQL Backup

```bash
# Create backup
pg_dump -h localhost -U whispercache whispercache > backup-$(date +%Y%m%d).sql

# Restore
psql -h localhost -U whispercache whispercache < backup-20240115.sql
```

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process
lsof -i :4000

# Kill process
kill -9 <PID>
```

#### Database Connection Failed

```bash
# Check PostgreSQL status
systemctl status postgresql

# Check connection
psql -h localhost -U whispercache -d whispercache -c "SELECT 1"
```

#### ZK Proof Generation Slow

- Increase memory allocation
- Enable proof caching
- Consider dedicated ZK proof worker

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Enable all debug output
DEBUG=* npm run dev
```

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.scale.yml
services:
  server:
    deploy:
      replicas: 3
```

### Load Balancing

Use nginx or HAProxy with sticky sessions for consistent memory access.

## Security Hardening

See [Security Considerations](./security-considerations.md) for detailed security guidance.

### Quick Checklist

- [ ] Use HTTPS only
- [ ] Set strong ENCRYPTION_KEY
- [ ] Configure firewall
- [ ] Enable rate limiting
- [ ] Set CORS origins
- [ ] Regular security updates
- [ ] Enable audit logging

## Support

- Documentation: https://docs.whispercache.io
- Issues: https://github.com/your-org/whispercache/issues
- Discord: https://discord.gg/whispercache
