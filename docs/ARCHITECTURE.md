# WhisperCache Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │   React UI      │  │  Crypto Module  │  │       API Client            │  │
│  │  (Vite + TS)    │  │  (libsodium)    │  │  (REST + Auth)              │  │
│  └────────┬────────┘  └────────┬────────┘  └─────────────┬───────────────┘  │
│           │                    │                          │                  │
│           │    ┌───────────────┴───────────────┐          │                  │
│           │    │        Key Store              │          │                  │
│           │    │  (Memory/Session/IndexedDB)   │          │                  │
│           │    └───────────────┬───────────────┘          │                  │
│           │                    │                          │                  │
│           └────────────────────┴──────────────────────────┘                  │
│                                        │                                     │
└────────────────────────────────────────┼─────────────────────────────────────┘
                                         │ HTTPS
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SERVER (Node.js)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Express.js API Router                          │   │
│  └───────┬─────────┬─────────┬──────────┬──────────┬─────────┬──────────┘   │
│          │         │         │          │          │         │              │
│          ▼         ▼         ▼          ▼          ▼         ▼              │
│  ┌───────────┐ ┌───────┐ ┌────────┐ ┌────────┐ ┌───────┐ ┌───────┐         │
│  │   Auth    │ │Memory │ │   ZK   │ │ Anchor │ │Compli-│ │ Keys  │         │
│  │  Routes   │ │Routes │ │ Routes │ │ Routes │ │ ance  │ │Routes │         │
│  └─────┬─────┘ └───┬───┘ └───┬────┘ └───┬────┘ └───┬───┘ └───┬───┘         │
│        │           │         │          │          │         │              │
│        ▼           ▼         ▼          ▼          ▼         ▼              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Core Services                                │    │
│  ├──────────┬──────────┬──────────┬───────────┬───────────┬────────────┤    │
│  │ DID Auth │  Crypto  │ZK Prover │  Midnight │  Database │   Agent    │    │
│  │          │(libsodium)│(SnarkJS) │  Client   │  (sql.js) │  Service   │    │
│  └──────────┴──────────┴──────────┴───────────┴───────────┴────────────┘    │
│                                                                              │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
┌─────────────────────┐               ┌─────────────────────┐
│   Midnight Network  │               │      SQLite DB      │
│   (ZK Blockchain)   │               │   (Local Storage)   │
├─────────────────────┤               ├─────────────────────┤
│ • ZK Proof Anchors  │               │ • Compliance Logs   │
│ • Shielded TX       │               │ • Memory Metadata   │
│ • Block Finality    │               │ • ZK Proof Records  │
│ • Transaction Fees  │               │ • Anchor Records    │
└─────────────────────┘               │ • Key Rotations     │
                                      └─────────────────────┘
```

## Data Flow: Creating an Encrypted Memory

```
1. User Input          2. Client Encryption       3. API Call
┌──────────────┐       ┌────────────────────┐     ┌──────────────────┐
│ "My secret   │  ──▶  │ XChaCha20-Poly1305 │ ──▶ │ POST /api/memory │
│  memory..."  │       │ encrypt(data, key) │     │ {encryptedData,  │
└──────────────┘       │ nonce = random     │     │  nonce, tags}    │
                       └────────────────────┘     └────────┬─────────┘
                                                           │
                              ┌─────────────────────────────┘
                              ▼
4. Server Processing                      5. Database Storage
┌────────────────────────────────────┐    ┌────────────────────────────┐
│ • Verify auth token                │    │ Memory Metadata:           │
│ • Compute content hash             │ ──▶│ • id, keyId, contentHash   │
│ • Store encrypted blob             │    │ • tags, confidence         │
│ • Create compliance log            │    │ • createdAt, updatedAt     │
└────────────────────────────────────┘    └────────────────────────────┘
```

## Data Flow: ZK Query Processing

```
1. Query Input         2. Agent Analysis         3. ZK Proof Generation
┌──────────────────┐   ┌──────────────────────┐   ┌────────────────────────┐
│ "Any anxiety     │──▶│ Pattern matching:     │──▶│ Poseidon Hash:         │
│  patterns?"      │   │ • Category: mental    │   │ H(query || memories)   │
└──────────────────┘   │ • Confidence: 0.89    │   │                        │
                       │ • Sensitivity: high   │   │ SnarkJS Groth16:       │
                       └──────────────────────┘   │ generate(witness, key) │
                                                  └────────────┬───────────┘
                                                               │
                              ┌─────────────────────────────────┘
                              ▼
