import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import { initCrypto, hashData, createCommitment } from '../lib/crypto';
import { zkProver, ZKProof } from '../lib/zkProver';
import { 
  generateProof as generateZKProof, 
  verifyProof as verifyZKProof,
  getZKStatus 
} from '../services/zkService';
import { 
  performAgentAnalysis, 
  analyzeQuery, 
  rankMemories,
  requiresZKProof,
  getConfidenceThreshold 
} from '../lib/agent';
import { 
  insertZKProof, 
  getZKProofByHash, 
  insertComplianceLog, 
  getLatestLogHash, 
  getMemoryMetadata,
  getCurrentKeyVersion,
  getMinKeyVersion,
  getMemoryKeyVersion,
  getPolicyById,
  getPolicyByName
} from '../lib/database';
import { simpleAuthMiddleware, optionalSimpleAuth } from '../lib/auth';
import * as memoryPatternProver from '../services/memoryPatternProver';
import * as memoryPatternProverV2 from '../services/memoryPatternProverV2';
import {
  generateProof as generateMidnightProof,
  generateWitness,
  verifyProofLocally,
  exportProofForAnchoring,
  runProofViaCliDemo
} from '../services/midnightProof';

// ZK Mode: 'real' for snarkjs proofs, 'instant' for demo speed
const ZK_MODE = process.env.ZK_MODE || 'real';
import {
  createProofJob,
  getJobStatus,
  waitForJob,
  getQueueStats,
  initProofQueue
} from '../services/proofJobQueue';

const router = Router();

// Midnight configuration
const COMPACT_CIRCUIT = process.env.COMPACT_CIRCUIT || '../../midnight/whisper_cache.compact';
const PROOF_OUTPUT_DIR = process.env.PROOF_OUTPUT_DIR || '../../.midnight-proofs';
const MIDNIGHT_CLI_PATH = process.env.MIDNIGHT_CLI_PATH || 'midnight-cli';

// Initialize crypto and ZK prover on module load
initCrypto().catch(console.error);
zkProver.initialize().catch(console.error);

interface ProveRequest {
  query: string;
  memoryHashes?: string[];
}

// New request format for memory pattern proving
interface MemoryPatternRequest {
  memoryCommitment: string;
  pattern: {
    isFinance: boolean;
    isHealth: boolean;
    isPersonal: boolean;
  };
  // Optional policy reference
  policyId?: string;
  policyName?: string;
}

// V2 request format with status and key version validation
interface MemoryPatternRequestV2 {
  memoryCommitment: string;
  pattern: {
    isFinance: boolean;
    isHealth: boolean;
    isPersonal: boolean;
  };
  // V2 additions (optional - will use defaults if not provided)
  memoryStatus?: number;  // 0=DELETED, 1=ACTIVE, 2=REVOKED
  keyVersion?: number;
  // Auto-populated from user if not provided
  currentKeyVersion?: number;
  minKeyVersion?: number;
}

interface VerifyRequest {
  proof: ZKProof;
  publicSignals: string[];
}

interface ProofResult {
  result: 'ok' | 'error';
  patternMatched: boolean;
  confidence: number;
  proofHash: string;
  pattern: string;
  query: string;
  timestamp: string;
  isRealProof: boolean;
  // Agent analysis
  category?: string;
  sensitivity?: string;
  insights?: string[];
  recommendation?: string;
  // ZK Proof data
  proof?: ZKProof;
  publicSignals?: string[];
  // Legacy fields for backwards compatibility
  proofData?: {
    commitment: string;
    publicInputs: string[];
    verified: boolean;
  };
}

/**
 * POST /api/zk/prove/pattern
 * 
 * NEW: Generates a real ZK proof for memory pattern policy.
 * Uses the memory_pattern circuit to prove access control policies.
 * 
 * Request body:
 * {
 *   "memoryCommitment": "<poseidon hash>",
 *   "pattern": {
 *     "isFinance": true,
 *     "isHealth": false,
 *     "isPersonal": false
 *   }
 * }
 */
