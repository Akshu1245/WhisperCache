/**
 * WhisperCache ZK Proof Queue
 * 
 * Async queue for ZK proof generation.
 * - Non-blocking proof generation
 * - In-memory caching with TTL
 * - Concurrent proof limiting
 * - Job status tracking
 * 
 * For production, consider:
 * - Redis-backed queue (Bull/BullMQ)
 * - Distributed proof generation
 * - GPU acceleration
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface PatternFlags {
  isFinance: boolean;
  isHealth: boolean;
  isPersonal: boolean;
}

export interface ProofJob {
  id: string;
  memoryCommitment: string;
  pattern: PatternFlags;
  userId?: string;
  status: JobStatus;
  result?: ProofResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  priority: number;
}

export interface ProofResult {
  success: boolean;
  proof?: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };
  publicSignals?: string[];
  proofHash?: string;
  patternMatched: boolean;
  confidence: number;
  isRealProof: boolean;
  generationTimeMs: number;
  cached: boolean;
  allowedForAgent?: boolean;
  commitment?: string;
}

export interface QueueConfig {
  /** Maximum concurrent proof jobs */
  maxConcurrent: number;
  /** Cache TTL in seconds */
  cacheTtlSeconds: number;
  /** Maximum queue size */
  maxQueueSize: number;
  /** Job timeout in ms */
  jobTimeoutMs: number;
}

export interface QueueStats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  cacheHits: number;
  cacheMisses: number;
  avgGenerationTimeMs: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 3,
  cacheTtlSeconds: 300, // 5 minutes
  maxQueueSize: 100,
  jobTimeoutMs: 30000 // 30 seconds
};

// ============================================================================
// Proof Cache
// ============================================================================

interface CacheEntry {
  result: ProofResult;
  expiresAt: Date;
}

class ProofCache {
  private cache: Map<string, CacheEntry> = new Map();
  private ttlSeconds: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(ttlSeconds: number = 300) {
    this.ttlSeconds = ttlSeconds;
    
    // Clean expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  generateKey(memoryCommitment: string, pattern: PatternFlags | string | Record<string, boolean>): string {
    const patternStr = typeof pattern === 'string' ? pattern : JSON.stringify(pattern);
    return crypto.createHash('sha256')
      .update(`${memoryCommitment}:${patternStr}`)
      .digest('hex');
  }

  get(key: string): ProofResult | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return { ...entry.result, cached: true };
  }

  set(key: string, result: ProofResult): void {
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    this.cache.set(key, { result, expiresAt });
  }

  cleanup(): void {
    const now = new Date();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): { hits: number; misses: number; size: number } {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size
    };
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

// ============================================================================
// Proof Queue Implementation
// ============================================================================

export class ProofQueue extends EventEmitter {
  private config: QueueConfig;
  private cache: ProofCache;
  private queue: ProofJob[] = [];
  private processing: Map<string, ProofJob> = new Map();
  private completed: Map<string, ProofJob> = new Map();
  private generationTimes: number[] = [];

  constructor(config: Partial<QueueConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new ProofCache(this.config.cacheTtlSeconds);
    
    console.log(`[ProofQueue] Initialized: maxConcurrent=${this.config.maxConcurrent}, cacheTTL=${this.config.cacheTtlSeconds}s`);
  }

  /**
   * Submit a proof job to the queue
   */
  async submit(
    memoryCommitment: string,
    pattern: string | PatternFlags | Record<string, boolean>,
    options: { userId?: string; priority?: number } = {}
  ): Promise<{ jobId: string; cached: boolean; result?: ProofResult }> {
    // Normalize pattern to PatternFlags
    const normalizedPattern: PatternFlags = typeof pattern === 'string'
      ? { isFinance: pattern === 'finance', isHealth: pattern === 'health', isPersonal: pattern === 'personal' }
      : { 
          isFinance: Boolean(pattern.isFinance), 
          isHealth: Boolean(pattern.isHealth), 
          isPersonal: Boolean(pattern.isPersonal) 
        };

    // Check cache first
    const cacheKey = this.cache.generateKey(memoryCommitment, normalizedPattern);
    const cachedResult = this.cache.get(cacheKey);
    
    if (cachedResult) {
      console.log(`[ProofQueue] Cache hit for ${cacheKey.slice(0, 8)}...`);
      return { jobId: `cached_${cacheKey.slice(0, 16)}`, cached: true, result: cachedResult };
    }

    // Check queue size
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error('Proof queue is full. Please try again later.');
    }

    // Create job
    const job: ProofJob = {
      id: `pj_${crypto.randomBytes(8).toString('hex')}`,
      memoryCommitment,
      pattern: normalizedPattern,
      userId: options.userId,
      status: 'queued',
      createdAt: new Date(),
      priority: options.priority ?? 1
    };

    // Add to queue (sorted by priority)
    this.queue.push(job);
    this.queue.sort((a, b) => b.priority - a.priority);
    
