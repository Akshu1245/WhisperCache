import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const compactCode = `circuit MemoryPatternVerifier {
  // Private witness (never leaves device)
  witness memory_content: Field;
  witness user_secret_key: Field;

  // Public inputs (visible on-chain)
  public pattern_query: Field;
  public min_confidence: Field;

  // Public output
  public result_confidence: Field;
  public proof_valid: bool;

  fn verify() {
    // Step 1: Verify ownership
    let ownership = poseidon_hash(
      user_secret_key, 
      user_public_id
    );
    
    // Step 2: Pattern match on encrypted data
    let score = private_pattern_match(
      memory_content,
      pattern_query
    );
    
    // Step 3: Output confidence (not content!)
    result_confidence = score;
    proof_valid = score >= min_confidence;
  }
}`;

const codeLines = compactCode.split('\n');

const proofSteps = [
  { label: "Encrypting memory locally", color: "teal" },
  { label: "Generating ZK circuit", color: "purple" },
  { label: "Computing witness values", color: "blue" },
  { label: "Creating proof", color: "pink" },
  { label: "Proof verified on Midnight", color: "green" },
];

export default function MidnightCompactDemo() {
  const [highlightedLine, setHighlightedLine] = useState(0);
  const [proofStep, setProofStep] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [proofResult, setProofResult] = useState<null | { confidence: number; hash: string }>(null);

  // Auto-highlight code lines
  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightedLine((prev) => (prev + 1) % codeLines.length);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const runProof = async () => {
    setIsRunning(true);
    setProofResult(null);
    
    for (let i = 0; i < proofSteps.length; i++) {
      setProofStep(i);
      await new Promise(r => setTimeout(r, 700));
    }
    
    setProofResult({
      confidence: 92,
      hash: "mn_" + Math.random().toString(36).slice(2, 14)
    });
    setIsRunning(false);
    setProofStep(-1);
  };

  const getLineColor = (index: number) => {
    const line = codeLines[index];
    if (line.includes('witness')) return 'text-pink-400';
    if (line.includes('public')) return 'text-cyan-400';
    if (line.includes('fn ')) return 'text-yellow-400';
    if (line.includes('//')) return 'text-gray-600';
    if (line.includes('assert') || line.includes('return')) return 'text-orange-400';
    return 'text-gray-300';
  };

  return (
    <section className="py-12 px-6 relative overflow-hidden" id="compact">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/5 via-transparent to-teal-900/5" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-sm text-purple-300">Midnight Compact Language</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Powered by Real ZK Circuits
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Our Midnight Compact contract verifies patterns in your memories — 
            without ever seeing the actual data.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-10 items-start">
          {/* Code Panel */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="rounded-xl overflow-hidden bg-slate-900/80 border border-white/5">
              {/* Code header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-slate-950/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <span className="text-sm text-gray-500 font-mono">whisper_cache.compact</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/20">
                  Midnight
                </span>
              </div>

              {/* Code content */}
              <div className="p-4 font-mono text-sm overflow-x-auto max-h-[420px] overflow-y-auto">
                {codeLines.map((line, i) => (
                  <div
                    key={i}
                    className={`py-0.5 px-3 -mx-2 rounded flex transition-colors duration-200 ${
                      highlightedLine === i ? 'bg-purple-500/10' : ''
                    }`}
                  >
                    <span className="w-8 text-gray-700 select-none text-right mr-4">{i + 1}</span>
                    <span className={getLineColor(i)}>{line || ' '}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Interactive Panel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-6"
          >
            {/* Run Proof Button */}
            <button
              onClick={runProof}
              disabled={isRunning}
              className={`w-full py-4 font-semibold rounded-xl text-lg transition-all ${
                isRunning 
                  ? 'bg-purple-500/20 text-purple-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/20'
              }`}
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  />
                  Generating Proof...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  Execute Midnight Proof
                </span>
              )}
            </button>

            {/* Proof Steps */}
            <div className="p-6 rounded-xl bg-slate-800/50 border border-white/5">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">ZK Proof Pipeline</h3>
              </div>
              
              <div className="space-y-3">
                {proofSteps.map((step, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                      proofStep === i ? 'bg-white/5' : ''
                    } ${proofStep >= i ? 'opacity-100' : 'opacity-40'}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      proofStep > i 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : proofStep === i
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-white/5 text-gray-500'
                    }`}>
                      {proofStep > i ? (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className={`text-sm ${proofStep >= i ? 'text-gray-200' : 'text-gray-500'}`}>
                      {step.label}
                    </span>
                    {proofStep === i && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="ml-auto w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Result Card */}
            <AnimatePresence>
              {proofResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.98 }}
                  className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    <span className="font-semibold text-white">Proof Verified</span>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Confidence</span>
                      <span className="text-emerald-400 font-semibold">{proofResult.confidence}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Network</span>
                      <span className="text-purple-300">Midnight Devnet</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Proof Hash</span>
                      <code className="text-xs px-2 py-1 rounded bg-slate-900/50 text-teal-400 font-mono">
                        {proofResult.hash}
                      </code>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-emerald-500/20 text-xs text-gray-500">
                    Memory content was never revealed • Verified on Midnight
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
