/**
 * Database Layer using sql.js (SQLite in JavaScript)
 * 
 * Provides persistent storage for:
 * - Organizations (multi-tenancy)
 * - Users with roles
 * - Compliance/audit logs
 * - Memory metadata (not encrypted content)
 * - ZK proof records
 * - Anchor transactions
 * - Policies registry
 */

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Database singleton
let db: Database | null = null;
let SQL: SqlJsStatic | null = null;

// Database file path
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'wishpercache.db');

/**
 * Initialize the database
 */
export async function initDatabase(): Promise<Database> {
  if (db) return db;

  console.log('[Database] Initializing SQLite database...');

  // Initialize sql.js
  SQL = await initSqlJs();

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    console.log(`[Database] Loading existing database from ${DB_PATH}`);
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    console.log('[Database] Creating new database');
    db = new SQL.Database();
  }

  // Create tables
  await createTables();

  // Save database periodically
  setInterval(() => {
    saveDatabase();
  }, 30000); // Every 30 seconds

  console.log('[Database] Database initialized successfully');
  return db;
}

/**
 * Create database tables
 */
async function createTables(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  // ============================================
  // PHASE 1: Create tables with minimal schema
  // ============================================

  // Organizations table (Multi-tenancy) - NEW TABLE
  db.run(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      settings TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User roles table (Org membership + roles) - NEW TABLE
  db.run(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'MEMBER',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (org_id) REFERENCES organizations(id),
      UNIQUE(user_id, org_id)
    )
  `);

  // Users table - core schema (org_id added via migration)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      did_or_wallet TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Compliance logs table - core schema (org_id/user_id added via migration)
  db.run(`
    CREATE TABLE IF NOT EXISTS compliance_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      memory_id TEXT,
      key_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metadata TEXT,
      previous_log_hash TEXT,
      log_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Memory metadata table - core schema (org_id/user_id added via migration)
  db.run(`
    CREATE TABLE IF NOT EXISTS memory_metadata (
      id TEXT PRIMARY KEY,
      key_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      tags TEXT,
      confidence REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    )
  `);

  // ZK proofs table - core schema (org_id/user_id/policy_id added via migration)
  db.run(`
    CREATE TABLE IF NOT EXISTS zk_proofs (
      id TEXT PRIMARY KEY,
      proof_hash TEXT UNIQUE NOT NULL,
      memory_hash TEXT NOT NULL,
      pattern TEXT,
      verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Anchor transactions table - core schema (org_id/user_id added via migration)
  db.run(`
    CREATE TABLE IF NOT EXISTS anchor_transactions (
      id TEXT PRIMARY KEY,
      tx_hash TEXT UNIQUE NOT NULL,
      proof_hash TEXT,
      memory_hash TEXT,
      commitment TEXT,
      block_height INTEGER,
      block_hash TEXT,
      status TEXT,
      network TEXT,
      fees TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      confirmed_at TEXT
    )
  `);

  // Policies table (ZK circuit registry) - NEW TABLE
  db.run(`
    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      circuit_name TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      config TEXT,
      status TEXT DEFAULT 'ACTIVE',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User encryption keys table
  db.run(`
    CREATE TABLE IF NOT EXISTS user_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      key_version INTEGER NOT NULL DEFAULT 1,
      status TEXT DEFAULT 'ACTIVE',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Key rotations table
  db.run(`
    CREATE TABLE IF NOT EXISTS key_rotations (
      id TEXT PRIMARY KEY,
      old_key_id TEXT NOT NULL,
      new_key_id TEXT NOT NULL,
      rotated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reason TEXT
    )
  `);

  // Blockchain anchor log table - Local persistence with optional IPFS
  db.run(`
    CREATE TABLE IF NOT EXISTS blockchain_anchor_log (
      id TEXT PRIMARY KEY,
      proof_hash TEXT NOT NULL,
      memory_hash TEXT,
      anchor_type TEXT NOT NULL DEFAULT 'sqlite',
      simulated_block INTEGER,
      simulated_tx TEXT,
      ipfs_cid TEXT,
      commitment TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ============================================
  // PHASE 2: Run migrations to add new columns
  // ============================================
  await migrateExistingTables();

  // ============================================
  // PHASE 3: Create indexes (after columns exist)
  // ============================================
  
  // Organization indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations(slug)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_org_status ON organizations(status)`);

  // User roles indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_roles_org ON user_roles(org_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role)`);

  // Users indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_did ON users(did_or_wallet)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_org ON users(default_org_id)`);

  // Compliance logs indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_compliance_key_id ON compliance_logs(key_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_compliance_action ON compliance_logs(action)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_compliance_memory ON compliance_logs(memory_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_compliance_user ON compliance_logs(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_compliance_org ON compliance_logs(org_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_compliance_entity ON compliance_logs(entity_type, entity_id)`);

  // Memory metadata indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_memory_key ON memory_metadata(key_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_memory_hash ON memory_metadata(content_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_memory_user ON memory_metadata(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_memory_org ON memory_metadata(org_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_memory_status ON memory_metadata(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_memory_commitment ON memory_metadata(memory_commitment)`);

  // ZK proofs indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_proof_hash ON zk_proofs(proof_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_proof_memory ON zk_proofs(memory_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_proof_user ON zk_proofs(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_proof_org ON zk_proofs(org_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_proof_policy ON zk_proofs(policy_id)`);

  // Anchor transactions indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_anchor_tx ON anchor_transactions(tx_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_anchor_memory ON anchor_transactions(memory_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_anchor_user ON anchor_transactions(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_anchor_org ON anchor_transactions(org_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_anchor_midnight ON anchor_transactions(midnight_tx_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_anchor_cardano ON anchor_transactions(cardano_tx_id)`);

  // Blockchain anchor log indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_anchor_log_proof ON blockchain_anchor_log(proof_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_anchor_log_type ON blockchain_anchor_log(anchor_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_anchor_log_ipfs ON blockchain_anchor_log(ipfs_cid)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_anchor_log_created ON blockchain_anchor_log(created_at)`);

  // Policies indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_policy_name ON policies(name)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_policy_circuit ON policies(circuit_name)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_policy_status ON policies(status)`);

  // User keys indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_keys_user ON user_keys(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_keys_status ON user_keys(status)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_keys_version ON user_keys(user_id, key_version)`);

  // Key rotations indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_rotation_old ON key_rotations(old_key_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_rotation_new ON key_rotations(new_key_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_rotation_user ON key_rotations(user_id)`);
  
  // ============================================
  // PHASE 4: Seed default data
  // ============================================
  await seedDefaultPolicies();
}

/**
 * Migrate existing tables to add new columns
 */
async function migrateExistingTables(): Promise<void> {
  if (!db) return;

  // Check if columns exist and add them if not
  const addColumnIfNotExists = (table: string, column: string, type: string, defaultVal?: string) => {
    try {
      const defaultClause = defaultVal ? ` DEFAULT ${defaultVal}` : '';
      db!.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}${defaultClause}`);
    } catch {
      // Column likely already exists, ignore error
    }
  };

  // Add org_id to tables for multi-tenancy
  addColumnIfNotExists('users', 'default_org_id', 'TEXT');
  addColumnIfNotExists('compliance_logs', 'org_id', 'TEXT');
  addColumnIfNotExists('compliance_logs', 'entity_type', 'TEXT');
  addColumnIfNotExists('compliance_logs', 'entity_id', 'TEXT');
  addColumnIfNotExists('memory_metadata', 'org_id', 'TEXT');
  addColumnIfNotExists('zk_proofs', 'org_id', 'TEXT');
  addColumnIfNotExists('zk_proofs', 'policy_id', 'TEXT');
  addColumnIfNotExists('anchor_transactions', 'org_id', 'TEXT');
  addColumnIfNotExists('anchor_transactions', 'midnight_tx_id', 'TEXT');
  addColumnIfNotExists('anchor_transactions', 'cardano_tx_id', 'TEXT');

  // Add user_id to tables
  addColumnIfNotExists('compliance_logs', 'user_id', 'TEXT');
  addColumnIfNotExists('memory_metadata', 'user_id', 'TEXT');
  addColumnIfNotExists('memory_metadata', 'memory_commitment', 'TEXT');
  addColumnIfNotExists('memory_metadata', 'status', 'TEXT', "'ACTIVE'");
  addColumnIfNotExists('memory_metadata', 'key_version', 'INTEGER', '1');
  addColumnIfNotExists('zk_proofs', 'user_id', 'TEXT');
  addColumnIfNotExists('zk_proofs', 'circuit_version', 'INTEGER', '1');
  addColumnIfNotExists('zk_proofs', 'status_valid', 'INTEGER', '1');
  addColumnIfNotExists('zk_proofs', 'key_version_valid', 'INTEGER', '1');
  addColumnIfNotExists('anchor_transactions', 'user_id', 'TEXT');
  addColumnIfNotExists('key_rotations', 'user_id', 'TEXT');
}

/**
 * Seed default policies for ZK circuits
 */
async function seedDefaultPolicies(): Promise<void> {
  if (!db) return;

  const defaultPolicies = [
    {
      id: 'policy_memory_pattern_basic',
      name: 'memory_pattern_basic',
      description: 'Basic memory pattern verification - proves memory matches tag patterns',
      circuitName: 'memory_pattern',
      version: 1,
      config: JSON.stringify({ tags: ['finance', 'health', 'personal'] })
    },
    {
      id: 'policy_finance_only',
      name: 'finance_only',
      description: 'Finance-only policy - allows access only to finance-tagged memories',
      circuitName: 'memory_pattern',
      version: 1,
      config: JSON.stringify({ allowedTags: ['finance'], deniedTags: ['health', 'personal'] })
    },
    {
      id: 'policy_no_health_data',
      name: 'no_health_data',
      description: 'No health data policy - proves memory does not contain health information',
      circuitName: 'memory_pattern',
      version: 1,
      config: JSON.stringify({ deniedTags: ['health', 'medical', 'hipaa'] })
    },
    {
      id: 'policy_gdpr_compliant',
      name: 'gdpr_compliant',
      description: 'GDPR compliant access - no personal data without consent proof',
      circuitName: 'memory_pattern',
      version: 1,
      config: JSON.stringify({ requiresConsent: true, deniedTags: ['pii', 'personal'] })
    }
  ];

  for (const policy of defaultPolicies) {
    try {
      db.run(
        `INSERT OR IGNORE INTO policies (id, name, description, circuit_name, version, config, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
        [policy.id, policy.name, policy.description, policy.circuitName, policy.version, policy.config, new Date().toISOString()]
      );
    } catch {
      // Policy already exists
    }
  }
}

/**
 * Save database to disk
 */
export function saveDatabase(): void {
  if (!db) return;
  
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    console.log('[Database] Database saved to disk');
  } catch (error) {
    console.error('[Database] Failed to save database:', error);
  }
}

/**
 * Get database instance
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// ============================================
// USER OPERATIONS
// ============================================

export interface User {
  id: string;
  didOrWallet: string;
  defaultOrgId?: string;
  createdAt: string;
  lastSeenAt: string;
}

export function findOrCreateUser(didOrWallet: string, defaultOrgId?: string): User {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  // Try to find existing user
  const result = db.exec('SELECT * FROM users WHERE did_or_wallet = ?', [didOrWallet]);
  
  if (result.length && result[0].values.length) {
    const row = result[0].values[0];
    const user: User = {
      id: row[0] as string,
      didOrWallet: row[1] as string,
      defaultOrgId: row[2] as string | undefined,
      createdAt: row[3] as string,
      lastSeenAt: row[4] as string
    };
    
    // Update last seen
    db.run('UPDATE users SET last_seen_at = ? WHERE id = ?', [now, user.id]);
    user.lastSeenAt = now;
    
    return user;
  }
  
  // Create new user
  const userId = `user_${crypto.randomBytes(12).toString('hex')}`;
  db.run(
    'INSERT INTO users (id, did_or_wallet, default_org_id, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
    [userId, didOrWallet, defaultOrgId || null, now, now]
  );
  
  return {
    id: userId,
    didOrWallet,
    defaultOrgId,
    createdAt: now,
    lastSeenAt: now
  };
}

export function getUserById(id: string): User | null {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM users WHERE id = ?', [id]);
  
  if (!result.length || !result[0].values.length) return null;
  
  const row = result[0].values[0];
  return {
    id: row[0] as string,
    didOrWallet: row[1] as string,
    defaultOrgId: row[2] as string | undefined,
    createdAt: row[3] as string,
    lastSeenAt: row[4] as string
  };
}

export function getUserByDidOrWallet(didOrWallet: string): User | null {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM users WHERE did_or_wallet = ?', [didOrWallet]);
  
  if (!result.length || !result[0].values.length) return null;
  
  const row = result[0].values[0];
  return {
    id: row[0] as string,
    didOrWallet: row[1] as string,
    defaultOrgId: row[2] as string | undefined,
    createdAt: row[3] as string,
    lastSeenAt: row[4] as string
  };
}

export function getUserCount(): number {
  const db = getDatabase();
  const result = db.exec('SELECT COUNT(*) FROM users');
  return result.length ? (result[0].values[0][0] as number) : 0;
}

// ============================================
// COMPLIANCE LOG OPERATIONS
// ============================================

export interface ComplianceLog {
  id: string;
  userId?: string;
  action: string;
  memoryId?: string;
  keyId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  previousLogHash?: string;
  logHash: string;
}

export function insertComplianceLog(log: ComplianceLog): void {
  const db = getDatabase();
  db.run(
    `INSERT INTO compliance_logs (id, user_id, action, memory_id, key_id, timestamp, metadata, previous_log_hash, log_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.userId || null,
      log.action,
      log.memoryId || null,
      log.keyId,
      log.timestamp,
      log.metadata ? JSON.stringify(log.metadata) : null,
      log.previousLogHash || null,
      log.logHash
    ]
  );
}

export function getComplianceLogs(options: {
  userId?: string;
  keyId?: string;
  action?: string;
  memoryId?: string;
  limit?: number;
}): ComplianceLog[] {
  const db = getDatabase();
  let query = 'SELECT * FROM compliance_logs WHERE 1=1';
  const params: any[] = [];

  if (options.userId) {
    query += ' AND user_id = ?';
    params.push(options.userId);
  }
  if (options.keyId) {
    query += ' AND key_id = ?';
    params.push(options.keyId);
  }
  if (options.action) {
    query += ' AND action = ?';
    params.push(options.action);
  }
  if (options.memoryId) {
    query += ' AND memory_id = ?';
    params.push(options.memoryId);
  }

  query += ' ORDER BY created_at DESC';

  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  const result = db.exec(query, params);
  if (!result.length) return [];

  return result[0].values.map((row: any) => ({
    id: row[0],
    userId: row[1] || undefined,
    action: row[2],
    memoryId: row[3] || undefined,
    keyId: row[4],
    timestamp: row[5],
    metadata: row[6] ? JSON.parse(row[6]) : undefined,
    previousLogHash: row[7] || undefined,
    logHash: row[8]
  }));
}

export function getLatestLogHash(): string {
  const db = getDatabase();
  const result = db.exec('SELECT log_hash FROM compliance_logs ORDER BY created_at DESC LIMIT 1');
  
  if (!result.length || !result[0].values.length) {
    return 'genesis';
  }
  
  return result[0].values[0][0] as string;
}

export function getComplianceLogCount(): number {
  const db = getDatabase();
  const result = db.exec('SELECT COUNT(*) FROM compliance_logs');
  return result.length ? (result[0].values[0][0] as number) : 0;
}

// ============================================
// MEMORY METADATA OPERATIONS
// ============================================

export type MemoryStatus = 'ACTIVE' | 'DELETED' | 'REVOKED';

export interface MemoryMetadata {
  id: string;
  userId?: string;
  keyId: string;
  memoryCommitment?: string;
  contentHash: string;
  tags?: string[];
  confidence?: number;
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function insertMemoryMetadata(metadata: MemoryMetadata): void {
  const db = getDatabase();
  db.run(
    `INSERT INTO memory_metadata (id, user_id, key_id, memory_commitment, content_hash, tags, confidence, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      metadata.id,
      metadata.userId || null,
      metadata.keyId,
      metadata.memoryCommitment || null,
      metadata.contentHash,
      metadata.tags ? JSON.stringify(metadata.tags) : null,
      metadata.confidence || null,
      metadata.status || 'ACTIVE',
      metadata.createdAt,
      metadata.updatedAt
    ]
  );
}

export function updateMemoryMetadata(id: string, updates: Partial<MemoryMetadata>): void {
  const db = getDatabase();
  const setClauses: string[] = [];
  const params: any[] = [];

  if (updates.contentHash) {
    setClauses.push('content_hash = ?');
    params.push(updates.contentHash);
  }
  if (updates.tags) {
    setClauses.push('tags = ?');
    params.push(JSON.stringify(updates.tags));
  }
  if (updates.confidence !== undefined) {
    setClauses.push('confidence = ?');
    params.push(updates.confidence);
  }
  if (updates.deletedAt) {
    setClauses.push('deleted_at = ?');
    params.push(updates.deletedAt);
  }

  setClauses.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.run(`UPDATE memory_metadata SET ${setClauses.join(', ')} WHERE id = ?`, params);
}

export function getMemoryMetadata(id: string, includeRevoked: boolean = false): MemoryMetadata | null {
  const db = getDatabase();
  const query = includeRevoked 
    ? 'SELECT * FROM memory_metadata WHERE id = ?'
    : 'SELECT * FROM memory_metadata WHERE id = ? AND deleted_at IS NULL';
  const result = db.exec(query, [id]);
  
  if (!result.length || !result[0].values.length) return null;

  const row = result[0].values[0];
  return {
    id: row[0] as string,
    userId: row[1] as string | undefined,
    keyId: row[2] as string,
    memoryCommitment: row[3] as string | undefined,
    contentHash: row[4] as string,
    tags: row[5] ? JSON.parse(row[5] as string) : undefined,
    confidence: row[6] as number | undefined,
    status: (row[7] as MemoryStatus) || 'ACTIVE',
    createdAt: row[8] as string,
    updatedAt: row[9] as string,
    deletedAt: row[10] as string | undefined
  };
}

export function getMemoriesByKeyId(keyId: string): MemoryMetadata[] {
  const db = getDatabase();
  const result = db.exec(
    'SELECT * FROM memory_metadata WHERE key_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
    [keyId]
  );
  
  if (!result.length) return [];

  return result[0].values.map((row: any) => ({
    id: row[0],
    userId: row[1] || undefined,
    keyId: row[2],
    memoryCommitment: row[3] || undefined,
    contentHash: row[4],
    tags: row[5] ? JSON.parse(row[5]) : undefined,
    confidence: row[6],
    status: row[7] || 'ACTIVE',
    createdAt: row[8],
    updatedAt: row[9],
    deletedAt: row[10]
  }));
}

export function getMemoriesByUserId(userId: string, options?: {
  status?: MemoryStatus;
  tags?: string[];
  limit?: number;
  offset?: number;
}): MemoryMetadata[] {
  const db = getDatabase();
  let query = 'SELECT * FROM memory_metadata WHERE user_id = ? AND deleted_at IS NULL';
  const params: any[] = [userId];

  if (options?.status) {
    query += ' AND status = ?';
    params.push(options.status);
  }

  if (options?.tags && options.tags.length > 0) {
    // Filter by tags (JSON contains check)
    const tagConditions = options.tags.map(() => "tags LIKE ?").join(' OR ');
    query += ` AND (${tagConditions})`;
    options.tags.forEach(tag => params.push(`%"${tag}"%`));
  }

  query += ' ORDER BY created_at DESC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const result = db.exec(query, params);
  if (!result.length) return [];

  return result[0].values.map((row: any) => ({
    id: row[0],
    userId: row[1] || undefined,
    keyId: row[2],
    memoryCommitment: row[3] || undefined,
    contentHash: row[4],
    tags: row[5] ? JSON.parse(row[5]) : undefined,
    confidence: row[6],
    status: row[7] || 'ACTIVE',
    createdAt: row[8],
    updatedAt: row[9],
    deletedAt: row[10]
  }));
}

export function getMemoryByCommitment(commitment: string): MemoryMetadata | null {
  const db = getDatabase();
  const result = db.exec(
    'SELECT * FROM memory_metadata WHERE memory_commitment = ? AND deleted_at IS NULL',
    [commitment]
  );
  
  if (!result.length || !result[0].values.length) return null;

  const row = result[0].values[0];
  return {
    id: row[0] as string,
    userId: row[1] as string | undefined,
    keyId: row[2] as string,
    memoryCommitment: row[3] as string | undefined,
    contentHash: row[4] as string,
    tags: row[5] ? JSON.parse(row[5] as string) : undefined,
    confidence: row[6] as number | undefined,
    status: (row[7] as MemoryStatus) || 'ACTIVE',
    createdAt: row[8] as string,
    updatedAt: row[9] as string,
    deletedAt: row[10] as string | undefined
  };
}

export function updateMemoryStatus(id: string, status: MemoryStatus): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const deletedAt = status === 'DELETED' || status === 'REVOKED' ? now : null;
  
  db.run(
    'UPDATE memory_metadata SET status = ?, updated_at = ?, deleted_at = ? WHERE id = ?',
    [status, now, deletedAt, id]
  );
}

export function countMemoriesByUserId(userId: string, status?: MemoryStatus): number {
  const db = getDatabase();
  let query = 'SELECT COUNT(*) FROM memory_metadata WHERE user_id = ? AND deleted_at IS NULL';
  const params: any[] = [userId];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  const result = db.exec(query, params);
  return result.length ? (result[0].values[0][0] as number) : 0;
}

// ============================================
// ZK PROOF OPERATIONS
// ============================================

export interface ZKProofRecord {
  id: string;
  userId?: string;
  orgId?: string;
  policyId?: string;
  proofHash: string;
  memoryHash: string;
  pattern?: string;
  verified: boolean;
  createdAt: string;
}

export function insertZKProof(proof: ZKProofRecord): void {
  const db = getDatabase();
  db.run(
    `INSERT INTO zk_proofs (id, user_id, org_id, policy_id, proof_hash, memory_hash, pattern, verified, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      proof.id,
      proof.userId || null,
      proof.orgId || null,
      proof.policyId || null,
      proof.proofHash,
      proof.memoryHash,
      proof.pattern || null,
      proof.verified ? 1 : 0,
      proof.createdAt
    ]
  );
}

export function getZKProofByHash(proofHash: string): ZKProofRecord | null {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM zk_proofs WHERE proof_hash = ?', [proofHash]);
  
  if (!result.length || !result[0].values.length) return null;

  const row = result[0].values[0];
  return {
    id: row[0] as string,
    userId: row[1] as string | undefined,
    proofHash: row[2] as string,
    memoryHash: row[3] as string,
    pattern: row[4] as string | undefined,
    verified: row[5] === 1,
    createdAt: row[6] as string
  };
}

export function updateZKProofVerification(proofHash: string, verified: boolean): void {
  const db = getDatabase();
  db.run('UPDATE zk_proofs SET verified = ? WHERE proof_hash = ?', [verified ? 1 : 0, proofHash]);
}

// ============================================
// ANCHOR TRANSACTION OPERATIONS
// ============================================

export interface AnchorRecord {
  id: string;
  userId?: string;
  txHash: string;
  proofHash?: string;
  memoryHash?: string;
  commitment?: string;
  blockHeight?: number;
  blockHash?: string;
  status: string;
  network: string;
  fees?: string;
  createdAt: string;
  confirmedAt?: string;
}

export function insertAnchorTransaction(anchor: AnchorRecord): void {
  const db = getDatabase();
  db.run(
    `INSERT INTO anchor_transactions (id, user_id, tx_hash, proof_hash, memory_hash, commitment, block_height, block_hash, status, network, fees, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      anchor.id,
      anchor.userId || null,
      anchor.txHash,
      anchor.proofHash || null,
      anchor.memoryHash || null,
      anchor.commitment || null,
      anchor.blockHeight || null,
      anchor.blockHash || null,
      anchor.status,
      anchor.network,
      anchor.fees || null,
      anchor.createdAt
    ]
  );
}

export function updateAnchorStatus(txHash: string, status: string, confirmedAt?: string): void {
  const db = getDatabase();
  if (confirmedAt) {
    db.run('UPDATE anchor_transactions SET status = ?, confirmed_at = ? WHERE tx_hash = ?', 
      [status, confirmedAt, txHash]);
  } else {
    db.run('UPDATE anchor_transactions SET status = ? WHERE tx_hash = ?', [status, txHash]);
  }
}

export function getAnchorByTxHash(txHash: string): AnchorRecord | null {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM anchor_transactions WHERE tx_hash = ?', [txHash]);
  
  if (!result.length || !result[0].values.length) return null;

  const row = result[0].values[0];
  return {
    id: row[0] as string,
    userId: row[1] as string | undefined,
    txHash: row[2] as string,
    proofHash: row[3] as string | undefined,
    memoryHash: row[4] as string | undefined,
    commitment: row[5] as string | undefined,
    blockHeight: row[6] as number | undefined,
    blockHash: row[7] as string | undefined,
    status: row[8] as string,
    network: row[9] as string,
    fees: row[10] as string | undefined,
    createdAt: row[11] as string,
    confirmedAt: row[12] as string | undefined
  };
}

export function getAnchorsByMemoryHash(memoryHash: string): AnchorRecord[] {
  const db = getDatabase();
  const result = db.exec(
    'SELECT * FROM anchor_transactions WHERE memory_hash = ? ORDER BY created_at DESC',
    [memoryHash]
  );
  
  if (!result.length) return [];

  return result[0].values.map((row: any) => ({
    id: row[0],
    userId: row[1] || undefined,
    txHash: row[2],
    proofHash: row[3],
    memoryHash: row[4],
    commitment: row[5],
    blockHeight: row[6],
    blockHash: row[7],
    status: row[8],
    network: row[9],
    fees: row[10],
    createdAt: row[11],
    confirmedAt: row[12]
  }));
}

// ============================================
// BLOCKCHAIN ANCHOR LOG OPERATIONS
// ============================================

export type AnchorType = 'sqlite' | 'ipfs' | 'midnight' | 'cardano';

export interface BlockchainAnchorLog {
  id: string;
  proofHash: string;
  memoryHash?: string;
  anchorType: AnchorType;
  simulatedBlock?: number;
  simulatedTx?: string;
  ipfsCid?: string;
  commitment?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Insert a new anchor log entry
 */
export function insertAnchorLog(log: BlockchainAnchorLog): void {
  const db = getDatabase();
  db.run(
    `INSERT INTO blockchain_anchor_log 
     (id, proof_hash, memory_hash, anchor_type, simulated_block, simulated_tx, ipfs_cid, commitment, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.proofHash,
      log.memoryHash || null,
      log.anchorType,
      log.simulatedBlock || null,
      log.simulatedTx || null,
      log.ipfsCid || null,
      log.commitment || null,
      log.metadata ? JSON.stringify(log.metadata) : null,
      log.createdAt
    ]
  );
}

/**
 * Get anchor log by proof hash
 */
export function getAnchorLogByProofHash(proofHash: string): BlockchainAnchorLog | null {
  const db = getDatabase();
  const result = db.exec(
    'SELECT * FROM blockchain_anchor_log WHERE proof_hash = ? ORDER BY created_at DESC LIMIT 1',
    [proofHash]
  );
  
  if (!result.length || !result[0].values.length) return null;
  
  const row = result[0].values[0];
  return {
    id: row[0] as string,
    proofHash: row[1] as string,
    memoryHash: row[2] as string | undefined,
    anchorType: row[3] as AnchorType,
    simulatedBlock: row[4] as number | undefined,
    simulatedTx: row[5] as string | undefined,
    ipfsCid: row[6] as string | undefined,
    commitment: row[7] as string | undefined,
    metadata: row[8] ? JSON.parse(row[8] as string) : undefined,
    createdAt: row[9] as string
  };
}

/**
 * Get anchor log by IPFS CID
 */
export function getAnchorLogByIpfsCid(ipfsCid: string): BlockchainAnchorLog | null {
  const db = getDatabase();
  const result = db.exec(
    'SELECT * FROM blockchain_anchor_log WHERE ipfs_cid = ?',
    [ipfsCid]
  );
  
  if (!result.length || !result[0].values.length) return null;
  
  const row = result[0].values[0];
  return {
    id: row[0] as string,
    proofHash: row[1] as string,
    memoryHash: row[2] as string | undefined,
    anchorType: row[3] as AnchorType,
    simulatedBlock: row[4] as number | undefined,
    simulatedTx: row[5] as string | undefined,
    ipfsCid: row[6] as string | undefined,
    commitment: row[7] as string | undefined,
    metadata: row[8] ? JSON.parse(row[8] as string) : undefined,
    createdAt: row[9] as string
  };
}

/**
 * Get recent anchor logs
 */
export function getRecentAnchorLogs(limit: number = 10): BlockchainAnchorLog[] {
  const db = getDatabase();
  const result = db.exec(
    'SELECT * FROM blockchain_anchor_log ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
  
  if (!result.length) return [];
  
  return result[0].values.map((row: any) => ({
    id: row[0] as string,
    proofHash: row[1] as string,
    memoryHash: row[2] as string | undefined,
    anchorType: row[3] as AnchorType,
    simulatedBlock: row[4] as number | undefined,
    simulatedTx: row[5] as string | undefined,
    ipfsCid: row[6] as string | undefined,
    commitment: row[7] as string | undefined,
    metadata: row[8] ? JSON.parse(row[8] as string) : undefined,
    createdAt: row[9] as string
  }));
}

/**
 * Get anchor statistics
 */
export function getAnchorLogStats(): { total: number; byType: Record<string, number> } {
  const db = getDatabase();
  const totalResult = db.exec('SELECT COUNT(*) FROM blockchain_anchor_log');
  const total = (totalResult[0]?.values[0]?.[0] as number) || 0;
  
  const byTypeResult = db.exec(
    'SELECT anchor_type, COUNT(*) FROM blockchain_anchor_log GROUP BY anchor_type'
  );
  
  const byType: Record<string, number> = {};
  if (byTypeResult.length && byTypeResult[0].values) {
    for (const row of byTypeResult[0].values) {
      byType[row[0] as string] = row[1] as number;
    }
  }
  
  return { total, byType };
}

// ============================================
// USER KEY OPERATIONS
// ============================================

export type KeyStatus = 'ACTIVE' | 'REVOKED';

export interface UserKey {
  id: string;
  userId: string;
  keyVersion: number;
  status: KeyStatus;
  createdAt: string;
  revokedAt?: string;
}

export function insertUserKey(key: UserKey): void {
  const db = getDatabase();
  db.run(
    `INSERT INTO user_keys (id, user_id, key_version, status, created_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      key.id,
      key.userId,
      key.keyVersion,
      key.status,
      key.createdAt,
      key.revokedAt || null
    ]
  );
}

export function getActiveUserKey(userId: string): UserKey | null {
  const db = getDatabase();
  const result = db.exec(
    'SELECT * FROM user_keys WHERE user_id = ? AND status = ? ORDER BY key_version DESC LIMIT 1',
    [userId, 'ACTIVE']
  );
  
  if (!result.length || !result[0].values.length) return null;

  const row = result[0].values[0];
  return {
    id: row[0] as string,
    userId: row[1] as string,
    keyVersion: row[2] as number,
    status: row[3] as KeyStatus,
    createdAt: row[4] as string,
    revokedAt: row[5] as string | undefined
  };
}

export function getUserKeyById(keyId: string): UserKey | null {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM user_keys WHERE id = ?', [keyId]);
  
  if (!result.length || !result[0].values.length) return null;

  const row = result[0].values[0];
  return {
    id: row[0] as string,
    userId: row[1] as string,
    keyVersion: row[2] as number,
    status: row[3] as KeyStatus,
    createdAt: row[4] as string,
    revokedAt: row[5] as string | undefined
  };
}

export function getLatestKeyVersion(userId: string): number {
  const db = getDatabase();
  const result = db.exec(
    'SELECT MAX(key_version) FROM user_keys WHERE user_id = ?',
    [userId]
  );
  
  if (!result.length || !result[0].values.length || result[0].values[0][0] === null) {
    return 0;
  }
  
  return result[0].values[0][0] as number;
}

export function revokeUserKey(keyId: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.run(
    'UPDATE user_keys SET status = ?, revoked_at = ? WHERE id = ?',
    ['REVOKED', now, keyId]
  );
}

export function getUserKeys(userId: string): UserKey[] {
  const db = getDatabase();
  const result = db.exec(
    'SELECT * FROM user_keys WHERE user_id = ? ORDER BY key_version DESC',
    [userId]
  );
  
  if (!result.length) return [];

  return result[0].values.map((row: any) => ({
    id: row[0],
    userId: row[1],
    keyVersion: row[2],
    status: row[3],
    createdAt: row[4],
    revokedAt: row[5]
  }));
}

// ============================================
// KEY ROTATION OPERATIONS
// ============================================

export interface KeyRotationRecord {
  id: string;
  oldKeyId: string;
  newKeyId: string;
  rotatedAt: string;
  reason?: string;
}

export function insertKeyRotation(rotation: KeyRotationRecord): void {
  const db = getDatabase();
  db.run(
    `INSERT INTO key_rotations (id, old_key_id, new_key_id, rotated_at, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [
      rotation.id,
      rotation.oldKeyId,
      rotation.newKeyId,
      rotation.rotatedAt,
      rotation.reason || null
    ]
  );
}

export function getKeyRotations(keyId: string): KeyRotationRecord[] {
  const db = getDatabase();
  const result = db.exec(
    'SELECT * FROM key_rotations WHERE old_key_id = ? OR new_key_id = ? ORDER BY rotated_at DESC',
    [keyId, keyId]
  );
  
  if (!result.length) return [];

  return result[0].values.map((row: any) => ({
    id: row[0],
    oldKeyId: row[1],
    newKeyId: row[2],
    rotatedAt: row[3],
    reason: row[4]
  }));
}

// ============================================
// KEY VERSION OPERATIONS (for ZK V2 circuit)
// ============================================

/**
 * Get the current (highest) active key version for a user
 */
export function getCurrentKeyVersion(userId: string): number {
  const db = getDatabase();
  const result = db.exec(
    `SELECT MAX(key_version) FROM user_keys WHERE user_id = ? AND status = 'ACTIVE'`,
    [userId]
  );
  
  if (!result.length || result[0].values[0][0] === null) {
    return 1; // Default to version 1 if no keys exist
  }
  
  return result[0].values[0][0] as number;
}

/**
 * Get the minimum valid key version for a user (oldest non-revoked key)
 * For ZK proof validation, proofs must use keys >= minKeyVersion
 */
export function getMinKeyVersion(userId: string): number {
  const db = getDatabase();
  const result = db.exec(
    `SELECT MIN(key_version) FROM user_keys WHERE user_id = ? AND status = 'ACTIVE'`,
    [userId]
  );
  
  if (!result.length || result[0].values[0][0] === null) {
    return 1;
  }
  
  return result[0].values[0][0] as number;
}

/**
 * Get the current active key for a user
 */
export function getCurrentKey(userId: string): UserKey | null {
  const db = getDatabase();
  const currentVersion = getCurrentKeyVersion(userId);
  const result = db.exec(
    `SELECT * FROM user_keys WHERE user_id = ? AND key_version = ? AND status = 'ACTIVE'`,
    [userId, currentVersion]
  );
  
  if (!result.length || !result[0].values.length) {
    return null;
  }
  
  const row = result[0].values[0];
  return {
    id: row[0] as string,
    userId: row[1] as string,
    keyVersion: row[2] as number,
    status: row[3] as KeyStatus,
    createdAt: row[4] as string,
    revokedAt: row[5] as string | undefined
  };
}

/**
 * Check if a key version is valid for a user
 */
export function isKeyVersionValid(userId: string, keyVersion: number): boolean {
  const minVersion = getMinKeyVersion(userId);
  const currentVersion = getCurrentKeyVersion(userId);
  return keyVersion >= minVersion && keyVersion <= currentVersion;
}

/**
 * Get the key version for a specific memory
 */
export function getMemoryKeyVersion(memoryId: string): number {
  const db = getDatabase();
  const result = db.exec(
    `SELECT key_version FROM memory_metadata WHERE id = ?`,
    [memoryId]
  );
  
  if (!result.length || result[0].values[0][0] === null) {
    return 1; // Default to version 1
  }
  
  return result[0].values[0][0] as number;
}

// ============================================
// DATABASE STATS
// ============================================

export function getDatabaseStats(): {
  complianceLogs: number;
  memories: number;
  zkProofs: number;
  anchors: number;
  keyRotations: number;
  organizations: number;
  users: number;
  policies: number;
} {
  const db = getDatabase();
  
  const logCount = db.exec('SELECT COUNT(*) FROM compliance_logs')[0]?.values[0][0] as number || 0;
  const memoryCount = db.exec('SELECT COUNT(*) FROM memory_metadata WHERE deleted_at IS NULL')[0]?.values[0][0] as number || 0;
  const proofCount = db.exec('SELECT COUNT(*) FROM zk_proofs')[0]?.values[0][0] as number || 0;
  const anchorCount = db.exec('SELECT COUNT(*) FROM anchor_transactions')[0]?.values[0][0] as number || 0;
  const rotationCount = db.exec('SELECT COUNT(*) FROM key_rotations')[0]?.values[0][0] as number || 0;
  
  let orgCount = 0;
  let userCount = 0;
  let policyCount = 0;
  try {
    orgCount = db.exec('SELECT COUNT(*) FROM organizations')[0]?.values[0][0] as number || 0;
    userCount = db.exec('SELECT COUNT(*) FROM users')[0]?.values[0][0] as number || 0;
    policyCount = db.exec('SELECT COUNT(*) FROM policies')[0]?.values[0][0] as number || 0;
  } catch {
    // Tables may not exist yet
  }

  return {
    complianceLogs: logCount,
    memories: memoryCount,
    zkProofs: proofCount,
    anchors: anchorCount,
    keyRotations: rotationCount,
    organizations: orgCount,
    users: userCount,
    policies: policyCount
  };
}

// ============================================
// ORGANIZATION OPERATIONS
// ============================================

export type OrgStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function createOrganization(org: Omit<Organization, 'createdAt' | 'updatedAt'>): Organization {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  db.run(
    `INSERT INTO organizations (id, name, slug, status, settings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      org.id,
      org.name,
      org.slug,
      org.status || 'ACTIVE',
      org.settings ? JSON.stringify(org.settings) : null,
      now,
      now
    ]
  );
  
  return { ...org, status: org.status || 'ACTIVE', createdAt: now, updatedAt: now };
}

export function getOrganizationById(id: string): Organization | null {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM organizations WHERE id = ?', [id]);
  
  if (!result.length || !result[0].values.length) return null;
  
  const row = result[0].values[0];
  return {
    id: row[0] as string,
    name: row[1] as string,
    slug: row[2] as string,
    status: (row[3] as OrgStatus) || 'ACTIVE',
    settings: row[4] ? JSON.parse(row[4] as string) : undefined,
    createdAt: row[5] as string,
    updatedAt: row[6] as string
  };
}

export function getOrganizationBySlug(slug: string): Organization | null {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM organizations WHERE slug = ?', [slug]);
  
  if (!result.length || !result[0].values.length) return null;
  
  const row = result[0].values[0];
  return {
    id: row[0] as string,
    name: row[1] as string,
    slug: row[2] as string,
    status: (row[3] as OrgStatus) || 'ACTIVE',
    settings: row[4] ? JSON.parse(row[4] as string) : undefined,
    createdAt: row[5] as string,
    updatedAt: row[6] as string
  };
}

export function updateOrganization(id: string, updates: Partial<Organization>): void {
  const db = getDatabase();
  const setClauses: string[] = [];
  const params: any[] = [];
  
  if (updates.name) {
    setClauses.push('name = ?');
    params.push(updates.name);
  }
  if (updates.slug) {
    setClauses.push('slug = ?');
    params.push(updates.slug);
  }
  if (updates.status) {
    setClauses.push('status = ?');
    params.push(updates.status);
  }
  if (updates.settings) {
    setClauses.push('settings = ?');
    params.push(JSON.stringify(updates.settings));
  }
  
  if (setClauses.length === 0) return;
  
  setClauses.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  
  db.run(`UPDATE organizations SET ${setClauses.join(', ')} WHERE id = ?`, params);
}

export function listOrganizations(status?: OrgStatus): Organization[] {
  const db = getDatabase();
  let query = 'SELECT * FROM organizations';
  const params: any[] = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const result = db.exec(query, params);
  if (!result.length) return [];
  
  return result[0].values.map((row: any) => ({
    id: row[0],
    name: row[1],
    slug: row[2],
    status: row[3] || 'ACTIVE',
    settings: row[4] ? JSON.parse(row[4]) : undefined,
    createdAt: row[5],
    updatedAt: row[6]
  }));
}

// ============================================
// USER ROLE OPERATIONS
// ============================================

export type UserRole = 'ADMIN' | 'MEMBER' | 'AUDITOR';

export interface UserRoleRecord {
  id: string;
  userId: string;
  orgId: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export function assignUserRole(userId: string, orgId: string, role: UserRole): UserRoleRecord {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = `role_${crypto.randomBytes(12).toString('hex')}`;
  
  // Upsert - update if exists, insert if not
  db.run(
    `INSERT INTO user_roles (id, user_id, org_id, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, org_id) DO UPDATE SET role = ?, updated_at = ?`,
    [id, userId, orgId, role, now, now, role, now]
  );
  
  return { id, userId, orgId, role, createdAt: now, updatedAt: now };
}

export function getUserRole(userId: string, orgId: string): UserRoleRecord | null {
  const db = getDatabase();
  const result = db.exec(
    'SELECT * FROM user_roles WHERE user_id = ? AND org_id = ?',
    [userId, orgId]
  );
  
  if (!result.length || !result[0].values.length) return null;
  
  const row = result[0].values[0];
  return {
    id: row[0] as string,
    userId: row[1] as string,
    orgId: row[2] as string,
    role: row[3] as UserRole,
    createdAt: row[4] as string,
    updatedAt: row[5] as string
  };
}

export function getUserOrganizations(userId: string): Array<{ org: Organization; role: UserRole }> {
  const db = getDatabase();
  const result = db.exec(
    `SELECT o.*, ur.role FROM organizations o
     INNER JOIN user_roles ur ON o.id = ur.org_id
     WHERE ur.user_id = ? AND o.status = 'ACTIVE'
     ORDER BY o.created_at DESC`,
    [userId]
  );
  
  if (!result.length) return [];
  
  return result[0].values.map((row: any) => ({
    org: {
      id: row[0],
      name: row[1],
      slug: row[2],
      status: row[3] || 'ACTIVE',
      settings: row[4] ? JSON.parse(row[4]) : undefined,
      createdAt: row[5],
      updatedAt: row[6]
    },
    role: row[7] as UserRole
  }));
}

export function getOrganizationMembers(orgId: string): Array<{ user: User; role: UserRole }> {
  const db = getDatabase();
  const result = db.exec(
    `SELECT u.*, ur.role FROM users u
     INNER JOIN user_roles ur ON u.id = ur.user_id
     WHERE ur.org_id = ?
     ORDER BY ur.role ASC, u.created_at ASC`,
    [orgId]
  );
  
  if (!result.length) return [];
  
  return result[0].values.map((row: any) => ({
    user: {
      id: row[0],
      didOrWallet: row[1],
      createdAt: row[2],
      lastSeenAt: row[3]
    },
    role: row[4] as UserRole
  }));
}

export function removeUserFromOrg(userId: string, orgId: string): void {
  const db = getDatabase();
  db.run('DELETE FROM user_roles WHERE user_id = ? AND org_id = ?', [userId, orgId]);
}

export function isUserInOrg(userId: string, orgId: string): boolean {
  const db = getDatabase();
  const result = db.exec(
    'SELECT COUNT(*) FROM user_roles WHERE user_id = ? AND org_id = ?',
    [userId, orgId]
  );
  return result.length > 0 && (result[0].values[0][0] as number) > 0;
}

export function hasRole(userId: string, orgId: string, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    'ADMIN': 3,
    'MEMBER': 2,
    'AUDITOR': 1
  };
  
  const userRole = getUserRole(userId, orgId);
  if (!userRole) return false;
  
  return roleHierarchy[userRole.role] >= roleHierarchy[requiredRole];
}

// ============================================
// POLICY OPERATIONS
// ============================================

export type PolicyStatus = 'ACTIVE' | 'DEPRECATED' | 'DISABLED';

export interface Policy {
  id: string;
  name: string;
  description?: string;
  circuitName: string;
  version: number;
  config?: Record<string, unknown>;
  status: PolicyStatus;
  createdAt: string;
  updatedAt: string;
}

export function createPolicy(policy: Omit<Policy, 'createdAt' | 'updatedAt'>): Policy {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  db.run(
    `INSERT INTO policies (id, name, description, circuit_name, version, config, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      policy.id,
      policy.name,
      policy.description || null,
      policy.circuitName,
      policy.version || 1,
      policy.config ? JSON.stringify(policy.config) : null,
      policy.status || 'ACTIVE',
      now,
      now
    ]
  );
  
  return { ...policy, status: policy.status || 'ACTIVE', createdAt: now, updatedAt: now };
}

export function getPolicyById(id: string): Policy | null {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM policies WHERE id = ?', [id]);
  
  if (!result.length || !result[0].values.length) return null;
  
  const row = result[0].values[0];
  return {
    id: row[0] as string,
    name: row[1] as string,
    description: row[2] as string | undefined,
    circuitName: row[3] as string,
    version: row[4] as number,
    config: row[5] ? JSON.parse(row[5] as string) : undefined,
    status: (row[6] as PolicyStatus) || 'ACTIVE',
    createdAt: row[7] as string,
    updatedAt: row[8] as string
  };
}

export function getPolicyByName(name: string): Policy | null {
  const db = getDatabase();
  const result = db.exec('SELECT * FROM policies WHERE name = ?', [name]);
  
  if (!result.length || !result[0].values.length) return null;
  
  const row = result[0].values[0];
  return {
    id: row[0] as string,
    name: row[1] as string,
    description: row[2] as string | undefined,
    circuitName: row[3] as string,
    version: row[4] as number,
    config: row[5] ? JSON.parse(row[5] as string) : undefined,
    status: (row[6] as PolicyStatus) || 'ACTIVE',
    createdAt: row[7] as string,
    updatedAt: row[8] as string
  };
}

export function listPolicies(status?: PolicyStatus): Policy[] {
  const db = getDatabase();
  let query = 'SELECT * FROM policies';
  const params: any[] = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY name ASC';
  
  const result = db.exec(query, params);
  if (!result.length) return [];
  
  return result[0].values.map((row: any) => ({
    id: row[0],
    name: row[1],
    description: row[2],
    circuitName: row[3],
    version: row[4],
    config: row[5] ? JSON.parse(row[5]) : undefined,
    status: row[6] || 'ACTIVE',
    createdAt: row[7],
    updatedAt: row[8]
  }));
}

// ============================================
// ORG-SCOPED QUERY HELPERS
// ============================================

export function getMemoriesByOrgId(orgId: string, options?: {
  status?: MemoryStatus;
  userId?: string;
  limit?: number;
  offset?: number;
}): MemoryMetadata[] {
  const db = getDatabase();
  let query = 'SELECT * FROM memory_metadata WHERE org_id = ? AND deleted_at IS NULL';
  const params: any[] = [orgId];
  
  if (options?.status) {
    query += ' AND status = ?';
    params.push(options.status);
  }
  if (options?.userId) {
    query += ' AND user_id = ?';
    params.push(options.userId);
  }
  
  query += ' ORDER BY created_at DESC';
  
  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }
  }
  
  const result = db.exec(query, params);
  if (!result.length) return [];
  
  return result[0].values.map((row: any) => ({
    id: row[0],
    userId: row[1] || undefined,
    keyId: row[2],
    memoryCommitment: row[3] || undefined,
    contentHash: row[4],
    tags: row[5] ? JSON.parse(row[5]) : undefined,
    confidence: row[6],
    status: row[7] || 'ACTIVE',
    createdAt: row[8],
    updatedAt: row[9],
    deletedAt: row[10]
  }));
}

export function countMemoriesByOrgId(orgId: string): number {
  const db = getDatabase();
  const result = db.exec(
    'SELECT COUNT(*) FROM memory_metadata WHERE org_id = ? AND deleted_at IS NULL',
    [orgId]
  );
  return result.length ? (result[0].values[0][0] as number) : 0;
}

export function countProofsByOrgId(orgId: string): number {
  const db = getDatabase();
  const result = db.exec('SELECT COUNT(*) FROM zk_proofs WHERE org_id = ?', [orgId]);
  return result.length ? (result[0].values[0][0] as number) : 0;
}

export function countAnchorsByOrgId(orgId: string): number {
  const db = getDatabase();
  const result = db.exec('SELECT COUNT(*) FROM anchor_transactions WHERE org_id = ?', [orgId]);
  return result.length ? (result[0].values[0][0] as number) : 0;
}

export function getComplianceLogsByOrgId(orgId: string, options?: {
  userId?: string;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): ComplianceLog[] {
  const db = getDatabase();
  let query = 'SELECT * FROM compliance_logs WHERE org_id = ?';
  const params: any[] = [orgId];
  
  if (options?.userId) {
    query += ' AND user_id = ?';
    params.push(options.userId);
  }
  if (options?.action) {
    query += ' AND action = ?';
    params.push(options.action);
  }
  if (options?.entityType) {
    query += ' AND entity_type = ?';
    params.push(options.entityType);
  }
  if (options?.startDate) {
    query += ' AND timestamp >= ?';
    params.push(options.startDate);
  }
  if (options?.endDate) {
    query += ' AND timestamp <= ?';
    params.push(options.endDate);
  }
  
  query += ' ORDER BY created_at DESC';
  
  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }
  }
  
  const result = db.exec(query, params);
  if (!result.length) return [];
  
  return result[0].values.map((row: any) => ({
    id: row[0],
    userId: row[1] || undefined,
    action: row[2],
    memoryId: row[3] || undefined,
    keyId: row[4],
    timestamp: row[5],
    metadata: row[6] ? JSON.parse(row[6]) : undefined,
    previousLogHash: row[7] || undefined,
    logHash: row[8]
  }));
}

export function getAnchorsByOrgId(orgId: string, options?: {
  limit?: number;
  offset?: number;
}): AnchorRecord[] {
  const db = getDatabase();
  let query = 'SELECT * FROM anchor_transactions WHERE org_id = ? ORDER BY created_at DESC';
  const params: any[] = [orgId];
  
  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }
  }
  
  const result = db.exec(query, params);
  if (!result.length) return [];
  
  return result[0].values.map((row: any) => ({
    id: row[0],
    userId: row[1] || undefined,
    txHash: row[2],
    proofHash: row[3],
    memoryHash: row[4],
    commitment: row[5],
    blockHeight: row[6],
    blockHash: row[7],
    status: row[8],
    network: row[9],
    fees: row[10],
    createdAt: row[11],
    confirmedAt: row[12]
  }));
}

/**
 * Close and cleanup database
 */
export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
    console.log('[Database] Database closed');
  }
}
