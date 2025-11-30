/**
 * WhisperCache Blockchain Service Types
 * 
 * Common interfaces for blockchain integrations.
 * Supports multiple chains: Midnight (privacy) and Cardano (anchoring).
 */

// ============================================================================
// Common Types
// ============================================================================

export type NetworkType = 'mainnet' | 'testnet' | 'devnet' | 'preview' | 'preprod' | 'local';
export type TxStatus = 'pending' | 'submitted' | 'confirmed' | 'finalized' | 'failed';

export interface BlockchainConfig {
  network: NetworkType;
  nodeUrl: string;
  apiKey?: string;
  walletMnemonic?: string;
  walletAddress?: string;
}

export interface TransactionResult {
  txId: string;
  status: TxStatus;
  blockHeight?: number;
  blockHash?: string;
  timestamp: string;
  confirmations: number;
  fees?: string;
  explorerUrl?: string;
}

export interface NetworkStatus {
  connected: boolean;
  network: NetworkType;
  chainId: string;
  latestBlock: number;
  syncProgress: number;
  epoch?: number;
  slot?: number;
}

// ============================================================================
// Midnight-Specific Types
// ============================================================================

export interface MidnightAnchorPayload {
  proofHash: string;
  memoryCommitment: string;
  zkProofHash?: string;
  userDid?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface MidnightShieldedData {
  encryptedPayload: string;
  nullifier: string;
  commitment: string;
  merkleRoot: string;
}

export interface MidnightContractState {
  contractAddress: string;
  totalAnchors: number;
  lastAnchorTime: string;
  version: string;
}

// ============================================================================
// Cardano-Specific Types
// ============================================================================

export interface CardanoAnchorPayload {
  dataHash: string;
  metadata: {
    label: number;  // CIP-25 metadata label
    content: {
      type: 'whispercache_anchor';
      version: string;
      proofHash: string;
      memoryCommitment: string;
      timestamp: number;
    };
  };
}

export interface CardanoUtxo {
  txHash: string;
  outputIndex: number;
  amount: { unit: string; quantity: string }[];
  address: string;
}

export interface CardanoWalletInfo {
  address: string;
  balance: string;
  utxoCount: number;
  stakeAddress?: string;
}

// ============================================================================
// Service Interfaces
// ============================================================================

/**
 * Base interface for blockchain clients
 */
export interface IBlockchainClient {
  connect(): Promise<NetworkStatus>;
  disconnect(): Promise<void>;
  getNetworkStatus(): Promise<NetworkStatus>;
  isConnected(): boolean;
}

/**
 * Midnight client interface for privacy-preserving operations
 */
export interface IMidnightClient extends IBlockchainClient {
  /**
   * Store encrypted memory commitment on Midnight
   */
  storeEncryptedMemory(
    commitmentHash: string,
    userDidOrWallet: string,
    metadata?: Record<string, unknown>
  ): Promise<TransactionResult>;

  /**
   * Verify a commitment exists on Midnight
   */
  verifyCommitment(
    txId: string
  ): Promise<{ exists: boolean; commitment?: string; blockHeight?: number }>;

  /**
   * Anchor a ZK proof to Midnight
   */
  anchorZKProof(
    payload: MidnightAnchorPayload
  ): Promise<TransactionResult>;

  /**
   * Get contract state
   */
  getContractState(): Promise<MidnightContractState>;
}

/**
 * Cardano client interface for public hash anchoring
 */
export interface ICardanoClient extends IBlockchainClient {
  /**
   * Anchor a hash to Cardano blockchain
   */
  anchorHash(
    hash: string,
    metadata?: CardanoAnchorPayload['metadata']
  ): Promise<TransactionResult>;

  /**
   * Verify an anchor exists on Cardano
   */
  verifyAnchor(
    txId: string
  ): Promise<{ exists: boolean; metadata?: unknown; blockHeight?: number }>;

  /**
   * Get wallet information
   */
  getWalletInfo(): Promise<CardanoWalletInfo>;

  /**
   * Get transaction details
   */
  getTransaction(txId: string): Promise<TransactionResult | null>;
}

// ============================================================================
// Configuration Helpers
// ============================================================================

export const MIDNIGHT_ENDPOINTS: Record<NetworkType, string> = {
  mainnet: 'https://mainnet.midnight.network',
  testnet: 'https://testnet.midnight.network',
  devnet: 'https://devnet.midnight.network',
  preview: 'https://preview.midnight.network',
  preprod: 'https://preprod.midnight.network',
  local: 'http://localhost:9944'
};

export const CARDANO_ENDPOINTS: Record<NetworkType, string> = {
  mainnet: 'https://cardano-mainnet.blockfrost.io/api/v0',
  testnet: 'https://cardano-testnet.blockfrost.io/api/v0',
  devnet: 'https://cardano-preview.blockfrost.io/api/v0',
  preview: 'https://cardano-preview.blockfrost.io/api/v0',
  preprod: 'https://cardano-preprod.blockfrost.io/api/v0',
  local: 'http://localhost:3000'
};

export const CARDANO_EXPLORERS: Record<NetworkType, string> = {
  mainnet: 'https://cardanoscan.io/transaction',
  testnet: 'https://testnet.cardanoscan.io/transaction',
  devnet: 'https://preview.cardanoscan.io/transaction',
  preview: 'https://preview.cardanoscan.io/transaction',
  preprod: 'https://preprod.cardanoscan.io/transaction',
  local: 'http://localhost:3000/tx'
};

// WhisperCache metadata label (CIP-25 range)
export const WHISPERCACHE_METADATA_LABEL = 721721;
