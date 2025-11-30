import { motion } from "framer-motion";
import { useState } from "react";

// SVG Icons
const AIIcon = () => (
  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3"/>
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MoonIcon = () => (
  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const BoltIcon = () => (
  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const integrationSteps = [
  {
    id: "ai",
    Icon: AIIcon,
    title: "Your AI",
    subtitle: "ChatGPT / Claude / Gemini / Grok",
    desc: "Connect any major AI assistant",
    color: "from-blue-400 to-cyan-400",
    bgColor: "from-blue-500/20 to-cyan-500/20",
    glowColor: "blue",
  },
  {
    id: "whisper",
    Icon: ShieldIcon,
    title: "WhisperCache",
    subtitle: "Privacy Layer",
    desc: "Encrypts & generates ZK proofs",
    color: "from-teal-400 to-emerald-400",
    bgColor: "from-teal-500/20 to-emerald-500/20",
    glowColor: "teal",
    highlight: true
  },
  {
    id: "midnight",
    Icon: MoonIcon,
    title: "Midnight",
    subtitle: "ZK Smart Contracts",
    desc: "Verifies proofs privately",
    color: "from-purple-400 to-pink-400",
    bgColor: "from-purple-500/20 to-pink-500/20",
    glowColor: "purple",
  },
  {
    id: "cardano",
    Icon: BoltIcon,
    title: "Cardano",
    subtitle: "Proof Anchoring",
    desc: "Immutable proof storage",
    color: "from-indigo-400 to-blue-400",
    bgColor: "from-indigo-500/20 to-blue-500/20",
    glowColor: "indigo",
  },
];

// 3D Tilt Card Component with State-based transforms
function Card3D({ step, index }: { step: typeof integrationSteps[0]; index: number }) {
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0, scale: 1 });
  const [glowPosition, setGlowPosition] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -15;
    const rotateY = ((x - centerX) / centerX) * 15;
    
    setTransform({ rotateX, rotateY, scale: 1.02 });
    setGlowPosition({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
  };

  const handleMouseLeave = () => {
    setTransform({ rotateX: 0, rotateY: 0, scale: 1 });
    setGlowPosition({ x: 50, y: 50 });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15, duration: 0.6, type: "spring" }}
      viewport={{ once: true }}
      className="relative group"
      style={{ perspective: "1000px" }}
    >
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1000px) rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg) scale(${transform.scale})`,
          transformStyle: "preserve-3d",
          transition: "transform 0.1s ease-out",
        }}
        className={`relative p-8 rounded-2xl cursor-pointer ${
          step.highlight
            ? `bg-gradient-to-br ${step.bgColor} border-2 border-teal-500/50 shadow-2xl shadow-teal-500/20`
            : `bg-zinc-900/80 border border-white/10 hover:border-white/20 shadow-xl`
        }`}
      >
        {/* Dynamic glow effect following cursor */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100"
          style={{
            background: `radial-gradient(circle at ${glowPosition.x}% ${glowPosition.y}%, ${step.highlight ? 'rgba(20, 184, 166, 0.4)' : 'rgba(255, 255, 255, 0.15)'}, transparent 50%)`,
          }}
        />
        
        {/* Animated shine effect */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div 
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: `linear-gradient(105deg, transparent 20%, rgba(255, 255, 255, 0.1) 45%, rgba(255, 255, 255, 0.3) 50%, rgba(255, 255, 255, 0.1) 55%, transparent 80%)`,
              transform: `translateX(${glowPosition.x - 50}%)`,
            }}
          />
        </div>
        
        {/* Content with 3D depth */}
        <div style={{ transform: "translateZ(40px)" }}>
          {/* Step number badge */}
          <div 
            className="absolute -top-3 left-6 px-3 py-1 bg-zinc-950 rounded-full text-xs font-bold text-zinc-400 border border-white/10"
            style={{ transform: "translateZ(60px)" }}
          >
            Step {index + 1}
          </div>
          
          {/* Icon with glow */}
          <div 
            className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.bgColor} flex items-center justify-center mb-6 relative group-hover:scale-110 transition-transform duration-300`}
            style={{ transform: "translateZ(50px)" }}
          >
            {/* Icon glow */}
            <div className={`absolute inset-0 bg-${step.glowColor}-500 rounded-2xl blur-xl opacity-40 group-hover:opacity-70 transition-opacity`} />
            <div className="relative text-white">
              <step.Icon />
            </div>
          </div>
          
          <h3 
            className="font-bold text-xl text-white mb-1"
            style={{ transform: "translateZ(35px)" }}
          >
            {step.title}
          </h3>
          <p 
            className={`text-sm font-semibold mb-3 bg-gradient-to-r ${step.color} bg-clip-text text-transparent`}
            style={{ transform: "translateZ(30px)" }}
          >
            {step.subtitle}
          </p>
          <p 
            className="text-zinc-400 text-sm leading-relaxed"
            style={{ transform: "translateZ(25px)" }}
          >
            {step.desc}
          </p>
          
          {/* Interactive hint */}
          <div 
            className="mt-4 flex items-center gap-2 text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors"
            style={{ transform: "translateZ(20px)" }}
          >
            <span className={`w-1.5 h-1.5 rounded-full bg-${step.glowColor}-500 group-hover:animate-pulse`} />
            <span>Move cursor for 3D</span>
          </div>
        </div>
        
        {/* Border glow on hover */}
        <div 
          className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-white/10 transition-colors pointer-events-none"
          style={{ transform: "translateZ(5px)" }}
        />
      </div>

      {/* Connection arrow (except last) */}
      {index < integrationSteps.length - 1 && (
        <motion.div 
          className="absolute -right-6 top-1/2 -translate-y-1/2 text-zinc-600 hidden lg:block z-20"
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.15 + 0.3 }}
          viewport={{ once: true }}
        >
          <motion.svg 
            className="w-10 h-10" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5"
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </motion.svg>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function IntegrationSection() {
  return (
    <section className="py-20 px-6 relative overflow-hidden" id="integrations">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-950/10 to-transparent" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20 mb-6"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            <span className="text-sm text-teal-300 font-medium">Architecture</span>
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Seamless <span className="bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">Integration</span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Not a competing AI — a <span className="text-teal-400 font-medium">privacy shield</span> that sits between your AI and your data.
          </p>
          <p className="text-sm text-zinc-500 mt-4 flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border border-zinc-600 rounded animate-pulse"></span>
            Move your cursor over the cards for 3D effect
          </p>
        </motion.div>

        {/* 3D Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {integrationSteps.map((step, i) => (
            <Card3D key={step.id} step={step} index={i} />
          ))}
        </div>

        {/* Data flow visualization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          viewport={{ once: true }}
          className="mt-16 p-8 rounded-2xl bg-zinc-900/50 border border-white/10 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Live Data Flow</h4>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            {[
              { label: "User Query", bg: "bg-blue-500/10", text: "text-blue-300", border: "border-blue-500/20" },
              { label: "Encrypted + ZK Proof", bg: "bg-teal-500/10", text: "text-teal-300", border: "border-teal-500/20" },
              { label: "Midnight Verification", bg: "bg-purple-500/10", text: "text-purple-300", border: "border-purple-500/20" },
              { label: "AI Gets Insight (Not Data)", bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/20" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <motion.span 
                  className={`px-5 py-2.5 rounded-xl ${item.bg} ${item.text} border ${item.border} font-medium cursor-default`}
                  whileHover={{ scale: 1.05, y: -2 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  {item.label}
                </motion.span>
                {i < 3 && (
                  <motion.svg 
                    className="w-5 h-5 text-zinc-600" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor"
                    animate={{ x: [0, 3, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  >
                    <path d="M9 5l7 7-7 7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </motion.svg>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
