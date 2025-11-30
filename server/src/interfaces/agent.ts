/**
 * WhisperCache Agent Adapter Interface
 * 
 * Defines the contract for AI agent integrations.
 * Implementations can include OpenAI, Anthropic, local LLMs, etc.
 * 
 * The agent adapter receives sanitized context (never raw memory content)
 * and generates contextual suggestions based on the user's prompt.
 */

import { AgentContext } from '../agent/agentPolicy';

// Re-export AgentContext from agentPolicy
export { AgentContext };

/**
 * Result of an agent query with contextual suggestion
 */
export interface AgentQueryResult {
  /** The agent's contextual suggestion */
  suggestion: string;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Model used for generation */
  model: string;
  
  /** Processing time in ms */
  latencyMs: number;
  
  /** Whether this was a cached response */
  cached: boolean;
  
  /** Token usage (if applicable) */
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  
  /** Any warnings or notes */
  warnings?: string[];
}

/**
 * Agent adapter interface for AI integrations
 * 
 * All agent implementations must conform to this interface.
 * This ensures consistent behavior whether using:
 * - Mock responses (development)
 * - OpenAI GPT models
 * - Anthropic Claude
 * - Local LLMs
 * - Custom fine-tuned models
 */
export interface IAgentAdapter {
  /**
   * Get a contextual suggestion based on user prompt and sanitized context
   * 
   * @param agentPrompt - The user's question or task
   * @param sanitizedContext - The AgentContext from ZK proof (never raw memory)
   * @returns Promise resolving to AgentQueryResult
   * 
   * @example
   * ```typescript
   * const result = await agent.getContextualSuggestion(
   *   "Help me plan my monthly savings",
   *   {
   *     canUseMemory: true,
   *     safeSummary: "Financial planning context available",
   *     policyApplied: "ALLOW_FINANCE",
   *     confidence: 0.95,
   *     allowedTags: ["finance", "budget"]
   *   }
   * );
   * ```
   */
  getContextualSuggestion(
    agentPrompt: string,
    sanitizedContext: AgentContext
  ): Promise<AgentQueryResult>;

  /**
   * Check if the adapter is ready to process requests
   */
  isReady(): boolean;

  /**
   * Get the adapter name/type
   */
  getAdapterType(): string;

  /**
   * Health check for the agent service
   */
  healthCheck(): Promise<{
    healthy: boolean;
    latencyMs: number;
    details?: Record<string, unknown>;
  }>;
}

/**
 * Configuration for agent adapters
 */
export interface AgentAdapterConfig {
  /** Adapter type: 'mock', 'openai', 'anthropic', 'local' */
  type: 'mock' | 'openai' | 'anthropic' | 'local';
  
  /** API key (for cloud providers) */
  apiKey?: string;
  
  /** Model name */
  model?: string;
  
  /** Max tokens for response */
  maxTokens?: number;
  
  /** Temperature for generation */
  temperature?: number;
  
  /** Timeout in ms */
  timeoutMs?: number;
  
  /** Base URL (for custom endpoints) */
  baseUrl?: string;
}

/**
 * Factory function type for creating agent adapters
 */
export type AgentAdapterFactory = (config: AgentAdapterConfig) => IAgentAdapter;
