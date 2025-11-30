# WhisperCache API Documentation

## Overview

WhisperCache is a privacy-first memory layer for AI agents that uses zero-knowledge proofs and end-to-end encryption. This document describes the complete API for integrating with WhisperCache.

**Base URL:** `http://localhost:4000/api`

## Authentication

WhisperCache uses DID (Decentralized Identity) authentication with session tokens.

### Demo Authentication (Development Only)

```http
POST /api/auth/demo
```

Creates a demo session for development/testing.

**Response:**
```json
{
  "success": true,
  "did": "did:midnight:abc123...",
  "token": "session_token...",
  "keyId": "key_abc123",
  "expiresAt": "2024-01-02T00:00:00.000Z",
  "permissions": ["read", "write", "prove"]
}
```

### Register DID

```http
POST /api/auth/register
Content-Type: application/json

{
  "publicKey": "64-character-hex-public-key"
}
```

### Get Challenge

```http
POST /api/auth/challenge
Content-Type: application/json

{
  "did": "did:midnight:abc123..."
}
```

### Authenticate

```http
POST /api/auth/authenticate
Content-Type: application/json

{
  "challenge": "challenge_hash",
  "signature": "ed25519_signature",
  "did": "did:midnight:abc123..."
}
```

### Headers

All authenticated endpoints require:
```
Authorization: Bearer <session_token>
```

---

## Memory Operations

### Create Memory

```http
POST /api/memory
Authorization: Bearer <token>
Content-Type: application/json

{
  "encryptedData": "base64-encoded-encrypted-content",
  "nonce": "base64-encoded-nonce",
  "tags": ["work", "important"],
  "confidence": 0.95
}
```

**Response:**
```json
{
  "success": true,
  "memoryId": "mem_abc123...",
  "contentHash": "sha256-hash",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Get Memory

```http
GET /api/memory/:memoryId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "memoryId": "mem_abc123",
  "encryptedData": "base64-data",
  "nonce": "base64-nonce",
  "algorithm": "XChaCha20-Poly1305",
  "metadata": {
    "contentHash": "sha256-hash",
    "tags": ["work"],
    "confidence": 0.95,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### List Memories

```http
GET /api/memory?tag=work&limit=50
Authorization: Bearer <token>
```

### Search Memories

```http
GET /api/memory/search?tags=work,important&minConfidence=0.8
Authorization: Bearer <token>
```

### Update Memory

```http
PATCH /api/memory/:memoryId
Authorization: Bearer <token>
Content-Type: application/json

{
  "tags": ["work", "archived"],
  "confidence": 0.85
}
```

### Delete Memory

```http
DELETE /api/memory/:memoryId
Authorization: Bearer <token>
```

### Verify Memory Integrity

```http
POST /api/memory/:memoryId/verify
Authorization: Bearer <token>
```

---

## Zero-Knowledge Proofs

### Generate Proof

```http
POST /api/zk/prove
Content-Type: application/json

{
  "query": "Any mental health patterns?",
  "memoryHashes": ["hash1", "hash2"]
}
```

**Response:**
```json
{
  "result": "ok",
  "confidence": 0.89,
  "proofHash": "zk_proof_hash",
  "pattern": "Elevated stress pattern detected",
  "query": "Any mental health patterns?",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "category": "mental_health",
  "sensitivity": "critical",
  "insights": [
    "High confidence pattern match detected",
    "Emotional context preserved in encrypted form",
    "No raw sentiment data exposed",
    "Zero-knowledge proof generated successfully"
  ],
  "recommendation": "Consider consulting a professional for personalized guidance",
  "proofData": {
    "commitment": "commitment_hash",
    "publicInputs": ["input1", "input2"],
    "verified": true
  }
}
```

### Verify Proof

```http
GET /api/zk/verify/:proofHash
```

---

## Blockchain Anchoring

### Anchor Proof

```http
POST /api/anchor
Content-Type: application/json

{
  "memoryHash": "memory_content_hash",
  "proofHash": "zk_proof_hash"
}
```

**Response:**
```json
{
  "txId": "midnight_tx_abc123",
  "status": "confirmed",
  "blockHeight": 1005942,
  "blockHash": "block_hash",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "confirmations": 3,
  "anchorData": {
    "commitment": "commitment_hash",
    "network": "midnight-devnet",
    "nonce": "nonce_value",
    "proofHash": "proof_hash",
    "memoryHash": "memory_hash"
  },
  "fees": "0.00012345"
}
```

### Get Anchor Status

```http
GET /api/anchor/:txId
```

### Verify Anchor

```http
POST /api/anchor/verify
Content-Type: application/json

{
  "txId": "midnight_tx_abc123"
}
```

### Get Network Status

```http
GET /api/anchor/status
```

**Response:**
```json
{
  "network": "midnight",
  "connected": true,
  "chainId": "midnight-devnet-1",
  "latestBlock": 1005942,
  "syncProgress": 100,
  "peersConnected": 12,
  "networkVersion": "0.1.0"
}
```

### Get Recent Anchors

```http
GET /api/anchor/recent?limit=10
```

### Estimate Fees

```http
POST /api/anchor/estimate
Content-Type: application/json

{
  "payloadSize": 256
}
```

---

## Compliance & Audit

### Create Compliance Log

```http
POST /api/compliance/log
Content-Type: application/json

{
  "action": "create",
  "keyId": "key_abc123",
  "memoryId": "mem_abc123",
  "metadata": {
    "reason": "User created new memory"
  }
}
```

**Actions:** `create`, `access`, `delete`, `proof`, `rotate_key`, `anchor`, `export`, `share`

### Get Compliance Logs

```http
GET /api/compliance/logs?keyId=key_abc123&action=create&limit=100
```

### Verify Log Chain

```http
GET /api/compliance/verify
```

**Response:**
```json
{
  "verified": true,
  "chainLength": 42,
  "latestLogHash": "hash..."
}
```

### Export Logs

```http
GET /api/compliance/export?keyId=key_abc123
```

### Get Statistics

```http
GET /api/compliance/stats
```

**Response:**
```json
{
  "complianceLogs": 150,
  "memories": 45,
  "zkProofs": 30,
  "anchors": 25,
  "keyRotations": 2,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Key Management

### Rotate Key

```http
POST /api/keys/rotate
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Scheduled rotation"
}
```

### Revoke Key

```http
POST /api/keys/revoke
Authorization: Bearer <token>
Content-Type: application/json

