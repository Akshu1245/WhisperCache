import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

/**
 * Simulation Fallback Indicator
 * 
 * Clearly shows when the system is using simulation mode vs real blockchain.
 * Provides transparency about the current operational state.
 */

export type ConnectionMode = "real" | "simulated" | "hybrid";

export interface NetworkStatus {
  network: string;
  mode: ConnectionMode;
  reason?: string;
  lastCheck: Date;
  latency?: number;
}

interface SimulationIndicatorProps {
  status: NetworkStatus;
  showDetails?: boolean;
  compact?: boolean;
}

const modeConfig = {
  real: {
    color: "from-green-500 to-emerald-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    textColor: "text-green-400",
    icon: "🟢",
    label: "Live Network",
    description: "Connected to real blockchain network"
  },
  simulated: {
    color: "from-amber-500 to-orange-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    textColor: "text-amber-400",
    icon: "🟡",
    label: "Simulation Mode",
    description: "Using simulated responses for development"
  },
  hybrid: {
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    textColor: "text-blue-400",
    icon: "🔵",
    label: "Hybrid Mode",
    description: "Some features simulated, others live"
  }
};

export function SimulationIndicator({ status, showDetails = true, compact = false }: SimulationIndicatorProps) {
  const [expanded, setExpanded] = useState(false);
  const config = modeConfig[status.mode];

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${config.bgColor} ${config.borderColor} border`}
      >
        <span className="text-xs">{config.icon}</span>
        <span className={`text-xs font-medium ${config.textColor}`}>
          {status.mode === "real" ? "Live" : "Sim"}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl ${config.bgColor} ${config.borderColor} border overflow-hidden`}
    >
      {/* Header */}
      <button
        onClick={() => showDetails && setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center text-white text-sm`}>
            {config.icon}
          </div>
          <div className="text-left">
            <div className={`font-medium ${config.textColor}`}>{config.label}</div>
            <div className="text-xs text-zinc-500">{status.network}</div>
          </div>
        </div>
        {showDetails && (
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            className="text-zinc-500"
          >
            ▼
          </motion.div>
        )}
      </button>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5"
          >
            <div className="p-4 space-y-3">
              <p className="text-sm text-zinc-400">{config.description}</p>
              
              {status.reason && (
                <div className="p-2 rounded bg-zinc-800/50 text-xs text-zinc-500">
                  <span className="font-medium">Reason: </span>
                  {status.reason}
                </div>
              )}

              {status.latency && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Latency</span>
                  <span className={config.textColor}>{status.latency}ms</span>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Last Check</span>
                <span className="text-zinc-400">
                  {new Date(status.lastCheck).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Full Simulation Status Panel
 * Shows status for all connected services
 */
interface SimulationStatusPanelProps {
  services: {
    name: string;
    status: NetworkStatus;
  }[];
}

export function SimulationStatusPanel({ services }: SimulationStatusPanelProps) {
  const allReal = services.every(s => s.status.mode === "real");
  const allSimulated = services.every(s => s.status.mode === "simulated");

  return (
    <div className="space-y-4">
      {/* Overall Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-xl border ${
          allReal
            ? "bg-green-500/10 border-green-500/30"
            : allSimulated
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-blue-500/10 border-blue-500/30"
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">
            {allReal ? "🟢" : allSimulated ? "🟡" : "🔵"}
          </span>
          <div>
            <h3 className={`font-semibold ${
              allReal ? "text-green-400" : allSimulated ? "text-amber-400" : "text-blue-400"
            }`}>
              {allReal
                ? "All Systems Live"
                : allSimulated
                ? "Development Mode"
                : "Partial Simulation"}
            </h3>
            <p className="text-xs text-zinc-500">
              {allReal
                ? "Connected to real blockchain networks"
                : allSimulated
                ? "All connections simulated for development"
                : "Some services using simulation fallback"}
            </p>
          </div>
        </div>

        {/* Important Notice for Simulation */}
        {!allReal && (
          <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
            <div className="text-xs text-zinc-400">
              <strong className="text-white">⚠️ Simulation Notice:</strong> This demo uses simulated 
              blockchain responses. In production, WhisperCache connects to:
            </div>
            <ul className="mt-2 text-xs text-zinc-500 space-y-1">
              <li>• <span className="text-purple-400">Midnight Devnet</span> - Privacy-preserving smart contracts</li>
              <li>• <span className="text-blue-400">Cardano Preview</span> - Transaction anchoring</li>
              <li>• <span className="text-teal-400">Real ZK Circuits</span> - Groth16 proof generation</li>
            </ul>
          </div>
        )}
      </motion.div>

      {/* Individual Service Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {services.map((service, idx) => (
          <motion.div
            key={service.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <SimulationIndicator status={service.status} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Default export for convenience
export default SimulationIndicator;
