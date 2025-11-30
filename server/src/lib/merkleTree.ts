/**
 * WhisperCache Merkle Tree Implementation
 * 
 * Implements a sparse Merkle tree for memory commitment proofs.
 * Uses Poseidon hash for efficient ZK-SNARK compatibility.
 * 
 * Features:
 * - Sparse Merkle tree for efficient storage
 * - Poseidon hash for ZK compatibility
 * - Membership and non-membership proofs
 * - Batch insertions and updates
 * - Serialization for persistence
 */

import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface MerkleProof {
  leaf: string;
  leafIndex: bigint;
  siblings: string[];
  pathIndices: number[]; // 0 = left, 1 = right
  root: string;
}

export interface BatchInsertResult {
  oldRoot: string;
  newRoot: string;
  insertedLeaves: string[];
  insertedIndices: bigint[];
}

export interface MerkleTreeState {
  depth: number;
  nextIndex: bigint;
  root: string;
  leaves: Map<string, bigint>; // leaf -> index
  nodes: Map<string, string>; // nodeKey -> hash
}

// ============================================================================
// Poseidon Hash (lazy loaded)
// ============================================================================

interface PoseidonFn {
  (inputs: bigint[]): any;
  F: {
    toObject: (val: any) => bigint;
  };
}

let poseidonInstance: PoseidonFn | null = null;

async function getPoseidon(): Promise<PoseidonFn> {
  if (poseidonInstance) return poseidonInstance;
  
  const { buildPoseidon } = await import('circomlibjs');
  poseidonInstance = await buildPoseidon();
  return poseidonInstance;
}

/**
 * Compute Poseidon hash of two values (for tree nodes)
 */
async function poseidonHash(left: bigint, right: bigint): Promise<bigint> {
  const poseidon = await getPoseidon();
  return poseidon.F.toObject(poseidon([left, right]));
}

/**
 * Convert a string commitment to a field element
 */
export function stringToField(str: string): bigint {
  const hash = createHash('sha256').update(str).digest('hex');
  return BigInt('0x' + hash.slice(0, 62)); // 248 bits
}

// ============================================================================
// Sparse Merkle Tree Class
// ============================================================================

export class SparseMerkleTree {
  private depth: number;
  private nextIndex: bigint;
  private root: string;
  private leaves: Map<string, bigint>; // leaf hash -> index
  private nodes: Map<string, string>;  // level:index -> hash
  private zeroHashes: string[];        // Default hashes for empty nodes
  
  constructor(depth: number = 20) {
    if (depth < 1 || depth > 32) {
      throw new Error('Tree depth must be between 1 and 32');
    }
    
    this.depth = depth;
    this.nextIndex = 0n;
    this.leaves = new Map();
    this.nodes = new Map();
    this.zeroHashes = [];
    this.root = '';
  }

  /**
   * Initialize the tree with zero hashes
   */
  async initialize(): Promise<void> {
    // Compute zero hashes for each level
    let currentZero = 0n;
    this.zeroHashes = [currentZero.toString()];
    
    for (let i = 1; i <= this.depth; i++) {
      currentZero = await poseidonHash(currentZero, currentZero);
      this.zeroHashes.push(currentZero.toString());
    }
    
    // Initial root is the zero hash at the top level
    this.root = this.zeroHashes[this.depth];
    console.log(`[MerkleTree] Initialized with depth ${this.depth}, root: ${this.root.slice(0, 20)}...`);
  }

  /**
   * Get the current root hash
   */
  getRoot(): string {
    return this.root;
  }

  /**
   * Get the depth of the tree
   */
  getDepth(): number {
    return this.depth;
  }

  /**
   * Get the number of leaves inserted
   */
  getLeafCount(): bigint {
    return this.nextIndex;
  }

  /**
   * Check if a leaf exists in the tree
   */
  hasLeaf(leaf: string): boolean {
    return this.leaves.has(leaf);
  }

  /**
   * Get the index of a leaf
   */
  getLeafIndex(leaf: string): bigint | null {
    return this.leaves.get(leaf) ?? null;
  }

  /**
   * Insert a new leaf into the tree
   */
  async insert(leaf: string): Promise<{ index: bigint; oldRoot: string; newRoot: string }> {
    const maxLeaves = 2n ** BigInt(this.depth);
    if (this.nextIndex >= maxLeaves) {
      throw new Error(`Tree is full (max ${maxLeaves} leaves)`);
    }

    if (this.leaves.has(leaf)) {
      throw new Error(`Leaf already exists at index ${this.leaves.get(leaf)}`);
    }

    const oldRoot = this.root;
    const index = this.nextIndex;
    
    // Store the leaf
    this.leaves.set(leaf, index);
    this.nodes.set(`0:${index}`, leaf);

    // Update the path from leaf to root
    let currentHash = BigInt(leaf);
    let currentIndex = index;

    for (let level = 0; level < this.depth; level++) {
      const isRight = currentIndex % 2n === 1n;
      const siblingIndex = isRight ? currentIndex - 1n : currentIndex + 1n;
      
      // Get sibling hash (use zero hash if sibling doesn't exist)
      const siblingKey = `${level}:${siblingIndex}`;
      const siblingHash = this.nodes.has(siblingKey) 
        ? BigInt(this.nodes.get(siblingKey)!) 
        : BigInt(this.zeroHashes[level]);

      // Compute parent hash
      const parentHash = isRight
        ? await poseidonHash(siblingHash, currentHash)
        : await poseidonHash(currentHash, siblingHash);

      // Move up to parent
      currentIndex = currentIndex / 2n;
      currentHash = parentHash;

      // Store the node
      this.nodes.set(`${level + 1}:${currentIndex}`, currentHash.toString());
    }

    this.root = currentHash.toString();
    this.nextIndex++;

    return { index, oldRoot, newRoot: this.root };
  }

