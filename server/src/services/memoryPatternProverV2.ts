/**
 * WhisperCache Memory Pattern Prover V2
 * 
 * Enhanced ZK proof generation and verification with:
 *   - Memory status validation (DELETED=0, ACTIVE=1, REVOKED=2)
 *   - Key version range validation
 *   - Privacy pattern enforcement
 * 
 * The circuit enforces:
 *   - allowedForAgent = isActive AND keyVersionValid AND NOT isPersonal
 */

import * as snarkjs from 'snarkjs';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export enum MemoryStatus {
  DELETED = 0,
  ACTIVE = 1,
  REVOKED = 2
}

export interface PatternFlags {
  isFinance: boolean;
  isHealth: boolean;
  isPersonal: boolean;
}

export interface ProveInputV2 {
  // Public inputs
  memoryCommitment: string;
  pattern: PatternFlags;
  currentKeyVersion: number;
  minKeyVersion: number;
  
  // Private inputs (provided by system)
  memoryStatus: MemoryStatus;
  keyVersion: number;
}

export interface ZKProofOutputV2 {
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
  
  // V2 output signals
  allowedForAgent: boolean;
  commitment: string;
  statusValid: boolean;
  keyVersionValid: boolean;
  
  // Metadata
  isRealProof: boolean;
  circuitVersion: number;
}

interface VerifyResultV2 {
  valid: boolean;
  allowedForAgent: boolean;
  commitment: string;
  statusValid: boolean;
  keyVersionValid: boolean;
}

// ============================================================================
// Paths to circuit artifacts (v2)
// ============================================================================

const ARTIFACTS_DIR_V2 = path.join(__dirname, '../../../zk/artifacts/memory_pattern_v2');
const WASM_PATH_V2 = path.join(ARTIFACTS_DIR_V2, 'memory_pattern_v2_js', 'memory_pattern_v2.wasm');
const ZKEY_PATH_V2 = path.join(ARTIFACTS_DIR_V2, 'memory_pattern_v2.zkey');
const VKEY_PATH_V2 = path.join(ARTIFACTS_DIR_V2, 'memory_pattern_v2_verification_key.json');
const SCHEMA_PATH_V2 = path.join(ARTIFACTS_DIR_V2, 'circuit_schema.json');

// Fallback to v1 if v2 not available
const ARTIFACTS_DIR_V1 = path.join(__dirname, '../../../zk/artifacts/memory_pattern');
const WASM_PATH_V1 = path.join(ARTIFACTS_DIR_V1, 'memory_pattern_js', 'memory_pattern.wasm');
const ZKEY_PATH_V1 = path.join(ARTIFACTS_DIR_V1, 'memory_pattern.zkey');
const VKEY_PATH_V1 = path.join(ARTIFACTS_DIR_V1, 'memory_pattern_verification_key.json');

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

export interface CircuitAvailability {
  hasV2Circuit: boolean;
  hasV1Circuit: boolean;
  activeVersion: number;
  mode: 'production-v2' | 'production-v1' | 'mock';
  artifactsDir: string;
}

export function checkCircuitAvailability(): CircuitAvailability {
  const hasV2 = fs.existsSync(WASM_PATH_V2) && 
                fs.existsSync(ZKEY_PATH_V2) && 
                fs.existsSync(VKEY_PATH_V2);
  
  const hasV1 = fs.existsSync(WASM_PATH_V1) && 
                fs.existsSync(ZKEY_PATH_V1) && 
                fs.existsSync(VKEY_PATH_V1);

  if (hasV2) {
    return {
      hasV2Circuit: true,
      hasV1Circuit: hasV1,
      activeVersion: 2,
      mode: 'production-v2',
      artifactsDir: ARTIFACTS_DIR_V2
    };
  } else if (hasV1) {
    return {
      hasV2Circuit: false,
      hasV1Circuit: true,
      activeVersion: 1,
      mode: 'production-v1',
      artifactsDir: ARTIFACTS_DIR_V1
    };
  } else {
    return {
      hasV2Circuit: false,
      hasV1Circuit: false,
      activeVersion: 2, // Mock uses v2 logic
      mode: 'mock',
      artifactsDir: ARTIFACTS_DIR_V2
    };
  }
}

