import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const scenarios = [
  {
    query: "Am I at risk for anxiety?",
    rawData: "User said: 'I had 3 panic attacks this month, usually before meetings with my boss.'",
    zkResponse: "Pattern: Elevated stress indicators (89% confidence)",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    )
  },
  {
    query: "What's my spending habit?",
    rawData: "User transactions: $450 Uber Eats, $200 DoorDash, $340 Amazon in 2 weeks",
    zkResponse: "Pattern: Above-average discretionary spending (76% confidence)",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    query: "Any relationship concerns?",
    rawData: "User said: 'My partner and I haven't talked in 3 days. I think they're losing interest.'",
    zkResponse: "Pattern: Interpersonal stress signals (82% confidence)",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
      </svg>
    )
  }
];

export default function PrivacyInAction() {
  const [activeMode, setActiveMode] = useState<"traditional" | "zk">("traditional");
  const [activeScenario, setActiveScenario] = useState(0);
  
  const scenario = scenarios[activeScenario];

  return (
    <section className="section relative">
      <div className="container-lg">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="badge mb-4" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.2)', color: '#86efac' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Interactive Demo
          </span>
          <h2 className="text-headline text-white mb-4">
            Privacy <span className="gradient-text">in Action</span>
          </h2>
          <p className="text-body-lg max-w-xl mx-auto">
            See exactly what AI receives with traditional memory vs. ZK protection.
          </p>
        </motion.div>

        {/* Mode toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1 rounded-xl bg-black/40 border border-white/[0.06]">
            <button
              onClick={() => setActiveMode("traditional")}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeMode === "traditional"
                  ? "bg-red-500/20 text-red-300 border border-red-500/20"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Traditional AI
            </button>
            <button
              onClick={() => setActiveMode("zk")}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeMode === "zk"
                  ? "bg-teal-500/20 text-teal-300 border border-teal-500/20"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              WhisperCache
            </button>
          </div>
        </div>

        {/* Demo container */}
        <div className="max-w-3xl mx-auto">
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-white/[0.06] backdrop-blur-sm">
            {/* Scenario tabs */}
            <div className="flex gap-2 mb-6 pb-6 border-b border-white/[0.06]">
              {scenarios.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveScenario(i)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                    activeScenario === i
                      ? "bg-white/[0.06] text-white border border-white/[0.1]"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                  }`}
                >
                  <span className={activeScenario === i ? "text-teal-400" : "text-zinc-500"}>{s.icon}</span>
                  <span className="hidden sm:inline">{s.query.split(' ').slice(0, 3).join(' ')}...</span>
                </button>
              ))}
            </div>

            {/* Query */}
            <div className="mb-6">
              <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">User Query</p>
              <p className="text-lg text-white font-medium">"{scenario.query}"</p>
            </div>

            {/* Response */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeMode}-${activeScenario}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">What AI Receives</p>
                
                {activeMode === "traditional" ? (
                  <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                    <p className="text-sm text-red-200/80 font-mono leading-relaxed">
                      {scenario.rawData}
                    </p>
                    <div className="mt-4 pt-4 border-t border-red-500/10 flex flex-wrap gap-2">
                      {["Personal data exposed", "Stored on servers", "Can be leaked"].map((risk, i) => (
                        <span key={i} className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                          ✕ {risk}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/10">
                    <p className="text-sm text-teal-200/80 font-mono leading-relaxed">
                      {scenario.zkResponse}
                    </p>
                    <div className="mt-4 pt-4 border-t border-teal-500/10 flex flex-wrap gap-2">
                      {["Zero data exposed", "Encrypted locally", "Verified on-chain"].map((benefit, i) => (
                        <span key={i} className="text-[10px] px-2 py-1 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                          ✓ {benefit}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
