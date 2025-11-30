/**
 * Health Check Router
 * 
 * Production-ready health check endpoints for Kubernetes and load balancers.
 * Implements:
 * - /health/live - Liveness probe (is the process alive?)
 * - /health/ready - Readiness probe (is the service ready to handle requests?)
 * - /health/full - Full health check with component status
 */

import { Router, Request, Response } from 'express';
import { getDatabaseStats } from '../lib/database';
import { getBlockchainStatus } from '../blockchain';
import { getLogger } from '../lib/logger';

const router = Router();
const logger = getLogger();

// Track service readiness
let isReady = false;
let startTime = Date.now();

export function setReady(ready: boolean) {
  isReady = ready;
  if (ready) {
    logger.info('Service marked as ready');
  }
}

export function getUptime(): number {
  return Date.now() - startTime;
}

/**
 * GET /health/live
 * Liveness probe - returns 200 if process is alive
 * Used by Kubernetes to know when to restart container
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: getUptime()
  });
});

/**
 * GET /health/ready
 * Readiness probe - returns 200 if service is ready to accept traffic
 * Used by Kubernetes to know when to route traffic to pod
 */
router.get('/ready', (req: Request, res: Response) => {
  if (!isReady) {
    return res.status(503).json({
      status: 'not_ready',
      message: 'Service is still initializing',
      timestamp: new Date().toISOString()
    });
  }

  // Check database connectivity
  try {
    const dbStats = getDatabaseStats();
    if (!dbStats || dbStats.memories === undefined) {
      return res.status(503).json({
        status: 'not_ready',
        message: 'Database not available',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    return res.status(503).json({
      status: 'not_ready',
      message: 'Database check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }

  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/full
 * Full health check with detailed component status
 */
router.get('/full', async (req: Request, res: Response) => {
  const checks: Record<string, any> = {
    service: 'whispercache',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: getUptime(),
    uptimeHuman: formatUptime(getUptime()),
    components: {}
  };

  let allHealthy = true;

  // Check database
  try {
    const dbStats = getDatabaseStats();
    checks.components.database = {
      status: 'healthy',
      memoriesCount: dbStats.memories,
      usersCount: dbStats.users,
      proofsCount: dbStats.zkProofs
    };
  } catch (error) {
    allHealthy = false;
    checks.components.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  // Check blockchain connectors
  try {
    const blockchainStatus = getBlockchainStatus();
    checks.components.blockchain = {
      status: 'healthy',
      ...blockchainStatus
    };
  } catch (error) {
    allHealthy = false;
    checks.components.blockchain = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  // Check ZK mode
  checks.components.zkProver = {
    status: 'healthy',
    mode: process.env.ZK_MODE || 'instant',
    anchorMode: process.env.ANCHOR_MODE || 'sqlite'
  };

  // Memory usage
  const memUsage = process.memoryUsage();
  checks.system = {
    memoryUsage: {
      heapUsed: formatBytes(memUsage.heapUsed),
      heapTotal: formatBytes(memUsage.heapTotal),
      rss: formatBytes(memUsage.rss),
      external: formatBytes(memUsage.external)
    },
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  };

  checks.status = allHealthy ? 'healthy' : 'degraded';

  res.status(allHealthy ? 200 : 503).json(checks);
});

/**
 * GET /health
 * Simple health check (alias for /health/live)
 */
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'whispercache',
    timestamp: new Date().toISOString()
  });
});

// Helper functions
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;
