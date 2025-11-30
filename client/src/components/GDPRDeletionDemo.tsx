import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

/**
 * GDPR Deletion Proof Demo
 * 
 * Interactive demo showing ZK-proven GDPR-compliant data deletion
 */

interface DeletionStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: "pending" | "active" | "complete";
}

interface DeletionProofResult {
  proofHash: string;
  deletionCommitment: string;
  timestamp: number;
  gdprCompliant: boolean;
}

export default function GDPRDeletionDemo() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [proofResult, setProofResult] = useState<DeletionProofResult | null>(null);
  const [selectedData, setSelectedData] = useState<string | null>(null);

  const mockDataItems = [
    { id: "mem_001", type: "Personal Memory", preview: "My therapy session notes...", risk: "high" },
    { id: "mem_002", type: "Health Data", preview: "Blood pressure readings...", risk: "high" },
    { id: "mem_003", type: "Financial Info", preview: "Monthly budget tracking...", risk: "medium" },
    { id: "mem_004", type: "General Note", preview: "Recipe for pasta...", risk: "low" }
  ];

  const deletionSteps: DeletionStep[] = [
    {
      id: "request",
      title: "Deletion Request",
      description: "User initiates GDPR Article 17 request",
      icon: "📝",
      status: currentStep > 0 ? "complete" : currentStep === 0 ? "active" : "pending"
    },
    {
      id: "auth",
      title: "Authorization",
      description: "Verify user owns the data",
      icon: "🔐",
      status: currentStep > 1 ? "complete" : currentStep === 1 ? "active" : "pending"
    },
    {
      id: "delete",
      title: "Secure Deletion",
      description: "Data cryptographically erased",
      icon: "🗑️",
      status: currentStep > 2 ? "complete" : currentStep === 2 ? "active" : "pending"
    },
    {
      id: "proof",
      title: "ZK Proof Generation",
      description: "Create verifiable deletion proof",
      icon: "🧮",
      status: currentStep > 3 ? "complete" : currentStep === 3 ? "active" : "pending"
    },
    {
      id: "anchor",
      title: "Blockchain Anchor",
      description: "Proof hash anchored on-chain",
      icon: "⛓️",
      status: currentStep > 4 ? "complete" : currentStep === 4 ? "active" : "pending"
    }
  ];

  const simulateDeletion = async () => {
    if (!selectedData) return;
    
    setIsDeleting(true);
    setCurrentStep(0);
    setProofResult(null);

    // Simulate each step
    for (let i = 0; i <= 4; i++) {
      setCurrentStep(i);
      await new Promise(r => setTimeout(r, 800));
    }

    // Generate mock proof result
    const timestamp = Date.now();
    setProofResult({
      proofHash: `gdpr_del_${timestamp.toString(16).slice(-8)}`,
      deletionCommitment: `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      timestamp,
      gdprCompliant: true
    });

    setCurrentStep(5);
    setIsDeleting(false);
  };

  const resetDemo = () => {
    setCurrentStep(0);
    setProofResult(null);
    setSelectedData(null);
    setIsDeleting(false);
  };

  return (
    <div className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-red-400 to-pink-500 bg-clip-text text-transparent">
              GDPR Deletion Proof
            </span>
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Prove data was deleted without revealing what was deleted. 
            ZK proofs ensure compliance while maintaining privacy.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Data Selection */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-red-400">📋</span> Select Data to Delete
            </h3>

            <div className="space-y-3">
              {mockDataItems.map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => !isDeleting && setSelectedData(item.id)}
                  disabled={isDeleting || proofResult !== null}
                  whileHover={{ scale: isDeleting ? 1 : 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    selectedData === item.id
                      ? "bg-red-500/20 border-red-500/50"
                      : "bg-zinc-800/50 border-zinc-700 hover:border-zinc-600"
                  } ${isDeleting || proofResult ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">{item.type}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      item.risk === "high" ? "bg-red-500/20 text-red-400" :
                      item.risk === "medium" ? "bg-amber-500/20 text-amber-400" :
                      "bg-green-500/20 text-green-400"
                    }`}>
                      {item.risk} sensitivity
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 truncate">{item.preview}</p>
                  <div className="text-xs text-zinc-600 mt-1">ID: {item.id}</div>
                </motion.button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={simulateDeletion}
                disabled={!selectedData || isDeleting || proofResult !== null}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                  selectedData && !isDeleting && !proofResult
                    ? "bg-gradient-to-r from-red-500 to-pink-500 text-white hover:opacity-90"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                }`}
              >
                {isDeleting ? "Deleting..." : "Delete with ZK Proof"}
              </button>
              {proofResult && (
                <button
                  onClick={resetDemo}
                  className="px-4 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </motion.div>

          {/* Deletion Process */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-purple-400">🔄</span> Deletion Process
            </h3>

            <div className="space-y-4">
              {deletionSteps.map((step, idx) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0.5 }}
                  animate={{
                    opacity: step.status === "pending" ? 0.5 : 1,
                    scale: step.status === "active" ? 1.02 : 1
                  }}
                  className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                    step.status === "active" ? "bg-purple-500/20 border border-purple-500/30" :
                    step.status === "complete" ? "bg-green-500/10" : "bg-zinc-800/30"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                    step.status === "complete" ? "bg-green-500/20" :
                    step.status === "active" ? "bg-purple-500/20 animate-pulse" : "bg-zinc-800"
                  }`}>
                    {step.status === "complete" ? "✅" : step.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white">{step.title}</div>
                    <div className="text-xs text-zinc-500">{step.description}</div>
                  </div>
                  <div className="text-xs text-zinc-600">
                    {idx + 1}/5
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Proof Result */}
            <AnimatePresence>
              {proofResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <div className="font-semibold text-green-400">Deletion Verified</div>
                      <div className="text-xs text-zinc-500">GDPR Article 17 Compliant</div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Proof Hash</span>
                      <code className="text-teal-400 text-xs">{proofResult.proofHash}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Commitment</span>
                      <code className="text-purple-400 text-xs truncate max-w-[200px]">
                        {proofResult.deletionCommitment.slice(0, 20)}...
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Timestamp</span>
                      <span className="text-zinc-400">
                        {new Date(proofResult.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded bg-zinc-900/50 text-xs text-zinc-400">
                    <strong className="text-white">What this proves:</strong>
                    <ul className="mt-1 space-y-1">
                      <li>✓ Data existed and was owned by requester</li>
                      <li>✓ Deletion was authorized</li>
                      <li>✓ Data is now cryptographically unrecoverable</li>
                      <li>✓ Audit trail maintained without exposing data</li>
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* GDPR Compliance Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/20"
        >
          <h3 className="text-lg font-semibold text-white mb-4">
            🏛️ GDPR Article 17 - Right to Erasure
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium text-red-400 mb-1">Right to be Forgotten</div>
              <p className="text-zinc-500">
                Users can request deletion of their personal data
              </p>
            </div>
            <div>
              <div className="font-medium text-pink-400 mb-1">Verifiable Compliance</div>
              <p className="text-zinc-500">
                ZK proofs provide cryptographic evidence of deletion
              </p>
            </div>
            <div>
              <div className="font-medium text-purple-400 mb-1">Privacy Preserved</div>
              <p className="text-zinc-500">
                Prove deletion without revealing what was deleted
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
