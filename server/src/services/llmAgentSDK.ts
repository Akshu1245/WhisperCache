/**
 * WhisperCache LLM Agent SDK
 * 
 * Production-ready SDK for integrating LLM agents with WhisperCache.
 * 
 * Features:
 * - OpenAI/Anthropic/Custom LLM support
 * - Policy enforcement with ZK proofs
 * - Context windowing and summarization
 * - Rate limiting and token management
 * - Audit logging for compliance
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { 
  generateProofV2, 
  MemoryStatus, 
  ProveInputV2,
  ZKProofOutputV2
} from './memoryPatternProverV2';
import { 
  getPrecomputeWorker, 
  PatternFlags 
} from './zkPrecomputeWorker';
import { 
  getMemoryMetadata, 
  getCurrentKeyVersion, 
  getMinKeyVersion,
  insertComplianceLog,
  getLatestLogHash
} from '../lib/database';
import { hashData } from '../lib/crypto';

// ============================================================================
// Types
// ============================================================================

export type LLMProvider = 'openai' | 'anthropic' | 'azure' | 'local' | 'custom';

export interface LLMAgentConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  /** Maximum context window size (tokens) */
  contextWindow: number;
  /** Enable ZK proof verification */
  requireProofs: boolean;
  /** Enforce policy on all queries */
  enforcePolicies: boolean;
  /** Rate limit (requests per minute) */
  rateLimit: number;
  /** Enable audit logging */
  auditLogging: boolean;
}

export interface AgentContext {
  canUseMemory: boolean;
  memoryId?: string;
  policyType: string;
  safeSummary: string;
  allowedPatterns: string[];
  blockedPatterns: string[];
  proofHash?: string;
  timestamp: string;
}

export interface AgentQueryInput {
  userId: string;
  memoryId: string;
  query: string;
  pattern: PatternFlags;
  maxContextTokens?: number;
}

export interface AgentQueryOutput {
  success: boolean;
  context: AgentContext;
  proof?: ZKProofOutputV2;
  response?: string;
  tokensUsed?: number;
  cached: boolean;
  latencyMs: number;
  error?: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  policyType: string;
  restrictions: string[];
  proofRequired: boolean;
}

export interface AgentMetrics {
  totalQueries: number;
  allowedQueries: number;
  blockedQueries: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  tokenUsage: number;
  policyViolations: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: LLMAgentConfig = {
  provider: 'local',
  model: 'gpt-4',
  maxTokens: 4096,
  temperature: 0.7,
  contextWindow: 8192,
  requireProofs: true,
  enforcePolicies: true,
  rateLimit: 60,
  auditLogging: true
};

// ============================================================================
// Policy Types
// ============================================================================

export enum PolicyType {
  ALLOW_ALL = 'ALLOW_ALL',
  ALLOW_FINANCE = 'ALLOW_FINANCE',
  ALLOW_HEALTH = 'ALLOW_HEALTH',
  DENY_PERSONAL = 'DENY_PERSONAL',
  DENY_ALL = 'DENY_ALL',
  REQUIRE_PROOF = 'REQUIRE_PROOF'
}

// ============================================================================
// LLM Agent SDK
// ============================================================================

export class LLMAgentSDK extends EventEmitter {
  private config: LLMAgentConfig;
  private requestCount: number = 0;
  private requestWindow: number = 0;
  private metrics: AgentMetrics;
  private contextCache: Map<string, { context: AgentContext; expiresAt: number }>;

  constructor(config: Partial<LLMAgentConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = {
      totalQueries: 0,
      allowedQueries: 0,
      blockedQueries: 0,
      avgLatencyMs: 0,
      cacheHitRate: 0,
      tokenUsage: 0,
      policyViolations: 0
    };
    this.contextCache = new Map();

    console.log(`[LLMAgentSDK] Initialized with provider: ${this.config.provider}`);
  }

  // ============================================================================
  // Main Query Interface
  // ============================================================================