export function hasRealCircuit(): boolean {
  const availability = checkCircuitAvailability();
  return availability.mode !== 'mock';
}

export function getCircuitVersion(): number {
  return checkCircuitAvailability().activeVersion;
}

// ============================================================================
// Mock proof generation (fallback when circuit not available)
// ============================================================================

function generateMockProofV2(input: ProveInputV2): ZKProofOutputV2 {
  const { memoryCommitment, pattern, currentKeyVersion, minKeyVersion, memoryStatus, keyVersion } = input;
  
  // Apply the same policy logic as the real circuit
  const isActive = memoryStatus === MemoryStatus.ACTIVE;
  const keyVersionAboveMin = keyVersion >= minKeyVersion;
  const keyVersionBelowMax = keyVersion <= currentKeyVersion;
  const keyVersionValid = keyVersionAboveMin && keyVersionBelowMax;
  const statusValid = isActive;
  const notPersonal = !pattern.isPersonal;
  
  const allowedForAgent = statusValid && keyVersionValid && notPersonal;
  
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

  // Public signals for V2: [allowedForAgent, commitment, statusValid, keyVersionValid, 
  //                         memoryCommitment, isFinance, isHealth, isPersonal, currentKeyVersion, minKeyVersion]
  const publicSignals = [
    allowedForAgent ? "1" : "0",
    memoryCommitment,
    statusValid ? "1" : "0",
    keyVersionValid ? "1" : "0",
    memoryCommitment,
    pattern.isFinance ? "1" : "0",
    pattern.isHealth ? "1" : "0",
    pattern.isPersonal ? "1" : "0",
    currentKeyVersion.toString(),
    minKeyVersion.toString()
  ];

  const proofHash = 'zk_mock_v2_' + commitmentHash.slice(0, 16);

  return {
    patternMatched: allowedForAgent,
    confidence: 0.95,
    proof: mockProof,
    publicSignals,
    proofHash,
    timestamp: new Date().toISOString(),
    allowedForAgent,
    commitment: memoryCommitment,
    statusValid,
    keyVersionValid,
    isRealProof: false,
    circuitVersion: 2
  };
}

// ============================================================================
// Real proof generation (V2)
// ============================================================================

/**
 * Generate a ZK proof for the memory pattern policy (V2).
 * 
 * @param input - The proof input with status and key version
 * @param memoryContent - The actual memory content (private)
 * @param salt - Random salt for commitment (private)
 * @returns ZKProofOutputV2 with proof data
 */
export async function generateProofV2(
  input: ProveInputV2,
  memoryContent?: bigint,
  salt?: bigint
): Promise<ZKProofOutputV2> {
  const { 
    memoryCommitment, 
    pattern, 
    currentKeyVersion, 
    minKeyVersion, 
    memoryStatus, 
    keyVersion 
  } = input;

  const availability = checkCircuitAvailability();

  // If no circuit available, use mock
  if (availability.mode === 'mock') {
    console.log('[MemoryPatternProverV2] Circuit not found, using mock proof');
    return generateMockProofV2(input);
  }

  // If only V1 available, fall back to V1 with limited validation
  if (availability.mode === 'production-v1') {
    console.log('[MemoryPatternProverV2] V2 circuit not found, falling back to V1');
    return generateProofWithV1Fallback(input, memoryContent, salt);
  }

  try {
    // Generate deterministic values if not provided
    if (!memoryContent || !salt) {
      memoryContent = stringToFieldElement(memoryCommitment);
      salt = BigInt('0x' + createHash('sha256').update(memoryCommitment + 'salt').digest('hex').slice(0, 62));
    }

    // Compute the actual commitment using Poseidon
    const poseidon = await getPoseidon();
    const computedCommitment = poseidon.F.toObject(poseidon([memoryContent, salt]));

    // Build witness input for V2 circuit
    const witnessInput = {
      // Private inputs
      memoryContent: memoryContent.toString(),
      salt: salt.toString(),
      memoryStatus: memoryStatus.toString(),
      keyVersion: keyVersion.toString(),
      // Public inputs
      memoryCommitment: computedCommitment.toString(),
      isFinance: pattern.isFinance ? "1" : "0",
      isHealth: pattern.isHealth ? "1" : "0",
      isPersonal: pattern.isPersonal ? "1" : "0",
      currentKeyVersion: currentKeyVersion.toString(),
      minKeyVersion: minKeyVersion.toString()
    };

    console.log('[MemoryPatternProverV2] Generating real Groth16 proof (V2)...');
    const startTime = Date.now();

    // Generate proof with V2 circuit
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      witnessInput,
      WASM_PATH_V2,
      ZKEY_PATH_V2
    );

    const proofTime = Date.now() - startTime;
    console.log(`[MemoryPatternProverV2] Proof generated in ${proofTime}ms`);

    // Extract results from public signals
    // Order: allowedForAgent, commitment, statusValid, keyVersionValid, 
    //        memoryCommitment, isFinance, isHealth, isPersonal, currentKeyVersion, minKeyVersion
    const allowedForAgent = publicSignals[0] === '1';
    const commitment = publicSignals[1];
    const statusValid = publicSignals[2] === '1';
    const keyVersionValid = publicSignals[3] === '1';

    // Compute proof hash
    const proofHash = 'zk_v2_' + createHash('sha256')
      .update(JSON.stringify(proof))
      .digest('hex')
      .slice(0, 32);

    return {
      patternMatched: allowedForAgent,
      confidence: 0.99,
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
      statusValid,
      keyVersionValid,
      isRealProof: true,
      circuitVersion: 2
    };
  } catch (error) {
    console.error('[MemoryPatternProverV2] Proof generation failed:', error);
    console.log('[MemoryPatternProverV2] Falling back to mock proof');
    return generateMockProofV2(input);
  }
}

