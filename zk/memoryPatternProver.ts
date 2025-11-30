/**
 * WhisperCache Memory Pattern Prover
 * 
 * Provides real ZK proof generation and verification for memory pattern policies.
 * Uses SnarkJS with Groth16 protocol and Poseidon hashing.
 * 
 * The circuit enforces:
 *   - If isPersonal == 1, then allowedForAgent = 0 (blocked)
 *   - Otherwise, allowedForAgent = 1 (allowed)
 */

// @ts-ignore - snarkjs types may not be available
import * as snarkjs from 'snarkjs';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface PatternFlags {
  isFinance: boolean;
  isHealth: boolean;
  isPersonal: boolean;
}

export interface ProveInput {
  memoryCommitment: string;  // Poseidon hash as string (public)
  pattern: PatternFlags;
}

export interface ZKProofOutput {
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
  allowedForAgent: boolean;
  commitment: string;
  isRealProof: boolean;
}

interface VerifyResult {
  valid: boolean;
  allowedForAgent: boolean;
  commitment: string;
}

// ============================================================================
// Paths to circuit artifacts
// ============================================================================

const ARTIFACTS_DIR = path.join(__dirname, '../../zk/artifacts/memory_pattern');
const WASM_PATH = path.join(ARTIFACTS_DIR, 'memory_pattern_js', 'memory_pattern.wasm');
const ZKEY_PATH = path.join(ARTIFACTS_DIR, 'memory_pattern.zkey');
const VKEY_PATH = path.join(ARTIFACTS_DIR, 'memory_pattern_verification_key.json');

// ============================================================================
// Poseidon hash function (cached)
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
 * Compute Poseidon hash for a commitment
 */
export async function computeCommitment(memoryContent: bigint, salt: bigint): Promise<bigint> {
  const poseidon = await getPoseidon();
  return poseidon.F.toObject(poseidon([memoryContent, salt]));
}

/**
 * Convert a string to a field element (for use as memoryContent)
 */
export function stringToFieldElement(str: string): bigint {
  const hash = createHash('sha256').update(str).digest('hex');
  // Take first 31 bytes (248 bits) to stay within BN128 field
  return BigInt('0x' + hash.slice(0, 62));
}

// ============================================================================
// Circuit availability check
// ============================================================================

export function hasRealCircuit(): boolean {
  return fs.existsSync(WASM_PATH) && 
         fs.existsSync(ZKEY_PATH) && 
         fs.existsSync(VKEY_PATH);
}

export function getArtifactPaths(): { wasm: string; zkey: string; vkey: string } {
  return {
    wasm: WASM_PATH,
    zkey: ZKEY_PATH,
    vkey: VKEY_PATH
  };
}

// ============================================================================
// Mock proof generation (fallback when circuit not available)
// ============================================================================

function generateMockProof(input: ProveInput): ZKProofOutput {
  const { memoryCommitment, pattern } = input;
  
  // Apply the same policy logic as the real circuit
  const allowedForAgent = !pattern.isPersonal;
  
  // Generate deterministic mock proof values
  const commitmentHash = createHash('sha256').update(memoryCommitment).digest('hex');
  
  const mockProof = {
    pi_a: [
      BigInt('0x' + commitmentHash.slice(0, 16)).toString(),
      BigInt('0x' + commitmentHash.slice(16, 32)).toString(),
      "1"
    ],
    pi_b: [
      [
        BigInt('0x' + commitmentHash.slice(32, 48)).toString(),
        BigInt('0x' + commitmentHash.slice(48, 64)).toString()
      ],
      [
        BigInt('0x' + commitmentHash.slice(0, 16)).toString(),
        BigInt('0x' + commitmentHash.slice(16, 32)).toString()
      ],
      ["1", "0"]
    ],
    pi_c: [
      BigInt('0x' + commitmentHash.slice(32, 48)).toString(),
      BigInt('0x' + commitmentHash.slice(48, 64)).toString(),
      "1"
    ],
    protocol: "groth16",
    curve: "bn128"
  };

  const publicSignals = [
    allowedForAgent ? "1" : "0",  // allowedForAgent
    memoryCommitment,              // commitment output
    memoryCommitment,              // memoryCommitment input
    pattern.isFinance ? "1" : "0",
    pattern.isHealth ? "1" : "0",
    pattern.isPersonal ? "1" : "0"
  ];

  const proofHash = 'zk_mock_' + commitmentHash.slice(0, 16);

  return {
    patternMatched: allowedForAgent,
    confidence: 0.95,  // Mock confidence
    proof: mockProof,
    publicSignals,
    proofHash,
    timestamp: new Date().toISOString(),
    allowedForAgent,
    commitment: memoryCommitment,
    isRealProof: false
  };
}