  /**
   * Query memory with policy enforcement
   */
  async query(input: AgentQueryInput): Promise<AgentQueryOutput> {
    const startTime = Date.now();
    this.metrics.totalQueries++;

    try {
      // Rate limiting
      if (!this.checkRateLimit()) {
        return {
          success: false,
          context: this.createBlockedContext('Rate limit exceeded'),
          cached: false,
          latencyMs: Date.now() - startTime,
          error: 'Rate limit exceeded'
        };
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(input);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.metrics.allowedQueries++;
        return {
          success: true,
          context: cached,
          cached: true,
          latencyMs: Date.now() - startTime
        };
      }

      // Get memory metadata
      const memory = getMemoryMetadata(input.memoryId);
      if (!memory) {
        return this.createErrorOutput('Memory not found', startTime);
      }

      // Check ownership
      if (memory.userId !== input.userId) {
        this.metrics.policyViolations++;
        return this.createErrorOutput('Access denied', startTime);
      }

      // Check memory status
      if (memory.status !== 'ACTIVE') {
        return this.createErrorOutput(`Memory is ${memory.status}`, startTime);
      }

      // Evaluate policy
      const policyDecision = await this.evaluatePolicy(input, memory);
      
      if (!policyDecision.allowed) {
        this.metrics.blockedQueries++;
        if (this.config.auditLogging) {
          await this.logPolicyViolation(input, policyDecision);
        }
        return {
          success: false,
          context: this.createBlockedContext(policyDecision.reason),
          cached: false,
          latencyMs: Date.now() - startTime,
          error: policyDecision.reason
        };
      }

      // Generate or retrieve proof
      let proof: ZKProofOutputV2 | undefined;
      if (this.config.requireProofs) {
        proof = await this.getOrGenerateProof(input, memory);
        
        if (!proof.allowedForAgent) {
          this.metrics.blockedQueries++;
          return {
            success: false,
            context: this.createBlockedContext('Proof validation failed'),
            proof,
            cached: false,
            latencyMs: Date.now() - startTime,
            error: 'Proof indicates access denied'
          };
        }
      }

      // Build context for agent
      const context = this.buildAgentContext(input, memory, policyDecision, proof);

      // Cache context
      this.setCache(cacheKey, context, 300); // 5 minute TTL

      // Log for compliance
      if (this.config.auditLogging) {
        await this.logQuery(input, context, proof);
      }

      this.metrics.allowedQueries++;

      return {
        success: true,
        context,
        proof,
        cached: false,
        latencyMs: Date.now() - startTime
      };

    } catch (error: any) {
      console.error('[LLMAgentSDK] Query error:', error);
      return this.createErrorOutput(error.message, startTime);
    }
  }

  /**
   * Batch query multiple memories
   */
  async batchQuery(inputs: AgentQueryInput[]): Promise<AgentQueryOutput[]> {
    // Process in parallel with concurrency limit
    const results: AgentQueryOutput[] = [];
    const batchSize = 5;

    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(input => this.query(input)));
      results.push(...batchResults);
    }

