# WhisperCache Setup Guide

## Prerequisites

- **Node.js**: v18.x or later
- **npm**: v9.x or later
- **Git**: For cloning the repository

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/whispercache.git
cd whispercache

# Install root dependencies
npm install

# Install all workspace dependencies
npm run install:all
```

Or install each package separately:

```bash
# Server dependencies
cd server && npm install

# Client dependencies
cd ../client && npm install

# Shared library dependencies
cd ../shared && npm install
```

### 2. Start Development Servers

**Terminal 1 - Backend Server:**
```bash
cd server
npm run dev
```

Expected output:
```
🔐 Cryptography initialized (libsodium ready)
💾 Database initialized (SQLite ready)
🌙 Midnight network connected (devnet)

🔒 WhisperCache Server running on port 4000
   API endpoint: http://localhost:4000/api
   Health check: http://localhost:4000/api/health

📊 Services:
   • Cryptography: XChaCha20-Poly1305
   • ZK Proofs: Poseidon + SnarkJS
   • Database: SQLite (sql.js)
   • Blockchain: Midnight Devnet
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

Expected output:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 3. Verify Installation

Open http://localhost:5173 in your browser. You should see the WhisperCache landing page.

Test the API:
```bash
curl http://localhost:4000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "crypto": { "status": "ready", "algorithm": "XChaCha20-Poly1305" },
    "database": { "status": "ready", "type": "SQLite" },
    "midnight": { "status": "ready", "network": "devnet" }
  }
}
```

## Project Structure

```
whispercache/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── lib/           # Core libraries
│   │   │   ├── crypto.ts  # Encryption (libsodium)
│   │   │   ├── keyStore.ts# Key management
│   │   │   ├── memoryService.ts
│   │   │   ├── hooks.ts   # React hooks
│   │   │   └── api.ts     # API client
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   │   ├── auth.ts
│   │   │   ├── memory.ts
│   │   │   ├── zk.ts
│   │   │   ├── anchor.ts
│   │   │   ├── compliance.ts
│   │   │   └── keys.ts
│   │   ├── lib/           # Core services
│   │   │   ├── crypto.ts
│   │   │   ├── zkProver.ts
│   │   │   ├── midnight.ts
│   │   │   ├── database.ts
│   │   │   ├── auth.ts
│   │   │   └── agent.ts
│   │   └── index.ts
│   ├── data/              # SQLite database
│   └── package.json
│
├── circuits/              # ZK circuits (Circom)
│   └── poseidon_pattern.circom
│
├── shared/                # Shared utilities
│   └── package.json
│
├── docs/                  # Documentation
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── SETUP.md
│
└── README.md
```

## Configuration

### Environment Variables

Create `.env` files as needed:

**server/.env:**
```env
PORT=4000
DB_PATH=./data/wishpercache.db
MIDNIGHT_NETWORK=devnet
MIDNIGHT_API_KEY=your_api_key_here
NODE_ENV=development
```

**client/.env:**
```env
VITE_API_URL=http://localhost:4000
```

### TypeScript Configuration

Both client and server use TypeScript. Key configurations:

**server/tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

**client/tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx"
  }
}
```

## Building for Production

### Build Server

```bash
cd server
npm run build
```

Output: `server/dist/`

### Build Client

```bash
cd client
npm run build
```

Output: `client/dist/`

### Run Production Server

```bash
cd server
NODE_ENV=production node dist/index.js
```

## Testing

### Manual API Testing

```bash
# Create demo session
curl -X POST http://localhost:4000/api/auth/demo

# Use the returned token for authenticated requests
TOKEN="your_token_here"

# Create a memory
curl -X POST http://localhost:4000/api/memory \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "encryptedData": "base64_encrypted_data",
    "nonce": "base64_nonce",
    "tags": ["test", "demo"]
  }'

# Generate ZK proof
curl -X POST http://localhost:4000/api/zk/prove \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Any patterns?",
    "memoryHashes": []
  }'

# Anchor to blockchain
curl -X POST http://localhost:4000/api/anchor \
  -H "Content-Type: application/json" \
  -d '{
    "memoryHash": "hash123",
    "proofHash": "proof456"
  }'
```

## Troubleshooting

### Common Issues

**1. Port already in use:**
```bash
# Kill process on port 4000
npx kill-port 4000
```

**2. libsodium not loading:**
```bash
# Reinstall with fresh dependencies
rm -rf node_modules package-lock.json
npm install
```

**3. Database locked:**
```bash
# Delete and recreate database
rm server/data/wishpercache.db
```

**4. TypeScript errors:**
```bash
# Check for type errors
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
```

### Logs

Server logs are output to the console. For production, consider using a logger like Winston or Pino.

## Development Tips

1. **Hot Reload**: Both server (ts-node-dev) and client (Vite) support hot reload
2. **API Testing**: Use tools like Postman or Bruno for API testing
3. **Browser DevTools**: Use React DevTools extension for debugging
4. **Database Inspection**: Use a SQLite viewer to inspect `server/data/wishpercache.db`

## Next Steps

1. Read the [API Documentation](./API.md) for endpoint details
2. Understand the [Architecture](./ARCHITECTURE.md) 
3. Explore the demo at http://localhost:5173
4. Try the ZK Query Simulator on the homepage
