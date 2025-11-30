# WhisperCache Security Considerations

## Overview

WhisperCache is designed with privacy and security as core principles. This document outlines the threat model, security measures, and known limitations.

## Threat Model

### Assets to Protect

1. **Memory Content** - User's private memories (encrypted at rest)
2. **Memory Metadata** - Tags, timestamps, relationships
3. **Encryption Keys** - User-specific encryption keys
4. **ZK Proofs** - Proof artifacts and verification keys
5. **Compliance Logs** - Immutable audit trail

### Threat Actors

| Actor | Capability | Motivation |
|-------|------------|------------|
| External Attacker | Network access, brute force | Data theft, service disruption |
| Malicious Agent | API access, prompt injection | Unauthorized memory access |
| Insider Threat | Database access | Data exfiltration |
| Compromised Node | Blockchain access | Transaction manipulation |

### Attack Vectors

#### 1. API Attacks

| Attack | Mitigation | Status |
|--------|------------|--------|
| Authentication bypass | DID/wallet-based auth | ✅ Implemented |
| Rate limiting bypass | IP + user-based limiting | ✅ Implemented |
| Injection attacks | Input validation, parameterized queries | ✅ Implemented |
| CORS exploitation | Strict origin whitelist | ✅ Implemented |

#### 2. Cryptographic Attacks

| Attack | Mitigation | Status |
|--------|------------|--------|
| Key compromise | Key rotation, per-user keys | ✅ Implemented |
| Weak encryption | XChaCha20-Poly1305 (256-bit) | ✅ Implemented |
| Nonce reuse | Random 24-byte nonces | ✅ Implemented |
| Side-channel | Constant-time operations (libsodium) | ✅ Implemented |

#### 3. ZK Proof Attacks

| Attack | Mitigation | Status |
|--------|------------|--------|
| Proof forgery | Circuit verification | ✅ Implemented |
| Witness extraction | Proof compression, no witness exposure | ✅ Implemented |
| Circuit manipulation | Immutable circuit artifacts | ⚠️ Partial |
| Trusted setup compromise | Future: MPC ceremony | ⏳ TODO |

#### 4. Agent/AI Attacks

| Attack | Mitigation | Status |
|--------|------------|--------|
| Prompt injection | Sanitized context only | ✅ Implemented |
| Memory enumeration | Access control, ownership check | ✅ Implemented |
| Context leakage | Policy-based filtering | ✅ Implemented |
| Unauthorized access | Status checking (ACTIVE only) | ✅ Implemented |

## Security Architecture

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────┐
│                    Rate Limiting                             │
├─────────────────────────────────────────────────────────────┤
│                   Security Headers                           │
├─────────────────────────────────────────────────────────────┤
│               DID/Wallet Authentication                      │
├─────────────────────────────────────────────────────────────┤
│                 Input Validation                             │
├─────────────────────────────────────────────────────────────┤
│              Access Control (Ownership)                      │
├─────────────────────────────────────────────────────────────┤
│                  Encryption at Rest                          │
├─────────────────────────────────────────────────────────────┤
│                ZK Proof Verification                         │
├─────────────────────────────────────────────────────────────┤
│                  Compliance Logging                          │
└─────────────────────────────────────────────────────────────┘
```

### Encryption Details

| Component | Algorithm | Key Size | Notes |
|-----------|-----------|----------|-------|
| Memory encryption | XChaCha20-Poly1305 | 256-bit | AEAD, random nonces |
| Key derivation | Argon2id | N/A | Memory-hard, salt-based |
| Content hashing | BLAKE2b | 256-bit | Faster than SHA-256 |
| Proof hashing | SHA-256 | 256-bit | Circuit compatibility |

### Key Management

```
User
  └── Master Key (derived from password/DID)
        └── Key Version 1 (ACTIVE)
        └── Key Version 2 (ACTIVE after rotation)
        └── Key Version N-1 (REVOKED)
              └── Memory Keys (per-memory)
```

**Key Rotation:**
1. Generate new key version
2. Mark old key as REVOKED
3. Re-encrypt memories (TODO: background job)
4. Log rotation event

## Privacy Guarantees

### What Agents CAN See

- Policy type (FINANCE, HEALTH, GENERAL, BLOCKED)
- Allowed tags (sanitized)
- Confidence score
- Safe summary (generated, not raw content)

### What Agents CANNOT See

- Raw memory content
- Full memory commitment
- Encryption keys
- Other users' memories
- Revoked/deleted memories

### ZK Proof Properties

1. **Soundness**: Invalid proofs will be rejected
2. **Zero-knowledge**: Proof reveals nothing beyond the claim
3. **Completeness**: Valid statements can always be proven

## Known Limitations

### Current Prototype

| Limitation | Impact | Planned Fix |
|------------|--------|-------------|
| In-memory database | Data loss on restart | SQLite persistence |
| Simulation mode | No real blockchain anchoring | Midnight SDK integration |
| Mock agent responses | No real AI integration | OpenAI/Anthropic adapters |
| Single-node | No redundancy | Kubernetes deployment |

### Cryptographic

| Limitation | Impact | Notes |
|------------|--------|-------|
| No MPC ceremony | Trusted setup required | Use production Powers of Tau |
| Client-side key storage | Key security depends on client | Hardware wallet integration |
| No HSM support | Keys in application memory | Cloud HSM integration |

## Compliance Considerations

### GDPR

| Requirement | Implementation |
|-------------|----------------|
| Right to access | GET /api/memory |
| Right to rectification | PATCH /api/memory/:id |
| Right to erasure | POST /api/memory/:id/revoke |
| Data portability | Export endpoint (TODO) |
| Audit trail | Compliance logs |

### Data Residency

- SQLite: Local to deployment region
- Blockchain anchors: Distributed (Midnight/Cardano)
- Consider: Regional deployments for compliance

## Security Checklist

### Deployment

- [ ] Change all default secrets
- [ ] Enable HTTPS (TLS 1.3)
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Set up monitoring/alerting
- [ ] Configure backup encryption
- [ ] Review CORS origins

### Operations

- [ ] Regular key rotation
- [ ] Audit log review
- [ ] Dependency updates
- [ ] Penetration testing
- [ ] Incident response plan

## Reporting Security Issues

For security vulnerabilities, please contact: security@whispercache.io

Do NOT open public issues for security vulnerabilities.

## References

- [XChaCha20-Poly1305](https://libsodium.gitbook.io/doc/secret-key_cryptography/aead)
- [ZK-SNARKs](https://z.cash/technology/zksnarks/)
- [Midnight Protocol](https://midnight.network/)
- [OWASP Top 10](https://owasp.org/Top10/)
