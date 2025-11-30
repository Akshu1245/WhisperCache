/**
 * WhisperCache Agent Module
 * 
 * Privacy-preserving AI agent integration with pluggable LLM backends.
 */

// Re-export from agentPolicy
export {
  type PolicyType,
  type ProofResult,
  type MemoryMeta,
  type AgentContext,
  buildAgentContextFromProof,
  createProofResult,
  determinePolicyType
} from './agentPolicy.js';

// Re-export from adapters
export {
  MockAgentAdapter,
  OpenAIAgentAdapter,
  createAgentAdapter
} from './adapters.js';

// Re-export real LLM adapters
export {
  OpenAIRealAdapter,
  AnthropicRealAdapter,
  OllamaLocalAdapter,
  createRealAgentAdapter,
  getDefaultAdapter,
  setDefaultAdapter,
  resetDefaultAdapter
} from './llmAdapters.js';
