/**
 * WhisperCache ZK Prover Interface
 * 
 * Defines the contract for ZK proof generation and verification.
 * Supports multiple proving backends:
 * - SnarkJS (current implementation)
 * - Rapid provers (future)
 * - Hardware accelerated provers
 */

/**
 * Request to generate a ZK proof
 */
export interface ZKProofRequest {
  /** The memory commitment to prove against */
  memoryCommitment: string;
  
  /** Pattern to match (can be various formats) */
  pattern: string | Record<string, boolean>;
  
  /** Optional user identifier for audit */
  userId?: string;
  
  /** Proof type: 'pattern_match', 'range', 'membership' */
  proofType?: 'pattern_match' | 'range' | 'membership';
  
  /** Additional proof parameters */
  params?: Record<string, unknown>;
}

/**
 * Result of ZK proof generation
 */
export interface ZKProofResult {
  /** Whether proof generation succeeded */
  success: boolean;
  
  /** The generated proof (serialized) */
  proof?: string;
  
  /** Public signals from the proof */
  publicSignals?: string[];
  
  /** Hash of the proof for reference */
  proofHash?: string;
  
  /** Whether the pattern matched */
  patternMatched: boolean;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Whether this is a real ZK proof vs simulation */
  isRealProof: boolean;
  
  /** Generation time in ms */
  generationTimeMs: number;
  
  /** Error message if failed */
  error?: string;
  
  /** Circuit used */
  circuit?: string;
  
  /** Proof metadata */
  metadata?: {
    circuitSize: number;
    constraintCount: number;
    witnessSize: number;
  };
}

/**
 * Result of ZK proof verification
 */
export interface ZKVerificationResult {
  /** Whether verification succeeded */
  valid: boolean;
  
  /** Verification time in ms */
  verificationTimeMs: number;
  
  /** Public signals verified */
  publicSignals?: string[];
  
  /** Error message if failed */
  error?: string;
}

/**
 * ZK Prover interface
 * 
 * All ZK proof implementations must conform to this interface.
 */
export interface IZKProver {
  /**
   * Generate a ZK proof
   * 
   * @param request - The proof request
   * @returns Promise resolving to ZKProofResult
   */
  generateProof(request: ZKProofRequest): Promise<ZKProofResult>;

  /**
   * Verify a ZK proof
   * 
   * @param proof - The serialized proof
   * @param publicSignals - The public signals
   * @returns Promise resolving to ZKVerificationResult
   */
  verifyProof(
    proof: string,
    publicSignals: string[]
  ): Promise<ZKVerificationResult>;

  /**
   * Check if the prover is ready
   */
  isReady(): boolean;

  /**
   * Get prover type/name
   */
  getProverType(): string;

  /**
   * Health check
   */
  healthCheck(): Promise<{
    healthy: boolean;
    circuitsLoaded: boolean;
    details?: Record<string, unknown>;
  }>;
}

/**
 * Configuration for ZK provers
 */
export interface ZKProverConfig {
  /** Prover type: 'snarkjs', 'rapidsnark', 'simulation' */
  type: 'snarkjs' | 'rapidsnark' | 'simulation';
  
  /** Path to circuit WASM */
  circuitWasm?: string;
  
  /** Path to proving key */
  provingKey?: string;
  
  /** Path to verification key */
  verificationKey?: string;
  
  /** Use caching */
  enableCache?: boolean;
  
  /** Cache TTL in seconds */
  cacheTtlSeconds?: number;
  
  /** Max concurrent proofs */
  maxConcurrent?: number;
}

/**
 * Factory function type for creating ZK provers
 */
export type ZKProverFactory = (config: ZKProverConfig) => IZKProver;