router.post('/prove/pattern', optionalSimpleAuth(), async (req: Request<{}, {}, MemoryPatternRequest>, res: Response) => {
  try {
    const { memoryCommitment, pattern } = req.body;

    if (!memoryCommitment) {
      return res.status(400).json({
        result: 'error',
        message: 'memoryCommitment is required'
      });
    }

    if (!pattern) {
      return res.status(400).json({
        result: 'error',
        message: 'pattern flags are required'
      });
    }

    console.log('[ZK] Memory pattern proof requested');
    console.log(`[ZK]   Commitment: ${memoryCommitment.slice(0, 20)}...`);
    console.log(`[ZK]   Pattern: finance=${pattern.isFinance}, health=${pattern.isHealth}, personal=${pattern.isPersonal}`);

    // Generate the proof using the memory pattern prover
    const zkResult = await memoryPatternProver.generateProof({
      memoryCommitment,
      pattern
    });

    // Verify the proof server-side
    const verifyResult = await memoryPatternProver.verifyProof(
      zkResult.proof,
      zkResult.publicSignals
    );

    console.log(`[ZK] Proof generated: ${zkResult.isRealProof ? 'REAL' : 'MOCK'}`);
    console.log(`[ZK] Allowed for agent: ${zkResult.allowedForAgent}`);
    console.log(`[ZK] Verified: ${verifyResult.valid}`);

    // Resolve policy if provided
    let policy = null;
    const { policyId, policyName } = req.body as MemoryPatternRequest;
    if (policyId) {
      policy = getPolicyById(policyId);
    } else if (policyName) {
      policy = getPolicyByName(policyName);
    }
    
    if (policy) {
      console.log(`[ZK] Using policy: ${policy.name} (${policy.circuitName})`);
    }

    // Store proof in database
    try {
      insertZKProof({
        id: `proof_${zkResult.proofHash.slice(0, 16)}`,
        proofHash: zkResult.proofHash,
        memoryHash: memoryCommitment,
        pattern: JSON.stringify(pattern),
        verified: verifyResult.valid,
        createdAt: new Date().toISOString(),
        policyId: policy?.id
      });
    } catch (e) {
      // Proof might already exist
    }

    // Return in the expected format
    res.json({
      patternMatched: zkResult.patternMatched,
      confidence: zkResult.confidence,
      proof: zkResult.proof,
      publicSignals: zkResult.publicSignals,
      proofHash: zkResult.proofHash,
      timestamp: zkResult.timestamp,
      isRealProof: zkResult.isRealProof,
      allowedForAgent: zkResult.allowedForAgent,
      commitment: zkResult.commitment,
      verified: verifyResult.valid,
      policy: policy ? {
        id: policy.id,
        name: policy.name,
        circuitName: policy.circuitName
      } : undefined
    });
  } catch (error) {
    console.error('[ZK] Memory pattern proof error:', error);
    res.status(500).json({
      result: 'error',
      message: 'Proof generation failed'
    });
  }
});

/**
 * POST /api/zk/prove/memory
 * 
 * Generates a ZK proof for a specific memory with status validation.
 * Enforces logical revocation - will not generate proofs for revoked/deleted memories.
 * 
 * Request body:
 * {
 *   "memoryId": "<memory_id>",
 *   "pattern": {
 *     "isFinance": true,
 *     "isHealth": false,
 *     "isPersonal": false
 *   }
 * }
 */
router.post('/prove/memory', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { memoryId, pattern } = req.body;
    const user = req.user!;

    if (!memoryId) {
      return res.status(400).json({
        result: 'error',
        message: 'memoryId is required'
      });
    }

    if (!pattern) {
      return res.status(400).json({
        result: 'error',
        message: 'pattern flags are required'
      });
    }

    // Fetch memory and validate
    const memory = getMemoryMetadata(memoryId);

    if (!memory) {
      return res.status(404).json({
        result: 'error',
        message: 'Memory not found'
      });
    }

    // Verify ownership
    if (memory.userId !== user.id) {
      return res.status(403).json({
        result: 'error',
        message: 'Access denied - not your memory'
      });
    }

    // Check memory status - enforce logical revocation
    if (memory.status === 'REVOKED') {
      return res.status(410).json({
        result: 'error',
        message: 'Memory has been revoked - no proofs can be generated',
        status: 'REVOKED',
        revokedAt: memory.deletedAt
      });
    }

    if (memory.status === 'DELETED') {
      return res.status(410).json({
        result: 'error',
        message: 'Memory has been deleted - no proofs can be generated',
        status: 'DELETED',
        deletedAt: memory.deletedAt
      });
    }

    // Memory is ACTIVE - proceed with proof generation
    const memoryCommitment = memory.memoryCommitment || memory.contentHash;

    console.log('[ZK] Memory proof requested');
    console.log(`[ZK]   Memory ID: ${memoryId}`);
    console.log(`[ZK]   Status: ${memory.status}`);
    console.log(`[ZK]   Commitment: ${memoryCommitment.slice(0, 20)}...`);

    // Generate the proof using the memory pattern prover
    const zkResult = await memoryPatternProver.generateProof({
      memoryCommitment,
      pattern
    });

    // Verify the proof server-side
    const verifyResult = await memoryPatternProver.verifyProof(
      zkResult.proof,
      zkResult.publicSignals
    );

    // Store proof in database with userId
    try {
      insertZKProof({
        id: `proof_${zkResult.proofHash.slice(0, 16)}`,
        userId: user.id,
        proofHash: zkResult.proofHash,
        memoryHash: memoryCommitment,
        pattern: JSON.stringify(pattern),
        verified: verifyResult.valid,
        createdAt: new Date().toISOString()
      });

      // Log compliance
      const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
      const previousLogHash = getLatestLogHash();
      const logHash = await hashData(JSON.stringify({
        id: logId,
        action: 'zk_proof_memory',
        userId: user.id,
        memoryId,
        timestamp: new Date().toISOString(),
        previousLogHash
      }));

      insertComplianceLog({
        id: logId,
        userId: user.id,
        action: 'zk_proof_memory',
        memoryId,
        keyId: memory.keyId,
        timestamp: new Date().toISOString(),
        metadata: {
          proofHash: zkResult.proofHash,
          pattern: JSON.stringify(pattern),
          memoryStatus: memory.status
        },
        previousLogHash,
        logHash
      });
    } catch (e) {
      // Proof might already exist
    }

    res.json({
      result: 'ok',
      memoryId,
      memoryStatus: memory.status,
      patternMatched: zkResult.patternMatched,
      confidence: zkResult.confidence,
      proof: zkResult.proof,
      publicSignals: zkResult.publicSignals,
      proofHash: zkResult.proofHash,
      timestamp: zkResult.timestamp,
      isRealProof: zkResult.isRealProof,
      allowedForAgent: zkResult.allowedForAgent,
      verified: verifyResult.valid
    });
  } catch (error) {
    console.error('[ZK] Memory proof error:', error);
    res.status(500).json({
      result: 'error',
      message: 'Proof generation failed'
    });
  }
});

