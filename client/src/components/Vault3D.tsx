import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { api } from "../lib/api";

// Anchor types and status
type AnchorType = 'sqlite' | 'ipfs' | 'midnight' | 'cardano';

interface AnchorLog {
  id: string;
  proofHash: string;
  anchorType: AnchorType;
  simulatedBlock?: number;
  simulatedTx?: string;
  ipfsCid?: string;
  gatewayUrl?: string;
  createdAt: string;
}

// Lock SVG Icon
const LockIcon = () => (
  <svg className="w-16 h-16 md:w-20 md:h-20 text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="16" r="1" fill="currentColor"/>
  </svg>
);

// IPFS Icon
const IpfsIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0L1.608 6v12L12 24l10.392-6V6L12 0zm-1.073 1.445h.001a1.8 1.8 0 0 0 2.138 0l7.534 4.35a1.8 1.8 0 0 0 0 .403l-7.535 4.35a1.8 1.8 0 0 0-2.137 0l-7.535-4.35a1.8 1.8 0 0 0 0-.402l7.534-4.351zM21.324 7.4v8.7a1.8 1.8 0 0 0-1.069 1.852l-7.534 4.35a1.8 1.8 0 0 0-1.069-.597V12.99a1.8 1.8 0 0 0 1.07-1.852l7.533-4.35a1.8 1.8 0 0 0 1.069.612zm-18.648.012a1.8 1.8 0 0 0 1.07-.614l7.533 4.351a1.8 1.8 0 0 0 1.07 1.852v8.714a1.8 1.8 0 0 0-1.07.598l-7.534-4.351a1.8 1.8 0 0 0-1.069-1.852V7.412z"/>
  </svg>
);

// Database Icon
const DatabaseIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
  </svg>
);

export default function Vault3D() {
  const [latestAnchor, setLatestAnchor] = useState<AnchorLog | null>(null);
  const [anchorStats, setAnchorStats] = useState<{ total: number; byType: Record<string, number> } | null>(null);

  useEffect(() => {
    // Fetch latest anchor on mount
    async function fetchLatestAnchor() {
      try {
        const response = await fetch('/api/anchor/logs?limit=1');
        if (response.ok) {
          const data = await response.json();
          if (data.logs?.length > 0) {
            setLatestAnchor(data.logs[0]);
          }
          if (data.stats) {
            setAnchorStats(data.stats);
          }
        }
      } catch (err) {
        // Use demo data if API unavailable
        setLatestAnchor({
          id: 'demo_anchor',
          proofHash: 'zk_9ab3c4d5e6f7g8h9',
          anchorType: 'sqlite',
          simulatedBlock: 847231,
          simulatedTx: 'anchor_demo123abc',
          createdAt: new Date().toISOString()
        });
      }
    }
    fetchLatestAnchor();
  }, []);

  const getAnchorBadge = () => {
    if (!latestAnchor) return null;
    
    const isIpfs = latestAnchor.anchorType === 'ipfs' || latestAnchor.ipfsCid;
    
    if (isIpfs && latestAnchor.ipfsCid) {
      return (
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/20">
          <IpfsIcon />
          <span className="text-xs text-cyan-400">IPFS Pinned</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
        <DatabaseIcon />
        <span className="text-xs text-emerald-400">Locally Anchored</span>
      </div>
    );
  };

  const getAnchorDisplay = () => {
    if (!latestAnchor) {
      return <code className="text-teal-400 font-mono text-lg">Loading...</code>;
    }
    
    if (latestAnchor.ipfsCid) {
      const shortCid = `${latestAnchor.ipfsCid.slice(0, 12)}...${latestAnchor.ipfsCid.slice(-8)}`;
      return (
        <a 
          href={latestAnchor.gatewayUrl || `https://ipfs.io/ipfs/${latestAnchor.ipfsCid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 font-mono text-lg hover:text-cyan-300 underline decoration-dotted"
        >
          {shortCid}
        </a>
      );
    }
    
    const shortTx = latestAnchor.simulatedTx 
      ? `${latestAnchor.simulatedTx.slice(0, 12)}...${latestAnchor.simulatedTx.slice(-6)}`
      : 'anchor_pending';
      
    return <code className="text-teal-400 font-mono text-lg">{shortTx}</code>;
  };

  return (
    <section className="relative overflow-hidden py-20" id="vault">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/5 to-transparent" />

      <div className="px-6 max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-16 relative z-10">
        {/* Left side: Text content */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="flex-1"
        >
          <p className="text-purple-400 text-sm font-medium tracking-wider uppercase mb-4">
            Persistent Storage
          </p>
          
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Your Encrypted Vault
          </h2>
          
          <p className="text-lg text-gray-400 leading-relaxed mb-8">
            Visualize your memories — locked, hashed, and anchored with 
            cryptographic guarantees.
          </p>

          {/* Transaction info */}
          <div className="p-5 rounded-xl bg-slate-800/50 border border-white/5 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
              Latest anchor {latestAnchor?.ipfsCid ? '(IPFS)' : '(Local DB)'}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {getAnchorDisplay()}
              {getAnchorBadge()}
            </div>
            {latestAnchor?.simulatedBlock && (
              <p className="text-xs text-gray-600 mt-2">
                Block #{latestAnchor.simulatedBlock.toLocaleString()}
              </p>
            )}
          </div>

          <p className="text-sm text-gray-500 mb-8">
            {latestAnchor?.ipfsCid 
              ? 'Content-addressed storage on IPFS. Simulated chain anchoring.'
              : 'Persisted in local SQLite. Simulated Midnight + Cardano anchoring.'}
          </p>

          {anchorStats && anchorStats.total > 0 && (
            <p className="text-xs text-gray-600 mb-4">
              📊 {anchorStats.total} total anchors
              {anchorStats.byType.sqlite && ` • ${anchorStats.byType.sqlite} local`}
              {anchorStats.byType.ipfs && ` • ${anchorStats.byType.ipfs} IPFS`}
            </p>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => document.getElementById('integrations')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 font-semibold rounded-lg transition-shadow hover:shadow-lg hover:shadow-teal-500/20"
          >
            Anchor New Memory
            <span className="ml-2">→</span>
          </motion.button>
        </motion.div>

        {/* Right side: Vault visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="relative flex-shrink-0"
        >
          {/* Outer glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-purple-500/10 rounded-full blur-3xl scale-125" />

          {/* Main vault container */}
          <div className="relative w-72 h-72 md:w-80 md:h-80">
            {/* Rotating rings */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border border-teal-500/20"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
              className="absolute inset-4 rounded-full border border-purple-500/15"
            />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
              className="absolute inset-8 rounded-full border border-cyan-500/10"
            />

            {/* Center vault door */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 0 0 rgba(45, 212, 191, 0)",
                    "0 0 40px 10px rgba(45, 212, 191, 0.15)",
                    "0 0 0 0 rgba(45, 212, 191, 0)",
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-teal-500/30 flex items-center justify-center"
              >
                <LockIcon />
              </motion.div>
            </div>

            {/* Orbiting dots */}
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <motion.div
                key={i}
                animate={{ rotate: 360 }}
                transition={{ duration: 20 + i * 5, repeat: Infinity, ease: "linear" }}
                style={{ transform: `rotate(${angle}deg)` }}
                className="absolute inset-0"
              >
                <div 
                  className="absolute w-2 h-2 rounded-full bg-teal-400/60"
                  style={{ top: '5%', left: '50%', transform: 'translateX(-50%)' }}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
