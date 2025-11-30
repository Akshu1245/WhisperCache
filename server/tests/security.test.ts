/**
 * WhisperCache Security Middleware Tests
 * 
 * Tests for rate limiting, IP blocking, and security headers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RateLimiter,
  IPBlocker,
  RequestValidator
} from '../src/middleware/security';

describe('Security Middleware', () => {
  describe('RateLimiter', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
      limiter = new RateLimiter({
        windowMs: 1000, // 1 second window for testing
        maxRequests: 5,
        skipPaths: ['/health']
      });
    });

    it('should allow requests within limit', () => {
      const mockReq = { path: '/api/test', ip: '127.0.0.1', headers: {} } as any;

      for (let i = 0; i < 5; i++) {
        const result = limiter.isRateLimited(mockReq);
        expect(result.limited).toBe(false);
        expect(result.remaining).toBe(4 - i);
      }
    });

    it('should block requests exceeding limit', () => {
      const mockReq = { path: '/api/test', ip: '127.0.0.1', headers: {} } as any;

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        limiter.isRateLimited(mockReq);
      }

      // Next request should be limited
      const result = limiter.isRateLimited(mockReq);
      expect(result.limited).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should skip rate limiting for excluded paths', () => {
      const mockReq = { path: '/health', ip: '127.0.0.1', headers: {} } as any;

      for (let i = 0; i < 100; i++) {
        const result = limiter.isRateLimited(mockReq);
        expect(result.limited).toBe(false);
      }
    });

    it('should track different IPs separately', () => {
      const req1 = { path: '/api/test', ip: '192.168.1.1', headers: {} } as any;
      const req2 = { path: '/api/test', ip: '192.168.1.2', headers: {} } as any;

      // Exhaust IP1's limit
      for (let i = 0; i < 6; i++) {
        limiter.isRateLimited(req1);
      }

      // IP2 should still be allowed
      const result = limiter.isRateLimited(req2);
      expect(result.limited).toBe(false);
    });

    it('should use X-Forwarded-For header when present', () => {
      const mockReq = {
        path: '/api/test',
        ip: '10.0.0.1',
        headers: { 'x-forwarded-for': '203.0.113.1' }
      } as any;

      const result = limiter.isRateLimited(mockReq);
      expect(result.limited).toBe(false);
    });
  });

  describe('IPBlocker', () => {
    let blocker: IPBlocker;

    beforeEach(() => {
      blocker = new IPBlocker();
    });

    it('should block an IP', () => {
      blocker.block('192.168.1.100', 'Suspicious activity', 3600000);
      
      expect(blocker.isBlocked('192.168.1.100')).toBe(true);
      expect(blocker.isBlocked('192.168.1.101')).toBe(false);
    });

    it('should unblock an IP', () => {
      blocker.block('192.168.1.100', 'Test', 3600000);
      
      expect(blocker.isBlocked('192.168.1.100')).toBe(true);
      
      const wasBlocked = blocker.unblock('192.168.1.100');
      
      expect(wasBlocked).toBe(true);
      expect(blocker.isBlocked('192.168.1.100')).toBe(false);
    });

    it('should auto-expire blocks', async () => {
      blocker.block('192.168.1.100', 'Test', 1); // 1ms expiration
      
      expect(blocker.isBlocked('192.168.1.100')).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(blocker.isBlocked('192.168.1.100')).toBe(false);
    });

    it('should list blocked IPs', () => {
      blocker.block('192.168.1.1', 'Reason 1');
      blocker.block('192.168.1.2', 'Reason 2');
      
      const blocked = blocker.getBlockedIPs();
      
      expect(blocked.length).toBe(2);
      expect(blocked.some(b => b.ip === '192.168.1.1')).toBe(true);
      expect(blocked.some(b => b.ip === '192.168.1.2')).toBe(true);
    });
  });

  describe('RequestValidator', () => {
    let validator: RequestValidator;

    beforeEach(() => {
      validator = new RequestValidator();
    });

    it('should accept valid request body', () => {
      const body = {
        userId: 'user123',
        action: 'query',
        data: { key: 'value' }
      };

      const result = validator.validateBody(body);
      expect(result.valid).toBe(true);
    });

    it('should reject script tags', () => {
      const body = {
        content: '<script>alert("xss")</script>'
      };

      const result = validator.validateBody(body);
      expect(result.valid).toBe(false);
    });

    it('should reject javascript: protocol', () => {
      const body = {
        url: 'javascript:void(0)'
      };

      const result = validator.validateBody(body);
      expect(result.valid).toBe(false);
    });

    it('should reject prototype pollution attempts', () => {
      // Patterns that should be caught by the validator
      const bodies = [
        { content: 'something__proto__something' },
        { content: 'constructor[prototype]' },
        { content: 'object.prototype[x]' }
      ];

      for (const body of bodies) {
        const result = validator.validateBody(body);
        expect(result.valid).toBe(false);
      }
    });

    it('should sanitize strings', () => {
      const input = '<script>alert("test")</script>';
      const sanitized = validator.sanitizeString(input);
      
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).toContain('&lt;');
      expect(sanitized).toContain('&gt;');
    });

    it('should accept null/undefined body', () => {
      expect(validator.validateBody(null).valid).toBe(true);
      expect(validator.validateBody(undefined).valid).toBe(true);
    });
  });
});
