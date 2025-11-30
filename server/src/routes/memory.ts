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
import { inMemoryDb } from '../lib/database';

const router = Router();

// Use the in-memory store from database module
const db = inMemoryDb;

/**
 * Helper: Extract and validate x-user-id header
 */
function requireUserId(req: Request, res: Response): string | null {
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return null;
  }
  return userId;
}

/**
 * Validate memoryCommitment format (64 hex chars)
 */
function isValidCommitment(s: unknown): boolean {
  return typeof s === 'string' && /^[0-9a-fA-F]{64}$/.test(s);
}

/**
 * POST /api/memory
 * Create a new memory
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { memoryCommitment, tags = [] } = req.body || {};
    
    if (!isValidCommitment(memoryCommitment)) {
      return res.status(400).json({ success: false, error: 'invalid memoryCommitment' });
    }

    // Check for duplicate commitment
    for (const m of db.MemoryStore.values()) {
      if (m.memoryCommitment === memoryCommitment) {
        return res.status(409).json({ success: false, error: 'memoryCommitment already exists' });
      }
    }

    const memoryId = 'mem_' + crypto.randomBytes(8).toString('hex');
    const record = {
      memoryId,
      memoryCommitment,
      tags,
      owner: userId,
      status: 'ACTIVE',
      createdAt: Date.now()
    };
    db.MemoryStore.set(memoryId, record);

    return res.status(201).json({ success: true, memoryId, memoryCommitment });
  } catch (err) {
    console.error('POST /api/memory', err);
    return res.status(500).json({ success: false, error: 'internal error' });
  }
});

/**
 * GET /api/memory
 * List memories for authenticated user
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const status = req.query.status as string | undefined;
    const tags = req.query.tags as string | undefined;

    let list = Array.from(db.MemoryStore.values()).filter(
      (m) => m.owner === userId && m.status !== 'DELETED'
    );

    if (status) {
      list = list.filter((m) => m.status === status);
    }
    if (tags) {
      list = list.filter((m) => m.tags && m.tags.includes(tags));
    }

    return res.status(200).json({
      success: true,
      memories: list,
      pagination: { total: list.length }
    });
  } catch (err) {
    console.error('GET /api/memory', err);
    return res.status(500).json({ success: false, error: 'internal error' });
  }
});

/**
 * GET /api/memory/:memoryId
 * Get specific memory by ID
 */
router.get('/:memoryId', (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const m = db.MemoryStore.get(req.params.memoryId);
    if (!m) {
      return res.status(404).json({ success: false, error: 'not found' });
    }
    if (m.owner !== userId) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }
    if (m.status === 'DELETED') {
      return res.status(404).json({ success: false, error: 'not found' });
    }

    return res.status(200).json({ success: true, memoryId: m.memoryId, memory: m });
  } catch (err) {
    console.error('GET /api/memory/:id', err);
    return res.status(500).json({ success: false, error: 'internal error' });
  }
});

/**
 * PATCH /api/memory/:memoryId
 * Update memory metadata (tags, etc.)
 */
router.patch('/:memoryId', (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const m = db.MemoryStore.get(req.params.memoryId);
    if (!m) {
      return res.status(404).json({ success: false, error: 'not found' });
    }
    if (m.owner !== userId) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    const { tags } = req.body || {};
    if (tags) {
      m.tags = tags;
    }
    db.MemoryStore.set(m.memoryId, m);

    return res.status(200).json({ success: true, tags: m.tags });
  } catch (err) {
    console.error('PATCH /api/memory/:id', err);
    return res.status(500).json({ success: false, error: 'internal error' });
  }
});

/**
 * DELETE /api/memory/:memoryId
 * Soft delete a memory
 */
router.delete('/:memoryId', (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const m = db.MemoryStore.get(req.params.memoryId);
    if (!m) {
      return res.status(404).json({ success: false, error: 'not found' });
    }
    if (m.owner !== userId) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    m.status = 'DELETED';
    db.MemoryStore.set(m.memoryId, m);

    return res.status(200).json({ success: true, status: 'DELETED' });
  } catch (err) {
    console.error('DELETE /api/memory/:id', err);
    return res.status(500).json({ success: false, error: 'internal error' });
  }
});

/**
 * POST /api/memory/:memoryId/revoke
 * Revoke a memory with reason
 */
router.post('/:memoryId/revoke', (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const m = db.MemoryStore.get(req.params.memoryId);
    if (!m) {
      return res.status(404).json({ success: false, error: 'not found' });
    }
    if (m.owner !== userId) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    const { reason } = req.body || {};
    m.status = 'REVOKED';
    m.reason = reason || 'unspecified';
    db.MemoryStore.set(m.memoryId, m);

    return res.status(200).json({ success: true, status: 'REVOKED', reason: m.reason });
  } catch (err) {
    console.error('POST /api/memory/:id/revoke', err);
    return res.status(500).json({ success: false, error: 'internal error' });
  }
});

export default router;
