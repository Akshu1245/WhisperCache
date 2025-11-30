/**
 * WhisperCache Core Interfaces
 * 
 * This module exports all core interfaces for dependency injection
 * and testability. All production and simulation implementations
 * must conform to these contracts.
 */

// Blockchain Interfaces
export {
  IBlockchainClient,
  IMidnightClient,
  ICardanoClient,
  NetworkType,
  NetworkStatus,
  TransactionResult,
  TxStatus,
  MidnightAnchorPayload,
  MidnightContractState,
  MidnightShieldedData,
  CardanoAnchorPayload,
  CardanoWalletInfo,
  CardanoUtxo,
  BlockchainConfig
} from '../blockchain/types';

// Agent Interfaces
export { IAgentAdapter, AgentContext, AgentQueryResult } from './agent';

// ZK Interfaces
export { IZKProver, ZKProofRequest, ZKProofResult, ZKVerificationResult } from './zk';

// Storage Interfaces
export { IStorageAdapter, StorageRecord, StorageQuery } from './storage';
