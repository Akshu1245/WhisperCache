/**
 * AdminDashboard.tsx
 * 
 * Organization Admin Dashboard - Shows key metrics and navigation
 * for privacy-preserving AI memory management.
 */

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import AnchoringStatus from './AnchoringStatus';

interface OrgStats {
  memories: number;
  proofs: number;
  anchors: number;
  users: number;
  complianceLogs: number;
}

interface MerkleStatus {
  currentRoot: string;
  leafCount: number;
  depth: number;
  lastUpdated: string;
}

interface NetworkStatus {
  midnight: {
    connected: boolean;
    latency: number;
    network: string;
  };
  cardano: {
    connected: boolean;
    latency: number;
    network: string;
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [merkleStatus, setMerkleStatus] = useState<MerkleStatus | null>(null);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'compliance' | 'anchors' | 'anchoring'>('overview');

  useEffect(() => {
    loadDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch stats
      const statsData = await api.getStats();
      setStats({
        memories: statsData.memories,
        proofs: statsData.zkProofs,
        anchors: statsData.anchors,
        users: 0, // Will be populated from org API
        complianceLogs: statsData.complianceLogs
      });

      // Fetch Merkle root status
      try {
        const merkleData = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/merkle/root`);
        const merkle = await merkleData.json();
        setMerkleStatus({
          currentRoot: merkle.root || 'N/A',
          leafCount: merkle.leafCount || 0,
          depth: merkle.depth || 20,
          lastUpdated: new Date().toISOString()
        });
      } catch {
        // Merkle may not be initialized
      }

      // Fetch network status
      try {
        const healthData = await api.health();
        setNetworkStatus({
          midnight: {
            connected: healthData.networks.midnight.connected,
            latency: healthData.networks.midnight.latency,
            network: healthData.services?.midnight?.network || 'testnet'
          },
          cardano: {
            connected: healthData.networks.cardano.connected,
            latency: healthData.networks.cardano.latency,
            network: 'preview'
          }
        });
      } catch {
        // Network status unavailable
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatHash = (hash: string) => {
    if (!hash || hash === 'N/A') return 'N/A';
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  };

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-teal-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Admin Dashboard
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Monitor your privacy-preserving AI memory infrastructure
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-900/50 rounded-xl p-1 flex gap-1">
            {(['overview', 'compliance', 'anchors', 'anchoring'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {tab === 'anchoring' ? 'Blockchain Status' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-center">
            {error}
          </div>
        )}

        {activeTab === 'overview' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <StatCard
                title="Total Memories"
                value={stats?.memories ?? 0}
                icon="🧠"
                color="teal"
                loading={loading}
              />
              <StatCard
                title="ZK Proofs"
                value={stats?.proofs ?? 0}
                icon="🔐"
                color="purple"
                loading={loading}
              />
              <StatCard
                title="Blockchain Anchors"
                value={stats?.anchors ?? 0}
                icon="⛓️"
                color="cyan"
                loading={loading}
              />
              <StatCard
                title="Compliance Logs"
                value={stats?.complianceLogs ?? 0}
                icon="📋"
                color="pink"
                loading={loading}
              />
            </div>

            {/* Merkle Tree Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">🌳</span>
                  Merkle Tree Status
                </h3>
                {loading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Current Root</span>
                      <code className="text-teal-400 bg-gray-900 px-3 py-1 rounded font-mono text-sm">
                        {formatHash(merkleStatus?.currentRoot || 'N/A')}
                      </code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Leaf Count</span>
                      <span className="text-white font-semibold">
                        {merkleStatus?.leafCount.toLocaleString() ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Tree Depth</span>
                      <span className="text-white font-semibold">{merkleStatus?.depth ?? 20}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Max Capacity</span>
                      <span className="text-gray-300">
                        {((2 ** (merkleStatus?.depth ?? 20))).toLocaleString()} leaves
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Network Status */}
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-2xl">🌐</span>
                  Network Status
                </h3>
                <div className="space-y-4">
                  <NetworkStatusRow
                    name="Midnight Network"
                    connected={networkStatus?.midnight.connected ?? false}
                    latency={networkStatus?.midnight.latency}
                    network={networkStatus?.midnight.network || 'testnet'}
                    loading={loading}
                  />
                  <NetworkStatusRow
                    name="Cardano"
                    connected={networkStatus?.cardano.connected ?? false}
                    latency={networkStatus?.cardano.latency}
                    network={networkStatus?.cardano.network || 'preview'}
                    loading={loading}
                  />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ActionButton
                  label="View Logs"
                  icon="📋"
                  onClick={() => setActiveTab('compliance')}
                />
                <ActionButton
                  label="View Anchors"
                  icon="⛓️"
                  onClick={() => setActiveTab('anchors')}
                />
                <ActionButton
                  label="Export Report"
                  icon="📊"
                  onClick={() => {
                    api.exportComplianceLogs().then(data => {
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                    });
                  }}
                />
                <ActionButton
                  label="Verify Chain"
                  icon="✅"
                  onClick={async () => {
                    try {
                      const result = await api.verifyComplianceChain();
                      alert(result.verified 
                        ? `✅ Chain verified! ${result.chainLength} logs` 
                        : '❌ Chain verification failed!');
                    } catch (err) {
                      alert('Verification error');
                    }
                  }}
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'compliance' && <ComplianceLogsView />}
        {activeTab === 'anchors' && <AnchorViewer />}
        {activeTab === 'anchoring' && <AnchoringStatus />}
      </div>
    </section>
  );
}

// ============================================
// Sub-components
// ============================================

function StatCard({ 
  title, 
  value, 
  icon, 
  color, 
  loading 
}: { 
  title: string; 
  value: number; 
  icon: string; 
  color: 'teal' | 'purple' | 'cyan' | 'pink';
  loading: boolean;
}) {
  const gradients = {
    teal: 'from-teal-500/20 to-teal-600/10 border-teal-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    pink: 'from-pink-500/20 to-pink-600/10 border-pink-500/30',
  };

  return (
    <div className={`bg-gradient-to-br ${gradients[color]} rounded-2xl p-6 border`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-3xl">{icon}</span>
        {loading && (
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      <div className="text-3xl font-bold text-white mb-1">
        {loading ? '-' : value.toLocaleString()}
      </div>
      <div className="text-gray-400 text-sm">{title}</div>
    </div>
  );
}

function NetworkStatusRow({
  name,
  connected,
  latency,
  network,
  loading
}: {
  name: string;
  connected: boolean;
  latency?: number;
  network: string;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} ${connected ? 'animate-pulse' : ''}`} />
        <div>
          <div className="text-white font-medium">{name}</div>
          <div className="text-gray-500 text-sm">{network}</div>
        </div>
      </div>
      <div className="text-right">
        {loading ? (
          <div className="w-12 h-4 bg-gray-700 rounded animate-pulse" />
        ) : (
          <>
            <div className={`text-sm font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </div>
            {latency !== undefined && (
              <div className="text-gray-500 text-xs">{latency}ms</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick
}: {
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-gray-700/50 hover:border-gray-600 transition-all group"
    >
      <span className="text-2xl group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-sm text-gray-300">{label}</span>
    </button>
  );
}

// ============================================
// Compliance Logs View Component
// ============================================

function ComplianceLogsView() {
  const [logs, setLogs] = useState<Array<{
    id: string;
    action: string;
    userId?: string;
    memoryId?: string;
    keyId: string;
    timestamp: string;
    logHash: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    keyId: '',
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getComplianceLogs({
        action: filters.action || undefined,
        keyId: filters.keyId || undefined,
        limit: 100
      });
      setLogs(data.logs);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const actionColors: Record<string, string> = {
    create: 'bg-green-500/20 text-green-400',
    access: 'bg-blue-500/20 text-blue-400',
    delete: 'bg-red-500/20 text-red-400',
    proof: 'bg-purple-500/20 text-purple-400',
    rotate_key: 'bg-yellow-500/20 text-yellow-400',
    anchor: 'bg-cyan-500/20 text-cyan-400',
    export: 'bg-pink-500/20 text-pink-400',
    share: 'bg-orange-500/20 text-orange-400',
  };

  return (
    <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
      <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
        <span className="text-2xl">📋</span>
        Compliance Audit Trail
      </h3>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-gray-400 text-sm mb-1">Action</label>
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
          >
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="access">Access</option>
            <option value="delete">Delete</option>
            <option value="proof">Proof</option>
            <option value="rotate_key">Key Rotation</option>
            <option value="anchor">Anchor</option>
            <option value="export">Export</option>
          </select>
        </div>
        <div>
          <label className="block text-gray-400 text-sm mb-1">Key ID</label>
          <input
            type="text"
            placeholder="key_..."
            value={filters.keyId}
            onChange={(e) => setFilters({ ...filters, keyId: e.target.value })}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
          />
        </div>
        <div>
          <label className="block text-gray-400 text-sm mb-1">From Date</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={loadLogs}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Timestamp</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Action</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Key ID</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Memory ID</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Log Hash</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-800">
                  <td className="py-3 px-4"><div className="h-4 bg-gray-700 rounded animate-pulse w-32" /></td>
                  <td className="py-3 px-4"><div className="h-4 bg-gray-700 rounded animate-pulse w-16" /></td>
                  <td className="py-3 px-4"><div className="h-4 bg-gray-700 rounded animate-pulse w-24" /></td>
                  <td className="py-3 px-4"><div className="h-4 bg-gray-700 rounded animate-pulse w-24" /></td>
                  <td className="py-3 px-4"><div className="h-4 bg-gray-700 rounded animate-pulse w-32" /></td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  No compliance logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className="py-3 px-4 text-gray-300 font-mono text-sm">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${actionColors[log.action] || 'bg-gray-500/20 text-gray-400'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-gray-300">
                    {log.keyId.length > 16 ? `${log.keyId.slice(0, 16)}...` : log.keyId}
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-gray-400">
                    {log.memoryId ? (log.memoryId.length > 16 ? `${log.memoryId.slice(0, 16)}...` : log.memoryId) : '-'}
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-teal-400">
                    {log.logHash.slice(0, 12)}...
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination would go here */}
      <div className="mt-4 flex justify-between items-center">
        <div className="text-gray-500 text-sm">
          Showing {logs.length} logs
        </div>
        <div className="flex gap-2">
          <button 
            disabled
            className="px-3 py-1 bg-gray-800 text-gray-500 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <button 
            disabled
            className="px-3 py-1 bg-gray-800 text-gray-500 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Anchor Viewer Component
// ============================================

function AnchorViewer() {
  const [anchors, setAnchors] = useState<Array<{
    txId: string;
    status: string;
    blockHeight?: number;
    timestamp: string;
    proofHash?: string;
    memoryHash?: string;
    network?: string;
    midnightTxId?: string;
    cardanoTxId?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnchors();
  }, []);

  const loadAnchors = async () => {
    try {
      setLoading(true);
      const data = await api.getRecentAnchors(50);
      setAnchors(data.anchors);
    } catch (err) {
      console.error('Failed to load anchors:', err);
    } finally {
      setLoading(false);
    }
  };

  const getExplorerUrl = (txId: string, network?: string) => {
    if (network === 'midnight') {
      return `https://explorer.midnight.network/tx/${txId}`;
    }
    // Cardano Preview testnet
    return `https://preview.cardanoscan.io/transaction/${txId}`;
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    submitted: 'bg-blue-500/20 text-blue-400',
    confirmed: 'bg-green-500/20 text-green-400',
    finalized: 'bg-teal-500/20 text-teal-400',
    failed: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
      <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
        <span className="text-2xl">⛓️</span>
        Blockchain Anchors
      </h3>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900/50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{anchors.length}</div>
          <div className="text-gray-400 text-sm">Total Anchors</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-400">
            {anchors.filter(a => a.status === 'confirmed' || a.status === 'finalized').length}
          </div>
          <div className="text-gray-400 text-sm">Confirmed</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">
            {anchors.filter(a => a.status === 'pending' || a.status === 'submitted').length}
          </div>
          <div className="text-gray-400 text-sm">Pending</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-400">
            {anchors.filter(a => a.status === 'failed').length}
          </div>
          <div className="text-gray-400 text-sm">Failed</div>
        </div>
      </div>

      {/* Anchors Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Timestamp</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Block</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">TX Hash</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Proof Hash</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Explorer</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-800">
                  <td className="py-3 px-4"><div className="h-4 bg-gray-700 rounded animate-pulse w-32" /></td>
                  <td className="py-3 px-4"><div className="h-4 bg-gray-700 rounded animate-pulse w-20" /></td>
                  <td className="py-3 px-4"><div className="h-4 bg-gray-700 rounded animate-pulse w-16" /></td>
                  <td className="py-3 px-4"><div className="h-4 bg-gray-700 rounded animate-pulse w-32" /></td>
                  <td className="py-3 px-4"><div className="h-4 bg-gray-700 rounded animate-pulse w-28" /></td>
                  <td className="py-3 px-4"><div className="h-4 bg-gray-700 rounded animate-pulse w-20" /></td>
                </tr>
              ))
            ) : anchors.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No blockchain anchors found
                </td>
              </tr>
            ) : (
              anchors.map((anchor) => (
                <tr key={anchor.txId} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className="py-3 px-4 text-gray-300 font-mono text-sm">
                    {new Date(anchor.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[anchor.status] || 'bg-gray-500/20 text-gray-400'}`}>
                      {anchor.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-300 font-mono text-sm">
                    {anchor.blockHeight?.toLocaleString() ?? '-'}
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-cyan-400">
                    {anchor.txId.slice(0, 12)}...{anchor.txId.slice(-8)}
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-purple-400">
                    {anchor.proofHash ? `${anchor.proofHash.slice(0, 12)}...` : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <a
                      href={getExplorerUrl(anchor.midnightTxId || anchor.cardanoTxId || anchor.txId, anchor.network)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1"
                    >
                      View
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Refresh button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={loadAnchors}
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
  );
}