4. Response                                5. Optional: Anchor to Chain
┌────────────────────────────────────┐    ┌────────────────────────────┐
│ {                                  │    │ Midnight TX:               │
│   "pattern": "Stress detected",   │ ──▶│ • Proof hash commitment    │
│   "confidence": 0.89,             │    │ • Memory hash commitment   │
│   "proofHash": "zk_abc...",       │    │ • Block finality           │
│   "insights": [...]               │    │ • Immutable audit trail    │
│ }                                  │    └────────────────────────────┘
└────────────────────────────────────┘
```

## Security Model

### Client-Side Encryption

```
┌─────────────────────────────────────────────────────────────────┐
│                    Key Derivation Tree                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    ┌─────────────────┐                          │
│                    │   Master Key    │                          │
│                    │  (256-bit AES)  │                          │
│                    └────────┬────────┘                          │
│                             │                                    │
│         ┌───────────────────┼───────────────────┐               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Memory Key  │    │  ZK Proof   │    │  Signing    │         │
│  │ (Subkey 1)  │    │    Key      │    │    Key      │         │
│  └─────────────┘    │ (Subkey 2)  │    │ (Subkey 3)  │         │
│                     └─────────────┘    └─────────────┘         │
│                                                                  │
│  Storage Options:                                                │
│  • Memory Only (ephemeral)                                       │
│  • Session Storage (browser session)                             │
│  • IndexedDB (persistent, encrypted)                             │
└─────────────────────────────────────────────────────────────────┘
```

### Zero-Knowledge Proof Circuit

```
┌─────────────────────────────────────────────────────────────────┐
│                    Poseidon Hash Circuit                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PRIVATE INPUTS (never revealed):                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • memory_content: Field                                      ││
│  │ • user_secret_key: Field                                     ││
│  │ • query_pattern: Field                                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Poseidon Hash Computation                       ││
│  │  H = Poseidon(memory || key || pattern)                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  PUBLIC OUTPUTS (revealed in proof):                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • commitment_hash: Field                                     ││
│  │ • confidence_score: Field                                    ││
│  │ • pattern_matched: Bool                                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### Client Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| `crypto.ts` | libsodium-wrappers | XChaCha20-Poly1305 encryption |
| `keyStore.ts` | IndexedDB + Memory | Secure key storage |
| `memoryService.ts` | TypeScript | Memory CRUD with encryption |
| `hooks.ts` | React Hooks | `useEncryption`, `useMemories`, etc. |
| `api.ts` | Fetch API | REST client with auth |

### Server Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| `crypto.ts` | libsodium-wrappers | Hashing, commitments |
| `zkProver.ts` | SnarkJS + circomlibjs | ZK proof generation |
| `midnight.ts` | Custom Client | Blockchain integration |
| `database.ts` | sql.js | SQLite persistence |
| `auth.ts` | DID/JWT | Authentication |
| `agent.ts` | Pattern Matching | AI query analysis |

### Database Schema

```sql
-- Compliance Logs (hash-chained audit trail)
CREATE TABLE compliance_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  memory_id TEXT,
  key_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  metadata TEXT,
  previous_log_hash TEXT,
  log_hash TEXT NOT NULL
);

-- Memory Metadata (no encrypted content stored)
CREATE TABLE memory_metadata (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  tags TEXT,
  confidence REAL,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

-- ZK Proofs
CREATE TABLE zk_proofs (
  id TEXT PRIMARY KEY,
  proof_hash TEXT UNIQUE NOT NULL,
  memory_hash TEXT NOT NULL,
  pattern TEXT,
  verified INTEGER DEFAULT 0,
  created_at TEXT
);

-- Anchor Transactions
CREATE TABLE anchor_transactions (
  id TEXT PRIMARY KEY,
  tx_hash TEXT UNIQUE NOT NULL,
  proof_hash TEXT,
  memory_hash TEXT,
  commitment TEXT,
  block_height INTEGER,
  status TEXT,
  network TEXT,
  created_at TEXT
);

-- Key Rotations
CREATE TABLE key_rotations (
  id TEXT PRIMARY KEY,
  old_key_id TEXT NOT NULL,
  new_key_id TEXT NOT NULL,
  rotated_at TEXT,
  reason TEXT
);
```

## Midnight Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                    Midnight Network                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Connection:                                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Network: midnight-devnet                                     ││
│  │ Chain ID: midnight-devnet-1                                  ││
│  │ Block Time: ~1 second                                        ││
│  │ Finality: ~10 blocks                                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Anchor Payload:                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ {                                                            ││
│  │   "proofHash": "zk_abc123...",                               ││
│  │   "memoryHash": "sha256_def456...",                          ││
│  │   "commitment": "merkle_root...",                            ││
│  │   "timestamp": 1704067200,                                   ││
│  │   "version": "1.0.0"                                         ││
│  │ }                                                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Transaction States:                                             │
│  pending → submitted → confirmed → finalized                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Privacy Guarantees

