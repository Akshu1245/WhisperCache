/**
 * WhisperCache ZK Precompute Worker
 * 
 * Background worker for precomputing ZK proofs to reduce latency.
 * 
 * Features:
 * - Predictive precomputation based on access patterns
 * - Memory-based proof warming
 * - Scheduled batch processing
 * - Priority queue management
 * - Metrics and monitoring
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { getProofQueue, ProofQueue, ProofResult, PatternFlags as ProofQueuePatternFlags } from './proofQueue';

// Re-export PatternFlags for external use
export type PatternFlags = ProofQueuePatternFlags;
import { 
  generateProofV2, 
  MemoryStatus, 
  ProveInputV2 
} from './memoryPatternProverV2';
import { 
  getMemoryMetadata, 
  getMemoriesByUserId, 
  getCurrentKeyVersion, 
  getMinKeyVersion 
} from '../lib/database';

// ============================================================================
// Types
// ============================================================================

export interface PrecomputeConfig {
  /** Enable background precomputation */
  enabled: boolean;
  /** Interval between precompute batches (ms) */
  batchIntervalMs: number;
  /** Maximum proofs to precompute per batch */
  batchSize: number;
  /** Precompute proofs for memories accessed within this window (ms) */
  recentAccessWindowMs: number;
  /** Priority threshold for precomputation */
  minPriority: number;
  /** Maximum memory age for precomputation (ms) */
  maxMemoryAgeMs: number;
  /** Cache precomputed proofs for this duration (seconds) */
  cacheDurationSeconds: number;
}

export interface PrecomputeJob {
  id: string;
  memoryId: string;
  userId: string;
  memoryCommitment: string;
  pattern: PatternFlags;
  priority: number;
  createdAt: number;
  scheduledFor: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: PrecomputeResult;
  error?: string;
}

export interface PrecomputeResult {
  proofHash: string;
  generationTimeMs: number;
  allowedForAgent: boolean;
  cachedUntil: number;
}

export interface AccessPattern {
  memoryId: string;
  userId: string;
  accessCount: number;
  lastAccessAt: number;
  patterns: PatternFlags[];
}

export interface WorkerMetrics {
  totalPrecomputed: number;
  cacheHits: number;
  cacheMisses: number;
  averageGenerationTimeMs: number;
  queueSize: number;
  isRunning: boolean;
  lastBatchAt: number;
  accessPatterns: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: PrecomputeConfig = {
  enabled: true,
  batchIntervalMs: 60000, // 1 minute
  batchSize: 10,
  recentAccessWindowMs: 3600000, // 1 hour
  minPriority: 2,
  maxMemoryAgeMs: 86400000 * 30, // 30 days
  cacheDurationSeconds: 600 // 10 minutes
};

// ============================================================================
// Access Pattern Tracker
// ============================================================================

class AccessPatternTracker {
  private patterns: Map<string, AccessPattern> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private maxAge: number;

  constructor(maxAge: number = 86400000) {
    this.maxAge = maxAge;
    this.startCleanup();
  }

  recordAccess(memoryId: string, userId: string, pattern: PatternFlags): void {
    const key = `${userId}:${memoryId}`;
    const existing = this.patterns.get(key);

    if (existing) {
      existing.accessCount++;
      existing.lastAccessAt = Date.now();
      // Add unique patterns
      const patternKey = JSON.stringify(pattern);
      if (!existing.patterns.some(p => JSON.stringify(p) === patternKey)) {
        existing.patterns.push(pattern);
      }
    } else {
      this.patterns.set(key, {
        memoryId,
        userId,
        accessCount: 1,
        lastAccessAt: Date.now(),
        patterns: [pattern]
      });
    }
  }

  getHotMemories(windowMs: number, limit: number = 50): AccessPattern[] {
    const cutoff = Date.now() - windowMs;
    
    return Array.from(this.patterns.values())
      .filter(p => p.lastAccessAt >= cutoff)
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  getPredictedPatterns(memoryId: string, userId: string): PatternFlags[] {
    const key = `${userId}:${memoryId}`;
    const pattern = this.patterns.get(key);
    return pattern?.patterns || [];
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - this.maxAge;
      for (const [key, pattern] of this.patterns) {
        if (pattern.lastAccessAt < cutoff) {
          this.patterns.delete(key);
        }
      }
    }, 3600000); // Every hour
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  getStats(): { totalPatterns: number; recentPatterns: number } {
    const recent = Date.now() - 3600000;
    return {
      totalPatterns: this.patterns.size,
      recentPatterns: Array.from(this.patterns.values())
        .filter(p => p.lastAccessAt >= recent).length
    };
  }
}

// ============================================================================
// Precompute Cache
// ============================================================================

interface PrecomputeCacheEntry {
  proofHash: string;
  result: any;
  expiresAt: number;
}

class PrecomputeCache {
  private cache: Map<string, PrecomputeCacheEntry> = new Map();

