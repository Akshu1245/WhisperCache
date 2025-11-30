/**
 * Blockchain Integration Types & Enums
 * 
 * Defines types for real testnet integration with Midnight and Cardano.
 */

export enum BlockchainNetwork {
  MIDNIGHT_DEVNET = 'midnight-devnet',
  MIDNIGHT_TESTNET = 'midnight-testnet',
  CARDANO_TESTNET = 'cardano-testnet',
  CARDANO_PREPROD = 'cardano-preprod'
}

export enum TransactionStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

export interface TransactionMetadata {
  id: string;
  txHash: string;
  network: BlockchainNetwork;
  status: TransactionStatus;
  memoryHash: string;
  createdAt: Date;
  submittedAt?: Date;
  confirmedAt?: Date;
  blockHeight?: number;
  explorerUrl?: string;
  retryCount: number;
  lastRetryAt?: Date;
  error?: string;
}

export interface BlockchainConfig {
  /** Network to target */
  network: BlockchainNetwork;
  
  /** Wallet address or account ID */
  walletAddress: string;
  
  /** Private key (encoded or reference) */
  privateKeyPath?: string;
  
  /** RPC endpoint URL */
  rpcEndpoint: string;
  
  /** Optional: network-specific parameters */
  networkParams?: Record<string, unknown>;
  
  /** Retry attempts for failed submissions */
  maxRetries?: number;
  
  /** Retry delay in ms */
  retryDelayMs?: number;
  
  /** Transaction confirmation timeout in ms */
  confirmationTimeoutMs?: number;
}

export interface AnchorResult {
  /** Transaction ID on blockchain */
  txId: string;
  
  /** Network where anchored */
  network: BlockchainNetwork;
  
  /** Memory commitment hash that was anchored */
  memoryHash: string;
  
  /** Block height (if confirmed) */
  blockHeight?: number;
  
  /** Explorer URL for the transaction */
  explorerUrl?: string;
  
  /** Timestamp when anchored */
  timestamp: Date;
}

export interface BlockchainStatusUpdate {
  txId: string;
  status: TransactionStatus;
  blockHeight?: number;
  timestamp: Date;
  confirmedAt?: Date;
}

/**
 * Build explorer URL based on network and tx ID
 */
export function getExplorerUrl(network: BlockchainNetwork, txId: string): string {
  switch (network) {
    case BlockchainNetwork.CARDANO_TESTNET:
      return `https://testnet.cardanoscan.io/transaction/${txId}`;
    case BlockchainNetwork.CARDANO_PREPROD:
      return `https://preprod.cardanoscan.io/transaction/${txId}`;
    case BlockchainNetwork.MIDNIGHT_TESTNET:
      return `https://explorer-testnet.midnight.network/transaction/${txId}`;
    case BlockchainNetwork.MIDNIGHT_DEVNET:
      return `http://localhost:3000/transaction/${txId}`;
    default:
      return '';
  }
}
