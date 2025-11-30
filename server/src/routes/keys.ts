/**
 * Key Management Routes
 * 
 * Handles cryptographic key lifecycle:
 * - Key rotation (create new key, revoke old)
 * - Key revocation
 * - Key history
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { hashData } from '../lib/crypto';
import { simpleAuthMiddleware } from '../lib/auth';
import {
  insertUserKey,
  getActiveUserKey,
  getUserKeyById,
  getLatestKeyVersion,
  revokeUserKey,
  getUserKeys,
  insertKeyRotation,
  getKeyRotations,
  insertComplianceLog,
  getLatestLogHash,
  UserKey,
  KeyRotationRecord
} from '../lib/database';

const router = Router();

interface RotateKeyRequest {
  reason?: string;
}

interface RevokeKeyRequest {
  keyId: string;
  reason?: string;
}

/**
 * POST /api/keys/rotate
 * 
 * Rotate the current key to a new key version
 * - Marks previous key as REVOKED (if any)
 * - Creates new key with incremented keyVersion
 * - Logs compliance events
 */
router.post('/rotate', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { reason } = req.body as RotateKeyRequest;
    const now = new Date().toISOString();

    // Get current active key (if any)
    const currentKey = getActiveUserKey(user.id);
    
    // Get latest version number
    const latestVersion = getLatestKeyVersion(user.id);
    const newVersion = latestVersion + 1;

    // Generate new key ID
    const newKeyId = `key_${crypto.randomBytes(12).toString('hex')}`;

    // Create new key
    const newKey: UserKey = {
      id: newKeyId,
      userId: user.id,
      keyVersion: newVersion,
      status: 'ACTIVE',
      createdAt: now
    };
    insertUserKey(newKey);

    // If there was an active key, revoke it and log rotation
    if (currentKey) {
      revokeUserKey(currentKey.id);

      // Record rotation
      const rotationId = `rot_${crypto.randomBytes(8).toString('hex')}`;
      const rotation: KeyRotationRecord = {
        id: rotationId,
        oldKeyId: currentKey.id,
        newKeyId: newKeyId,
        rotatedAt: now,
        reason
      };
      insertKeyRotation(rotation);

      // Log compliance event for old key (revoke)
      const revokeLogId = `log_${crypto.randomBytes(8).toString('hex')}`;
      const prevHash1 = getLatestLogHash();
      const revokeLogHash = await hashData(JSON.stringify({
        id: revokeLogId,
        action: 'key_revoked',
        userId: user.id,
        keyId: currentKey.id,
        timestamp: now,
        previousLogHash: prevHash1
      }));

      insertComplianceLog({
        id: revokeLogId,
        userId: user.id,
        action: 'key_revoked',
        keyId: currentKey.id,
        timestamp: now,
        metadata: {
          event: 'key_rotation_revoke',
          oldVersion: currentKey.keyVersion,
          reason
        },
        previousLogHash: prevHash1,
        logHash: revokeLogHash
      });
    }

    // Log compliance event for new key (create)
    const createLogId = `log_${crypto.randomBytes(8).toString('hex')}`;
    const prevHash2 = getLatestLogHash();
    const createLogHash = await hashData(JSON.stringify({
      id: createLogId,
      action: 'key_created',
      userId: user.id,
      keyId: newKeyId,
      timestamp: now,
      previousLogHash: prevHash2
    }));

    insertComplianceLog({
      id: createLogId,
      userId: user.id,
      action: 'key_created',
      keyId: newKeyId,
      timestamp: now,
      metadata: {
        event: 'key_rotation_create',
        version: newVersion,
        previousKeyId: currentKey?.id,
        reason
      },
      previousLogHash: prevHash2,
      logHash: createLogHash
    });

    res.json({
      success: true,
      keyId: newKeyId,
      keyVersion: newVersion,
      previousKeyId: currentKey?.id || null,
      previousKeyRevoked: !!currentKey,
      rotatedAt: now,
      message: 'Key rotated successfully'
    });
  } catch (error) {
    console.error('[Keys] Rotation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rotate key'
    });
  }
});

