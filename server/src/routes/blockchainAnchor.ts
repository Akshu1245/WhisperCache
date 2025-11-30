/**
 * WhisperCache Blockchain Anchor Routes
 * 
 * Provides API endpoints for anchoring proofs to blockchain:
 * - SQLite: Local database anchoring (fast, persistent)
 * - IPFS: Decentralized content-addressed storage
 * - Midnight: Privacy-preserving anchor storage (simulated)
 * - Cardano: Public hash anchoring for auditability (simulated)
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { generateNonce, hashData, createCommitment } from '../lib/crypto';
import { simpleAuthMiddleware, optionalSimpleAuth } from '../lib/auth';
import { 
  insertAnchorTransaction, 
  insertComplianceLog, 
  getLatestLogHash,
  insertAnchorLog,
  getAnchorLogByProofHash,
  getRecentAnchorLogs,
  getAnchorLogStats,
  AnchorType,
  BlockchainAnchorLog
} from '../lib/database';
import {
  getMidnightClient,
  getCardanoClient,
  initializeBlockchains,
  getBlockchainStatus,
  anchorToBothChains,
  TransactionResult,
  BlockchainStatus
} from '../blockchain';

const router = Router();

// ============================================================================
// Anchor Mode Configuration
// ============================================================================
const ANCHOR_MODE = process.env.ANCHOR_MODE || 'sqlite';
const IPFS_API_URL = process.env.IPFS_API_URL || 'http://localhost:5001';
const IPFS_GATEWAY_URL = process.env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs';

console.log(`[Anchor] Mode: ${ANCHOR_MODE.toUpperCase()}`);

// Track initialization status
let blockchainsInitialized = false;

// Simulated block counter for local anchoring
let simulatedBlockHeight = Math.floor(Date.now() / 1000) % 1000000;

/**
 * Generate simulated IPFS CID (deterministic hash-based)
 * In production, this would call IPFS node
 */
function generateSimulatedIpfsCid(content: string): string {
  // Create a CIDv1 style hash (starts with 'baf')
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return `bafybeig${hash.substring(0, 44)}`;
}

/**
 * Try to pin content to IPFS (if available)
 * Returns CID on success, null on failure
 */
async function tryIpfsPin(content: object): Promise<string | null> {
  if (ANCHOR_MODE !== 'ipfs') {
    return null;
  }
  
  try {
    // Try real IPFS first
    const response = await fetch(`${IPFS_API_URL}/api/v0/add`, {
      method: 'POST',
      body: JSON.stringify(content),
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`[Anchor] IPFS pinned: ${data.Hash}`);
      return data.Hash;
    }
  } catch (error) {
    console.log('[Anchor] IPFS not available, using simulated CID');
  }
  
  // Fallback to simulated CID
  return generateSimulatedIpfsCid(JSON.stringify(content));
}

/**
 * Ensure blockchain connections are established
 */
async function ensureBlockchainsConnected(): Promise<BlockchainStatus> {
  if (!blockchainsInitialized) {
    await initializeBlockchains();
    blockchainsInitialized = true;
  }
  return getBlockchainStatus();
}

// ============================================================================
// Request/Response Types
// ============================================================================

interface AnchorRequest {
  memoryHash: string;
  proofHash: string;
  userDid?: string;
  chain?: 'midnight' | 'cardano' | 'both';
  metadata?: Record<string, unknown>;
}

