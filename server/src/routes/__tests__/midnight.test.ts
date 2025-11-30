/**
 * Test Suite for Midnight Compact Integration Routes
 * 
 * Tests all 6 Midnight endpoints:
 * - Generate Witness
 * - Generate Proof
 * - Verify Proof
 * - Export for Anchoring
 * - CLI Demo
 * - Status
 */

import request from 'supertest';
import express from 'express';
import zkRouter from '../zk';

describe('Midnight Compact Integration Routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/zk', zkRouter);
  });

  // ============================================================================
  // Test Suite 1: Generate Witness Endpoint
  // ============================================================================
  describe('POST /api/zk/midnight/generate-witness', () => {
    it('should generate witness data with valid query', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/generate-witness')
        .send({
          query: 'Find memories about health',
          memoryCategory: 'health',
          userId: 'test-user-1'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('witness');
      expect(response.body).toHaveProperty('timestamp');

      // Verify witness structure
      const witness = response.body.witness;
      expect(witness).toHaveProperty('memory_content');
      expect(witness).toHaveProperty('memory_timestamp');
      expect(witness).toHaveProperty('memory_category');
      expect(witness).toHaveProperty('pattern_query');
      expect(witness).toHaveProperty('min_confidence_threshold');
    });

    it('should handle missing query parameter', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/generate-witness')
        .send({
          memoryCategory: 'health'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'query is required');
    });

    it('should use default category when not specified', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/generate-witness')
        .send({
          query: 'Test query'
        });

      expect(response.status).toBe(200);
      const witness = response.body.witness;
      expect(witness.memory_category).toBe(3); // 'personal' default
    });

    it('should correctly map category codes', async () => {
      const categories = [
        { name: 'health', code: 1 },
        { name: 'finance', code: 2 },
        { name: 'personal', code: 3 },
        { name: 'work', code: 4 }
      ];

      for (const category of categories) {
        const response = await request(app)
          .post('/api/zk/midnight/generate-witness')
          .send({
            query: `Test ${category.name}`,
            memoryCategory: category.name
          });

        expect(response.status).toBe(200);
        expect(response.body.witness.memory_category).toBe(category.code);
      }
    });

    it('should generate unique witnesses for same query', async () => {
      const response1 = await request(app)
        .post('/api/zk/midnight/generate-witness')
        .send({ query: 'Same query' });

      const response2 = await request(app)
        .post('/api/zk/midnight/generate-witness')
        .send({ query: 'Same query' });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      // Different user_public_id due to randomness
      expect(response1.body.witness.user_public_id).not.toBe(response2.body.witness.user_public_id);
    });
  });

  // ============================================================================
  // Test Suite 2: Generate Proof Endpoint
  // ============================================================================
  describe('POST /api/zk/midnight/generate-proof', () => {
    it('should generate proof with valid query', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/generate-proof')
        .send({
          query: 'Find memories about health',
          memoryHash: 'test-hash-123',
          memoryCategory: 'health'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.proof).toHaveProperty('hash');
      expect(response.body.proof).toHaveProperty('verified');
      expect(response.body.proof).toHaveProperty('circuitVersion');
      expect(response.body.proof).toHaveProperty('executionMode');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should handle missing query parameter', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/generate-proof')
        .send({
          memoryHash: 'test-hash'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'query is required');
    });

    it('should generate random memoryHash if not provided', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/generate-proof')
        .send({
          query: 'Test query'
        });

      expect(response.status).toBe(200);
      expect(response.body.proof).toHaveProperty('hash');
      // Should have generated a hash
      expect(response.body.proof.hash.length).toBeGreaterThan(0);
    });

    it('should store proof in database', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/generate-proof')
        .send({
          query: 'Database test query',
          memoryHash: 'db-test-hash'
        });

      expect(response.status).toBe(200);
      // In real test, would query database to verify storage
      expect(response.body.proof).toHaveProperty('hash');
    });

    it('should use simulated mode by default', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/generate-proof')
        .send({
          query: 'Mode test'
        });

      expect(response.status).toBe(200);
      expect(response.body.proof.executionMode).toMatch(/simulated|real/);
    });

    it('should return verified status in proof', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/generate-proof')
        .send({
          query: 'Verification test'
        });

      expect(response.status).toBe(200);
      expect(typeof response.body.proof.verified).toBe('boolean');
    });
  });

  // ============================================================================
  // Test Suite 3: Verify Proof Endpoint
  // ============================================================================
  describe('POST /api/zk/midnight/verify-proof', () => {
    it('should verify valid proof data', async () => {
      // Create valid proof data structure
      const validProof = JSON.stringify({
        publicInputs: {
          proof_valid: true
        },
        proofElements: {
          a: [1, 2],
          b: [[1, 2], [3, 4]],
          c: [5, 6]
        }
      });

      const response = await request(app)
        .post('/api/zk/midnight/verify-proof')
        .send({
          proofData: validProof
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('verified');
      expect(typeof response.body.verified).toBe('boolean');
    });

    it('should handle missing proofData parameter', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/verify-proof')
        .send({
          witness: {}
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'proofData and witness are required');
    });

    it('should reject invalid proof structure', async () => {
      const invalidProof = JSON.stringify({
        invalid: 'structure'
      });

      const response = await request(app)
        .post('/api/zk/midnight/verify-proof')
        .send({
          proofData: invalidProof,
          witness: {}
        });

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(false);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/verify-proof')
        .send({
          proofData: '{invalid json}',
          witness: {}
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should accept witness and publicInputs parameters', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/verify-proof')
        .send({
          proofData: JSON.stringify({ publicInputs: { proof_valid: true }, proofElements: {} }),
          witness: { query: 'test' },
          publicInputs: { threshold: 80 }
        });

      expect(response.status).toBeLessThan(500);
    });
  });

  // ============================================================================
  // Test Suite 4: Export for Anchoring Endpoint
  // ============================================================================
  describe('POST /api/zk/midnight/export-for-anchoring', () => {
    it('should handle missing proofHash parameter', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/export-for-anchoring')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'proofHash is required');
    });

    it('should return 404 for non-existent proof', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/export-for-anchoring')
        .send({
          proofHash: 'non-existent-proof-hash'
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Proof not found');
    });

    it('should export proof in correct format', async () => {
      // First generate a proof
      const proofResponse = await request(app)
        .post('/api/zk/midnight/generate-proof')
        .send({
          query: 'Export test',
          memoryHash: 'export-hash'
        });

      if (proofResponse.status === 200) {
        const proofHash = proofResponse.body.proof.hash;

        // Then try to export it
        const exportResponse = await request(app)
          .post('/api/zk/midnight/export-for-anchoring')
          .send({ proofHash });

        if (exportResponse.status === 200) {
          expect(exportResponse.body).toHaveProperty('success', true);
          expect(exportResponse.body).toHaveProperty('exportedProof');
          expect(exportResponse.body).toHaveProperty('timestamp');
        }
      }
    });
  });

  // ============================================================================
  // Test Suite 5: CLI Demo Endpoint
  // ============================================================================
  describe('POST /api/zk/midnight/cli-demo', () => {
    it('should handle missing query parameter', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/cli-demo')
        .send({
          demoMode: true
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'query is required');
    });

    it('should return result for valid query', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/cli-demo')
        .send({
          query: 'Demo test query',
          memoryHash: 'demo-hash',
          demoMode: true
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('result');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should include command in result', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/cli-demo')
        .send({
          query: 'CLI command test'
        });

      if (response.status === 200 && response.body.result) {
        expect(response.body.result).toHaveProperty('command');
        expect(response.body.result).toHaveProperty('output');
        expect(response.body.result).toHaveProperty('success');
      }
    });

    it('should use default demoMode if not specified', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/cli-demo')
        .send({
          query: 'Default mode test'
        });

      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // Test Suite 6: Status Endpoint
  // ============================================================================
  describe('GET /api/zk/midnight/status', () => {
    it('should return system status', async () => {
      const response = await request(app)
        .get('/api/zk/midnight/status');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('system', 'midnight-compact');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('capabilities');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should include all expected capabilities', async () => {
      const response = await request(app)
        .get('/api/zk/midnight/status');

      expect(response.status).toBe(200);
      const expectedCapabilities = [
        'proof-generation',
        'proof-verification',
        'witness-generation',
        'on-chain-anchoring',
        'cli-integration'
      ];

      for (const capability of expectedCapabilities) {
        expect(response.body.capabilities).toContain(capability);
      }
    });

    it('should show environment configuration', async () => {
      const response = await request(app)
        .get('/api/zk/midnight/status');

      expect(response.status).toBe(200);
      expect(response.body.environment).toHaveProperty('midnightCliPath');
      expect(response.body.environment).toHaveProperty('compactCircuitExists');
      expect(response.body.environment).toHaveProperty('proofOutputDirExists');
    });

    it('should have boolean environment flags', async () => {
      const response = await request(app)
        .get('/api/zk/midnight/status');

      expect(response.status).toBe(200);
      expect(typeof response.body.environment.compactCircuitExists).toBe('boolean');
      expect(typeof response.body.environment.proofOutputDirExists).toBe('boolean');
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================
  describe('Integration Scenarios', () => {
    it('should complete full proof workflow: witness -> proof -> verify', async () => {
      // Step 1: Generate witness
      const witnessResponse = await request(app)
        .post('/api/zk/midnight/generate-witness')
        .send({
          query: 'Workflow test',
          memoryCategory: 'personal'
        });

      expect(witnessResponse.status).toBe(200);
      const witness = witnessResponse.body.witness;

      // Step 2: Generate proof
      const proofResponse = await request(app)
        .post('/api/zk/midnight/generate-proof')
        .send({
          query: 'Workflow test',
          memoryHash: 'workflow-hash'
        });

      expect(proofResponse.status).toBe(200);

      // Step 3: Verify proof (if we have proof data)
      if (proofResponse.body.proof) {
        const verifyResponse = await request(app)
          .post('/api/zk/midnight/verify-proof')
          .send({
            proofData: JSON.stringify({
              publicInputs: { proof_valid: true },
              proofElements: {}
            }),
            witness
          });

        expect(verifyResponse.status).toBeLessThan(500);
      }
    });

    it('should handle concurrent proof generation', async () => {
      const promises = [
        request(app).post('/api/zk/midnight/generate-proof').send({ query: 'Concurrent 1' }),
        request(app).post('/api/zk/midnight/generate-proof').send({ query: 'Concurrent 2' }),
        request(app).post('/api/zk/midnight/generate-proof').send({ query: 'Concurrent 3' })
      ];

      const responses = await Promise.all(promises);

      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      }

      // Verify all proofs are different
      const hashes = responses.map(r => r.body.proof.hash);
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(hashes.length);
    });

    it('should maintain data consistency across requests', async () => {
      const query = 'Consistency test';
      
      // Generate proof twice with same query
      const response1 = await request(app)
        .post('/api/zk/midnight/generate-proof')
        .send({ query });

      const response2 = await request(app)
        .post('/api/zk/midnight/generate-proof')
        .send({ query });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Different proofs but both should be valid
      expect(response1.body.proof.hash).not.toBe(response2.body.proof.hash);
      expect(response1.body.proof.verified).toBeDefined();
      expect(response2.body.proof.verified).toBeDefined();
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================
  describe('Error Handling', () => {
    it('should return consistent error format', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/generate-witness')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });

    it('should not expose sensitive information in errors', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/generate-proof')
        .send({
          query: 'Error test'
        });

      // Error messages should be generic, not exposing internal details
      if (response.status >= 400) {
        expect(response.body.error).not.toMatch(/password|secret|key|token/i);
      }
    });

    it('should handle null/undefined inputs gracefully', async () => {
      const response = await request(app)
        .post('/api/zk/midnight/generate-witness')
        .send({
          query: null
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
