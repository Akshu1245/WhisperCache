# Midnight Compact Integration - Client Usage Guide

**Date**: December 2024  
**Component**: React Client Integration  
**Status**: ✅ Complete

---

## Overview

The WhisperCache client provides a complete integration with the Midnight Compact proving system through:

1. **React Component** (`MidnightProofGenerator.tsx`)
2. **Custom Hook** (`useMidnightProof.ts`)
3. **API Integration** (HTTP client)

---

## Quick Start

### Basic Usage with Component

```tsx
import MidnightProofGenerator from './components/MidnightProofGenerator';

export default function App() {
  return (
    <MidnightProofGenerator
      apiBaseUrl="http://localhost:4000"
      onProofGenerated={(proof) => {
        console.log('Proof generated:', proof);
      }}
    />
  );
}
```

### Basic Usage with Hook

```tsx
import useMidnightProof from './hooks/useMidnightProof';

export default function MyComponent() {
  const { generateProof, proof, loading, error } = useMidnightProof();

  const handleClick = async () => {
    await generateProof('Find my health memories', 'memory-hash-123', 'health');
  };

  return (
    <div>
      <button onClick={handleClick} disabled={loading}>
        Generate Proof
      </button>
      {error && <p>Error: {error}</p>}
      {proof && <p>Proof hash: {proof.hash}</p>}
    </div>
  );
}
```

---

## Component API

### Props

```typescript
interface MidnightProofGeneratorProps {
  apiBaseUrl?: string;        // Default: "http://localhost:4000"
  onProofGenerated?: (proof: ProofData) => void;
}
```

### Features

- **Witness Generation** - Generate witness data for proofs
- **Proof Generation** - Create Midnight Compact proofs
- **Proof Verification** - Verify proofs locally
- **Proof Export** - Export proofs for blockchain anchoring
- **System Status** - Check Midnight system readiness
- **Real-time Feedback** - Error messages and success indicators

### Example: Full Workflow

```tsx
import MidnightProofGenerator from './components/MidnightProofGenerator';

export default function ProofWorkflow() {
  const handleProofGenerated = (proof) => {
    console.log('✓ Proof generated successfully');
    console.log('Hash:', proof.hash);
    console.log('Verified:', proof.verified);
    console.log('Mode:', proof.executionMode);
  };

  return (
    <MidnightProofGenerator
      apiBaseUrl="http://localhost:4000"
      onProofGenerated={handleProofGenerated}
    />
  );
}
```

---

## Hook API

### useMidnightProof Options

```typescript
interface UseMidnightProofOptions {
  apiBaseUrl?: string;                    // Default: "http://localhost:4000"
  onProofGenerated?: (proof: ProofData) => void;
  onError?: (error: string) => void;
}
```

### Returned Values & Methods

```typescript
const {
  // State
  loading: boolean;                   // True during API calls
  error: string | null;              // Last error message
  witness: WitnessData | null;       // Last generated witness
  proof: ProofData | null;           // Last generated proof
  status: SystemStatus | null;       // System status

  // Methods
  generateWitness: (query, category?, userId?) => Promise<WitnessData>;
  generateProof: (query, hash?, category?, useReal?) => Promise<ProofData>;
  verifyProof: (proofData, witness?, inputs?) => Promise<boolean>;
  exportForAnchoring: (proofHash) => Promise<any>;
  runCliDemo: (query, hash?, demoMode?) => Promise<any>;
  fetchStatus: () => Promise<SystemStatus>;

  // Utilities
  clearError: () => void;
  clearProof: () => void;
  clearWitness: () => void;
} = useMidnightProof(options);
```

---

## Examples

### Example 1: Simple Witness Generation

```tsx
import useMidnightProof from './hooks/useMidnightProof';

export default function WitnessGenerator() {
  const { generateWitness, witness, loading } = useMidnightProof();

  const handleGenerate = async () => {
    const w = await generateWitness(
      'Find memories about health',
      'health',
      'user-123'
    );
    if (w) {
      console.log('Witness pattern:', w.pattern_query);
    }
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Witness'}
      </button>
      {witness && (
        <pre>{JSON.stringify(witness, null, 2)}</pre>
      )}
    </div>
  );
}
```

### Example 2: Full Proof Workflow