/**
 * Fallback to V1 circuit with limited validation
 */
async function generateProofWithV1Fallback(
  input: ProveInputV2,
  memoryContent?: bigint,
  salt?: bigint
): Promise<ZKProofOutputV2> {
  const { memoryCommitment, pattern, memoryStatus, keyVersion, currentKeyVersion, minKeyVersion } = input;

  // Apply V2 validations manually since V1 doesn't have them
  const statusValid = memoryStatus === MemoryStatus.ACTIVE;
  const keyVersionValid = keyVersion >= minKeyVersion && keyVersion <= currentKeyVersion;

  // If V2 validations fail, return blocked result without calling V1
  if (!statusValid || !keyVersionValid) {
    const mockResult = generateMockProofV2(input);
    mockResult.isRealProof = false;
    return mockResult;
  }

  try {
    if (!memoryContent || !salt) {
      memoryContent = stringToFieldElement(memoryCommitment);
      salt = BigInt('0x' + createHash('sha256').update(memoryCommitment + 'salt').digest('hex').slice(0, 62));
    }

    const poseidon = await getPoseidon();
    const computedCommitment = poseidon.F.toObject(poseidon([memoryContent, salt]));

    const witnessInput = {
      memoryContent: memoryContent.toString(),
      salt: salt.toString(),
      memoryCommitment: computedCommitment.toString(),
      isFinance: pattern.isFinance ? "1" : "0",
      isHealth: pattern.isHealth ? "1" : "0",
      isPersonal: pattern.isPersonal ? "1" : "0"
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      witnessInput,
      WASM_PATH_V1,
      ZKEY_PATH_V1
    );

    const allowedForAgent = publicSignals[0] === '1';
    const commitment = publicSignals[1];

    const proofHash = 'zk_v1_' + createHash('sha256')
      .update(JSON.stringify(proof))
      .digest('hex')
      .slice(0, 32);

    // Construct V2-compatible output
    const v2PublicSignals = [
      allowedForAgent ? "1" : "0",
      commitment,
      statusValid ? "1" : "0",
      keyVersionValid ? "1" : "0",
      memoryCommitment,
      pattern.isFinance ? "1" : "0",
      pattern.isHealth ? "1" : "0",
      pattern.isPersonal ? "1" : "0",
      currentKeyVersion.toString(),
      minKeyVersion.toString()
    ];

    return {
      patternMatched: allowedForAgent && statusValid && keyVersionValid,
      confidence: 0.98,
      proof: {
        pi_a: proof.pi_a,
        pi_b: proof.pi_b,
        pi_c: proof.pi_c,
        protocol: proof.protocol || 'groth16',
        curve: proof.curve || 'bn128'
      },
      publicSignals: v2PublicSignals,
      proofHash,
      timestamp: new Date().toISOString(),
      allowedForAgent: allowedForAgent && statusValid && keyVersionValid,
      commitment,
      statusValid,
      keyVersionValid,
      isRealProof: true,
      circuitVersion: 1
    };
  } catch (error) {
    console.error('[MemoryPatternProverV2] V1 fallback failed:', error);
    return generateMockProofV2(input);
  }
}

