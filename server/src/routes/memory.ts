/**
 * Memory Management Routes
 * 
 * Handles encrypted memory CRUD operations with DID/Wallet auth:
 * - Create/store memories with commitments
 * - Retrieve memories by ID, user, or tags
 * - Update memory metadata and status
 * - Delete/revoke memories (soft delete with compliance logging)
 * - Search by tags
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { hashData, generateNonce } from '../lib/crypto';
import { simpleAuthMiddleware } from '../lib/auth';
import {
  insertMemoryMetadata,
  updateMemoryMetadata,
  getMemoryMetadata,
  getMemoriesByUserId,
  getMemoryByCommitment,
  updateMemoryStatus,
  countMemoriesByUserId,
  insertComplianceLog,
  getLatestLogHash,
  MemoryMetadata,
  MemoryStatus
} from '../lib/database';

const router = Router();

// In-memory storage for encrypted content (in production, use secure blob storage)
const encryptedStore = new Map<string, {
  encryptedData: string;
  nonce: string;
  algorithm: string;
}>();

// ============================================================================
// Request/Response Types
// ============================================================================

interface CreateMemoryRequest {
  memoryCommitment: string;  // Poseidon hash of memory content
  tags?: string[];           // Memory tags for organization
  encryptedData?: string;    // Optional: Base64 encoded encrypted content
  nonce?: string;            // Optional: Encryption nonce
  confidence?: number;       // Confidence score (0-1)
}

interface UpdateMemoryRequest {
  tags?: string[];
  status?: MemoryStatus;
  confidence?: number;
}

interface ListMemoriesQuery {
  status?: MemoryStatus;
  tags?: string;
  limit?: string;
  offset?: string;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/memory
 * 
 * Store a new memory with commitment
 * Requires authentication via x-user-id or x-did-wallet header
 */
router.post('/', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { memoryCommitment, tags, encryptedData, nonce, confidence } = req.body as CreateMemoryRequest;
    const user = req.user!;

    if (!memoryCommitment) {
      return res.status(400).json({
        success: false,
        error: 'memoryCommitment is required'
      });
    }

    // Validate commitment format (should be a hex hash)
    if (!/^[a-fA-F0-9]{16,128}$/.test(memoryCommitment)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid memoryCommitment format (expected hex hash)'
      });
    }

    // Check if commitment already exists
    const existing = getMemoryByCommitment(memoryCommitment);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Memory with this commitment already exists',
        memoryId: existing.id
      });
    }

    // Generate memory ID
    const memoryId = `mem_${crypto.randomBytes(12).toString('hex')}`;
    const now = new Date().toISOString();

    // Generate key ID for this memory (derived from user + timestamp)
    const keyId = `key_${(await hashData(user.id + now)).slice(0, 16)}`;

    // Compute content hash (from encrypted data if provided, otherwise from commitment)
    const contentHash = encryptedData 
      ? await hashData(encryptedData) 
      : await hashData(memoryCommitment);

    // Store encrypted content if provided
    if (encryptedData && nonce) {
      encryptedStore.set(memoryId, {
        encryptedData,
        nonce,
        algorithm: 'XChaCha20-Poly1305'
      });
    }

    // Store metadata in database
    const metadata: MemoryMetadata = {
      id: memoryId,
      userId: user.id,
      keyId,
      memoryCommitment,
      contentHash,
      tags,
      confidence,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };
    insertMemoryMetadata(metadata);

    // Create compliance log
    const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
    const previousLogHash = getLatestLogHash();
    const logHash = await hashData(JSON.stringify({
      id: logId,
      action: 'memory_create',
      memoryId,
      userId: user.id,
      timestamp: now,
      previousLogHash
    }));

    insertComplianceLog({
      id: logId,
      userId: user.id,
      action: 'memory_create',
      memoryId,
      keyId,
      timestamp: now,
      metadata: { contentHash, tags, commitment: memoryCommitment },
      previousLogHash,
      logHash
    });

    res.status(201).json({
      success: true,
      memoryId,
      memoryCommitment,
      contentHash,
      status: 'ACTIVE',
      createdAt: now
    });
  } catch (error) {
    console.error('[Memory] Create error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store memory'
    });
  }
});

/**
 * GET /api/memory
 * 
 * List memories for the authenticated user
 * Supports filtering by status and tags
 */