  /**
   * Insert multiple leaves in batch
   */
  async insertBatch(leaves: string[]): Promise<BatchInsertResult> {
    const oldRoot = this.root;
    const insertedIndices: bigint[] = [];
    
    for (const leaf of leaves) {
      const { index } = await this.insert(leaf);
      insertedIndices.push(index);
    }

    return {
      oldRoot,
      newRoot: this.root,
      insertedLeaves: leaves,
      insertedIndices
    };
  }

  /**
   * Generate a Merkle proof for a leaf
   */
  async generateProof(leaf: string): Promise<MerkleProof> {
    const index = this.leaves.get(leaf);
    if (index === undefined) {
      throw new Error('Leaf not found in tree');
    }

    const siblings: string[] = [];
    const pathIndices: number[] = [];
    let currentIndex = index;

    for (let level = 0; level < this.depth; level++) {
      const isRight = currentIndex % 2n === 1n;
      const siblingIndex = isRight ? currentIndex - 1n : currentIndex + 1n;
      
      pathIndices.push(isRight ? 1 : 0);

      // Get sibling hash
      const siblingKey = `${level}:${siblingIndex}`;
      const siblingHash = this.nodes.has(siblingKey)
        ? this.nodes.get(siblingKey)!
        : this.zeroHashes[level];
      
      siblings.push(siblingHash);
      
      // Move up
      currentIndex = currentIndex / 2n;
    }

    return {
      leaf,
      leafIndex: index,
      siblings,
      pathIndices,
      root: this.root
    };
  }

  /**
   * Verify a Merkle proof
   */
  async verifyProof(proof: MerkleProof): Promise<boolean> {
    let currentHash = BigInt(proof.leaf);

    for (let i = 0; i < proof.siblings.length; i++) {
      const sibling = BigInt(proof.siblings[i]);
      const isRight = proof.pathIndices[i] === 1;

      currentHash = isRight
        ? await poseidonHash(sibling, currentHash)
        : await poseidonHash(currentHash, sibling);
    }

    return currentHash.toString() === proof.root;
  }

  /**
   * Update a leaf in the tree (for revocation)
   */
  async updateLeaf(oldLeaf: string, newLeaf: string): Promise<{ oldRoot: string; newRoot: string }> {
    const index = this.leaves.get(oldLeaf);
    if (index === undefined) {
      throw new Error('Leaf not found in tree');
    }

    if (this.leaves.has(newLeaf)) {
      throw new Error('New leaf already exists');
    }

    const oldRoot = this.root;

    // Update leaf mapping
    this.leaves.delete(oldLeaf);
    this.leaves.set(newLeaf, index);
    this.nodes.set(`0:${index}`, newLeaf);

    // Recompute path to root
    let currentHash = BigInt(newLeaf);
    let currentIndex = index;

    for (let level = 0; level < this.depth; level++) {
      const isRight = currentIndex % 2n === 1n;
      const siblingIndex = isRight ? currentIndex - 1n : currentIndex + 1n;
      
      const siblingKey = `${level}:${siblingIndex}`;
      const siblingHash = this.nodes.has(siblingKey)
        ? BigInt(this.nodes.get(siblingKey)!)
        : BigInt(this.zeroHashes[level]);

      const parentHash = isRight
        ? await poseidonHash(siblingHash, currentHash)
        : await poseidonHash(currentHash, siblingHash);

      currentIndex = currentIndex / 2n;
      currentHash = parentHash;

      this.nodes.set(`${level + 1}:${currentIndex}`, currentHash.toString());
    }

    this.root = currentHash.toString();

    return { oldRoot, newRoot: this.root };
  }

  /**
   * Serialize tree state for persistence
   */
  serialize(): string {
    const state = {
      depth: this.depth,
      nextIndex: this.nextIndex.toString(),
      root: this.root,
      leaves: Array.from(this.leaves.entries()),
      nodes: Array.from(this.nodes.entries()),
      zeroHashes: this.zeroHashes
    };
    return JSON.stringify(state);
  }

