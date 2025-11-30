/**
 * LLM Adapter Tests
 * 
 * Tests for the real LLM adapter implementations.
 * These tests use mock responses and don't require actual API keys.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OpenAIRealAdapter,
  AnthropicRealAdapter,
  OllamaLocalAdapter,
  createRealAgentAdapter,
  getDefaultAdapter,
  setDefaultAdapter,
  resetDefaultAdapter
} from './llmAdapters';
import { AgentContext } from './agentPolicy';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('LLM Adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDefaultAdapter();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('OpenAIRealAdapter', () => {
    it('should report not ready without API key', () => {
      const adapter = new OpenAIRealAdapter({ type: 'openai' });
      expect(adapter.isReady()).toBe(false);
      expect(adapter.getAdapterType()).toBe('openai');
    });
    
    it('should report ready with API key', () => {
      const adapter = new OpenAIRealAdapter({ 
        type: 'openai', 
        apiKey: 'sk-test-key' 
      });
      expect(adapter.isReady()).toBe(true);
    });
    
    it('should make API call and return result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Test response' } }],
          model: 'gpt-4',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        })
      });
      
      const adapter = new OpenAIRealAdapter({ 
        type: 'openai', 
        apiKey: 'sk-test-key' 
      });
      
      const context: AgentContext = {
        canUseMemory: true,
        policyApplied: 'ALLOW_FINANCE',
        safeSummary: 'Financial context available'
      };
      
      const result = await adapter.getContextualSuggestion('Help me save money', context);
      
      expect(result.suggestion).toBe('Test response');
      expect(result.model).toBe('gpt-4');
      expect(result.tokenUsage?.total).toBe(15);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    
    it('should throw error without API key', async () => {
      const adapter = new OpenAIRealAdapter({ type: 'openai' });
      
      const context: AgentContext = {
        canUseMemory: true,
        policyApplied: 'ALLOW_GENERAL'
      };
      
      await expect(adapter.getContextualSuggestion('test', context))
        .rejects.toThrow('OpenAI API key not configured');
    });
    
    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ error: { message: 'Invalid request' } })
      });
      
      const adapter = new OpenAIRealAdapter({ 
        type: 'openai', 
        apiKey: 'sk-test-key' 
      });
      
      const context: AgentContext = {
        canUseMemory: true,
        policyApplied: 'ALLOW_GENERAL'
      };
      
      await expect(adapter.getContextualSuggestion('test', context))
        .rejects.toThrow('OpenAI API error: Invalid request');
    });
  });
  
  describe('AnthropicRealAdapter', () => {
    it('should report not ready without API key', () => {
      const adapter = new AnthropicRealAdapter({ type: 'anthropic' });
      expect(adapter.isReady()).toBe(false);
      expect(adapter.getAdapterType()).toBe('anthropic');
    });
    
    it('should make API call with correct format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'Claude response' }],
          model: 'claude-3-sonnet-20240229',
          usage: { input_tokens: 20, output_tokens: 10 }
        })
      });
      
      const adapter = new AnthropicRealAdapter({ 
        type: 'anthropic', 
        apiKey: 'sk-ant-test-key' 
      });
      
      const context: AgentContext = {
        canUseMemory: true,
        policyApplied: 'ALLOW_HEALTH',
        safeSummary: 'Health context'
      };
      
      const result = await adapter.getContextualSuggestion('Health tips', context);
      
      expect(result.suggestion).toBe('Claude response');
      expect(result.model).toBe('claude-3-sonnet-20240229');
      expect(result.tokenUsage?.total).toBe(30);
      
      // Verify Anthropic-specific headers
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers['x-api-key']).toBe('sk-ant-test-key');
      expect(callArgs[1].headers['anthropic-version']).toBe('2023-06-01');
    });
  });
  
  describe('OllamaLocalAdapter', () => {
    it('should always report ready (no API key needed)', () => {
      const adapter = new OllamaLocalAdapter({ type: 'local' });
      expect(adapter.isReady()).toBe(true);
      expect(adapter.getAdapterType()).toBe('ollama');
    });
    
    it('should handle connection failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      
      const adapter = new OllamaLocalAdapter({ type: 'local' });
      
      const context: AgentContext = {
        canUseMemory: false,
        policyApplied: 'BLOCK_ALL',
        redactionReason: 'Memory blocked'
      };
      
      const result = await adapter.getContextualSuggestion('test', context);
      
      expect(result.confidence).toBe(0.0);
      expect(result.warnings).toContain('Ollama service not available');
    });
    
    it('should make local API call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Local model response',
          model: 'llama2',
          prompt_eval_count: 15,
          eval_count: 8
        })
      });
      
      const adapter = new OllamaLocalAdapter({ 
        type: 'local',
        model: 'llama2'
      });
      
      const context: AgentContext = {
        canUseMemory: true,
        policyApplied: 'ALLOW_GENERAL'
      };
      
      const result = await adapter.getContextualSuggestion('test', context);
      
      expect(result.suggestion).toBe('Local model response');
      expect(result.tokenUsage?.total).toBe(23);
    });
  });
  
  describe('createRealAgentAdapter', () => {
    it('should create OpenAI adapter', () => {
      const adapter = createRealAgentAdapter({ type: 'openai', apiKey: 'test' });
      expect(adapter.getAdapterType()).toBe('openai');
    });
    
    it('should create Anthropic adapter', () => {
      const adapter = createRealAgentAdapter({ type: 'anthropic', apiKey: 'test' });
      expect(adapter.getAdapterType()).toBe('anthropic');
    });
    
    it('should create Ollama adapter', () => {
      const adapter = createRealAgentAdapter({ type: 'local' });
      expect(adapter.getAdapterType()).toBe('ollama');
    });
    
    it('should default to mock adapter', () => {
      const adapter = createRealAgentAdapter();
      expect(adapter.getAdapterType()).toContain('mock');
    });
  });
  
  describe('Singleton Management', () => {
    it('should create and return default adapter', () => {
      const adapter1 = getDefaultAdapter();
      const adapter2 = getDefaultAdapter();
      expect(adapter1).toBe(adapter2);
    });
    
    it('should allow setting default adapter', () => {
      const customAdapter = new OllamaLocalAdapter({ type: 'local' });
      setDefaultAdapter(customAdapter);
      
      expect(getDefaultAdapter()).toBe(customAdapter);
    });
    
    it('should reset default adapter', () => {
      const adapter1 = getDefaultAdapter();
      resetDefaultAdapter();
      const adapter2 = getDefaultAdapter();
      
      expect(adapter1).not.toBe(adapter2);
    });
  });
});