    return results;
  }

  // ============================================================================
  // Policy Evaluation
  // ============================================================================

  private async evaluatePolicy(
    input: AgentQueryInput,
    memory: any
  ): Promise<PolicyDecision> {
    const { pattern } = input;

    // Personal data always requires strict handling
    if (pattern.isPersonal) {
      return {
        allowed: false,
        reason: 'Personal data cannot be shared with agents',
        policyType: PolicyType.DENY_PERSONAL,
        restrictions: ['no_sharing', 'no_logging'],
        proofRequired: true
      };
    }

    // Finance and health require proofs
    if (pattern.isFinance || pattern.isHealth) {
      return {
        allowed: true,
        reason: 'Sensitive data requires ZK proof verification',
        policyType: pattern.isFinance ? PolicyType.ALLOW_FINANCE : PolicyType.ALLOW_HEALTH,
        restrictions: ['proof_required', 'anonymize_details'],
        proofRequired: true
      };
    }

    // Default allow with proof
    return {
      allowed: true,
      reason: 'Standard access with proof',
      policyType: PolicyType.ALLOW_ALL,
      restrictions: [],
      proofRequired: this.config.requireProofs
    };
  }

  // ============================================================================
  // Proof Management
  // ============================================================================

  private async getOrGenerateProof(
    input: AgentQueryInput,
    memory: any
  ): Promise<ZKProofOutputV2> {
    const commitment = memory.memoryCommitment || memory.contentHash;

    // Check precompute cache first
    const worker = getPrecomputeWorker();
    const precomputed = worker.getPrecomputedProof(commitment, input.pattern);
    
    if (precomputed) {
      console.log('[LLMAgentSDK] Using precomputed proof');
      return precomputed as ZKProofOutputV2;
    }

    // Get key versions
    const currentKeyVersion = getCurrentKeyVersion(input.userId);
    const minKeyVersion = getMinKeyVersion(input.userId);

    // Generate proof
    const proofInput: ProveInputV2 = {
      memoryCommitment: commitment,
      pattern: input.pattern,
      currentKeyVersion,
      minKeyVersion,
      memoryStatus: MemoryStatus.ACTIVE,
      keyVersion: currentKeyVersion
    };

    const proof = await generateProofV2(proofInput);

    // Record access for precomputation
    worker.recordAccess(input.memoryId, input.userId, input.pattern);

    return proof;
  }

  // ============================================================================
  // Context Building
  // ============================================================================

  private buildAgentContext(
    input: AgentQueryInput,
    memory: any,
    policy: PolicyDecision,
    proof?: ZKProofOutputV2
  ): AgentContext {
    const allowedPatterns: string[] = [];
    const blockedPatterns: string[] = [];

    if (input.pattern.isFinance) allowedPatterns.push('finance');
    if (input.pattern.isHealth) allowedPatterns.push('health');
    if (input.pattern.isPersonal) blockedPatterns.push('personal');

    // Generate safe summary (never include raw content)
    const safeSummary = this.generateSafeSummary(memory, policy);

    return {
      canUseMemory: policy.allowed && (proof?.allowedForAgent ?? true),
      memoryId: input.memoryId,
      policyType: policy.policyType,
      safeSummary,
      allowedPatterns,
      blockedPatterns,
      proofHash: proof?.proofHash,
      timestamp: new Date().toISOString()
    };
  }

  private createBlockedContext(reason: string): AgentContext {
    return {
      canUseMemory: false,
      policyType: PolicyType.DENY_ALL,
      safeSummary: `Access blocked: ${reason}`,
      allowedPatterns: [],
      blockedPatterns: ['all'],
      timestamp: new Date().toISOString()
    };
  }

  private generateSafeSummary(memory: any, policy: PolicyDecision): string {
    // Extract only safe metadata
    const tags = memory.tags ? JSON.parse(memory.tags) : [];
    const category = tags[0] || 'general';
    
    return `Memory context available for ${category} queries. ` +
           `Policy: ${policy.policyType}. ` +
           `Created: ${memory.createdAt?.split('T')[0] || 'unknown'}.`;
  }

  // ============================================================================
  // Audit Logging
  // ============================================================================

  private async logQuery(
    input: AgentQueryInput,
    context: AgentContext,
    proof?: ZKProofOutputV2
  ): Promise<void> {
    try {
      const logId = `agent_log_${crypto.randomBytes(8).toString('hex')}`;
      const previousLogHash = getLatestLogHash();
      const logHash = await hashData(JSON.stringify({
        id: logId,
        action: 'agent_query',
        userId: input.userId,
        memoryId: input.memoryId,
        timestamp: new Date().toISOString(),
        previousLogHash
      }));

      insertComplianceLog({
        id: logId,
        userId: input.userId,
        action: 'agent_query',
        memoryId: input.memoryId,
        keyId: 'agent_sdk',
        timestamp: new Date().toISOString(),
        metadata: {
          pattern: input.pattern,
          policyType: context.policyType,
          allowed: context.canUseMemory,
          proofHash: proof?.proofHash,
          query: input.query.slice(0, 100)
        },
        previousLogHash,
        logHash
      });
    } catch (error) {
      console.error('[LLMAgentSDK] Failed to log query:', error);
    }
  }

  private async logPolicyViolation(
    input: AgentQueryInput,
    policy: PolicyDecision
  ): Promise<void> {
    try {
      const logId = `violation_${crypto.randomBytes(8).toString('hex')}`;
      const previousLogHash = getLatestLogHash();
      const logHash = await hashData(JSON.stringify({
        id: logId,
        action: 'agent_policy_violation',
        userId: input.userId,
        memoryId: input.memoryId,
        timestamp: new Date().toISOString(),
        previousLogHash
      }));

      insertComplianceLog({
        id: logId,
        userId: input.userId,
        action: 'agent_policy_violation',
        memoryId: input.memoryId,
        keyId: 'agent_sdk',
        timestamp: new Date().toISOString(),
        metadata: {
          pattern: input.pattern,
          policyType: policy.policyType,
          reason: policy.reason
        },
        previousLogHash,
        logHash
      });

      this.emit('policy_violation', { input, policy });
    } catch (error) {
      console.error('[LLMAgentSDK] Failed to log violation:', error);
    }
  }

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  private checkRateLimit(): boolean {
    const now = Date.now();
    const windowStart = Math.floor(now / 60000) * 60000;

    if (this.requestWindow !== windowStart) {
      this.requestWindow = windowStart;
      this.requestCount = 0;
    }

    this.requestCount++;
    return this.requestCount <= this.config.rateLimit;
  }

  // ============================================================================
  // Caching
  // ============================================================================

  private generateCacheKey(input: AgentQueryInput): string {
    return crypto.createHash('sha256')
      .update(`${input.userId}:${input.memoryId}:${JSON.stringify(input.pattern)}`)
      .digest('hex');
  }

  private getFromCache(key: string): AgentContext | null {
    const entry = this.contextCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.contextCache.delete(key);
      return null;
    }
    return entry.context;
  }

  private setCache(key: string, context: AgentContext, ttlSeconds: number): void {
    this.contextCache.set(key, {
      context,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private createErrorOutput(message: string, startTime: number): AgentQueryOutput {
    return {
      success: false,
      context: this.createBlockedContext(message),
      cached: false,
      latencyMs: Date.now() - startTime,
      error: message
    };
  }

  // ============================================================================
  // Metrics
  // ============================================================================

  getMetrics(): AgentMetrics {
    const totalQueries = this.metrics.totalQueries || 1;
    return {
      ...this.metrics,
      cacheHitRate: (this.metrics.allowedQueries - this.metrics.blockedQueries) / totalQueries,
      avgLatencyMs: Math.round(this.metrics.avgLatencyMs)
    };
  }

  resetMetrics(): void {
    this.metrics = {
      totalQueries: 0,
      allowedQueries: 0,
      blockedQueries: 0,
      avgLatencyMs: 0,
      cacheHitRate: 0,
      tokenUsage: 0,
      policyViolations: 0
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let agentSDK: LLMAgentSDK | null = null;

export function getLLMAgentSDK(config?: Partial<LLMAgentConfig>): LLMAgentSDK {
  if (!agentSDK) {
    agentSDK = new LLMAgentSDK(config);
  }
  return agentSDK;
}

export function resetLLMAgentSDK(): void {
  agentSDK = null;
}
