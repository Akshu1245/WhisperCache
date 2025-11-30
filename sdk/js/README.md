# WhisperCache JavaScript SDK

Privacy-preserving AI memory as a service.

## Installation

```bash
npm install @whispercache/sdk
# or
yarn add @whispercache/sdk
# or
pnpm add @whispercache/sdk
```

## Quick Start

```typescript
import { WhisperCacheClient } from '@whispercache/sdk';

// Initialize the client
const client = new WhisperCacheClient({
  baseUrl: 'http://localhost:4000',
  apiKey: 'your-api-key' // Optional
});

// Store a memory (encrypted automatically)
const memory = await client.storeMemory({
  content: 'User prefers dark mode',
  tags: ['preferences', 'ui'],
  confidence: 0.95
});

console.log('Stored:', memory.id);

// Generate a ZK proof for policy compliance
const proof = await client.provePolicy({
  commitment: memory.commitment,
  policy: 'no_health_data',
  pattern: { finance: false, health: false, personal: true }
});

if (proof.allowedForAgent) {
  console.log('Agent can access this memory');
}

// Query the agent with privacy guarantees
const result = await client.queryAgent({
  query: 'What are the user preferences?',
  policies: ['no_health_data']
});

console.log('Response:', result.response);
```

## Features

- **🔐 End-to-end encryption**: Memories are encrypted before leaving your device
- **🎭 Zero-knowledge proofs**: Prove policy compliance without revealing content
- **⛓️ Blockchain anchoring**: Anchor proofs to Midnight and Cardano
- **🏢 Multi-tenant**: Organization support with role-based access
- **📋 Compliance logging**: Full audit trail for regulatory compliance

## API Reference

### WhisperCacheClient

#### Constructor

```typescript
const client = new WhisperCacheClient({
  baseUrl: string;          // API URL
  apiKey?: string;          // Optional API key
  orgId?: string;           // Optional organization ID
  timeout?: number;         // Request timeout (default: 30000)
  fetch?: typeof fetch;     // Custom fetch implementation
});
```

#### Methods

##### Memory Management

```typescript
// Store a memory
await client.storeMemory({
  content: string;
  tags?: string[];
  confidence?: number;
  metadata?: Record<string, unknown>;
});

// Get memory metadata
await client.getMemory(memoryId: string);

// List memories
await client.listMemories({
  tags?: string[];
  limit?: number;
  offset?: number;
});

// Delete a memory
await client.deleteMemory(memoryId: string);
```

##### ZK Proofs

```typescript
// Generate a policy proof
await client.provePolicy({
  memoryId?: string;
  commitment?: string;
  policy: string;
  pattern?: {
    finance?: boolean;
    health?: boolean;
    personal?: boolean;
  };
});

// Verify a proof
await client.verifyProof(proofHash: string);
```

##### Agent Queries

```typescript
// Query with ZK verification
await client.queryAgent({
  query: string;
  policies?: string[];
  memoryIds?: string[];
  limit?: number;
  includeProofs?: boolean;
});
```

##### Blockchain

```typescript
// Anchor a proof
await client.anchorProof(proofHash: string, {
  network?: 'midnight' | 'cardano' | 'both';
  memoryHash?: string;
});

// Check anchor status
await client.getAnchorStatus(txId: string);
```

## Examples

See the [examples](./examples) directory:

- [node-agent.ts](./examples/node-agent.ts) - Node.js agent example
- [browser-client.ts](./examples/browser-client.ts) - Browser integration

## Environment Variables

For development, you can use these environment variables:

```bash
WHISPERCACHE_URL=http://localhost:4000
WHISPERCACHE_API_KEY=your-api-key
```

## Error Handling

```typescript
import { WhisperCacheClient, WhisperCacheError } from '@whispercache/sdk';

try {
  await client.storeMemory({ content: 'test' });
} catch (error) {
  if (error instanceof WhisperCacheError) {
    console.error('API Error:', error.message);
    console.error('Status Code:', error.statusCode);
    console.error('Details:', error.details);
  }
}
```

## License

MIT
