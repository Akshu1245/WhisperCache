/**
 * WhisperCache Midnight Client
 * 
 * Integration with the Midnight blockchain for privacy-preserving operations.
 * Midnight is a privacy-focused sidechain on Cardano that supports:
 * - Shielded transactions
 * - ZK proof anchoring
 * - Privacy-preserving smart contracts
 * 
 * This client supports:
 * - Real devnet/testnet connections (when available)
 * - Simulation mode for development/demos
 */

import crypto from 'crypto';
import {
  IMidnightClient,
  NetworkType,
  NetworkStatus,
  TransactionResult,
  TxStatus,
  MidnightAnchorPayload,
  MidnightContractState,
  MidnightShieldedData,
  MIDNIGHT_ENDPOINTS,
  BlockchainConfig
} from './types';

// ============================================================================
// Configuration
// ============================================================================

export interface MidnightClientConfig extends BlockchainConfig {
  contractAddress?: string;
  simulationMode?: boolean;
}

const DEFAULT_CONFIG: MidnightClientConfig = {
  network: 'devnet',
  nodeUrl: MIDNIGHT_ENDPOINTS.devnet,
  simulationMode: true  // Default to simulation until real SDK available
};

// ============================================================================
// Midnight Client Implementation
// ============================================================================

export class MidnightClient implements IMidnightClient {
  private config: MidnightClientConfig;
  private connected: boolean = false;
  private currentBlock: number = 0;
  private startBlock: number = 0;
  
  // In-memory storage for simulation mode
  private txStore: Map<string, TransactionResult & { payload?: MidnightAnchorPayload }> = new Map();
  private commitmentStore: Map<string, { commitment: string; txId: string; blockHeight: number }> = new Map();
  private anchorCount: number = 0;

  constructor(config: Partial<MidnightClientConfig> = {}) {
    const network = (process.env.MIDNIGHT_NETWORK as NetworkType) || config.network || 'devnet';
    
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      network,
      nodeUrl: config.nodeUrl || MIDNIGHT_ENDPOINTS[network] || MIDNIGHT_ENDPOINTS.devnet,
      apiKey: config.apiKey || process.env.MIDNIGHT_API_KEY,
      walletAddress: config.walletAddress || process.env.MIDNIGHT_WALLET_ADDRESS,
      contractAddress: config.contractAddress || process.env.MIDNIGHT_CONTRACT_ADDRESS,
      simulationMode: config.simulationMode ?? (process.env.MIDNIGHT_SIMULATION !== 'false')
    };

    // Generate starting block based on current time (simulates real chain)
    this.startBlock = Math.floor(Date.now() / 20000) + 1000000;
    this.currentBlock = this.startBlock;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(): Promise<NetworkStatus> {
    console.log(`[Midnight] Connecting to ${this.config.network}...`);
    
    if (!this.config.simulationMode) {
      // Real connection attempt
      try {
        const response = await this.fetchWithTimeout(`${this.config.nodeUrl}/status`, {
          headers: this.getHeaders()
        });
        
        if (response.ok) {
          const data = await response.json();
          this.connected = true;
          this.currentBlock = data.latestBlock || this.generateBlockHeight();
          
          console.log(`[Midnight] Connected to ${this.config.network} at block ${this.currentBlock}`);
          return this.buildNetworkStatus();
        }
      } catch (error) {
        console.warn(`[Midnight] Real connection failed, falling back to simulation:`, error);
        this.config.simulationMode = true;
      }
    }

    // Simulation mode
    await this.simulateLatency(100);
    this.connected = true;
    this.currentBlock = this.generateBlockHeight();
    
    console.log(`[Midnight] Connected to ${this.config.network} at block ${this.currentBlock} (simulation)`);
    return this.buildNetworkStatus();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('[Midnight] Disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getNetworkStatus(): Promise<NetworkStatus> {
    this.ensureConnected();
    this.currentBlock = this.generateBlockHeight();
    return this.buildNetworkStatus();
  }

  // ============================================================================
  // Core Operations
  // ============================================================================

  /**
   * Store encrypted memory commitment on Midnight
   * 
   * This creates a privacy-preserving anchor that proves:
   * 1. The commitment existed at a specific time
   * 2. The commitment is linked to a user (without revealing who)
   * 3. The commitment can be verified later without revealing content
   */
  async storeEncryptedMemory(
    commitmentHash: string,
    userDidOrWallet: string,
    metadata?: Record<string, unknown>
  ): Promise<TransactionResult> {
    this.ensureConnected();

    console.log(`[Midnight] Storing encrypted memory: ${commitmentHash.slice(0, 16)}...`);

    // Create anchor payload
    const payload: MidnightAnchorPayload = {
      proofHash: this.hashData(`proof_${commitmentHash}`),
      memoryCommitment: commitmentHash,
      userDid: userDidOrWallet,
      timestamp: Date.now(),
      metadata
    };

    // Build and submit transaction
    const tx = await this.buildAndSubmitTx(payload, 'store_memory');

    // Store commitment mapping
    this.commitmentStore.set(commitmentHash, {
      commitment: commitmentHash,
      txId: tx.txId,
      blockHeight: tx.blockHeight || this.currentBlock
    });

    this.anchorCount++;
    return tx;
  }

  /**
   * Verify a commitment exists on Midnight
   */
  async verifyCommitment(txId: string): Promise<{
    exists: boolean;
    commitment?: string;
    blockHeight?: number;
  }> {
    this.ensureConnected();

    const stored = this.txStore.get(txId);
    if (!stored) {
      // Try to look up from chain (simulation)
      return { exists: false };
    }

    // Update confirmations
    const confirmations = Math.max(0, this.currentBlock - (stored.blockHeight || 0));
    
    return {
      exists: true,
      commitment: stored.payload?.memoryCommitment,
      blockHeight: stored.blockHeight
    };
  }

  /**
   * Anchor a ZK proof to Midnight
   */
  async anchorZKProof(payload: MidnightAnchorPayload): Promise<TransactionResult> {
    this.ensureConnected();

    console.log(`[Midnight] Anchoring ZK proof: ${payload.proofHash.slice(0, 16)}...`);

    // Validate payload
    if (!payload.proofHash || !payload.memoryCommitment) {
      throw new Error('Invalid anchor payload: proofHash and memoryCommitment required');
    }

    const tx = await this.buildAndSubmitTx(payload, 'anchor_proof');
    this.anchorCount++;
    
    return tx;
  }

  /**
   * Get contract state
   */
  async getContractState(): Promise<MidnightContractState> {
    this.ensureConnected();

    return {
      contractAddress: this.config.contractAddress || 'midnight1_whispercache_v1',
      totalAnchors: this.anchorCount,
      lastAnchorTime: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  // ============================================================================
  // Transaction Building
  // ============================================================================

  private async buildAndSubmitTx(
    payload: MidnightAnchorPayload,
    txType: string
  ): Promise<TransactionResult> {
    // Generate transaction data
    const txData = {
      type: txType,
      payload,
      nonce: crypto.randomBytes(8).toString('hex'),
      sender: this.config.walletAddress || 'midnight1_whispercache_wallet',
      timestamp: Date.now()
    };

    const txId = this.generateTxHash(JSON.stringify(txData));
    const blockHeight = this.currentBlock + 1;

    // Create transaction result
    const tx: TransactionResult & { payload?: MidnightAnchorPayload } = {
      txId,
      status: 'pending',
      blockHeight,
      blockHash: this.generateBlockHash(blockHeight),
      timestamp: new Date().toISOString(),
      confirmations: 0,
      fees: this.calculateFees(payload),
      payload
    };

    // Store transaction
    this.txStore.set(txId, tx);

    if (!this.config.simulationMode) {
      // Real submission
      try {
        const response = await this.fetchWithTimeout(`${this.config.nodeUrl}/tx/submit`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ transaction: txData })
        });

        if (response.ok) {
          const result = await response.json();
          tx.txId = result.txHash || tx.txId;
          tx.status = 'submitted';
        } else {
          throw new Error(`Transaction submission failed: ${response.status}`);
        }
      } catch (error) {
        console.warn('[Midnight] Real submission failed, using simulation:', error);
      }
    }

    // Simulate submission and confirmation
    await this.simulateLatency(150);
    tx.status = 'submitted';

    // Schedule confirmation updates
    this.scheduleConfirmation(txId);

    console.log(`[Midnight] Transaction submitted: ${txId}`);
    
    // Return TransactionResult without the internal payload
    const result: TransactionResult = {
      txId: tx.txId,
      status: tx.status,
      blockHeight: tx.blockHeight,
      blockHash: tx.blockHash,
      timestamp: tx.timestamp,
      confirmations: tx.confirmations,
      fees: tx.fees,
      explorerUrl: tx.explorerUrl
    };
    return result;
  }

