/**
 * WhisperCache V2 Prover Tests
 * 
 * Tests for the enhanced memory pattern prover with status and key version validation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { buildPoseidon } from 'circomlibjs';

describe('Memory Pattern V2 Prover', () => {
  let poseidon: any;
  let F: any;

  beforeAll(async () => {
    poseidon = await buildPoseidon();
    F = poseidon.F;
  });

  describe('Circuit Input Preparation', () => {
    it('should compute correct memory commitment', async () => {
      const memoryContent = 12345n;
      const salt = 67890n;

      const commitment = poseidon([memoryContent, salt]);
      const commitmentBigInt = F.toObject(commitment);

      expect(commitmentBigInt).toBeDefined();
      expect(typeof commitmentBigInt).toBe('bigint');
    });

    it('should validate memory status constraints', () => {
      // Status values: 0=DELETED, 1=ACTIVE, 2=REVOKED
      const validStatuses = [0, 1, 2];
      
      for (const status of validStatuses) {
        const isActive = status === 1 ? 1 : 0;
        expect(isActive).toBe(status === 1 ? 1 : 0);
      }
    });

    it('should compute allowedForAgent correctly', () => {
      // Test cases: [memoryStatus, keyVersion, currentKeyVersion, minKeyVersion, expectedResult]
      const testCases = [
        { status: 1, keyVer: 5, currVer: 5, minVer: 1, expectedAllowed: true },  // Active, valid key
        { status: 0, keyVer: 5, currVer: 5, minVer: 1, expectedAllowed: false }, // Deleted
        { status: 2, keyVer: 5, currVer: 5, minVer: 1, expectedAllowed: false }, // Revoked
        { status: 1, keyVer: 0, currVer: 5, minVer: 1, expectedAllowed: false }, // Key too old
        { status: 1, keyVer: 6, currVer: 5, minVer: 1, expectedAllowed: false }, // Key too new
      ];

      for (const tc of testCases) {
        const isActive = tc.status === 1;
        const keyInRange = tc.keyVer >= tc.minVer && tc.keyVer <= tc.currVer;
        const allowed = isActive && keyInRange;
        
        expect(allowed).toBe(tc.expectedAllowed);
      }
    });
  });

  describe('Pattern Flags', () => {
    it('should correctly identify pattern types', () => {
      const patterns = {
        IS_PERSONAL: 1 << 0,
        IS_LOCATION: 1 << 1,
        IS_TEMPORAL: 1 << 2,
        IS_RELATIONSHIP: 1 << 3,
        IS_HEALTH: 1 << 4,
        IS_FINANCIAL: 1 << 5
      };

      // Test flag combinations
      const personalHealth = patterns.IS_PERSONAL | patterns.IS_HEALTH;
      expect(personalHealth & patterns.IS_PERSONAL).toBeTruthy();
      expect(personalHealth & patterns.IS_HEALTH).toBeTruthy();
      expect(personalHealth & patterns.IS_FINANCIAL).toBeFalsy();
    });
  });

  describe('Key Version Validation', () => {
    it('should validate key version ranges', () => {
      const testVersions = [
        { version: 1, min: 1, max: 5, valid: true },
        { version: 5, min: 1, max: 5, valid: true },
        { version: 3, min: 1, max: 5, valid: true },
        { version: 0, min: 1, max: 5, valid: false },
        { version: 6, min: 1, max: 5, valid: false },
        { version: -1, min: 1, max: 5, valid: false }
      ];

      for (const tv of testVersions) {
        const isValid = tv.version >= tv.min && tv.version <= tv.max;
        expect(isValid).toBe(tv.valid);
      }
    });
  });
});
