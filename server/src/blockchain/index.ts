/**
 * WhisperCache Blockchain Services
 * 
 * Exports all blockchain integration modules.
 */

// Types
export * from './types';

// Factory (recommended for new code)
export {
  createMidnightClient,
  createCardanoClient,
  createBlockchainClients,
  initializeBlockchainClients,
  getBlockchainClients,
  getBlockchainHealth,
  resetBlockchainClients,
  isSimulationMode,
  getBlockchainMode,
  getMidnightMode,
  getCardanoMode,
  type BlockchainMode,
  type BlockchainFactoryConfig,
  type BlockchainClients,
  type BlockchainHealthStatus
} from './factory';

// Midnight Client (legacy - use factory instead)
export {
  MidnightClient,
  getMidnightClient,
  initializeMidnight,
  resetMidnightClient,
  type MidnightClientConfig
} from './midnightClient';

// Cardano Client (legacy - use factory instead)
export {
  CardanoClient,
  getCardanoClient,
  initializeCardano,
  resetCardanoClient,
  type CardanoClientConfig
} from './cardanoClient';

// Production Blockchain Service (recommended for production)
export {
  BlockchainService,
  getBlockchainService,
  initializeBlockchainService,
  resetBlockchainService,
  ChainPriority,
  type BlockchainServiceConfig,
  type AnchorRequest,
  type AnchorResult,
  type HealthMetrics
} from './blockchainService';

// ============================================================================
// Unified Blockchain Service
// ============================================================================

import { getMidnightClient, initializeMidnight } from './midnightClient';
import { getCardanoClient, initializeCardano } from './cardanoClient';
import { NetworkStatus, TransactionResult } from './types';

export interface BlockchainStatus {
  midnight: NetworkStatus | null;
  cardano: NetworkStatus | null;
  ready: boolean;
}

/**
 * Initialize all blockchain connections
 */
export async function initializeBlockchains(): Promise<BlockchainStatus> {
  const results: BlockchainStatus = {
    midnight: null,
    cardano: null,
    ready: false
  };

  // Initialize Midnight
  try {
    results.midnight = await initializeMidnight();
    console.log('[Blockchain] Midnight initialized');
  } catch (error) {
    console.warn('[Blockchain] Midnight initialization failed:', error);
  }

  // Initialize Cardano
  try {
    results.cardano = await initializeCardano();
    console.log('[Blockchain] Cardano initialized');
  } catch (error) {
    console.warn('[Blockchain] Cardano initialization failed:', error);
  }

  results.ready = results.midnight !== null || results.cardano !== null;
  return results;
}

/**
 * Get combined blockchain status
 */
export async function getBlockchainStatus(): Promise<BlockchainStatus> {
  const midnight = getMidnightClient();
  const cardano = getCardanoClient();

  return {
    midnight: midnight.isConnected() ? await midnight.getNetworkStatus() : null,
    cardano: cardano.isConnected() ? await cardano.getNetworkStatus() : null,
    ready: midnight.isConnected() || cardano.isConnected()
  };
}

/**
 * Anchor data to both Midnight and Cardano
 * 
 * Midnight: Privacy-preserving storage
 * Cardano: Public hash anchoring for auditability
 */
export async function anchorToBothChains(
  commitmentHash: string,
  proofHash: string,
  userDid?: string
): Promise<{
  midnight?: TransactionResult;
  cardano?: TransactionResult;
}> {
  const results: {
    midnight?: TransactionResult;
    cardano?: TransactionResult;
  } = {};

  const midnight = getMidnightClient();
  const cardano = getCardanoClient();

  // Anchor to Midnight (privacy-preserving)
  if (midnight.isConnected()) {
    try {
      results.midnight = await midnight.storeEncryptedMemory(
        commitmentHash,
        userDid || 'anonymous',
        { proofHash }
      );
    } catch (error) {
      console.error('[Blockchain] Midnight anchor failed:', error);
    }
  }

  // Anchor hash to Cardano (public audit trail)
  if (cardano.isConnected()) {
    try {
      results.cardano = await cardano.anchorHash(proofHash);
    } catch (error) {
      console.error('[Blockchain] Cardano anchor failed:', error);
    }
  }

  return results;
}
