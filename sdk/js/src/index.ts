/**
 * WhisperCache SDK
 * 
 * Privacy-preserving AI memory as a service.
 * 
 * @example
 * ```typescript
 * import { WhisperCacheClient } from '@whispercache/sdk';
 * 
 * const client = new WhisperCacheClient({
 *   baseUrl: 'https://api.whispercache.io',
 *   apiKey: 'your-api-key'
 * });
 * 
 * // Store a memory
 * const memory = await client.storeMemory({
 *   content: 'User prefers dark mode',
 *   tags: ['preferences', 'ui']
 * });
 * 
 * // Prove a policy without revealing the memory
 * const proof = await client.provePolicy({
 *   memoryId: memory.id,
 *   policy: 'no_health_data'
 * });
 * 
 * // Query with ZK verification
 * const result = await client.queryAgent({
 *   query: 'What are the user preferences?',
 *   policies: ['no_health_data']
 * });
 * ```
 */

export interface WhisperCacheConfig {
  /** Base URL of the WhisperCache API */
  baseUrl: string;
  /** API key for authentication (optional for public endpoints) */
  apiKey?: string;
  /** Organization ID (for multi-tenant setups) */
  orgId?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Custom fetch implementation (for Node.js or custom environments) */
  fetch?: typeof fetch;
}

export interface StoreMemoryRequest {
  /** The memory content to store (will be encrypted) */
  content: string;
  /** Tags for categorization and policy evaluation */
  tags?: string[];
  /** Confidence score (0-1) */
  confidence?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface StoreMemoryResponse {
  /** Unique memory ID */
  id: string;
  /** Content hash (not the actual content) */
  contentHash: string;
  /** Cryptographic commitment */
  commitment: string;
  /** Creation timestamp */
  createdAt: string;
}

export interface ProvePolicyRequest {
  /** Memory ID to prove policy for */
  memoryId?: string;
  /** Memory commitment (alternative to memoryId) */
  commitment?: string;
  /** Policy name to prove */
  policy: string;
  /** Pattern for pattern-based proofs */
  pattern?: {
    finance?: boolean;
    health?: boolean;
    personal?: boolean;
    [key: string]: boolean | undefined;
  };
}

export interface ProvePolicyResponse {
  /** Proof hash */
  proofHash: string;
  /** Whether proof is valid */
  verified: boolean;
  /** Whether access is allowed for agent */
  allowedForAgent: boolean;
  /** Policy that was proven */
  policy: string;
  /** Proof data for verification */
  proofData: {
    commitment: string;
    publicInputs: string[];
    proofType: 'REAL' | 'SIMULATED';
  };
  /** Creation timestamp */
  timestamp: string;
}

export interface QueryAgentRequest {
  /** Natural language query */
  query: string;
  /** Policies that must be proven */
  policies?: string[];
  /** Specific memory IDs to query */
  memoryIds?: string[];
  /** Maximum number of results */
  limit?: number;
  /** Include proofs in response */
  includeProofs?: boolean;
}

export interface QueryAgentResponse {
  /** Query result/response */
  response: string;
  /** Memories used (without revealing content) */
  memoriesUsed: Array<{
    id: string;
    commitment: string;
    tags?: string[];
  }>;
  /** Proofs generated */
  proofs?: ProvePolicyResponse[];
  /** Processing metadata */
  metadata: {
    processedAt: string;
    latencyMs: number;
    policiesVerified: string[];
  };
}

export interface AnchorResult {
  /** Transaction ID */
  txId: string;
  /** Anchor status */
  status: 'pending' | 'submitted' | 'confirmed' | 'finalized' | 'failed';
  /** Block height (when confirmed) */
  blockHeight?: number;
  /** Network used */
  network: 'midnight' | 'cardano';
  /** Block explorer URL */
  explorerUrl?: string;
}

export interface PolicyInfo {
  /** Policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Description */
  description: string;
  /** Circuit used */
  circuitName: string;
  /** Policy version */
  version: number;
  /** Whether policy is active */
  isActive: boolean;
}

/**
 * WhisperCache SDK Client
 * 
 * Main client for interacting with WhisperCache API.
 * Provides methods for storing memories, generating ZK proofs,
 * and querying agents with privacy guarantees.
 */
export class WhisperCacheClient {
  private config: Required<Omit<WhisperCacheConfig, 'apiKey' | 'orgId'>> & Pick<WhisperCacheConfig, 'apiKey' | 'orgId'>;
  private authToken: string | null = null;

