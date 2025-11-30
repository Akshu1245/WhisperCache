/**
 * WhisperCache Storage Adapter Interface
 * 
 * Defines the contract for data persistence.
 * Supports multiple backends:
 * - SQLite (current implementation)
 * - PostgreSQL (production)
 * - Redis (caching layer)
 */

/**
 * Generic storage record
 */
export interface StorageRecord {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Query options for storage
 */
export interface StorageQuery {
  /** Filter conditions */
  where?: Record<string, unknown>;
  
  /** Order by field */
  orderBy?: string;
  
  /** Order direction */
  order?: 'asc' | 'desc';
  
  /** Limit results */
  limit?: number;
  
  /** Offset for pagination */
  offset?: number;
  
  /** Include soft-deleted records */
  includeDeleted?: boolean;
}

/**
 * Storage adapter interface
 */
export interface IStorageAdapter {
  /**
   * Initialize the storage connection
   */
  connect(): Promise<void>;

  /**
   * Close the storage connection
   */
  disconnect(): Promise<void>;

  /**
   * Check if connected
   */
  isConnected(): boolean;

  /**
   * Insert a record
   */
  insert<T extends StorageRecord>(
    collection: string,
    record: Omit<T, 'createdAt' | 'updatedAt'>
  ): Promise<T>;

  /**
   * Find a record by ID
   */
  findById<T extends StorageRecord>(
    collection: string,
    id: string
  ): Promise<T | null>;

  /**
   * Find records matching query
   */
  find<T extends StorageRecord>(
    collection: string,
    query: StorageQuery
  ): Promise<T[]>;

  /**
   * Update a record
   */
  update<T extends StorageRecord>(
    collection: string,
    id: string,
    updates: Partial<T>
  ): Promise<T | null>;

  /**
   * Delete a record (soft delete)
   */
  delete(collection: string, id: string): Promise<boolean>;

  /**
   * Hard delete a record
   */
  hardDelete(collection: string, id: string): Promise<boolean>;

  /**
   * Count records
   */
  count(collection: string, query?: StorageQuery): Promise<number>;

  /**
   * Health check
   */
  healthCheck(): Promise<{
    healthy: boolean;
    latencyMs: number;
    details?: Record<string, unknown>;
  }>;

  /**
   * Get storage type
   */
  getStorageType(): string;
}

/**
 * Configuration for storage adapters
 */
export interface StorageAdapterConfig {
  /** Storage type: 'sqlite', 'postgres', 'redis' */
  type: 'sqlite' | 'postgres' | 'redis' | 'memory';
  
  /** Connection string or path */
  connectionString?: string;
  
  /** Database file path (SQLite) */
  databasePath?: string;
  
  /** Pool size (PostgreSQL) */
  poolSize?: number;
  
  /** Enable query logging */
  logging?: boolean;
}

/**
 * Factory function type for creating storage adapters
 */
export type StorageAdapterFactory = (config: StorageAdapterConfig) => IStorageAdapter;
