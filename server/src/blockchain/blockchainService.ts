/**
 * WhisperCache Production Blockchain Service
 * 
 * A production-ready wrapper around blockchain clients with:
 * - Automatic retry with exponential backoff
 * - Circuit breaker pattern for fault tolerance
 * - Health monitoring and alerting
 * - Transaction batching
 * - Multi-chain failover
 */

import { EventEmitter } from 'events';
import { 
  getMidnightClient, 
  getCardanoClient,
  TransactionResult,
  NetworkStatus,
  MidnightAnchorPayload,
  CardanoAnchorPayload
} from './index';

// ============================================================================
// Types
// ============================================================================

export enum ChainPriority {
  MIDNIGHT_FIRST = 'midnight-first',
  CARDANO_FIRST = 'cardano-first',
  PARALLEL = 'parallel',
  MIDNIGHT_ONLY = 'midnight-only',
  CARDANO_ONLY = 'cardano-only'
}

export interface BlockchainServiceConfig {
  chainPriority: ChainPriority;
  maxRetries: number;
  retryDelayMs: number;
  retryMultiplier: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
  healthCheckIntervalMs: number;
  enableBatching: boolean;
  batchSize: number;
  batchTimeoutMs: number;
}

export interface AnchorRequest {
  id: string;
  hash: string;
  metadata?: Record<string, unknown>;
  priority: 'high' | 'normal' | 'low';
  createdAt: number;
  resolve: (result: AnchorResult) => void;
  reject: (error: Error) => void;
}

export interface AnchorResult {
  success: boolean;
  chain: 'midnight' | 'cardano' | 'both';
  midnightTx?: TransactionResult;
  cardanoTx?: TransactionResult;
  error?: string;
  retryCount: number;
  totalTimeMs: number;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  successCount: number;
}

export interface HealthMetrics {
  midnight: {
    connected: boolean;
    latency: number;
    successRate: number;
    circuitOpen: boolean;
  };
  cardano: {
    connected: boolean;
    latency: number;
    successRate: number;
    circuitOpen: boolean;
  };
  pendingAnchors: number;
  totalAnchored: number;
  failedAnchors: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: BlockchainServiceConfig = {
  chainPriority: ChainPriority.MIDNIGHT_FIRST,
  maxRetries: 3,
  retryDelayMs: 1000,
  retryMultiplier: 2,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 60000,
  healthCheckIntervalMs: 30000,
  enableBatching: true,
  batchSize: 10,
  batchTimeoutMs: 5000
};

// ============================================================================
// Production Blockchain Service
// ============================================================================

export class BlockchainService extends EventEmitter {
  private config: BlockchainServiceConfig;
  private midnightCircuit: CircuitBreakerState;
  private cardanoCircuit: CircuitBreakerState;
  private batchQueue: AnchorRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metrics: {
    totalSuccess: number;
    totalFailed: number;
    midnightLatencies: number[];
    cardanoLatencies: number[];
  };
  private isShuttingDown = false;

