/**
 * WhisperCache Server-Side Cryptography Module
 * 
 * Server-side encryption utilities using libsodium.
 * Note: In a true ZK system, most encryption happens client-side.
 * Server mainly verifies proofs and manages encrypted blobs.
 */

import _sodium from 'libsodium-wrappers';

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
 * Verifies a content hash matches expected format
 */
export async function verifyHashFormat(hash: string): Promise<boolean> {
  await initCrypto();
  
  // Hash should be 64 hex characters (32 bytes)
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Generates a cryptographic hash for data
 */
export async function hashData(data: string): Promise<string> {
  await initCrypto();
  const sodium = getSodium();
  
  const dataBytes = sodium.from_string(data);
  const hash = sodium.crypto_generichash(32, dataBytes);
  
  return sodium.to_hex(hash);
}

/**
 * Generates a random proof ID
 */
export async function generateProofId(): Promise<string> {
  await initCrypto();
  const sodium = getSodium();
  
  const randomBytes = sodium.randombytes_buf(16);
  return 'proof_' + sodium.to_hex(randomBytes);
}

/**
 * Generates a secure random nonce for transactions
 */
export async function generateNonce(): Promise<string> {
  await initCrypto();
  const sodium = getSodium();
  
  const nonce = sodium.randombytes_buf(24);
  return sodium.to_hex(nonce);
}

/**
 * Creates a commitment hash from multiple inputs
 * Used for ZK proof commitments
 */
export async function createCommitment(...inputs: string[]): Promise<string> {
  await initCrypto();
  const sodium = getSodium();
  
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
  return commitment === expected;
}
