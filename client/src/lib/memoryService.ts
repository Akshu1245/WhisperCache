/**
 * WhisperCache Memory Service
 * 
 * Manages encrypted memories with full encryption lifecycle:
 * - Create: Encrypt and store memories
 * - Read: Decrypt and return memories
 * - Query: Search memories (via ZK proofs - no decryption)
 * - Delete: Securely remove memories
 */

import { 
  EncryptedMemory, 
  encrypt, 
  decrypt, 
  hashData, 
  generateMemoryId,
  initCrypto 
} from './crypto';
import { keyManager } from './keyStore';

/**
 * Represents a memory with metadata
 */
export interface Memory {
  /** Unique memory identifier */
  id: string;
  /** Plaintext content (only available when decrypted) */
  content: string;
  /** Optional tags for categorization (stored unencrypted for querying) */
  tags: string[];
  /** Creation timestamp */
  createdAt: string;
  /** Last access timestamp */
  lastAccessedAt: string;
}

/**
 * Stored memory with encrypted content
 */
export interface StoredMemory {
  id: string;
  /** Encrypted content blob */
  encryptedContent: EncryptedMemory;
  /** Hash of content for ZK proof verification */
  contentHash: string;
  /** Unencrypted tags for querying */
  tags: string[];
  /** Key ID used for encryption */
  keyId: string;
  createdAt: string;
  lastAccessedAt: string;
}

/**
 * Result of a memory query (via ZK proof)
 */
export interface MemoryQueryResult {
  /** Memory ID that matched */
  memoryId: string;
  /** Confidence score from ZK proof */
  confidence: number;
  /** Pattern matched (without revealing content) */
  pattern: string;
  /** ZK proof hash */
  proofHash: string;
}

// Local storage for encrypted memories (in production, this would be server-side)
const MEMORY_STORE_KEY = 'wc_memories';

function loadMemoryStore(): Map<string, StoredMemory> {
  const stored = localStorage.getItem(MEMORY_STORE_KEY);
  if (!stored) return new Map();
  
  const entries: [string, StoredMemory][] = JSON.parse(stored);
  return new Map(entries);
}

function saveMemoryStore(store: Map<string, StoredMemory>): void {
  const entries = Array.from(store.entries());
  localStorage.setItem(MEMORY_STORE_KEY, JSON.stringify(entries));
}

/**
 * MemoryService class for managing encrypted memories
 */
export class MemoryService {
  private initialized = false;
  
  /**
   * Initializes the memory service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await initCrypto();
    await keyManager.initialize();
    this.initialized = true;
  }
  
  /**
   * Creates a new encrypted memory
   */
  async createMemory(content: string, tags: string[] = []): Promise<StoredMemory> {
    await this.ensureInitialized();
    
    const keyBundle = keyManager.requireKey();
    const id = await generateMemoryId();
    const now = new Date().toISOString();
    
    // Encrypt the content
    const encryptedContent = await encrypt(content, keyBundle.masterKey);
    
    // Create hash for ZK proof verification
    const contentHash = await hashData(content);
    
    const storedMemory: StoredMemory = {
      id,
      encryptedContent,
      contentHash,
      tags,
      keyId: keyBundle.keyId,
      createdAt: now,
      lastAccessedAt: now
    };
    
    // Store locally
    const store = loadMemoryStore();
    store.set(id, storedMemory);
    saveMemoryStore(store);
    
    return storedMemory;
  }
  
  /**
   * Retrieves and decrypts a memory by ID
   */
  async getMemory(id: string): Promise<Memory | null> {
    await this.ensureInitialized();
    
    const store = loadMemoryStore();
    const storedMemory = store.get(id);
    
    if (!storedMemory) return null;
    
    const keyBundle = keyManager.requireKey();
    
    // Verify key matches
    if (storedMemory.keyId !== keyBundle.keyId) {
      throw new Error('Memory encrypted with different key. Key rotation may be needed.');
    }
    
    // Decrypt content
    const content = await decrypt(storedMemory.encryptedContent, keyBundle.masterKey);
    
    // Update last accessed time
    storedMemory.lastAccessedAt = new Date().toISOString();
    store.set(id, storedMemory);
    saveMemoryStore(store);
    
    return {
      id: storedMemory.id,
      content,
      tags: storedMemory.tags,
      createdAt: storedMemory.createdAt,
      lastAccessedAt: storedMemory.lastAccessedAt
    };
  }
  