    console.log(`[ProofQueue] Job ${job.id} queued (queue size: ${this.queue.length})`);
    this.emit('queued', job);

    // Process queue
    this.processNext();

    return { jobId: job.id, cached: false };
  }

  /**
   * Get job status
   */
  getJob(jobId: string): ProofJob | null {
    // Check processing
    if (this.processing.has(jobId)) {
      return this.processing.get(jobId)!;
    }
    
    // Check completed
    if (this.completed.has(jobId)) {
      return this.completed.get(jobId)!;
    }
    
    // Check queue
    return this.queue.find(j => j.id === jobId) || null;
  }

  /**
   * Wait for a job to complete
   */
  async waitForJob(jobId: string, timeoutMs?: number): Promise<ProofJob> {
    const timeout = timeoutMs ?? this.config.jobTimeoutMs;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkJob = () => {
        const job = this.getJob(jobId);
        
        if (!job) {
          reject(new Error(`Job ${jobId} not found`));
          return;
        }

        if (job.status === 'completed' || job.status === 'failed') {
          resolve(job);
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`Job ${jobId} timed out`));
          return;
        }

        setTimeout(checkJob, 100);
      };

      checkJob();
    });
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const cacheStats = this.cache.getStats();
    const avgTime = this.generationTimes.length > 0
      ? this.generationTimes.reduce((a, b) => a + b, 0) / this.generationTimes.length
      : 0;

    return {
      queued: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: Array.from(this.completed.values()).filter(j => j.status === 'failed').length,
      cacheHits: cacheStats.hits,
      cacheMisses: cacheStats.misses,
      avgGenerationTimeMs: Math.round(avgTime)
    };
  }

  /**
   * Clear completed jobs older than given age
   */
  cleanupCompleted(maxAgeMs: number = 3600000): void {
    const cutoff = new Date(Date.now() - maxAgeMs);
    for (const [id, job] of this.completed.entries()) {
      if (job.completedAt && job.completedAt < cutoff) {
        this.completed.delete(id);
      }
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private processNext(): void {
    // Check if we can process more
    if (this.processing.size >= this.config.maxConcurrent) {
      return;
    }

    // Get next job
    const job = this.queue.shift();
    if (!job) {
      return;
    }

    // Move to processing
    job.status = 'processing';
    job.startedAt = new Date();
    this.processing.set(job.id, job);
    
    console.log(`[ProofQueue] Processing job ${job.id}`);
    this.emit('processing', job);

    // Execute proof generation
    this.executeProof(job)
      .then(result => {
        job.status = 'completed';
        job.result = result;
        job.completedAt = new Date();
        
        // Cache the result
        const cacheKey = this.cache.generateKey(job.memoryCommitment, job.pattern);
        this.cache.set(cacheKey, result);
        
        // Track generation time
        this.generationTimes.push(result.generationTimeMs);
        if (this.generationTimes.length > 100) {
          this.generationTimes.shift();
        }
        
        console.log(`[ProofQueue] Job ${job.id} completed in ${result.generationTimeMs}ms`);
        this.emit('completed', job);
      })
      .catch(error => {
        job.status = 'failed';
        job.error = error.message;
        job.completedAt = new Date();
        
        console.error(`[ProofQueue] Job ${job.id} failed:`, error.message);
        this.emit('failed', job, error);
      })
      .finally(() => {
        this.processing.delete(job.id);
        this.completed.set(job.id, job);
        
        // Process next job
        this.processNext();
      });
  }

  private async executeProof(job: ProofJob): Promise<ProofResult> {
    const startTime = Date.now();

    // Import the prover dynamically to avoid circular deps
    const memoryPatternProver = await import('../services/memoryPatternProver');
    
    try {
      const result = await memoryPatternProver.generateProof({
        memoryCommitment: job.memoryCommitment,
        pattern: job.pattern
      });

      return {
        success: true,
        proof: result.proof,
        publicSignals: result.publicSignals,
        proofHash: result.proofHash,
        patternMatched: result.patternMatched ?? false,
        confidence: result.confidence ?? 0,
        isRealProof: result.isRealProof ?? false,
        generationTimeMs: Date.now() - startTime,
        cached: false,
        allowedForAgent: result.allowedForAgent,
        commitment: result.commitment
      };
    } catch (error) {
      return {
        success: false,
        patternMatched: false,
        confidence: 0,
        isRealProof: false,
        generationTimeMs: Date.now() - startTime,
        cached: false
      };
    }
  }
}

let _proofQueue: ProofQueue | null = null;

export function getProofQueue(config?: Partial<QueueConfig>): ProofQueue {
  if (!_proofQueue) {
    _proofQueue = new ProofQueue(config);
  }
  return _proofQueue;
}

export function resetProofQueue(): void {
  _proofQueue = null;
}

export default ProofQueue;
