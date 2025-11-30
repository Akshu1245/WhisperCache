/**
 * Type declarations for ZK-related modules
 */

declare module 'snarkjs' {
  export interface Groth16Proof {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  }

  export interface VerificationKey {
    protocol: string;
    curve: string;
    nPublic: number;
    vk_alpha_1: string[];
    vk_beta_2: string[][];
    vk_gamma_2: string[][];
    vk_delta_2: string[][];
    vk_alphabeta_12: string[][][];
    IC: string[][];
  }

  export namespace groth16 {
    function prove(
      zkeyFileName: string,
      witnessFileName: string,
      logger?: unknown
    ): Promise<{ proof: Groth16Proof; publicSignals: string[] }>;

    function verify(
      vkey: VerificationKey,
      publicSignals: string[],
      proof: Groth16Proof,
      logger?: unknown
    ): Promise<boolean>;

    function fullProve(
      input: Record<string, unknown>,
      wasmFile: string,
      zkeyFileName: string,
      logger?: unknown
    ): Promise<{ proof: Groth16Proof; publicSignals: string[] }>;
  }

  export namespace zKey {
    function exportVerificationKey(
      zkeyFileName: string,
      logger?: unknown
    ): Promise<VerificationKey>;
  }
}

declare module 'circomlibjs' {
  export interface PoseidonHasher {
    (inputs: bigint[]): Uint8Array;
    F: {
      toObject(arr: Uint8Array): bigint;
      toString(arr: Uint8Array, radix?: number): string;
    };
  }

  export function buildPoseidon(): Promise<PoseidonHasher>;
  export function buildMimcSponge(): Promise<unknown>;
  export function buildBabyjub(): Promise<unknown>;
  export function buildEddsa(): Promise<unknown>;
}