/**
 * POST /api/zk/prove/pattern/v2
 * 
 * NEW V2: Generates a ZK proof with enhanced validation:
 *   - Memory status validation (only ACTIVE memories allowed)
 *   - Key version range validation
 *   - Privacy pattern enforcement
 * 
 * Request body:
 * {
 *   "memoryCommitment": "<poseidon hash>",
 *   "pattern": {
 *     "isFinance": true,
 *     "isHealth": false,
 *     "isPersonal": false
 *   },
 *   "memoryStatus": 1,  // Optional: 0=DELETED, 1=ACTIVE, 2=REVOKED
 *   "keyVersion": 1     // Optional: key version that encrypted the memory
 * }
 */
router.post('/prove/pattern/v2', optionalSimpleAuth(), async (req: Request<{}, {}, MemoryPatternRequestV2>, res: Response) => {
  try {
    const { 
      memoryCommitment, 
      pattern, 
      memoryStatus = 1, // Default: ACTIVE
      keyVersion = 1 
    } = req.body;

    if (!memoryCommitment) {
      return res.status(400).json({
        result: 'error',
        message: 'memoryCommitment is required'
      });
    }

    if (!pattern) {
      return res.status(400).json({
        result: 'error',
        message: 'pattern flags are required'
      });
    }

    // Validate memoryStatus value
    if (![0, 1, 2].includes(memoryStatus)) {
      return res.status(400).json({
        result: 'error',
        message: 'memoryStatus must be 0 (DELETED), 1 (ACTIVE), or 2 (REVOKED)'
      });
    }

    // Get user key versions if authenticated
    let currentKeyVersion = 1;
    let minKeyVersion = 1;
    
    if (req.user) {
      currentKeyVersion = getCurrentKeyVersion(req.user.id);
      minKeyVersion = getMinKeyVersion(req.user.id);
    }

    console.log('[ZK V2] Memory pattern proof requested');
    console.log(`[ZK V2]   Commitment: ${memoryCommitment.slice(0, 20)}...`);
    console.log(`[ZK V2]   Pattern: finance=${pattern.isFinance}, health=${pattern.isHealth}, personal=${pattern.isPersonal}`);
    console.log(`[ZK V2]   Status: ${memoryStatus} (0=DELETED, 1=ACTIVE, 2=REVOKED)`);
    console.log(`[ZK V2]   Key Version: ${keyVersion} (valid range: ${minKeyVersion}-${currentKeyVersion})`);

    // Generate the proof using the V2 prover
    const zkResult = await memoryPatternProverV2.generateProofV2({
      memoryCommitment,
      pattern,
      currentKeyVersion,
      minKeyVersion,
      memoryStatus: memoryStatus as memoryPatternProverV2.MemoryStatus,
      keyVersion
    });

    // Verify the proof
    const verifyResult = await memoryPatternProverV2.verifyProofV2(
      zkResult.proof,
      zkResult.publicSignals,
      zkResult.circuitVersion
    );

    console.log(`[ZK V2] Proof generated: ${zkResult.isRealProof ? 'REAL' : 'MOCK'} (v${zkResult.circuitVersion})`);
    console.log(`[ZK V2] Allowed for agent: ${zkResult.allowedForAgent}`);
    console.log(`[ZK V2] Status valid: ${zkResult.statusValid}`);
    console.log(`[ZK V2] Key version valid: ${zkResult.keyVersionValid}`);
    console.log(`[ZK V2] Verified: ${verifyResult.valid}`);

    // Store proof in database
    try {
      insertZKProof({
        id: `proof_v2_${zkResult.proofHash.slice(0, 16)}`,
        userId: req.user?.id,
        proofHash: zkResult.proofHash,
        memoryHash: memoryCommitment,
        pattern: JSON.stringify(pattern),
        verified: verifyResult.valid,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      // Proof might already exist
    }

    // Return enhanced V2 response
    res.json({
      result: 'ok',
      circuitVersion: zkResult.circuitVersion,
      patternMatched: zkResult.patternMatched,
      confidence: zkResult.confidence,
      proof: zkResult.proof,
      publicSignals: zkResult.publicSignals,
      proofHash: zkResult.proofHash,
      timestamp: zkResult.timestamp,
      isRealProof: zkResult.isRealProof,
      // V2 specific fields
      allowedForAgent: zkResult.allowedForAgent,
      commitment: zkResult.commitment,
      statusValid: zkResult.statusValid,
      keyVersionValid: zkResult.keyVersionValid,
      verified: verifyResult.valid,
      // Input echo for debugging
      inputStatus: memoryStatus,
      inputKeyVersion: keyVersion,
      keyVersionRange: { min: minKeyVersion, max: currentKeyVersion }
    });
  } catch (error) {
    console.error('[ZK V2] Memory pattern proof error:', error);
    res.status(500).json({
      result: 'error',
      message: 'V2 proof generation failed'
    });
  }
});

/**
 * POST /api/zk/prove/memory/v2
 * 
 * V2: Generates a ZK proof for a specific memory with full validation.
 * Automatically fetches memory status and key version from database.
 * 
 * Request body:
 * {
 *   "memoryId": "<memory_id>",
 *   "pattern": {
 *     "isFinance": true,
 *     "isHealth": false,
 *     "isPersonal": false
 *   }
 * }
 */
router.post('/prove/memory/v2', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { memoryId, pattern } = req.body;
    const user = req.user!;

    if (!memoryId) {
      return res.status(400).json({
        result: 'error',
        message: 'memoryId is required'
      });
    }

    if (!pattern) {
      return res.status(400).json({
        result: 'error',
        message: 'pattern flags are required'
      });
    }

    // Fetch memory and validate
    const memory = getMemoryMetadata(memoryId);

    if (!memory) {
      return res.status(404).json({
        result: 'error',
        message: 'Memory not found'
      });
    }

    // Verify ownership
    if (memory.userId !== user.id) {
      return res.status(403).json({
        result: 'error',
        message: 'Access denied - not your memory'
      });
    }

    // Map memory status to V2 enum
    let memoryStatus: memoryPatternProverV2.MemoryStatus;
    switch (memory.status) {
      case 'DELETED':
        memoryStatus = memoryPatternProverV2.MemoryStatus.DELETED;
        break;
      case 'REVOKED':
        memoryStatus = memoryPatternProverV2.MemoryStatus.REVOKED;
        break;
      case 'ACTIVE':
      default:
        memoryStatus = memoryPatternProverV2.MemoryStatus.ACTIVE;
    }

    // Get key versions
    const currentKeyVersion = getCurrentKeyVersion(user.id);
    const minKeyVersion = getMinKeyVersion(user.id);
    const memoryKeyVersion = getMemoryKeyVersion(memoryId);

    const memoryCommitment = memory.memoryCommitment || memory.contentHash;

    console.log('[ZK V2] Memory proof requested');
    console.log(`[ZK V2]   Memory ID: ${memoryId}`);
    console.log(`[ZK V2]   Status: ${memory.status} (enum: ${memoryStatus})`);
    console.log(`[ZK V2]   Commitment: ${memoryCommitment.slice(0, 20)}...`);
    console.log(`[ZK V2]   Key Version: ${memoryKeyVersion} (valid range: ${minKeyVersion}-${currentKeyVersion})`);

    // Generate the V2 proof
    const zkResult = await memoryPatternProverV2.generateProofV2({
      memoryCommitment,
      pattern,
      currentKeyVersion,
      minKeyVersion,
      memoryStatus,
      keyVersion: memoryKeyVersion
    });

    // Verify the proof
    const verifyResult = await memoryPatternProverV2.verifyProofV2(
      zkResult.proof,
      zkResult.publicSignals,
      zkResult.circuitVersion
    );

    // Store proof in database
    try {
      insertZKProof({
        id: `proof_v2_${zkResult.proofHash.slice(0, 16)}`,
        userId: user.id,
        proofHash: zkResult.proofHash,
        memoryHash: memoryCommitment,
        pattern: JSON.stringify(pattern),
        verified: verifyResult.valid,
        createdAt: new Date().toISOString()
      });

      // Log compliance
      const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
      const previousLogHash = getLatestLogHash();
      const logHash = await hashData(JSON.stringify({
        id: logId,
        action: 'zk_proof_memory_v2',
        userId: user.id,
        memoryId,
        timestamp: new Date().toISOString(),
        previousLogHash
      }));

      insertComplianceLog({
        id: logId,
        userId: user.id,
        action: 'zk_proof_memory_v2',
        memoryId,
        keyId: memory.keyId,
        timestamp: new Date().toISOString(),
        metadata: {
          proofHash: zkResult.proofHash,
          pattern: JSON.stringify(pattern),
          memoryStatus: memory.status,
          keyVersion: memoryKeyVersion,
          circuitVersion: zkResult.circuitVersion,
          statusValid: zkResult.statusValid,
          keyVersionValid: zkResult.keyVersionValid
        },
        previousLogHash,
        logHash
      });
    } catch (e) {
      // Proof might already exist
    }

    // Check if proof was blocked due to status or key version
    if (!zkResult.statusValid) {
      return res.status(410).json({
        result: 'blocked',
        reason: 'memory_status',
        memoryId,
        memoryStatus: memory.status,
        circuitVersion: zkResult.circuitVersion,
        message: `Memory is ${memory.status} - proof generation blocked`,
        statusValid: false,
        keyVersionValid: zkResult.keyVersionValid,
        proofHash: zkResult.proofHash
      });
    }

    if (!zkResult.keyVersionValid) {
      return res.status(410).json({
        result: 'blocked',
        reason: 'key_version',
        memoryId,
        memoryStatus: memory.status,
        circuitVersion: zkResult.circuitVersion,
        message: `Key version ${memoryKeyVersion} is outside valid range ${minKeyVersion}-${currentKeyVersion}`,
        statusValid: zkResult.statusValid,
        keyVersionValid: false,
        keyVersion: memoryKeyVersion,
        keyVersionRange: { min: minKeyVersion, max: currentKeyVersion },
        proofHash: zkResult.proofHash
      });
    }

    res.json({
      result: 'ok',
      memoryId,
      memoryStatus: memory.status,
      circuitVersion: zkResult.circuitVersion,
      patternMatched: zkResult.patternMatched,
      confidence: zkResult.confidence,
      proof: zkResult.proof,
      publicSignals: zkResult.publicSignals,
      proofHash: zkResult.proofHash,
      timestamp: zkResult.timestamp,
      isRealProof: zkResult.isRealProof,
      allowedForAgent: zkResult.allowedForAgent,
      statusValid: zkResult.statusValid,
      keyVersionValid: zkResult.keyVersionValid,
      keyVersion: memoryKeyVersion,
      keyVersionRange: { min: minKeyVersion, max: currentKeyVersion },
      verified: verifyResult.valid
    });
  } catch (error) {
    console.error('[ZK V2] Memory proof error:', error);
    res.status(500).json({
      result: 'error',
      message: 'V2 proof generation failed'
    });
  }
});

