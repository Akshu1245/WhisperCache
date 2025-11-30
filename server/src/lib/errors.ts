/**
 * WhisperCache Error Handling
 * 
 * Unified error handling with:
 * - Custom error classes
 * - Standardized error responses
 * - Error logging
 * - Production-safe error messages
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

// ============================================================================
// Error Codes
// ============================================================================

export const ErrorCodes = {
  // General (1xxx)
  INTERNAL_ERROR: 'ERR_INTERNAL',
  VALIDATION_ERROR: 'ERR_VALIDATION',
  NOT_FOUND: 'ERR_NOT_FOUND',
  UNAUTHORIZED: 'ERR_UNAUTHORIZED',
  FORBIDDEN: 'ERR_FORBIDDEN',
  RATE_LIMITED: 'ERR_RATE_LIMITED',
  
  // Auth (2xxx)
  AUTH_MISSING: 'ERR_AUTH_MISSING',
  AUTH_INVALID: 'ERR_AUTH_INVALID',
  AUTH_EXPIRED: 'ERR_AUTH_EXPIRED',
  DID_INVALID: 'ERR_DID_INVALID',
  
  // Memory (3xxx)
  MEMORY_NOT_FOUND: 'ERR_MEMORY_NOT_FOUND',
  MEMORY_ACCESS_DENIED: 'ERR_MEMORY_ACCESS_DENIED',
  MEMORY_REVOKED: 'ERR_MEMORY_REVOKED',
  MEMORY_INVALID: 'ERR_MEMORY_INVALID',
  MEMORY_DUPLICATE: 'ERR_MEMORY_DUPLICATE',
  
  // ZK Proof (4xxx)
  ZK_PROOF_FAILED: 'ERR_ZK_PROOF_FAILED',
  ZK_VERIFICATION_FAILED: 'ERR_ZK_VERIFICATION_FAILED',
  ZK_CIRCUIT_NOT_READY: 'ERR_ZK_CIRCUIT_NOT_READY',
  ZK_QUEUE_FULL: 'ERR_ZK_QUEUE_FULL',
  
  // Blockchain (5xxx)
  BLOCKCHAIN_CONNECTION: 'ERR_BLOCKCHAIN_CONNECTION',
  BLOCKCHAIN_TX_FAILED: 'ERR_BLOCKCHAIN_TX_FAILED',
  BLOCKCHAIN_ANCHOR_FAILED: 'ERR_BLOCKCHAIN_ANCHOR_FAILED',
  
  // Agent (6xxx)
  AGENT_UNAVAILABLE: 'ERR_AGENT_UNAVAILABLE',
  AGENT_CONTEXT_BLOCKED: 'ERR_AGENT_CONTEXT_BLOCKED',
  
  // Key Management (7xxx)
  KEY_NOT_FOUND: 'ERR_KEY_NOT_FOUND',
  KEY_REVOKED: 'ERR_KEY_REVOKED',
  KEY_ROTATION_FAILED: 'ERR_KEY_ROTATION_FAILED'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ============================================================================
// Custom Error Classes
// ============================================================================

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // Can be handled gracefully

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCodes.VALIDATION_ERROR, 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      ErrorCodes.NOT_FOUND,
      404,
      { resource, id }
    );
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, ErrorCodes.UNAUTHORIZED, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, ErrorCodes.FORBIDDEN, 403);
    this.name = 'ForbiddenError';
  }
}

export class MemoryError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.MEMORY_INVALID,
    statusCode: number = 400,
    details?: Record<string, unknown>
  ) {
    super(message, code, statusCode, details);
    this.name = 'MemoryError';
  }

  static notFound(memoryId: string): MemoryError {
    return new MemoryError(
      'Memory not found',
      ErrorCodes.MEMORY_NOT_FOUND,
      404,
      { memoryId }
    );
  }

  static revoked(memoryId: string): MemoryError {
    return new MemoryError(
      'Memory has been revoked and is no longer accessible',
      ErrorCodes.MEMORY_REVOKED,
      410,
      { memoryId }
    );
  }

  static accessDenied(memoryId: string): MemoryError {
    return new MemoryError(
      'Access to this memory is denied',
      ErrorCodes.MEMORY_ACCESS_DENIED,
      403,
      { memoryId }
    );
  }
}

export class ZKError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.ZK_PROOF_FAILED,
    details?: Record<string, unknown>
  ) {
    super(message, code, 500, details);
    this.name = 'ZKError';
  }
}

export class BlockchainError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.BLOCKCHAIN_CONNECTION,
    details?: Record<string, unknown>
  ) {
    super(message, code, 503, details);
    this.name = 'BlockchainError';
  }
}

// ============================================================================
// Error Response Format
// ============================================================================

export interface ErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
  details?: Record<string, unknown>;
  requestId?: string;
  timestamp: string;
}

function formatErrorResponse(
  error: AppError | Error,
  requestId?: string
): ErrorResponse {
  const isAppError = error instanceof AppError;
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    success: false,
    error: isAppError || !isProduction 
      ? error.message 
      : 'An unexpected error occurred',
    code: isAppError ? error.code : ErrorCodes.INTERNAL_ERROR,
    details: isAppError && !isProduction ? error.details : undefined,
    requestId,
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// Error Handler Middleware
// ============================================================================

export const errorHandler: ErrorRequestHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Get request ID if available
  const requestId = req.headers['x-request-id'] as string;

  // Determine status code
  const statusCode = error instanceof AppError 
    ? error.statusCode 
    : 500;

  // Log error
  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  console[logLevel](`[${logLevel.toUpperCase()}] ${error.message}`, {
    code: error instanceof AppError ? error.code : 'UNKNOWN',
    statusCode,
    requestId,
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
  });

  // Send response
  const response = formatErrorResponse(error, requestId);
  res.status(statusCode).json(response);
};

// ============================================================================
// 404 Handler
// ============================================================================

export function notFoundHandler(req: Request, res: Response): void {
  const requestId = req.headers['x-request-id'] as string;
  
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
    code: ErrorCodes.NOT_FOUND,
    requestId,
    timestamp: new Date().toISOString()
  } as ErrorResponse);
}

// ============================================================================
// Async Handler Wrapper
// ============================================================================

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * Wraps async route handlers to catch errors
 */
export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============================================================================
// Success Response Helper
// ============================================================================

export interface SuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
  metadata?: {
    requestId?: string;
    timestamp: string;
    [key: string]: unknown;
  };
}

/**
 * Format a success response
 */
export function successResponse<T>(
  data?: T,
  message?: string,
  metadata?: Record<string, unknown>
): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata
    }
  };
}

export default {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  MemoryError,
  ZKError,
  BlockchainError,
  ErrorCodes,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  successResponse
};