  constructor(config: Partial<BlockchainServiceConfig> = {}) {
    super();
    
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.midnightCircuit = {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
      successCount: 0
    };
    
    this.cardanoCircuit = {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
      successCount: 0
    };

    this.metrics = {
      totalSuccess: 0,
      totalFailed: 0,
      midnightLatencies: [],
      cardanoLatencies: []
    };
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<void> {
    console.log('[BlockchainService] Initializing production blockchain service...');
    
    // Connect to chains
    const midnight = getMidnightClient();
    const cardano = getCardanoClient();

    try {
      await midnight.connect();
      console.log('[BlockchainService] Midnight connected');
    } catch (error) {
      console.warn('[BlockchainService] Midnight connection failed:', error);
    }

    try {
      await cardano.connect();
      console.log('[BlockchainService] Cardano connected');
    } catch (error) {
      console.warn('[BlockchainService] Cardano connection failed:', error);
    }

    // Start health check
    if (this.config.healthCheckIntervalMs > 0) {
      this.startHealthCheck();
    }

    console.log('[BlockchainService] Initialized with priority:', this.config.chainPriority);
  }

  async shutdown(): Promise<void> {
    console.log('[BlockchainService] Shutting down...');
    this.isShuttingDown = true;

    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Flush batch queue
    if (this.batchQueue.length > 0) {
      console.log(`[BlockchainService] Flushing ${this.batchQueue.length} pending anchors...`);
      await this.flushBatch();
    }

    // Disconnect
    const midnight = getMidnightClient();
    const cardano = getCardanoClient();

    await midnight.disconnect();
    await cardano.disconnect();

    console.log('[BlockchainService] Shutdown complete');
  }

  // ============================================================================
  // Anchor Operations
  // ============================================================================

  /**
   * Anchor a hash to the blockchain with production-ready error handling
   */
  async anchor(
    hash: string,
    options: {
      metadata?: Record<string, unknown>;
      priority?: 'high' | 'normal' | 'low';
      skipBatch?: boolean;
    } = {}
  ): Promise<AnchorResult> {
    const { metadata, priority = 'normal', skipBatch = false } = options;

    // High priority bypasses batching
    if (priority === 'high' || skipBatch || !this.config.enableBatching) {
      return this.anchorDirect(hash, metadata);
    }

    // Add to batch queue
    return new Promise((resolve, reject) => {
      const request: AnchorRequest = {
        id: `anchor_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        hash,
        metadata,
        priority,
        createdAt: Date.now(),
        resolve,
        reject
      };

      this.batchQueue.push(request);
      this.scheduleBatchFlush();
    });
  }

  /**
   * Direct anchor without batching
   */
  private async anchorDirect(
    hash: string,
    metadata?: Record<string, unknown>
  ): Promise<AnchorResult> {
    const startTime = Date.now();
    let retryCount = 0;

    const result: AnchorResult = {
      success: false,
      chain: 'midnight',
      retryCount: 0,
      totalTimeMs: 0
    };

    try {
      switch (this.config.chainPriority) {
        case ChainPriority.MIDNIGHT_FIRST:
          result.midnightTx = await this.anchorWithRetry('midnight', hash, metadata);
          result.chain = 'midnight';
          result.success = true;
          break;

        case ChainPriority.CARDANO_FIRST:
          result.cardanoTx = await this.anchorWithRetry('cardano', hash, metadata);
          result.chain = 'cardano';
          result.success = true;
          break;

        case ChainPriority.PARALLEL:
          const [midnightResult, cardanoResult] = await Promise.allSettled([
            this.anchorWithRetry('midnight', hash, metadata),
            this.anchorWithRetry('cardano', hash, metadata)
          ]);

          if (midnightResult.status === 'fulfilled') {
            result.midnightTx = midnightResult.value;
          }
          if (cardanoResult.status === 'fulfilled') {
            result.cardanoTx = cardanoResult.value;
          }

          result.success = result.midnightTx !== undefined || result.cardanoTx !== undefined;
          result.chain = result.midnightTx && result.cardanoTx ? 'both' : 
                         result.midnightTx ? 'midnight' : 'cardano';
          break;

        case ChainPriority.MIDNIGHT_ONLY:
          result.midnightTx = await this.anchorWithRetry('midnight', hash, metadata);
          result.chain = 'midnight';
          result.success = true;
          break;

        case ChainPriority.CARDANO_ONLY:
          result.cardanoTx = await this.anchorWithRetry('cardano', hash, metadata);
          result.chain = 'cardano';
          result.success = true;
          break;
      }

      this.metrics.totalSuccess++;
      this.emit('anchor:success', { hash, result });

    } catch (error: any) {
      result.success = false;
      result.error = error.message;
      this.metrics.totalFailed++;
      this.emit('anchor:failed', { hash, error });
    }

    result.totalTimeMs = Date.now() - startTime;
    return result;
  }

  /**
   * Anchor with retry and circuit breaker
   */
  private async anchorWithRetry(
    chain: 'midnight' | 'cardano',
    hash: string,
    metadata?: Record<string, unknown>
  ): Promise<TransactionResult> {
    const circuit = chain === 'midnight' ? this.midnightCircuit : this.cardanoCircuit;

    // Check circuit breaker
    if (circuit.isOpen) {
      if (Date.now() - circuit.lastFailure < this.config.circuitBreakerResetMs) {
        throw new Error(`${chain} circuit breaker is open`);
      }
      // Try to reset (half-open state)
      circuit.isOpen = false;
      circuit.failures = 0;
    }

    let lastError: Error | null = null;
    let delay = this.config.retryDelayMs;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        let result: TransactionResult;

        if (chain === 'midnight') {
          const client = getMidnightClient();
          result = await client.anchorZKProof({
            proofHash: hash,
            memoryCommitment: hash,
            timestamp: Date.now(),
            metadata
          });
          this.recordLatency('midnight', Date.now() - startTime);
        } else {
          const client = getCardanoClient();
          result = await client.anchorHash(hash, metadata as any);
          this.recordLatency('cardano', Date.now() - startTime);
        }

        // Success - reset circuit breaker
        circuit.failures = 0;
        circuit.successCount++;

        return result;

      } catch (error: any) {
        lastError = error;
        console.warn(`[BlockchainService] ${chain} anchor attempt ${attempt + 1} failed:`, error.message);

        if (attempt < this.config.maxRetries) {
          await this.sleep(delay);
          delay *= this.config.retryMultiplier;
        }
      }
    }

    // All retries failed - update circuit breaker
    circuit.failures++;
    circuit.lastFailure = Date.now();
    
    if (circuit.failures >= this.config.circuitBreakerThreshold) {
      circuit.isOpen = true;
      console.error(`[BlockchainService] ${chain} circuit breaker opened after ${circuit.failures} failures`);
      this.emit('circuit:open', { chain });
    }

    throw lastError || new Error(`${chain} anchor failed after ${this.config.maxRetries} retries`);
  }

  // ============================================================================
  // Batch Processing
  // ============================================================================

  private scheduleBatchFlush(): void {
    if (this.batchTimer) return;

    // Check if batch is full
    if (this.batchQueue.length >= this.config.batchSize) {
      this.flushBatch();
      return;
    }

    // Schedule timeout-based flush
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      this.flushBatch();
    }, this.config.batchTimeoutMs);
  }

  private async flushBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const batch = this.batchQueue.splice(0, this.config.batchSize);
    if (batch.length === 0) return;

    console.log(`[BlockchainService] Processing batch of ${batch.length} anchors`);

    // Process batch in parallel
    await Promise.all(
      batch.map(async (request) => {
        try {
          const result = await this.anchorDirect(request.hash, request.metadata);
          request.resolve(result);
        } catch (error: any) {
          request.reject(error);
        }
      })
    );

    // Continue processing if more in queue
    if (this.batchQueue.length > 0) {
      this.scheduleBatchFlush();
    }
  }

  // ============================================================================
  // Health Monitoring
  // ============================================================================

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.getHealth();
      this.emit('health', health);

      // Alert on issues
      if (!health.midnight.connected && !health.cardano.connected) {
        this.emit('alert:critical', { message: 'All blockchains disconnected' });
      }

      if (health.midnight.circuitOpen || health.cardano.circuitOpen) {
        this.emit('alert:warning', { 
          message: 'Circuit breaker open',
          chains: {
            midnight: health.midnight.circuitOpen,
            cardano: health.cardano.circuitOpen
          }
        });
      }
    }, this.config.healthCheckIntervalMs);
  }

  async getHealth(): Promise<HealthMetrics> {
    const midnight = getMidnightClient();
    const cardano = getCardanoClient();

    const midnightLatency = this.calculateAverageLatency(this.metrics.midnightLatencies);
    const cardanoLatency = this.calculateAverageLatency(this.metrics.cardanoLatencies);

    const totalOps = this.metrics.totalSuccess + this.metrics.totalFailed;

    return {
      midnight: {
        connected: midnight.isConnected(),
        latency: midnightLatency,
        successRate: totalOps > 0 ? (this.metrics.totalSuccess / totalOps) * 100 : 100,
        circuitOpen: this.midnightCircuit.isOpen
      },
      cardano: {
        connected: cardano.isConnected(),
        latency: cardanoLatency,
        successRate: totalOps > 0 ? (this.metrics.totalSuccess / totalOps) * 100 : 100,
        circuitOpen: this.cardanoCircuit.isOpen
      },
      pendingAnchors: this.batchQueue.length,
      totalAnchored: this.metrics.totalSuccess,
      failedAnchors: this.metrics.totalFailed
    };
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private recordLatency(chain: 'midnight' | 'cardano', latency: number): void {
    const latencies = chain === 'midnight' 
      ? this.metrics.midnightLatencies 
      : this.metrics.cardanoLatencies;

    latencies.push(latency);
    
    // Keep only last 100 measurements
    if (latencies.length > 100) {
      latencies.shift();
    }
  }

  private calculateAverageLatency(latencies: number[]): number {
    if (latencies.length === 0) return 0;
    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  setChainPriority(priority: ChainPriority): void {
    this.config.chainPriority = priority;
    console.log(`[BlockchainService] Chain priority changed to: ${priority}`);
  }

  getConfig(): Readonly<BlockchainServiceConfig> {
    return { ...this.config };
  }

  resetCircuitBreakers(): void {
    this.midnightCircuit = {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
      successCount: 0
    };
    this.cardanoCircuit = {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
      successCount: 0
    };
    console.log('[BlockchainService] Circuit breakers reset');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let blockchainService: BlockchainService | null = null;

export function getBlockchainService(config?: Partial<BlockchainServiceConfig>): BlockchainService {
  if (!blockchainService) {
    blockchainService = new BlockchainService(config);
  }
  return blockchainService;
}

export async function initializeBlockchainService(
  config?: Partial<BlockchainServiceConfig>
): Promise<BlockchainService> {
  const service = getBlockchainService(config);
  await service.initialize();
  return service;
}

export function resetBlockchainService(): void {
  if (blockchainService) {
    blockchainService.shutdown().catch(console.error);
    blockchainService = null;
  }
}