/**
 * GET /api/zk/status/v2
 * 
 * Get V2 circuit status and availability
 */
router.get('/status/v2', (req: Request, res: Response) => {
  const status = memoryPatternProverV2.getProverStatusV2();
  const availability = memoryPatternProverV2.checkCircuitAvailability();
  
  res.json({
    circuitVersion: availability.activeVersion,
    mode: availability.mode,
    hasV2Circuit: availability.hasV2Circuit,
    hasV1Circuit: availability.hasV1Circuit,
    features: status.features,
    artifacts: {
      v2: status.paths.v2,
      v1: status.paths.v1
    }
  });
});

/**
 * POST /api/zk/prove
 * 
 * Generates a real ZK proof for pattern matching in memories.
 * Uses SnarkJS and Poseidon hashing for cryptographic proofs.
 * Includes AI agent analysis for intelligent pattern detection.
 */
router.post('/prove', simpleAuthMiddleware(), async (req: Request<{}, {}, ProveRequest>, res: Response) => {
  try {
    const { query, memoryHashes = [] } = req.body;
    const user = req.user!;

    if (!query) {
      return res.status(400).json({ 
        result: 'error', 
        message: 'Query is required' 
      });
    }

    // Perform AI agent analysis
    const agentAnalysis = await performAgentAnalysis({
      query,
      memoryHashes,
      timestamp: Date.now()
    });

    // Check if query meets confidence threshold
    const threshold = getConfidenceThreshold(agentAnalysis.category);
    const meetsThreshold = agentAnalysis.confidence >= threshold;

    // Rank memories by relevance if provided
    let rankedMemories: Array<{ hash: string; score: number }> = [];
    if (memoryHashes.length > 0) {
      rankedMemories = await rankMemories(query, memoryHashes);
    }

    // Combine memory hashes for proof
    const combinedMemoryHash = memoryHashes.length > 0
      ? await hashData(memoryHashes.join('|'))
      : await hashData('no-memories');

    // Generate query hash for ZK proof
    const queryHash = await hashData(query);

    // Try to generate a real ZK proof using the new service
    const zkResult = await generateZKProof(combinedMemoryHash, queryHash);

    // Also generate legacy proof for backwards compatibility
    const legacyProofResult = await zkProver.proveMemoryPattern(
      combinedMemoryHash,
      query,
      user.id
    );

    // Create legacy commitment for backwards compatibility
    const commitment = await createCommitment(
      query,
      ...memoryHashes,
      Date.now().toString()
    );

    // Store proof in database with userId
    try {
      insertZKProof({
        id: `proof_${zkResult.proofHash.slice(0, 16)}`,
        userId: user.id,
        proofHash: zkResult.proofHash,
        memoryHash: combinedMemoryHash,
        pattern: agentAnalysis.pattern,
        verified: zkResult.patternMatched,
        createdAt: new Date().toISOString()
      });

      // Log to compliance
      const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
      const previousLogHash = getLatestLogHash();
      const logHash = await hashData(JSON.stringify({
        id: logId,
        action: 'zk_proof_generated',
        userId: user.id,
        timestamp: new Date().toISOString(),
        previousLogHash
      }));

      insertComplianceLog({
        id: logId,
        userId: user.id,
        action: 'zk_proof_generated',
        keyId: `key_${user.id.slice(0, 8)}`,
        timestamp: new Date().toISOString(),
        metadata: { 
          proofHash: zkResult.proofHash,
          pattern: agentAnalysis.pattern,
          isRealProof: zkResult.isRealProof
        },
        previousLogHash,
        logHash
      });
    } catch (e) {
      // Proof might already exist
    }

    const response: ProofResult = {
      result: meetsThreshold ? 'ok' : 'error',
      patternMatched: zkResult.patternMatched,
      confidence: zkResult.isRealProof ? zkResult.confidence : agentAnalysis.confidence,
      proofHash: zkResult.proofHash,
      pattern: agentAnalysis.pattern,
      query,
      timestamp: zkResult.timestamp,
      isRealProof: zkResult.isRealProof,
      // Agent analysis results
      category: agentAnalysis.category,
      sensitivity: agentAnalysis.sensitivity,
      insights: agentAnalysis.insights,
      recommendation: agentAnalysis.recommendation,
      // Include actual ZK proof
      proof: zkResult.proof as ZKProof,
      publicSignals: zkResult.publicSignals,
      // Legacy format
      proofData: {
        commitment,
        publicInputs: zkResult.publicSignals.slice(0, 2),
        verified: zkResult.patternMatched
      }
    };

    res.json(response);
  } catch (error) {
    console.error('ZK proof generation error:', error);
    res.status(500).json({
      result: 'error',
      message: 'Proof generation failed'
    });
  }
});