  /**
   * Lists all stored memories (metadata only, no decryption)
   */
  async listMemories(): Promise<Omit<StoredMemory, 'encryptedContent'>[]> {
    await this.ensureInitialized();
    
    const store = loadMemoryStore();
    
    return Array.from(store.values()).map(memory => ({
      id: memory.id,
      contentHash: memory.contentHash,
      tags: memory.tags,
      keyId: memory.keyId,
      createdAt: memory.createdAt,
      lastAccessedAt: memory.lastAccessedAt
    }));
  }
  
  /**
   * Queries memories by tag (no decryption needed)
   */
  async getMemoriesByTag(tag: string): Promise<Omit<StoredMemory, 'encryptedContent'>[]> {
    await this.ensureInitialized();
    
    const store = loadMemoryStore();
    
    return Array.from(store.values())
      .filter(memory => memory.tags.includes(tag))
      .map(memory => ({
        id: memory.id,
        contentHash: memory.contentHash,
        tags: memory.tags,
        keyId: memory.keyId,
        createdAt: memory.createdAt,
        lastAccessedAt: memory.lastAccessedAt
      }));
  }
  
  /**
   * Deletes a memory securely
   */
  async deleteMemory(id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const store = loadMemoryStore();
    const deleted = store.delete(id);
    
    if (deleted) {
      saveMemoryStore(store);
    }
    
    return deleted;
  }
  
  /**
   * Re-encrypts all memories with a new key (for key rotation)
   */
  async reEncryptAllMemories(oldKeyBase64: string, newKeyBase64: string): Promise<number> {
    await this.ensureInitialized();
    
    const store = loadMemoryStore();
    const newKeyBundle = keyManager.requireKey();
    let reEncryptedCount = 0;
    
    for (const [id, memory] of store.entries()) {
      try {
        // Decrypt with old key
        const content = await decrypt(memory.encryptedContent, oldKeyBase64);
        
        // Re-encrypt with new key
        const newEncryptedContent = await encrypt(content, newKeyBase64);
        
        // Update stored memory
        memory.encryptedContent = newEncryptedContent;
        memory.keyId = newKeyBundle.keyId;
        store.set(id, memory);
        
        reEncryptedCount++;
      } catch (error) {
        console.error(`Failed to re-encrypt memory ${id}:`, error);
      }
    }
    
    saveMemoryStore(store);
    return reEncryptedCount;
  }
  
  /**
   * Wipes all memories (irreversible!)
   */
  async wipeAllMemories(): Promise<void> {
    localStorage.removeItem(MEMORY_STORE_KEY);
  }
  
  /**
   * Gets encrypted memory for sending to ZK prover
   * Returns only what's needed for proof generation
   */
  async getMemoryForProof(id: string): Promise<{ contentHash: string; encryptedContent: EncryptedMemory } | null> {
    const store = loadMemoryStore();
    const memory = store.get(id);
    
    if (!memory) return null;
    
    return {
      contentHash: memory.contentHash,
      encryptedContent: memory.encryptedContent
    };
  }
  
  /**
   * Prepares all memories for ZK proof query
   * Returns hashes and encrypted blobs (not plaintext!)
   */
  async prepareMemoriesForQuery(): Promise<{ id: string; contentHash: string }[]> {
    const store = loadMemoryStore();
    
    return Array.from(store.values()).map(memory => ({
      id: memory.id,
      contentHash: memory.contentHash
    }));
  }
  
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// Singleton instance
export const memoryService = new MemoryService();