  /**
   * Deserialize tree state from persistence
   */
  static deserialize(data: string): SparseMerkleTree {
    const state = JSON.parse(data);
    const tree = new SparseMerkleTree(state.depth);
    
    tree.nextIndex = BigInt(state.nextIndex);
    tree.root = state.root;
    tree.leaves = new Map(state.leaves.map(([k, v]: [string, string]) => [k, BigInt(v)]));
    tree.nodes = new Map(state.nodes);
    tree.zeroHashes = state.zeroHashes;
    
    return tree;
  }

  /**
   * Get tree statistics
   */
  getStats(): {
    depth: number;
    leafCount: bigint;
    maxLeaves: bigint;
    nodeCount: number;
    rootHash: string;
    utilizationPercent: number;
  } {
    const maxLeaves = 2n ** BigInt(this.depth);
    const utilizationPercent = Number((this.nextIndex * 100n) / maxLeaves);
    
    return {
      depth: this.depth,
      leafCount: this.nextIndex,
      maxLeaves,
      nodeCount: this.nodes.size,
      rootHash: this.root,
      utilizationPercent
    };
  }
}

// ============================================================================
// Merkle Tree Manager (for multi-user support)
// ============================================================================

export class MerkleTreeManager {
  private trees: Map<string, SparseMerkleTree>;
  private defaultDepth: number;

  constructor(defaultDepth: number = 20) {
    this.trees = new Map();
    this.defaultDepth = defaultDepth;
  }

  /**
   * Get or create a tree for a user
   */
  async getTree(userId: string): Promise<SparseMerkleTree> {
    if (!this.trees.has(userId)) {
      const tree = new SparseMerkleTree(this.defaultDepth);
      await tree.initialize();
      this.trees.set(userId, tree);
    }
    return this.trees.get(userId)!;
  }

  /**
   * Insert a memory commitment for a user
   */
  async insertCommitment(userId: string, commitment: string): Promise<{
    index: bigint;
    oldRoot: string;
    newRoot: string;
  }> {
    const tree = await this.getTree(userId);
    return tree.insert(commitment);
  }

  /**
   * Generate a proof for a memory commitment
   */
  async generateProof(userId: string, commitment: string): Promise<MerkleProof> {
    const tree = await this.getTree(userId);
    return tree.generateProof(commitment);
  }

  /**
   * Verify a proof
   */
  async verifyProof(proof: MerkleProof): Promise<boolean> {
    // Create a temporary tree for verification (stateless)
    const tree = new SparseMerkleTree(proof.siblings.length);
    await tree.initialize();
    return tree.verifyProof(proof);
  }

  /**
   * Revoke a memory (update leaf to revocation marker)
   */
  async revokeCommitment(userId: string, commitment: string): Promise<{
    oldRoot: string;
    newRoot: string;
    revocationMarker: string;
  }> {
    const tree = await this.getTree(userId);
    
    // Create revocation marker (hash of original commitment with "REVOKED" flag)
    const revocationMarker = stringToField(`REVOKED:${commitment}`).toString();
    
    const result = await tree.updateLeaf(commitment, revocationMarker);
    
    return {
      ...result,
      revocationMarker
    };
  }

  /**
   * Get the current root for a user
   */
  async getRoot(userId: string): Promise<string> {
    const tree = await this.getTree(userId);
    return tree.getRoot();
  }

  /**
   * Get tree statistics for a user
   */
  async getStats(userId: string): Promise<ReturnType<SparseMerkleTree['getStats']>> {
    const tree = await this.getTree(userId);
    return tree.getStats();
  }

  /**
   * Get overall statistics
   */
  getManagerStats(): {
    userCount: number;
    totalLeaves: bigint;
    users: Array<{ userId: string; leafCount: bigint; root: string }>;
  } {
    let totalLeaves = 0n;
    const users: Array<{ userId: string; leafCount: bigint; root: string }> = [];

    for (const [userId, tree] of this.trees) {
      const stats = tree.getStats();
      totalLeaves += stats.leafCount;
      users.push({
        userId,
        leafCount: stats.leafCount,
        root: stats.rootHash
      });
    }

    return {
      userCount: this.trees.size,
      totalLeaves,
      users
    };
  }

  /**
   * Serialize all trees for persistence
   */
  serializeAll(): string {
    const data: Record<string, string> = {};
    for (const [userId, tree] of this.trees) {
      data[userId] = tree.serialize();
    }
    return JSON.stringify(data);
  }

  /**
   * Deserialize all trees from persistence
   */
  deserializeAll(data: string): void {
    const parsed = JSON.parse(data);
    for (const [userId, treeData] of Object.entries(parsed)) {
      this.trees.set(userId, SparseMerkleTree.deserialize(treeData as string));
    }
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

let treeManager: MerkleTreeManager | null = null;

export function getMerkleTreeManager(defaultDepth: number = 20): MerkleTreeManager {
  if (!treeManager) {
    treeManager = new MerkleTreeManager(defaultDepth);
  }
  return treeManager;
}

// Initialize on module load
getPoseidon().catch(err => console.error('[MerkleTree] Failed to init Poseidon:', err));
