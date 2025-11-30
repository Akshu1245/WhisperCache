/**
 * WhisperCache Blockchain Factory
 * 
 * Factory for creating blockchain client instances.
 * Supports switching between simulation and real modes via environment.
 * 
 * Environment Variables:
 * - BLOCKCHAIN_MODE: 'simulation' | 'real' (default: 'simulation') - global default
 * - MIDNIGHT_MODE: 'simulation' | 'real' | 'stub' (overrides BLOCKCHAIN_MODE for Midnight)
 * - CARDANO_MODE: 'simulation' | 'real' | 'stub' (overrides BLOCKCHAIN_MODE for Cardano)
 * - MIDNIGHT_NETWORK: 'devnet' | 'testnet' | 'mainnet' (default: 'devnet')
 * - CARDANO_NETWORK: 'preview' | 'preprod' | 'mainnet' (default: 'preview')
 * - MIDNIGHT_API_KEY: API key for Midnight (when real mode)
 * - MIDNIGHT_RPC_URL: RPC endpoint for Midnight
 * - BLOCKFROST_API_KEY: API key for Blockfrost/Cardano (when real mode)
 * - CARDANO_RPC_URL: RPC endpoint for Cardano
 */

import { MidnightClient, MidnightClientConfig } from './midnightClient';
import { CardanoClient, CardanoClientConfig } from './cardanoClient';
import { IMidnightClient, ICardanoClient, NetworkType } from './types';

// ============================================================================
// Types
// ============================================================================

export type BlockchainMode = 'simulation' | 'real' | 'stub';

export interface BlockchainFactoryConfig {
  mode?: BlockchainMode;
  midnight?: Partial<MidnightClientConfig>;
  cardano?: Partial<CardanoClientConfig>;
}

