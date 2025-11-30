/**
 * Integration Tests: Blockchain Anchor API
 * 
 * Tests for the /api/blockchain-anchor endpoints.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { initCrypto } from '../src/lib/crypto';
import { initDatabase, closeDatabase } from '../src/lib/database';

let app: Express;

beforeAll(async () => {
  await initCrypto();
  await initDatabase();
  
  // Set environment for tests
  process.env.ANCHOR_MODE = 'sqlite';
  
  const { default: blockchainAnchorRouter } = await import('../src/routes/blockchainAnchor');
  
  app = express();
  app.use(express.json());
  app.use('/api/blockchain-anchor', blockchainAnchorRouter);
});

afterAll(() => {
  closeDatabase();
});

describe('Blockchain Anchor API', () => {
  const testUserId = 'test-user-anchor';
  const testProofHash = 'test_proof_' + Math.random().toString(36).substring(7);
  const testMemoryHash = 'e'.repeat(64);

  describe('GET /api/blockchain-anchor/status', () => {
    it('should return blockchain anchor status', async () => {
      const response = await request(app)
        .get('/api/blockchain-anchor/status');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('anchorMode');
      expect(['sqlite', 'ipfs', 'midnight', 'cardano']).toContain(response.body.anchorMode);
    });
  });

  describe('POST /api/blockchain-anchor/anchor', () => {
    it('should anchor a proof successfully', async () => {
      const response = await request(app)
        .post('/api/blockchain-anchor/anchor')
        .set('x-user-id', testUserId)
        .send({
          proofHash: testProofHash,
          memoryHash: testMemoryHash
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('anchorType');
      expect(response.body).toHaveProperty('anchorLog');
      expect(response.body.anchorLog).toHaveProperty('id');
      expect(response.body.anchorLog).toHaveProperty('simulatedBlock');
    });

    it('should require proofHash', async () => {
      const response = await request(app)
        .post('/api/blockchain-anchor/anchor')
        .set('x-user-id', testUserId)
        .send({
          memoryHash: testMemoryHash
        });

      expect(response.status).toBe(400);
    });

    it('should require memoryHash', async () => {
      const response = await request(app)
        .post('/api/blockchain-anchor/anchor')
        .set('x-user-id', testUserId)
        .send({
          proofHash: 'test_proof_123'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/blockchain-anchor/verify/:proofHash', () => {
    it('should verify an existing anchored proof', async () => {
      // First anchor a proof
      const anchorProofHash = 'verify_test_' + Math.random().toString(36).substring(7);
      await request(app)
        .post('/api/blockchain-anchor/anchor')
        .set('x-user-id', testUserId)
        .send({
          proofHash: anchorProofHash,
          memoryHash: testMemoryHash
        });

      // Then verify it
      const response = await request(app)
        .get(`/api/blockchain-anchor/verify/${anchorProofHash}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('verified');
    });
  });

  describe('GET /api/blockchain-anchor/logs', () => {
    it('should return recent anchor logs', async () => {
      const response = await request(app)
        .get('/api/blockchain-anchor/logs');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/blockchain-anchor/logs?limit=5');

      expect(response.status).toBe(200);
      expect(response.body.logs.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/blockchain-anchor/log/:proofHash', () => {
    it('should return specific anchor log by proof hash', async () => {
      // First anchor a proof
      const logProofHash = 'log_test_' + Math.random().toString(36).substring(7);
      await request(app)
        .post('/api/blockchain-anchor/anchor')
        .set('x-user-id', testUserId)
        .send({
          proofHash: logProofHash,
          memoryHash: testMemoryHash
        });

      // Then get its log
      const response = await request(app)
        .get(`/api/blockchain-anchor/log/${logProofHash}`);

      expect(response.status).toBe(200);
      expect(response.body.log).toBeDefined();
      expect(response.body.log.proofHash).toBe(logProofHash);
    });

    it('should return 404 for non-existent proof hash', async () => {
      const response = await request(app)
        .get('/api/blockchain-anchor/log/non_existent_proof');

      expect(response.status).toBe(404);
    });
  });
});

describe('Blockchain Anchor API - IPFS Mode', () => {
  let ipfsApp: Express;
  const testUserId = 'test-user-ipfs';

  beforeAll(async () => {
    // Set IPFS mode
    process.env.ANCHOR_MODE = 'ipfs';
    
    // Import blockchainAnchorRouter
    const { default: blockchainAnchorRouter } = await import('../src/routes/blockchainAnchor');
    
    ipfsApp = express();
    ipfsApp.use(express.json());
    ipfsApp.use('/api/blockchain-anchor', blockchainAnchorRouter);
  });

  afterAll(() => {
    // Reset back to sqlite
    process.env.ANCHOR_MODE = 'sqlite';
  });

  it('should generate IPFS CID when in IPFS mode', async () => {
    const response = await request(ipfsApp)
      .post('/api/blockchain-anchor/anchor')
      .set('x-user-id', testUserId)
      .send({
        proofHash: 'ipfs_proof_' + Math.random().toString(36).substring(7),
        memoryHash: 'f'.repeat(64)
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    // IPFS mode should set anchorType to 'ipfs' and include CID
    if (response.body.anchorType === 'ipfs') {
      expect(response.body.anchorLog.ipfsCid).toBeDefined();
      expect(response.body.anchorLog.ipfsCid.startsWith('bafybeig')).toBe(true);
      expect(response.body.anchorLog.gatewayUrl).toBeDefined();
    }
  });
});
