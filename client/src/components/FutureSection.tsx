import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { Sparkles, Zap, Shield, Brain, Rocket, Globe } from 'lucide-react';

interface FutureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
  index: number;
  shouldAnimate: boolean;
}

// Fragment piece component - each card assembles from 12 pieces
const CardFragment = ({ 
  children, 
  fragmentIndex, 
  totalFragments,
  cardDelay,
  isInView 
}: { 
  children: React.ReactNode; 
  fragmentIndex: number;
  totalFragments: number;
  cardDelay: number;
  isInView: boolean;
}) => {
  // Calculate random starting positions for each fragment
  const angle = (fragmentIndex / totalFragments) * Math.PI * 2;
  const radius = 300 + Math.random() * 200;
  const startX = Math.cos(angle) * radius;
  const startY = -400 - Math.random() * 300;
  const startZ = -500 + Math.random() * 400;
  const startRotateX = -180 + Math.random() * 360;
  const startRotateY = -180 + Math.random() * 360;
  const startRotateZ = -180 + Math.random() * 360;

  return (
    <motion.div
      initial={{
        opacity: 0,
        x: startX,
        y: startY,
        z: startZ,
        rotateX: startRotateX,
        rotateY: startRotateY,
        rotateZ: startRotateZ,
        scale: 0,
      }}
      animate={isInView ? {
        opacity: 1,
        x: 0,
        y: 0,
        z: 0,
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0,
        scale: 1,
      } : {}}
      transition={{
        type: "spring",
        stiffness: 50,
        damping: 15,
        delay: cardDelay + fragmentIndex * 0.08,
        duration: 1.5,
      }}
      style={{
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </motion.div>
  );
};

const FutureCard = ({ icon, title, description, delay, index, shouldAnimate }: FutureCardProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [assembled, setAssembled] = useState(false);
  
  const actuallyAnimate = isInView && shouldAnimate;

  useEffect(() => {
    if (actuallyAnimate) {
      const timer = setTimeout(() => setAssembled(true), (delay + 1.5) * 1000);
      return () => clearTimeout(timer);
    }
  }, [actuallyAnimate, delay]);

  return (
    <motion.div
      ref={ref}
      className="relative group"
      style={{
        transformStyle: "preserve-3d",
        perspective: 2000,
      }}
      whileHover={assembled ? {
        scale: 1.08,
        rotateY: 8,
        rotateX: -5,
        z: 80,
        transition: { duration: 0.4, ease: "easeOut" }
      } : {}}
    >
      {/* Assembling glow effect */}
      <motion.div
        className="absolute -inset-4 rounded-3xl"
        initial={{ opacity: 0 }}
        animate={actuallyAnimate ? { 
          opacity: [0, 0.8, 0.3],
          scale: [0.8, 1.2, 1],
        } : {}}
        transition={{ 
          delay: delay + 0.5,
          duration: 1.5,
          times: [0, 0.5, 1]
        }}
        style={{
          background: "radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />

      {/* Main card container */}
      <div className="relative" style={{ transformStyle: "preserve-3d" }}>
        
        {/* Fragment 1: Top left corner */}
        <CardFragment fragmentIndex={0} totalFragments={12} cardDelay={delay} isInView={actuallyAnimate}>
          <div className="absolute top-0 left-0 w-1/2 h-8 bg-gradient-to-r from-gray-900 to-transparent rounded-tl-2xl border-t-2 border-l-2 border-purple-500/30" />
        </CardFragment>

        {/* Fragment 2: Top right corner */}
        <CardFragment fragmentIndex={1} totalFragments={12} cardDelay={delay} isInView={actuallyAnimate}>
          <div className="absolute top-0 right-0 w-1/2 h-8 bg-gradient-to-l from-gray-900 to-transparent rounded-tr-2xl border-t-2 border-r-2 border-blue-500/30" />
        </CardFragment>

        {/* Fragment 3: Left edge */}
        <CardFragment fragmentIndex={2} totalFragments={12} cardDelay={delay} isInView={actuallyAnimate}>
          <div className="absolute top-8 left-0 w-4 h-1/3 bg-gradient-to-b from-gray-900 to-gray-800 border-l-2 border-purple-500/20" />
        </CardFragment>

        {/* Fragment 4: Right edge */}
        <CardFragment fragmentIndex={3} totalFragments={12} cardDelay={delay} isInView={actuallyAnimate}>
          <div className="absolute top-8 right-0 w-4 h-1/3 bg-gradient-to-b from-gray-900 to-gray-800 border-r-2 border-blue-500/20" />
        </CardFragment>

        {/* Main card body - assembles from center */}
        <CardFragment fragmentIndex={4} totalFragments={12} cardDelay={delay} isInView={actuallyAnimate}>
          <div className="relative bg-gradient-to-br from-gray-900/98 via-gray-800/98 to-gray-900/98 border border-purple-500/20 rounded-2xl p-8 backdrop-blur-xl overflow-hidden min-h-[320px]">
            
            {/* Holographic overlay effect */}
            <motion.div
              className="absolute inset-0 opacity-30"
              animate={{
                background: [
                  "linear-gradient(45deg, transparent 0%, rgba(139,92,246,0.1) 50%, transparent 100%)",
                  "linear-gradient(45deg, transparent 0%, rgba(59,130,246,0.1) 50%, transparent 100%)",
                  "linear-gradient(45deg, transparent 0%, rgba(139,92,246,0.1) 50%, transparent 100%)",
                ],
              }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
            />

            {/* Scan line effect during assembly */}
            <motion.div
              className="absolute inset-0 overflow-hidden rounded-2xl"
              initial={{ opacity: 1 }}
              animate={assembled ? { opacity: 0 } : { opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent"
                animate={{ y: ["-100%", "400%"] }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear", delay: delay }}
              />
            </motion.div>

            {/* Inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />
            
            {/* Animated corner accents */}
            <motion.div 
              className="absolute top-0 left-0 w-24 h-24"
              initial={{ opacity: 0, pathLength: 0 }}
              animate={actuallyAnimate ? { opacity: 1 } : {}}
              transition={{ delay: delay + 1.2, duration: 0.8 }}
            >
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <motion.path
                  d="M 0 30 L 0 10 Q 0 0 10 0 L 30 0"
                  fill="none"
                  stroke="url(#purpleGradient)"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={actuallyAnimate ? { pathLength: 1 } : {}}
                  transition={{ delay: delay + 1.2, duration: 0.8 }}
                />
                <defs>
                  <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
            
            <motion.div 
              className="absolute bottom-0 right-0 w-24 h-24"
              initial={{ opacity: 0 }}
              animate={actuallyAnimate ? { opacity: 1 } : {}}
              transition={{ delay: delay + 1.4, duration: 0.8 }}
            >
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <motion.path
                  d="M 100 70 L 100 90 Q 100 100 90 100 L 70 100"
                  fill="none"
                  stroke="url(#blueGradient)"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={actuallyAnimate ? { pathLength: 1 } : {}}
                  transition={{ delay: delay + 1.4, duration: 0.8 }}
                />
                <defs>
                  <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>

            {/* Icon with 3D float and glow */}
            <motion.div
              initial={{ opacity: 0, scale: 0, rotateY: 180 }}
              animate={actuallyAnimate ? { 
                opacity: 1, 
                scale: 1, 
                rotateY: 0,
              } : {}}
              transition={{ 
                delay: delay + 0.8, 
                duration: 0.8,
                type: "spring",
                stiffness: 100
              }}
              className="relative w-20 h-20 mb-6"
              style={{ transformStyle: "preserve-3d" }}
            >
              <motion.div
                animate={{ 
                  y: [0, -12, 0],
                  rotateY: [0, 10, -10, 0],
                  rotateZ: [0, 3, -3, 0],
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 5,
                  ease: "easeInOut" 
                }}
                className="relative w-full h-full flex items-center justify-center"
                style={{ transformStyle: "preserve-3d" }}
              >
                {/* Multiple layered glows for 3D depth */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl blur-xl opacity-60" style={{ transform: "translateZ(-30px)" }} />
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-blue-400 rounded-2xl blur-md opacity-40" style={{ transform: "translateZ(-15px)" }} />
                <div className="relative bg-gradient-to-br from-purple-500 via-violet-500 to-blue-600 rounded-2xl p-4 text-white shadow-2xl" style={{ transform: "translateZ(20px)" }}>
                  {icon}
                </div>
              </motion.div>
            </motion.div>

            {/* Title with typewriter effect */}
            <motion.h3
              initial={{ opacity: 0, x: -30 }}
              animate={actuallyAnimate ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: delay + 1.0, duration: 0.6, type: "spring" }}
              className="text-2xl font-bold text-white mb-4 relative z-10"
            >
              <span className="bg-gradient-to-r from-white via-purple-100 to-white bg-clip-text text-transparent">
                {title}
              </span>
            </motion.h3>
            
            {/* Description with fade-up */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={actuallyAnimate ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: delay + 1.2, duration: 0.6 }}
              className="text-gray-400 leading-relaxed relative z-10 text-base"
            >
              {description}
            </motion.p>

            {/* Floating particles with 3D depth */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${10 + (i * 12) % 80}%`,
                  top: `${40 + (i * 15) % 50}%`,
                  width: 2 + (i % 3) * 2,
                  height: 2 + (i % 3) * 2,
                  background: i % 2 === 0 ? "#a855f7" : "#3b82f6",
                  boxShadow: `0 0 ${4 + i * 2}px ${i % 2 === 0 ? "#a855f7" : "#3b82f6"}`,
                }}
                animate={{
                  y: [0, -30 - i * 5, 0],
                  x: [0, (i % 2 === 0 ? 10 : -10), 0],
                  opacity: [0.2, 0.9, 0.2],
                  scale: [1, 1.5, 1],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 3 + i * 0.5,
                  delay: delay + i * 0.3,
                  ease: "easeInOut"
                }}
              />
            ))}

            {/* Energy lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
              <motion.line
                x1="0" y1="50%" x2="100%" y2="50%"
                stroke="url(#lineGradient)"
                strokeWidth="1"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={actuallyAnimate ? { pathLength: 1, opacity: 0.5 } : {}}
                transition={{ delay: delay + 1.5, duration: 1 }}
              />
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="50%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </CardFragment>

        {/* Fragment 5: Bottom glow */}
        <CardFragment fragmentIndex={5} totalFragments={12} cardDelay={delay} isInView={actuallyAnimate}>
          <motion.div
            className="absolute -bottom-2 left-1/4 right-1/4 h-4 rounded-full"
            style={{
              background: "radial-gradient(ellipse at center, rgba(139,92,246,0.4) 0%, transparent 70%)",
              filter: "blur(8px)",
            }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        </CardFragment>
      </div>

      {/* Hover glow effect */}
      <motion.div
        className="absolute -inset-2 bg-gradient-to-r from-purple-600/0 via-violet-600/0 to-blue-600/0 rounded-3xl opacity-0 group-hover:opacity-100 blur-2xl transition-all duration-700"
        style={{
          background: "radial-gradient(circle at center, rgba(139,92,246,0.3) 0%, rgba(59,130,246,0.2) 50%, transparent 70%)",
        }}
      />
    </motion.div>
  );
};

const futureFeatures = [
  {
    icon: <Brain className="w-10 h-10" />,
    title: "AI-Powered Analysis",
    description: "Advanced machine learning models analyze token patterns and predict potential behaviors before they happen."
  },
  {
    icon: <Shield className="w-10 h-10" />,
    title: "Zero-Knowledge Security",
    description: "Cryptographic proofs verify authenticity without exposing sensitive data. Privacy meets transparency."
  },
  {
    icon: <Zap className="w-10 h-10" />,
    title: "Real-Time Detection",
    description: "Instant threat detection with sub-second response times. Stop scams before they drain your wallet."
  },
  {
    icon: <Globe className="w-10 h-10" />,
    title: "Multi-Chain Coverage",
    description: "Expanding beyond Cardano to protect you across all major blockchain networks."
  },
  {
    icon: <Rocket className="w-10 h-10" />,
    title: "Predictive Alerts",
    description: "Get warned about suspicious tokens before they trend. Stay ahead of the curve."
  },
  {
    icon: <Sparkles className="w-10 h-10" />,
    title: "Community Intelligence",
    description: "Crowdsourced threat data combined with AI for unmatched accuracy in scam detection."
  }
];

const FutureSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-50px" });
  const [currentCardIndex, setCurrentCardIndex] = useState(-1);

  // Sequentially animate cards one by one
  useEffect(() => {
    if (isInView && currentCardIndex < futureFeatures.length - 1) {
      const timer = setTimeout(() => {
        setCurrentCardIndex(prev => prev + 1);
      }, currentCardIndex === -1 ? 500 : 2000); // First card after 500ms, then every 2s
      return () => clearTimeout(timer);
    }
  }, [isInView, currentCardIndex]);

  return (
    <section 
      ref={sectionRef}
      className="relative py-16 overflow-hidden bg-[#08080c]"
      style={{ perspective: "1500px" }}
    >
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }} />
      </div>

      {/* Glowing orbs in background */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
      />

      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={isInView ? { scale: 1 } : {}}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full mb-6"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-purple-300 text-sm font-medium">Coming Soon</span>
          </motion.div>
          
          <h2 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
              The Future of
            </span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-blue-400 bg-clip-text text-transparent">
              AI Protection
            </span>
          </h2>
          
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            We're building the next generation of blockchain security. Here's what's coming.
          </p>
        </motion.div>

        {/* 3D Cards Grid */}
        <div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          style={{ transformStyle: "preserve-3d" }}
        >
          {futureFeatures.map((feature, index) => (
            <FutureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={0.2}
              index={index}
              shouldAnimate={index <= currentCardIndex}
            />
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="text-center mt-20"
        >
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(139, 92, 246, 0.5)" }}
            whileTap={{ scale: 0.95 }}
            className="px-10 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full text-white font-semibold text-lg shadow-lg shadow-purple-500/25"
          >
            Join the Waitlist
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
};

export default FutureSection;
