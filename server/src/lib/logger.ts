/**
 * WhisperCache Logger
 * 
 * Structured logging with:
 * - Log levels (debug, info, warn, error)
 * - JSON format for production
 * - Pretty print for development
 * - Request context
 * - Performance timing
 * 
 * For production, consider replacing with:
 * - pino (recommended for performance)
 * - winston (more features)
 */

import { Request, Response, NextFunction } from 'express';

// ============================================================================
// Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface LoggerConfig {
  /** Minimum log level */
  level: LogLevel;
  /** Service name */
  service: string;
  /** Output format: 'json' or 'pretty' */
  format: 'json' | 'pretty';
  /** Include stack traces */
  includeStack: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m'  // Red
};

const RESET_COLOR = '\x1b[0m';

const DEFAULT_CONFIG: LoggerConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  service: process.env.SERVICE_NAME || 'whispercache',
  format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
  includeStack: process.env.NODE_ENV !== 'production'
};

// ============================================================================
// Logger Class
// ============================================================================

export class Logger {
  private config: LoggerConfig;
  private context: Record<string, unknown> = {};

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    const childLogger = new Logger(this.config);
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  /**
   * Log a debug message
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | Record<string, unknown>, metadata?: Record<string, unknown>): void {
    const errorData = error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: this.config.includeStack ? error.stack : undefined
        }
      : undefined;

    const meta = error instanceof Error 
      ? metadata 
      : { ...error, ...metadata };

    this.log('error', message, meta, errorData);
  }

  /**
   * Log a request (middleware helper)
   */
  request(req: Request, res: Response, duration: number): void {
    const level: LogLevel = res.statusCode >= 500 ? 'error' 
      : res.statusCode >= 400 ? 'warn' 
      : 'info';

    this.log(level, `${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      requestId: req.headers['x-request-id'] as string,
      userId: req.headers['x-user-id'] as string,
      userAgent: req.headers['user-agent'],
      contentLength: res.getHeader('content-length')
    });
  }

  /**
   * Core log method
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: LogEntry['error']
  ): void {
    // Check log level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.config.service,
      ...this.context,
      ...metadata,
      error
    };

    // Output based on format
    if (this.config.format === 'json') {
      this.outputJson(entry);
    } else {
      this.outputPretty(entry);
    }
  }

  private outputJson(entry: LogEntry): void {
    console.log(JSON.stringify(entry));
  }

  private outputPretty(entry: LogEntry): void {
    const color = LOG_COLORS[entry.level];
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const time = entry.timestamp.split('T')[1].replace('Z', '');
    
    let output = `${color}${levelStr}${RESET_COLOR} [${time}] ${entry.message}`;

    // Extract metadata (excluding core fields)
    const { level, message, timestamp, service, error, ...meta } = entry;

    if (Object.keys(meta).length > 0) {
      output += ` ${JSON.stringify(meta)}`;
    }

    // Add error stack
    if (error?.stack) {
      output += `\n${error.stack}`;
    }

    console.log(output);
  }
}

// ============================================================================
// Singleton Logger
// ============================================================================

let _logger: Logger | null = null;

export function getLogger(config?: Partial<LoggerConfig>): Logger {
  if (!_logger) {
    _logger = new Logger(config);
  }
  return _logger;
}

export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new Logger(config);
}

// ============================================================================
// Request Logging Middleware
// ============================================================================

export function requestLogger(logger?: Logger) {
  const log = logger || getLogger();

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Log request start
    log.debug(`${req.method} ${req.path} started`, {
      requestId: req.headers['x-request-id'] as string,
      userId: req.headers['x-user-id'] as string
    });

    // Hook into response finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      log.request(req, res, duration);
    });

    next();
  };
}

// ============================================================================
// Performance Timer
// ============================================================================

export class Timer {
  private startTime: number;
  private marks: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  mark(name: string): void {
    this.marks.set(name, Date.now());
  }

  elapsed(): number {
    return Date.now() - this.startTime;
  }

  since(markName: string): number {
    const markTime = this.marks.get(markName);
    return markTime ? Date.now() - markTime : -1;
  }

  getMarks(): Record<string, number> {
    const result: Record<string, number> = {};
    let prevTime = this.startTime;

    for (const [name, time] of this.marks) {
      result[name] = time - prevTime;
      prevTime = time;
    }

    return result;
  }
}

export default {
  Logger,
  getLogger,
  createLogger,
  requestLogger,
  Timer
};
