/**
 * WhisperCache React Hooks
 * 
 * Provides React hooks for encryption and memory management
 */

import { useState, useEffect, useCallback } from 'react';
import { memoryService, Memory, StoredMemory, MemoryService } from './memoryService';
import { keyManager, KeyManager, StorageMode } from './keyStore';
import { KeyBundle } from './crypto';
import { api, ZKProveResponse } from './api';

/**
 * Hook for managing encryption keys
 */
export function useEncryption() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [keyBundle, setKeyBundle] = useState<KeyBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeEncryption();
  }, []);

  const initializeEncryption = async () => {
    try {
      setIsLoading(true);
      const bundle = await keyManager.initialize();
      setKeyBundle(bundle);
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize encryption');
    } finally {
      setIsLoading(false);
    }
  };

  const rotateKey = useCallback(async () => {
    try {
      setIsLoading(true);
      const { oldKey, newKey } = await keyManager.rotateKey();
      
      // Log compliance event
      await api.logCompliance('rotate_key', newKey.keyId, undefined, {
        previousKeyId: oldKey.keyId
      }).catch(console.error);
      
      // Re-encrypt all memories with new key
      await memoryService.reEncryptAllMemories(oldKey.masterKey, newKey.masterKey);
      
      setKeyBundle(newKey);
      return { success: true, newKeyId: newKey.keyId };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Key rotation failed');
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const wipeKeys = useCallback(async () => {
    try {
      const currentKey = keyManager.getCurrentKey();
      if (currentKey) {
        await api.logCompliance('delete', currentKey.keyId, undefined, {
          action: 'wipe_all_keys'
        }).catch(console.error);
      }
      
      await keyManager.wipeAllKeys();
      await memoryService.wipeAllMemories();
      setKeyBundle(null);
      setIsInitialized(false);
      return { success: true };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to wipe keys');
      return { success: false, error: err };
    }
  }, []);

  return {
    isInitialized,
    keyBundle,
    keyId: keyBundle?.keyId || null,
    error,
    isLoading,
    rotateKey,
    wipeKeys,
    reinitialize: initializeEncryption
  };
}

/**
 * Hook for managing encrypted memories
 */
export function useMemories() {
  const [memories, setMemories] = useState<Omit<StoredMemory, 'encryptedContent'>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isInitialized, keyId } = useEncryption();

  // Load memories on init
  useEffect(() => {
    if (isInitialized) {
      loadMemories();
    }
  }, [isInitialized]);

  const loadMemories = useCallback(async () => {
    try {
      setIsLoading(true);
      const list = await memoryService.listMemories();
      setMemories(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createMemory = useCallback(async (content: string, tags: string[] = []) => {
    try {
      setIsLoading(true);
      const stored = await memoryService.createMemory(content, tags);
      
      // Log compliance event
      if (keyId) {
        await api.logCompliance('create', keyId, stored.id, { tags }).catch(console.error);
      }
      
      await loadMemories(); // Refresh list
      return { success: true, memory: stored };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create memory');
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  }, [loadMemories, keyId]);

  const getMemory = useCallback(async (id: string): Promise<Memory | null> => {
    try {
      setIsLoading(true);
      const memory = await memoryService.getMemory(id);
      
      // Log compliance event
      if (keyId && memory) {
        await api.logCompliance('access', keyId, id).catch(console.error);
      }
      
      return memory;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get memory');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [keyId]);

  const deleteMemory = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const deleted = await memoryService.deleteMemory(id);
      
      // Log compliance event
      if (keyId && deleted) {
        await api.logCompliance('delete', keyId, id).catch(console.error);
      }
      
      if (deleted) {
        await loadMemories();
      }
      return { success: deleted };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete memory');
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  }, [loadMemories, keyId]);

  const getMemoriesByTag = useCallback(async (tag: string) => {
    try {
      return await memoryService.getMemoriesByTag(tag);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to query memories');
      return [];
    }
  }, []);

  return {
    memories,
    isLoading,
    error,
    createMemory,
    getMemory,
    deleteMemory,
    getMemoriesByTag,
    refresh: loadMemories
  };
}

/**
 * Hook for ZK proof queries
 */
export function useZKQuery() {
  const [isProving, setIsProving] = useState(false);
  const [lastProof, setLastProof] = useState<ZKProveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { keyId } = useEncryption();

  const queryMemories = useCallback(async (query: string) => {
    try {
      setIsProving(true);
      setError(null);

      // Get memory hashes for proof
      const memoryData = await memoryService.prepareMemoriesForQuery();

      // Call backend ZK prover via API client
      const proof = await api.prove(query, memoryData.map(m => m.contentHash));
      
      // Log compliance event
      if (keyId) {
        await api.logCompliance('proof', keyId, undefined, {
          query,
          proofHash: proof.proofHash,
          confidence: proof.confidence
        }).catch(console.error);
      }
      
      setLastProof(proof);
      
      return { success: true, proof };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Query failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsProving(false);
    }
  }, [keyId]);

  const verifyProof = useCallback(async (proofHash: string) => {
    try {
      const result = await api.verifyProof(proofHash);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      return { proofHash, verified: false };
    }
  }, []);

  return {
    isProving,
    lastProof,
    error,
    queryMemories,
    verifyProof
  };
}

/**
 * Hook for blockchain anchoring
 */
export function useAnchor() {
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [lastAnchor, setLastAnchor] = useState<{
    anchorType?: string;
    anchorId?: string;
    ipfsCid?: string;
    txId?: string;
    status?: string;
    blockHeight?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { keyId } = useEncryption();

  const anchorProof = useCallback(async (memoryHash: string, proofHash: string) => {
    if (!keyId) {
      return { success: false, error: 'No encryption key' };
    }

    try {
      setIsAnchoring(true);
      setError(null);

      const result = await api.anchor(memoryHash, proofHash, keyId);
      
      // Log compliance event
      await api.logCompliance('anchor', keyId, undefined, {
        anchorType: result.anchorType,
        anchorId: result.anchorLog?.id,
        proofHash,
        memoryHash
      }).catch(console.error);

      setLastAnchor({
        anchorType: result.anchorType,
        anchorId: result.anchorLog?.id,
        ipfsCid: result.anchorLog?.ipfsCid,
        txId: result.txId || result.midnight?.txId || result.cardano?.txId,
        status: result.success ? 'confirmed' : 'failed',
        blockHeight: result.anchorLog?.simulatedBlock || result.midnight?.blockHeight || result.cardano?.blockHeight
      });

      return { success: true, anchor: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Anchoring failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsAnchoring(false);
    }
  }, [keyId]);

  return {
    isAnchoring,
    lastAnchor,
    error,
    anchorProof
  };
}