export interface BlockchainClients {
  midnight: IMidnightClient;
  cardano: ICardanoClient;
  mode: BlockchainMode;
  midnightMode: BlockchainMode;
  cardanoMode: BlockchainMode;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Get the current blockchain mode from environment
 */
export function getBlockchainMode(): BlockchainMode {
  const mode = process.env.BLOCKCHAIN_MODE?.toLowerCase();
  if (mode === 'real') return 'real';
  if (mode === 'stub') return 'stub';
  return 'simulation';
}

/**
 * Get the Midnight-specific mode (falls back to global mode)
 */
export function getMidnightMode(): BlockchainMode {
  const mode = process.env.MIDNIGHT_MODE?.toLowerCase();
  if (mode === 'real') return 'real';
  if (mode === 'stub') return 'stub';
  if (mode === 'simulation') return 'simulation';
  return getBlockchainMode();
}

/**
 * Get the Cardano-specific mode (falls back to global mode)
 */
export function getCardanoMode(): BlockchainMode {
  const mode = process.env.CARDANO_MODE?.toLowerCase();
  if (mode === 'real') return 'real';
  if (mode === 'stub') return 'stub';
  if (mode === 'simulation') return 'simulation';
  return getBlockchainMode();
}

/**
 * Check if we're in simulation mode (any chain)
 */
export function isSimulationMode(): boolean {
  return getMidnightMode() !== 'real' && getCardanoMode() !== 'real';
}

/**
 * Create a Midnight client instance
 */
export function createMidnightClient(config?: Partial<MidnightClientConfig>): IMidnightClient {
  const mode = getMidnightMode();
  const network = (process.env.MIDNIGHT_NETWORK as NetworkType) || 'devnet';

  const clientConfig: MidnightClientConfig = {
    network,
    nodeUrl: process.env.MIDNIGHT_RPC_URL || process.env.MIDNIGHT_NODE_URL || '',
    apiKey: process.env.MIDNIGHT_API_KEY,
    walletAddress: process.env.MIDNIGHT_WALLET_ADDRESS,
    contractAddress: process.env.MIDNIGHT_CONTRACT_ADDRESS,
    simulationMode: mode !== 'real',
    ...config
  };

  console.log(`[BlockchainFactory] Creating Midnight client: network=${network}, mode=${mode}`);
  return new MidnightClient(clientConfig);
}

/**
 * Create a Cardano client instance
 */
export function createCardanoClient(config?: Partial<CardanoClientConfig>): ICardanoClient {
  const mode = getCardanoMode();
  const network = (process.env.CARDANO_NETWORK as NetworkType) || 'preview';

  const clientConfig: CardanoClientConfig = {
    network,
    nodeUrl: process.env.CARDANO_RPC_URL || process.env.CARDANO_NODE_URL || '',
    blockfrostApiKey: process.env.BLOCKFROST_API_KEY,
    walletAddress: process.env.CARDANO_WALLET_ADDRESS,
    simulationMode: mode !== 'real',
    ...config
  };

  console.log(`[BlockchainFactory] Creating Cardano client: network=${network}, mode=${mode}`);
  return new CardanoClient(clientConfig);
}

/**
 * Create all blockchain clients
 */
export function createBlockchainClients(config?: BlockchainFactoryConfig): BlockchainClients {
  const mode = config?.mode || getBlockchainMode();
  const midnightMode = getMidnightMode();
  const cardanoMode = getCardanoMode();

  return {
    midnight: createMidnightClient({ 
      simulationMode: midnightMode !== 'real',
      ...config?.midnight 
    }),
    cardano: createCardanoClient({ 
      simulationMode: cardanoMode !== 'real',
      ...config?.cardano 
    }),
    mode,
    midnightMode,
    cardanoMode
  };
}

/**
 * Initialize and connect all blockchain clients
 */
export async function initializeBlockchainClients(
  config?: BlockchainFactoryConfig
): Promise<BlockchainClients> {
  const clients = createBlockchainClients(config);

  console.log('[BlockchainFactory] Initializing blockchain connections...');

  try {
    // Connect both clients in parallel
    const [midnightStatus, cardanoStatus] = await Promise.all([
      clients.midnight.connect(),
      clients.cardano.connect()
    ]);

    console.log(`[BlockchainFactory] Midnight: ${midnightStatus.connected ? 'connected' : 'failed'} (block ${midnightStatus.latestBlock})`);
    console.log(`[BlockchainFactory] Cardano: ${cardanoStatus.connected ? 'connected' : 'failed'} (slot ${cardanoStatus.slot})`);

    return clients;
  } catch (error) {
    console.error('[BlockchainFactory] Failed to initialize blockchain clients:', error);
    throw error;
  }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

let _blockchainClients: BlockchainClients | null = null;

/**
 * Get or create the singleton blockchain clients
 */
export async function getBlockchainClients(): Promise<BlockchainClients> {
  if (!_blockchainClients) {
    _blockchainClients = await initializeBlockchainClients();
  }
  return _blockchainClients;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetBlockchainClients(): void {
  if (_blockchainClients) {
    // Disconnect if possible
    _blockchainClients.midnight.disconnect().catch(() => {});
    _blockchainClients.cardano.disconnect().catch(() => {});
    _blockchainClients = null;
  }
}

// ============================================================================
// Health Check
// ============================================================================

export interface BlockchainHealthStatus {
  healthy: boolean;
  mode: BlockchainMode;
  midnight: {
    connected: boolean;
    network: string;
    block?: number;
  };
  cardano: {
    connected: boolean;
    network: string;
    slot?: number;
    epoch?: number;
  };
}

/**
 * Get health status of blockchain connections
 */
export async function getBlockchainHealth(): Promise<BlockchainHealthStatus> {
  const clients = await getBlockchainClients();
  
  const [midnightStatus, cardanoStatus] = await Promise.all([
    clients.midnight.getNetworkStatus().catch(() => ({ connected: false, network: 'unknown', latestBlock: 0 } as any)),
    clients.cardano.getNetworkStatus().catch(() => ({ connected: false, network: 'unknown', slot: 0, epoch: 0 } as any))
  ]);

  return {
    healthy: midnightStatus.connected && cardanoStatus.connected,
    mode: clients.mode,
    midnight: {
      connected: midnightStatus.connected,
      network: midnightStatus.network,
      block: midnightStatus.latestBlock
    },
    cardano: {
      connected: cardanoStatus.connected,
      network: cardanoStatus.network,
      slot: cardanoStatus.slot,
      epoch: cardanoStatus.epoch
    }
  };
}

export default {
  createMidnightClient,
  createCardanoClient,
  createBlockchainClients,
  initializeBlockchainClients,
  getBlockchainClients,
  getBlockchainHealth,
  isSimulationMode,
  getBlockchainMode
};
