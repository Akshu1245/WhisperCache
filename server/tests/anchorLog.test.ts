/**
 * Integration Tests: Anchor Log Database Operations
 * 
 * Tests for the blockchain_anchor_log table CRUD operations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  initDatabase,
  closeDatabase,
  insertAnchorLog,
  getAnchorLogByProofHash,
  getAnchorLogByIpfsCid,
  getRecentAnchorLogs,
  getAnchorLogStats
} from '../src/lib/database';

beforeAll(async () => {
  await initDatabase();
});

afterAll(() => {
  closeDatabase();
});

describe('Anchor Log Database Operations', () => {
  const testAnchorLogSqlite = {
    id: 'test-anchor-' + Date.now(),
    proofHash: 'proof_' + Math.random().toString(36).substring(7),
    memoryHash: 'mem_' + Math.random().toString(36).substring(7),
    anchorType: 'sqlite' as const,
    simulatedBlock: 12345,
    simulatedTx: 'anchor_tx_' + Math.random().toString(36).substring(7),
    ipfsCid: null,
    commitment: 'commitment_test',
    metadata: JSON.stringify({ test: true })
  };

  const testAnchorLogIpfs = {
    id: 'test-anchor-ipfs-' + Date.now(),
    proofHash: 'proof_ipfs_' + Math.random().toString(36).substring(7),
    memoryHash: 'mem_ipfs_' + Math.random().toString(36).substring(7),
    anchorType: 'ipfs' as const,
    simulatedBlock: 12346,
    simulatedTx: 'anchor_tx_ipfs_' + Math.random().toString(36).substring(7),
    ipfsCid: 'bafybeig' + Math.random().toString(36).substring(7) + 'testcid',
    commitment: 'commitment_ipfs_test',
    metadata: JSON.stringify({ ipfs: true })
  };

  describe('insertAnchorLog', () => {
    it('should insert a SQLite anchor log', () => {
      const result = insertAnchorLog(testAnchorLogSqlite);
      expect(result).toBe(true);
    });

    it('should insert an IPFS anchor log', () => {
      const result = insertAnchorLog(testAnchorLogIpfs);
      expect(result).toBe(true);
    });

    it('should fail on duplicate id', () => {
      // Try to insert the same record again
      const result = insertAnchorLog(testAnchorLogSqlite);
      expect(result).toBe(false);
    });
  });

  describe('getAnchorLogByProofHash', () => {
    it('should retrieve anchor log by proof hash', () => {
      const result = getAnchorLogByProofHash(testAnchorLogSqlite.proofHash);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(testAnchorLogSqlite.id);
      expect(result?.anchorType).toBe('sqlite');
      expect(result?.simulatedBlock).toBe(testAnchorLogSqlite.simulatedBlock);
    });

    it('should return null for non-existent proof hash', () => {
      const result = getAnchorLogByProofHash('non_existent_proof_hash');
      expect(result).toBeNull();
    });
  });

  describe('getAnchorLogByIpfsCid', () => {
    it('should retrieve IPFS anchor log by CID', () => {
      const result = getAnchorLogByIpfsCid(testAnchorLogIpfs.ipfsCid!);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(testAnchorLogIpfs.id);
      expect(result?.anchorType).toBe('ipfs');
      expect(result?.ipfsCid).toBe(testAnchorLogIpfs.ipfsCid);
    });

    it('should return null for non-existent CID', () => {
      const result = getAnchorLogByIpfsCid('bafybeignonexistent12345');
      expect(result).toBeNull();
    });
  });

  describe('getRecentAnchorLogs', () => {
    it('should retrieve recent anchor logs with default limit', () => {
      const results = getRecentAnchorLogs();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(2); // At least our 2 test logs
    });

    it('should respect limit parameter', () => {
      const results = getRecentAnchorLogs(1);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);
    });

    it('should filter by anchor type', () => {
      const sqliteResults = getRecentAnchorLogs(100, 'sqlite');
      expect(sqliteResults.every(log => log.anchorType === 'sqlite')).toBe(true);

      const ipfsResults = getRecentAnchorLogs(100, 'ipfs');
      expect(ipfsResults.every(log => log.anchorType === 'ipfs')).toBe(true);
    });
  });

  describe('getAnchorLogStats', () => {
    it('should return anchor log statistics', () => {
      const stats = getAnchorLogStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('byType');
      expect(typeof stats.total).toBe('number');
      expect(stats.total).toBeGreaterThanOrEqual(2);
    });

    it('should include breakdown by type', () => {
      const stats = getAnchorLogStats();
      expect(stats.byType).toBeDefined();
      // Should have at least sqlite and ipfs counts
      const hasTypeBreakdown = stats.byType.some(t => t.anchorType === 'sqlite') &&
                              stats.byType.some(t => t.anchorType === 'ipfs');
      expect(hasTypeBreakdown).toBe(true);
    });
  });
});
