/**
 * Unit Tests: Encryption/Decryption Utilities
 * 
 * Tests for the cryptography utilities using libsodium.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  initCrypto,
  hashData,
  verifyHashFormat,
  generateProofId,
  generateNonce,
  createCommitment,
  verifyCommitment,
  getSodium
} from './crypto';

describe('Crypto Utilities', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  describe('hashData', () => {
    it('should hash data consistently', async () => {
      const data = 'test data';
      const hash1 = await hashData(data);
      const hash2 = await hashData(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('should produce different hashes for different data', async () => {
      const hash1 = await hashData('data1');
      const hash2 = await hashData('data2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty strings', async () => {
      const hash = await hashData('');
      expect(hash).toHaveLength(64);
    });

    it('should handle unicode characters', async () => {
      const hash = await hashData('日本語 🎉 émojis');
      expect(hash).toHaveLength(64);
    });
  });

  describe('verifyHashFormat', () => {
    it('should validate correct hash format', async () => {
      const hash = await hashData('test');
      const isValid = await verifyHashFormat(hash);
      expect(isValid).toBe(true);
    });

    it('should reject invalid hash format (too short)', async () => {
      const isValid = await verifyHashFormat('abc123');
      expect(isValid).toBe(false);
    });

    it('should reject invalid hash format (non-hex)', async () => {
      const isValid = await verifyHashFormat('gg'.repeat(32));
      expect(isValid).toBe(false);
    });

    it('should reject empty string', async () => {
      const isValid = await verifyHashFormat('');
      expect(isValid).toBe(false);
    });
  });

  describe('generateProofId', () => {
    it('should generate unique proof IDs', async () => {
      const id1 = await generateProofId();
      const id2 = await generateProofId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^proof_[a-f0-9]+$/);
    });

    it('should have correct prefix', async () => {
      const id = await generateProofId();
      expect(id.startsWith('proof_')).toBe(true);
    });
  });

  describe('generateNonce', () => {
    it('should generate unique nonces', async () => {
      const nonce1 = await generateNonce();
      const nonce2 = await generateNonce();
      
      expect(nonce1).not.toBe(nonce2);
    });

    it('should generate correct length nonces', async () => {
      const nonce = await generateNonce();
      // 24 bytes = 48 hex chars
      expect(nonce).toHaveLength(48);
    });

    it('should only contain hex characters', async () => {
      const nonce = await generateNonce();
      expect(nonce).toMatch(/^[a-f0-9]+$/i);
    });
  });

  describe('createCommitment / verifyCommitment', () => {
    it('should create consistent commitments', async () => {
      const commitment1 = await createCommitment('input1', 'input2');
      const commitment2 = await createCommitment('input1', 'input2');
      
      expect(commitment1).toBe(commitment2);
      expect(commitment1).toHaveLength(64);
    });

    it('should create different commitments for different inputs', async () => {
      const commitment1 = await createCommitment('input1', 'input2');
      const commitment2 = await createCommitment('input1', 'input3');
      
      expect(commitment1).not.toBe(commitment2);
    });

    it('should verify correct commitment', async () => {
      const commitment = await createCommitment('input1', 'input2');
      const isValid = await verifyCommitment(commitment, 'input1', 'input2');
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect commitment', async () => {
      const commitment = await createCommitment('input1', 'input2');
      const isValid = await verifyCommitment(commitment, 'wrong', 'inputs');
      
      expect(isValid).toBe(false);
    });

    it('should handle single input', async () => {
      const commitment = await createCommitment('single');
      const isValid = await verifyCommitment(commitment, 'single');
      
      expect(isValid).toBe(true);
    });

    it('should handle many inputs', async () => {
      const inputs = ['a', 'b', 'c', 'd', 'e'];
      const commitment = await createCommitment(...inputs);
      const isValid = await verifyCommitment(commitment, ...inputs);
      
      expect(isValid).toBe(true);
    });
  });

  describe('getSodium', () => {
    it('should return sodium instance after init', () => {
      const sodium = getSodium();
      expect(sodium).toBeDefined();
      expect(typeof sodium.crypto_generichash).toBe('function');
    });
  });
});
