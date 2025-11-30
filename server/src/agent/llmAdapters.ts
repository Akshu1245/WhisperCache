/**
 * WhisperCache LLM Adapter Implementations
 * 
 * Provides real implementations for different LLM backends
 * that conform to the IAgentAdapter interface.
 * 
 * Supported adapters:
 * - OpenAI (GPT-4, GPT-3.5)
 * - Anthropic (Claude)
 * - Ollama (Local models)
 */

import {
  IAgentAdapter,
  AgentContext,
  AgentQueryResult,
  AgentAdapterConfig
} from '../interfaces/agent.js';
import { MockAgentAdapter } from './adapters.js';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build a system prompt from AgentContext
 */
function buildSystemPrompt(context: AgentContext): string {
  const parts: string[] = [
    'You are a helpful AI assistant with access to privacy-preserved user context.',
    '',
    'Context available:'
  ];
  
  if (context.canUseMemory) {
    parts.push(`- Memory access: ALLOWED`);
    if (context.safeSummary) {
      parts.push(`- Summary: ${context.safeSummary}`);
    }
    if (context.allowedTags?.length) {
      parts.push(`- Allowed topics: ${context.allowedTags.join(', ')}`);
    }
  } else {
    parts.push(`- Memory access: BLOCKED`);
    if (context.redactionReason) {
      parts.push(`- Reason: ${context.redactionReason}`);
    }
  }
  
  parts.push(`- Policy: ${context.policyApplied}`);
  
  if (context.confidence) {
    parts.push(`- Confidence: ${(context.confidence * 100).toFixed(0)}%`);
  }
  
  parts.push('');
  parts.push('Provide helpful, contextual responses without revealing raw memory data.');
  parts.push('Be concise and privacy-aware.');
  
  return parts.join('\n');
}

// ============================================================================
// OpenAI Real Adapter
// ============================================================================

/**
 * Real OpenAI adapter that makes actual API calls
 */
export class OpenAIRealAdapter implements IAgentAdapter {
  private config: AgentAdapterConfig;
  private _ready: boolean;
  
  constructor(config: AgentAdapterConfig) {
    const { type, ...rest } = config;
    this.config = {
      type: 'openai',
      model: 'gpt-4-turbo-preview',
      maxTokens: 500,
      temperature: 0.7,
      timeoutMs: 30000,
      ...rest
    };
    this._ready = !!config.apiKey;
  }
  
  async getContextualSuggestion(
    agentPrompt: string,
    sanitizedContext: AgentContext
  ): Promise<AgentQueryResult> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    const startTime = Date.now();
    const systemPrompt = buildSystemPrompt(sanitizedContext);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    
    try {
      const response = await fetch(
        this.config.baseUrl || 'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: agentPrompt }
            ],
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature
          }),
          signal: controller.signal
        }
      );
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      const choice = data.choices[0];
      
      return {
        suggestion: choice.message.content,
        confidence: sanitizedContext.canUseMemory ? 0.9 : 0.3,
        model: data.model,
        latencyMs: Date.now() - startTime,
        cached: false,
        tokenUsage: {
          prompt: data.usage.prompt_tokens,
          completion: data.usage.completion_tokens,
          total: data.usage.total_tokens
        }
      };
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }
  
  isReady(): boolean {
    return this._ready;
  }
  
  getAdapterType(): string {
    return 'openai';
  }
  
  async healthCheck(): Promise<{
    healthy: boolean;
    latencyMs: number;
    details?: Record<string, unknown>;
  }> {
    if (!this.config.apiKey) {
      return { healthy: false, latencyMs: 0, details: { error: 'No API key configured' } };
    }
    
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
      });
      
      return {
        healthy: response.ok,
        latencyMs: Date.now() - startTime,
        details: { status: response.status }
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

// ============================================================================
// Anthropic Real Adapter
// ============================================================================

/**
 * Real Anthropic adapter that makes actual API calls
 */
export class AnthropicRealAdapter implements IAgentAdapter {
  private config: AgentAdapterConfig;
  private _ready: boolean;
  
  constructor(config: AgentAdapterConfig) {
    const { type, ...rest } = config;
    this.config = {
      type: 'anthropic',
      model: 'claude-3-sonnet-20240229',
      maxTokens: 500,
      temperature: 0.7,
      timeoutMs: 30000,
      ...rest
    };
    this._ready = !!config.apiKey;
  }
  
  async getContextualSuggestion(
    agentPrompt: string,
    sanitizedContext: AgentContext
  ): Promise<AgentQueryResult> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key not configured');
    }
    
    const startTime = Date.now();
    const systemPrompt = buildSystemPrompt(sanitizedContext);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    
    try {
      const response = await fetch(
        this.config.baseUrl || 'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: this.config.model,
            system: systemPrompt,
            messages: [
              { role: 'user', content: agentPrompt }
            ],
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature
          }),
          signal: controller.signal
        }
      );
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        suggestion: data.content[0].text,
        confidence: sanitizedContext.canUseMemory ? 0.9 : 0.3,
        model: data.model,
        latencyMs: Date.now() - startTime,
        cached: false,
        tokenUsage: {
          prompt: data.usage.input_tokens,
          completion: data.usage.output_tokens,
          total: data.usage.input_tokens + data.usage.output_tokens
        }
      };
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }
  
  isReady(): boolean {
    return this._ready;
  }
  
  getAdapterType(): string {
    return 'anthropic';
  }
  
  async healthCheck(): Promise<{
    healthy: boolean;
    latencyMs: number;
    details?: Record<string, unknown>;
  }> {
    if (!this.config.apiKey) {
      return { healthy: false, latencyMs: 0, details: { error: 'No API key configured' } };
    }
    
    // Anthropic doesn't have a simple health check endpoint
    // We'll just verify the key format
    return {
      healthy: this.config.apiKey.startsWith('sk-ant-'),
      latencyMs: 0,
      details: { keyFormat: 'valid' }
    };
  }
}

