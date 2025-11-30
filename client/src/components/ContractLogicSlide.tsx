import { motion } from "framer-motion";
import { useState } from "react";

/**
 * Contract Logic Slide
 * 
 * Visual representation of smart contract flow and state transitions
 */

interface ContractState {
  id: string;
  name: string;
  description: string;
  fields: { name: string; type: string; privacy: "public" | "private" }[];
}

interface ContractTransition {
  from: string;
  to: string;
  action: string;
  zkRequired: boolean;
}

const contractStates: ContractState[] = [
  {
    id: "init",
    name: "Initialized",
    description: "Contract deployed with verification key",
    fields: [
      { name: "verificationKey", type: "bytes32", privacy: "public" },
      { name: "owner", type: "address", privacy: "public" },
      { name: "createdAt", type: "uint256", privacy: "public" }
    ]
  },
  {
    id: "registered",
    name: "Memory Registered",
    description: "Encrypted memory commitment stored",
    fields: [
      { name: "memoryCommitment", type: "bytes32", privacy: "public" },
      { name: "encryptedData", type: "bytes", privacy: "private" },
      { name: "policyFlags", type: "uint8", privacy: "private" }
    ]
  },
  {
    id: "queried",
    name: "Query Processed",
    description: "ZK proof verified, pattern returned",
    fields: [
      { name: "queryHash", type: "bytes32", privacy: "public" },
      { name: "patternResult", type: "uint8", privacy: "public" },
      { name: "confidence", type: "uint8", privacy: "public" }
    ]
  },
  {
    id: "anchored",
    name: "Anchored on L1",
    description: "Proof hash recorded on Cardano",
    fields: [
      { name: "anchorTxId", type: "bytes32", privacy: "public" },
      { name: "blockHeight", type: "uint256", privacy: "public" },
      { name: "proofHash", type: "bytes32", privacy: "public" }
    ]
  }
];

const transitions: ContractTransition[] = [
  { from: "init", to: "registered", action: "registerMemory()", zkRequired: false },
  { from: "registered", to: "queried", action: "queryWithProof()", zkRequired: true },
  { from: "queried", to: "anchored", action: "anchorToL1()", zkRequired: false },
  { from: "registered", to: "init", action: "deleteMemory()", zkRequired: true }
];

const shieldContractCode = `// Midnight Shield Contract (Compact)
contract MemoryShield {
  // Public state
  state verificationKey: VerifyingKey;
  state anchorRoot: Hash;
  
  // Private state (shielded)
  shielded memoryStore: Map<UserId, EncryptedMemory>;
  shielded accessPolicy: Map<UserId, PolicyFlags>;
  
  // Register encrypted memory
  @shielded
  transition registerMemory(
    commitment: Hash,
    encryptedData: Bytes,
    policy: PolicyFlags
  ) {
    require(verify_ownership());
    memoryStore[caller] = encryptedData;
    accessPolicy[caller] = policy;
    emit MemoryRegistered(commitment);
  }
  
  // Query with ZK proof
  @public
  transition queryWithProof(
    proof: Groth16Proof,
    queryHash: Hash
  ) -> PatternResult {
    require(verify_groth16(verificationKey, proof));
    let result = extract_pattern(proof.public_signals);
    emit QueryProcessed(queryHash, result.confidence);
    return result;
  }
  
  // Anchor to Cardano L1
  @public
  transition anchorToL1(proofHash: Hash) {
    anchorRoot = merkle_insert(anchorRoot, proofHash);
    emit Anchored(proofHash, block.height);
  }
}`;

