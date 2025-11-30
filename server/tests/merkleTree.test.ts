/**
 * WhisperCache Merkle Tree Tests
 * 
 * Tests for the sparse Merkle tree implementation with Poseidon hash
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SparseMerkleTree, stringToField } from '../src/lib/merkleTree';

describe('Sparse Merkle Tree', () => {
  let tree: SparseMerkleTree;

  beforeEach(async () => {
    tree = new SparseMerkleTree(20);
    await tree.initialize();
  });

  describe('Initialization', () => {
    it('should initialize with correct depth', () => {
      expect(tree.getDepth()).toBe(20);
    });

    it('should have empty root initially', () => {
      const root = tree.getRoot();
      
      expect(root).toBeDefined();
      expect(typeof root).toBe('string');
      expect(root.length).toBeGreaterThan(0);
    });

    it('should have zero leaves initially', () => {
      expect(tree.getLeafCount()).toBe(0n);
    });
  });

  describe('Insertion', () => {
    it('should insert a leaf and update root', async () => {
      const initialRoot = tree.getRoot();
      
      const leaf = stringToField('memory_content_1').toString();
      const result = await tree.insert(leaf);
      
      const newRoot = tree.getRoot();
      expect(newRoot).not.toBe(initialRoot);
      expect(result.oldRoot).toBe(initialRoot);
      expect(result.newRoot).toBe(newRoot);
      expect(result.index).toBe(0n);
    });

    it('should insert multiple leaves', async () => {
      const leaf1 = stringToField('memory_1').toString();
      const leaf2 = stringToField('memory_2').toString();
      const leaf3 = stringToField('memory_3').toString();

      await tree.insert(leaf1);
      await tree.insert(leaf2);
      await tree.insert(leaf3);

      expect(tree.getLeafCount()).toBe(3n);
    });

    it('should track leaf indices', async () => {
      const leaf1 = stringToField('memory_a').toString();
      const leaf2 = stringToField('memory_b').toString();

      const result1 = await tree.insert(leaf1);
      const result2 = await tree.insert(leaf2);

      expect(result1.index).toBe(0n);
      expect(result2.index).toBe(1n);
      expect(tree.getLeafIndex(leaf1)).toBe(0n);
      expect(tree.getLeafIndex(leaf2)).toBe(1n);
    });

    it('should not allow duplicate leaves', async () => {
      const leaf = stringToField('unique_memory').toString();
      
      await tree.insert(leaf);
      
      await expect(tree.insert(leaf)).rejects.toThrow('Leaf already exists');
    });
  });

  describe('Batch Insertion', () => {
    it('should insert multiple leaves in batch', async () => {
      const leaves = [
        stringToField('batch_1').toString(),
        stringToField('batch_2').toString(),
        stringToField('batch_3').toString()
      ];

      const result = await tree.insertBatch(leaves);

      expect(result.insertedLeaves.length).toBe(3);
      expect(result.insertedIndices.length).toBe(3);
      expect(tree.getLeafCount()).toBe(3n);
    });
  });

  describe('Proof Generation', () => {
    it('should generate a valid proof', async () => {
      const leaf = stringToField('provable_memory').toString();
      await tree.insert(leaf);
      
      const proof = await tree.generateProof(leaf);
      
      expect(proof).toBeDefined();
      expect(proof.leaf).toBe(leaf);
      expect(proof.siblings.length).toBe(20);
      expect(proof.pathIndices.length).toBe(20);
      expect(proof.root).toBe(tree.getRoot());
    });

    it('should throw error for non-existent leaf', async () => {
      const unknownLeaf = stringToField('unknown').toString();
      
      await expect(tree.generateProof(unknownLeaf)).rejects.toThrow('Leaf not found');
    });
  });

  describe('Proof Verification', () => {
    it('should verify a valid proof', async () => {
      const leaf = stringToField('verifiable_memory').toString();
      await tree.insert(leaf);
      
      const proof = await tree.generateProof(leaf);
      const isValid = await tree.verifyProof(proof);
      
      expect(isValid).toBe(true);
    });

    it('should reject proof with modified leaf', async () => {
      const leaf = stringToField('original_memory').toString();
      await tree.insert(leaf);
      
      const proof = await tree.generateProof(leaf);
      
      // Modify the leaf
      const tamperedProof = { ...proof, leaf: stringToField('tampered').toString() };
      const isValid = await tree.verifyProof(tamperedProof);
      
      expect(isValid).toBe(false);
    });

    it('should reject proof with wrong root', async () => {
      const leaf = stringToField('rooted_memory').toString();
      await tree.insert(leaf);
      
      const proof = await tree.generateProof(leaf);
      
      // Modify the root
      const tamperedProof = { ...proof, root: '12345' };
      const isValid = await tree.verifyProof(tamperedProof);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Leaf Lookup', () => {
    it('should check leaf existence', async () => {
      const leaf = stringToField('existing_memory').toString();
      
      expect(tree.hasLeaf(leaf)).toBe(false);
      
      await tree.insert(leaf);
      
      expect(tree.hasLeaf(leaf)).toBe(true);
    });

    it('should return null for unknown leaf index', () => {
      const unknownLeaf = stringToField('unknown').toString();
      expect(tree.getLeafIndex(unknownLeaf)).toBeNull();
    });
  });

  describe('Utility Functions', () => {
    it('should convert string to field element', () => {
      const field = stringToField('test content');
      
      expect(typeof field).toBe('bigint');
      expect(field).toBeGreaterThan(0n);
    });

    it('should produce consistent field elements', () => {
      const field1 = stringToField('same content');
      const field2 = stringToField('same content');
      
      expect(field1).toBe(field2);
    });

    it('should produce different field elements for different inputs', () => {
      const field1 = stringToField('content A');
      const field2 = stringToField('content B');
      
      expect(field1).not.toBe(field2);
    });
  });
});
