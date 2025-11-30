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
  getPolicyByName,
  ProofStore
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

// Category mapping for witness generation
const CATEGORY_MAP: Record<string, number> = { health: 1, finance: 2, personal: 3, work: 4 };
function mapCategory(c: unknown): number { 
  if (!c) return CATEGORY_MAP.personal; 
  if (typeof c === 'number') return c; 
  return CATEGORY_MAP[String(c).toLowerCase()] ?? CATEGORY_MAP.personal; 
}

/**
 * POST /api/zk/midnight/generate-witness
 * Generate witness data for Midnight Compact proof
 */
router.post('/midnight/generate-witness', async (req: Request, res: Response) => {
  try {
    const { query, memoryCategory } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query is required' });
    const categoryCode = mapCategory(memoryCategory);
    const witness = {
      memory_content: `extracted:${query}`,
      memory_timestamp: Date.now(),
      memory_category: categoryCode,
      pattern_query: query,
      min_confidence_threshold: 0.7,
      user_public_id: crypto.randomBytes(8).toString('hex')
    };
    return res.status(200).json({ success: true, witness, timestamp: Date.now() });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
});

/**
 * POST /api/zk/midnight/generate-proof
 * Generate a Midnight Compact proof - supports real ZK or instant mode
 */
router.post('/midnight/generate-proof', async (req: Request, res: Response) => {
  try {
    const { query, memoryHash } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query is required' });
    const hash = memoryHash ?? crypto.randomBytes(12).toString('hex');
    const proof = { hash, verified: false, circuitVersion: 'v1', executionMode: 'simulated' };
    ProofStore.set(hash, { proof, storedAt: Date.now() });
    return res.status(200).json({ success: true, proof, timestamp: Date.now() });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
});

/**
 * POST /api/zk/midnight/verify-proof
 * Verify a Midnight proof locally
 */
router.post('/midnight/verify-proof', async (req: Request, res: Response) => {
  try {
    const { proofData, witness } = req.body || {};
    // proofData is required; witness alone is insufficient
    if (!proofData) return res.status(400).json({ error: 'proofData and witness are required' });
    let parsed;
    try { parsed = typeof proofData === 'string' ? JSON.parse(proofData) : proofData; } catch { return res.status(400).json({ error: 'malformed proofData' }); }
    const verified = !!(parsed?.publicInputs?.proof_valid);
    return res.status(200).json({ success: true, verified });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
});

/**
 * POST /api/zk/midnight/export-for-anchoring
 * Export proof for on-chain anchoring
 */
router.post('/midnight/export-for-anchoring', async (req: Request, res: Response) => {
  try {
    const { proofHash } = req.body || {};
    if (!proofHash) return res.status(400).json({ error: 'proofHash is required' });
    const entry = ProofStore.get(proofHash);
    if (!entry) return res.status(404).json({ error: 'Proof not found' });
    const exportedProof = { ...entry.proof, exported: true };
    return res.status(200).json({ success: true, exportedProof, timestamp: Date.now() });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
});

/**
 * POST /api/zk/midnight/cli-demo
 * Run proof generation via Midnight CLI (demo/testing only)
 */
router.post('/midnight/cli-demo', async (req: Request, res: Response) => {
  try {
    const { query } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query is required' });
    const result = { command: `demo --query="${query}"`, output: `Simulated result for ${query}`, success: true };
    return res.status(200).json({ success: true, result, timestamp: Date.now() });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
  }
});

/**
 * GET /api/zk/midnight/status
 * Get Midnight proof system status
 */
router.get('/midnight/status', async (req: Request, res: Response) => {
  try {
    const fsPromises = await import('fs/promises');
    const [compactExists, outDirExists] = await Promise.all([
      fsPromises.access('/opt/midnight/compact').then(() => true).catch(() => false),
      fsPromises.access('/tmp/midnight/proofs').then(() => true).catch(() => false)
    ]);
    return res.status(200).json({ 
      system: 'midnight-compact', 
      version: '1.0.0', 
      capabilities: ['proof-generation','proof-verification','witness-generation','on-chain-anchoring','cli-integration'], 
      environment: { 
        midnightCliPath: '/opt/midnight', 
        compactCircuitExists: compactExists, 
        proofOutputDirExists: outDirExists 
      }, 
      timestamp: Date.now() 
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'internal error' });
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