// ============================================================================
// Real proof generation
// ============================================================================

/**
 * Generate a real ZK proof for the memory pattern policy.
 * 
 * @param input - The proof input containing memoryCommitment and pattern flags
 * @param memoryContent - The actual memory content (private, used to compute witness)
 * @param salt - Random salt for commitment (private)
 * @returns ZKProofOutput with proof data
 */
export async function generateProof(
  input: ProveInput,
  memoryContent?: bigint,
  salt?: bigint
): Promise<ZKProofOutput> {
  const { memoryCommitment, pattern } = input;

  // If circuit not available, use mock
  if (!hasRealCircuit()) {
    console.log('[MemoryPatternProver] Circuit not found, using mock proof');
    return generateMockProof(input);
  }

  try {
    // If memoryContent/salt not provided, generate deterministic values
    // In production, these would come from the actual encrypted memory
    if (!memoryContent || !salt) {
      memoryContent = stringToFieldElement(memoryCommitment);
      salt = BigInt('0x' + createHash('sha256').update(memoryCommitment + 'salt').digest('hex').slice(0, 62));
    }

    // Compute the actual commitment using Poseidon
    const poseidon = await getPoseidon();
    const computedCommitment = poseidon.F.toObject(poseidon([memoryContent, salt]));

    // Build witness input
    const witnessInput = {
      memoryContent: memoryContent.toString(),
      salt: salt.toString(),
      memoryCommitment: computedCommitment.toString(),
      isFinance: pattern.isFinance ? "1" : "0",
      isHealth: pattern.isHealth ? "1" : "0",
      isPersonal: pattern.isPersonal ? "1" : "0"
    };

    console.log('[MemoryPatternProver] Generating real Groth16 proof...');
    const startTime = Date.now();

    // Generate proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      witnessInput,
      WASM_PATH,
      ZKEY_PATH
    );

    const proofTime = Date.now() - startTime;
    console.log(`[MemoryPatternProver] Proof generated in ${proofTime}ms`);

    // Extract results from public signals
    // Order: allowedForAgent, commitment, memoryCommitment, isFinance, isHealth, isPersonal
    const allowedForAgent = publicSignals[0] === '1';
    const commitment = publicSignals[1];

    // Compute proof hash
    const proofHash = 'zk_' + createHash('sha256')
      .update(JSON.stringify(proof))
      .digest('hex')
      .slice(0, 32);

    return {
      patternMatched: allowedForAgent,
      confidence: 0.99,  // Real proof has high confidence
      proof: {
        pi_a: proof.pi_a,
        pi_b: proof.pi_b,
        pi_c: proof.pi_c,
        protocol: proof.protocol || 'groth16',
        curve: proof.curve || 'bn128'
      },
      publicSignals,
      proofHash,
      timestamp: new Date().toISOString(),
      allowedForAgent,
      commitment,
      isRealProof: true
    };
  } catch (error) {
    console.error('[MemoryPatternProver] Proof generation failed:', error);
    console.log('[MemoryPatternProver] Falling back to mock proof');
    return generateMockProof(input);
  }
}

// ============================================================================
// Proof verification
// ============================================================================

/**
 * Verify a ZK proof
 */
export async function verifyProof(
  proof: ZKProofOutput['proof'],
  publicSignals: string[]
): Promise<VerifyResult> {
  if (!hasRealCircuit()) {
    // Mock verification - check proof structure
    const valid = proof.protocol === 'groth16' && 
                  proof.curve === 'bn128' &&
                  Array.isArray(proof.pi_a);
    
    return {
      valid,
      allowedForAgent: publicSignals[0] === '1',
      commitment: publicSignals[1] || ''
    };
  }

  try {
    const vkey = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf8'));
    const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);

    return {
      valid,
      allowedForAgent: publicSignals[0] === '1',
      commitment: publicSignals[1] || ''
    };
  } catch (error) {
    console.error('[MemoryPatternProver] Verification error:', error);
    return {
      valid: false,
      allowedForAgent: false,
      commitment: ''
    };
  }
}

// ============================================================================
// Status helper
// ============================================================================

export function getProverStatus(): {
  hasRealCircuit: boolean;
  artifactsDir: string;
  paths: { wasm: string; zkey: string; vkey: string };
  mode: 'production' | 'mock';
} {
  return {
    hasRealCircuit: hasRealCircuit(),
    artifactsDir: ARTIFACTS_DIR,
    paths: getArtifactPaths(),
    mode: hasRealCircuit() ? 'production' : 'mock'
  };
}

// Initialize Poseidon on module load
getPoseidon().catch(err => console.error('[MemoryPatternProver] Failed to init Poseidon:', err));
