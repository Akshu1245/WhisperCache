# WhisperCache Backup & Disaster Recovery Guide

This document describes the backup and disaster recovery procedures for WhisperCache.

## Table of Contents

- [Overview](#overview)
- [Backup Strategy](#backup-strategy)
- [Automated Backups](#automated-backups)
- [Manual Backup Procedures](#manual-backup-procedures)
- [Restore Procedures](#restore-procedures)
- [Disaster Recovery](#disaster-recovery)
- [Monitoring & Alerts](#monitoring--alerts)
- [Troubleshooting](#troubleshooting)

---

## Overview

WhisperCache uses a multi-tier backup strategy to ensure data durability and quick recovery:

| Data Type | Backup Method | Frequency | Retention |
|-----------|---------------|-----------|-----------|
| PostgreSQL Database | pg_dump | Daily | 7 days |
| Redis Cache | RDB snapshots | Hourly | 24 hours |
| SQLite (Dev) | File copy | On-demand | Manual |
| Configuration | Git | Continuous | Indefinite |
| Secrets | Kubernetes Secrets | With cluster backup | With cluster |

---

## Backup Strategy

### 1. Database Backups

**PostgreSQL (Production)**
- Full logical backups using `pg_dump` with custom format
- Compressed with gzip (level 9)
- Checksum verification (SHA-256)
- Optional S3 upload for off-site storage

**SQLite (Development)**
- Simple file copy of `whispercache.db`
- Located at `/app/data/whispercache.db`

### 2. State & Cache

**Redis**
- Append-only file (AOF) for durability
- RDB snapshots for point-in-time recovery
- Cache data can be regenerated from database

### 3. Configuration

All configuration is stored in Git:
- `ops/` - Monitoring and alerting configuration
- `k8s/` - Kubernetes manifests
- `.env.example` - Environment variable templates

---

## Automated Backups

### Kubernetes CronJob

The automated backup runs daily at 2:00 AM UTC:

```bash
# View backup job status
kubectl get cronjobs -n whispercache

# View recent backup jobs
kubectl get jobs -n whispercache -l component=backup

# View backup logs
kubectl logs -n whispercache job/db-backup-<timestamp>
```

### Configuration

Edit `k8s/db-backup-cronjob.yaml` to customize:

```yaml
spec:
  # Change schedule (cron format)
  schedule: "0 2 * * *"  # Daily at 2 AM UTC
  
  # Adjust retention in the job environment
  env:
    - name: RETENTION_DAYS
      value: "7"
```

### S3 Configuration (Optional)

To enable S3 uploads, update the backup secrets:

```bash
kubectl create secret generic backup-secrets \
  --from-literal=POSTGRES_PASSWORD=your-password \
  --from-literal=AWS_ACCESS_KEY_ID=your-key \
  --from-literal=AWS_SECRET_ACCESS_KEY=your-secret \
  --from-literal=AWS_DEFAULT_REGION=us-east-1 \
  -n whispercache \
  --dry-run=client -o yaml | kubectl apply -f -
```

And update the CronJob to include S3 bucket:

```yaml
env:
  - name: S3_BUCKET
    value: "your-backup-bucket"
  - name: S3_PREFIX
    value: "whispercache/backups"
```

---

## Manual Backup Procedures

### Docker Compose (Development)

```bash
# PostgreSQL backup
docker exec whispercache-postgres pg_dump \
  -U whispercache \
  -d whispercache \
  -F custom \
  -f /tmp/backup.dump

docker cp whispercache-postgres:/tmp/backup.dump ./backup-$(date +%Y%m%d).dump

# SQLite backup (if using SQLite)
docker cp whispercache-backend:/app/data/whispercache.db ./whispercache-$(date +%Y%m%d).db

# Redis backup
docker exec whispercache-redis redis-cli BGSAVE
docker cp whispercache-redis:/data/dump.rdb ./redis-$(date +%Y%m%d).rdb
```

### Kubernetes (Production)

```bash
# Trigger manual backup from CronJob
kubectl create job --from=cronjob/db-backup manual-backup-$(date +%Y%m%d-%H%M%S) -n whispercache

# Wait for completion
kubectl wait --for=condition=complete job/manual-backup-<timestamp> -n whispercache --timeout=600s

# Copy backup locally
kubectl cp whispercache/<backup-pod>:/backups/whispercache_<timestamp>.dump ./backup.dump
```

### Direct pg_dump (Emergency)

```bash
# Port-forward to PostgreSQL
kubectl port-forward svc/postgres 5432:5432 -n whispercache

# Run pg_dump locally
pg_dump \
  --host=localhost \
  --port=5432 \
  --username=whispercache \
  --dbname=whispercache \
  --format=custom \
  --compress=9 \
  --file=emergency-backup-$(date +%Y%m%d_%H%M%S).dump
```

---

## Restore Procedures

### Docker Compose (Development)

```bash
# PostgreSQL restore
docker cp ./backup.dump whispercache-postgres:/tmp/backup.dump
docker exec whispercache-postgres pg_restore \
  -U whispercache \
  -d whispercache \
  --clean \
  --if-exists \
  /tmp/backup.dump

# SQLite restore
docker cp ./whispercache.db whispercache-backend:/app/data/whispercache.db
docker restart whispercache-backend

# Redis restore
docker stop whispercache-redis
docker cp ./dump.rdb whispercache-redis:/data/dump.rdb
docker start whispercache-redis
```

### Kubernetes (Production)

**Option 1: Using restore script**

```bash
# Create a restore job
kubectl run db-restore \
  --image=postgres:15-alpine \
  --restart=Never \
  --env="POSTGRES_HOST=postgres" \
  --env="POSTGRES_PORT=5432" \
  --env="POSTGRES_DB=whispercache" \
  --env="POSTGRES_USER=whispercache" \
  --env="PGPASSWORD=<password>" \
  -n whispercache \
  -- pg_restore \
    --host=postgres \
    --port=5432 \
    --username=whispercache \
    --dbname=whispercache \
    --clean \
    --if-exists \
    /backups/whispercache_<timestamp>.dump
```

**Option 2: Port-forward and local restore**

```bash
# Port-forward to PostgreSQL
kubectl port-forward svc/postgres 5432:5432 -n whispercache

# Restore from local backup
pg_restore \
  --host=localhost \
  --port=5432 \
  --username=whispercache \
  --dbname=whispercache \
  --clean \
  --if-exists \
  ./backup.dump
```

### Restore from S3

```bash
# Download from S3
aws s3 cp s3://your-bucket/whispercache/backups/whispercache_<timestamp>.dump ./backup.dump

# Verify checksum
aws s3 cp s3://your-bucket/whispercache/backups/whispercache_<timestamp>.sha256 ./backup.sha256
sha256sum -c backup.sha256

# Follow restore procedures above
```

---

## Disaster Recovery

### RTO/RPO Targets

| Scenario | RTO (Recovery Time) | RPO (Data Loss) |
|----------|---------------------|-----------------|
| Database corruption | 30 minutes | 24 hours (daily backup) |
| Pod failure | 2 minutes | 0 (replicas) |
| Node failure | 5 minutes | 0 (pod rescheduling) |
| Region failure | 1 hour | 24 hours |
| Complete cluster loss | 2 hours | 24 hours |

### Disaster Recovery Procedures

#### Scenario 1: Database Corruption

1. Stop application to prevent further damage:
   ```bash
   kubectl scale deployment whispercache-backend --replicas=0 -n whispercache
   ```

2. Restore from latest backup:
   ```bash
   kubectl create job --from=cronjob/db-backup emergency-restore -n whispercache
   ```

3. Restart application:
   ```bash
   kubectl scale deployment whispercache-backend --replicas=2 -n whispercache
   ```

#### Scenario 2: Complete Cluster Loss

1. Create new cluster
2. Apply namespace and secrets:
   ```bash
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/db-backup-cronjob.yaml
   ```

3. Download backup from S3:
   ```bash
   aws s3 cp s3://your-bucket/whispercache/backups/latest.dump ./backup.dump
   ```

4. Restore database (see Restore Procedures above)

5. Verify application health:
   ```bash
   kubectl get pods -n whispercache
   curl http://your-domain/api/health
   ```

---

## Monitoring & Alerts

### Backup Monitoring

The following Prometheus metrics are available for backup monitoring:

```yaml
# In ops/alert.rules.yml, add:
- alert: BackupJobFailed
  expr: kube_job_status_failed{job_name=~"db-backup.*"} > 0
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Database backup job failed"
    description: "The backup job {{ $labels.job_name }} has failed"

- alert: BackupJobMissing
  expr: time() - kube_job_status_completion_time{job_name=~"db-backup.*"} > 129600
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "No successful backup in 36 hours"
    description: "The last successful backup was over 36 hours ago"
```

### Health Checks

```bash
# Check backup PVC usage
kubectl exec -it deploy/db-backup -n whispercache -- df -h /backups

# List available backups
kubectl exec -it deploy/db-backup -n whispercache -- ls -la /backups

# Verify backup integrity
kubectl exec -it deploy/db-backup -n whispercache -- sha256sum -c /backups/whispercache_latest.sha256
```

---

## Troubleshooting

### Common Issues

**Backup job timeout**
```bash
# Increase timeout in CronJob spec
spec:
  jobTemplate:
    spec:
      activeDeadlineSeconds: 7200  # 2 hours
```

**Insufficient storage**
```bash
# Expand PVC (if storage class supports)
kubectl patch pvc backup-storage -n whispercache \
  -p '{"spec":{"resources":{"requests":{"storage":"50Gi"}}}}'

# Or reduce retention
# Edit RETENTION_DAYS in CronJob
```

**S3 upload failures**
```bash
# Check AWS credentials
kubectl get secret backup-secrets -n whispercache -o yaml

# Test S3 connectivity
kubectl run aws-test --rm -it --image=amazon/aws-cli \
  --env="AWS_ACCESS_KEY_ID=..." \
  --env="AWS_SECRET_ACCESS_KEY=..." \
  -- s3 ls s3://your-bucket/
```

**Restore fails with "database in use"**
```bash
# Terminate existing connections
kubectl exec -it deploy/postgres -n whispercache -- psql -U whispercache -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='whispercache' AND pid <> pg_backend_pid();"
```

---

## Appendix

### Backup File Naming Convention

```
whispercache_YYYYMMDD_HHMMSS.dump
whispercache_YYYYMMDD_HHMMSS.sha256
```

### Recommended S3 Lifecycle Policy

```json
{
  "Rules": [
    {
      "ID": "BackupRetention",
      "Status": "Enabled",
      "Filter": {"Prefix": "whispercache/backups/"},
      "Transitions": [
        {"Days": 7, "StorageClass": "STANDARD_IA"},
        {"Days": 30, "StorageClass": "GLACIER"}
      ],
      "Expiration": {"Days": 90}
    }
  ]
}
```

### Contact

For emergency support:
- On-call: Check PagerDuty
- Slack: #whispercache-ops
- Email: ops@example.com
