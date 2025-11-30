/**
 * Merkle Tree Routes
 * 
 * API endpoints for Merkle tree operations:
 * - Insert commitments
 * - Generate proofs
 * - Verify proofs
 * - Get tree status
 */

import { Router, Request, Response } from 'express';
import { simpleAuthMiddleware, optionalSimpleAuth } from '../lib/auth';
import { 
  getMerkleTreeManager, 
  SparseMerkleTree, 
  MerkleProof 
} from '../lib/merkleTree';
import { insertComplianceLog, getLatestLogHash } from '../lib/database';
import { hashData } from '../lib/crypto';
import crypto from 'crypto';

const router = Router();

// ============================================================================
// Commitment Management
// ============================================================================

/**
 * POST /api/merkle/insert
 * 
 * Insert a new commitment into the user's Merkle tree.
 * 
 * Request body:
 * {
 *   "commitment": "<poseidon hash string>"
 * }
 */
router.post('/insert', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { commitment } = req.body;
    const user = req.user!;

    if (!commitment) {
      return res.status(400).json({
        result: 'error',
        message: 'commitment is required'
      });
    }

    const manager = getMerkleTreeManager();
    
    try {
      const result = await manager.insertCommitment(user.id, commitment);
      
      console.log(`[Merkle] Inserted commitment for user ${user.id}`);
      console.log(`[Merkle]   Index: ${result.index}`);
      console.log(`[Merkle]   Old root: ${result.oldRoot.slice(0, 20)}...`);
      console.log(`[Merkle]   New root: ${result.newRoot.slice(0, 20)}...`);

      // Log compliance
      const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
      const previousLogHash = getLatestLogHash();
      const logHash = await hashData(JSON.stringify({
        id: logId,
        action: 'merkle_insert',
        userId: user.id,
        timestamp: new Date().toISOString(),
        previousLogHash
      }));

      insertComplianceLog({
        id: logId,
        userId: user.id,
        action: 'merkle_insert',
        keyId: 'merkle_tree',
        timestamp: new Date().toISOString(),
        metadata: {
          commitment: commitment.slice(0, 32) + '...',
          index: result.index.toString(),
          oldRoot: result.oldRoot,
          newRoot: result.newRoot
        },
        previousLogHash,
        logHash
      });

      res.json({
        result: 'ok',
        index: result.index.toString(),
        oldRoot: result.oldRoot,
        newRoot: result.newRoot,
        commitment: commitment.slice(0, 32) + '...'
      });
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        return res.status(409).json({
          result: 'error',
          message: 'Commitment already exists in tree'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('[Merkle] Insert error:', error);
    res.status(500).json({
      result: 'error',
      message: 'Failed to insert commitment'
    });
  }
});

/**
 * POST /api/merkle/insert/batch
 * 
 * Insert multiple commitments at once.
 * 
 * Request body:
 * {
 *   "commitments": ["<hash1>", "<hash2>", ...]
 * }
 */
router.post('/insert/batch', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { commitments } = req.body;
    const user = req.user!;

    if (!Array.isArray(commitments) || commitments.length === 0) {
      return res.status(400).json({
        result: 'error',
        message: 'commitments array is required'
      });
    }

    if (commitments.length > 100) {
      return res.status(400).json({
        result: 'error',
        message: 'Maximum 100 commitments per batch'
      });
    }

    const manager = getMerkleTreeManager();
    const tree = await manager.getTree(user.id);
    const result = await tree.insertBatch(commitments);

    console.log(`[Merkle] Batch inserted ${commitments.length} commitments for user ${user.id}`);

    res.json({
      result: 'ok',
      oldRoot: result.oldRoot,
      newRoot: result.newRoot,
      insertedCount: result.insertedLeaves.length,
      indices: result.insertedIndices.map(i => i.toString())
    });
  } catch (error) {
    console.error('[Merkle] Batch insert error:', error);
    res.status(500).json({
      result: 'error',
      message: 'Failed to insert commitments'
    });
  }
});

// ============================================================================
// Proof Generation and Verification
// ============================================================================

/**
 * POST /api/merkle/proof
 * 
 * Generate a Merkle proof for a commitment.
 * 
 * Request body:
 * {
 *   "commitment": "<poseidon hash string>"
 * }
 */
