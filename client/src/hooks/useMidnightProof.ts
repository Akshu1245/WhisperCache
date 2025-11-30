/**
 * useMidnightProof Hook
 * 
 * Custom React hook for interacting with Midnight Compact proof generation API
 */

import { useState, useCallback } from 'react';

export interface ProofData {
  hash: string;
  verified: boolean;
  circuitVersion: string;
  executionMode: 'real' | 'simulated';
  timestamp: string;
}

export interface WitnessData {
  memory_content: string;
  memory_timestamp: number;
  memory_category: number;
  user_secret_key: string;
  pattern_query: string;
  user_public_id: string;
  min_confidence_threshold: number;
}

export interface SystemStatus {
  system: string;
  version: string;
  capabilities: string[];
  environment: {
    midnightCliPath: string;
    compactCircuitExists: boolean;
    proofOutputDirExists: boolean;
  };
  timestamp: string;
}

export interface UseMidnightProofOptions {
  apiBaseUrl?: string;
  onProofGenerated?: (proof: ProofData) => void;
  onError?: (error: string) => void;
}

export const useMidnightProof = (options: UseMidnightProofOptions = {}) => {
  const apiBaseUrl = options.apiBaseUrl || 'http://localhost:4000';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [witness, setWitness] = useState<WitnessData | null>(null);
  const [proof, setProof] = useState<ProofData | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);

  const handleError = useCallback(
    (err: Error | string) => {
      const message = err instanceof Error ? err.message : err;
      setError(message);
      if (options.onError) {
        options.onError(message);
      }
    },
    [options]
  );

  const generateWitness = useCallback(
    async (
      query: string,
      memoryCategory: string = 'personal',
      userId?: string
    ) => {
      if (!query.trim()) {
        handleError('Query cannot be empty');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/zk/midnight/generate-witness`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: query.trim(),
              memoryCategory,
              userId
            })
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to generate witness');
        }

        const data = await response.json();
        setWitness(data.witness);
        return data.witness;
      } catch (err) {
        handleError(err as Error);
        setWitness(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, handleError]
  );

  const generateProof = useCallback(
    async (
      query: string,
      memoryHash?: string,
      memoryCategory: string = 'personal',
      useRealProof: boolean = false
    ) => {
      if (!query.trim()) {
        handleError('Query cannot be empty');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/zk/midnight/generate-proof`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: query.trim(),
              memoryHash,
              memoryCategory,
              useRealProof
            })
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to generate proof');
        }

        const data = await response.json();
        setProof(data.proof);
        
        if (options.onProofGenerated) {
          options.onProofGenerated(data.proof);
        }

        return data.proof;
      } catch (err) {
        handleError(err as Error);
        setProof(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, handleError, options]
  );

  const verifyProof = useCallback(
    async (proofData: string, witness?: WitnessData, publicInputs?: any) => {
      if (!proofData) {
        handleError('Proof data is required');
        return false;
      }

      setLoading(true);

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/zk/midnight/verify-proof`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              proofData,
              witness,
              publicInputs
            })
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to verify proof');
        }

        const data = await response.json();
        return data.verified;
      } catch (err) {
        handleError(err as Error);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, handleError]
  );

  const exportForAnchoring = useCallback(
    async (proofHash: string) => {
      if (!proofHash) {
        handleError('Proof hash is required');
        return null;
      }

      setLoading(true);

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/zk/midnight/export-for-anchoring`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proofHash })
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to export proof');
        }

        const data = await response.json();
        return data.exportedProof;
      } catch (err) {
        handleError(err as Error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, handleError]
  );

  const runCliDemo = useCallback(
    async (query: string, memoryHash?: string, demoMode: boolean = true) => {
      if (!query.trim()) {
        handleError('Query cannot be empty');
        return null;
      }

      setLoading(true);

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/zk/midnight/cli-demo`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: query.trim(),
              memoryHash,
              demoMode
            })
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to run CLI demo');
        }

        const data = await response.json();
        return data.result;
      } catch (err) {
        handleError(err as Error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, handleError]
  );

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/zk/midnight/status`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        return data;
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
    return null;
  }, [apiBaseUrl]);

  return {
    // State
    loading,
    error,
    witness,
    proof,
    status,

    // Methods
    generateWitness,
    generateProof,
    verifyProof,
    exportForAnchoring,
    runCliDemo,
    fetchStatus,

    // Reset functions
    clearError: () => setError(null),
    clearProof: () => setProof(null),
    clearWitness: () => setWitness(null)
  };
};

export default useMidnightProof;
