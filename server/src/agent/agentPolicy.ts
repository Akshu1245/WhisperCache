/**
 * Agent Policy Module
 * 
 * Provides logic to transform ZK proof results + memory tags into
 * a safe, filtered agent context. The agent should never receive
 * raw memories, only policies/flags.
 */

// ============================================
// Types
// ============================================

export type PolicyType = 
  | 'ALLOW_FINANCE'
  | 'ALLOW_HEALTH'
  | 'ALLOW_PERSONAL'
  | 'BLOCK_PERSONAL'
  | 'BLOCK_HEALTH'
  | 'BLOCK_FINANCE'
  | 'ALLOW_GENERAL'
  | 'BLOCK_ALL';

export interface ProofResult {
  allowedForAgent: boolean;
  policyType: PolicyType;
  memoryId?: string;
  tags?: string[];
  confidence?: number;
  patternMatched?: boolean;
}

export interface MemoryMeta {
  tags: string[];
  status: string;
  memoryCommitment?: string;
}

export interface AgentContext {
  canUseMemory: boolean;
  redactionReason?: string;
  safeSummary?: string;
  policyApplied: PolicyType;
  confidence?: number;
  allowedTags?: string[];
  blockedTags?: string[];
}

// ============================================
// Policy Configuration
// ============================================

// Tags that are considered sensitive
const SENSITIVE_TAGS = ['personal', 'health', 'medical', 'private', 'confidential', 'secret'];
const FINANCE_TAGS = ['finance', 'financial', 'money', 'budget', 'savings', 'investment', 'bank'];
const HEALTH_TAGS = ['health', 'medical', 'diagnosis', 'treatment', 'prescription', 'symptoms'];
const PERSONAL_TAGS = ['personal', 'private', 'family', 'relationship', 'diary', 'journal'];

// ============================================
// Helper Functions
// ============================================

/**
 * Classify tags into categories
 */
function classifyTags(tags: string[]): {
  finance: string[];
  health: string[];
  personal: string[];
  general: string[];
} {
  const result = {
    finance: [] as string[],
    health: [] as string[],
    personal: [] as string[],
    general: [] as string[]
  };

  for (const tag of tags) {
    const lowerTag = tag.toLowerCase();
    if (FINANCE_TAGS.some(ft => lowerTag.includes(ft))) {
      result.finance.push(tag);
    } else if (HEALTH_TAGS.some(ht => lowerTag.includes(ht))) {
      result.health.push(tag);
    } else if (PERSONAL_TAGS.some(pt => lowerTag.includes(pt))) {
      result.personal.push(tag);
    } else {
      result.general.push(tag);
    }
  }

  return result;
}

/**
 * Determine if any tags are sensitive
 */
function hasSensitiveTags(tags: string[]): boolean {
  return tags.some(tag => 
    SENSITIVE_TAGS.some(st => tag.toLowerCase().includes(st))
  );
}

/**
 * Generate a safe summary from tags without revealing content
 */
function generateSafeSummary(tags: string[], policyType: PolicyType): string {
  const classified = classifyTags(tags);
  
  const parts: string[] = [];
  
  if (policyType.startsWith('ALLOW')) {
    if (classified.finance.length > 0) {
      parts.push('This relates to finance and can guide budgeting suggestions.');
    }
    if (classified.health.length > 0) {
      parts.push('This contains health information for wellness guidance.');
    }
    if (classified.personal.length > 0) {
      parts.push('This includes personal context for personalized responses.');
    }
    if (classified.general.length > 0 && parts.length === 0) {
      parts.push('This contains general information that can inform responses.');
    }
  } else {
    parts.push('Content is restricted by privacy policy.');
  }

  return parts.join(' ') || 'No additional context available.';
}

/**
 * Determine which tags are safe to expose to the agent
 */
function filterSafeTags(tags: string[], policyType: PolicyType): {
  allowed: string[];
  blocked: string[];
} {
  const result = {
    allowed: [] as string[],
    blocked: [] as string[]
  };

  for (const tag of tags) {
    const lowerTag = tag.toLowerCase();
    const isSensitive = SENSITIVE_TAGS.some(st => lowerTag.includes(st));
    
    if (policyType === 'BLOCK_ALL' || isSensitive && policyType.startsWith('BLOCK')) {
      result.blocked.push(tag);
    } else {
      result.allowed.push(tag);
    }
  }

  return result;
}

