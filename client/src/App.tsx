import { useState, useEffect, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import ErrorBoundary from "./components/ErrorBoundary";

// Lazy load heavy components for faster initial load
const ProblemSection = lazy(() => import("./components/ProblemSection"));
const SolutionSection = lazy(() => import("./components/SolutionSection"));
const ZKQuerySimulator = lazy(() => import("./components/ZKQuerySimulator"));
const MidnightCompactDemo = lazy(() => import("./components/MidnightCompactDemo"));
const CardanoMemeSection = lazy(() => import("./components/CardanoMemeSection"));
const NetworkStatusBar = lazy(() => import("./components/NetworkStatusBar"));
const FutureSection = lazy(() => import("./components/FutureSection"));
const MemoryDashboard = lazy(() => import("./components/MemoryDashboard"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard"));
const ArchitectureFlowSlide = lazy(() => import("./components/ArchitectureFlowSlide"));
const ContractLogicSlide = lazy(() => import("./components/ContractLogicSlide"));
const GDPRDeletionDemo = lazy(() => import("./components/GDPRDeletionDemo"));
const PrivacyInAction = lazy(() => import("./components/PrivacyInAction"));

// Lightweight loading skeleton
const SectionLoader = () => (
  <div className="py-20 flex items-center justify-center">
    <div className="flex items-center gap-3">
      <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
      <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse delay-75" />
      <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse delay-150" />
    </div>
  </div>
);

// Section Divider Component for clean separation
const SectionDivider = ({ label }: { label?: string }) => (
  <div className="relative py-4">
    <div className="max-w-5xl mx-auto px-6">
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        {label && (
          <span className="text-[11px] text-zinc-500 uppercase tracking-[0.2em] font-medium px-4 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.05]">{label}</span>
        )}
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </div>
    </div>
  </div>
);

function App() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#08080c] text-white overflow-x-hidden scroll-smooth">
      {/* Simple, Clean Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#08080c] via-[#0a0a12] to-[#08080c]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gradient-radial from-teal-500/[0.03] via-transparent to-transparent" />
        <div className="absolute bottom-0 left-1/4 w-[800px] h-[600px] bg-gradient-radial from-purple-500/[0.02] via-transparent to-transparent" />
      </div>

      {/* Navigation - Fixed at top */}
      <Navbar />
      
      {/* Network Status */}
      <Suspense fallback={null}>
        <NetworkStatusBar />
      </Suspense>

      {/* Main Content - Clean & Organized */}
      <ErrorBoundary>
        <main className="relative z-10">
        
        {/* ==================== HERO ==================== */}
        <Hero />
        
        <SectionDivider label="The Problem" />
        
        {/* ==================== PROBLEM ==================== */}
        <section id="problem" className="scroll-mt-20">
          <Suspense fallback={<SectionLoader />}>
            <ProblemSection />
          </Suspense>
        </section>
        
        <SectionDivider label="Our Solution" />
        
        {/* ==================== SOLUTION ==================== */}
        <section id="solution" className="scroll-mt-20">
          <Suspense fallback={<SectionLoader />}>
            <SolutionSection />
          </Suspense>
        </section>
        
        <SectionDivider label="See The Difference" />
        
        {/* ==================== COMPARISON ==================== */}
        <section id="comparison" className="scroll-mt-20">
          <Suspense fallback={<SectionLoader />}>
            <PrivacyInAction />
          </Suspense>
        </section>
        
        <SectionDivider label="Try It Live" />
        
        {/* ==================== LIVE DEMO ==================== */}
        <section id="zk" className="scroll-mt-20">
          <Suspense fallback={<SectionLoader />}>
            <ZKQuerySimulator />
          </Suspense>
        </section>
        
        <SectionDivider label="Your Dashboard" />
        
        {/* ==================== DASHBOARD ==================== */}
        <section id="dashboard" className="scroll-mt-20">
          <Suspense fallback={<SectionLoader />}>
            <MemoryDashboard />
          </Suspense>
        </section>
        
        <SectionDivider label="Admin Panel" />
        
        {/* ==================== ADMIN ==================== */}
        <section id="admin" className="scroll-mt-20">
          <Suspense fallback={<SectionLoader />}>
            <AdminDashboard />
          </Suspense>
        </section>
        
        <SectionDivider label="Technology" />
        
        {/* ==================== TECH ==================== */}
        <section id="midnight" className="scroll-mt-20">
          <Suspense fallback={<SectionLoader />}>
            <MidnightCompactDemo />
          </Suspense>
        </section>
        
        <SectionDivider label="Have Fun" />
        
        {/* ==================== FUN / MEMES ==================== */}
        <section id="cardano" className="scroll-mt-20">
          <Suspense fallback={<SectionLoader />}>
            <CardanoMemeSection />
          </Suspense>
        </section>
        
        <SectionDivider label="Architecture" />
        
        {/* ==================== ARCHITECTURE ==================== */}
        <section id="architecture" className="scroll-mt-20">
          <Suspense fallback={<SectionLoader />}>
            <ArchitectureFlowSlide />
          </Suspense>
        </section>
        
        <SectionDivider label="Smart Contracts" />
        
        {/* ==================== CONTRACT LOGIC ==================== */}
        <section id="contracts" className="scroll-mt-20">
          <Suspense fallback={<SectionLoader />}>
            <ContractLogicSlide />
          </Suspense>
        </section>
        
        <SectionDivider label="GDPR Compliance" />
        
        {/* ==================== GDPR DELETION ==================== */}
        <section id="gdpr" className="scroll-mt-20">
          <Suspense fallback={<SectionLoader />}>
            <GDPRDeletionDemo />
          </Suspense>
        </section>
        
        <SectionDivider label="What's Next" />
        
        {/* ==================== VISION / FUTURE ==================== */}
        <section id="future" className="scroll-mt-20">
          <Suspense fallback={<SectionLoader />}>
            <FutureSection />
          </Suspense>
        </section>
        
        {/* Footer spacing */}
        <div className="h-8" />
        
        {/* Bottom attribution */}
        <div className="text-center pb-6">
          <p className="text-xs text-zinc-600">
            Built with <span className="text-teal-500">Midnight</span> + <span className="text-purple-500">Cardano</span>
          </p>
        </div>
      </main>
      </ErrorBoundary>

      {/* Back to Top Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-teal-500/20 border border-teal-500/30 backdrop-blur-xl flex items-center justify-center text-teal-400 hover:bg-teal-500/30 hover:scale-110 transition-all shadow-lg shadow-teal-500/10"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.9 }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
