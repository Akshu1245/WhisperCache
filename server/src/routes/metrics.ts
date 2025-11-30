/**
 * WhisperCache Metrics Routes
 * 
 * Endpoints for monitoring and observability:
 * - /metrics/stats - JSON performance stats
 * - /metrics/prometheus - Prometheus format metrics
 * - /metrics/health - Detailed health check
 */

import { Router, Request, Response } from 'express';
import { performanceMonitor } from '../services/performanceMonitor';

const router = Router();

/**
 * GET /metrics/stats
 * Returns JSON performance statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = performanceMonitor.getStats();
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /metrics/prometheus
 * Returns metrics in Prometheus format
 */
router.get('/prometheus', (_req: Request, res: Response) => {
  try {
    const metrics = performanceMonitor.toPrometheusFormat();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(metrics);
  } catch (error: any) {
    res.status(500).send(`# Error: ${error.message}`);
  }
});

/**
 * GET /metrics/health
 * Detailed health check
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const stats = performanceMonitor.getStats();
    const memory = stats.memory;
    
    // Check for degraded conditions
    const checks = {
      memory: memory.heapUsedMB < memory.heapTotalMB * 0.9 ? 'healthy' : 'degraded',
      uptime: stats.uptime > 0 ? 'healthy' : 'unhealthy',
      errorRate: stats.requests.total > 0
        ? (stats.requests.failed / stats.requests.total) < 0.1 ? 'healthy' : 'degraded'
        : 'healthy'
    };

    const overallStatus = Object.values(checks).includes('unhealthy')
      ? 'unhealthy'
      : Object.values(checks).includes('degraded')
        ? 'degraded'
        : 'healthy';

    res.status(overallStatus === 'unhealthy' ? 503 : 200).json({
      status: overallStatus,
      checks,
      stats: {
        uptimeSeconds: stats.uptime,
        memoryUsedMB: memory.heapUsedMB,
        requestsTotal: stats.requests.total,
        errorRate: stats.requests.total > 0
          ? Math.round((stats.requests.failed / stats.requests.total) * 100) / 100
          : 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