export default function ContractLogicSlide() {
  const [activeState, setActiveState] = useState<string>("registered");
  const [showCode, setShowCode] = useState(false);

  const activeStateData = contractStates.find(s => s.id === activeState);

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
            <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              Smart Contract Logic
            </span>
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Midnight Shield Contract with private state transitions and ZK proof verification.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* State Machine Visualization */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-purple-400">⚙️</span> State Machine
            </h3>

            {/* State Boxes */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {contractStates.map((state) => (
                <motion.button
                  key={state.id}
                  onClick={() => setActiveState(state.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    activeState === state.id
                      ? "bg-purple-500/20 border-purple-500/50"
                      : "bg-zinc-800/50 border-zinc-700 hover:border-zinc-600"
                  }`}
                >
                  <div className="text-sm font-medium text-white">{state.name}</div>
                  <div className="text-xs text-zinc-400 mt-1">{state.description}</div>
                </motion.button>
              ))}
            </div>

            {/* Active State Details */}
            {activeStateData && (
              <motion.div
                key={activeState}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-800/50 rounded-lg p-4"
              >
                <div className="text-sm font-medium text-purple-400 mb-3">
                  State Fields:
                </div>
                <div className="space-y-2">
                  {activeStateData.fields.map((field, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <code className="text-teal-400">{field.name}</code>
                        <span className="text-zinc-500">: {field.type}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        field.privacy === "private"
                          ? "bg-pink-500/20 text-pink-400"
                          : "bg-zinc-700 text-zinc-400"
                      }`}>
                        {field.privacy}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Transitions */}
            <div className="mt-6">
              <div className="text-sm font-medium text-zinc-400 mb-3">Transitions:</div>
              <div className="space-y-2">
                {transitions.map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-xs p-2 rounded bg-zinc-800/30"
                  >
                    <span className="text-zinc-500">{t.from}</span>
                    <span className="text-teal-400">→</span>
                    <span className="text-zinc-500">{t.to}</span>
                    <code className="text-purple-400 ml-auto">{t.action}</code>
                    {t.zkRequired && (
                      <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 text-[10px]">
                        ZK
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Code View */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-3 text-sm text-zinc-400">MemoryShield.compact</span>
              </div>
              <button
                onClick={() => setShowCode(!showCode)}
                className="text-xs text-teal-400 hover:text-teal-300"
              >
                {showCode ? "Collapse" : "Expand"}
              </button>
            </div>
            
            <motion.pre
              animate={{ height: showCode ? "auto" : 300 }}
              className="p-4 text-xs overflow-auto font-mono"
              style={{ maxHeight: showCode ? "none" : 300 }}
            >
              <code className="text-zinc-300">
                {shieldContractCode.split("\n").map((line, i) => (
                  <div key={i} className="flex">
                    <span className="text-zinc-600 w-8 select-none">{i + 1}</span>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: line
                          .replace(/(contract|state|shielded|transition|require|emit|return|let)/g, '<span class="text-purple-400">$1</span>')
                          .replace(/(\/\/.*)/g, '<span class="text-zinc-600">$1</span>')
                          .replace(/(@\w+)/g, '<span class="text-teal-400">$1</span>')
                          .replace(/(Hash|Bytes|VerifyingKey|Map|PolicyFlags|Groth16Proof|PatternResult)/g, '<span class="text-pink-400">$1</span>')
                      }}
                    />
                  </div>
                ))}
              </code>
            </motion.pre>

            {!showCode && (
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none" />
            )}
          </motion.div>
        </div>

        {/* Key Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { icon: "🔒", label: "Shielded State", desc: "Private data in contract", gradient: "from-purple-500/20 to-indigo-500/20", glow: "purple" },
            { icon: "✅", label: "ZK Verification", desc: "On-chain proof checking", gradient: "from-teal-500/20 to-cyan-500/20", glow: "teal" },
            { icon: "📝", label: "Audit Events", desc: "Transparent operations", gradient: "from-amber-500/20 to-orange-500/20", glow: "amber" },
            { icon: "⛓️", label: "L1 Anchoring", desc: "Cardano finality", gradient: "from-blue-500/20 to-sky-500/20", glow: "blue" }
          ].map((feature, idx) => (
            <motion.div
              key={idx}
              className="group relative p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center cursor-pointer overflow-hidden"
              style={{ 
                perspective: "1000px",
                transformStyle: "preserve-3d"
              }}
              whileHover={{ 
                scale: 1.05,
                rotateX: -5,
                rotateY: 5,
                z: 50,
                transition: { duration: 0.3 }
              }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 30, rotateX: 15 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + idx * 0.1, duration: 0.5 }}
            >
              {/* Gradient background on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl`} />
              
              {/* Glow effect */}
              <div className={`absolute -inset-1 bg-${feature.glow}-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-300`} />
              
              {/* Shine effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </div>
              
              {/* Border glow */}
              <div className="absolute inset-0 rounded-2xl border border-white/0 group-hover:border-white/20 transition-colors duration-300" />
              
              {/* Content */}
              <div className="relative z-10">
                <motion.div 
                  className="text-3xl mb-3 inline-block"
                  whileHover={{ 
                    scale: 1.2, 
                    rotate: [0, -10, 10, 0],
                    transition: { duration: 0.4 }
                  }}
                >
                  {feature.icon}
                </motion.div>
                <div className="text-sm font-semibold text-white mb-1 group-hover:text-white transition-colors">{feature.label}</div>
                <div className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">{feature.desc}</div>
              </div>
              
              {/* 3D shadow */}
              <div className="absolute -bottom-2 left-2 right-2 h-4 bg-black/30 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" 
                style={{ transform: "translateZ(-20px)" }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