router.post('/proof', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { commitment } = req.body;
    const user = req.user!;

    if (!commitment) {
      return res.status(400).json({
        result: 'error',
        message: 'commitment is required'
      });
    }

    const manager = getMerkleTreeManager();
    
    try {
      const proof = await manager.generateProof(user.id, commitment);
      
      console.log(`[Merkle] Generated proof for user ${user.id}`);
      console.log(`[Merkle]   Leaf index: ${proof.leafIndex}`);
      console.log(`[Merkle]   Path length: ${proof.siblings.length}`);

      res.json({
        result: 'ok',
        proof: {
          leaf: proof.leaf,
          leafIndex: proof.leafIndex.toString(),
          siblings: proof.siblings,
          pathIndices: proof.pathIndices,
          root: proof.root
        }
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({
          result: 'error',
          message: 'Commitment not found in tree'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('[Merkle] Proof generation error:', error);
    res.status(500).json({
      result: 'error',
      message: 'Failed to generate proof'
    });
  }
});

/**
 * POST /api/merkle/verify
 * 
 * Verify a Merkle proof (public endpoint).
 * 
 * Request body:
 * {
 *   "proof": {
 *     "leaf": "<hash>",
 *     "leafIndex": "<index>",
 *     "siblings": ["<hash1>", ...],
 *     "pathIndices": [0, 1, ...],
 *     "root": "<root hash>"
 *   }
 * }
 */
router.post('/verify', optionalSimpleAuth(), async (req: Request, res: Response) => {
  try {
    const { proof } = req.body;

    if (!proof || !proof.leaf || !proof.siblings || !proof.pathIndices || !proof.root) {
      return res.status(400).json({
        result: 'error',
        message: 'Complete proof object is required'
      });
    }

    // Reconstruct proof with bigint
    const merkleProof: MerkleProof = {
      leaf: proof.leaf,
      leafIndex: BigInt(proof.leafIndex),
      siblings: proof.siblings,
      pathIndices: proof.pathIndices,
      root: proof.root
    };

    const manager = getMerkleTreeManager();
    const valid = await manager.verifyProof(merkleProof);

    console.log(`[Merkle] Verification result: ${valid ? 'VALID' : 'INVALID'}`);

    res.json({
      result: 'ok',
      valid,
      leaf: proof.leaf.slice(0, 32) + '...',
      root: proof.root.slice(0, 32) + '...'
    });
  } catch (error) {
    console.error('[Merkle] Verification error:', error);
    res.status(500).json({
      result: 'error',
      message: 'Failed to verify proof'
    });
  }
});

// ============================================================================
// Revocation
// ============================================================================

/**
 * POST /api/merkle/revoke
 * 
 * Revoke a commitment (updates the leaf to a revocation marker).
 * 
 * Request body:
 * {
 *   "commitment": "<original commitment hash>"
 * }
 */
router.post('/revoke', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { commitment } = req.body;
    const user = req.user!;

    if (!commitment) {
      return res.status(400).json({
        result: 'error',
        message: 'commitment is required'
      });
    }

    const manager = getMerkleTreeManager();
    
    try {
      const result = await manager.revokeCommitment(user.id, commitment);
      
      console.log(`[Merkle] Revoked commitment for user ${user.id}`);
      console.log(`[Merkle]   Old root: ${result.oldRoot.slice(0, 20)}...`);
      console.log(`[Merkle]   New root: ${result.newRoot.slice(0, 20)}...`);

      // Log compliance
      const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
      const previousLogHash = getLatestLogHash();
      const logHash = await hashData(JSON.stringify({
        id: logId,
        action: 'merkle_revoke',
        userId: user.id,
        timestamp: new Date().toISOString(),
        previousLogHash
      }));

      insertComplianceLog({
        id: logId,
        userId: user.id,
        action: 'merkle_revoke',
        keyId: 'merkle_tree',
        timestamp: new Date().toISOString(),
        metadata: {
          commitment: commitment.slice(0, 32) + '...',
          revocationMarker: result.revocationMarker.slice(0, 32) + '...',
          oldRoot: result.oldRoot,
          newRoot: result.newRoot
        },
        previousLogHash,
        logHash
      });

      res.json({
        result: 'ok',
        oldRoot: result.oldRoot,
        newRoot: result.newRoot,
        revocationMarker: result.revocationMarker,
        commitment: commitment.slice(0, 32) + '...'
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return res.status(404).json({
          result: 'error',
          message: 'Commitment not found in tree'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('[Merkle] Revocation error:', error);
    res.status(500).json({
      result: 'error',
      message: 'Failed to revoke commitment'
    });
  }
});

// ============================================================================
// Status and Stats
// ============================================================================

/**
 * GET /api/merkle/status
 * 
 * Get the current tree status for the authenticated user.
 */
router.get('/status', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const manager = getMerkleTreeManager();
    const stats = await manager.getStats(user.id);

    res.json({
      result: 'ok',
      depth: stats.depth,
      leafCount: stats.leafCount.toString(),
      maxLeaves: stats.maxLeaves.toString(),
      nodeCount: stats.nodeCount,
      root: stats.rootHash,
      utilizationPercent: stats.utilizationPercent
    });
  } catch (error) {
    console.error('[Merkle] Status error:', error);
    res.status(500).json({
      result: 'error',
      message: 'Failed to get tree status'
    });
  }
});

/**
 * GET /api/merkle/root
 * 
 * Get the current root hash for the authenticated user.
 */
router.get('/root', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const manager = getMerkleTreeManager();
    const root = await manager.getRoot(user.id);

    res.json({
      result: 'ok',
      root
    });
  } catch (error) {
    console.error('[Merkle] Root error:', error);
    res.status(500).json({
      result: 'error',
      message: 'Failed to get root hash'
    });
  }
});

/**
 * GET /api/merkle/stats (admin)
 * 
 * Get overall manager statistics.
 */
router.get('/stats', optionalSimpleAuth(), (req: Request, res: Response) => {
  const manager = getMerkleTreeManager();
  const stats = manager.getManagerStats();

  res.json({
    result: 'ok',
    userCount: stats.userCount,
    totalLeaves: stats.totalLeaves.toString(),
    users: stats.users.map(u => ({
      userId: u.userId.slice(0, 8) + '...',
      leafCount: u.leafCount.toString(),
      root: u.root.slice(0, 32) + '...'
    }))
  });
});

export default router;
