import { motion } from "framer-motion";
import React, { useState, useEffect } from "react";

// 3D Card Component for interactive tilt effect
interface Card3DProps {
  item: {
    icon: React.ReactNode;
    label: string;
    desc: string;
    risk: string;
  };
  index: number;
}

function Card3D({ item, index }: Card3DProps) {
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0, scale: 1 });
  const [glowPosition, setGlowPosition] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = -((y - centerY) / centerY) * 12;
    const rotateY = ((x - centerX) / centerX) * 12;
    setTransform({ rotateX, rotateY, scale: 1.05 });
    setGlowPosition({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
  };

  const handleMouseLeave = () => {
    setTransform({ rotateX: 0, rotateY: 0, scale: 1 });
    setGlowPosition({ x: 50, y: 50 });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="p-5 rounded-2xl bg-zinc-900/50 border border-white/[0.04] transition-all group relative overflow-hidden cursor-pointer"
      style={{
        transform: `perspective(1000px) rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg) scale(${transform.scale})`,
        transition: 'transform 0.15s ease-out',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Dynamic glow effect */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${glowPosition.x}% ${glowPosition.y}%, rgba(239, 68, 68, 0.15) 0%, transparent 50%)`,
        }}
      />
      
      {/* Risk badge */}
      <div className={`absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
        item.risk === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
      }`}>
        {item.risk}
      </div>
      
      <div 
        className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 mb-4 group-hover:bg-red-500/20 transition-colors"
        style={{ transform: 'translateZ(30px)' }}
      >
        {item.icon}
      </div>
      <h4 className="font-semibold text-white mb-1" style={{ transform: 'translateZ(20px)' }}>{item.label}</h4>
      <p className="text-sm text-zinc-500 group-hover:text-red-400/80 transition-colors" style={{ transform: 'translateZ(10px)' }}>
        {item.desc}
      </p>
      
      {/* Shine effect */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)`,
          transform: `translateX(${(glowPosition.x - 50) * 2}%)`,
        }}
      />
    </motion.div>
  );
}

const exposedData = [
  { 
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    label: "Conversations",
    desc: "Stored in plain text on servers",
    risk: "HIGH"
  },
  { 
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    label: "Location",
    desc: "Tracked across sessions",
    risk: "HIGH"
  },
  { 
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    label: "Health Info",
    desc: "Shared with third parties",
    risk: "CRITICAL"
  },
  { 
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    label: "Financial",
    desc: "Used for profiling",
    risk: "CRITICAL"
  },
];

const leakingData = [
  "Sending health data to analytics...",
  "Uploading conversation history...",
  "Syncing location patterns...",
  "Sharing behavioral profile...",
  "Transmitting preferences...",
];

export default function ProblemSection() {
  const [currentLeak, setCurrentLeak] = useState(0);
  const [breachCount, setBreachCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLeak((prev) => (prev + 1) % leakingData.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const target = 2600000000;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setBreachCount(target);
        clearInterval(timer);
      } else {
        setBreachCount(Math.floor(current));
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    return num.toLocaleString();
  };

  return (
    <section className="section relative overflow-hidden">
      {/* Danger ambient glow */}
      <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="container-lg relative">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          {/* Left content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <motion.span 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5' }}
              animate={{ boxShadow: ['0 0 0 0 rgba(239, 68, 68, 0.2)', '0 0 0 8px rgba(239, 68, 68, 0)', '0 0 0 0 rgba(239, 68, 68, 0.2)'] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              Security Alert
            </motion.span>
            
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Your AI Knows 
              <span className="text-red-400 relative">
                {" "}Everything
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 100 8" preserveAspectRatio="none">
                  <path d="M0,4 Q25,0 50,4 T100,4" fill="none" stroke="rgba(239, 68, 68, 0.5)" strokeWidth="2" />
                </svg>
              </span>
              <br />About You.
            </h2>
            
            <p className="text-lg text-zinc-400 mb-8 leading-relaxed">
              Today's AI assistants store raw conversations on cloud servers. 
              Your therapy notes, financial worries, health concerns — all accessible 
              to <span className="text-red-400/80 font-medium">corporations</span>, <span className="text-red-400/80 font-medium">hackers</span>, and <span className="text-red-400/80 font-medium">governments</span>.
            </p>

            {/* Live leak simulation */}
            <motion.div 
              className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 mb-8 font-mono text-sm"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 text-xs uppercase tracking-wider">Live Data Exposure</span>
              </div>
              <motion.div
                key={currentLeak}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-zinc-400"
              >
                <span className="text-red-400">&gt;</span> {leakingData[currentLeak]}
              </motion.div>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-6">
              <motion.div 
                className="p-5 rounded-2xl bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20"
                whileHover={{ scale: 1.02 }}
              >
                <div className="text-3xl md:text-4xl font-bold text-white mb-1">{formatNumber(breachCount)}</div>
                <div className="text-sm text-zinc-500">Records exposed in 2023</div>
                <div className="mt-2 h-1 rounded-full bg-red-500/20 overflow-hidden">
                  <motion.div 
                    className="h-full bg-red-500"
                    initial={{ width: 0 }}
                    whileInView={{ width: '85%' }}
                    transition={{ duration: 1.5 }}
                    viewport={{ once: true }}
                  />
                </div>
              </motion.div>
              <motion.div 
                className="p-5 rounded-2xl bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20"
                whileHover={{ scale: 1.02 }}
              >
                <div className="text-3xl md:text-4xl font-bold text-white mb-1">73%</div>
                <div className="text-sm text-zinc-500">Users concerned about AI privacy</div>
                <div className="mt-2 h-1 rounded-full bg-red-500/20 overflow-hidden">
                  <motion.div 
                    className="h-full bg-red-500"
                    initial={{ width: 0 }}
                    whileInView={{ width: '73%' }}
                    transition={{ duration: 1.5, delay: 0.2 }}
                    viewport={{ once: true }}
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Right - 3D Data cards */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 gap-4"
          >
            {exposedData.map((item, i) => (
              <Card3D key={i} item={item} index={i} />
            ))}

            {/* Warning box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="col-span-2 p-6 rounded-2xl bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border border-red-500/20"
            >
              <div className="flex items-start gap-4">
                <motion.div 
                  className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </motion.div>
                <div>
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    Your Digital Memories Are Exposed
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  </h4>
                  <p className="text-sm text-zinc-400">
                    Data breaches, corporate surveillance, targeted ads — all because your AI has <span className="text-red-400 font-medium">no privacy layer</span>.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}