router.get('/', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const query = req.query as ListMemoriesQuery;

    // Parse query parameters
    const options: {
      status?: MemoryStatus;
      tags?: string[];
      limit?: number;
      offset?: number;
    } = {};

    if (query.status && ['ACTIVE', 'DELETED', 'REVOKED'].includes(query.status)) {
      options.status = query.status as MemoryStatus;
    }

    if (query.tags) {
      options.tags = query.tags.split(',').map(t => t.trim());
    }

    if (query.limit) {
      options.limit = Math.min(parseInt(query.limit) || 50, 100);
    }

    if (query.offset) {
      options.offset = parseInt(query.offset) || 0;
    }

    // Get memories
    const memories = getMemoriesByUserId(user.id, options);
    const totalCount = countMemoriesByUserId(user.id, options.status);

    res.json({
      success: true,
      memories: memories.map(m => ({
        id: m.id,
        memoryCommitment: m.memoryCommitment,
        tags: m.tags,
        status: m.status,
        confidence: m.confidence,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt
      })),
      pagination: {
        total: totalCount,
        limit: options.limit || 50,
        offset: options.offset || 0,
        hasMore: (options.offset || 0) + memories.length < totalCount
      }
    });
  } catch (error) {
    console.error('[Memory] List error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list memories'
    });
  }
});

/**
 * GET /api/memory/search/tags
 * 
 * Search memories by tags
 * Note: This route must be defined BEFORE /:memoryId to avoid conflicts
 */
router.get('/search/tags', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { tags, match = 'any' } = req.query;

    if (!tags) {
      return res.status(400).json({
        success: false,
        error: 'tags query parameter is required'
      });
    }

    const tagList = (tags as string).split(',').map(t => t.trim());

    // Get all user memories with any of the tags
    const memories = getMemoriesByUserId(user.id, {
      status: 'ACTIVE',
      tags: tagList
    });

    // If match is 'all', filter to only memories that have ALL tags
    let filteredMemories = memories;
    if (match === 'all') {
      filteredMemories = memories.filter(m => 
        tagList.every(tag => m.tags?.includes(tag))
      );
    }

    res.json({
      success: true,
      query: { tags: tagList, match },
      count: filteredMemories.length,
      memories: filteredMemories.map(m => ({
        id: m.id,
        memoryCommitment: m.memoryCommitment,
        tags: m.tags,
        status: m.status,
        createdAt: m.createdAt
      }))
    });
  } catch (error) {
    console.error('[Memory] Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search memories'
    });
  }
});

/**
 * GET /api/memory/commitment/:commitment
 * 
 * Look up a memory by its commitment hash
 */
router.get('/commitment/:commitment', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { commitment } = req.params;
    const user = req.user!;

    const memory = getMemoryByCommitment(commitment);

    if (!memory) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found'
      });
    }

    // Verify ownership
    if (memory.userId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      memoryId: memory.id,
      memoryCommitment: memory.memoryCommitment,
      tags: memory.tags,
      status: memory.status,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt
    });
  } catch (error) {
    console.error('[Memory] Commitment lookup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to look up memory by commitment'
    });
  }
});

/**
 * GET /api/memory/:memoryId
 * 
 * Retrieve a specific memory
 * Requires authentication and ownership
 */
router.get('/:memoryId', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { memoryId } = req.params;
    const user = req.user!;

    // Get metadata
    const metadata = getMemoryMetadata(memoryId);

    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found'
      });
    }

    // Verify ownership
    if (metadata.userId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get encrypted content if stored
    const encryptedContent = encryptedStore.get(memoryId);

    // Log access
    const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const previousLogHash = getLatestLogHash();
    const logHash = await hashData(JSON.stringify({
      id: logId,
      action: 'memory_access',
      memoryId,
      userId: user.id,
      timestamp: now,
      previousLogHash
    }));

    insertComplianceLog({
      id: logId,
      userId: user.id,
      action: 'memory_access',
      memoryId,
      keyId: metadata.keyId,
      timestamp: now,
      previousLogHash,
      logHash
    });

    const response: Record<string, unknown> = {
      success: true,
      memoryId,
      memoryCommitment: metadata.memoryCommitment,
      contentHash: metadata.contentHash,
      tags: metadata.tags,
      status: metadata.status,
      confidence: metadata.confidence,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt
    };

    // Include encrypted content if available
    if (encryptedContent) {
      response.encryptedData = encryptedContent.encryptedData;
      response.nonce = encryptedContent.nonce;
      response.algorithm = encryptedContent.algorithm;
    }

    res.json(response);
  } catch (error) {
    console.error('[Memory] Get error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve memory'
    });
  }
});

/**
 * PATCH /api/memory/:memoryId
 * 
 * Update memory metadata (tags, status, confidence)
 * Requires authentication and ownership
 */
