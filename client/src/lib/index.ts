/**
 * WhisperCache Client Library
 * 
 * Exports all encryption, storage, and memory management utilities
 */

// Core crypto functions
export {
  initCrypto,
  generateMasterKey,
  encrypt,
  decrypt,
  deriveSubKey,
  hashData,
  secureWipe,
  generateMemoryId,
  type EncryptedMemory,
  type KeyBundle
} from './crypto';

// Key management
export {
  KeyManager,
  keyManager,
  type StorageMode
} from './keyStore';

// Memory service
export {
  MemoryService,
  memoryService,
  type Memory,
  type StoredMemory,
  type MemoryQueryResult
} from './memoryService';

// React hooks
export {
  useEncryption,
  useMemories,
  useZKQuery,
  useAnchor
} from './hooks';

// API client
export {
  api,
  ApiClient,
  type ZKProveResponse,
  type AnchorResponse,
  type HealthResponse
} from './api';
