/**
 * Blockchain Configuration Loader
 * 
 * Loads and validates blockchain configuration from environment variables
 * for real testnet integration.
 */

import { BlockchainConfig, BlockchainNetwork } from './blockchainTypes.js';

/**
 * Load blockchain configuration from environment
 */
export function loadBlockchainConfig(): BlockchainConfig {
  const network = (process.env.BLOCKCHAIN_NETWORK || 'cardano-testnet') as BlockchainNetwork;
  
  // Validate network
  const validNetworks = Object.values(BlockchainNetwork);
  if (!validNetworks.includes(network)) {
    throw new Error(`Invalid BLOCKCHAIN_NETWORK: ${network}. Valid options: ${validNetworks.join(', ')}`);
  }
  
  const config: BlockchainConfig = {
    network,
    walletAddress: process.env.BLOCKCHAIN_WALLET_ADDRESS || '',
    privateKeyPath: process.env.BLOCKCHAIN_PRIVATE_KEY_PATH,
    rpcEndpoint: getRPCEndpoint(network),
    maxRetries: parseInt(process.env.BLOCKCHAIN_MAX_RETRIES || '3'),
    retryDelayMs: parseInt(process.env.BLOCKCHAIN_RETRY_DELAY_MS || '5000'),
    confirmationTimeoutMs: parseInt(process.env.BLOCKCHAIN_CONFIRMATION_TIMEOUT || '300000')
  };
  
  // Validate required fields
  if (!config.walletAddress) {
    throw new Error('BLOCKCHAIN_WALLET_ADDRESS not configured');
  }
  
  if (!config.rpcEndpoint) {
    throw new Error(`RPC endpoint not configured for network: ${network}`);
  }
  
  console.log(`[BlockchainConfig] Loaded configuration for ${network}`);
  console.log(`  Wallet: ${config.walletAddress.slice(0, 20)}...`);
  console.log(`  RPC: ${config.rpcEndpoint}`);
  console.log(`  Max Retries: ${config.maxRetries}`);
  
  return config;
}

/**
 * Get RPC endpoint based on network
 */
function getRPCEndpoint(network: BlockchainNetwork): string {
  switch (network) {
    case BlockchainNetwork.CARDANO_TESTNET:
      return process.env.CARDANO_TESTNET_RPC || 
             'https://cardano-testnet.blockfrost.io/api/v0';
    
    case BlockchainNetwork.CARDANO_PREPROD:
      return process.env.CARDANO_PREPROD_RPC || 
             'https://cardano-preprod.blockfrost.io/api/v0';
    
    case BlockchainNetwork.MIDNIGHT_TESTNET:
      return process.env.MIDNIGHT_TESTNET_RPC || 
             'https://rpc-testnet.midnight.network';
    
    case BlockchainNetwork.MIDNIGHT_DEVNET:
      return process.env.MIDNIGHT_DEVNET_RPC || 
             'http://localhost:8545';
    
    default:
      throw new Error(`Unknown network: ${network}`);
  }
}

/**
 * Get blockchain config from environment with defaults
 */
export function getBlockchainConfigEnv(): Partial<BlockchainConfig> {
  return {
    network: (process.env.BLOCKCHAIN_NETWORK || 'cardano-testnet') as BlockchainNetwork,
    walletAddress: process.env.BLOCKCHAIN_WALLET_ADDRESS,
    privateKeyPath: process.env.BLOCKCHAIN_PRIVATE_KEY_PATH,
    maxRetries: process.env.BLOCKCHAIN_MAX_RETRIES ? parseInt(process.env.BLOCKCHAIN_MAX_RETRIES) : 3,
    retryDelayMs: process.env.BLOCKCHAIN_RETRY_DELAY_MS ? parseInt(process.env.BLOCKCHAIN_RETRY_DELAY_MS) : 5000,
    confirmationTimeoutMs: process.env.BLOCKCHAIN_CONFIRMATION_TIMEOUT ? parseInt(process.env.BLOCKCHAIN_CONFIRMATION_TIMEOUT) : 300000
  };
}