```tsx
import useMidnightProof from './hooks/useMidnightProof';
import { useState } from 'react';

export default function ProofWorkflow() {
  const {
    generateWitness,
    generateProof,
    verifyProof,
    exportForAnchoring,
    proof,
    witness,
    loading,
    error
  } = useMidnightProof();

  const [step, setStep] = useState(1);

  const handleStep1 = async () => {
    const w = await generateWitness('Find health memories', 'health');
    if (w) setStep(2);
  };

  const handleStep2 = async () => {
    const p = await generateProof('Find health memories', 'hash-123', 'health');
    if (p) setStep(3);
  };

  const handleStep3 = async () => {
    const isValid = await verifyProof(
      JSON.stringify(proof)
    );
    if (isValid) setStep(4);
  };

  const handleStep4 = async () => {
    if (proof) {
      await exportForAnchoring(proof.hash);
    }
  };

  return (
    <div className="space-y-4">
      <div>Current Step: {step}</div>
      
      {step >= 1 && (
        <button onClick={handleStep1} disabled={loading}>
          Step 1: Generate Witness
        </button>
      )}

      {step >= 2 && (
        <button onClick={handleStep2} disabled={loading}>
          Step 2: Generate Proof
        </button>
      )}

      {step >= 3 && (
        <button onClick={handleStep3} disabled={loading}>
          Step 3: Verify Proof
        </button>
      )}

      {step >= 4 && (
        <button onClick={handleStep4} disabled={loading}>
          Step 4: Export for Chain
        </button>
      )}

      {error && <div className="text-red-600">{error}</div>}
    </div>
  );
}
```

### Example 3: Error Handling

```tsx
import useMidnightProof from './hooks/useMidnightProof';

export default function ErrorHandling() {
  const {
    generateProof,
    error,
    clearError
  } = useMidnightProof({
    onError: (err) => {
      console.error('Proof generation failed:', err);
      // Could send to error tracking service
    }
  });

  const handleGenerate = async () => {
    await generateProof('test query');
  };

  return (
    <div>
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 rounded">
          <p className="text-red-800">{error}</p>
          <button onClick={clearError} className="text-sm text-red-600 mt-2">
            Dismiss
          </button>
        </div>
      )}
      <button onClick={handleGenerate}>Generate</button>
    </div>
  );
}
```

### Example 4: System Status Check

```tsx
import useMidnightProof from './hooks/useMidnightProof';
import { useEffect } from 'react';

export default function StatusChecker() {
  const { fetchStatus, status } = useMidnightProof();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return (
    <div>
      {status ? (
        <div>
          <h3>System Status: {status.system}</h3>
          <p>Version: {status.version}</p>
          <p>Circuit Exists: {status.environment.compactCircuitExists ? '✓' : '✗'}</p>
          <p>Capabilities: {status.capabilities.join(', ')}</p>
        </div>
      ) : (
        <p>Loading status...</p>
      )}
    </div>
  );
}
```

### Example 5: Batch Proof Generation

```tsx
import useMidnightProof from './hooks/useMidnightProof';
import { useState } from 'react';

export default function BatchProofGenerator() {
  const { generateProof, loading, error } = useMidnightProof();
  const [results, setResults] = useState<any[]>([]);

  const handleBatchGenerate = async () => {
    const queries = [
      'Find health memories',
      'Find finance memories',
      'Find work memories'
    ];

    const proofs = await Promise.all(
      queries.map((q, i) =>
        generateProof(q, `hash-${i}`, i === 0 ? 'health' : 'personal')
      )
    );

    setResults(proofs.filter(p => p !== null));
  };

  return (
    <div>
      <button onClick={handleBatchGenerate} disabled={loading}>
        Generate {loading ? '...' : '3 Proofs'}
      </button>
      
      {error && <p className="text-red-600">{error}</p>}
      
      <div>
        {results.map((p, i) => (
          <div key={i} className="p-2 border rounded mt-2">
            <p>Proof {i + 1}: {p.hash.slice(0, 16)}...</p>
            <p>Verified: {p.verified ? '✓' : '✗'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Type Definitions

### ProofData

```typescript
interface ProofData {
  hash: string;                              // Proof identifier
  verified: boolean;                         // Verification status
  circuitVersion: string;                    // Circuit version
  executionMode: 'real' | 'simulated';      // Execution mode
  timestamp: string;                         // ISO 8601 timestamp
}
```

### WitnessData

```typescript
interface WitnessData {
  memory_content: string;                    // Memory content hash
  memory_timestamp: number;                  // Memory timestamp
  memory_category: number;                   // Category code (1-4)
  user_secret_key: string;                   // Secret key
  pattern_query: string;                     // Query pattern hash
  user_public_id: string;                    // Public user ID
  min_confidence_threshold: number;          // Confidence threshold
}
```

### SystemStatus

```typescript
interface SystemStatus {
  system: string;                            // "midnight-compact"
  version: string;                           // Version number
  capabilities: string[];                    // List of capabilities
  environment: {
    midnightCliPath: string;                 // CLI path
    compactCircuitExists: boolean;           // Circuit exists
    proofOutputDirExists: boolean;           // Output dir exists
  };
  timestamp: string;                         // ISO 8601 timestamp
}
```

---

## Integration with Context

### Example: Using with React Context

```tsx
import React, { createContext, useContext } from 'react';
import useMidnightProof from '../hooks/useMidnightProof';

