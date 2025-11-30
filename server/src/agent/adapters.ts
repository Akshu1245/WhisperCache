/**
 * WhisperCache Mock Agent Adapter
 * 
 * Development/demo implementation of IAgentAdapter.
 * Provides realistic-looking responses without requiring
 * actual AI service integration.
 * 
 * TODO: Replace with real implementations:
 * - OpenAIAgentAdapter
 * - AnthropicAgentAdapter
 * - LocalLLMAdapter
 */

import {
  IAgentAdapter,
  AgentContext,
  AgentQueryResult,
  AgentAdapterConfig
} from '../interfaces/agent';

// ============================================================================
// Mock Response Templates
// ============================================================================

const FINANCE_RESPONSES = [
  "Based on your financial patterns, I recommend setting aside 20% of your income for savings. Consider automating transfers to reduce decision fatigue.",
  "Your spending patterns suggest you could benefit from the 50/30/20 budgeting rule: 50% needs, 30% wants, 20% savings.",
  "Looking at your financial context, I'd suggest reviewing subscription services for potential savings. Small recurring costs add up significantly.",
  "Your budget data indicates room for optimization in discretionary spending. Would you like me to suggest specific areas to review?"
];

const HEALTH_RESPONSES = [
  "Based on your wellness context, maintaining consistent sleep and exercise schedules appears beneficial. Small, sustainable changes often outperform dramatic ones.",
  "Your health patterns suggest focusing on hydration and regular movement breaks could improve daily well-being.",
  "Considering your wellness goals, I'd recommend tracking one key metric consistently rather than multiple metrics inconsistently.",
  "Your health context indicates that stress management techniques like deep breathing or short walks might be valuable additions to your routine."
];

const GENERAL_RESPONSES = [
  "Based on the available context, I can provide general guidance. What specific aspect would you like me to focus on?",
  "I have limited context for this request, but I'm happy to help with what's available. Could you provide more details?",
  "The context suggests this is a general inquiry. Let me know which direction you'd like to explore.",
  "I can offer some insights based on the available information. What would be most helpful for you right now?"
];

const BLOCKED_RESPONSES = [
  "I don't have access to the relevant memory for this request. The memory may be private or revoked.",
  "This context is not available to me. Please check memory permissions or try a different query.",
  "I cannot access the required information for this request. The associated memory may have been deleted.",
  "Access to this context is restricted. If you believe this is an error, please verify the memory status."
];

// ============================================================================
// Mock Agent Adapter Implementation
// ============================================================================

export class MockAgentAdapter implements IAgentAdapter {
  private config: AgentAdapterConfig;
  private ready: boolean = true;
  private requestCount: number = 0;

  constructor(config: Partial<AgentAdapterConfig> = {}) {
    this.config = {
      type: 'mock',
      model: 'mock-v1',
      maxTokens: 500,
      temperature: 0.7,
      timeoutMs: 5000,
      ...config
    };
  }

