/**
 * WhisperCache Server-Side Cryptography Module
 * 
 * Server-side encryption utilities using libsodium.
 * Note: In a true ZK system, most encryption happens client-side.
 * Server mainly verifies proofs and manages encrypted blobs.
 */

import _sodium from 'libsodium-wrappers';

// Use lazy initialization with cached sodium instance
let sodiumInstance: typeof _sodium | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize libsodium once and cache the instance
 */
export async function initCrypto(): Promise<void> {
  if (sodiumInstance) return;
  
  // Prevent race conditions with promise caching
  if (initializationPromise) {
    await initializationPromise;
    return;
  }
  
  initializationPromise = (async () => {
    await _sodium.ready;
    sodiumInstance = _sodium;
  })();
  
  await initializationPromise;
}

/**
 * Get cached sodium instance (throws if not initialized)
 */
export function getSodium(): typeof _sodium {
  if (!sodiumInstance) {
    throw new Error('Crypto not initialized. Call initCrypto() first.');
  }
  return sodiumInstance;
}

/**
 * Synchronously check if crypto is ready (for hot paths)
 */
export function isCryptoReady(): boolean {
  return sodiumInstance !== null;
}

// Pre-compiled regex for hash validation (created once)
const HASH_REGEX = /^[a-f0-9]{64}$/i;

/**
 * Verifies a content hash matches expected format (optimized - no crypto needed for regex)
 */
export function verifyHashFormat(hash: string): boolean {
  // Hash should be 64 hex characters (32 bytes) - pure regex, no crypto init needed
  return HASH_REGEX.test(hash);
}

/**
 * Generates a cryptographic hash for data (optimized)
 */
export async function hashData(data: string): Promise<string> {
  const sodium = getSodium();
  const dataBytes = sodium.from_string(data);
  const hash = sodium.crypto_generichash(32, dataBytes);
  return sodium.to_hex(hash);
}

/**
 * Generates a random proof ID (using crypto.randomBytes for speed)
 */
export async function generateProofId(): Promise<string> {
  const sodium = getSodium();
  const randomBytes = sodium.randombytes_buf(16);
  return 'proof_' + sodium.to_hex(randomBytes);
}

/**
 * Generates a secure random nonce for transactions
 */
export async function generateNonce(): Promise<string> {
  const sodium = getSodium();
  const nonce = sodium.randombytes_buf(24);
  return sodium.to_hex(nonce);
}

/**
 * Creates a commitment hash from multiple inputs (optimized with single hash call)
 */
export async function createCommitment(...inputs: string[]): Promise<string> {
  const sodium = getSodium();
  // Join with separator to prevent hash collisions
  const combined = inputs.join('|');
  const bytes = sodium.from_string(combined);
  const hash = sodium.crypto_generichash(32, bytes);
  return sodium.to_hex(hash);
}

/**
 * Verifies that a commitment matches expected inputs
 */
export async function verifyCommitment(
  commitment: string, 
  ...inputs: string[]
): Promise<boolean> {
  const expected = await createCommitment(...inputs);
  // Use timing-safe comparison
  const sodium = getSodium();
  const commitmentBytes = sodium.from_hex(commitment);
  const expectedBytes = sodium.from_hex(expected);
  return sodium.memcmp(commitmentBytes, expectedBytes);
}