  constructor(config: WhisperCacheConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''), // Remove trailing slash
      apiKey: config.apiKey,
      orgId: config.orgId,
      timeout: config.timeout ?? 30000,
      fetch: config.fetch ?? globalThis.fetch.bind(globalThis),
    };
  }

  // ============================================
  // Authentication
  // ============================================

  /**
   * Set the authentication token for requests
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Clear the authentication token
   */
  clearAuthToken(): void {
    this.authToken = null;
  }

  /**
   * Register a new DID/wallet
   */
  async register(publicKey: string): Promise<{
    did: string;
    keyId: string;
  }> {
    const response = await this.request<{
      success: boolean;
      did: string;
      keyId: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ publicKey }),
    });
    return { did: response.did, keyId: response.keyId };
  }

  /**
   * Authenticate with challenge-response
   */
  async authenticate(did: string, signature: string): Promise<{
    token: string;
    expiresAt: string;
  }> {
    // Get challenge
    const { challenge } = await this.request<{ challenge: string; expiresAt: string }>(
      '/api/auth/challenge',
      {
        method: 'POST',
        body: JSON.stringify({ did }),
      }
    );

    // Verify signature
    const response = await this.request<{
      token: string;
      expiresAt: string;
    }>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ did, challenge, signature }),
    });

    this.authToken = response.token;
    return response;
  }

  // ============================================
  // Memory Management
  // ============================================

  /**
   * Store a memory with encryption
   * 
   * @example
   * ```typescript
   * const memory = await client.storeMemory({
   *   content: 'User prefers dark mode',
   *   tags: ['preferences', 'ui'],
   *   confidence: 0.95
   * });
   * console.log('Stored:', memory.id);
   * ```
   */
  async storeMemory(request: StoreMemoryRequest): Promise<StoreMemoryResponse> {
    const response = await this.request<{
      memoryId: string;
      contentHash: string;
      commitment: string;
      createdAt: string;
    }>('/api/memory', {
      method: 'POST',
      body: JSON.stringify({
        content: request.content,
        tags: request.tags,
        confidence: request.confidence,
        metadata: request.metadata,
      }),
    });

    return {
      id: response.memoryId,
      contentHash: response.contentHash,
      commitment: response.commitment,
      createdAt: response.createdAt,
    };
  }

  /**
   * Get memory metadata (not content)
   */
  async getMemory(memoryId: string): Promise<{
    id: string;
    contentHash: string;
    tags?: string[];
    confidence?: number;
    createdAt: string;
    updatedAt: string;
  }> {
    return this.request(`/api/memory/${memoryId}`);
  }

  /**
   * List memories with optional filters
   */
  async listMemories(options?: {
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{
    memories: Array<{
      id: string;
      contentHash: string;
      tags?: string[];
      confidence?: number;
      createdAt: string;
    }>;
    total: number;
  }> {
    const params = new URLSearchParams();
    if (options?.tags) params.set('tags', options.tags.join(','));
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());
    
    const query = params.toString();
    return this.request(`/api/memory${query ? `?${query}` : ''}`);
  }

  /**
   * Delete a memory (soft delete with compliance logging)
   */
  async deleteMemory(memoryId: string): Promise<{ success: boolean }> {
    return this.request(`/api/memory/${memoryId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // ZK Proofs
  // ============================================

  /**
   * Generate a ZK proof for a policy
   * 
   * @example
   * ```typescript
   * const proof = await client.provePolicy({
   *   commitment: 'abc123...',
   *   policy: 'no_health_data',
   *   pattern: { finance: true, health: false }
   * });
   * 
   * if (proof.allowedForAgent) {
   *   console.log('Agent can access this memory');
   * }
   * ```
   */
  async provePolicy(request: ProvePolicyRequest): Promise<ProvePolicyResponse> {
    const response = await this.request<{
      result: 'ok' | 'error';
      proofHash: string;
      verified: boolean;
      allowedForAgent: boolean;
      policy: string;
      proofData: {
        commitment: string;
        publicInputs: string[];
        proofType: string;
      };
      timestamp: string;
    }>('/api/zk/prove/pattern', {
      method: 'POST',
      body: JSON.stringify({
        commitment: request.commitment || request.memoryId,
        pattern: request.pattern || { finance: true, health: false, personal: false },
        policy: request.policy,
      }),
    });

    return {
      proofHash: response.proofHash,
      verified: response.verified,
      allowedForAgent: response.allowedForAgent,
      policy: response.policy || request.policy,
      proofData: {
        commitment: response.proofData.commitment,
        publicInputs: response.proofData.publicInputs,
        proofType: response.proofData.proofType as 'REAL' | 'SIMULATED',
      },
      timestamp: response.timestamp,
    };
  }

  /**
   * Verify an existing proof
   */
  async verifyProof(proofHash: string): Promise<{
    verified: boolean;
    proofHash: string;
    createdAt: string;
  }> {
    return this.request('/api/zk/verify', {
      method: 'POST',
      body: JSON.stringify({ proofHash }),
    });
  }

  // ============================================
  // Agent Queries
  // ============================================

  /**
   * Query the agent with ZK-verified memory access
   * 
   * @example
   * ```typescript
   * const result = await client.queryAgent({
   *   query: 'What are the user preferences?',
   *   policies: ['no_health_data', 'gdpr_compliant'],
   *   includeProofs: true
   * });
   * 
   * console.log('Response:', result.response);
   * console.log('Proofs:', result.proofs?.length);
   * ```
   */
  async queryAgent(request: QueryAgentRequest): Promise<QueryAgentResponse> {
    const startTime = Date.now();
    
    const response = await this.request<{
      response: string;
      memoriesUsed: Array<{
        id: string;
        commitment: string;
        tags?: string[];
      }>;
      proofs?: ProvePolicyResponse[];
      policiesVerified: string[];
    }>('/api/agent/query', {
      method: 'POST',
      body: JSON.stringify({
        query: request.query,
        policies: request.policies,
        memoryIds: request.memoryIds,
        limit: request.limit,
        includeProofs: request.includeProofs,
      }),
    });

    return {
      response: response.response,
      memoriesUsed: response.memoriesUsed,
      proofs: response.proofs,
      metadata: {
        processedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        policiesVerified: response.policiesVerified || request.policies || [],
      },
    };
  }

  // ============================================
  // Blockchain Anchoring
  // ============================================

  /**
   * Anchor a proof to the blockchain
   */
  async anchorProof(proofHash: string, options?: {
    network?: 'midnight' | 'cardano' | 'both';
    memoryHash?: string;
  }): Promise<AnchorResult> {
    return this.request('/api/anchor', {
      method: 'POST',
      body: JSON.stringify({
        proofHash,
        memoryHash: options?.memoryHash,
        network: options?.network || 'both',
      }),
    });
  }

  /**
   * Get anchor status by transaction ID
   */
  async getAnchorStatus(txId: string): Promise<AnchorResult> {
    return this.request(`/api/anchor/${txId}`);
  }

  // ============================================
  // Policies
  // ============================================

  /**
   * Get available policies
   */
  async getPolicies(): Promise<PolicyInfo[]> {
    const response = await this.request<{ policies: PolicyInfo[] }>('/api/policies');
    return response.policies;
  }

  /**
   * Get policy by name
   */
  async getPolicy(name: string): Promise<PolicyInfo> {
    const response = await this.request<{ policy: PolicyInfo }>(`/api/policies/name/${name}`);
    return response.policy;
  }

  // ============================================
  // Health & Status
  // ============================================

  /**
   * Check API health
   */
  async health(): Promise<{
    status: string;
    networks: {
      midnight: { connected: boolean; latency: number };
      cardano: { connected: boolean; latency: number };
    };
    timestamp: string;
  }> {
    return this.request('/api/health');
  }

  // ============================================
  // Private Methods
  // ============================================

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add authentication
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    } else if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    // Add org ID if set
    if (this.config.orgId) {
      headers['X-Org-Id'] = this.config.orgId;
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await this.config.fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new WhisperCacheError(
          error.message || error.error || `HTTP ${response.status}`,
          response.status,
          error
        );
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof WhisperCacheError) {
        throw error;
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new WhisperCacheError('Request timeout', 408);
      }
      
      throw new WhisperCacheError(
        error instanceof Error ? error.message : 'Network error',
        0
      );
    }
  }
}

/**
 * WhisperCache API Error
 */
export class WhisperCacheError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'WhisperCacheError';
  }
}

// Export default for convenience
export default WhisperCacheClient;
