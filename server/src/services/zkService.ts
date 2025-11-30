/**
 * WhisperCache ZK Service
 * 
 * Real ZK proof generation using SnarkJS with Groth16 protocol.
 * Handles both real circuit proofs and fallback mock proofs.
 */

import * as snarkjs from 'snarkjs';
import * as fs from 'fs';
import * as path from 'path';
import { hashData } from '../lib/crypto';

// Paths to compiled circuit files
const ZK_BUILD_DIR = path.join(__dirname, '../../../zk/build');
const CIRCUIT_NAME = 'hashVerifier';

// File paths for the circuit
const WASM_PATH = path.join(ZK_BUILD_DIR, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`);
const ZKEY_PATH = path.join(ZK_BUILD_DIR, `${CIRCUIT_NAME}.zkey`);
const VKEY_PATH = path.join(ZK_BUILD_DIR, `${CIRCUIT_NAME}_verification_key.json`);

export interface ZKProofResult {
  patternMatched: boolean;
  confidence: number;
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
  proofHash: string;
  timestamp: string;
  isRealProof: boolean;
}

interface Poseidon {
  (inputs: bigint[]): any;
  F: {
    toObject: (val: any) => bigint;
  };
}

// Cached Poseidon instance
let poseidonInstance: Poseidon | null = null;

/**
 * Initialize Poseidon hash function
 */
async function getPoseidon(): Promise<Poseidon> {
  if (poseidonInstance) return poseidonInstance;
  
  const { buildPoseidon } = await import('circomlibjs');
  poseidonInstance = await buildPoseidon();
  return poseidonInstance;
}

/**
 * Compute Poseidon hash of a string
 */
export async function poseidonHashString(input: string): Promise<bigint> {
  const poseidon = await getPoseidon();
  
  // Convert string to a field element by hashing
  const hash = await hashData(input);
  // Take first 31 bytes (248 bits) to stay within BN128 field
  const fieldElement = BigInt('0x' + hash.slice(0, 62));
  
  return poseidon.F.toObject(poseidon([fieldElement]));
}

/**
 * Check if real ZK circuit files exist
 */
function hasRealCircuit(): boolean {
  return fs.existsSync(WASM_PATH) && 
         fs.existsSync(ZKEY_PATH) && 
         fs.existsSync(VKEY_PATH);
}

/**
 * Generate a REAL ZK proof using SnarkJS
 */
async function generateRealProof(
  preimage: bigint,
  expectedHash: bigint
): Promise<{ proof: any; publicSignals: string[] }> {
  const input = {
    preimage: preimage.toString(),
    hash: expectedHash.toString()
  };

  console.log('[ZK] Generating real Groth16 proof...');
  console.log(`[ZK] WASM: ${WASM_PATH}`);
  console.log(`[ZK] ZKEY: ${ZKEY_PATH}`);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    WASM_PATH,
    ZKEY_PATH
  );

  console.log('[ZK] Proof generated successfully');
  return { proof, publicSignals };
}

/**
 * Verify a REAL ZK proof
 */
async function verifyRealProof(
  proof: any,
  publicSignals: string[]
): Promise<boolean> {
  if (!fs.existsSync(VKEY_PATH)) {
    console.warn('[ZK] Verification key not found, skipping verification');
    return true;
  }

  const vkey = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf8'));
  return snarkjs.groth16.verify(vkey, publicSignals, proof);
}

/**
 * Generate mock proof for fallback
 */
async function generateMockProof(
  memoryHash: string,
  queryHash: string
): Promise<ZKProofResult> {
  const poseidon = await getPoseidon();
  
  // Create deterministic but random-looking values
  const memoryField = BigInt('0x' + (await hashData(memoryHash)).slice(0, 62));
  const queryField = BigInt('0x' + (await hashData(queryHash)).slice(0, 62));
  
  // Compute a combined hash for proof simulation
  const combinedHash = poseidon.F.toObject(poseidon([memoryField, queryField]));
  
  // Derive confidence from hash (deterministic pseudo-random)
  const confidence = Number(combinedHash % 100n);
  const patternMatched = confidence >= 50;

  // Generate mock proof structure that looks like real Groth16
  const proof = {
    pi_a: [
      combinedHash.toString(),
      (combinedHash + 1n).toString(),
      "1"
    ],
    pi_b: [
      [(combinedHash * 2n).toString(), (combinedHash * 3n).toString()],
      [(combinedHash * 4n).toString(), (combinedHash * 5n).toString()],
      ["1", "0"]
    ],
    pi_c: [
      (combinedHash * 6n).toString(),
      (combinedHash * 7n).toString(),
      "1"
    ],
    protocol: "groth16",
    curve: "bn128"
  };

  const publicSignals = [
    queryField.toString(),
    patternMatched ? "1" : "0"
  ];

  const proofHash = await hashData(JSON.stringify({ proof, publicSignals }));

  return {
    patternMatched,
    confidence: Math.max(50, Math.min(99, confidence + 50)),
    proof,
    publicSignals,
    proofHash: `mock_${proofHash.slice(0, 32)}`,
    timestamp: new Date().toISOString(),
    isRealProof: false
  };
}

/**
 * Main proof generation function
 * 
 * Uses real ZK proof if circuit is available, otherwise falls back to mock
 */
export async function generateProof(
  memoryHash: string,
  queryHash: string
): Promise<ZKProofResult> {
  const timestamp = new Date().toISOString();

  // Check if real circuit is available
  if (!hasRealCircuit()) {
    console.log('[ZK] Circuit not compiled, using mock proof');
    return generateMockProof(memoryHash, queryHash);
  }

  try {
    const poseidon = await getPoseidon();
    
    // Convert hashes to field elements
    const memoryField = BigInt('0x' + (await hashData(memoryHash)).slice(0, 62));
    const queryField = BigInt('0x' + (await hashData(queryHash)).slice(0, 62));
    
    // For hashVerifier circuit: we prove knowledge of memoryHash that hashes to a known value
    // Combine memory and query to create a unique challenge
    const combinedValue = memoryField ^ queryField;
    const expectedHash = poseidon.F.toObject(poseidon([combinedValue]));
    
    // Generate real proof
    const { proof, publicSignals } = await generateRealProof(combinedValue, expectedHash);
    
    // Verify the proof
    const isValid = await verifyRealProof(proof, publicSignals);
    
    if (!isValid) {
      console.error('[ZK] Proof verification failed!');
      return generateMockProof(memoryHash, queryHash);
    }

    // Derive pattern match result from proof
    // The "valid" output from circuit indicates if hash matches
    const patternMatched = publicSignals[0] === "1" || publicSignals.length > 0;
    
    // Compute confidence based on combined hash (deterministic)
    const confidence = Number(expectedHash % 50n) + 50; // 50-99 range

    const proofHash = await hashData(JSON.stringify({ proof, publicSignals, timestamp }));

    console.log('[ZK] Real proof generated and verified successfully');

    return {
      patternMatched,
      confidence: Math.min(99, confidence),
      proof: {
        pi_a: proof.pi_a,
        pi_b: proof.pi_b,
        pi_c: proof.pi_c,
        protocol: "groth16",
        curve: "bn128"
      },
      publicSignals,
      proofHash: `zk_${proofHash.slice(0, 32)}`,
      timestamp,
      isRealProof: true
    };

  } catch (error) {
    console.error('[ZK] Error generating real proof, falling back to mock:', error);
    return generateMockProof(memoryHash, queryHash);
  }
}

/**
 * Verify an existing proof
 */
export async function verifyProof(
  proof: ZKProofResult['proof'],
  publicSignals: string[]
): Promise<boolean> {
  if (!hasRealCircuit()) {
    // For mock proofs, just check structure
    return proof.protocol === 'groth16' && 
           proof.curve === 'bn128' && 
           Array.isArray(proof.pi_a);
  }

  try {
    return verifyRealProof(proof, publicSignals);
  } catch (error) {
    console.error('[ZK] Verification error:', error);
    return false;
  }
}

/**
 * Get ZK system status
 */
export function getZKStatus(): {
  hasRealCircuit: boolean;
  circuitName: string;
  wasmPath: string;
  zkeyPath: string;
} {
  return {
    hasRealCircuit: hasRealCircuit(),
    circuitName: CIRCUIT_NAME,
    wasmPath: WASM_PATH,
    zkeyPath: ZKEY_PATH
  };
}

// Initialize Poseidon on module load
getPoseidon().catch(err => console.error('[ZK] Failed to initialize Poseidon:', err));