  generateKey(memoryCommitment: string, pattern: PatternFlags): string {
    return crypto.createHash('sha256')
      .update(`precompute:${memoryCommitment}:${JSON.stringify(pattern)}`)
      .digest('hex');
  }

  get(key: string): PrecomputeCacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, proofHash: string, result: any, ttlSeconds: number): void {
    this.cache.set(key, {
      proofHash,
      result,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// ZK Precompute Worker
// ============================================================================

export class ZKPrecomputeWorker extends EventEmitter {
  private config: PrecomputeConfig;
  private tracker: AccessPatternTracker;
  private cache: PrecomputeCache;
  private queue: PrecomputeJob[] = [];
  private isRunning: boolean = false;
  private batchTimer: NodeJS.Timeout | null = null;
  private metrics: {
    totalPrecomputed: number;
    cacheHits: number;
    cacheMisses: number;
    generationTimes: number[];
    lastBatchAt: number;
  };

  constructor(config: Partial<PrecomputeConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tracker = new AccessPatternTracker(this.config.maxMemoryAgeMs);
    this.cache = new PrecomputeCache();
    this.metrics = {
      totalPrecomputed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      generationTimes: [],
      lastBatchAt: 0
    };
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  start(): void {
    if (this.isRunning) return;
    if (!this.config.enabled) {
      console.log('[PrecomputeWorker] Disabled by configuration');
      return;
    }

    console.log('[PrecomputeWorker] Starting...');
    this.isRunning = true;
    this.scheduleBatch();
    this.emit('started');
  }

  stop(): void {
    if (!this.isRunning) return;

    console.log('[PrecomputeWorker] Stopping...');
    this.isRunning = false;
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    this.tracker.stop();
    this.emit('stopped');
  }

  // ============================================================================
  // Access Recording
  // ============================================================================

  /**
   * Record a memory access for pattern learning
   */
  recordAccess(memoryId: string, userId: string, pattern: PatternFlags): void {
    this.tracker.recordAccess(memoryId, userId, pattern);
    
    // Schedule precomputation for frequently accessed patterns
    this.maybeSchedulePrecompute(memoryId, userId, pattern);
  }

  /**
   * Schedule a proof for precomputation
   */
  schedulePrecompute(
    memoryId: string,
    userId: string,
    memoryCommitment: string,
    pattern: PatternFlags,
    priority: number = 1
  ): string {
    const job: PrecomputeJob = {
      id: `pc_${crypto.randomBytes(8).toString('hex')}`,
      memoryId,
      userId,
      memoryCommitment,
      pattern,
      priority,
      createdAt: Date.now(),
      scheduledFor: Date.now(),
      status: 'pending'
    };

    // Check if already cached
    const cacheKey = this.cache.generateKey(memoryCommitment, pattern);
    if (this.cache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return job.id;
    }

    this.queue.push(job);
    this.queue.sort((a, b) => b.priority - a.priority);
    
    this.emit('scheduled', job);
    return job.id;
  }

  // ============================================================================
  // Proof Retrieval
  // ============================================================================

  /**
   * Get a precomputed proof if available
   */
  getPrecomputedProof(memoryCommitment: string, pattern: PatternFlags): any | null {
    const cacheKey = this.cache.generateKey(memoryCommitment, pattern);
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      this.metrics.cacheHits++;
      return cached.result;
    }
    
    this.metrics.cacheMisses++;
    return null;
  }

  /**
   * Check if a proof is precomputed
   */
  hasPrecomputedProof(memoryCommitment: string, pattern: PatternFlags): boolean {
    const cacheKey = this.cache.generateKey(memoryCommitment, pattern);
    return this.cache.has(cacheKey);
  }

  // ============================================================================
  // Batch Processing
  // ============================================================================

  private scheduleBatch(): void {
    if (!this.isRunning) return;

    this.batchTimer = setTimeout(async () => {
      await this.processBatch();
      this.scheduleBatch();
    }, this.config.batchIntervalMs);
  }

  private async processBatch(): Promise<void> {
    // Get jobs from queue
    const jobs = this.queue.splice(0, this.config.batchSize);
    
    // Also add hot memories that aren't queued
    const hotMemories = this.tracker.getHotMemories(
      this.config.recentAccessWindowMs,
      this.config.batchSize - jobs.length
    );

    for (const pattern of hotMemories) {
      const memory = getMemoryMetadata(pattern.memoryId);
      if (!memory || memory.status !== 'ACTIVE') continue;

      const commitment = memory.memoryCommitment || memory.contentHash;
      
      // Add jobs for each predicted pattern
      for (const p of pattern.patterns) {
        const cacheKey = this.cache.generateKey(commitment, p);
        if (!this.cache.has(cacheKey)) {
          jobs.push({
            id: `pc_hot_${crypto.randomBytes(4).toString('hex')}`,
            memoryId: pattern.memoryId,
            userId: pattern.userId,
            memoryCommitment: commitment,
            pattern: p,
            priority: Math.min(pattern.accessCount, 10),
            createdAt: Date.now(),
            scheduledFor: Date.now(),
            status: 'pending'
          });
        }
      }
    }

    if (jobs.length === 0) return;

    console.log(`[PrecomputeWorker] Processing batch of ${jobs.length} jobs`);
    this.metrics.lastBatchAt = Date.now();

    // Process jobs in parallel (with limit)
    const results = await Promise.allSettled(
      jobs.map(job => this.processJob(job))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    console.log(`[PrecomputeWorker] Batch complete: ${successful}/${jobs.length} successful`);
  }

  private async processJob(job: PrecomputeJob): Promise<void> {
    job.status = 'processing';
    const startTime = Date.now();

    try {
      // Get key versions
      const currentKeyVersion = getCurrentKeyVersion(job.userId);
      const minKeyVersion = getMinKeyVersion(job.userId);

      // Generate proof
      const input: ProveInputV2 = {
        memoryCommitment: job.memoryCommitment,
        pattern: job.pattern,
        currentKeyVersion,
        minKeyVersion,
        memoryStatus: MemoryStatus.ACTIVE,
        keyVersion: currentKeyVersion
      };

      const result = await generateProofV2(input);
      const generationTime = Date.now() - startTime;

      // Cache the result
      const cacheKey = this.cache.generateKey(job.memoryCommitment, job.pattern);
      this.cache.set(cacheKey, result.proofHash, result, this.config.cacheDurationSeconds);

      // Update job
      job.status = 'completed';
      job.result = {
        proofHash: result.proofHash,
        generationTimeMs: generationTime,
        allowedForAgent: result.allowedForAgent,
        cachedUntil: Date.now() + this.config.cacheDurationSeconds * 1000
      };

      // Update metrics
      this.metrics.totalPrecomputed++;
      this.metrics.generationTimes.push(generationTime);
      if (this.metrics.generationTimes.length > 100) {
        this.metrics.generationTimes.shift();
      }

      this.emit('completed', job);

    } catch (error: any) {
      job.status = 'failed';
      job.error = error.message;
      this.emit('failed', { job, error });
    }
  }

  private maybeSchedulePrecompute(
    memoryId: string,
    userId: string,
    pattern: PatternFlags
  ): void {
    // Get memory metadata
    const memory = getMemoryMetadata(memoryId);
    if (!memory || memory.status !== 'ACTIVE') return;

    const commitment = memory.memoryCommitment || memory.contentHash;
    const cacheKey = this.cache.generateKey(commitment, pattern);

    // Skip if already cached or queued
    if (this.cache.has(cacheKey)) return;
    if (this.queue.some(j => 
      j.memoryCommitment === commitment && 
      JSON.stringify(j.pattern) === JSON.stringify(pattern)
    )) return;

    // Schedule for precomputation
    this.schedulePrecompute(memoryId, userId, commitment, pattern, 3);
  }

  // ============================================================================
  // Metrics
  // ============================================================================

  getMetrics(): WorkerMetrics {
    const patternStats = this.tracker.getStats();
    const avgTime = this.metrics.generationTimes.length > 0
      ? this.metrics.generationTimes.reduce((a, b) => a + b, 0) / this.metrics.generationTimes.length
      : 0;

    return {
      totalPrecomputed: this.metrics.totalPrecomputed,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      averageGenerationTimeMs: Math.round(avgTime),
      queueSize: this.queue.length,
      isRunning: this.isRunning,
      lastBatchAt: this.metrics.lastBatchAt,
      accessPatterns: patternStats.totalPatterns
    };
  }

  getCacheSize(): number {
    return this.cache.size();
  }

  clearCache(): void {
    this.cache.clear();
    console.log('[PrecomputeWorker] Cache cleared');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let precomputeWorker: ZKPrecomputeWorker | null = null;

export function getPrecomputeWorker(config?: Partial<PrecomputeConfig>): ZKPrecomputeWorker {
  if (!precomputeWorker) {
    precomputeWorker = new ZKPrecomputeWorker(config);
  }
  return precomputeWorker;
}

export function startPrecomputeWorker(config?: Partial<PrecomputeConfig>): ZKPrecomputeWorker {
  const worker = getPrecomputeWorker(config);
  worker.start();
  return worker;
}

export function stopPrecomputeWorker(): void {
  if (precomputeWorker) {
    precomputeWorker.stop();
  }
}