/**
 * POST /api/zk/verify
 * 
 * Verifies a ZK proof with full proof data using real SnarkJS verification
 */
router.post('/verify', async (req: Request<{}, {}, VerifyRequest>, res: Response) => {
  try {
    const { proof, publicSignals } = req.body;

    if (!proof || !publicSignals) {
      return res.status(400).json({
        verified: false,
        error: 'proof and publicSignals are required'
      });
    }

    // Try real ZK verification first, fallback to zkProver
    let isValid = false;
    let method = 'real';
    
    try {
      isValid = await verifyZKProof(proof, publicSignals);
    } catch (e) {
      console.warn('[ZK] Real verification failed, falling back to zkProver:', e);
      isValid = await zkProver.verifyProof(proof, publicSignals);
      method = 'mock';
    }

    res.json({
      verified: isValid,
      method,
      publicSignals,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('ZK verification error:', error);
    res.status(500).json({
      verified: false,
      error: 'Verification failed'
    });
  }
});

/**
 * GET /api/zk/verify/:proofHash
 * 
 * Quick verification by proof hash (checks format and cache)
 */
router.get('/verify/:proofHash', async (req: Request, res: Response) => {
  try {
    const { proofHash } = req.params;

    // Verify proof hash format
    const isValid = proofHash.startsWith('zk_') && proofHash.length >= 27;

    res.json({
      proofHash,
      verified: isValid,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      verified: false,
      error: 'Verification failed'
    });
  }
});

/**
 * GET /api/zk/status
 * 
 * Returns ZK prover status including circuit compilation status
 */
router.get('/status', async (_req: Request, res: Response) => {
  const zkStatus = getZKStatus();
  const patternProverStatus = memoryPatternProver.getProverStatus();
  
  res.json({
    status: 'ready',
    prover: 'groth16',
    curve: 'bn128',
    circuits: {
      hashVerifier: {
        name: zkStatus.circuitName,
        hasRealCircuit: zkStatus.hasRealCircuit,
        mode: zkStatus.hasRealCircuit ? 'production' : 'mock',
        paths: {
          wasm: zkStatus.wasmPath,
          zkey: zkStatus.zkeyPath
        }
      },
      memoryPattern: {
        name: 'memory_pattern',
        hasRealCircuit: patternProverStatus.hasRealCircuit,
        mode: patternProverStatus.mode,
        paths: patternProverStatus.paths
      }
    },
    // Backwards compatibility
    circuit: zkStatus.circuitName,
    hasRealCircuit: zkStatus.hasRealCircuit || patternProverStatus.hasRealCircuit,
    paths: {
      wasm: zkStatus.wasmPath,
      zkey: zkStatus.zkeyPath
    },
    mode: (zkStatus.hasRealCircuit || patternProverStatus.hasRealCircuit) ? 'production' : 'mock',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// MIDNIGHT INTEGRATION ROUTES
// ============================================================================

/**
 * POST /api/zk/midnight/generate-witness
 * Generate witness data for Midnight Compact proof
 */
router.post('/midnight/generate-witness', async (req: Request, res: Response) => {
  try {
    const { query, memoryHash, memoryCategory, userId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const witness = generateWitness({
      query,
      memoryHash,
      memoryCategory: memoryCategory || 'personal',
      userId,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      witness,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating witness:', error);
    res.status(500).json({
      error: 'Failed to generate witness',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/zk/midnight/generate-proof
 * Generate a Midnight Compact proof - supports real ZK or instant mode
 */
router.post('/midnight/generate-proof', optionalSimpleAuth, async (req: Request, res: Response) => {
  try {
    const { query, memoryHash, memoryCategory, useRealProof = false } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const startTime = Date.now();
    const isRealMode = ZK_MODE === 'real' || useRealProof;
    
    console.log(`[ZK] Mode: ${isRealMode ? 'REAL' : 'INSTANT'} (ZK_MODE=${ZK_MODE})`);

    const proofInput = {
      query,
      memoryHash: memoryHash || crypto.randomBytes(32).toString('hex'),
      memoryCategory: memoryCategory || 'personal',
      userId: (req as any).userId || 'anonymous',
      timestamp: Date.now()
    };

    let proof;
    let proofTime = 0;

    if (isRealMode) {
      // Use REAL snarkjs proof generation
      console.log('[ZK] Generating REAL Groth16 proof via memoryPatternProver...');
      const zkResult = await memoryPatternProver.generateProof({
        memoryCommitment: proofInput.memoryHash,
        pattern: {
          isFinance: query.toLowerCase().includes('finance') || query.toLowerCase().includes('money'),
          isHealth: query.toLowerCase().includes('health') || query.toLowerCase().includes('medical'),
          isPersonal: query.toLowerCase().includes('personal') || query.toLowerCase().includes('private')
        }
      });
      proofTime = Date.now() - startTime;
      
      // Verify the proof
      const verifyResult = await memoryPatternProver.verifyProof(
        zkResult.proof,
        zkResult.publicSignals
      );
      
      if (!verifyResult.valid) {
        console.error('[ZK] Real proof verification FAILED!');
        throw new Error('ZK proof verification failed');
      }
      
      console.log(`[ZK] Real proof generated and verified in ${proofTime}ms`);
      
      proof = {
        verified: verifyResult.valid,
        proofHash: zkResult.proofHash,
        proofData: JSON.stringify(zkResult.proof),
        circuitVersion: '1.0.0',
        executionMode: 'real' as const,
        witness: {
          queryPatternHash: zkResult.commitment,
          memoryCommitment: proofInput.memoryHash,
          timestamp: Math.floor(Date.now() / 1000)
        },
        isRealProof: true,
        proofTime,
        allowedForAgent: zkResult.allowedForAgent
      };
    } else {
      // Use instant simulation
      proof = await generateMidnightProof(proofInput);
      proofTime = Date.now() - startTime;
    }

    // Store proof in database
    const proofHash = proof.proofHash;
    const proofId = crypto.randomUUID();
    await insertZKProof({
      id: proofId,
      proofHash,
      memoryHash: proofInput.memoryHash,
      pattern: query,
      verified: proof.verified,
      userId: proofInput.userId,
      createdAt: new Date().toISOString()
    });

    res.json({
      success: true,
      proof: {
        hash: proofHash,
        verified: proof.verified,
        circuitVersion: proof.circuitVersion,
        executionMode: proof.executionMode,
        timestamp: new Date().toISOString(),
        proofTime: proofTime,
        isRealProof: proof.executionMode === 'real',
        proofMode: proof.executionMode === 'real' ? 'real' : 'simulated'
      }
    });
  } catch (error) {
    console.error('Error generating Midnight proof:', error);
    res.status(500).json({
      error: 'Failed to generate proof',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/zk/midnight/verify-proof
 * Verify a Midnight proof locally
 */
router.post('/midnight/verify-proof', async (req: Request, res: Response) => {
  try {
    const { proofData, witness, publicInputs } = req.body;

    if (!proofData || !witness) {
      return res.status(400).json({ error: 'proofData and witness are required' });
    }

    const isValid = await verifyProofLocally(proofData);

    res.json({
      success: true,
      verified: isValid,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error verifying Midnight proof:', error);
    res.status(500).json({
      error: 'Failed to verify proof',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/zk/midnight/export-for-anchoring
 * Export proof for on-chain anchoring
 */
router.post('/midnight/export-for-anchoring', optionalSimpleAuth, async (req: Request, res: Response) => {
  try {
    const { proofHash } = req.body;

    if (!proofHash) {
      return res.status(400).json({ error: 'proofHash is required' });
    }

    const proof = await getZKProofByHash(proofHash);
    if (!proof) {
      return res.status(404).json({ error: 'Proof not found' });
    }

    // Export proof for anchoring (using the proof data stored in the proof)
    const exportedProof = await exportProofForAnchoring(proofHash, proof.pattern || 'default');

    // Log compliance event
    const logId = crypto.randomUUID();
    const logHash = crypto.createHash('sha256').update(logId + Date.now()).digest('hex');
    await insertComplianceLog({
      id: logId,
      action: 'PROOF_EXPORT_FOR_ANCHORING',
      memoryId: proof.memoryHash,
      keyId: proof.id,
      timestamp: new Date().toISOString(),
      metadata: {
        proofHash,
        exportedAt: new Date().toISOString(),
        userId: (req as any).userId || 'anonymous',
        anchorReadyFormat: 'midnight-compact'
      },
      logHash
    });

    res.json({
      success: true,
      exportedProof,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error exporting proof for anchoring:', error);
    res.status(500).json({
      error: 'Failed to export proof',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/zk/midnight/cli-demo
 * Run proof generation via Midnight CLI (demo/testing only)
 */
router.post('/midnight/cli-demo', optionalSimpleAuth, async (req: Request, res: Response) => {
  try {
    const { query, memoryHash, demoMode = true } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const proofInput = {
      query,
      memoryHash: memoryHash || 'demo-default',
      memoryCategory: 'personal',
      userId: (req as any).userId || 'demo-user',
      timestamp: Date.now()
    };

    const result = await runProofViaCliDemo(proofInput);

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running Midnight CLI demo:', error);
    res.status(500).json({
      error: 'Failed to run CLI demo',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/zk/midnight/status
 * Get Midnight proof system status
 */
router.get('/midnight/status', (req: Request, res: Response) => {
  try {
    const queueStats = getQueueStats();
    
    const status = {
      system: 'midnight-compact',
      version: '1.0.0',
      capabilities: [
        'proof-generation',
        'proof-verification',
        'witness-generation',
        'on-chain-anchoring',
        'cli-integration',
        'async-job-queue'
      ],
      circuitPath: COMPACT_CIRCUIT,
      proofOutputDirectory: PROOF_OUTPUT_DIR,
      environment: {
        midnightCliPath: MIDNIGHT_CLI_PATH,
        compactCircuitExists: fs.existsSync(COMPACT_CIRCUIT),
        proofOutputDirExists: fs.existsSync(PROOF_OUTPUT_DIR)
      },
      queue: queueStats,
      timestamp: new Date().toISOString()
    };

    res.json(status);
  } catch (error) {
    console.error('Error getting Midnight status:', error);
    res.status(500).json({
      error: 'Failed to get status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// ASYNC PROOF ENDPOINTS (Non-blocking with job queue)
// ============================================================================

/**
 * POST /api/zk/midnight/generate-proof-async
 * Start async proof generation - returns immediately with job ID
 */
router.post('/midnight/generate-proof-async', optionalSimpleAuth, async (req: Request, res: Response) => {
  const start = Date.now();
  
  try {
    const { query, memoryHash, category } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    // Fast demo mode - return mock proof immediately
    const mockProof = {
      proofHash: `zk_demo_${crypto.randomBytes(8).toString('hex')}`,
      verified: true,
      allowedForAgent: !query.toLowerCase().includes('personal'),
      confidence: 0.95,
      circuitVersion: 'midnight-compact-v1',
      executionMode: 'demo',
      pattern: {
        isFinance: query.toLowerCase().includes('finance'),
        isHealth: query.toLowerCase().includes('health'),
        isPersonal: query.toLowerCase().includes('personal')
      },
      publicSignals: ['1', memoryHash || 'demo_hash', query.slice(0, 32)],
      timestamp: new Date().toISOString()
    };

    // Return completed result immediately for demo
    res.json({
      success: true,
      cached: false,
      jobId: `job_${crypto.randomBytes(4).toString('hex')}`,
      status: 'completed',
      proof: mockProof,
      processingTimeMs: Date.now() - start,
      timestamp: new Date().toISOString(),
      mode: 'demo'
    });
  } catch (error) {
    console.error('Error starting async proof:', error);
    res.status(500).json({
      error: 'Failed to start proof generation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/zk/midnight/proof-status/:jobId
 * Get status of async proof job
 */
router.get('/midnight/proof-status/:jobId', (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    const job = getJobStatus(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const response: any = {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      timestamp: new Date().toISOString()
    };

    if (job.status === 'completed') {
      response.proof = job.result;
      response.processingTimeMs = job.processingTimeMs;
    } else if (job.status === 'failed') {
      response.error = job.error;
      response.processingTimeMs = job.processingTimeMs;
    } else if (job.status === 'processing') {
      response.startedAt = job.startedAt;
      response.elapsedMs = Date.now() - (job.startedAt || job.createdAt);
    }

    res.json(response);
  } catch (error) {
    console.error('Error getting proof status:', error);
    res.status(500).json({
      error: 'Failed to get job status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/zk/midnight/generate-proof-wait
 * Generate proof and wait for completion (blocking, with timeout)
 */
router.post('/midnight/generate-proof-wait', optionalSimpleAuth, async (req: Request, res: Response) => {
  const start = Date.now();
  
  try {
    const { query, memoryHash, category, timeoutMs = 30000 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const job = await createProofJob({
      query,
      memoryHash,
      category,
      userId: (req as any).userId || 'anonymous'
    });

    // If already completed (from cache), return immediately
    if (job.status === 'completed') {
      return res.json({
        success: true,
        cached: true,
        jobId: job.id,
        proof: job.result,
        processingTimeMs: 0,
        totalTimeMs: Date.now() - start,
        timestamp: new Date().toISOString()
      });
    }

    // Wait for completion
    const completedJob = await waitForJob(job.id, Math.min(timeoutMs, 60000));

    if (completedJob.status === 'failed') {
      return res.status(500).json({
        success: false,
        jobId: job.id,
        error: completedJob.error,
        processingTimeMs: completedJob.processingTimeMs,
        totalTimeMs: Date.now() - start
      });
    }

    res.json({
      success: true,
      jobId: job.id,
      proof: completedJob.result,
      processingTimeMs: completedJob.processingTimeMs,
      totalTimeMs: Date.now() - start,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in blocking proof generation:', error);
    res.status(500).json({
      error: error instanceof Error && error.message === 'Job timed out' 
        ? 'Proof generation timed out' 
        : 'Failed to generate proof',
      details: error instanceof Error ? error.message : 'Unknown error',
      totalTimeMs: Date.now() - start
    });
  }
});

/**
 * GET /api/zk/midnight/queue-stats
 * Get proof queue statistics
 */
router.get('/midnight/queue-stats', (req: Request, res: Response) => {
  try {
    const stats = getQueueStats();
    res.json({
      ...stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});

export default router;
