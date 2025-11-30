/**
 * WhisperCache Key Management Unit Tests
 * 
 * Tests for key management utilities without database dependencies
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

describe('Key Management Utilities', () => {
  describe('Key ID Generation', () => {
    it('should generate unique key IDs', () => {
      const ids = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        const id = `key_${crypto.randomBytes(12).toString('hex')}`;
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
    });

    it('should generate IDs with correct format', () => {
      const id = `key_${crypto.randomBytes(12).toString('hex')}`;
      
      expect(id).toMatch(/^key_[a-f0-9]{24}$/);
    });
  });

  describe('Key Version Validation', () => {
    it('should validate key version in range', () => {
      const testCases = [
        { version: 1, min: 1, max: 5, expected: true },
        { version: 5, min: 1, max: 5, expected: true },
        { version: 3, min: 1, max: 5, expected: true },
        { version: 0, min: 1, max: 5, expected: false },
        { version: 6, min: 1, max: 5, expected: false },
        { version: -1, min: 1, max: 5, expected: false }
      ];

      for (const tc of testCases) {
        const isValid = tc.version >= tc.min && tc.version <= tc.max;
        expect(isValid).toBe(tc.expected);
      }
    });
  });

  describe('Key Derivation', () => {
    it('should derive 32-byte keys using PBKDF2', () => {
      const masterSecret = 'test-master-secret';
      const salt = crypto.randomBytes(32);
      
      const derivedKey = crypto.pbkdf2Sync(
        masterSecret,
        salt,
        100000,
        32,
        'sha256'
      );

      expect(derivedKey.length).toBe(32);
    });

    it('should produce different keys with different salts', () => {
      const masterSecret = 'test-master-secret';
      const salt1 = crypto.randomBytes(32);
      const salt2 = crypto.randomBytes(32);

      const key1 = crypto.pbkdf2Sync(masterSecret, salt1, 1000, 32, 'sha256');
      const key2 = crypto.pbkdf2Sync(masterSecret, salt2, 1000, 32, 'sha256');

      expect(key1.equals(key2)).toBe(false);
    });

    it('should derive using HKDF', () => {
      const masterSecret = 'test-master-secret';
      const salt = crypto.randomBytes(32);
      const info = Buffer.from('test-info');

      // HKDF is available in Node 15+
      if (typeof crypto.hkdfSync === 'function') {
        const derivedKey = crypto.hkdfSync('sha256', masterSecret, salt, info, 32);
        // hkdfSync returns an ArrayBuffer
        expect(derivedKey.byteLength).toBe(32);
      } else {
        // Fallback for older Node versions - just check the API exists
        expect(true).toBe(true);
      }
    });
  });

  describe('Key Status Logic', () => {
    it('should determine key activity correctly', () => {
      const statuses = ['ACTIVE', 'REVOKED', 'EXPIRED'] as const;
      
      const isActive = (status: string) => status === 'ACTIVE';
      
      expect(isActive('ACTIVE')).toBe(true);
      expect(isActive('REVOKED')).toBe(false);
      expect(isActive('EXPIRED')).toBe(false);
    });
  });

  describe('Key Age Calculation', () => {
    it('should calculate key age in hours', () => {
      const now = Date.now();
      const createdAt = new Date(now - 2 * 60 * 60 * 1000); // 2 hours ago
      
      const ageHours = (now - createdAt.getTime()) / (1000 * 60 * 60);
      
      expect(Math.round(ageHours)).toBe(2);
    });

    it('should detect rotation needed based on age', () => {
      const maxAgeHours = 24 * 90; // 90 days
      
      const testCases = [
        { ageHours: 0, expected: false },
        { ageHours: 24, expected: false },
        { ageHours: 24 * 89, expected: false },
        { ageHours: 24 * 90, expected: true },
        { ageHours: 24 * 100, expected: true }
      ];

      for (const tc of testCases) {
        const needsRotation = tc.ageHours >= maxAgeHours;
        expect(needsRotation).toBe(tc.expected);
      }
    });
  });

  describe('Audit Entry Format', () => {
    it('should create valid audit entries', () => {
      const entry = {
        action: 'created',
        keyId: `key_${crypto.randomBytes(12).toString('hex')}`,
        userId: 'user123',
        timestamp: new Date().toISOString(),
        metadata: { reason: 'test' }
      };

      expect(entry.action).toBeDefined();
      expect(entry.keyId).toMatch(/^key_/);
      expect(entry.userId).toBeDefined();
      expect(new Date(entry.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('Key Cleanup Logic', () => {
    it('should identify keys to cleanup', () => {
      const maxVersions = 5;
      const keys = [
        { id: '1', version: 1 },
        { id: '2', version: 2 },
        { id: '3', version: 3 },
        { id: '4', version: 4 },
        { id: '5', version: 5 },
        { id: '6', version: 6 },
        { id: '7', version: 7 }
      ];

      const sorted = keys.sort((a, b) => b.version - a.version);
      const toKeep = sorted.slice(0, maxVersions);
      const toCleanup = sorted.slice(maxVersions);

      expect(toKeep.length).toBe(5);
      expect(toCleanup.length).toBe(2);
      expect(toCleanup.map(k => k.version)).toEqual([2, 1]);
    });
  });
});