interface MidnightContextType {
  generateProof: (...args: any[]) => Promise<any>;
  proof: any;
  loading: boolean;
  error: string | null;
}

const MidnightContext = createContext<MidnightContextType | undefined>(undefined);

export function MidnightProvider({ children }: { children: React.ReactNode }) {
  const midnight = useMidnightProof();

  return (
    <MidnightContext.Provider value={midnight}>
      {children}
    </MidnightContext.Provider>
  );
}

export function useMidnight() {
  const context = useContext(MidnightContext);
  if (!context) {
    throw new Error('useMidnight must be used within MidnightProvider');
  }
  return context;
}
```

Usage:

```tsx
import { MidnightProvider, useMidnight } from './context/MidnightContext';

function App() {
  return (
    <MidnightProvider>
      <ProofComponent />
    </MidnightProvider>
  );
}

function ProofComponent() {
  const { generateProof, proof, loading } = useMidnight();
  
  return (
    <button onClick={() => generateProof('test')}>
      {loading ? 'Loading...' : 'Generate Proof'}
    </button>
  );
}
```

---

## Best Practices

### 1. Error Handling

```tsx
const { generateProof, error, clearError } = useMidnightProof({
  onError: (err) => {
    // Log to error tracking service
    logToSentry(err);
  }
});

// Always clear errors when starting new operation
const handleClick = async () => {
  clearError();
  await generateProof('query');
};
```

### 2. Loading States

```tsx
const { loading } = useMidnightProof();

return (
  <button disabled={loading}>
    {loading ? '⏳ Generating...' : '✓ Generate Proof'}
  </button>
);
```

### 3. Memory Management

```tsx
useEffect(() => {
  return () => {
    // Clear sensitive data on unmount
    clearProof();
    clearWitness();
  };
}, [clearProof, clearWitness]);
```

### 4. Caching Proofs

```tsx
const [proofCache, setProofCache] = useState<Map<string, ProofData>>(new Map());

const { generateProof } = useMidnightProof({
  onProofGenerated: (proof) => {
    setProofCache(new Map(proofCache).set(proof.hash, proof));
  }
});
```

---

## Troubleshooting

### Issue: API Connection Error

**Solution:**
```tsx
const { generateProof } = useMidnightProof({
  apiBaseUrl: process.env.REACT_APP_API_URL || 'http://localhost:4000'
});
```

### Issue: Proof Generation Timeout

**Solution:**
```tsx
// Add timeout handling
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const proof = await generateProof('query');
} finally {
  clearTimeout(timeoutId);
}
```

### Issue: State Not Updating

**Solution:**
```tsx
// Ensure you're using the latest values from hook
const { proof, generateProof } = useMidnightProof();

// Not: const proof = proof; // Wrong - closure issue
// Instead: const latestProof = proof; // Right - get from hook each render
```

---

## Testing

### Jest/React Testing Library Example

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MidnightProofGenerator from './MidnightProofGenerator';

describe('MidnightProofGenerator', () => {
  it('should generate proof on button click', async () => {
    render(<MidnightProofGenerator />);
    
    const input = screen.getByPlaceholderText(/Find memories/i);
    const button = screen.getByText(/Generate Proof/i);

    await userEvent.type(input, 'Test query');
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Proof Generated/i)).toBeInTheDocument();
    });
  });
});
```

---

## Performance Considerations

1. **Memoization**: Use `useMemo` for expensive computations
2. **Lazy Loading**: Load MidnightProofGenerator only when needed
3. **Request Batching**: Group multiple proof requests together
4. **Caching**: Cache proofs locally to avoid regeneration

---

## Production Deployment

```tsx
// Use environment variables for API URL
const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000';

// Enable proper error tracking
const { generateProof } = useMidnightProof({
  onError: (error) => {
    if (process.env.NODE_ENV === 'production') {
      // Send to error tracking service
      reportError(error);
    }
  }
});
```

---

## Support & Resources

- **Component**: `client/src/components/MidnightProofGenerator.tsx`
- **Hook**: `client/src/hooks/useMidnightProof.ts`
- **Tests**: `server/src/routes/__tests__/midnight.test.ts`
- **API Docs**: `MIDNIGHT_INTEGRATION_SUMMARY.md`

---

**Last Updated**: December 2024  
**Status**: ✅ Production Ready
