# 🏆 WhisperCache - Judges Quick Guide

> **Privacy-First AI Memory Layer** powered by Midnight Network & Cardano

---

## ⚡ Quick Start (30 seconds)

### Live Demo URLs:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:4000
- **Health Check**: http://localhost:4000/api/health

---

## 🎯 What Problem We're Solving

### The Problem:
AI assistants today store your personal memories, preferences, and context in **centralized servers** where:
- 🚫 Your data is owned by corporations
- 🚫 No privacy guarantees
- 🚫 Data can be sold, leaked, or misused
- 🚫 You can't verify what's stored or deleted

### Our Solution:
**WhisperCache** is a **privacy-preserving memory layer** for AI agents that:
- ✅ Encrypts memories client-side before storage
- ✅ Uses **Zero-Knowledge Proofs** to verify without revealing data
- ✅ Anchors proofs on **Midnight Network** (privacy blockchain)
- ✅ Provides immutable audit trail on **Cardano**
- ✅ Gives users complete ownership and control

---

## 🔑 Key Features to Demo

### 1. 🔐 End-to-End Encryption
All memories are encrypted on the client using **libsodium** before being sent to the server.

**See it in action:**
- Open browser DevTools → Network tab
- Create a memory → Notice the encrypted payload
- Server never sees plaintext data

### 2. 🧠 Privacy-Preserving Memory Storage
```
POST /api/memory
Headers: x-user-id: demo-user
Body: { "memoryCommitment": "64-char-hex", "tags": ["personal"] }
```

### 3. ⚡ Zero-Knowledge Proofs (Midnight Integration)
Generate proofs that verify memory patterns WITHOUT revealing content.

**API Endpoints:**
```bash
# Generate ZK Witness
POST /api/zk/midnight/generate-witness
Body: { "query": "my preferences", "memoryCategory": "personal" }

# Generate ZK Proof
POST /api/zk/midnight/generate-proof
Body: { "query": "test", "memoryHash": "abc123" }

# Verify Proof
POST /api/zk/midnight/verify-proof
Body: { "proofData": {...}, "witness": {...} }

# Check Midnight Status
GET /api/zk/midnight/status
```

### 4. ⛓️ Blockchain Anchoring
Proofs are anchored on-chain for immutable verification.

**See it:**
```bash
GET /api/health
# Shows: Midnight devnet & Cardano preview connections
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (React + Vite)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Encryption  │  │ Memory UI   │  │ ZK Proof Viewer     │  │
│  │ (libsodium) │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   SERVER (Express + TypeScript)              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Memory API  │  │ ZK Prover   │  │ Blockchain Anchor   │  │
│  │             │  │ (snarkjs)   │  │ (Midnight+Cardano)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                         │                    │               │
│  ┌─────────────┐        │                    │               │
│  │  SQLite DB  │        │                    │               │
│  │  (sql.js)   │        │                    │               │
│  └─────────────┘        │                    │               │
└─────────────────────────┼────────────────────┼───────────────┘
                          │                    │
                          ▼                    ▼
              ┌───────────────────┐  ┌─────────────────────┐
              │  Midnight Network │  │   Cardano Blockchain │
              │  (Privacy Layer)  │  │   (Anchoring Layer)  │
              └───────────────────┘  └─────────────────────┘
```

---

## 🧪 Test These API Endpoints

### Health Check
```bash
curl http://localhost:4000/api/health
```
**Expected:** All services showing "ready" status

### Create Memory
```bash
curl -X POST http://localhost:4000/api/memory \
  -H "Content-Type: application/json" \
  -H "x-user-id: judge-demo" \
  -d '{"memoryCommitment": "a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd", "tags": ["demo"]}'
```

### Generate ZK Witness
```bash
curl -X POST http://localhost:4000/api/zk/midnight/generate-witness \
  -H "Content-Type: application/json" \
  -d '{"query": "personal preferences", "memoryCategory": "personal"}'
```

### Check Midnight Status
```bash
curl http://localhost:4000/api/zk/midnight/status
```

---

## 📊 What Makes Us Unique

| Feature | Traditional AI | WhisperCache |
|---------|---------------|--------------|
| Data Storage | Centralized servers | Encrypted + User-owned |
| Privacy | None | Zero-Knowledge Proofs |
| Verification | Trust the provider | Cryptographic proof |
| Audit Trail | Opaque | On-chain (Cardano) |
| Data Ownership | Company owns it | User owns it |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript, TailwindCSS |
| Backend | Express.js, TypeScript, Node.js 20 |
| Database | SQLite (sql.js) - In-memory |
| Encryption | libsodium (NaCl) |
| ZK Proofs | snarkjs, circomlibjs |
| Blockchain | Midnight Network (privacy), Cardano (anchoring) |
| CI/CD | GitHub Actions |

---

## 📁 Project Structure

```
WhisperCache/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   └── lib/          # Encryption utilities
├── server/          # Express backend
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── lib/          # Core logic
│   │   └── services/     # Blockchain services
├── circuits/        # ZK circuit definitions
├── zk/              # Zero-knowledge proof artifacts
└── docs/            # Documentation
```

---

## ✅ Judging Criteria Checklist

### Innovation ⭐⭐⭐⭐⭐
- [x] Novel approach to AI memory privacy
- [x] ZK proofs for verification without disclosure
- [x] Dual-chain architecture (Midnight + Cardano)

### Technical Implementation ⭐⭐⭐⭐⭐
- [x] Working client-side encryption
- [x] Functional ZK proof generation/verification
- [x] Blockchain connectivity (devnet/preview)
- [x] Clean TypeScript codebase
- [x] Passing CI pipeline

### User Experience ⭐⭐⭐⭐
- [x] Intuitive React UI
- [x] Real-time status indicators
- [x] Clear API responses

### Completeness ⭐⭐⭐⭐⭐
- [x] Full-stack implementation
- [x] API documentation
- [x] GitHub CI/CD pipeline
- [x] Comprehensive README

---

## 🚀 Future Roadmap

1. **Phase 1** - Full Midnight mainnet deployment
2. **Phase 2** - Multi-agent memory sharing with ZK access control
3. **Phase 3** - Decentralized memory marketplace
4. **Phase 4** - SDK for AI framework integration (LangChain, AutoGPT)

---

## 📞 Quick Links

- **GitHub**: https://github.com/Akshu1245/WhisperCache
- **CI Status**: https://github.com/Akshu1245/WhisperCache/actions
- **API Health**: http://localhost:4000/api/health

---

## 💡 Key Takeaways for Judges

1. **Privacy is cryptographically guaranteed** - Not just promised
2. **Zero-Knowledge Proofs** - Verify without revealing sensitive data
3. **Blockchain anchoring** - Immutable audit trail
4. **Production-ready architecture** - TypeScript, CI/CD, clean code
5. **Solves a real problem** - AI memory privacy is crucial as AI agents become ubiquitous

---

*Built for the future of private AI agents* 🔐🤖