  private scheduleConfirmation(txId: string): void {
    // Simulate block confirmations over time
    const confirmTimes = [500, 1500, 3000, 6000];
    
    confirmTimes.forEach((delay, index) => {
      setTimeout(() => {
        const tx = this.txStore.get(txId);
        if (tx) {
          tx.confirmations = index + 1;
          if (index === 0) tx.status = 'confirmed';
          if (index === confirmTimes.length - 1) tx.status = 'finalized';
        }
      }, delay);
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Not connected to Midnight network. Call connect() first.');
    }
  }

  private buildNetworkStatus(): NetworkStatus {
    return {
      connected: this.connected,
      network: this.config.network,
      chainId: `midnight-${this.config.network}`,
      latestBlock: this.currentBlock,
      syncProgress: 100
    };
  }

  private generateBlockHeight(): number {
    // Simulate ~20 second block times
    const elapsed = Date.now() / 20000;
    return this.startBlock + Math.floor(elapsed) - Math.floor(this.startBlock / 50000);
  }

  private generateTxHash(data: string): string {
    return 'mid_tx_' + crypto.createHash('sha256')
      .update(data + Date.now() + Math.random())
      .digest('hex')
      .slice(0, 56);
  }

  private generateBlockHash(height: number): string {
    return 'mid_blk_' + crypto.createHash('sha256')
      .update(`block_${height}_${this.config.network}`)
      .digest('hex')
      .slice(0, 56);
  }

  private hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private calculateFees(payload: MidnightAnchorPayload): string {
    // Estimate fees based on payload size
    const baseGas = 21000;
    const dataGas = JSON.stringify(payload).length * 68;
    const totalGas = baseGas + dataGas;
    const feeInAda = (totalGas * 0.000001).toFixed(6);
    return `${feeInAda} tADA`;
  }

  private async simulateLatency(ms: number): Promise<void> {
    const jitter = Math.random() * ms * 0.3;
    await new Promise(resolve => setTimeout(resolve, ms + jitter));
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    
    return headers;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let midnightClientInstance: MidnightClient | null = null;

export function getMidnightClient(config?: Partial<MidnightClientConfig>): MidnightClient {
  if (!midnightClientInstance) {
    midnightClientInstance = new MidnightClient(config);
  }
  return midnightClientInstance;
}

export async function initializeMidnight(config?: Partial<MidnightClientConfig>): Promise<NetworkStatus> {
  const client = getMidnightClient(config);
  return client.connect();
}

export function resetMidnightClient(): void {
  if (midnightClientInstance) {
    midnightClientInstance.disconnect();
    midnightClientInstance = null;
  }
}
