import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { hashData, generateNonce } from '../lib/crypto';
import { simpleAuthMiddleware, optionalSimpleAuth } from '../lib/auth';
import { 
  insertComplianceLog, 
  getComplianceLogs, 
  getLatestLogHash,
  getComplianceLogCount,
  getDatabaseStats,
  ComplianceLog 
} from '../lib/database';

const router = Router();

type ComplianceAction = 'create' | 'access' | 'delete' | 'proof' | 'rotate_key' | 'anchor' | 'export' | 'share';

interface LogRequest {
  action: ComplianceAction;
  memoryId?: string;
  keyId: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/compliance/log
 * 
 * Creates a new compliance log entry with hash-chained audit trail
 * Requires authentication.
 */
router.post('/log', simpleAuthMiddleware(), async (req: Request<{}, {}, LogRequest>, res: Response) => {
  try {
    const { action, memoryId, keyId, metadata } = req.body;
    const user = req.user!;

    if (!action || !keyId) {
      return res.status(400).json({
        error: 'action and keyId are required'
      });
    }

    // Generate log ID
    const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
    const timestamp = new Date().toISOString();

    // Get previous log hash for chain (from database)
    const previousLogHash = getLatestLogHash();

    // Create log hash (forms audit chain)
    const logHash = await hashData(
      JSON.stringify({
        id: logId,
        action,
        memoryId,
        userId: user.id,
        keyId,
        timestamp,
        previousLogHash
      })
    );

    const log: ComplianceLog = {
      id: logId,
      userId: user.id,
      action,
      memoryId,
      keyId,
      timestamp,
      metadata,
      previousLogHash,
      logHash
    };

    // Persist to database
    insertComplianceLog(log);

    res.json({
      success: true,
      log
    });
  } catch (error) {
    console.error('Compliance log error:', error);
    res.status(500).json({
      error: 'Failed to create compliance log'
    });
  }
});

/**
 * GET /api/compliance/logs
 * 
 * Retrieves compliance logs with optional filtering from database
 * Requires authentication - only returns logs for the authenticated user.
 */
router.get('/logs', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { keyId, action, memoryId, limit = '100' } = req.query;
    const user = req.user!;

    const limitNum = parseInt(limit as string, 10);
    
    // Query database with filters - scoped to user
    const logs = getComplianceLogs({
      userId: user.id,
      keyId: keyId as string,
      action: action as string,
      memoryId: memoryId as string,
      limit: limitNum
    });

    res.json({
      logs,
      total: logs.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve logs'
    });
  }
});

/**
 * GET /api/compliance/verify
 * 
 * Verifies the integrity of the compliance log chain
 */
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const logCount = getComplianceLogCount();
    
    if (logCount === 0) {
      return res.json({
        verified: true,
        message: 'No logs to verify',
        chainLength: 0
      });
    }

    // Verify chain integrity by fetching all logs
    const logs = getComplianceLogs({ limit: 10000 });
    
    // Reverse to process in chronological order
    const orderedLogs = [...logs].reverse();
    
    let isValid = true;
    let brokenAt: string | null = null;

    for (let i = 0; i < orderedLogs.length; i++) {
      const log = orderedLogs[i];
      const expectedPrevHash = i === 0 ? 'genesis' : orderedLogs[i - 1].logHash;

      if (log.previousLogHash !== expectedPrevHash) {
        isValid = false;
        brokenAt = log.id;
        break;
      }

      // Verify log hash
      const computedHash = await hashData(
        JSON.stringify({
          id: log.id,
          action: log.action,
          memoryId: log.memoryId,
          keyId: log.keyId,
          timestamp: log.timestamp,
          previousLogHash: log.previousLogHash
        })
      );

      if (computedHash !== log.logHash) {
        isValid = false;
        brokenAt = log.id;
        break;
      }
    }

    res.json({
      verified: isValid,
      chainLength: orderedLogs.length,
      latestLogHash: orderedLogs.length > 0 ? orderedLogs[orderedLogs.length - 1].logHash : 'genesis',
      ...(brokenAt && { brokenAt })
    });
  } catch (error) {
    res.status(500).json({
      verified: false,
      error: 'Verification failed'
    });
  }
});

/**
 * GET /api/compliance/export
 * 
 * Exports compliance logs for auditing
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { keyId } = req.query;

    const exportLogs = getComplianceLogs({
      keyId: keyId as string,
      limit: 10000
    });

    res.json({
      exportedAt: new Date().toISOString(),
      totalLogs: exportLogs.length,
      logs: exportLogs
    });
  } catch (error) {
    res.status(500).json({
      error: 'Export failed'
    });
  }
});

/**
 * GET /api/compliance/stats
 * 
 * Gets database statistics for compliance dashboard
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = getDatabaseStats();
    
    res.json({
      ...stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get stats'
    });
  }
});

export default router;
