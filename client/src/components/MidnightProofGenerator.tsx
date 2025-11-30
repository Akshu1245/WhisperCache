/**
 * Midnight Compact Proof Generator Component
 * 
 * React component for generating zero-knowledge proofs using Midnight Compact
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface ProofData {
  hash: string;
  verified: boolean;
  circuitVersion: string;
  executionMode: 'real' | 'simulated';
  timestamp: string;
}

interface WitnessData {
  memory_content: string;
  memory_timestamp: number;
  memory_category: number;
  user_secret_key: string;
  pattern_query: string;
  user_public_id: string;
  min_confidence_threshold: number;
}

interface MidnightProofGeneratorProps {
  apiBaseUrl?: string;
  onProofGenerated?: (proof: ProofData) => void;
}

const MidnightProofGenerator: React.FC<MidnightProofGeneratorProps> = ({
  apiBaseUrl = 'http://localhost:4000',
  onProofGenerated
}) => {
  const [query, setQuery] = useState('');
  const [memoryHash, setMemoryHash] = useState('');
  const [memoryCategory, setMemoryCategory] = useState('personal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [witness, setWitness] = useState<WitnessData | null>(null);
  const [proof, setProof] = useState<ProofData | null>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);

  // Fetch system status on mount
  useEffect(() => {
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/zk/midnight/status`);
      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch system status:', err);
    }
  };

  const generateWitness = async () => {
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/zk/midnight/generate-witness`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: query.trim(),
            memoryCategory,
            userId: 'current-user' // In real app, get from auth context
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate witness');
      }

      const data = await response.json();
      setWitness(data.witness);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate witness');
      setWitness(null);
    } finally {
      setLoading(false);
    }
  };

  const generateProof = async () => {
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/zk/midnight/generate-proof`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: query.trim(),
            memoryHash: memoryHash || undefined,
            memoryCategory,
            useRealProof: false // Default to simulated mode
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate proof');
      }

      const data = await response.json();
      setProof(data.proof);
      setError(null);
      
      if (onProofGenerated) {
        onProofGenerated(data.proof);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proof');
      setProof(null);
    } finally {
      setLoading(false);
    }
  };

  const verifyProof = async () => {
    if (!proof) {
      setError('No proof to verify');
      return;
    }

    setLoading(true);

    try {
      const proofData = JSON.stringify({
        publicInputs: { proof_valid: proof.verified },
        proofElements: { verified: proof.verified }
      });

      const response = await fetch(
        `${apiBaseUrl}/api/zk/midnight/verify-proof`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            proofData,
            witness
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify proof');
      }

      const data = await response.json();
      if (data.verified) {
        setError(null);
        // Show success through UI
      } else {
        setError('Proof verification failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify proof');
    } finally {
      setLoading(false);
    }
  };

  const exportForAnchoring = async () => {
    if (!proof) {
      setError('No proof to export');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/zk/midnight/export-for-anchoring`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            proofHash: proof.hash
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to export proof');
      }

      const data = await response.json();
      console.log('Proof exported for anchoring:', data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export proof');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Midnight Compact Proof Generator
      </h1>

      {/* System Status */}
      {systemStatus && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <h3 className="font-semibold text-blue-900 mb-2">System Status</h3>
          <p className="text-sm text-blue-800">
            Mode: <span className="font-mono bg-blue-100 px-2 py-1 rounded">
              {systemStatus.environment?.compactCircuitExists ? 'Ready' : 'Degraded'}
            </span>
          </p>
          <p className="text-sm text-blue-800 mt-1">
            Version: {systemStatus.version}
          </p>
        </div>
      )}

      {/* Query Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Memory Query
        </label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., Find memories about health"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          disabled={loading}
        />
      </div>

      {/* Memory Category */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Memory Category
        </label>
        <select
          value={memoryCategory}
          onChange={(e) => setMemoryCategory(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        >
          <option value="personal">Personal</option>
          <option value="health">Health</option>
          <option value="finance">Finance</option>
          <option value="work">Work</option>
        </select>
      </div>

      {/* Memory Hash (Optional) */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Memory Hash (Optional)
        </label>
        <input
          type="text"
          value={memoryHash}
          onChange={(e) => setMemoryHash(e.target.value)}
          placeholder="Leave empty for random hash"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <button
          onClick={generateWitness}
          disabled={loading || !query.trim()}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : '📜'}
          Generate Witness
        </button>

        <button
          onClick={generateProof}
          disabled={loading || !query.trim()}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : '🔐'}
          Generate Proof
        </button>

        <button
          onClick={verifyProof}
          disabled={loading || !proof}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : '✓'}
          Verify Proof
        </button>

        <button
          onClick={exportForAnchoring}
          disabled={loading || !proof}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 transition"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : '⛓️'}
          Export for Chain
        </button>
      </div>

      {/* Witness Display */}
      {witness && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-green-900">Witness Generated</h3>
          </div>
          <pre className="text-xs bg-white p-3 rounded border border-green-300 overflow-auto max-h-48">
            {JSON.stringify(witness, null, 2)}
          </pre>
        </div>
      )}

      {/* Proof Display */}
      {proof && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-blue-900">Proof Generated</h3>
          </div>
          <div className="space-y-2 text-sm text-blue-900">
            <p>
              <span className="font-semibold">Hash:</span>{' '}
              <span className="font-mono break-all">{proof.hash}</span>
            </p>
            <p>
              <span className="font-semibold">Verified:</span>{' '}
              {proof.verified ? '✓ Yes' : '✗ No'}
            </p>
            <p>
              <span className="font-semibold">Execution Mode:</span>{' '}
              {proof.executionMode}
            </p>
            <p>
              <span className="font-semibold">Circuit Version:</span>{' '}
              {proof.circuitVersion}
            </p>
            <p>
              <span className="font-semibold">Generated:</span>{' '}
              {new Date(proof.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MidnightProofGenerator;
