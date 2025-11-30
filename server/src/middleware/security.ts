/**
 * WhisperCache Security Middleware
 * 
 * Production security features:
 * - Rate limiting with sliding window
 * - Request validation and sanitization
 * - CORS with whitelist
 * - Security headers
 * - Request ID tracking
 * - IP-based blocking
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Max requests per window */
  maxRequests: number;
  /** Skip rate limiting for these paths */
  skipPaths?: string[];
  /** Custom key generator (default: IP-based) */
  keyGenerator?: (req: Request) => string;
}

export interface SecurityConfig {
  /** Allowed CORS origins */
  allowedOrigins: string[];
  /** Enable strict transport security */
  enableHSTS: boolean;
  /** Enable content security policy */
  enableCSP: boolean;
  /** Maximum request body size */
  maxBodySize: string;
  /** Request timeout in milliseconds */
  requestTimeout: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface BlockedIP {
  ip: string;
  reason: string;
  blockedAt: number;
  expiresAt: number;
}

// ============================================================================
// Rate Limiter
// ============================================================================

export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      windowMs: config.windowMs || 60000, // 1 minute
      maxRequests: config.maxRequests || 100,
      skipPaths: config.skipPaths || ['/health', '/ready'],
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator
    };

    // Cleanup expired entries periodically
    setInterval(() => this.cleanup(), this.config.windowMs);
  }

  private defaultKeyGenerator(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' 
      ? forwarded.split(',')[0].trim()
      : req.ip || req.socket.remoteAddress || 'unknown';
    return `${ip}:${req.path}`;
  }

  isRateLimited(req: Request): { limited: boolean; remaining: number; resetAt: number } {
    // Skip for certain paths
    if (this.config.skipPaths?.some(p => req.path.startsWith(p))) {
      return { limited: false, remaining: this.config.maxRequests, resetAt: 0 };
    }

    const key = this.config.keyGenerator!(req);
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetAt) {
      // New window
      this.limits.set(key, {
        count: 1,
        resetAt: now + this.config.windowMs
      });
      return { 
        limited: false, 
        remaining: this.config.maxRequests - 1,
        resetAt: now + this.config.windowMs
      };
    }

    entry.count++;
    const limited = entry.count > this.config.maxRequests;
    
    return {
      limited,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetAt: entry.resetAt
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits) {
      if (now > entry.resetAt) {
        this.limits.delete(key);
      }
    }
  }
}

// ============================================================================
// IP Blocker
// ============================================================================

export class IPBlocker {
  private blocked: Map<string, BlockedIP> = new Map();

  block(ip: string, reason: string, durationMs: number = 3600000): void {
    const now = Date.now();
    this.blocked.set(ip, {
      ip,
      reason,
      blockedAt: now,
      expiresAt: now + durationMs
    });
    console.log(`[Security] Blocked IP ${ip}: ${reason}`);
  }

  unblock(ip: string): boolean {
    const wasBlocked = this.blocked.has(ip);
    this.blocked.delete(ip);
    if (wasBlocked) {
      console.log(`[Security] Unblocked IP ${ip}`);
    }
    return wasBlocked;
  }

  isBlocked(ip: string): boolean {
    const entry = this.blocked.get(ip);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.blocked.delete(ip);
      return false;
    }

    return true;
  }

  getBlockedIPs(): BlockedIP[] {
    const now = Date.now();
    // Cleanup expired and return active blocks
    const active: BlockedIP[] = [];
    for (const [ip, entry] of this.blocked) {
      if (now > entry.expiresAt) {
        this.blocked.delete(ip);
      } else {
        active.push(entry);
      }
    }
    return active;
  }
}

// ============================================================================
// Request Validator
// ============================================================================

export class RequestValidator {
  private readonly dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /\$\{/,
    /\{\{/,
    /__proto__/,
    /constructor\s*\[/,
    /prototype\s*\[/
  ];

  validateBody(body: unknown): { valid: boolean; reason?: string } {
    if (!body) return { valid: true };

    const bodyStr = JSON.stringify(body);
    
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(bodyStr)) {
        return { valid: false, reason: 'Potentially dangerous content detected' };
      }
    }

    return { valid: true };
  }

  sanitizeString(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
}

// ============================================================================
// Middleware Functions
// ============================================================================

const globalRateLimiter = new RateLimiter();
const globalIPBlocker = new IPBlocker();
const globalValidator = new RequestValidator();

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(config?: Partial<RateLimitConfig>): RequestHandler {
  const limiter = config ? new RateLimiter(config) : globalRateLimiter;

  return (req: Request, res: Response, next: NextFunction): void => {
    const result = limiter.isRateLimited(req);

    res.setHeader('X-RateLimit-Limit', config?.maxRequests || 100);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (result.limited) {
      res.status(429).json({
        error: 'Too Many Requests',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000)
      });
      return;
    }

    next();
  };
}

/**
 * IP blocking middleware
 */
export function ipBlockMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' 
      ? forwarded.split(',')[0].trim()
      : req.ip || req.socket.remoteAddress || 'unknown';

    if (globalIPBlocker.isBlocked(ip)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    next();
  };
}

/**
 * Request ID middleware
 */
export function requestIdMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = (req.headers['x-request-id'] as string) || 
      `req_${crypto.randomBytes(8).toString('hex')}`;
    
    (req as any).requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  };
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(config?: Partial<SecurityConfig>): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // HSTS (when enabled)
    if (config?.enableHSTS !== false) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    // CSP (basic policy when enabled)
    if (config?.enableCSP !== false) {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
      );
    }

    // Remove server header
    res.removeHeader('X-Powered-By');
    
    next();
  };
}

/**
 * Request validation middleware
 */
export function validateRequestMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = globalValidator.validateBody(req.body);
    
    if (!result.valid) {
      res.status(400).json({ error: result.reason });
      return;
    }

    next();
  };
}

/**
 * CORS middleware with whitelist
 */
export function corsMiddleware(allowedOrigins: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    
    if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

/**
 * Request timeout middleware
 */
export function timeoutMiddleware(timeoutMs: number = 30000): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ error: 'Request Timeout' });
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
}

// ============================================================================
// Combined Security Middleware
// ============================================================================

export interface SecurityMiddlewareOptions {
  rateLimiting?: Partial<RateLimitConfig>;
  security?: Partial<SecurityConfig>;
  allowedOrigins?: string[];
  timeout?: number;
}

export function createSecurityMiddleware(options: SecurityMiddlewareOptions = {}): RequestHandler[] {
  return [
    requestIdMiddleware(),
    ipBlockMiddleware(),
    rateLimitMiddleware(options.rateLimiting),
    securityHeadersMiddleware(options.security),
    validateRequestMiddleware(),
    corsMiddleware(options.allowedOrigins || ['*']),
    timeoutMiddleware(options.timeout || 30000)
  ];
}

// ============================================================================
// Exports
// ============================================================================

export { globalRateLimiter, globalIPBlocker, globalValidator };
