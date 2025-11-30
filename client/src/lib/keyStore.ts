/**
 * WhisperCache Secure Key Storage
 * 
 * Manages encryption keys with secure storage strategies:
 * 1. Web Crypto API (SubtleCrypto) for key wrapping
 * 2. IndexedDB for persistent storage
 * 3. Memory-only mode for maximum security
 * 
 * Note: For production, consider:
 * - WebAuthn/FIDO2 for hardware-backed key protection
 * - Secure Enclave on supported devices
 */

import { KeyBundle, generateMasterKey, initCrypto } from './crypto';

const DB_NAME = 'WhisperCacheKeyStore';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

export type StorageMode = 'memory' | 'session' | 'persistent';

interface StoredKeyBundle extends KeyBundle {
  /** Indicates if key is wrapped with device-specific key */
  isWrapped: boolean;
}

// In-memory key cache (cleared on page refresh)
let memoryKeyCache: Map<string, KeyBundle> = new Map();

/**
 * Opens IndexedDB connection for key storage
 */
function openKeyStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'keyId' });
      }
    };
  });
}

/**
 * KeyManager class for handling encryption keys
 */
export class KeyManager {
  private currentKeyBundle: KeyBundle | null = null;
  private storageMode: StorageMode;
  
  constructor(storageMode: StorageMode = 'session') {
    this.storageMode = storageMode;
  }
  
  /**
   * Initializes the key manager and loads or generates keys
   */
  async initialize(): Promise<KeyBundle> {
    await initCrypto();
    
    // Try to load existing key
    let keyBundle = await this.loadKey();
    
    if (!keyBundle) {
      // Generate new key if none exists
      keyBundle = await generateMasterKey();
      await this.saveKey(keyBundle);
    }
    
    this.currentKeyBundle = keyBundle;
    return keyBundle;
  }
  
  /**
   * Gets the current encryption key
   */
  getCurrentKey(): KeyBundle | null {
    return this.currentKeyBundle;
  }
  
  /**
   * Gets the current key or throws if not initialized
   */
  requireKey(): KeyBundle {
    if (!this.currentKeyBundle) {
      throw new Error('KeyManager not initialized. Call initialize() first.');
    }
    return this.currentKeyBundle;
  }
  
  /**
   * Saves a key bundle to storage
   */
  private async saveKey(keyBundle: KeyBundle): Promise<void> {
    switch (this.storageMode) {
      case 'memory':
        memoryKeyCache.set(keyBundle.keyId, keyBundle);
        break;
        
      case 'session':
        // Store in sessionStorage (cleared when tab closes)
        sessionStorage.setItem(`wc_key_${keyBundle.keyId}`, JSON.stringify(keyBundle));
        sessionStorage.setItem('wc_current_key_id', keyBundle.keyId);
        break;
        
      case 'persistent':
        // Store in IndexedDB
        const db = await openKeyStore();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        await new Promise<void>((resolve, reject) => {
          const request = store.put({ ...keyBundle, isWrapped: false });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
        
        localStorage.setItem('wc_current_key_id', keyBundle.keyId);
        db.close();
        break;
    }
  }
  
  /**
   * Loads a key bundle from storage
   */
  private async loadKey(): Promise<KeyBundle | null> {
    switch (this.storageMode) {
      case 'memory':
        const memoryKeys = Array.from(memoryKeyCache.values());
        return memoryKeys.length > 0 ? memoryKeys[memoryKeys.length - 1] : null;
        
      case 'session':
        const sessionKeyId = sessionStorage.getItem('wc_current_key_id');
        if (!sessionKeyId) return null;
        
        const sessionKeyStr = sessionStorage.getItem(`wc_key_${sessionKeyId}`);
        return sessionKeyStr ? JSON.parse(sessionKeyStr) : null;
        
      case 'persistent':
        const persistentKeyId = localStorage.getItem('wc_current_key_id');
        if (!persistentKeyId) return null;
        
        try {
          const db = await openKeyStore();
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          
          const keyBundle = await new Promise<StoredKeyBundle | null>((resolve, reject) => {
            const request = store.get(persistentKeyId);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
          });
          
          db.close();
          return keyBundle;
        } catch (error) {
          console.error('Failed to load key from IndexedDB:', error);
          return null;
        }
    }
  }
  
  /**
   * Rotates to a new encryption key
   * Returns the old key for re-encryption purposes
   */
  async rotateKey(): Promise<{ oldKey: KeyBundle; newKey: KeyBundle }> {
    const oldKey = this.requireKey();
    const newKey = await generateMasterKey();
    
    await this.saveKey(newKey);
    this.currentKeyBundle = newKey;
    
    return { oldKey, newKey };
  }
  
  /**
   * Wipes all keys from storage
   * DANGER: This will make all encrypted data unrecoverable!
   */
  async wipeAllKeys(): Promise<void> {
    switch (this.storageMode) {
      case 'memory':
        memoryKeyCache.clear();
        break;
        
      case 'session':
        // Remove all wc_ prefixed items
        const sessionKeys = Object.keys(sessionStorage).filter(k => k.startsWith('wc_'));
        sessionKeys.forEach(k => sessionStorage.removeItem(k));
        break;
        
      case 'persistent':
        const db = await openKeyStore();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        await new Promise<void>((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
        
        localStorage.removeItem('wc_current_key_id');
        db.close();
        break;
    }
    
    this.currentKeyBundle = null;
  }
  
  /**
   * Exports the current key (for backup purposes)
   * WARNING: Handle exported keys with extreme care!
   */
  exportKey(): string {
    const key = this.requireKey();
    return JSON.stringify(key);
  }
  
  /**
   * Imports a previously exported key
   */
  async importKey(exportedKey: string): Promise<KeyBundle> {
    const keyBundle: KeyBundle = JSON.parse(exportedKey);
    
    // Validate key structure
    if (!keyBundle.masterKey || !keyBundle.keyId || !keyBundle.version) {
      throw new Error('Invalid key bundle format');
    }
    
    await this.saveKey(keyBundle);
    this.currentKeyBundle = keyBundle;
    
    return keyBundle;
  }
}

// Singleton instance for convenience
export const keyManager = new KeyManager('session');
