/**
 * Agent Query Routes
 * 
 * Provides endpoints for AI agents to safely query memory with
 * privacy-preserving ZK proofs and policy enforcement.
 * 
 * The agent never receives raw memories - only filtered context.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { hashData } from '../lib/crypto';
import { simpleAuthMiddleware } from '../lib/auth';
import {
  getMemoryMetadata,
  insertComplianceLog,
  getLatestLogHash,
  getAnchorsByMemoryHash
} from '../lib/database';
import {
  buildAgentContextFromProof,
  createProofResult,
  determinePolicyType,
  AgentContext,
  ProofResult
} from '../agent/agentPolicy';
import * as memoryPatternProver from '../services/memoryPatternProver';

const router = Router();

// ============================================
// Types
// ============================================

interface AgentQueryRequest {
  memoryId: string;
  pattern: {
    isFinance: boolean;
    isHealth: boolean;
    isPersonal: boolean;
  };
  agentPrompt?: string;
}

interface AgentQueryResponse {
  success: boolean;
  agentContext: AgentContext;
  proofSummary: {
    allowedForAgent: boolean;
    policyType: string;
    patternMatched: boolean;
    confidence: number;
    proofHash?: string;
    isRealProof: boolean;
  };
  memoryInfo?: {
    memoryId: string;
    status: string;
    tags: string[];
    hasAnchors: boolean;
    anchorCount?: number;
    revokedAt?: string;
  };
  error?: string;
}

// ============================================
// Routes
// ============================================

/**
 * POST /api/agent/query
 * 
 * Main endpoint for agent memory queries.
 * 
 * Workflow:
 * 1. Fetch memory by ID (ensure user owns it)
 * 2. Check memory status (reject if revoked/deleted)
 * 3. Generate ZK proof for the pattern
 * 4. Convert proof to AgentContext using buildAgentContextFromProof
 * 5. Return sanitized context (never raw memory content)
 * 
 * Request:
 * {
 *   "memoryId": "<id>",
 *   "pattern": { "isFinance": true, "isHealth": false, "isPersonal": false },
 *   "agentPrompt": "Help the user plan monthly savings."
 * }
 * 
 * Response:
 * {
 *   "agentContext": { "canUseMemory": true, "safeSummary": "...", ... },
 *   "proofSummary": { "allowedForAgent": true, "policyType": "ALLOW_FINANCE", ... }
 * }
 */
