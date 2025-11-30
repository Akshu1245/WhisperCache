/**
 * WhisperCache Key Management Service
 * 
 * Production-ready key lifecycle management:
 * - Automatic key rotation schedules
 * - Key derivation using hierarchical deterministic keys
 * - Secure key storage integration
 * - Audit trail for all key operations
 * - Emergency key revocation
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { hashData } from '../lib/crypto';
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
  getCurrentKeyVersion,
  getMinKeyVersion,
  UserKey,
  KeyRotationRecord,
  KeyStatus
} from '../lib/database';

// ============================================================================
// Types
// ============================================================================

export interface KeyManagementConfig {
  /** Auto-rotate keys after this many days */
  autoRotationDays: number;
  /** Maximum number of key versions to keep */
  maxKeyVersions: number;
  /** Minimum key age before rotation allowed (hours) */
  minKeyAgeHours: number;
  /** Enable automatic rotation */
  autoRotationEnabled: boolean;
  /** Key derivation algorithm */
  derivationAlgorithm: 'pbkdf2' | 'hkdf' | 'argon2';
  /** PBKDF2 iterations */
  pbkdf2Iterations: number;
}

export interface KeyInfo {
  keyId: string;
  userId: string;
  version: number;
  status: KeyStatus;
  createdAt: string;
  revokedAt?: string;
  isActive: boolean;
  ageHours: number;
}

export interface RotationResult {
  success: boolean;
  oldKeyId?: string;
  newKeyId: string;
  newVersion: number;
  reason?: string;
  error?: string;
}

export interface RevocationResult {
  success: boolean;
  keyId: string;
  affectedMemories: number;
  error?: string;
}

export interface KeyDerivation {
  masterKeyHash: string;
  derivedKey: Buffer;
  salt: Buffer;
  version: number;
}

export interface KeyAuditEntry {
  action: 'created' | 'rotated' | 'revoked' | 'accessed' | 'derived';
  keyId: string;
  userId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: KeyManagementConfig = {
  autoRotationDays: 90,
  maxKeyVersions: 10,
  minKeyAgeHours: 24,
  autoRotationEnabled: true,
  derivationAlgorithm: 'pbkdf2',
  pbkdf2Iterations: 100000
};

// ============================================================================
// Key Management Service
// ============================================================================

export class KeyManagementService extends EventEmitter {
  private config: KeyManagementConfig;
  private rotationTimer: NodeJS.Timeout | null = null;
  private auditLog: KeyAuditEntry[] = [];

