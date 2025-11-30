// Type declarations for circomlibjs
declare module 'circomlibjs' {
  // Field element type from ffjavascript
  export interface F {
    // Convert to string
    toString: (value: any, radix?: number) => string;
    // Convert to BigInt
    toObject: (value: any) => bigint;
    // Check if zero
    isZero: (value: any) => boolean;
    // Check equality
    eq: (a: any, b: any) => boolean;
    // Field operations
    add: (a: any, b: any) => any;
    sub: (a: any, b: any) => any;
    mul: (a: any, b: any) => any;
    div: (a: any, b: any) => any;
    neg: (a: any) => any;
    inv: (a: any) => any;
    square: (a: any) => any;
    pow: (base: any, exp: any) => any;
    // Convert from number/bigint/string
    e: (value: number | bigint | string) => any;
    // Field order
    p: bigint;
    // Field order as string
    order: bigint;
    // Random element
    random: () => any;
    // Zero element
    zero: any;
    // One element
    one: any;
  }

  // Poseidon hash function
  export interface Poseidon {
    (inputs: (bigint | number | string)[]): any;
    F: F;
  }

  // Build Poseidon hash function
  export function buildPoseidon(): Promise<Poseidon>;

  // MiMC hash functions
  export interface MiMC7 {
    hash: (left: any, right: any, key?: any) => any;
    multiHash: (arr: any[], key?: any) => any;
    F: F;
  }

  export interface MiMCSponge {
    hash: (left: any, right: any, key?: any) => any;
    multiHash: (arr: any[], key?: any, numOutputs?: number) => any[];
    F: F;
  }

  export function buildMimcSponge(): Promise<MiMCSponge>;
  export function buildMimc7(): Promise<MiMC7>;

  // Pedersen hash
  export interface PedersenHash {
    hash: (msg: Uint8Array) => any[];
    babyJub: BabyJub;
  }

  export function buildPedersenHash(): Promise<PedersenHash>;

  // BabyJubJub curve
  export interface Point {
    0: any;
    1: any;
  }

  export interface BabyJub {
    F: F;
    Base8: Point;
    Generator: Point;
    order: bigint;
    subOrder: bigint;
    p: bigint;
    A: bigint;
    D: bigint;
    
    addPoint: (a: Point, b: Point) => Point;
    mulPointScalar: (point: Point, scalar: bigint | number) => Point;
    inCurve: (point: Point) => boolean;
    inSubgroup: (point: Point) => boolean;
    packPoint: (point: Point) => Uint8Array;
    unpackPoint: (packed: Uint8Array) => Point | null;
  }

  export function buildBabyjub(): Promise<BabyJub>;

  // EdDSA
  export interface EdDSA {
    F: F;
    babyJub: BabyJub;
    
    prv2pub: (prv: Uint8Array) => Point;
    signPedersen: (prv: Uint8Array, msg: Uint8Array) => {
      R8: Point;
      S: bigint;
    };
    signPoseidon: (prv: Uint8Array, msg: bigint) => {
      R8: Point;
      S: bigint;
    };
    signMiMC: (prv: Uint8Array, msg: bigint) => {
      R8: Point;
      S: bigint;
    };
    signMiMCSponge: (prv: Uint8Array, msg: bigint) => {
      R8: Point;
      S: bigint;
    };
    verifyPedersen: (
      msg: Uint8Array,
      sig: { R8: Point; S: bigint },
      pubKey: Point
    ) => boolean;
    verifyPoseidon: (
      msg: bigint,
      sig: { R8: Point; S: bigint },
      pubKey: Point
    ) => boolean;
    verifyMiMC: (
      msg: bigint,
      sig: { R8: Point; S: bigint },
      pubKey: Point
    ) => boolean;
    verifyMiMCSponge: (
      msg: bigint,
      sig: { R8: Point; S: bigint },
      pubKey: Point
    ) => boolean;
    packSignature: (sig: { R8: Point; S: bigint }) => Uint8Array;
    unpackSignature: (packed: Uint8Array) => { R8: Point; S: bigint };
  }

  export function buildEddsa(): Promise<EdDSA>;

  // SMT (Sparse Merkle Tree)
  export interface SMT {
    F: F;
    root: any;
    db: Map<string, any[]>;
    
    insert: (key: any, value: any) => Promise<{
      oldRoot: any;
      newRoot: any;
      oldKey: any;
      oldValue: any;
      newKey: any;
      newValue: any;
      siblings: any[];
      isOld0: boolean;
    }>;
    
    delete: (key: any) => Promise<{
      oldRoot: any;
      newRoot: any;
      oldKey: any;
      oldValue: any;
      siblings: any[];
      isOld0: boolean;
      delKey: any;
      delValue: any;
    }>;
    
    update: (key: any, value: any) => Promise<{
      oldRoot: any;
      newRoot: any;
      oldKey: any;
      oldValue: any;
      newKey: any;
      newValue: any;
      siblings: any[];
    }>;
    
    find: (key: any) => Promise<{
      found: boolean;
      siblings: any[];
      foundKey?: any;
      foundValue?: any;
      notFoundKey?: any;
      notFoundValue?: any;
      isOld0?: boolean;
    }>;
  }

  export interface SMTMemDb {
    root: any;
    nodes: Map<string, any[]>;
    get: (key: any) => Promise<any[]>;
    multiGet: (keys: any[]) => Promise<any[][]>;
    setRoot: (rt: any) => Promise<void>;
    multiIns: (inserts: any[]) => Promise<void>;
    multiDel: (deletes: any[]) => Promise<void>;
    getRoot: () => Promise<any>;
  }

  export function newMemEmptyTrie(): Promise<SMT>;
}
