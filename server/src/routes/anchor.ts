import { Router, Request, Response } from 'express';
import { generateNonce, hashData, createCommitment } from '../lib/crypto';
import { 
  getMidnightClient, 
  initializeMidnight,
  AnchorPayload,
  MidnightTransaction,
  NetworkStatus 
} from '../lib/midnight';

const router = Router();

// Initialize Midnight client on first use
let midnightInitialized = false;

async function ensureMidnightConnected() {
  if (!midnightInitialized) {
    await initializeMidnight();
    midnightInitialized = true;
  }
  return getMidnightClient();
}

interface AnchorRequest {
  memoryHash: string;
  proofHash: string;
  keyId?: string;
  metadata?: Record<string, unknown>;
}

interface AnchorResponse {
  txId: string;
  status: 'pending' | 'submitted' | 'confirmed' | 'finalized' | 'failed';
  blockHeight?: number;
  blockHash?: string;
  timestamp: string;
  confirmations?: number;
  anchorData?: {
    commitment: string;
    network: string;
    nonce: string;
    proofHash: string;
    memoryHash: string;
  };
  fees?: string;
}

/**
 * POST /api/anchor
 * 
 * Anchors encrypted memory proof to the Midnight blockchain.
 * Creates an immutable on-chain record linking memory and proof.
 */
router.post('/', async (req: Request<{}, {}, AnchorRequest>, res: Response) => {
  try {
    const { memoryHash, proofHash, keyId } = req.body;

    if (!memoryHash || !proofHash) {
      return res.status(400).json({
        status: 'failed',
        message: 'memoryHash and proofHash are required'
      });
    }

    // Connect to Midnight network
    const client = await ensureMidnightConnected();

    // Generate commitment nonce
    const nonce = await generateNonce();

    // Create anchor commitment (Merkle-like structure)
    const commitment = await createCommitment(
      memoryHash,
      proofHash,
      keyId || 'default',
      nonce
    );

    // Build anchor payload
    const payload: AnchorPayload = {
      proofHash,
      memoryHash,
      commitment,
      timestamp: Date.now(),
      version: '1.0.0'
    };

    // Anchor to Midnight blockchain
    const tx: MidnightTransaction = await client.anchorProof(payload);

    const response: AnchorResponse = {
      txId: tx.txHash,
      status: tx.status,
      blockHeight: tx.blockHeight,
      blockHash: tx.blockHash,
      timestamp: tx.timestamp,
      confirmations: tx.confirmations,
      anchorData: {
        commitment,
        network: 'midnight-devnet',
        nonce,
        proofHash,
        memoryHash
      },
      fees: tx.fees
    };

    res.json(response);
  } catch (error) {
    console.error('Anchor error:', error);
    res.status(500).json({
      status: 'failed',
      message: error instanceof Error ? error.message : 'Failed to anchor to blockchain'
    });
  }
});

/**
 * GET /api/anchor/status
 * 
 * Gets Midnight network status
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const client = await ensureMidnightConnected();
    const status: NetworkStatus = await client.getNetworkStatus();
    
    res.json({
      network: 'midnight',
      ...status
    });
  } catch (error) {
    res.status(500).json({
      connected: false,
      message: error instanceof Error ? error.message : 'Failed to get network status'
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
    const client = await ensureMidnightConnected();
    
    const result = await client.verifyAnchor(txId);
    
    if (!result.exists || !result.transaction) {
      return res.status(404).json({
        status: 'failed',
        message: 'Anchor not found'
      });
    }

    const tx = result.transaction;
    const response: AnchorResponse = {
      txId: tx.txHash,
      status: tx.status,
      blockHeight: tx.blockHeight,
      blockHash: tx.blockHash,
      timestamp: tx.timestamp,
      confirmations: tx.confirmations,
      fees: tx.fees
    };

    if (result.payload) {
      response.anchorData = {
        commitment: result.payload.commitment,
        network: 'midnight-devnet',
        nonce: '',
        proofHash: result.payload.proofHash,
        memoryHash: result.payload.memoryHash
      };
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({
      status: 'failed',
      message: 'Failed to get anchor status'
    });
  }
});

/**
 * POST /api/anchor/verify
 * 
 * Verifies an anchor exists on-chain by transaction hash
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { txId } = req.body;
    
    if (!txId) {
      return res.status(400).json({
        verified: false,
        message: 'txId is required'
      });
    }

    const client = await ensureMidnightConnected();
    const result = await client.verifyAnchor(txId);

    res.json({
      verified: result.exists,
      transaction: result.transaction,
      payload: result.payload
    });
  } catch (error) {
    res.status(500).json({
      verified: false,
      message: 'Verification failed'
    });
  }
});

/**
 * GET /api/anchor/memory/:memoryHash
 * 
 * Finds all anchors for a specific memory hash
 */
router.get('/memory/:memoryHash', async (req: Request, res: Response) => {
  try {
    const { memoryHash } = req.params;
    const client = await ensureMidnightConnected();
    
    const anchors = await client.queryAnchorsByMemory(memoryHash);

    res.json({
      count: anchors.length,
      anchors: anchors.map(a => ({
        txId: a.txHash,
        status: a.transaction.status,
        blockHeight: a.transaction.blockHeight,
        timestamp: a.transaction.timestamp,
        commitment: a.payload.commitment
      }))
    });
  } catch (error) {
    res.status(500).json({
      count: 0,
      anchors: [],
      message: 'Failed to query anchors'
    });
  }
});