interface AnchorResponse {
  success: boolean;
  anchorType: AnchorType;
  anchorLog?: {
    id: string;
    simulatedBlock?: number;
    simulatedTx?: string;
    ipfsCid?: string;
    commitment: string;
    timestamp: string;
    gatewayUrl?: string;
  };
  midnight?: {
    txId: string;
    status: string;
    blockHeight?: number;
    confirmations: number;
    fees?: string;
  };
  cardano?: {
    txId: string;
    status: string;
    blockHeight?: number;
    confirmations: number;
    fees?: string;
    explorerUrl?: string;
  };
  commitment: string;
  timestamp: string;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/anchor
 * 
 * Anchors encrypted memory proof to local database and optionally IPFS/blockchain.
 * - SQLite mode: Fast local persistence
 * - IPFS mode: Content-addressed with CID
 * - Also sends to simulated Midnight/Cardano
 * 
 * Requires authentication.
 */
router.post('/', simpleAuthMiddleware(), async (req: Request<{}, {}, AnchorRequest>, res: Response) => {
  try {
    const { memoryHash, proofHash, userDid, chain = 'both', metadata } = req.body;

    if (!memoryHash || !proofHash) {
      return res.status(400).json({
        success: false,
        message: 'memoryHash and proofHash are required'
      });
    }

    const startTime = Date.now();
    const now = new Date().toISOString();
    
    // Generate commitment
    const nonce = await generateNonce();
    const commitment = await createCommitment(
      memoryHash,
      proofHash,
      userDid || 'anonymous',
      nonce
    );

    // Determine anchor type based on ANCHOR_MODE
    const anchorType: AnchorType = ANCHOR_MODE === 'ipfs' ? 'ipfs' : 'sqlite';
    
    // Generate simulated block/tx for local anchoring
    simulatedBlockHeight += 1;
    const simulatedBlock = simulatedBlockHeight;
    const simulatedTx = `anchor_${crypto.randomBytes(16).toString('hex')}`;
    
    // Try IPFS if in IPFS mode
    let ipfsCid: string | null = null;
    if (ANCHOR_MODE === 'ipfs') {
      const anchorContent = {
        type: 'whispercache_anchor',
        version: '1.0.0',
        proofHash,
        memoryHash,
        commitment,
        timestamp: now,
        metadata
      };
      ipfsCid = await tryIpfsPin(anchorContent);
    }
    
    // Create anchor log entry
    const anchorLogId = `log_${crypto.randomBytes(8).toString('hex')}`;
    const anchorLog: BlockchainAnchorLog = {
      id: anchorLogId,
      proofHash,
      memoryHash,
      anchorType,
      simulatedBlock,
      simulatedTx,
      ipfsCid: ipfsCid || undefined,
      commitment,
      metadata: metadata as Record<string, unknown>,
      createdAt: now
    };
    
    // Persist to SQLite
    insertAnchorLog(anchorLog);
    console.log(`[Anchor] Persisted locally: ${anchorLogId} (${anchorType}${ipfsCid ? ' + IPFS' : ''})`);

    const response: AnchorResponse = {
      success: true,
      anchorType,
      anchorLog: {
        id: anchorLogId,
        simulatedBlock,
        simulatedTx,
        ipfsCid: ipfsCid || undefined,
        commitment,
        timestamp: now,
        gatewayUrl: ipfsCid ? `${IPFS_GATEWAY_URL}/${ipfsCid}` : undefined
      },
      commitment,
      timestamp: now
    };

    // Also try simulated blockchain anchoring (non-blocking)
    try {
      const status = await ensureBlockchainsConnected();
      if (status.ready) {
        // Try Midnight
        if (chain === 'both' || chain === 'midnight') {
          const midnight = getMidnightClient();
          if (midnight.isConnected()) {
            try {
              const tx = await midnight.storeEncryptedMemory(
                commitment,
                userDid || 'anonymous',
                { proofHash, memoryHash, ...metadata }
              );
              
              response.midnight = {
                txId: tx.txId,
                status: tx.status,
                blockHeight: tx.blockHeight,
                confirmations: tx.confirmations,
                fees: tx.fees
              };
            } catch (error) {
              console.warn('[Anchor] Midnight anchor failed:', error);
            }
          }
        }

        // Try Cardano
        if (chain === 'both' || chain === 'cardano') {
          const cardano = getCardanoClient();
          if (cardano.isConnected()) {
            try {
              const tx = await cardano.anchorHash(proofHash, {
                label: 721721,
                content: {
                  type: 'whispercache_anchor',
                  version: '1.0.0',
                  proofHash,
                  memoryCommitment: commitment,
                  timestamp: Date.now()
                }
              });
              
              response.cardano = {
                txId: tx.txId,
                status: tx.status,
                blockHeight: tx.blockHeight,
                confirmations: tx.confirmations,
                fees: tx.fees,
                explorerUrl: tx.explorerUrl
              };
            } catch (error) {
              console.warn('[Anchor] Cardano anchor failed:', error);
            }
          }
        }
      }
    } catch (error) {
      console.warn('[Anchor] Simulated blockchain anchoring failed:', error);
    }

    const duration = Date.now() - startTime;
    console.log(`[Anchor] Completed in ${duration}ms (${anchorType})`);

    res.json(response);
  } catch (error) {
    console.error('[Anchor] Error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Anchoring failed'
    });
  }
});

/**
 * GET /api/anchor/logs
 * 
 * Get recent anchor logs from local database.
 */
router.get('/logs', optionalSimpleAuth(), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const logs = getRecentAnchorLogs(limit);
    const stats = getAnchorLogStats();
    
    res.json({
      success: true,
      count: logs.length,
      stats,
      logs: logs.map(log => ({
        ...log,
        gatewayUrl: log.ipfsCid ? `${IPFS_GATEWAY_URL}/${log.ipfsCid}` : undefined
      }))
    });
  } catch (error) {
    console.error('[Anchor] Error getting logs:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get anchor logs'
    });
  }
});

/**
 * GET /api/anchor/log/:proofHash
 * 
 * Get anchor log by proof hash.
 */