// ============================================================================
// Proof verification (V2)
// ============================================================================

/**
 * Verify a ZK proof (V2)
 */
export async function verifyProofV2(
  proof: ZKProofOutputV2['proof'],
  publicSignals: string[],
  circuitVersion: number = 2
): Promise<VerifyResultV2> {
  const availability = checkCircuitAvailability();

  if (availability.mode === 'mock') {
    // Mock verification - check proof structure
    const valid = proof.protocol === 'groth16' && 
                  proof.curve === 'bn128' &&
                  Array.isArray(proof.pi_a);
    
    return {
      valid,
      allowedForAgent: publicSignals[0] === '1',
      commitment: publicSignals[1] || '',
      statusValid: publicSignals[2] === '1',
      keyVersionValid: publicSignals[3] === '1'
    };
  }

  try {
    const vkeyPath = circuitVersion === 2 ? VKEY_PATH_V2 : VKEY_PATH_V1;
    const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
    const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);

    return {
      valid,
      allowedForAgent: publicSignals[0] === '1',
      commitment: publicSignals[1] || '',
      statusValid: publicSignals[2] === '1',
      keyVersionValid: publicSignals[3] === '1'
    };
  } catch (error) {
    console.error('[MemoryPatternProverV2] Verification error:', error);
    return {
      valid: false,
      allowedForAgent: false,
      commitment: '',
      statusValid: false,
      keyVersionValid: false
    };
  }
}

// ============================================================================
// Status helper
// ============================================================================

export function getProverStatusV2(): {
  availability: CircuitAvailability;
  paths: {
    v2: { wasm: string; zkey: string; vkey: string };
    v1: { wasm: string; zkey: string; vkey: string };
  };
  features: {
    statusValidation: boolean;
    keyVersionValidation: boolean;
    patternEnforcement: boolean;
  };
} {
  const availability = checkCircuitAvailability();
  
  return {
    availability,
    paths: {
      v2: { wasm: WASM_PATH_V2, zkey: ZKEY_PATH_V2, vkey: VKEY_PATH_V2 },
      v1: { wasm: WASM_PATH_V1, zkey: ZKEY_PATH_V1, vkey: VKEY_PATH_V1 }
    },
    features: {
      statusValidation: availability.activeVersion >= 2 || availability.mode === 'mock',
      keyVersionValidation: availability.activeVersion >= 2 || availability.mode === 'mock',
      patternEnforcement: true
    }
  };
}

// ============================================================================
// Backward compatibility exports
// ============================================================================

// V1-compatible types (aliased from V2)
export interface ProveInput {
  memoryCommitment: string;
  pattern: PatternFlags;
}

export interface ZKProofOutput extends ZKProofOutputV2 {}

/**
 * @deprecated Use generateProofV2 instead
 */
export async function generateProof(
  input: ProveInput,
  memoryContent?: bigint,
  salt?: bigint
): Promise<ZKProofOutput> {
  // Convert V1 input to V2 with default values
  const v2Input: ProveInputV2 = {
    ...input,
    currentKeyVersion: 1,
    minKeyVersion: 1,
    memoryStatus: MemoryStatus.ACTIVE,
    keyVersion: 1
  };
  
  return generateProofV2(v2Input, memoryContent, salt);
}

/**
 * @deprecated Use verifyProofV2 instead
 */
export async function verifyProof(
  proof: ZKProofOutput['proof'],
  publicSignals: string[]
): Promise<{ valid: boolean; allowedForAgent: boolean; commitment: string }> {
  const result = await verifyProofV2(proof, publicSignals);
  return {
    valid: result.valid,
    allowedForAgent: result.allowedForAgent,
    commitment: result.commitment
  };
}

// Initialize Poseidon on module load
getPoseidon().catch(err => console.error('[MemoryPatternProverV2] Failed to init Poseidon:', err));
