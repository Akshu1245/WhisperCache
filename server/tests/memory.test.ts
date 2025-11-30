/**
 * Integration Tests: Memory API
 * 
 * Tests for the /api/memory endpoints.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';

// Create a minimal test app
let app: Express;

beforeAll(async () => {
  // Dynamically import to avoid circular dependencies
  const { default: memoryRoutes } = await import('../src/routes/memory');
  const { initCrypto } = await import('../src/lib/crypto');
  const { initDatabase } = await import('../src/lib/database');
  
  await initCrypto();
  await initDatabase();
  
  app = express();
  app.use(express.json());
  app.use('/api/memory', memoryRoutes);
});

describe('Memory API', () => {
  const testUserId = 'test-user-integration';
  let createdMemoryId: string;

  describe('POST /api/memory', () => {
    it('should create a new memory', async () => {
      const memoryCommitment = 'a'.repeat(64); // 64 hex chars
      
      const response = await request(app)
        .post('/api/memory')
        .set('x-user-id', testUserId)
        .send({
          memoryCommitment,
          tags: ['test', 'integration']
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.memoryId).toBeDefined();
      expect(response.body.memoryCommitment).toBe(memoryCommitment);
      
      createdMemoryId = response.body.memoryId;
    });

    it('should reject duplicate memory commitment', async () => {
      const memoryCommitment = 'a'.repeat(64);
      
      const response = await request(app)
        .post('/api/memory')
        .set('x-user-id', testUserId)
        .send({
          memoryCommitment,
          tags: ['test']
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject invalid memory commitment format', async () => {
      const response = await request(app)
        .post('/api/memory')
        .set('x-user-id', testUserId)
        .send({
          memoryCommitment: 'not-hex',
          tags: ['test']
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/memory')
        .send({
          memoryCommitment: 'b'.repeat(64),
          tags: ['test']
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/memory', () => {
    it('should list user memories', async () => {
      const response = await request(app)
        .get('/api/memory')
        .set('x-user-id', testUserId);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.memories).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/memory?status=ACTIVE')
        .set('x-user-id', testUserId);

      expect(response.status).toBe(200);
      expect(response.body.memories.every((m: any) => m.status === 'ACTIVE')).toBe(true);
    });

    it('should filter by tags', async () => {
      const response = await request(app)
        .get('/api/memory?tags=test')
        .set('x-user-id', testUserId);

      expect(response.status).toBe(200);
      // Should contain memories with 'test' tag
    });
  });

  describe('GET /api/memory/:memoryId', () => {
    it('should get specific memory', async () => {
      const response = await request(app)
        .get(`/api/memory/${createdMemoryId}`)
        .set('x-user-id', testUserId);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // API returns memoryId directly, not nested in memory object
      expect(response.body.memoryId).toBe(createdMemoryId);
    });

    it('should return 404 for non-existent memory', async () => {
      const response = await request(app)
        .get('/api/memory/mem_nonexistent123456')
        .set('x-user-id', testUserId);

      expect(response.status).toBe(404);
    });

    it('should deny access to other users memory', async () => {
      const response = await request(app)
        .get(`/api/memory/${createdMemoryId}`)
        .set('x-user-id', 'other-user');

      // API returns 403 for access denied
      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/memory/:memoryId', () => {
    it('should update memory tags', async () => {
      const response = await request(app)
        .patch(`/api/memory/${createdMemoryId}`)
        .set('x-user-id', testUserId)
        .send({
          tags: ['updated', 'tags']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // API returns tags directly
      expect(response.body.tags).toEqual(['updated', 'tags']);
    });
  });

  describe('DELETE /api/memory/:memoryId', () => {
    it('should soft delete memory', async () => {
      // Create a new memory to delete
      const createResponse = await request(app)
        .post('/api/memory')
        .set('x-user-id', testUserId)
        .send({
          memoryCommitment: 'c'.repeat(64),
          tags: ['to-delete']
        });

      const memoryToDelete = createResponse.body.memoryId;

      const response = await request(app)
        .delete(`/api/memory/${memoryToDelete}`)
        .set('x-user-id', testUserId);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('DELETED');

      // Verify it's no longer accessible
      const getResponse = await request(app)
        .get(`/api/memory/${memoryToDelete}`)
        .set('x-user-id', testUserId);

      expect(getResponse.status).toBe(404);
    });
  });

  describe('POST /api/memory/:memoryId/revoke', () => {
    it('should revoke memory with reason', async () => {
      // Create a new memory to revoke
      const createResponse = await request(app)
        .post('/api/memory')
        .set('x-user-id', testUserId)
        .send({
          memoryCommitment: 'd'.repeat(64),
          tags: ['to-revoke']
        });

      const memoryToRevoke = createResponse.body.memoryId;

      const response = await request(app)
        .post(`/api/memory/${memoryToRevoke}/revoke`)
        .set('x-user-id', testUserId)
        .send({
          reason: 'User requested data deletion'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('REVOKED');
      expect(response.body.reason).toBe('User requested data deletion');
    });
  });
});