/**
 * POST /api/keys/revoke
 * 
 * Revoke a specific key by ID (emergency use)
 */
router.post('/revoke', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { keyId, reason } = req.body as RevokeKeyRequest;
    const now = new Date().toISOString();

    if (!keyId) {
      return res.status(400).json({
        success: false,
        error: 'keyId is required'
      });
    }

    // Get the key to revoke
    const key = getUserKeyById(keyId);
    
    if (!key) {
      return res.status(404).json({
        success: false,
        error: 'Key not found'
      });
    }

    // Ensure user owns this key
    if (key.userId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to revoke this key'
      });
    }

    // Check if already revoked
    if (key.status === 'REVOKED') {
      return res.status(409).json({
        success: false,
        error: 'Key is already revoked',
        revokedAt: key.revokedAt
      });
    }

    // Revoke the key
    revokeUserKey(keyId);

    // Log compliance event
    const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
    const previousLogHash = getLatestLogHash();
    const logHash = await hashData(JSON.stringify({
      id: logId,
      action: 'key_revoked',
      userId: user.id,
      keyId,
      timestamp: now,
      previousLogHash
    }));

    insertComplianceLog({
      id: logId,
      userId: user.id,
      action: 'key_revoked',
      keyId,
      timestamp: now,
      metadata: {
        event: 'manual_revocation',
        version: key.keyVersion,
        reason
      },
      previousLogHash,
      logHash
    });

    res.json({
      success: true,
      keyId,
      keyVersion: key.keyVersion,
      revokedAt: now,
      message: 'Key revoked successfully'
    });
  } catch (error) {
    console.error('[Keys] Revocation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke key'
    });
  }
});

/**
 * GET /api/keys
 * 
 * List all keys for the authenticated user
 */
router.get('/', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    
    const keys = getUserKeys(user.id);
    const activeKey = keys.find(k => k.status === 'ACTIVE');

    res.json({
      success: true,
      activeKeyId: activeKey?.id || null,
      activeVersion: activeKey?.keyVersion || null,
      keys: keys.map(k => ({
        id: k.id,
        version: k.keyVersion,
        status: k.status,
        createdAt: k.createdAt,
        revokedAt: k.revokedAt
      })),
      count: keys.length
    });
  } catch (error) {
    console.error('[Keys] List error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list keys'
    });
  }
});

/**
 * GET /api/keys/history
 * 
 * Get key rotation history for the authenticated user
 */
router.get('/history', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    
    const keys = getUserKeys(user.id);
    const rotations: KeyRotationRecord[] = [];
    
    // Get all rotations for user's keys
    for (const key of keys) {
      const keyRotations = getKeyRotations(key.id);
      rotations.push(...keyRotations);
    }

    // Dedupe and sort by date
    const uniqueRotations = [...new Map(rotations.map(r => [r.id, r])).values()]
      .sort((a, b) => new Date(b.rotatedAt).getTime() - new Date(a.rotatedAt).getTime());

    res.json({
      success: true,
      rotations: uniqueRotations.map(r => ({
        id: r.id,
        oldKeyId: r.oldKeyId,
        newKeyId: r.newKeyId,
        rotatedAt: r.rotatedAt,
        reason: r.reason
      })),
      count: uniqueRotations.length
    });
  } catch (error) {
    console.error('[Keys] History error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get key history'
    });
  }
});

/**
 * GET /api/keys/status/:keyId
 * 
 * Check if a specific key is active or revoked
 */
router.get('/status/:keyId', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    const user = req.user!;

    const key = getUserKeyById(keyId);

    if (!key) {
      return res.status(404).json({
        success: false,
        error: 'Key not found'
      });
    }

    // Only allow checking own keys
    if (key.userId !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this key'
      });
    }

    res.json({
      success: true,
      keyId: key.id,
      version: key.keyVersion,
      status: key.status,
      isActive: key.status === 'ACTIVE',
      isRevoked: key.status === 'REVOKED',
      createdAt: key.createdAt,
      revokedAt: key.revokedAt
    });
  } catch (error) {
    console.error('[Keys] Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check key status'
    });
  }
});

export default router;
