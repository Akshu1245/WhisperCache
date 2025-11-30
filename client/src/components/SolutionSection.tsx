import { motion } from "framer-motion";
import { useState, useEffect } from "react";

// 3D Badge Component for interactive tilt effect
interface Badge3DProps {
  badge: { label: string; desc: string };
  index: number;
}

function Badge3D({ badge, index }: Badge3DProps) {
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0, scale: 1 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = -((y - centerY) / centerY) * 10;
    const rotateY = ((x - centerX) / centerX) * 10;
    setTransform({ rotateX, rotateY, scale: 1.05 });
  };

  const handleMouseLeave = () => {
    setTransform({ rotateX: 0, rotateY: 0, scale: 1 });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="p-4 rounded-xl bg-zinc-900/50 border border-white/[0.04] hover:border-teal-500/20 transition-all group cursor-pointer"
      style={{
        transform: `perspective(800px) rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg) scale(${transform.scale})`,
        transition: 'transform 0.15s ease-out',
        transformStyle: 'preserve-3d',
      }}
    >
      <div className="flex items-center gap-2 mb-1" style={{ transform: 'translateZ(15px)' }}>
        <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm font-medium text-white">{badge.label}</span>
      </div>
      <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors" style={{ transform: 'translateZ(10px)' }}>{badge.desc}</p>
    </motion.div>
  );
}

const steps = [
  {
    num: "01",
    title: "Share a Memory",
    desc: "User shares context naturally with their AI assistant.",
    detail: '"I get panic attacks before math exams"',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    color: "from-blue-500/20 to-cyan-500/20",
    borderColor: "border-blue-500/20",
    textColor: "text-blue-400",
  },
  {
    num: "02",
    title: "Local Encryption + ZK Proof",
    desc: "Memory is encrypted on-device. Zero-knowledge proof generated.",
    detail: "AES-256-GCM + Midnight Compact",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    color: "from-purple-500/20 to-pink-500/20",
    borderColor: "border-purple-500/20",
    textColor: "text-purple-400",
  },
  {
    num: "03",
    title: "AI Uses Proof, Not Data",
    desc: "AI receives verified insight without accessing raw content.",
    detail: '"Stress pattern detected: 92%"',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    color: "from-teal-500/20 to-emerald-500/20",
    borderColor: "border-teal-500/20",
    textColor: "text-teal-400",
  },
];

const techBadges = [
  { label: "AES-256-GCM", desc: "Military-grade encryption" },
  { label: "Zero-Knowledge Proofs", desc: "Cryptographic verification" },
  { label: "Midnight Compact", desc: "Cardano privacy layer" },
  { label: "On-device Processing", desc: "Data never leaves your device" },
];

export default function SolutionSection() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="section relative overflow-hidden">
      {/* Ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-radial from-teal-500/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
      
      <div className="container-lg relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <motion.span 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
            style={{ background: 'rgba(20, 184, 166, 0.1)', border: '1px solid rgba(20, 184, 166, 0.2)', color: '#5eead4' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Our Solution
          </motion.span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            How <span className="bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">WhisperCache</span> Works
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Your memories stay encrypted on your device. AI only receives 
            <span className="text-teal-400 font-medium"> zero-knowledge proofs</span> — never the raw data.
          </p>
        </motion.div>

        {/* Interactive Step Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveStep(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === activeStep ? 'w-8 bg-teal-400' : 'w-2 bg-zinc-700 hover:bg-zinc-600'
                }`}
              />
            ))}
          </div>
          <p className="text-center text-sm text-zinc-500">Click to explore each step</p>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setActiveStep(i)}
              className="relative cursor-pointer"
            >
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[calc(100%+0.75rem)] w-[calc(100%-3rem)] h-px z-10">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-teal-500/50 to-transparent"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: activeStep > i ? 1 : 0 }}
                    transition={{ duration: 0.5 }}
                    style={{ transformOrigin: 'left' }}
                  />
                  <div className="w-full h-full bg-gradient-to-r from-white/5 to-transparent absolute top-0" />
                </div>
              )}
              
              <motion.div 
                className={`p-6 rounded-2xl h-full transition-all duration-300 ${
                  i === activeStep 
                    ? 'bg-gradient-to-br ' + step.color + ' border-2 ' + step.borderColor + ' shadow-lg shadow-teal-500/10'
                    : 'bg-zinc-900/50 border border-white/[0.04] hover:border-white/[0.08]'
                }`}
                whileHover={{ scale: 1.02 }}
                animate={{ y: i === activeStep ? -4 : 0 }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <motion.div 
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} border ${step.borderColor} flex items-center justify-center ${step.textColor}`}
                    animate={i === activeStep ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.5 }}
                  >
                    {step.icon}
                  </motion.div>
                  <span className={`text-sm font-mono ${i === activeStep ? step.textColor : 'text-zinc-600'}`}>{step.num}</span>
                </div>
                
                {/* Content */}
                <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-sm text-zinc-400 mb-4 leading-relaxed">{step.desc}</p>
                
                {/* Detail tag */}
                <motion.div 
                  className={`px-4 py-3 rounded-xl bg-black/40 border ${i === activeStep ? step.borderColor : 'border-white/[0.04]'}`}
                  animate={i === activeStep ? { borderColor: ['rgba(20, 184, 166, 0.2)', 'rgba(20, 184, 166, 0.4)', 'rgba(20, 184, 166, 0.2)'] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <p className={`text-sm font-mono ${i === activeStep ? step.textColor : 'text-zinc-500'}`}>{step.detail}</p>
                </motion.div>

                {/* Active indicator */}
                {i === activeStep && (
                  <motion.div 
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-teal-400"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Tech badges - 3D Interactive */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {techBadges.map((badge, i) => (
            <Badge3D key={i} badge={badge} index={i} />
          ))}
        </motion.div>

        {/* Bottom highlight */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12 p-8 rounded-2xl bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-blue-500/10 border border-teal-500/20 relative overflow-hidden"
        >
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-30">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(20, 184, 166, 0.1)" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid)" />
            </svg>
          </div>
          
          <div className="relative text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/20 border border-teal-500/30 mb-4">
              <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-teal-400 font-medium">Privacy Preserved</span>
            </div>
            <p className="text-lg text-zinc-300">
              AI personalizes your experience with 
              <span className="text-white font-semibold"> zero access to your actual data</span>.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
