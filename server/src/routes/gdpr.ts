/**
 * GDPR Routes
 * 
 * API endpoints for GDPR-compliant operations:
 * - Data deletion with ZK proof
 * - Right to access requests
 * - Data portability
 */

import { Router, Request, Response } from 'express';
import { gdprDeletionService } from '../services/gdprDeletionProof';
import { zkComplianceService } from '../services/zkComplianceService';
import { zkAccessHistoryService } from '../services/zkAccessHistoryService';

const router = Router();

/**
 * POST /api/gdpr/delete
 * Request GDPR-compliant data deletion with ZK proof
 */
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { dataId, userId, reason } = req.body;

    if (!dataId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'dataId and userId are required'
      });
    }

    const proof = await gdprDeletionService.generateDeletionProof({
      dataId,
      userId,
      reason: reason || 'user_request',
      timestamp: Date.now()
    });

    // Record the access event
    zkAccessHistoryService.recordAccess({
      dataId,
      accessorId: userId,
      action: 'delete',
      timestamp: Date.now(),
      authorized: true
    });

    res.json({
      success: true,
      deletion: {
        proofHash: proof.proofHash,
        commitment: proof.deletionCommitment,
        timestamp: proof.deletionTimestamp,
        gdprCompliance: proof.gdprCompliance
      },
      verification: {
        canVerify: true,
        authorizationHash: proof.authorizationHash
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/gdpr/verify-deletion
 * Verify a deletion proof
 */
router.post('/verify-deletion', async (req: Request, res: Response) => {
  try {
    const { proofHash, deletionCommitment, authorizationHash } = req.body;

    if (!proofHash) {
      return res.status(400).json({
        success: false,
        error: 'proofHash is required'
      });
    }

    const verification = await gdprDeletionService.verifyDeletionProof(
      proofHash,
      deletionCommitment,
      authorizationHash
    );

    res.json({
      success: true,
      verification
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/gdpr/compliance-report
 * Generate GDPR compliance report
 */
router.get('/compliance-report', async (_req: Request, res: Response) => {
  try {
    const report = gdprDeletionService.generateComplianceReport();

    res.json({
      success: true,
      report
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/gdpr/check-compliance
 * Check compliance status for a data item
 */
router.post('/check-compliance', async (req: Request, res: Response) => {
  try {
    const { dataId, accessorId, standard, retentionDays } = req.body;

    if (!dataId) {
      return res.status(400).json({
        success: false,
        error: 'dataId is required'
      });
    }

    const proof = await zkComplianceService.generateComplianceProof({
      dataId,
      accessorId: accessorId || 'system',
      standard: standard || 'GDPR',
      retentionDays: retentionDays || 30,
      encryptionUsed: true,
      auditLogExists: true
    });

    res.json({
      success: true,
      compliance: {
        isCompliant: proof.isCompliant,
        score: proof.complianceScore,
        standard: proof.standard,
        checks: proof.checks,
        recommendations: proof.recommendations,
        proofHash: proof.proofHash
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/gdpr/access-history
 * Get ZK-proven access history
 */
router.post('/access-history', async (req: Request, res: Response) => {
  try {
    const { dataId, accessorId, startTime, endTime } = req.body;

    const proof = await zkAccessHistoryService.generateAccessHistoryProof({
      dataId,
      accessorId,
      startTime: startTime || Date.now() - 30 * 24 * 60 * 60 * 1000, // Last 30 days
      endTime: endTime || Date.now()
    });

    res.json({
      success: true,
      history: {
        accessCount: proof.accessCount,
        allAuthorized: proof.allAuthorized,
        timeRange: proof.timeRange,
        summary: proof.summary,
        proofHash: proof.proofHash,
        commitment: proof.historyCommitment
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/gdpr/access-stats
 * Get anonymized access statistics
 */
router.get('/access-stats', async (_req: Request, res: Response) => {
  try {
    const stats = zkAccessHistoryService.getAccessStatistics();

    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