{
  "keyId": "key_to_revoke",
  "reason": "Suspected compromise"
}
```

### Get Key History

```http
GET /api/keys/history
Authorization: Bearer <token>
```

### Check Key Status

```http
GET /api/keys/status/:keyId
```

---

## Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "crypto": { "status": "ready", "algorithm": "XChaCha20-Poly1305" },
    "database": { 
      "status": "ready", 
      "type": "SQLite",
      "complianceLogs": 150,
      "memories": 45,
      "zkProofs": 30,
      "anchors": 25,
      "keyRotations": 2
    },
    "midnight": { "status": "ready", "network": "devnet" }
  },
  "networks": {
    "midnight": { "connected": true, "latency": 45 },
    "cardano": { "connected": true, "latency": 120 }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Error Handling

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `KEY_REVOKED` | 401 | The session key has been revoked |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `PROOF_FAILED` | 500 | ZK proof generation failed |

---

## Rate Limits

| Endpoint Category | Rate Limit |
|-------------------|------------|
| Authentication | 10/minute |
| Memory Operations | 100/minute |
| ZK Proofs | 20/minute |
| Blockchain Anchoring | 10/minute |
| Compliance Logs | 100/minute |

---

## Encryption Details

- **Algorithm:** XChaCha20-Poly1305 (AEAD)
- **Key Size:** 256 bits
- **Nonce Size:** 192 bits
- **MAC Size:** 128 bits (Poly1305)

All memory content is encrypted client-side before transmission. The server never has access to plaintext data.

---

## ZK Circuit Details

- **Hash Function:** Poseidon (ZK-friendly)
- **Proving System:** Groth16 via SnarkJS
- **Curve:** BN128 (alt_bn128)
- **Constraint System:** R1CS (Rank-1 Constraint System)

Proofs verify:
1. Memory ownership (via key hash)
2. Pattern matching (without revealing content)
3. Confidence scoring (deterministic computation)