router.patch('/:memoryId', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { memoryId } = req.params;
    const { tags, status, confidence } = req.body as UpdateMemoryRequest;
    const user = req.user!;

    // Get metadata
    const metadata = getMemoryMetadata(memoryId);

    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found'
      });
    }

    // Verify ownership
    if (metadata.userId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const now = new Date().toISOString();
    const updates: Partial<MemoryMetadata> = {};

    if (tags !== undefined) {
      updates.tags = tags;
    }

    if (confidence !== undefined) {
      updates.confidence = confidence;
    }

    // Handle status change
    if (status && ['ACTIVE', 'DELETED', 'REVOKED'].includes(status)) {
      updateMemoryStatus(memoryId, status);
    }

    // Apply other updates
    if (Object.keys(updates).length > 0) {
      updateMemoryMetadata(memoryId, updates);
    }

    // Create compliance log
    const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
    const previousLogHash = getLatestLogHash();
    const logHash = await hashData(JSON.stringify({
      id: logId,
      action: 'memory_update',
      memoryId,
      userId: user.id,
      timestamp: now,
      previousLogHash
    }));

    insertComplianceLog({
      id: logId,
      userId: user.id,
      action: 'memory_update',
      memoryId,
      keyId: metadata.keyId,
      timestamp: now,
      metadata: { updates: { tags, status, confidence } },
      previousLogHash,
      logHash
    });

    // Get updated metadata
    const updated = getMemoryMetadata(memoryId);

    res.json({
      success: true,
      memoryId,
      memoryCommitment: updated?.memoryCommitment,
      tags: updated?.tags,
      status: updated?.status,
      confidence: updated?.confidence,
      updatedAt: updated?.updatedAt
    });
  } catch (error) {
    console.error('[Memory] Update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update memory'
    });
  }
});

/**
 * DELETE /api/memory/:memoryId
 * 
 * Soft delete a memory (marks as DELETED)
 * Requires authentication and ownership
 */
router.delete('/:memoryId', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { memoryId } = req.params;
    const user = req.user!;

    // Get metadata
    const metadata = getMemoryMetadata(memoryId);

    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found'
      });
    }

    // Verify ownership
    if (metadata.userId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const now = new Date().toISOString();

    // Soft delete
    updateMemoryStatus(memoryId, 'DELETED');

    // Remove encrypted content from memory
    encryptedStore.delete(memoryId);

    // Create compliance log
    const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
    const previousLogHash = getLatestLogHash();
    const logHash = await hashData(JSON.stringify({
      id: logId,
      action: 'memory_delete',
      memoryId,
      userId: user.id,
      timestamp: now,
      previousLogHash
    }));

    insertComplianceLog({
      id: logId,
      userId: user.id,
      action: 'memory_delete',
      memoryId,
      keyId: metadata.keyId,
      timestamp: now,
      metadata: { previousStatus: metadata.status },
      previousLogHash,
      logHash
    });

    res.json({
      success: true,
      memoryId,
      status: 'DELETED',
      deletedAt: now
    });
  } catch (error) {
    console.error('[Memory] Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete memory'
    });
  }
});

/**
 * POST /api/memory/:memoryId/revoke
 * 
 * Revoke a memory (stronger than delete, for compliance)
 * Requires authentication and ownership
 */
router.post('/:memoryId/revoke', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { memoryId } = req.params;
    const { reason } = req.body;
    const user = req.user!;

    // Get metadata
    const metadata = getMemoryMetadata(memoryId);

    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found'
      });
    }

    // Verify ownership
    if (metadata.userId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const now = new Date().toISOString();

    // Revoke
    updateMemoryStatus(memoryId, 'REVOKED');

    // Remove encrypted content from memory
    encryptedStore.delete(memoryId);

    // Create compliance log with reason
    const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
    const previousLogHash = getLatestLogHash();
    const logHash = await hashData(JSON.stringify({
      id: logId,
      action: 'memory_revoke',
      memoryId,
      userId: user.id,
      timestamp: now,
      previousLogHash
    }));

    insertComplianceLog({
      id: logId,
      userId: user.id,
      action: 'memory_revoke',
      memoryId,
      keyId: metadata.keyId,
      timestamp: now,
      metadata: { 
        previousStatus: metadata.status,
        reason: reason || 'User requested revocation'
      },
      previousLogHash,
      logHash
    });

    res.json({
      success: true,
      memoryId,
      status: 'REVOKED',
      revokedAt: now,
      reason: reason || 'User requested revocation'
    });
  } catch (error) {
    console.error('[Memory] Revoke error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke memory'
    });
  }
});

export default router;