// ============================================
// Main Policy Function
// ============================================

/**
 * Build a sanitized agent context from ZK proof results and memory metadata.
 * 
 * The agent context contains only safe, policy-filtered information.
 * No raw memory content is ever exposed.
 * 
 * @param proofResult - The result of ZK proof verification
 * @param memoryMeta - Optional memory metadata (tags, status)
 * @returns AgentContext with safe information for the agent
 */
export function buildAgentContextFromProof(
  proofResult: ProofResult,
  memoryMeta?: MemoryMeta
): AgentContext {
  // Case 1: Proof explicitly blocks agent access
  if (proofResult.allowedForAgent === false) {
    return {
      canUseMemory: false,
      redactionReason: 'Policy blocked this memory for agent usage.',
      policyApplied: proofResult.policyType || 'BLOCK_ALL',
      confidence: proofResult.confidence
    };
  }

  // Case 2: Memory is not ACTIVE (revoked or deleted)
  if (memoryMeta && memoryMeta.status !== 'ACTIVE') {
    return {
      canUseMemory: false,
      redactionReason: `Memory ${memoryMeta.status.toLowerCase()} by user.`,
      policyApplied: 'BLOCK_ALL',
      confidence: 0
    };
  }

  // Case 3: Check for sensitive tags that should be blocked
  const tags = memoryMeta?.tags || proofResult.tags || [];
  const hasSensitive = hasSensitiveTags(tags);
  
  // If policy doesn't explicitly allow sensitive data, block it
  if (hasSensitive && !proofResult.policyType.startsWith('ALLOW_')) {
    return {
      canUseMemory: false,
      redactionReason: 'Memory contains sensitive tags not covered by policy.',
      policyApplied: 'BLOCK_ALL',
      confidence: proofResult.confidence
    };
  }

  // Case 4: Memory is allowed - generate safe context
  const filteredTags = filterSafeTags(tags, proofResult.policyType);
  const safeSummary = generateSafeSummary(tags, proofResult.policyType);

  return {
    canUseMemory: true,
    safeSummary,
    policyApplied: proofResult.policyType,
    confidence: proofResult.confidence,
    allowedTags: filteredTags.allowed,
    blockedTags: filteredTags.blocked.length > 0 ? filteredTags.blocked : undefined
  };
}

/**
 * Determine policy type from pattern flags
 */
export function determinePolicyType(pattern: {
  isFinance?: boolean;
  isHealth?: boolean;
  isPersonal?: boolean;
}): PolicyType {
  if (pattern.isFinance) return 'ALLOW_FINANCE';
  if (pattern.isHealth) return 'ALLOW_HEALTH';
  if (pattern.isPersonal) return 'ALLOW_PERSONAL';
  return 'ALLOW_GENERAL';
}

/**
 * Create a ProofResult from ZK proof output
 */
export function createProofResult(
  zkOutput: {
    patternMatched: boolean;
    allowedForAgent: boolean;
    confidence: number;
    proofHash?: string;
  },
  pattern: { isFinance?: boolean; isHealth?: boolean; isPersonal?: boolean },
  memoryId?: string,
  tags?: string[]
): ProofResult {
  const policyType = zkOutput.allowedForAgent 
    ? determinePolicyType(pattern)
    : 'BLOCK_ALL';

  return {
    allowedForAgent: zkOutput.allowedForAgent,
    policyType,
    memoryId,
    tags,
    confidence: zkOutput.confidence,
    patternMatched: zkOutput.patternMatched
  };
}

/**
 * Validate if an agent query is safe based on the context
 */
export function validateAgentQuery(
  agentContext: AgentContext,
  queryType: string
): { safe: boolean; reason?: string } {
  if (!agentContext.canUseMemory) {
    return {
      safe: false,
      reason: agentContext.redactionReason || 'Memory access blocked by policy'
    };
  }

  // Additional query-type specific validation could go here
  // For now, if the context allows memory use, the query is safe

  return { safe: true };
}

export default {
  buildAgentContextFromProof,
  determinePolicyType,
  createProofResult,
  validateAgentQuery
};