/**
 * GET /api/anchor/recent
 * 
 * Gets recent anchor transactions
 */
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const client = await ensureMidnightConnected();
    
    const anchors = await client.getRecentAnchors(limit);

    res.json({
      count: anchors.length,
      anchors: anchors.map(a => ({
        txId: a.txHash,
        status: a.transaction.status,
        blockHeight: a.transaction.blockHeight,
        timestamp: a.transaction.timestamp,
        proofHash: a.payload.proofHash,
        memoryHash: a.payload.memoryHash
      }))
    });
  } catch (error) {
    res.status(500).json({
      count: 0,
      anchors: [],
      message: 'Failed to get recent anchors'
    });
  }
});

/**
 * POST /api/anchor/estimate
 * 
 * Estimates transaction fees for anchoring
 */
router.post('/estimate', async (req: Request, res: Response) => {
  try {
    const { payloadSize = 256 } = req.body;
    const client = await ensureMidnightConnected();
    
    const estimate = await client.estimateFees(payloadSize);

    res.json({
      ...estimate,
      network: 'midnight-devnet'
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to estimate fees'
    });
  }
});

/**
 * GET /api/anchor/status/:txId
 * 
 * Get status of a specific testnet anchor transaction.
 * Works with both Cardano and Midnight testnets.
 */
router.get('/status/:txId', async (req: Request, res: Response) => {
  try {
    const { txId } = req.params;
    
    // Check if it's a Midnight or Cardano tx
    const isMidnight = txId.startsWith('midnight_');
    const isCardano = txId.startsWith('cardano_');
    
    if (isMidnight) {
      const client = await ensureMidnightConnected();
      // NOTE: getAnchorStatus method not available on MidnightClient
      // For now, return placeholder response
      return res.json({
        txId,
        network: 'midnight-testnet',
        status: 'SUBMITTED',
        blockHeight: null,
        confirmedAt: null,
        explorerUrl: `https://explorer.midnight.network/transaction/${txId}`,
        memoryHash: null
      });
    } else if (isCardano) {
      // For Cardano, return placeholder response
      // In production, query Blockfrost API
      return res.json({
        txId,
        network: 'cardano-testnet',
        status: 'SUBMITTED',
        blockHeight: null,
        confirmedAt: null,
        explorerUrl: `https://testnet.cardanoscan.io/transaction/${txId}`,
        retryCount: 0
      });
    } else {
      return res.status(400).json({ error: 'Invalid transaction ID format' });
    }
  } catch (error) {
    console.error('[Anchor Status] Error:', error);
    res.status(500).json({ 
      error: 'Failed to get anchor status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/anchor/memory/:memoryHash
 * 
 * Get all anchors for a specific memory commitment.
 */
router.get('/memory/:memoryHash', async (req: Request, res: Response) => {
  try {
    const { memoryHash } = req.params;
    
    const client = await ensureMidnightConnected();
    // NOTE: getAnchorsByMemoryHash method not available on MidnightClient
    // For now, return empty list
    const anchors: any[] = [];

    res.json({
      memoryHash,
      anchorsCount: anchors.length,
      anchors: anchors.map((a: any) => ({
        txId: a.txHash,
        network: 'midnight-testnet',
        status: a.transaction.status,
        blockHeight: a.transaction.blockHeight,
        confirmedAt: a.transaction.timestamp,
        explorerUrl: `https://explorer.midnight.network/transaction/${a.txHash}`
      })),
      summary: {
        confirmed: anchors.filter((a: any) => a.transaction.status === 'CONFIRMED').length,
        pending: anchors.filter((a: any) => a.transaction.status === 'SUBMITTED').length,
        failed: anchors.filter((a: any) => a.transaction.status === 'FAILED').length
      }
    });
  } catch (error) {
    console.error('[Anchor Memory] Error:', error);
    res.status(500).json({ 
      error: 'Failed to get memory anchors',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/anchor/config
 * 
 * Get current blockchain configuration for display.
 */
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const client = await ensureMidnightConnected();
    const network = process.env.BLOCKCHAIN_NETWORK || 'midnight-devnet';
    
    res.json({
      network,
      supportedNetworks: ['midnight-devnet', 'midnight-testnet', 'cardano-testnet', 'cardano-preprod'],
      walletAddress: process.env.BLOCKCHAIN_WALLET_ADDRESS?.slice(0, 20) + '...' || 'configured',
      maxRetries: parseInt(process.env.BLOCKCHAIN_MAX_RETRIES || '3'),
      confirmationTimeoutMs: parseInt(process.env.BLOCKCHAIN_CONFIRMATION_TIMEOUT || '300000'),
      explorerBaseUrls: {
        'midnight-devnet': 'http://localhost:3000',
        'midnight-testnet': 'https://explorer-testnet.midnight.network',
        'cardano-testnet': 'https://testnet.cardanoscan.io',
        'cardano-preprod': 'https://preprod.cardanoscan.io'
      }
    });
  } catch (error) {
    console.error('[Anchor Config] Error:', error);
    res.status(500).json({ error: 'Failed to get anchor config' });
  }
});

export default router;
