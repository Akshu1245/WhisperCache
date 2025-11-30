/**
 * WhisperCache API Client
 * 
 * Handles all communication with the backend server
 * Includes authentication, memory management, ZK proofs, and blockchain anchoring
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Extended timeout for real ZK proof generation (can take 2-10 seconds)
const ZK_PROOF_TIMEOUT = 15000; // 15 seconds

// ============================================
// Response Types
// ============================================

export interface ZKProveResponse {
  result: 'ok' | 'error';
  confidence: number;
  proofHash: string;
  pattern: string;
  query: string;
  timestamp: string;
  isRealProof?: boolean;
  proofMode?: 'real' | 'simulated';
  proofTime?: number;
  proofData?: {
    commitment: string;
    publicInputs: string[];
    verified: boolean;
  };
}

export interface AnchorResponse {
  success: boolean;
  anchorType: 'sqlite' | 'ipfs' | 'midnight' | 'cardano';
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
  // Legacy fields for backward compatibility
  txId?: string;
  status?: 'pending' | 'submitted' | 'confirmed' | 'finalized' | 'failed';
  blockHeight?: number;
  blockHash?: string;
  confirmations?: number;
  anchorData?: {
    commitment: string;
    network: string;
    nonce: string;
    proofHash?: string;
    memoryHash?: string;
  };
  fees?: string;
}

export interface HealthResponse {
  status: string;
  services?: {
    crypto: { status: string; algorithm: string };
    database: { status: string; type: string };
    midnight: { status: string; network: string };
  };
  networks: {
    midnight: { connected: boolean; latency: number };
    cardano: { connected: boolean; latency: number };
  };
  timestamp: string;
}

export interface AuthSession {
  token: string;
  did: string;
  keyId: string;
  expiresAt: string;
  permissions: string[];
}

export interface DIDDocument {
  '@context': string[];
  id: string;
  controller: string;
  verificationMethod: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyHex?: string;
  }>;
  authentication: string[];
  created: string;
  updated: string;
}

export interface MemoryResponse {
  memoryId: string;
  encryptedData?: string;
  nonce?: string;
  algorithm?: string;
  metadata: {
    contentHash: string;
    tags?: string[];
    confidence?: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface ComplianceLog {
  id: string;
  action: string;
  memoryId?: string;
  keyId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  previousLogHash?: string;
  logHash: string;
}

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
    // Restore auth token from session storage
    this.authToken = sessionStorage.getItem('wishpercache_token');
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string | null): void {
    this.authToken = token;
    if (token) {
      sessionStorage.setItem('wishpercache_token', token);
    } else {
      sessionStorage.removeItem('wishpercache_token');
    }
  }

  /**
   * Get current auth token
   */
  getAuthToken(): string | null {
    return this.authToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    // Add auth token if available
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      
      // Handle auth errors
      if (response.status === 401) {
        this.setAuthToken(null);
      }
      
      throw new Error(error.message || error.error || `API error: ${response.status}`);
    }

    return response.json();
  }

  // ============================================
  // Health & Status
  // ============================================

  /**
   * Generic GET request
   */
  async get<T = any>(endpoint: string): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint);
    return { data };
  }

  /**
   * Generic POST request
   */
  async post<T = any>(endpoint: string, body: any): Promise<{ data: T }> {
    const data = await this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { data };
  }

  async health(): Promise<HealthResponse> {
    return this.request('/api/health');
  }

  // ============================================
  // Authentication
  // ============================================

  /**
   * Register a new DID with public key
   */
  async registerDID(publicKey: string): Promise<{ success: boolean; did: string; document: DIDDocument }> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ publicKey }),
    });
  }

  /**
   * Get authentication challenge
   */
  async getAuthChallenge(did: string): Promise<{ challenge: string; expiresAt: string }> {
    return this.request('/api/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ did }),
    });
  }

  /**
   * Authenticate with signed challenge
   */
  async authenticate(challenge: string, signature: string, did: string): Promise<AuthSession> {
    const response = await this.request<AuthSession & { success: boolean }>('/api/auth/authenticate', {
      method: 'POST',
      body: JSON.stringify({ challenge, signature, did }),
    });
    
    // Store token on successful auth
    if (response.token) {
      this.setAuthToken(response.token);
    }
    
    return response;
  }

  /**
   * Create demo session (for development only)
   */
  async createDemoSession(): Promise<AuthSession> {
    const response = await this.request<AuthSession & { success: boolean }>('/api/auth/demo', {
      method: 'POST',
    });
    
    if (response.token) {
      this.setAuthToken(response.token);
    }
    
    return response;
  }

  /**
   * Get current user info
   */
  async getMe(): Promise<{ did: string; keyId: string; permissions: string[]; expiresAt: string }> {
    return this.request('/api/auth/me');
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.setAuthToken(null);
    }
  }

  /**
   * Refresh session token
   */
  async refreshSession(): Promise<AuthSession> {
    const response = await this.request<AuthSession & { success: boolean }>('/api/auth/refresh', {
      method: 'POST',
    });
    
    if (response.token) {
      this.setAuthToken(response.token);
    }
    
    return response;
  }

  // ============================================
  // Memory Operations
  // ============================================

  /**
   * Store encrypted memory
   */
  async createMemory(
    encryptedData: string,
    nonce: string,
    tags?: string[],
    confidence?: number
  ): Promise<{ success: boolean; memoryId: string; contentHash: string; createdAt: string }> {
    return this.request('/api/memory', {
      method: 'POST',
      body: JSON.stringify({ encryptedData, nonce, tags, confidence }),
    });
  }

  /**
   * Get encrypted memory by ID
   */
  async getMemory(memoryId: string): Promise<MemoryResponse> {
    return this.request(`/api/memory/${memoryId}`);
  }

  /**
   * Update memory
   */
  async updateMemory(
    memoryId: string,
    updates: {
      encryptedData?: string;
      nonce?: string;
      tags?: string[];
      confidence?: number;
    }
  ): Promise<{ success: boolean; memoryId: string; updatedAt: string }> {
    return this.request(`/api/memory/${memoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete memory
   */
  async deleteMemory(memoryId: string): Promise<{ success: boolean; memoryId: string; deletedAt: string }> {
    return this.request(`/api/memory/${memoryId}`, {
      method: 'DELETE',
    });
  }

  /**
   * List all memories
   */
  async listMemories(options?: { tag?: string; limit?: number }): Promise<{ 
    count: number; 
    memories: Array<{
      id: string;
      contentHash: string;
      tags?: string[];
      confidence?: number;
      createdAt: string;
      updatedAt: string;
    }>;
  }> {
    const params = new URLSearchParams();
    if (options?.tag) params.set('tag', options.tag);
    if (options?.limit) params.set('limit', options.limit.toString());
    
    const query = params.toString();
    return this.request(`/api/memory${query ? `?${query}` : ''}`);
  }

  /**
   * Search memories by tags
   */
  async searchMemories(tags: string[], minConfidence?: number): Promise<{
    count: number;
    searchedTags: string[];
    memories: Array<{
      id: string;
      contentHash: string;
      tags?: string[];
      confidence?: number;
      createdAt: string;
    }>;
  }> {
    const params = new URLSearchParams();
    params.set('tags', tags.join(','));
    if (minConfidence !== undefined) params.set('minConfidence', minConfidence.toString());
    
    return this.request(`/api/memory/search?${params.toString()}`);
  }

  /**
   * Verify memory integrity
   */
  async verifyMemory(memoryId: string): Promise<{
    verified: boolean;
    memoryId: string;
    expectedHash: string;
    computedHash: string;
    error?: string;
  }> {
    return this.request(`/api/memory/${memoryId}/verify`, { method: 'POST' });
  }

  // ============================================
  // ZK Proofs
  // ============================================

  /**
   * Generate ZK proof for memory query
   */
  async prove(query: string, memoryHashes: string[] = []): Promise<ZKProveResponse> {
    return this.request('/api/zk/prove', {
      method: 'POST',
      body: JSON.stringify({ query, memoryHashes }),
    });
  }

  /**
   * Verify a ZK proof
   */
  async verifyProof(proofHash: string): Promise<{ proofHash: string; verified: boolean }> {
    return this.request(`/api/zk/verify/${proofHash}`);
  }

  /**
   * Anchor memory proof to blockchain
   */
  async anchor(
    memoryHash: string,
    proofHash: string,
    keyId?: string
  ): Promise<AnchorResponse> {
    return this.request('/api/anchor', {
      method: 'POST',
      body: JSON.stringify({ memoryHash, proofHash, keyId }),
    });
  }

  /**
   * Get anchor status
   */
  async getAnchor(txId: string): Promise<AnchorResponse> {
    return this.request(`/api/anchor/${txId}`);
  }

  /**
   * Verify anchor on-chain
   */
  async verifyAnchor(txId: string): Promise<{
    verified: boolean;
    transaction?: AnchorResponse;
    payload?: {
      proofHash: string;
      memoryHash: string;
      commitment: string;
      timestamp: number;
    };
  }> {
    return this.request('/api/anchor/verify', {
      method: 'POST',
      body: JSON.stringify({ txId }),
    });
  }

  /**
   * Get Midnight network status
   */
  async getNetworkStatus(): Promise<{
    network: string;
    connected: boolean;
    chainId: string;
    latestBlock: number;
    syncProgress: number;
    peersConnected: number;
  }> {
    return this.request('/api/anchor/status');
  }

  /**
   * Get recent anchors
   */
  async getRecentAnchors(limit?: number): Promise<{
    count: number;
    anchors: Array<{
      txId: string;
      status: string;
      blockHeight: number;
      timestamp: string;
      proofHash: string;
      memoryHash: string;
    }>;
  }> {
    const params = limit ? `?limit=${limit}` : '';
    return this.request(`/api/anchor/recent${params}`);
  }

  /**
   * Estimate anchor fees
   */
  async estimateFees(payloadSize?: number): Promise<{
    estimatedGas: number;
    gasPrice: string;
    totalFees: string;
    network: string;
  }> {
    return this.request('/api/anchor/estimate', {
      method: 'POST',
      body: JSON.stringify({ payloadSize }),
    });
  }

  // ============================================
  // Compliance
  // ============================================

  /**
   * Log compliance event
   */
  async logCompliance(
    action: 'create' | 'access' | 'delete' | 'proof' | 'rotate_key' | 'anchor' | 'export' | 'share',
    keyId: string,
    memoryId?: string,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; log: ComplianceLog }> {
    return this.request('/api/compliance/log', {
      method: 'POST',
      body: JSON.stringify({ action, keyId, memoryId, metadata }),
    });
  }

  /**
   * Get compliance logs
   */
  async getComplianceLogs(filters?: {
    keyId?: string;
    action?: string;
    memoryId?: string;
    limit?: number;
  }): Promise<{ logs: ComplianceLog[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.keyId) params.set('keyId', filters.keyId);
    if (filters?.action) params.set('action', filters.action);
    if (filters?.memoryId) params.set('memoryId', filters.memoryId);
    if (filters?.limit) params.set('limit', filters.limit.toString());

    const query = params.toString();
    return this.request(`/api/compliance/logs${query ? `?${query}` : ''}`);
  }

  /**
   * Verify compliance log chain integrity
   */
  async verifyComplianceChain(): Promise<{
    verified: boolean;
    chainLength: number;
    latestLogHash?: string;
  }> {
    return this.request('/api/compliance/verify');
  }

  /**
   * Export compliance logs
   */
  async exportComplianceLogs(keyId?: string): Promise<{
    exportedAt: string;
    totalLogs: number;
    logs: ComplianceLog[];
  }> {
    const params = keyId ? `?keyId=${keyId}` : '';
    return this.request(`/api/compliance/export${params}`);
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    complianceLogs: number;
    memories: number;
    zkProofs: number;
    anchors: number;
    keyRotations: number;
    timestamp: string;
  }> {
    return this.request('/api/compliance/stats');
  }

  // ============================================
  // Organization Management
  // ============================================

  /**
   * Create a new organization
   */
  async createOrganization(name: string): Promise<{
    organization: {
      id: string;
      name: string;
      slug: string;
      status: string;
      createdAt: string;
    };
    userRole: {
      userId: string;
      orgId: string;
      role: 'ADMIN' | 'MEMBER' | 'AUDITOR';
    };
  }> {
    return this.request('/api/org', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  /**
   * Get current user's organization context
   */
  async getMyOrganizations(): Promise<{
    organizations: Array<{
      organization: {
        id: string;
        name: string;
        slug: string;
        status: string;
      };
      role: 'ADMIN' | 'MEMBER' | 'AUDITOR';
    }>;
    defaultOrgId?: string;
  }> {
    return this.request('/api/org/me');
  }

  /**
   * Get organization details
   */
  async getOrganization(orgId: string): Promise<{
    organization: {
      id: string;
      name: string;
      slug: string;
      status: string;
      settings?: Record<string, unknown>;
      createdAt: string;
      updatedAt: string;
    };
    role: 'ADMIN' | 'MEMBER' | 'AUDITOR';
  }> {
    return this.request(`/api/org/${orgId}`);
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(orgId: string): Promise<{
    members: Array<{
      userId: string;
      role: 'ADMIN' | 'MEMBER' | 'AUDITOR';
      createdAt: string;
    }>;
    total: number;
  }> {
    return this.request(`/api/org/${orgId}/members`);
  }

  /**
   * Add member to organization
   */
  async addOrganizationMember(
    orgId: string,
    userId: string,
    role: 'ADMIN' | 'MEMBER' | 'AUDITOR' = 'MEMBER'
  ): Promise<{
    userRole: {
      userId: string;
      orgId: string;
      role: 'ADMIN' | 'MEMBER' | 'AUDITOR';
    };
  }> {
    return this.request(`/api/org/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    orgId: string,
    userId: string,
    role: 'ADMIN' | 'MEMBER' | 'AUDITOR'
  ): Promise<{ success: boolean }> {
    return this.request(`/api/org/${orgId}/members/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  /**
   * Remove member from organization
   */
  async removeMember(orgId: string, userId: string): Promise<{ success: boolean }> {
    return this.request(`/api/org/${orgId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get organization statistics
   */
  async getOrganizationStats(orgId: string): Promise<{
    memories: number;
    proofs: number;
    anchors: number;
    users: number;
    complianceLogs: number;
  }> {
    return this.request(`/api/org/${orgId}/stats`);
  }

  /**
   * Update organization settings
   */
  async updateOrganization(
    orgId: string,
    updates: { name?: string; settings?: Record<string, unknown> }
  ): Promise<{ organization: { id: string; name: string } }> {
    return this.request(`/api/org/${orgId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // ============================================
  // Policy Management
  // ============================================

  /**
   * Get available policies
   */
  async getPolicies(): Promise<{
    policies: Array<{
      id: string;
      name: string;
      description: string;
      circuitName: string;
      version: number;
      status: string;
    }>;
  }> {
    return this.request('/api/policies');
  }

  /**
   * Get policy by ID
   */
  async getPolicy(policyId: string): Promise<{
    policy: {
      id: string;
      name: string;
      description: string;
      circuitName: string;
      version: number;
      config?: Record<string, unknown>;
      status: string;
    };
  }> {
    return this.request(`/api/policies/${policyId}`);
  }
}

// Singleton instance
export const api = new ApiClient();

// Export class for custom instances
export { ApiClient };