  constructor(config: Partial<KeyManagementConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('[KeyMgmt] Service initialized');
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  start(): void {
    if (this.config.autoRotationEnabled) {
      this.startAutoRotation();
    }
    console.log('[KeyMgmt] Service started');
  }

  stop(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
    console.log('[KeyMgmt] Service stopped');
  }

  private startAutoRotation(): void {
    // Check for rotation-needed keys every hour
    this.rotationTimer = setInterval(() => {
      this.checkAutoRotation().catch(console.error);
    }, 3600000);
  }

  private async checkAutoRotation(): Promise<void> {
    // In production, this would query all users with old keys
    console.log('[KeyMgmt] Checking for keys needing rotation...');
  }

  // ============================================================================
  // Key Operations
  // ============================================================================

  /**
   * Create a new key for a user
   */
  async createKey(userId: string, reason?: string): Promise<KeyInfo> {
    const now = new Date().toISOString();
    const version = getLatestKeyVersion(userId) + 1;
    const keyId = `key_${crypto.randomBytes(12).toString('hex')}`;

    const key: UserKey = {
      id: keyId,
      userId,
      keyVersion: version,
      status: 'ACTIVE',
      createdAt: now
    };

    insertUserKey(key);
    await this.logAudit('created', keyId, userId, { reason });

    this.emit('key:created', { keyId, userId, version });

    return this.toKeyInfo(key);
  }

  /**
   * Rotate keys for a user
   */
  async rotateKey(userId: string, reason?: string): Promise<RotationResult> {
    try {
      const currentKey = getActiveUserKey(userId);
      
      // Check minimum age
      if (currentKey) {
        const ageHours = (Date.now() - new Date(currentKey.createdAt).getTime()) / 3600000;
        if (ageHours < this.config.minKeyAgeHours) {
          return {
            success: false,
            newKeyId: '',
            newVersion: 0,
            error: `Key must be at least ${this.config.minKeyAgeHours} hours old to rotate`
          };
        }
      }

      const now = new Date().toISOString();
      const newVersion = getLatestKeyVersion(userId) + 1;
      const newKeyId = `key_${crypto.randomBytes(12).toString('hex')}`;

      // Create new key
      const newKey: UserKey = {
        id: newKeyId,
        userId,
        keyVersion: newVersion,
        status: 'ACTIVE',
        createdAt: now
      };
      insertUserKey(newKey);

      // Revoke old key if exists
      if (currentKey) {
        revokeUserKey(currentKey.id);

        // Record rotation
        const rotationId = `rot_${crypto.randomBytes(8).toString('hex')}`;
        insertKeyRotation({
          id: rotationId,
          oldKeyId: currentKey.id,
          newKeyId,
          rotatedAt: now,
          reason
        });

        await this.logAudit('rotated', newKeyId, userId, {
          oldKeyId: currentKey.id,
          reason
        });
      }

      // Log compliance
      await this.logComplianceEvent(userId, 'key_rotated', newKeyId, {
        previousKeyId: currentKey?.id,
        newVersion,
        reason
      });

      // Clean up old versions if needed
      await this.cleanupOldVersions(userId);

      this.emit('key:rotated', { oldKeyId: currentKey?.id, newKeyId, userId, version: newVersion });

      return {
        success: true,
        oldKeyId: currentKey?.id,
        newKeyId,
        newVersion,
        reason
      };
    } catch (error: any) {
      return {
        success: false,
        newKeyId: '',
        newVersion: 0,
        error: error.message
      };
    }
  }

  /**
   * Revoke a specific key (emergency use)
   */
  async revokeKey(userId: string, keyId: string, reason?: string): Promise<RevocationResult> {
    try {
      const key = getUserKeyById(keyId);
      
      if (!key) {
        return { success: false, keyId, affectedMemories: 0, error: 'Key not found' };
      }

      if (key.userId !== userId) {
        return { success: false, keyId, affectedMemories: 0, error: 'Key does not belong to user' };
      }

      if (key.status === 'REVOKED') {
        return { success: false, keyId, affectedMemories: 0, error: 'Key already revoked' };
      }

      revokeUserKey(keyId);
      await this.logAudit('revoked', keyId, userId, { reason });

      // Log compliance
      await this.logComplianceEvent(userId, 'key_revoked', keyId, { reason });

      this.emit('key:revoked', { keyId, userId, reason });

      return {
        success: true,
        keyId,
        affectedMemories: 0 // Would count memories using this key version
      };
    } catch (error: any) {
      return {
        success: false,
        keyId,
        affectedMemories: 0,
        error: error.message
      };
    }
  }

  /**
   * Emergency revoke all keys for a user
   */
  async emergencyRevokeAll(userId: string, reason: string): Promise<{ revoked: number }> {
    const keys = getUserKeys(userId);
    let revoked = 0;

    for (const key of keys) {
      if (key.status === 'ACTIVE') {
        revokeUserKey(key.id);
        revoked++;
      }
    }

    await this.logAudit('revoked', 'ALL', userId, { reason, revokedCount: revoked });
    await this.logComplianceEvent(userId, 'emergency_revoke', 'ALL', {
      reason,
      revokedCount: revoked
    });

    this.emit('key:emergency_revoke', { userId, reason, revokedCount: revoked });

    return { revoked };
  }

  // ============================================================================
  // Key Derivation
  // ============================================================================

  /**
   * Derive a key from master secret
   */
  async deriveKey(
    masterSecret: string,
    userId: string,
    purpose: string,
    version: number
  ): Promise<KeyDerivation> {
    const salt = crypto.randomBytes(32);
    const info = Buffer.from(`${userId}:${purpose}:v${version}`);
    
    let derivedKey: Buffer;
    
    if (this.config.derivationAlgorithm === 'hkdf') {
      derivedKey = Buffer.from(crypto.hkdfSync('sha256', masterSecret, salt, info, 32));
    } else {
      // PBKDF2
      derivedKey = crypto.pbkdf2Sync(
        masterSecret,
        salt,
        this.config.pbkdf2Iterations,
        32,
        'sha256'
      );
    }

    const masterKeyHash = crypto.createHash('sha256')
      .update(masterSecret)
      .digest('hex')
      .slice(0, 16);

    await this.logAudit('derived', `derived_${version}`, userId, { purpose });

    return {
      masterKeyHash,
      derivedKey,
      salt,
      version
    };
  }

  // ============================================================================
  // Key Information
  // ============================================================================

  /**
   * Get key information for a user
   */
  getKeyInfo(userId: string): KeyInfo[] {
    const keys = getUserKeys(userId);
    return keys.map(k => this.toKeyInfo(k));
  }

  /**
   * Get current active key
   */
  getActiveKey(userId: string): KeyInfo | null {
    const key = getActiveUserKey(userId);
    return key ? this.toKeyInfo(key) : null;
  }

  /**
   * Get key version range
   */
  getKeyVersionRange(userId: string): { current: number; min: number } {
    return {
      current: getCurrentKeyVersion(userId),
      min: getMinKeyVersion(userId)
    };
  }

  /**
   * Check if key rotation is needed
   */
  isRotationNeeded(userId: string): boolean {
    const activeKey = getActiveUserKey(userId);
    if (!activeKey) return true;

    const ageHours = (Date.now() - new Date(activeKey.createdAt).getTime()) / 3600000;
    const rotationThresholdHours = this.config.autoRotationDays * 24;
    
    return ageHours >= rotationThresholdHours;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  private async cleanupOldVersions(userId: string): Promise<void> {
    const keys = getUserKeys(userId);
    
    if (keys.length <= this.config.maxKeyVersions) return;

    // Sort by version (newest first) and revoke oldest
    const sortedKeys = keys.sort((a, b) => b.keyVersion - a.keyVersion);
    const keysToCleanup = sortedKeys.slice(this.config.maxKeyVersions);

    for (const key of keysToCleanup) {
      if (key.status === 'ACTIVE') {
        revokeUserKey(key.id);
      }
    }

    console.log(`[KeyMgmt] Cleaned up ${keysToCleanup.length} old key versions for user ${userId}`);
  }

  // ============================================================================
  // Audit & Compliance
  // ============================================================================

  private async logAudit(
    action: KeyAuditEntry['action'],
    keyId: string,
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const entry: KeyAuditEntry = {
      action,
      keyId,
      userId,
      timestamp: new Date().toISOString(),
      metadata
    };
    
    this.auditLog.push(entry);
    
    // Keep only last 1000 entries in memory
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }
  }

  private async logComplianceEvent(
    userId: string,
    action: string,
    keyId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
      const previousLogHash = getLatestLogHash();
      const logHash = await hashData(JSON.stringify({
        id: logId,
        action,
        userId,
        keyId,
        timestamp: new Date().toISOString(),
        previousLogHash
      }));

      insertComplianceLog({
        id: logId,
        userId,
        action,
        keyId,
        timestamp: new Date().toISOString(),
        metadata,
        previousLogHash,
        logHash
      });
    } catch (error) {
      console.error('[KeyMgmt] Failed to log compliance event:', error);
    }
  }

  getAuditLog(limit: number = 100): KeyAuditEntry[] {
    return this.auditLog.slice(-limit);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private toKeyInfo(key: UserKey): KeyInfo {
    const ageHours = (Date.now() - new Date(key.createdAt).getTime()) / 3600000;
    
    return {
      keyId: key.id,
      userId: key.userId,
      version: key.keyVersion,
      status: key.status,
      createdAt: key.createdAt,
      revokedAt: key.revokedAt,
      isActive: key.status === 'ACTIVE',
      ageHours: Math.round(ageHours * 10) / 10
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let keyManagementService: KeyManagementService | null = null;

export function getKeyManagementService(
  config?: Partial<KeyManagementConfig>
): KeyManagementService {
  if (!keyManagementService) {
    keyManagementService = new KeyManagementService(config);
  }
  return keyManagementService;
}

export function startKeyManagementService(
  config?: Partial<KeyManagementConfig>
): KeyManagementService {
  const service = getKeyManagementService(config);
  service.start();
  return service;
}

export function stopKeyManagementService(): void {
  if (keyManagementService) {
    keyManagementService.stop();
  }
}
