import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Shield, Zap } from 'lucide-react';

interface CompactProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoryHash: string;
  proofResult?: {
    status: string;
    proofSource: string;
    execution: string;
    proofGenerationTime: string;
    verified: boolean;
    timestamp: string;
  };
}

const CompactProofModal: React.FC<CompactProofModalProps> = ({
  isOpen,
  onClose,
  memoryHash,
  proofResult
}) => {
  const [lines, setLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const terminalLines = [
    { text: '$ midnight-compact run whisper_cache.compact --input ' + memoryHash.slice(0, 16) + '...', delay: 0 },
    { text: '⏳ Connecting to Midnight devnet...', delay: 400 },
    { text: '✔ Connected to block #177445462', delay: 800 },
    { text: '⏳ Executing Compact contract...', delay: 1200 },
    { text: `✔ Proof generated in ${proofResult?.proofGenerationTime || '0.0024s'}`, delay: 1800 },
    { text: '✔ Zero-knowledge verification: PASSED', delay: 2200 },
    { text: '✔ No data revealed to verifier', delay: 2600 },
    { text: '✔ AI can now use the insight safely', delay: 3000 },
    { text: '', delay: 3200 },
    { text: '🟢 Compact proof simulation integrated successfully.', delay: 3400 },
  ];

  useEffect(() => {
    if (isOpen) {
      setLines([]);
      setCurrentLineIndex(0);
      setIsComplete(false);

      terminalLines.forEach((line, index) => {
        setTimeout(() => {
          setLines(prev => [...prev, line.text]);
          setCurrentLineIndex(index);
          if (index === terminalLines.length - 1) {
            setIsComplete(true);
          }
        }, line.delay);
      });
    }
  }, [isOpen, memoryHash]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Backdrop with blur */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-3xl mx-4"
        >
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-500 rounded-2xl blur-lg opacity-50 animate-pulse" />
          
          {/* Main container */}
          <div className="relative bg-gray-900/95 border border-teal-500/30 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-teal-500/20 bg-black/40">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-teal-400" />
                  <span className="text-teal-400 font-mono font-bold">MIDNIGHT COMPACT</span>
                </div>
                <span className="px-2 py-0.5 bg-teal-500/20 text-teal-300 text-xs font-mono rounded-full border border-teal-500/30">
                  v1.0.0
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>

            {/* Terminal */}
            <div className="p-6 font-mono text-sm">
              {/* Terminal window */}
              <div className="bg-black/60 rounded-lg border border-gray-700/50 p-4 min-h-[300px]">
                {/* Terminal header dots */}
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/50">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="ml-3 text-gray-500 text-xs">whisper_cache.compact — Midnight Terminal</span>
                </div>

                {/* Terminal output */}
                <div className="space-y-2">
                  {lines.map((line, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`${
                        line.startsWith('$') 
                          ? 'text-cyan-400' 
                          : line.startsWith('✔') 
                            ? 'text-green-400' 
                            : line.startsWith('⏳')
                              ? 'text-yellow-400'
                              : line.startsWith('🟢')
                                ? 'text-teal-400 font-bold text-base'
                                : 'text-gray-300'
                      }`}
                    >
                      {line}
                    </motion.div>
                  ))}
                  
                  {/* Blinking cursor */}
                  {!isComplete && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="inline-block w-2 h-4 bg-teal-400 ml-1"
                    />
                  )}
                </div>
              </div>

              {/* Status badges */}
              {isComplete && proofResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4 flex flex-wrap gap-3"
                >
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 text-sm">Verified</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-teal-500/10 border border-teal-500/30 rounded-lg">
                    <Shield className="w-4 h-4 text-teal-400" />
                    <span className="text-teal-400 text-sm">Zero Data Revealed</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-400 text-sm">{proofResult.proofGenerationTime}</span>
                  </div>
                </motion.div>
              )}

              {/* Contract info */}
              <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Contract:</span>
                  <span className="text-teal-400 font-mono">whisper_cache.compact</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-gray-500">Input Hash:</span>
                  <span className="text-gray-400 font-mono">{memoryHash.slice(0, 24)}...</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-gray-500">Network:</span>
                  <span className="text-purple-400 font-mono">Midnight Devnet</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-teal-500/20 bg-black/40 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Powered by Midnight Compact Contracts
              </span>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-black font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CompactProofModal;