| Feature | Privacy Level | Implementation |
|---------|--------------|----------------|
| Memory Content | Full Privacy | XChaCha20-Poly1305 E2E encryption |
| Query Content | Full Privacy | Poseidon hash in ZK circuit |
| Pattern Results | Differential | Only confidence score revealed |
| Timestamps | Partial | Rounded to reduce fingerprinting |
| Access Logs | Audit Only | Hash-chained, tamper-evident |
| Key Identity | Pseudonymous | DID-based, no PII |

## Scalability Considerations

1. **Proof Generation**: ~200ms per proof (can be parallelized)
2. **Encryption**: ~1ms per KB (hardware-accelerated)
3. **Database**: SQLite scales to ~1M records efficiently
4. **Blockchain**: 10 TPS anchor rate (batching recommended)
5. **Memory**: ~100MB baseline server footprint

---

## Production Gap Analysis

This section identifies what's production-ready vs. what needs additional work.

### ✅ Production Ready

| Component | Status | Notes |
|-----------|--------|-------|
| **Encryption** | ✅ Ready | XChaCha20-Poly1305, libsodium |
| **Key Management** | ✅ Ready | Rotation, revocation, versioning |
| **ZK Circuits** | ✅ Ready | Poseidon hash, pattern matching |
| **ZK Proof Generation** | ✅ Ready | SnarkJS integration |
| **Memory CRUD** | ✅ Ready | Full lifecycle management |
| **DID Authentication** | ✅ Ready | Header-based auth |
| **Compliance Logging** | ✅ Ready | Hash-chained logs |
| **Agent Sanitization** | ✅ Ready | Policy-based filtering |
| **Error Handling** | ✅ Ready | Standardized responses |
| **Rate Limiting** | ✅ Ready | IP + user-based |
| **Security Headers** | ✅ Ready | CORS, HSTS, CSP |
| **API Documentation** | ✅ Ready | OpenAPI spec |
| **Docker Support** | ✅ Ready | Multi-stage builds |

### ⚠️ Needs SDK Integration

| Component | Current | Production Requirement |
|-----------|---------|------------------------|
| **Midnight Anchoring** | Simulation | Midnight SDK + devnet/testnet |
| **Cardano Anchoring** | Simulation | Blockfrost API + testnet |
| **Wallet Authentication** | Simulation | CIP-30 wallet connect |

**Integration Steps:**
1. Install Midnight SDK when available
2. Replace `simulationMode: true` with real SDK calls
3. Configure wallet addresses and API keys
4. Test on devnet before testnet/mainnet

### 🔄 Recommended Improvements

| Component | Current | Recommended |
|-----------|---------|-------------|
| **Database** | SQLite (in-memory) | PostgreSQL |
| **Caching** | In-memory Map | Redis |
| **Agent LLM** | Mock responses | OpenAI/Anthropic |
| **Proof Queue** | In-memory | Bull/BullMQ |
| **Key Storage** | Memory | HSM/Vault |

### ⏳ Future Enhancements

| Feature | Priority | Complexity | Notes |
|---------|----------|------------|-------|
| MPC Ceremony | High | High | Production trusted setup |
| GPU Proving | Medium | Medium | Rapid proof generation |
| Memory Export | Medium | Low | GDPR data portability |
| Multi-region | Low | High | Data residency compliance |
| Selective Disclosure | Low | High | Advanced ZK features |

### Production Checklist

Before deploying to production:

```bash
# Environment
[ ] Change all default secrets
[ ] Configure production database (PostgreSQL)
[ ] Set up Redis for caching
[ ] Configure real blockchain endpoints
[ ] Enable HTTPS/TLS

# Security
[ ] Run security audit
[ ] Enable rate limiting
[ ] Configure CORS strictly
[ ] Set up monitoring/alerting
[ ] Configure backup encryption

# Performance
[ ] Enable proof caching
[ ] Configure connection pooling
[ ] Set up CDN for static assets
[ ] Configure auto-scaling

# Compliance
[ ] Review data retention policies
[ ] Configure audit log archival
[ ] Document data flows
[ ] Implement data export
```

### Architecture Evolution

**Phase 1 (Current - Prototype)**
```
Client → Express API → SQLite → Simulation Blockchain
```

**Phase 2 (MVP)**
```
Client → Express API → PostgreSQL → Midnight Devnet
              ↓
           Redis Cache
```

**Phase 3 (Production)**
```
Client → Load Balancer → Express Cluster → PostgreSQL
              ↓                   ↓
         Redis Cluster      Midnight Mainnet
              ↓
         ZK Worker Pool
```
