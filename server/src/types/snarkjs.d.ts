// Type declarations for snarkjs
declare module 'snarkjs' {
  export interface Groth16Proof {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  }

  export interface PublicSignals {
    [key: number]: string;
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

  export interface ProveResult {
    proof: Groth16Proof;
    publicSignals: string[];
  }

  export interface WASM {
    type: 'mem' | 'file';
    data?: Uint8Array;
  }

  export const groth16: {
    fullProve: (
      input: Record<string, any>,
      wasmFile: string | WASM,
      zkeyFile: string | Uint8Array
    ) => Promise<ProveResult>;
    
    prove: (
      zkeyFile: string | Uint8Array,
      witnessFile: string | Uint8Array
    ) => Promise<ProveResult>;
    
    verify: (
      vkey: VerificationKey | string,
      publicSignals: string[],
      proof: Groth16Proof
    ) => Promise<boolean>;
    
    exportSolidityCallData: (
      proof: Groth16Proof,
      publicSignals: string[]
    ) => Promise<string>;
  };

  export const plonk: {
    fullProve: (
      input: Record<string, any>,
      wasmFile: string | WASM,
      zkeyFile: string | Uint8Array
    ) => Promise<ProveResult>;
    
    verify: (
      vkey: VerificationKey | string,
      publicSignals: string[],
      proof: any
    ) => Promise<boolean>;
  };

  export const powersOfTau: {
    newAccumulator: (
      curve: string,
      power: number,
      fileName: string,
      logger?: any
    ) => Promise<void>;
    
    contribute: (
      oldPtauFilename: string,
      newPTauFilename: string,
      name: string,
      entropy?: string,
      logger?: any
    ) => Promise<void>;
    
    beacon: (
      oldPtauFilename: string,
      newPTauFilename: string,
      name: string,
      beaconHashStr: string,
      numIterationsExp: number,
      logger?: any
    ) => Promise<void>;
    
    preparePhase2: (
      oldPtauFilename: string,
      newPTauFilename: string,
      logger?: any
    ) => Promise<void>;
    
    verify: (
      ptauFilename: string,
      logger?: any
    ) => Promise<boolean>;
  };

  export const zKey: {
    newZKey: (
      r1csFilename: string,
      ptauFilename: string,
      zkeyFilename: string,
      logger?: any
    ) => Promise<void>;
    
    contribute: (
      oldZKeyFilename: string,
      newZKeyFilename: string,
      name: string,
      entropy?: string,
      logger?: any
    ) => Promise<void>;
    
    beacon: (
      oldZKeyFilename: string,
      newZKeyFilename: string,
      name: string,
      beaconHashStr: string,
      numIterationsExp: number,
      logger?: any
    ) => Promise<void>;
    
    verifyFromR1cs: (
      r1csFilename: string,
      ptauFilename: string,
      zkeyFilename: string,
      logger?: any
    ) => Promise<boolean>;
    
    verifyFromInit: (
      initZKeyFilename: string,
      zkeyFilename: string,
      logger?: any
    ) => Promise<boolean>;
    
    exportVerificationKey: (
      zkeyFilename: string
    ) => Promise<VerificationKey>;
    
    exportSolidityVerifier: (
      zkeyFilename: string,
      templates: { groth16?: string; plonk?: string }
    ) => Promise<string>;
  };

  export const wtns: {
    calculate: (
      input: Record<string, any>,
      wasmFilename: string | WASM,
      wtnsFilename: string
    ) => Promise<void>;
    
    check: (
      r1csFilename: string,
      wtnsFilename: string,
      logger?: any
    ) => Promise<boolean>;
    
    exportJson: (
      wtnsFilename: string
    ) => Promise<any>;
  };

  export const r1cs: {
    info: (
      r1csFilename: string,
      logger?: any
    ) => Promise<any>;
    
    print: (
      r1csFilename: string,
      symFilename: string,
      logger?: any
    ) => Promise<void>;
    
    exportJson: (
      r1csFilename: string,
      logger?: any
    ) => Promise<any>;
  };
}