router.post('/query', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { memoryId, pattern, agentPrompt } = req.body as AgentQueryRequest;
    const user = req.user!;
    const now = new Date().toISOString();

    // Validate request
    if (!memoryId) {
      return res.status(400).json({
        success: false,
        error: 'memoryId is required'
      });
    }

    if (!pattern) {
      return res.status(400).json({
        success: false,
        error: 'pattern is required'
      });
    }

    // Step 1: Fetch memory (includeRevoked=true to provide better error messages)
    const memory = getMemoryMetadata(memoryId, true);

    if (!memory) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found'
      });
    }

    // Step 2: Verify ownership
    if (memory.userId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - not your memory'
      });
    }

    // Step 3: Check memory status - block revoked/deleted memories
    if (memory.status !== 'ACTIVE') {
      const agentContext: AgentContext = {
        canUseMemory: false,
        redactionReason: `Memory has been ${memory.status === 'REVOKED' ? 'revoked' : 'deleted'}. Agent access permanently blocked.`,
        policyApplied: 'BLOCK_ALL'
      };

      // Log the blocked access attempt
      const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
      const previousLogHash = getLatestLogHash();
      const logEntry = {
        id: logId,
        action: 'agent_access_blocked',
        memoryId,
        userId: user.id,
        reason: memory.status,
        timestamp: now,
        previousLogHash
      };
      const logHash = await hashData(JSON.stringify(logEntry));
      insertComplianceLog({
        id: logId,
        action: 'agent_access_blocked',
        userId: user.id,
        memoryId,
        keyId: memory.keyId,
        timestamp: now,
        metadata: {
          memoryStatus: memory.status,
          revokedAt: memory.deletedAt,
          agentPrompt
        },
        logHash,
        previousLogHash
      });

      return res.status(410).json({
        success: false,
        error: `Memory has been ${memory.status.toLowerCase()} and is no longer accessible`,
        agentContext,
        proofSummary: {
          allowedForAgent: false,
          policyType: 'BLOCK_ALL',
          patternMatched: false,
          confidence: 0,
          isRealProof: false
        },
        memoryInfo: {
          memoryId,
          status: memory.status,
          tags: memory.tags || [],
          revokedAt: memory.deletedAt,
          hasAnchors: false
        }
      } as AgentQueryResponse);
    }

    // Step 4: Generate ZK proof
    const memoryCommitment = memory.memoryCommitment || memory.contentHash;
    
    const zkResult = await memoryPatternProver.generateProof({
      memoryCommitment,
      pattern
    });

    // Step 5: Create proof result and agent context
    const proofResult: ProofResult = createProofResult(
      {
        patternMatched: zkResult.patternMatched,
        allowedForAgent: zkResult.allowedForAgent,
        confidence: zkResult.confidence
      },
      pattern,
      memoryId,
      memory.tags
    );

    const agentContext = buildAgentContextFromProof(proofResult, {
      tags: memory.tags || [],
      status: memory.status,
      memoryCommitment
    });

    // Check for anchors
    const anchors = getAnchorsByMemoryHash(memoryCommitment);

    // Log compliance event
    const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
    const previousLogHash = getLatestLogHash();
    const logHash = await hashData(JSON.stringify({
      id: logId,
      action: 'agent_query',
      userId: user.id,
      memoryId,
      timestamp: now,
      previousLogHash
    }));

    insertComplianceLog({
      id: logId,
      userId: user.id,
      action: 'agent_query',
      memoryId,
      keyId: memory.keyId,
      timestamp: now,
      metadata: {
        pattern,
        agentPrompt: agentPrompt?.slice(0, 100), // Truncate for storage
        policyApplied: agentContext.policyApplied,
        allowedForAgent: proofResult.allowedForAgent,
        proofHash: zkResult.proofHash
      },
      previousLogHash,
      logHash
    });

    // Build response
    const response: AgentQueryResponse = {
      success: true,
      agentContext,
      proofSummary: {
        allowedForAgent: proofResult.allowedForAgent,
        policyType: proofResult.policyType,
        patternMatched: zkResult.patternMatched,
        confidence: zkResult.confidence,
        proofHash: zkResult.proofHash,
        isRealProof: zkResult.isRealProof
      },
      memoryInfo: {
        memoryId,
        status: memory.status,
        tags: memory.tags || [],
        hasAnchors: anchors.length > 0,
        anchorCount: anchors.length
      }
    };

    res.json(response);
  } catch (error) {
    console.error('[Agent] Query error:', error);
    res.status(500).json({
      success: false,
      error: 'Agent query failed'
    });
  }
});

/**
 * POST /api/agent/validate
 * 
 * Validate if a memory can be used by an agent without generating a full proof.
 * Quick check for memory status and ownership.
 */
router.post('/validate', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { memoryId } = req.body;
    const user = req.user!;

    if (!memoryId) {
      return res.status(400).json({
        success: false,
        error: 'memoryId is required'
      });
    }

    const memory = getMemoryMetadata(memoryId);

    if (!memory) {
      return res.json({
        success: true,
        valid: false,
        reason: 'Memory not found'
      });
    }

    if (memory.userId !== user.id) {
      return res.json({
        success: true,
        valid: false,
        reason: 'Not your memory'
      });
    }

    if (memory.status !== 'ACTIVE') {
      return res.json({
        success: true,
        valid: false,
        reason: `Memory is ${memory.status.toLowerCase()}`,
        status: memory.status
      });
    }

    res.json({
      success: true,
      valid: true,
      memoryId,
      status: memory.status,
      tags: memory.tags || [],
      hasTags: (memory.tags || []).length > 0
    });
  } catch (error) {
    console.error('[Agent] Validate error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation failed'
    });
  }
});

/**
 * GET /api/agent/policies
 * 
 * List available policy types for agent queries.
 */
router.get('/policies', async (req: Request, res: Response) => {
  res.json({
    success: true,
    policies: [
      {
        type: 'ALLOW_FINANCE',
        description: 'Allow agent access to financial data',
        pattern: { isFinance: true, isHealth: false, isPersonal: false }
      },
      {
        type: 'ALLOW_HEALTH',
        description: 'Allow agent access to health-related data',
        pattern: { isFinance: false, isHealth: true, isPersonal: false }
      },
      {
        type: 'ALLOW_PERSONAL',
        description: 'Allow agent access to personal data',
        pattern: { isFinance: false, isHealth: false, isPersonal: true }
      },
      {
        type: 'ALLOW_GENERAL',
        description: 'Allow agent access to general non-sensitive data',
        pattern: { isFinance: false, isHealth: false, isPersonal: false }
      },
      {
        type: 'BLOCK_ALL',
        description: 'Block all agent access to memory',
        pattern: null
      }
    ]
  });
});

export default router;
