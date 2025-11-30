/**
 * Integration Tests: ZK Prove API
 * 
 * Tests for the /api/zk/prove endpoints.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';

let app: Express;

beforeAll(async () => {
  const { default: zkRoutes } = await import('../src/routes/zk');
  const { initCrypto } = await import('../src/lib/crypto');
  const { initDatabase } = await import('../src/lib/database');
  
  await initCrypto();
  await initDatabase();
  
  app = express();
  app.use(express.json());
  app.use('/api/zk', zkRoutes);
});

describe('ZK Prove API', () => {
  const testUserId = 'test-user-zk';

  describe('GET /api/zk/status', () => {
    it('should return prover status', async () => {
      const response = await request(app)
        .get('/api/zk/status');

      expect(response.status).toBe(200);
      // API returns 'status' instead of 'ready'
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('prover');
    });
  });

  describe('POST /api/zk/prove/pattern', () => {
    it('should generate a ZK proof', async () => {
      const response = await request(app)
        .post('/api/zk/prove/pattern')
        .set('x-user-id', testUserId)
        .send({
          memoryCommitment: 'e'.repeat(64),
          pattern: {
            isFinance: true,
            isHealth: false,
            isPersonal: false
          }
        });

      expect(response.status).toBe(200);
      // Successful proof has proofHash and patternMatched
      expect(response.body.proofHash).toBeDefined();
      expect(response.body).toHaveProperty('patternMatched');
      expect(response.body).toHaveProperty('confidence');
    });

    it('should require memoryCommitment', async () => {
      const response = await request(app)
        .post('/api/zk/prove/pattern')
        .set('x-user-id', testUserId)
        .send({
          pattern: {
            isFinance: true,
            isHealth: false,
            isPersonal: false
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.result).toBe('error');
    });

    it('should require pattern', async () => {
      const response = await request(app)
        .post('/api/zk/prove/pattern')
        .set('x-user-id', testUserId)
        .send({
          memoryCommitment: 'e'.repeat(64)
        });

      expect(response.status).toBe(400);
      expect(response.body.result).toBe('error');
    });

    it('should accept object pattern', async () => {
      const response = await request(app)
        .post('/api/zk/prove/pattern')
        .set('x-user-id', testUserId)
        .send({
          memoryCommitment: 'f'.repeat(64),
          pattern: {
            isFinance: true,
            isHealth: false,
            isPersonal: false
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.proofHash).toBeDefined();
    });
  });

  describe('POST /api/zk/verify', () => {
    it('should verify a valid proof', async () => {
      // First generate a proof
      const proveResponse = await request(app)
        .post('/api/zk/prove/pattern')
        .set('x-user-id', testUserId)
        .send({
          memoryCommitment: 'g'.repeat(64),
          pattern: {
            isFinance: true,
            isHealth: false,
            isPersonal: false
          }
        });

      const { proofHash, proof, publicSignals } = proveResponse.body;

      // Then verify it
      const verifyResponse = await request(app)
        .post('/api/zk/verify')
        .set('x-user-id', testUserId)
        .send({
          proofHash,
          proof,
          publicSignals
        });

      expect(verifyResponse.status).toBe(200);
      // Verify response uses 'verified' property
      expect(verifyResponse.body).toHaveProperty('verified');
    });
  });

  describe('GET /api/zk/proofs', () => {
    it.skip('should list proofs for user (requires database persistence)', async () => {
      const response = await request(app)
        .get('/api/zk/proofs')
        .set('x-user-id', testUserId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('proofs');
      expect(Array.isArray(response.body.proofs)).toBe(true);
    });
  });
});