// ============================================================================
// Ollama Local Adapter
// ============================================================================

/**
 * Ollama adapter for local models
 */
export class OllamaLocalAdapter implements IAgentAdapter {
  private config: AgentAdapterConfig;
  
  constructor(config: AgentAdapterConfig = { type: 'local' }) {
    const { type, ...rest } = config;
    this.config = {
      type: 'local',
      model: 'llama2',
      maxTokens: 500,
      temperature: 0.7,
      timeoutMs: 60000, // Local models can be slower
      baseUrl: 'http://localhost:11434',
      ...rest
    };
  }
  
  async getContextualSuggestion(
    agentPrompt: string,
    sanitizedContext: AgentContext
  ): Promise<AgentQueryResult> {
    const startTime = Date.now();
    const systemPrompt = buildSystemPrompt(sanitizedContext);
    
    // Build prompt for Ollama
    const fullPrompt = `System: ${systemPrompt}\n\nHuman: ${agentPrompt}\n\nAssistant:`;
    
    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.config.model,
            prompt: fullPrompt,
            options: {
              num_predict: this.config.maxTokens,
              temperature: this.config.temperature
            },
            stream: false
          })
        }
      );
      
      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        suggestion: data.response,
        confidence: sanitizedContext.canUseMemory ? 0.85 : 0.25,
        model: data.model || this.config.model || 'ollama',
        latencyMs: Date.now() - startTime,
        cached: false,
        tokenUsage: {
          prompt: data.prompt_eval_count || 0,
          completion: data.eval_count || 0,
          total: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        }
      };
    } catch (error) {
      // If Ollama is not running, return a fallback response
      console.warn('[Ollama] Connection failed:', error);
      return {
        suggestion: 'I apologize, but I am currently unable to process your request. The local AI service may not be running.',
        confidence: 0.0,
        model: 'ollama-fallback',
        latencyMs: Date.now() - startTime,
        cached: false,
        warnings: ['Ollama service not available']
      };
    }
  }
  
  isReady(): boolean {
    // Ollama doesn't require API key
    return true;
  }
  
  getAdapterType(): string {
    return 'ollama';
  }
  
  async healthCheck(): Promise<{
    healthy: boolean;
    latencyMs: number;
    details?: Record<string, unknown>;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      
      if (response.ok) {
        const data = await response.json();
        return {
          healthy: true,
          latencyMs: Date.now() - startTime,
          details: { 
            models: data.models?.map((m: { name: string }) => m.name) || [] 
          }
        };
      }
      
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        details: { status: response.status }
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        details: { error: 'Ollama not running' }
      };
    }
  }
}

// ============================================================================
// Enhanced Factory
// ============================================================================

/**
 * Create an agent adapter with real LLM support
 */
export function createRealAgentAdapter(config?: Partial<AgentAdapterConfig>): IAgentAdapter {
  const type = config?.type || (process.env.AGENT_ADAPTER_TYPE as AgentAdapterConfig['type']) || 'mock';
  
  // Build config from environment if not provided
  const fullConfig: AgentAdapterConfig = {
    type,
    apiKey: config?.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
    model: config?.model || process.env.LLM_MODEL,
    maxTokens: config?.maxTokens || (process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS) : 500),
    temperature: config?.temperature || (process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : 0.7),
    timeoutMs: config?.timeoutMs || 30000,
    baseUrl: config?.baseUrl || process.env.LLM_BASE_URL
  };
  
  switch (type) {
    case 'openai':
      return new OpenAIRealAdapter(fullConfig);
      
    case 'anthropic':
      return new AnthropicRealAdapter(fullConfig);
      
    case 'local':
      return new OllamaLocalAdapter(fullConfig);
      
    case 'mock':
    default:
      return new MockAgentAdapter(fullConfig);
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let defaultAdapter: IAgentAdapter | null = null;

/**
 * Get the default agent adapter (creates from environment if needed)
 */
export function getDefaultAdapter(): IAgentAdapter {
  if (!defaultAdapter) {
    defaultAdapter = createRealAgentAdapter();
  }
  return defaultAdapter;
}

/**
 * Set the default agent adapter
 */
export function setDefaultAdapter(adapter: IAgentAdapter): void {
  defaultAdapter = adapter;
}

/**
 * Reset the default adapter (for testing)
 */
export function resetDefaultAdapter(): void {
  defaultAdapter = null;
}
