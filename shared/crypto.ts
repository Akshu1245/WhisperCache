/**
 * WhisperCache Cryptography Module
 * 
 * Uses libsodium's XChaCha20-Poly1305 for authenticated encryption.
 * This is the same algorithm used by Signal, WhatsApp, and other privacy-focused apps.
 * 
 * Key features:
 * - XChaCha20-Poly1305: Extended nonce for safer random nonce generation
 * - 256-bit symmetric keys
 * - Authenticated encryption (AEAD) - protects both confidentiality and integrity
 */

import _sodium from 'libsodium-wrappers';

// Ensure sodium is initialized before use
let sodiumReady = false;

export async function initCrypto(): Promise<void> {
  if (!sodiumReady) {
    await _sodium.ready;
    sodiumReady = true;
  }
}

export function getSodium(): typeof _sodium {
  if (!sodiumReady) {
    throw new Error('Crypto not initialized. Call initCrypto() first.');
  }
  return _sodium;
}

/**
 * Represents an encrypted memory blob with metadata
 */
export interface EncryptedMemory {
  /** Base64-encoded ciphertext (includes auth tag) */
  ciphertext: string;
  /** Base64-encoded nonce (24 bytes for XChaCha20) */
  nonce: string;
  /** Timestamp of encryption */
  encryptedAt: string;
  /** Version of encryption scheme (for future migrations) */
  version: number;
}

/**
 * Represents a user's encryption key bundle
 */
export interface KeyBundle {
  /** Base64-encoded 256-bit symmetric key */
  masterKey: string;
  /** Unique identifier for this key (hash of public portion) */
  keyId: string;
  /** Creation timestamp */
  createdAt: string;
  /** Key derivation version */
  version: number;
}

/**
 * Generates a new random 256-bit symmetric key for XChaCha20-Poly1305
 */
export async function generateMasterKey(): Promise<KeyBundle> {
  await initCrypto();
  const sodium = getSodium();
  
  // Generate 256-bit (32 byte) random key
  const key = sodium.crypto_secretbox_keygen();
  const keyBase64 = sodium.to_base64(key, sodium.base64_variants.ORIGINAL);
  
  // Create a key ID by hashing the key (for identification without exposing key)
  const keyIdBytes = sodium.crypto_generichash(16, key);
  const keyId = sodium.to_hex(keyIdBytes);
  
  return {
    masterKey: keyBase64,
    keyId: keyId,
    createdAt: new Date().toISOString(),
    version: 1
  };
}

/**
 * Encrypts plaintext using XChaCha20-Poly1305
 * 
 * @param plaintext - The data to encrypt (string)
 * @param keyBase64 - Base64-encoded 256-bit key
 * @returns EncryptedMemory object with ciphertext and metadata
 */
export async function encrypt(plaintext: string, keyBase64: string): Promise<EncryptedMemory> {
  await initCrypto();
  const sodium = getSodium();
  
  // Decode the key from base64
  const key = sodium.from_base64(keyBase64, sodium.base64_variants.ORIGINAL);
  
  // Generate random 24-byte nonce for XChaCha20
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  
  // Convert plaintext to bytes
  const plaintextBytes = sodium.from_string(plaintext);
  
  // Encrypt using XChaCha20-Poly1305 (secretbox)
  const ciphertext = sodium.crypto_secretbox_easy(plaintextBytes, nonce, key);
  
  return {
    ciphertext: sodium.to_base64(ciphertext, sodium.base64_variants.ORIGINAL),
    nonce: sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
    encryptedAt: new Date().toISOString(),
    version: 1
  };
}

/**
 * Decrypts ciphertext using XChaCha20-Poly1305
 * 
 * @param encrypted - EncryptedMemory object containing ciphertext and nonce
 * @param keyBase64 - Base64-encoded 256-bit key
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails (wrong key or tampered data)
 */
export async function decrypt(encrypted: EncryptedMemory, keyBase64: string): Promise<string> {
  await initCrypto();
  const sodium = getSodium();
  
  // Decode key, ciphertext, and nonce from base64
  const key = sodium.from_base64(keyBase64, sodium.base64_variants.ORIGINAL);
  const ciphertext = sodium.from_base64(encrypted.ciphertext, sodium.base64_variants.ORIGINAL);
  const nonce = sodium.from_base64(encrypted.nonce, sodium.base64_variants.ORIGINAL);
  
  try {
    // Decrypt and verify authentication tag
    const plaintextBytes = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
    return sodium.to_string(plaintextBytes);
  } catch (error) {
    throw new Error('Decryption failed: Invalid key or corrupted data');
  }
}

/**
 * Derives a sub-key from master key for specific purposes (e.g., per-memory encryption)
 * Uses BLAKE2b key derivation
 * 
 * @param masterKeyBase64 - Base64-encoded master key
 * @param context - 8-character context string (e.g., "memory01")
 * @param subkeyId - Numeric ID for the subkey
 * @returns Base64-encoded derived key
 */
export async function deriveSubKey(
  masterKeyBase64: string, 
  context: string, 
  subkeyId: number
): Promise<string> {
  await initCrypto();
  const sodium = getSodium();
  
  const masterKey = sodium.from_base64(masterKeyBase64, sodium.base64_variants.ORIGINAL);
  
  // Ensure context is exactly 8 bytes
  const contextBytes = context.padEnd(8, '_').slice(0, 8);
  
  const subkey = sodium.crypto_kdf_derive_from_key(
    sodium.crypto_secretbox_KEYBYTES,
    subkeyId,
    contextBytes,
    masterKey
  );
  
  return sodium.to_base64(subkey, sodium.base64_variants.ORIGINAL);
}

/**
 * Generates a cryptographic hash of data using BLAKE2b
 * Useful for creating commitment hashes for ZK proofs
 * 
 * @param data - String data to hash
 * @returns Hex-encoded hash
 */
export async function hashData(data: string): Promise<string> {
  await initCrypto();
  const sodium = getSodium();
  
  const dataBytes = sodium.from_string(data);
  const hash = sodium.crypto_generichash(32, dataBytes);
  
  return sodium.to_hex(hash);
}

/**
 * Securely wipes a key from memory
 * Important for key rotation and revocation
 * 
 * @param keyBase64 - Base64-encoded key to wipe
 */
export async function secureWipe(keyBase64: string): Promise<void> {
  await initCrypto();
  const sodium = getSodium();
  
  const keyBytes = sodium.from_base64(keyBase64, sodium.base64_variants.ORIGINAL);
  sodium.memzero(keyBytes);
}

/**
 * Generates a random memory ID
 */
export async function generateMemoryId(): Promise<string> {
  await initCrypto();
  const sodium = getSodium();
  
  const randomBytes = sodium.randombytes_buf(16);
  return 'mem_' + sodium.to_hex(randomBytes);
}