router.get('/log/:proofHash', optionalSimpleAuth(), async (req: Request, res: Response) => {
  try {
    const { proofHash } = req.params;
    const log = getAnchorLogByProofHash(proofHash);
    
    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Anchor log not found'
      });
    }
    
    res.json({
      success: true,
      log: {
        ...log,
        gatewayUrl: log.ipfsCid ? `${IPFS_GATEWAY_URL}/${log.ipfsCid}` : undefined
      }
    });
  } catch (error) {
    console.error('[Anchor] Error getting log:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get anchor log'
    });
  }
});

/**
 * POST /api/anchor/midnight
 * 
 * Anchor to Midnight only (privacy-preserving)
 * Requires authentication.
 */
router.post('/midnight', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { commitmentHash, proofHash, metadata } = req.body;
    const user = req.user!;

    if (!commitmentHash) {
      return res.status(400).json({
        success: false,
        message: 'commitmentHash is required'
      });
    }

    await ensureBlockchainsConnected();
    const midnight = getMidnightClient();

    if (!midnight.isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Midnight network not available'
      });
    }

    const tx = await midnight.storeEncryptedMemory(
      commitmentHash,
      user.didOrWallet,
      { proofHash, ...metadata }
    );

    // Store anchor in database
    const now = new Date().toISOString();
    insertAnchorTransaction({
      id: `anchor_${crypto.randomBytes(8).toString('hex')}`,
      userId: user.id,
      txHash: tx.txId,
      proofHash,
      commitment: commitmentHash,
      blockHeight: tx.blockHeight,
      status: tx.status,
      network: 'midnight',
      fees: tx.fees,
      createdAt: now
    });

    // Log to compliance
    const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
    const previousLogHash = getLatestLogHash();
    const logHash = await hashData(JSON.stringify({
      id: logId,
      action: 'anchor_midnight',
      userId: user.id,
      timestamp: now,
      previousLogHash
    }));

    insertComplianceLog({
      id: logId,
      userId: user.id,
      action: 'anchor_midnight',
      keyId: `key_${user.id.slice(0, 8)}`,
      timestamp: now,
      metadata: { txId: tx.txId, commitment: commitmentHash },
      previousLogHash,
      logHash
    });

    res.json({
      success: true,
      chain: 'midnight',
      txId: tx.txId,
      status: tx.status,
      blockHeight: tx.blockHeight,
      confirmations: tx.confirmations,
      fees: tx.fees,
      timestamp: now
    });
  } catch (error) {
    console.error('[Anchor/Midnight] Error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Midnight anchoring failed'
    });
  }
});

/**
 * POST /api/anchor/cardano
 * 
 * Anchor to Cardano only (public hash anchoring)
 * Requires authentication.
 */
router.post('/cardano', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { hash, proofHash, memoryCommitment, metadata } = req.body;
    const user = req.user!;
    
    const hashToAnchor = hash || proofHash;
    if (!hashToAnchor) {
      return res.status(400).json({
        success: false,
        message: 'hash or proofHash is required'
      });
    }

    await ensureBlockchainsConnected();
    const cardano = getCardanoClient();

    if (!cardano.isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Cardano network not available'
      });
    }

    const tx = await cardano.anchorHash(hashToAnchor, {
      label: 721721,  // Custom label for WhisperCache
      content: {
        type: 'whispercache_anchor',
        version: '1.0.0',
        proofHash: hashToAnchor,
        memoryCommitment: memoryCommitment || hashToAnchor,
        timestamp: Date.now(),
        userId: user.didOrWallet,
        ...metadata
      }
    });

    // Store anchor in database
    const now = new Date().toISOString();
    insertAnchorTransaction({
      id: `anchor_${crypto.randomBytes(8).toString('hex')}`,
      userId: user.id,
      txHash: tx.txId,
      proofHash: hashToAnchor,
      commitment: memoryCommitment,
      blockHeight: tx.blockHeight,
      status: tx.status,
      network: 'cardano',
      fees: tx.fees,
      createdAt: now
    });

    // Log to compliance
    const logId = `log_${crypto.randomBytes(8).toString('hex')}`;
    const previousLogHash = getLatestLogHash();
    const logHash = await hashData(JSON.stringify({
      id: logId,
      action: 'anchor_cardano',
      userId: user.id,
      timestamp: now,
      previousLogHash
    }));

    insertComplianceLog({
      id: logId,
      userId: user.id,
      action: 'anchor_cardano',
      keyId: `key_${user.id.slice(0, 8)}`,
      timestamp: now,
      metadata: { txId: tx.txId, hash: hashToAnchor },
      previousLogHash,
      logHash
    });

    res.json({
      success: true,
      chain: 'cardano',
      txId: tx.txId,
      status: tx.status,
      blockHeight: tx.blockHeight,
      confirmations: tx.confirmations,
      fees: tx.fees,
      explorerUrl: tx.explorerUrl,
      timestamp: now
    });
  } catch (error) {
    console.error('[Anchor/Cardano] Error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Cardano anchoring failed'
    });
  }
});

