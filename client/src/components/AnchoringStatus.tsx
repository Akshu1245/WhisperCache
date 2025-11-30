/**
 * AnchoringStatus.tsx
 * 
 * Component to display real blockchain anchoring status.
 * Shows transaction details with explorer links for Midnight/Cardano testnets.
 */

import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface AnchorStatus {
  txId: string;
  network: string;
  status: 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';
  memoryHash: string;
  blockHeight?: number;
  explorerUrl?: string;
  confirmedAt?: string;
  retryCount: number;
}

interface AnchoringConfig {
  network: string;
  supportedNetworks: string[];
  walletAddress: string;
  maxRetries: number;
  confirmationTimeoutMs: number;
  explorerBaseUrls: Record<string, string>;
}

export default function AnchoringStatus() {
  const [config, setConfig] = useState<AnchoringConfig | null>(null);
  const [anchors, setAnchors] = useState<AnchorStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnchoringConfig();
    loadRecentAnchors();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadRecentAnchors, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadAnchoringConfig() {
    try {
      const response = await api.get('/api/anchor/config');
      setConfig(response.data);
    } catch (err) {
      console.error('Failed to load anchoring config:', err);
    }
  }

  async function loadRecentAnchors() {
    try {
      setLoading(true);
      const response = await api.get('/api/anchor/recent');
      setAnchors(response.data.anchors || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load anchors:', err);
      setError('Failed to load anchoring data');
    } finally {
      setLoading(false);
    }
  }

  if (!config) {
    return <div className="text-center text-gray-500">Loading...</div>;
  }

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-500/20 text-yellow-400',
    SUBMITTED: 'bg-blue-500/20 text-blue-400',
    CONFIRMED: 'bg-green-500/20 text-green-400',
    FAILED: 'bg-red-500/20 text-red-400'
  };

  const statusIcons: Record<string, string> = {
    PENDING: '⏳',
    SUBMITTED: '📤',
    CONFIRMED: '✅',
    FAILED: '❌'
  };

  return (
    <div className="space-y-6">
      {/* Config Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 100 2H3a1 1 0 00-1 1v10a1 1 0 001 1h14a1 1 0 001-1V6a1 1 0 00-1-1h-3a1 1 0 100 2h2v9H4V5z" clipRule="evenodd" />
          </svg>
          Blockchain Anchoring Configuration
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Network</div>
            <div className="text-white font-mono font-bold mt-1">{config.network}</div>
          </div>

          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Max Retries</div>
            <div className="text-white font-mono font-bold mt-1">{config.maxRetries}</div>
          </div>

          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Timeout</div>
            <div className="text-white font-mono font-bold mt-1">{config.confirmationTimeoutMs / 1000}s</div>
          </div>

          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Wallet</div>
            <div className="text-teal-400 font-mono text-sm font-bold mt-1 truncate">{config.walletAddress}</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Supported Networks</div>
          <div className="flex flex-wrap gap-2">
            {config.supportedNetworks.map(network => (
              <span
                key={network}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  network === config.network
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                }`}
              >
                {network}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Anchors */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-teal-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 11-2 0V5H5v10h6a1 1 0 110 2H4a1 1 0 01-1-1V4z" clipRule="evenodd" />
          </svg>
          Recent Anchoring Transactions
        </h3>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 rounded p-3 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="inline-block animate-spin">⚙️</div> Loading anchors...
            </div>
          ) : anchors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No recent anchors</div>
          ) : (
            anchors.map(anchor => (
              <div
                key={anchor.txId}
                className="bg-gray-800/50 border border-gray-700 rounded p-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{statusIcons[anchor.status]}</span>
                    <div>
                      <div className="text-sm text-gray-400">
                        {new Date(anchor.confirmedAt || new Date()).toLocaleString()}
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium inline-block ${statusColors[anchor.status]}`}>
                        {anchor.status}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    Retry: {anchor.retryCount}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs my-2">
                  <div>
                    <span className="text-gray-500">Network:</span>
                    <span className="text-gray-300 ml-1 font-mono">{anchor.network}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Block Height:</span>
                    <span className="text-gray-300 ml-1 font-mono">{anchor.blockHeight?.toLocaleString() || '—'}</span>
                  </div>
                </div>

                <div className="text-xs mb-2">
                  <span className="text-gray-500">TX ID:</span>
                  <span className="text-cyan-400 ml-1 font-mono break-all">{anchor.txId}</span>
                </div>

                <div className="text-xs mb-2">
                  <span className="text-gray-500">Memory Hash:</span>
                  <span className="text-purple-400 ml-1 font-mono">{anchor.memoryHash.slice(0, 20)}...</span>
                </div>

                {anchor.explorerUrl && (
                  <div className="pt-2 border-t border-gray-700">
                    <a
                      href={anchor.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:text-teal-300 text-xs font-medium flex items-center gap-1 inline-flex"
                    >
                      View on Explorer
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={loadRecentAnchors}
            disabled={loading}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
