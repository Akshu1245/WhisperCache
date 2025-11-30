/**
 * Unit Tests: Agent Sanitization Logic
 * 
 * Tests for the agent policy and context building.
 */

import { describe, it, expect } from 'vitest';
import {
  buildAgentContextFromProof,
  determinePolicyType,
  createProofResult,
  validateAgentQuery,
  ProofResult,
  MemoryMeta
} from './agentPolicy';

describe('Agent Policy', () => {
  describe('determinePolicyType', () => {
    it('should return ALLOW_FINANCE for finance flag', () => {
      const policy = determinePolicyType({ isFinance: true });
      expect(policy).toBe('ALLOW_FINANCE');
    });

    it('should return ALLOW_HEALTH for health flag', () => {
      const policy = determinePolicyType({ isHealth: true });
      expect(policy).toBe('ALLOW_HEALTH');
    });

    it('should return ALLOW_PERSONAL for personal flag', () => {
      const policy = determinePolicyType({ isPersonal: true });
      expect(policy).toBe('ALLOW_PERSONAL');
    });

    it('should return ALLOW_GENERAL when no specific flags set', () => {
      const policy = determinePolicyType({});
      expect(policy).toBe('ALLOW_GENERAL');
    });

    it('should prioritize ALLOW_FINANCE when multiple flags set', () => {
      const policy = determinePolicyType({ isFinance: true, isHealth: true });
      expect(policy).toBe('ALLOW_FINANCE');
    });
  });

  describe('createProofResult', () => {
    it('should create a valid proof result for allowed access', () => {
      const zkOutput = {
        patternMatched: true,
        allowedForAgent: true,
        confidence: 0.95
      };
      const pattern = { isFinance: true };
      
      const result = createProofResult(zkOutput, pattern, 'mem_123', ['finance', 'budget']);

      expect(result.allowedForAgent).toBe(true);
      expect(result.policyType).toBe('ALLOW_FINANCE');
      expect(result.memoryId).toBe('mem_123');
      expect(result.tags).toEqual(['finance', 'budget']);
      expect(result.confidence).toBe(0.95);
      expect(result.patternMatched).toBe(true);
    });

    it('should create BLOCK_ALL for blocked access', () => {
      const zkOutput = {
        patternMatched: true,
        allowedForAgent: false,
        confidence: 0
      };
      const pattern = { isPersonal: true };
      
      const result = createProofResult(zkOutput, pattern, 'mem_456', ['personal']);

      expect(result.allowedForAgent).toBe(false);
      expect(result.policyType).toBe('BLOCK_ALL');
    });
  });

  describe('buildAgentContextFromProof', () => {
    it('should build context for allowed finance query', () => {
      const proofResult: ProofResult = {
        allowedForAgent: true,
        policyType: 'ALLOW_FINANCE',
        tags: ['finance', 'budget'],
        confidence: 0.95
      };

      const context = buildAgentContextFromProof(proofResult);

      expect(context.canUseMemory).toBe(true);
      expect(context.policyApplied).toBe('ALLOW_FINANCE');
      expect(context.confidence).toBe(0.95);
    });

    it('should block when proof explicitly blocks access', () => {
      const proofResult: ProofResult = {
        allowedForAgent: false,
        policyType: 'BLOCK_ALL',
        confidence: 0
      };

      const context = buildAgentContextFromProof(proofResult);

      expect(context.canUseMemory).toBe(false);
      expect(context.redactionReason).toBeDefined();
      expect(context.policyApplied).toBe('BLOCK_ALL');
    });

    it('should block revoked memories', () => {
      const proofResult: ProofResult = {
        allowedForAgent: true,
        policyType: 'ALLOW_GENERAL'
      };
      const memoryMeta: MemoryMeta = {
        tags: ['general'],
        status: 'REVOKED'
      };

      const context = buildAgentContextFromProof(proofResult, memoryMeta);

      expect(context.canUseMemory).toBe(false);
      expect(context.redactionReason).toContain('revoked');
    });

    it('should block deleted memories', () => {
      const proofResult: ProofResult = {
        allowedForAgent: true,
        policyType: 'ALLOW_GENERAL'
      };
      const memoryMeta: MemoryMeta = {
        tags: ['general'],
        status: 'DELETED'
      };

      const context = buildAgentContextFromProof(proofResult, memoryMeta);

      expect(context.canUseMemory).toBe(false);
      expect(context.redactionReason).toContain('deleted');
    });

    it('should allow active memories with valid policy', () => {
      const proofResult: ProofResult = {
        allowedForAgent: true,
        policyType: 'ALLOW_FINANCE',
        tags: ['finance'],
        confidence: 0.9
      };
      const memoryMeta: MemoryMeta = {
        tags: ['finance', 'budget'],
        status: 'ACTIVE'
      };

      const context = buildAgentContextFromProof(proofResult, memoryMeta);

      expect(context.canUseMemory).toBe(true);
      expect(context.policyApplied).toBe('ALLOW_FINANCE');
    });
  });

  describe('validateAgentQuery', () => {
    it('should return safe=true for allowed context', () => {
      const context = {
        canUseMemory: true,
        policyApplied: 'ALLOW_FINANCE' as const
      };

      const result = validateAgentQuery(context, 'summarize');

      expect(result.safe).toBe(true);
    });

    it('should return safe=false for blocked context', () => {
      const context = {
        canUseMemory: false,
        redactionReason: 'Policy blocked access',
        policyApplied: 'BLOCK_ALL' as const
      };

      const result = validateAgentQuery(context, 'summarize');

      expect(result.safe).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });
});
