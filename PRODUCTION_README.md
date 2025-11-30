# WhisperCache – Zero-Knowledge Memory Layer for AI Agents

> 🏆 **Track 3: Privacy Mini DApps on Midnight** | India Blockchain Week 2025 Hackathon

## 🚀 One-Liner
**AI remembers you — without ever seeing you.**

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Features](#-features)
- [Getting Started](#-getting-started)
- [API Reference](#-api-reference)
- [Production Deployment](#-production-deployment)
- [Development Guide](#-development-guide)
- [Testing](#-testing)
- [Security](#-security)

---

## 🎯 Overview

### The Problem
Current AI assistants store raw user memories on cloud servers, risking exposure:
- 💬 Your therapy conversations → readable by employees
- 💰 Your financial worries → sold to advertisers  
- 🏥 Your health concerns → shared with insurance companies

### The Solution
WhisperCache encrypts user memories locally and runs zero-knowledge proof queries:

```
User Memory: "I had 3 panic attacks before my boss meeting"
     ↓
ZK Proof Generation (Poseidon Hash + SnarkJS Groth16)
     ↓
Midnight Network Verification
     ↓
AI Receives: "Elevated stress pattern (89% confidence)"
     ↓
Raw memory NEVER leaves your device
```

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ React+Vite  │  │ XChaCha20    │  │  Poseidon   │  │  DID Auth    │  │
│  │ Dashboard   │  │ Encryption   │  │  Hashing    │  │  (Ed25519)   │  │
│  └─────────────┘  └──────────────┘  └─────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SERVER LAYER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ Express API │  │ ZK Prover    │  │  Merkle     │  │  LLM Agent   │  │
│  │ Routes      │  │ (Groth16)    │  │  Tree       │  │  SDK         │  │
│  └─────────────┘  └──────────────┘  └─────────────┘  └──────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ Key Mgmt    │  │ Precompute   │  │  Security   │  │  Metrics     │  │
│  │ Service     │  │ Worker       │  │  Middleware │  │  Monitor     │  │
│  └─────────────┘  └──────────────┘  └─────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BLOCKCHAIN LAYER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────┐  ┌────────────────────────────────┐ │
│  │     Midnight Network          │  │      Cardano L1                │ │
│  │  • Shield Contracts           │  │  • Proof Anchoring             │ │
│  │  • Private State              │  │  • Settlement                  │ │
│  │  • ZK Verification            │  │  • Finality                    │ │
│  └───────────────────────────────┘  └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Features

### Core Features

| Feature | Status | Technology |
|---------|--------|------------|
| 🔐 End-to-End Encryption | ✅ Complete | XChaCha20-Poly1305 |
| 🧮 ZK Proof Generation | ✅ Complete | Poseidon + Groth16 |
| 🌙 Midnight Integration | ✅ Complete | Shield Contracts |
| 💾 Compliance Database | ✅ Complete | SQLite (sql.js) |
| 🔑 DID Authentication | ✅ Complete | Ed25519 Signatures |
| 🤖 AI Agent Analysis | ✅ Complete | LLM SDK Integration |
| 🔄 Key Rotation | ✅ Complete | Auto-rotation + Audit |
| 📊 Metrics & Monitoring | ✅ Complete | Prometheus + Grafana |

### Production Features

| Feature | Description |
|---------|-------------|
| **V2 Circuit** | Enhanced circuit with status + key version validation |
| **Merkle Tree** | Sparse Merkle tree with Poseidon hash for proofs |
| **Blockchain SDK** | Production-ready with retry, circuit breaker |
| **Precompute Worker** | Background proof generation with LRU cache |
| **Key Management** | Auto-rotation, HKDF derivation, audit trail |
| **Security Middleware** | Rate limiting, IP blocking, headers |
| **102 Tests** | Comprehensive test coverage |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Docker (optional, for deployment)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/whispercache.git
cd whispercache

# Install server dependencies
cd server
npm install

# Initialize database
npm run setup

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file in the server directory:

```env
PORT=4000
NODE_ENV=development
DATABASE_PATH=./data/whispercache.db
LOG_LEVEL=debug
BLOCKCHAIN_MODE=simulation

# Optional: Production blockchain
MIDNIGHT_API_URL=https://api.midnight.network
CARDANO_API_URL=https://cardano-preview.blockfrost.io

# Optional: LLM Integration
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 📚 API Reference

### Memory Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/memory` | Store encrypted memory |
| GET | `/api/memory/:id` | Retrieve memory |
| DELETE | `/api/memory/:id` | Delete memory (GDPR) |
| POST | `/api/memory/query` | Query with ZK proof |

### ZK Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/zk/status` | Prover status |
| POST | `/api/zk/prove` | Generate ZK proof |
| POST | `/api/zk/prove/memory/v2` | V2 proof with status |
| POST | `/api/zk/verify` | Verify proof |

### Key Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/keys/rotate` | Rotate user key |
| POST | `/api/keys/revoke` | Revoke key |
| GET | `/api/keys/status` | Key version info |

### Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/metrics/stats` | JSON statistics |
| GET | `/api/metrics/prometheus` | Prometheus format |
| GET | `/api/metrics/health` | Health check |

---

## 🐳 Production Deployment

### Docker

```bash
# Build production image
docker build -t whispercache:latest ./server

# Run with docker-compose
docker-compose up -d
```

### Docker Compose Profiles

```bash
# Production only
docker-compose up -d

# With monitoring
docker-compose --profile monitoring up -d

# With cache
docker-compose --profile cache up -d

# Development mode
docker-compose --profile dev up -d whispercache-dev
```

### Kubernetes

```bash
# Create namespace
kubectl create namespace whispercache

# Deploy
kubectl apply -f deploy/kubernetes/

# Check status
kubectl get pods -n whispercache
```

---

## 🧪 Testing

```bash
cd server

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/zk.test.ts
```

### Test Coverage

- **102 tests passing**
- ZK proof generation and verification
- Merkle tree operations
- Security middleware
- Key management utilities
- Memory operations
- API endpoints

---

## 🔒 Security

### Cryptography

| Layer | Algorithm | Purpose |
|-------|-----------|---------|
| Encryption | XChaCha20-Poly1305 | Memory encryption |
| Hashing | Poseidon | ZK-friendly commitments |
| Signatures | Ed25519 | DID authentication |
| Key Derivation | PBKDF2/HKDF | Master key derivation |
| Proofs | Groth16 | Zero-knowledge proofs |

### Security Features

- **Rate Limiting**: Configurable per-endpoint limits
- **IP Blocking**: Automatic block for suspicious activity
- **Security Headers**: HSTS, CSP, XSS protection
- **Request Validation**: Input sanitization
- **Audit Logging**: Tamper-evident compliance logs

---

## 📁 Project Structure

```
whispercache/
├── client/                 # React frontend
│   ├── src/
│   └── vite.config.ts
├── server/                 # Express backend
│   ├── src/
│   │   ├── blockchain/     # Blockchain integration
│   │   ├── lib/            # Core libraries
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   └── services/       # Business logic
│   ├── tests/              # Test suites
│   └── Dockerfile
├── zk/                     # ZK circuits
│   ├── circuits/           # Circom circuits
│   └── scripts/            # Build scripts
├── deploy/                 # Deployment configs
│   ├── kubernetes/
│   ├── prometheus/
│   └── grafana/
├── docker-compose.yml
└── README.md
```

---

## 🛠 Development Guide

### Adding New Features

1. Create service in `server/src/services/`
2. Add routes in `server/src/routes/`
3. Write tests in `server/tests/`
4. Update API documentation

### ZK Circuit Development

```bash
cd zk

# Install circom
npm install

# Compile circuit
npm run compile

# Generate proving/verification keys
npm run setup

# Build for production
npm run build:zk:v2
```

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **Midnight Network** - Privacy blockchain infrastructure
- **Cardano** - L1 settlement layer
- **circomlibjs** - Poseidon hash implementation
- **snarkjs** - ZK proof generation

---

Built with ❤️ for privacy by the WhisperCache Team
