import { motion } from "framer-motion";
import { useState } from "react";

/**
 * Architecture Flow Slide
 * 
 * Visual end-to-end architecture diagram showing data flow through WhisperCache
 */

const architectureSteps = [
  {
    id: "user",
    title: "User Device",
    description: "Data encrypted locally with XChaCha20-Poly1305",
    icon: "👤",
    color: "from-blue-500 to-cyan-500",
    details: [
      "Memory stored locally",
      "Private key never leaves device",
      "End-to-end encryption"
    ]
  },
  {
    id: "zk",
    title: "ZK Proof Generation",
    description: "Groth16 proofs generated without revealing data",
    icon: "🔐",
    color: "from-teal-500 to-emerald-500",
    details: [
      "Poseidon hash commitment",
      "Pattern matching in ZK",
      "Proof < 1KB size"
    ]
  },
  {
    id: "midnight",
    title: "Midnight Network",
    description: "Privacy-preserving smart contract verification",
    icon: "🌙",
    color: "from-purple-500 to-violet-500",
    details: [
      "Shield contract execution",
      "Private state transitions",
      "Shielded proof submission"
    ]
  },
  {
    id: "cardano",
    title: "Cardano L1",
    description: "Immutable anchoring for finality",
    icon: "⛓️",
    color: "from-indigo-500 to-blue-500",
    details: [
      "Transaction anchoring",
      "Proof hash on-chain",
      "Permanent audit trail"
    ]
  },
  {
    id: "ai",
    title: "AI Agent",
    description: "Receives only verified patterns, never raw data",
    icon: "🤖",
    color: "from-pink-500 to-rose-500",
    details: [
      "Pattern confidence scores",
      "ZK-verified results",
      "No memory access"
    ]
  }
];

const dataFlows = [
  { from: 0, to: 1, label: "Encrypted Memory", color: "#14b8a6" },
  { from: 1, to: 2, label: "ZK Proof", color: "#8b5cf6" },
  { from: 2, to: 3, label: "Anchor Hash", color: "#6366f1" },
  { from: 1, to: 4, label: "Pattern Only", color: "#ec4899" }
];

export default function ArchitectureFlowSlide() {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);

  return (
    <div className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-teal-400 to-purple-500 bg-clip-text text-transparent">
              End-to-End Architecture
            </span>
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Complete data flow from user device to AI agent, with zero-knowledge
            proofs ensuring privacy at every step.
          </p>
        </motion.div>

        {/* Architecture Diagram */}
        <div className="relative">
          {/* Connection Lines */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 0 }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#14b8a6" />
              </marker>
            </defs>
          </svg>

          {/* Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {architectureSteps.map((step, idx) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                onMouseEnter={() => setActiveStep(idx)}
                onMouseLeave={() => setActiveStep(null)}
                className="relative"
              >
                <div
                  className={`relative p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                    activeStep === idx
                      ? "bg-zinc-800/80 border-teal-500/50 scale-105"
                      : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-2xl mb-3 shadow-lg`}
                  >
                    {step.icon}
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-white mb-1">{step.title}</h3>

                  {/* Description */}
                  <p className="text-xs text-zinc-400 mb-3">{step.description}</p>

                  {/* Details - shown on hover */}
                  <motion.div
                    initial={false}
                    animate={{
                      height: activeStep === idx ? "auto" : 0,
                      opacity: activeStep === idx ? 1 : 0
                    }}
                    className="overflow-hidden"
                  >
                    <ul className="space-y-1 pt-2 border-t border-zinc-700">
                      {step.details.map((detail, i) => (
                        <li key={i} className="text-xs text-zinc-500 flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-teal-500" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </motion.div>

                  {/* Step Number */}
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-teal-400">
                    {idx + 1}
                  </div>
                </div>

                {/* Connector Arrow (except last) */}
                {idx < architectureSteps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <motion.div
                      animate={isAnimating ? {
                        x: [0, 5, 0],
                        opacity: [0.5, 1, 0.5]
                      } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-teal-500"
                    >
                      →
                    </motion.div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Data Flow Labels */}
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {dataFlows.map((flow, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 + idx * 0.1 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/50 border border-zinc-800"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: flow.color }}
                />
                <span className="text-xs text-zinc-400">
                  {architectureSteps[flow.from].title.split(" ")[0]} → {flow.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Key Points */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20">
            <div className="text-teal-400 text-lg font-semibold mb-2">🔒 Zero Data Exposure</div>
            <p className="text-sm text-zinc-400">
              Raw data never leaves the user's device. Only cryptographic proofs are transmitted.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <div className="text-purple-400 text-lg font-semibold mb-2">⚡ Instant Verification</div>
            <p className="text-sm text-zinc-400">
              ZK proofs verify in milliseconds, enabling real-time AI interactions.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <div className="text-blue-400 text-lg font-semibold mb-2">📜 Immutable Audit</div>
            <p className="text-sm text-zinc-400">
              Every proof is anchored on Cardano L1 for permanent, tamper-proof records.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
