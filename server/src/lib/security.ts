/**
 * WhisperCache Security Middleware
 * 
 * Production-ready security middleware:
 * - Rate limiting
 * - CORS configuration
 * - Security headers (Helmet-like)
 * - Request validation
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface RateLimitConfig {
  /** Time window in seconds */
  windowSeconds: number;
  /** Max requests per window */
  maxRequests: number;
  /** Key generator function */
  keyGenerator?: (req: Request) => string;
  /** Skip rate limiting for certain requests */
  skip?: (req: Request) => boolean;
  /** Custom message */
  message?: string;
}

export interface CorsConfig {
  /** Allowed origins */
  origins: string[];
  /** Allowed methods */
  methods: string[];
  /** Allowed headers */
  allowedHeaders: string[];
  /** Exposed headers */
  exposedHeaders: string[];
  /** Allow credentials */
  credentials: boolean;
  /** Max age for preflight cache */
  maxAge: number;
}

export interface SecurityHeadersConfig {
  /** Enable HSTS */
  hsts: boolean;
  /** Enable noSniff */
  noSniff: boolean;
  /** Frame options */
  frameOptions: 'DENY' | 'SAMEORIGIN' | false;
  /** Content Security Policy */
  csp: string | false;
  /** Referrer policy */
  referrerPolicy: string;
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowSeconds: 60,
  maxRequests: 100,
  message: 'Too many requests, please try again later'
};

const DEFAULT_CORS: CorsConfig = {
  origins: ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-User-Id',
    'X-DID-Wallet',
    'X-Request-Id'
  ],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

const DEFAULT_SECURITY_HEADERS: SecurityHeadersConfig = {
  hsts: true,
  noSniff: true,
  frameOptions: 'DENY',
  csp: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  referrerPolicy: 'strict-origin-when-cross-origin'
};

// ============================================================================
// Rate Limiter Implementation
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  check(key: string, config: RateLimitConfig): { 
    allowed: boolean; 
    remaining: number; 
    resetAt: number 
  } {
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    
    let entry = this.store.get(key);
    
    // Create new entry if doesn't exist or expired
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      this.store.set(key, entry);
    }

    entry.count++;
    
    const allowed = entry.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - entry.count);

    return { allowed, remaining, resetAt: entry.resetAt };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Singleton rate limiter
const rateLimiter = new InMemoryRateLimiter();

// ============================================================================
// Middleware Functions
// ============================================================================

/**
 * Rate limiting middleware
 */
export function rateLimit(config: Partial<RateLimitConfig> = {}): RequestHandler {
  const finalConfig: RateLimitConfig = { ...DEFAULT_RATE_LIMIT, ...config };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip if configured
    if (finalConfig.skip?.(req)) {
      next();
      return;
    }

    // Generate key
    const key = finalConfig.keyGenerator?.(req) || getClientKey(req);
    
    // Check rate limit
    const { allowed, remaining, resetAt } = rateLimiter.check(key, finalConfig);

    // Set headers
    res.setHeader('X-RateLimit-Limit', finalConfig.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000).toString());

    if (!allowed) {
      res.status(429).json({
        success: false,
        error: finalConfig.message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000)
      });
      return;
    }

    next();
  };
}

/**
 * CORS middleware
 */
export function cors(config: Partial<CorsConfig> = {}): RequestHandler {
  const finalConfig: CorsConfig = { ...DEFAULT_CORS, ...config };
  
  // Add production origins from env
  if (process.env.CORS_ORIGINS) {
    finalConfig.origins.push(...process.env.CORS_ORIGINS.split(','));
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    // Check if origin is allowed
    const isAllowed = !origin || 
      finalConfig.origins.includes('*') || 
      finalConfig.origins.includes(origin);

    if (isAllowed && origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', finalConfig.methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', finalConfig.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Expose-Headers', finalConfig.exposedHeaders.join(', '));
    res.setHeader('Access-Control-Max-Age', finalConfig.maxAge.toString());

    if (finalConfig.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

/**
 * Security headers middleware
 */
export function securityHeaders(config: Partial<SecurityHeadersConfig> = {}): RequestHandler {
  const finalConfig: SecurityHeadersConfig = { ...DEFAULT_SECURITY_HEADERS, ...config };

  return (_req: Request, res: Response, next: NextFunction): void => {
    // HSTS
    if (finalConfig.hsts) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // No Sniff
    if (finalConfig.noSniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // Frame Options
    if (finalConfig.frameOptions) {
      res.setHeader('X-Frame-Options', finalConfig.frameOptions);
    }

    // Content Security Policy
    if (finalConfig.csp) {
      res.setHeader('Content-Security-Policy', finalConfig.csp);
    }

    // Referrer Policy
    res.setHeader('Referrer-Policy', finalConfig.referrerPolicy);

    // Additional security headers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('X-Download-Options', 'noopen');

    next();
  };
}

/**
 * Request ID middleware
 */
export function requestId(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = req.headers['x-request-id'] as string || 
      `req_${crypto.randomBytes(8).toString('hex')}`;
    
    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-Id', id);
    
    next();
  };
}

/**
 * Request size limiting middleware
 */
export function requestSizeLimit(maxSizeBytes: number = 1024 * 1024): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (contentLength > maxSizeBytes) {
      res.status(413).json({
        success: false,
        error: 'Request entity too large',
        code: 'PAYLOAD_TOO_LARGE',
        maxSize: maxSizeBytes
      });
      return;
    }

    next();
  };
}

// ============================================================================
// Helpers
// ============================================================================

function getClientKey(req: Request): string {
  // Try to get real IP from various headers
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  
  let ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  if (typeof forwarded === 'string') {
    ip = forwarded.split(',')[0].trim();
  } else if (typeof realIp === 'string') {
    ip = realIp;
  }

  // Also use user ID if available for more accurate limiting
  const userId = req.headers['x-user-id'] as string;
  if (userId) {
    return `${ip}:${userId}`;
  }

  return ip;
}

// ============================================================================
// Combined Security Middleware
// ============================================================================

export interface SecurityOptions {
  rateLimit?: Partial<RateLimitConfig> | false;
  cors?: Partial<CorsConfig> | false;
  securityHeaders?: Partial<SecurityHeadersConfig> | false;
  requestId?: boolean;
  requestSizeLimit?: number | false;
}

/**
 * Apply all security middleware with sensible defaults
 */
export function applySecurity(options: SecurityOptions = {}): RequestHandler[] {
  const middlewares: RequestHandler[] = [];

  // Request ID (always enabled)
  if (options.requestId !== false) {
    middlewares.push(requestId());
  }

  // Security headers
  if (options.securityHeaders !== false) {
    middlewares.push(securityHeaders(
      typeof options.securityHeaders === 'object' ? options.securityHeaders : {}
    ));
  }

  // CORS
  if (options.cors !== false) {
    middlewares.push(cors(
      typeof options.cors === 'object' ? options.cors : {}
    ));
  }

  // Rate limiting
  if (options.rateLimit !== false) {
    middlewares.push(rateLimit(
      typeof options.rateLimit === 'object' ? options.rateLimit : {}
    ));
  }

  // Request size limit
  if (options.requestSizeLimit !== false) {
    middlewares.push(requestSizeLimit(
      typeof options.requestSizeLimit === 'number' ? options.requestSizeLimit : undefined
    ));
  }

  return middlewares;
}

export default {
  rateLimit,
  cors,
  securityHeaders,
  requestId,
  requestSizeLimit,
  applySecurity
};
