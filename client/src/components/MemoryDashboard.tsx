/**
 * Memory Dashboard Component
 * 
 * Provides UI for:
 * - Creating memories with tags
 * - Viewing memory list with tags + status
 * - Displaying anchor transaction info
 * - Debug view for agent queries
 */

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:4000/api";

// Types
interface Memory {
  id: string;
  memoryCommitment: string;
  tags: string[];
  status: "ACTIVE" | "DELETED" | "REVOKED";
  createdAt: string;
  updatedAt: string;
  confidence?: number;
}

interface Anchor {
  txId: string;
  network: string;
  status: string;
  blockHeight: number;
  createdAt: string;
}

interface AgentQueryResult {
  success: boolean;
  agentContext: {
    canUseMemory: boolean;
    redactionReason?: string;
    safeSummary?: string;
    policyApplied: string;
    allowedTags?: string[];
    blockedTags?: string[];
  };
  proofSummary: {
    allowedForAgent: boolean;
    policyType: string;
    patternMatched: boolean;
    confidence: number;
    proofHash?: string;
    isRealProof: boolean;
  };
}

// Icons
const TagIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const LinkIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    ACTIVE: "bg-green-500/20 text-green-300 border-green-500/30",
    DELETED: "bg-red-500/20 text-red-300 border-red-500/30",
    REVOKED: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border ${colors[status as keyof typeof colors] || colors.ACTIVE}`}>
      {status}
    </span>
  );
};

// Tag component
const Tag = ({ tag, onRemove }: { tag: string; onRemove?: () => void }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-teal-500/20 text-teal-300 rounded-full border border-teal-500/30">
    {tag}
    {onRemove && (
      <button onClick={onRemove} className="hover:text-red-400">×</button>
    )}
  </span>
);

export default function MemoryDashboard() {
  const [userId, setUserId] = useState("demo-user");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "create" | "agent">("list");
  
  // Create memory state
  const [newCommitment, setNewCommitment] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  
  // Agent query state
  const [selectedMemory, setSelectedMemory] = useState<string>("");
  const [pattern, setPattern] = useState({ isFinance: false, isHealth: false, isPersonal: false });
  const [agentResult, setAgentResult] = useState<AgentQueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  // Fetch memories
  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/memory`, {
        headers: { "x-user-id": userId }
      });
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      }
    } catch (err) {
      console.error("Failed to fetch memories:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (activeTab === "list") {
      fetchMemories();
    }
  }, [activeTab, fetchMemories]);

  // Create memory
  const createMemory = async () => {
    if (!newCommitment) return;
    
    const commitment = newCommitment.match(/^[a-fA-F0-9]+$/) 
      ? newCommitment 
      : Array.from(newCommitment).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').padEnd(64, '0');
    
    try {
      const res = await fetch(`${API_BASE}/memory`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": userId 
        },
        body: JSON.stringify({
          memoryCommitment: commitment.slice(0, 64),
          tags: newTags
        })
      });
      
      if (res.ok) {
        setNewCommitment("");
        setNewTags([]);
        setActiveTab("list");
        fetchMemories();
      }
    } catch (err) {
      console.error("Failed to create memory:", err);
    }
  };

  // Agent query
  const runAgentQuery = async () => {
    if (!selectedMemory) return;
    
    setQueryLoading(true);
    setAgentResult(null);
    
    try {
      const res = await fetch(`${API_BASE}/agent/query`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": userId 
        },
        body: JSON.stringify({
          memoryId: selectedMemory,
          pattern,
          agentPrompt: "Debug query from dashboard"
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setAgentResult(data);
      }
    } catch (err) {
      console.error("Agent query failed:", err);
    } finally {
      setQueryLoading(false);
    }
  };

  // Add tag
  const addTag = () => {
    if (tagInput && !newTags.includes(tagInput)) {
      setNewTags([...newTags, tagInput]);
      setTagInput("");
    }
  };

  return (
    <section className="py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-[#030308]" />
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-transparent to-teal-900/10" />
      
      <div className="max-w-5xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded-full bg-purple-500/10 border border-purple-500/20">
            <ShieldIcon />
            <span className="text-sm font-medium text-purple-300">Memory Dashboard</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Manage Your <span className="bg-gradient-to-r from-teal-400 to-purple-400 bg-clip-text text-transparent">Private Memories</span>
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Create, view, and query your encrypted memories with ZK-powered privacy
          </p>
        </motion.div>

        {/* User ID input */}
        <div className="flex justify-center gap-4 mb-8">
          <div className="flex items-center gap-2 px-4 py-2 bg-black/40 rounded-xl border border-white/10">
            <span className="text-zinc-500 text-sm">User ID:</span>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="bg-transparent text-white text-sm outline-none w-32"
              placeholder="demo-user"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-8">
          {[
            { id: "list", label: "Memory List", icon: "📋" },
            { id: "create", label: "Create Memory", icon: "➕" },
            { id: "agent", label: "Agent Query", icon: "🤖" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                  : "text-zinc-500 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-zinc-900/80 rounded-2xl border border-white/10 p-6">
          <AnimatePresence mode="wait">
            {/* Memory List Tab */}
            {activeTab === "list" && (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-white">Your Memories</h3>
                  <button
                    onClick={fetchMemories}
                    className="text-sm text-teal-400 hover:text-teal-300"
                  >
                    ↻ Refresh
                  </button>
                </div>
                
                {loading ? (
                  <div className="text-center py-12 text-zinc-500">Loading...</div>
                ) : memories.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500">
                    <p>No memories yet</p>
                    <button
                      onClick={() => setActiveTab("create")}
                      className="mt-4 text-teal-400 hover:text-teal-300 text-sm"
                    >
                      Create your first memory →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {memories.map((memory) => (
                      <div
                        key={memory.id}
                        className="p-4 rounded-xl bg-black/40 border border-white/5 hover:border-teal-500/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <code className="text-xs text-zinc-400 truncate">{memory.id}</code>
                              <StatusBadge status={memory.status} />
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {(memory.tags || []).map((tag, i) => (
                                <Tag key={i} tag={tag} />
                              ))}
                              {(!memory.tags || memory.tags.length === 0) && (
                                <span className="text-xs text-zinc-600">No tags</span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500">
                              Created: {new Date(memory.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedMemory(memory.id);
                              setActiveTab("agent");
                            }}
                            className="px-3 py-1.5 text-xs bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors"
                          >
                            Query
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Create Memory Tab */}
            {activeTab === "create" && (
              <motion.div
                key="create"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <h3 className="text-lg font-semibold text-white mb-6">Create New Memory</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Memory Content / Commitment</label>
                    <input
                      type="text"
                      value={newCommitment}
                      onChange={(e) => setNewCommitment(e.target.value)}
                      placeholder="Enter text or hex commitment..."
                      className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white placeholder-zinc-600 focus:border-teal-500/50 outline-none"
                    />
                    <p className="text-xs text-zinc-600 mt-1">Will be converted to a hex commitment</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Tags</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && addTag()}
                        placeholder="Add tag..."
                        className="flex-1 px-4 py-2 rounded-xl bg-black/50 border border-white/10 text-white placeholder-zinc-600 focus:border-teal-500/50 outline-none"
                      />
                      <button
                        onClick={addTag}
                        className="px-4 py-2 bg-teal-500/20 text-teal-300 rounded-xl hover:bg-teal-500/30"
                      >
                        <PlusIcon />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {newTags.map((tag, i) => (
                        <Tag key={i} tag={tag} onRemove={() => setNewTags(newTags.filter((_, j) => j !== i))} />
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      {["finance", "health", "personal", "work"].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => !newTags.includes(preset) && setNewTags([...newTags, preset])}
                          className="text-xs px-2 py-1 bg-white/5 text-zinc-400 rounded hover:bg-white/10"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    onClick={createMemory}
                    disabled={!newCommitment}
                    className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-teal-400 hover:to-cyan-400 transition-all"
                  >
                    Create Memory
                  </button>
                </div>
              </motion.div>
            )}

            {/* Agent Query Tab */}
            {activeTab === "agent" && (
              <motion.div
                key="agent"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <h3 className="text-lg font-semibold text-white mb-6">Agent Query Debug</h3>
                
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Query Form */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">Select Memory</label>
                      <select
                        value={selectedMemory}
                        onChange={(e) => setSelectedMemory(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white focus:border-teal-500/50 outline-none"
                      >
                        <option value="">Choose a memory...</option>
                        {memories.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id} ({m.status})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">Access Pattern</label>
                      <div className="space-y-2">
                        {[
                          { key: "isFinance", label: "Finance" },
                          { key: "isHealth", label: "Health" },
                          { key: "isPersonal", label: "Personal" },
                        ].map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={pattern[key as keyof typeof pattern]}
                              onChange={(e) => setPattern({ ...pattern, [key]: e.target.checked })}
                              className="w-4 h-4 rounded accent-teal-500"
                            />
                            <span className="text-white">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <button
                      onClick={runAgentQuery}
                      disabled={!selectedMemory || queryLoading}
                      className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-400 hover:to-pink-400 transition-all"
                    >
                      {queryLoading ? "Running..." : "Run Agent Query"}
                    </button>
                  </div>

                  {/* Results */}
                  <div className="p-4 rounded-xl bg-black/40 border border-white/10">
                    <h4 className="text-sm font-medium text-zinc-400 mb-4">Agent Context Result</h4>
                    
                    {agentResult ? (
                      <div className="space-y-4">
                        {/* Can Use Memory */}
                        <div className={`p-3 rounded-lg ${agentResult.agentContext.canUseMemory ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{agentResult.agentContext.canUseMemory ? "✅" : "❌"}</span>
                            <span className={agentResult.agentContext.canUseMemory ? "text-green-300" : "text-red-300"}>
                              {agentResult.agentContext.canUseMemory ? "Agent CAN use memory" : "Agent BLOCKED"}
                            </span>
                          </div>
                          {agentResult.agentContext.redactionReason && (
                            <p className="text-xs text-red-400">{agentResult.agentContext.redactionReason}</p>
                          )}
                        </div>
                        
                        {/* Safe Summary */}
                        {agentResult.agentContext.safeSummary && (
                          <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
                            <p className="text-xs text-zinc-400 mb-1">Safe Summary (what agent receives)</p>
                            <p className="text-sm text-teal-200">{agentResult.agentContext.safeSummary}</p>
                          </div>
                        )}
                        
                        {/* Policy */}
                        <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                          <p className="text-xs text-zinc-400 mb-1">Policy Applied</p>
                          <p className="text-purple-300 font-mono text-sm">{agentResult.agentContext.policyApplied}</p>
                        </div>
                        
                        {/* Proof Summary */}
                        <div className="p-3 rounded-lg bg-zinc-800 border border-zinc-700">
                          <p className="text-xs text-zinc-400 mb-2">Proof Summary</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-zinc-500">Confidence:</span>
                              <span className="ml-2 text-white">{Math.round(agentResult.proofSummary.confidence)}%</span>
                            </div>
                            <div>
                              <span className="text-zinc-500">Real Proof:</span>
                              <span className="ml-2 text-white">{agentResult.proofSummary.isRealProof ? "Yes" : "Simulated"}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-zinc-500">Hash:</span>
                              <code className="ml-2 text-teal-400 text-[10px]">{agentResult.proofSummary.proofHash?.slice(0, 24)}...</code>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-zinc-600 py-8">
                        Run a query to see results
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