/**
 * GET /api/anchor/status
 * 
 * Gets blockchain network status
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await ensureBlockchainsConnected();
    
    res.json({
      ready: status.ready,
      midnight: status.midnight ? {
        connected: status.midnight.connected,
        network: status.midnight.network,
        latestBlock: status.midnight.latestBlock,
        syncProgress: status.midnight.syncProgress
      } : null,
      cardano: status.cardano ? {
        connected: status.cardano.connected,
        network: status.cardano.network,
        latestBlock: status.cardano.latestBlock,
        epoch: status.cardano.epoch,
        slot: status.cardano.slot,
        syncProgress: status.cardano.syncProgress
      } : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      ready: false,
      message: 'Failed to get blockchain status'
    });
  }
});

/**
 * GET /api/anchor/:txId
 * 
 * Gets the status of an anchor transaction
 */
router.get('/:txId', async (req: Request, res: Response) => {
  try {
    const { txId } = req.params;
    const { chain = 'auto' } = req.query;

    await ensureBlockchainsConnected();

    // Determine which chain to query based on txId prefix or query param
    let result: { exists: boolean; metadata?: unknown; blockHeight?: number; commitment?: string } | null = null;
    let chainUsed = '';

    // Check Midnight first (if txId starts with 'mid_')
    if (chain === 'auto' || chain === 'midnight') {
      if (txId.startsWith('mid_') || chain === 'midnight') {
        const midnight = getMidnightClient();
        if (midnight.isConnected()) {
          result = await midnight.verifyCommitment(txId);
          if (result.exists) chainUsed = 'midnight';
        }
      }
    }

    // Check Cardano if not found on Midnight
    if (!result?.exists && (chain === 'auto' || chain === 'cardano')) {
      const cardano = getCardanoClient();
      if (cardano.isConnected()) {
        result = await cardano.verifyAnchor(txId);
        if (result.exists) chainUsed = 'cardano';
      }
    }

    if (!result?.exists) {
      return res.status(404).json({
        exists: false,
        message: 'Anchor not found on any chain'
      });
    }

    res.json({
      exists: true,
      chain: chainUsed,
      blockHeight: result.blockHeight,
      metadata: result.metadata,
      commitment: result.commitment
    });
  } catch (error) {
    res.status(500).json({
      exists: false,
      message: 'Failed to verify anchor'
    });
  }
});

/**
 * POST /api/anchor/verify
 * 
 * Verifies an anchor exists on-chain
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { txId, chain = 'auto' } = req.body;
    
    if (!txId) {
      return res.status(400).json({
        verified: false,
        message: 'txId is required'
      });
    }

    await ensureBlockchainsConnected();

    const results: { midnight?: boolean; cardano?: boolean } = {};

    // Check Midnight
    if (chain === 'auto' || chain === 'midnight' || chain === 'both') {
      const midnight = getMidnightClient();
      if (midnight.isConnected()) {
        const result = await midnight.verifyCommitment(txId);
        results.midnight = result.exists;
      }
    }

    // Check Cardano
    if (chain === 'auto' || chain === 'cardano' || chain === 'both') {
      const cardano = getCardanoClient();
      if (cardano.isConnected()) {
        const result = await cardano.verifyAnchor(txId);
        results.cardano = result.exists;
      }
    }

    const verified = results.midnight || results.cardano || false;

    res.json({
      verified,
      chains: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      verified: false,
      message: 'Verification failed'
    });
  }
});

/**
 * GET /api/anchor/midnight/contract
 * 
 * Gets Midnight contract state
 */
router.get('/midnight/contract', async (_req: Request, res: Response) => {
  try {
    await ensureBlockchainsConnected();
    
    const midnight = getMidnightClient();
    if (!midnight.isConnected()) {
      return res.status(503).json({
        message: 'Midnight not connected'
      });
    }

    const state = await midnight.getContractState();
    res.json(state);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to get contract state'
    });
  }
});

/**
 * GET /api/anchor/cardano/wallet
 * 
 * Gets Cardano wallet info
 */
router.get('/cardano/wallet', async (_req: Request, res: Response) => {
  try {
    await ensureBlockchainsConnected();
    
    const cardano = getCardanoClient();
    if (!cardano.isConnected()) {
      return res.status(503).json({
        message: 'Cardano not connected'
      });
    }

    const wallet = await cardano.getWalletInfo();
    res.json(wallet);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to get wallet info'
    });
  }
});

export default router;