  async getContextualSuggestion(
    agentPrompt: string,
    sanitizedContext: AgentContext
  ): Promise<AgentQueryResult> {
    const startTime = Date.now();
    this.requestCount++;

    // Simulate network latency
    await this.simulateLatency();

    // Determine response based on context
    let suggestion: string;
    let confidence: number;

    if (!sanitizedContext.canUseMemory) {
      // Memory is blocked/revoked
      suggestion = this.selectResponse(BLOCKED_RESPONSES);
      confidence = 0.1;
    } else {
      // Select response based on policy
      switch (sanitizedContext.policyApplied) {
        case 'ALLOW_FINANCE':
          suggestion = this.selectResponse(FINANCE_RESPONSES);
          confidence = 0.85 + Math.random() * 0.1;
          break;
        case 'ALLOW_HEALTH':
          suggestion = this.selectResponse(HEALTH_RESPONSES);
          confidence = 0.82 + Math.random() * 0.12;
          break;
        case 'BLOCK_PERSONAL':
          suggestion = "I cannot access personal information for this request. Only non-personal context is available.";
          confidence = 0.3;
          break;
        default:
          suggestion = this.selectResponse(GENERAL_RESPONSES);
          confidence = 0.7 + Math.random() * 0.15;
      }

      // Personalize with prompt context
      if (agentPrompt.toLowerCase().includes('save') || agentPrompt.toLowerCase().includes('budget')) {
        suggestion = suggestion.replace('your', 'your specific');
      }
    }

    const latencyMs = Date.now() - startTime;

    // Calculate mock token usage
    const promptTokens = Math.ceil(agentPrompt.length / 4);
    const completionTokens = Math.ceil(suggestion.length / 4);

    return {
      suggestion,
      confidence,
      model: this.config.model || 'mock-v1',
      latencyMs,
      cached: this.requestCount > 1 && Math.random() > 0.7, // 30% cache hit after first request
      tokenUsage: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens
      },
      warnings: this.config.type === 'mock' 
        ? ['This is a mock response. Enable OpenAI or Anthropic for production use.']
        : undefined
    };
  }

  isReady(): boolean {
    return this.ready;
  }

  getAdapterType(): string {
    return `mock (${this.config.model})`;
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    latencyMs: number;
    details?: Record<string, unknown>;
  }> {
    const start = Date.now();
    await this.simulateLatency(50);
    
    return {
      healthy: this.ready,
      latencyMs: Date.now() - start,
      details: {
        type: 'mock',
        model: this.config.model,
        requestCount: this.requestCount
      }
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private selectResponse(responses: string[]): string {
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private async simulateLatency(ms?: number): Promise<void> {
    const delay = ms ?? (100 + Math.random() * 200);
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}

// ============================================================================
// OpenAI Agent Adapter (TODO)
// ============================================================================

/**
 * OpenAI Agent Adapter
 * 
 * TODO: Implement real OpenAI integration
 * 
 * Expected implementation:
 * 
 * ```typescript
 * import OpenAI from 'openai';
 * 
 * export class OpenAIAgentAdapter implements IAgentAdapter {
 *   private client: OpenAI;
 *   
 *   constructor(config: AgentAdapterConfig) {
 *     this.client = new OpenAI({
 *       apiKey: config.apiKey,
 *       baseURL: config.baseUrl
 *     });
 *   }
 *   
 *   async getContextualSuggestion(
 *     agentPrompt: string,
 *     sanitizedContext: AgentContext
 *   ): Promise<AgentQueryResult> {
 *     const systemPrompt = this.buildSystemPrompt(sanitizedContext);
 *     
 *     const response = await this.client.chat.completions.create({
 *       model: this.config.model || 'gpt-4',
 *       messages: [
 *         { role: 'system', content: systemPrompt },
 *         { role: 'user', content: agentPrompt }
 *       ],
 *       max_tokens: this.config.maxTokens,
 *       temperature: this.config.temperature
 *     });
 *     
 *     return {
 *       suggestion: response.choices[0].message.content,
 *       confidence: 0.9,
 *       model: response.model,
 *       latencyMs: Date.now() - startTime,
 *       cached: false,
 *       tokenUsage: {
 *         prompt: response.usage.prompt_tokens,
 *         completion: response.usage.completion_tokens,
 *         total: response.usage.total_tokens
 *       }
 *     };
 *   }
 *   
 *   private buildSystemPrompt(context: AgentContext): string {
 *     return `You are a helpful assistant with access to the user's privacy-preserved context.
 *     
 *     Context available:
 *     - Can use memory: ${context.canUseMemory}
 *     - Summary: ${context.safeSummary || 'None'}
 *     - Policy: ${context.policyApplied}
 *     - Allowed topics: ${context.allowedTags?.join(', ') || 'General'}
 *     
 *     Provide helpful, contextual responses without accessing raw data.`;
 *   }
 * }
 * ```
 */
export class OpenAIAgentAdapter implements IAgentAdapter {
  constructor(_config: AgentAdapterConfig) {
    console.warn('[OpenAIAgentAdapter] Not implemented - using mock responses');
  }

  async getContextualSuggestion(
    agentPrompt: string,
    sanitizedContext: AgentContext
  ): Promise<AgentQueryResult> {
    // Fallback to mock
    const mock = new MockAgentAdapter();
    return mock.getContextualSuggestion(agentPrompt, sanitizedContext);
  }

  isReady(): boolean {
    return false;
  }

  getAdapterType(): string {
    return 'openai (not implemented)';
  }

  async healthCheck() {
    return { healthy: false, latencyMs: 0, details: { error: 'Not implemented' } };
  }
}

// ============================================================================
// Agent Adapter Factory
// ============================================================================

/**
 * Create an agent adapter based on configuration
 */
export function createAgentAdapter(config?: Partial<AgentAdapterConfig>): IAgentAdapter {
  const type = config?.type || process.env.AGENT_ADAPTER_TYPE || 'mock';

  switch (type) {
    case 'openai':
      // TODO: Implement real OpenAI adapter
      console.log('[AgentFactory] OpenAI adapter requested but not implemented, using mock');
      return new MockAgentAdapter({ ...config, type: 'mock' });

    case 'anthropic':
      // TODO: Implement Anthropic adapter
      console.log('[AgentFactory] Anthropic adapter requested but not implemented, using mock');
      return new MockAgentAdapter({ ...config, type: 'mock' });

    case 'local':
      // TODO: Implement local LLM adapter
      console.log('[AgentFactory] Local adapter requested but not implemented, using mock');
      return new MockAgentAdapter({ ...config, type: 'mock' });

    case 'mock':
    default:
      return new MockAgentAdapter(config);
  }
}

export default createAgentAdapter;
