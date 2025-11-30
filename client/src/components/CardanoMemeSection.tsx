import { motion, AnimatePresence } from "framer-motion";
import React, { useState, useEffect, useCallback } from "react";

const memes = [
  {
    id: 1,
    title: "Explaining ZK Proofs to Grandma",
    quote: "\"So the AI knows you're stressed but doesn't know why? That's just called being married, dear.\"",
    emoji: "👵",
    bg: "from-purple-600 to-pink-600",
    glow: "purple",
  },
  {
    id: 2,
    title: "Privacy Before WhisperCache",
    quote: "AI: \"I see you googled 'am I having a quarter life crisis' at 3am... 47 times\"",
    emoji: "😰",
    bg: "from-red-500 to-orange-500",
    glow: "red",
  },
  {
    id: 3,
    title: "Privacy After WhisperCache",
    quote: "AI: \"Based on encrypted signals, you might benefit from mindfulness\"",
    emoji: "😎",
    bg: "from-teal-500 to-cyan-500",
    glow: "teal",
  },
  {
    id: 4,
    title: "Midnight Network Engineers",
    quote: "\"I verified 10,000 proofs today and still don't know what any of them say\"",
    emoji: "🔐",
    bg: "from-blue-500 to-indigo-600",
    glow: "blue",
  },
];

const funFacts = [
  { text: "Cardano uses Ouroboros, the first peer-reviewed blockchain protocol", icon: "📚" },
  { text: "Ada Lovelace would be proud (probably)", icon: "👩‍💻" },
  { text: "Midnight: Where your secrets go to stay secret", icon: "🌙" },
  { text: "ZK proofs: Math so private, even the math doesn't know", icon: "🧮" },
];

// Falling Emoji Component
interface FallingEmoji {
  id: number;
  emoji: string;
  x: number;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

function FallingEmojis({ emoji, isActive }: { emoji: string; isActive: boolean }) {
  const [emojis, setEmojis] = useState<FallingEmoji[]>([]);
  
  useEffect(() => {
    if (!isActive) {
      setEmojis([]);
      return;
    }
    
    // Generate falling emojis continuously while hovering
    const interval = setInterval(() => {
      const newEmoji: FallingEmoji = {
        id: Date.now() + Math.random(),
        emoji,
        x: Math.random() * 100, // Random horizontal position (percentage)
        delay: 0,
        duration: 3 + Math.random() * 2, // 3-5 seconds to fall
        size: 20 + Math.random() * 30, // 20-50px
        rotation: Math.random() * 360,
      };
      
      setEmojis(prev => [...prev.slice(-30), newEmoji]); // Keep max 30 emojis
    }, 150); // New emoji every 150ms
    
    return () => clearInterval(interval);
  }, [isActive, emoji]);
  
  // Clean up emojis that have fallen
  useEffect(() => {
    const cleanup = setInterval(() => {
      setEmojis(prev => prev.filter(e => Date.now() - e.id < 5000));
    }, 1000);
    return () => clearInterval(cleanup);
  }, []);
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
      <AnimatePresence>
        {emojis.map((e) => (
          <motion.div
            key={e.id}
            initial={{ 
              y: -50, 
              x: `${e.x}%`,
              opacity: 1,
              rotate: 0,
              scale: 0.5,
            }}
            animate={{ 
              y: "120vh", 
              rotate: e.rotation + 360,
              scale: 1,
              opacity: [1, 1, 0.8, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: e.duration,
              ease: "easeIn",
              delay: e.delay,
            }}
            className="absolute top-0"
            style={{ 
              fontSize: e.size,
              left: `${e.x}%`,
              filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))",
            }}
          >
            {e.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// 3D Card for features
function FeatureCard3D({ card, index }: { card: { icon: React.ReactNode; title: string; desc: string; stat: string; color: string }; index: number }) {
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0, scale: 1 });
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    setTransform({
      rotateX: ((y - centerY) / centerY) * -15,
      rotateY: ((x - centerX) / centerX) * 15,
      scale: 1.05,
    });
    setGlowPos({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
  };

  const handleMouseLeave = () => {
    setTransform({ rotateX: 0, rotateY: 0, scale: 1 });
    setGlowPos({ x: 50, y: 50 });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateX: -10 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.15, type: "spring", stiffness: 100 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg) scale(${transform.scale})`,
        transformStyle: "preserve-3d",
        transition: "transform 0.15s ease-out",
      }}
      className="relative p-6 rounded-2xl cursor-pointer group overflow-hidden"
    >
      {/* Background with glassmorphism */}
      <div 
        className="absolute inset-0 rounded-2xl"
        style={{
          background: "linear-gradient(145deg, rgba(39, 39, 42, 0.8), rgba(24, 24, 27, 0.9))",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
        }}
      />
      
      {/* Dynamic glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, ${card.color}, transparent 60%)`,
        }}
      />
      
      {/* Animated border */}
      <div className="absolute inset-0 rounded-2xl border border-white/[0.08] group-hover:border-white/20 transition-colors" />
      
      {/* Content */}
      <div className="relative z-10" style={{ transform: "translateZ(30px)" }}>
        {/* Icon with glow */}
        <div 
          className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 relative"
          style={{ 
            background: `linear-gradient(135deg, ${card.color.replace('0.3', '0.4')})`,
            transform: "translateZ(40px)" 
          }}
        >
          <div className="absolute inset-0 rounded-xl blur-xl opacity-60" style={{ background: card.color }} />
          <div className="relative text-white">{card.icon}</div>
        </div>
        
        <h3 className="font-bold text-lg text-white mb-2" style={{ transform: "translateZ(25px)" }}>
          {card.title}
        </h3>
        <p className="text-zinc-400 text-sm mb-4 leading-relaxed" style={{ transform: "translateZ(20px)" }}>
          {card.desc}
        </p>
        
        {/* Stat badge */}
        <div 
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
          style={{ transform: "translateZ(35px)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
          <span className="text-xs text-teal-400 font-medium">{card.stat}</span>
        </div>
      </div>
      
      {/* Shine effect */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          background: `linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)`,
          transform: `translateX(${(glowPos.x - 50) * 2}%)`,
        }}
      />
    </motion.div>
  );
}

export default function CardanoMemeSection() {
  const [currentMeme, setCurrentMeme] = useState(0);
  const [factIndex, setFactIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isEmojiHovered, setIsEmojiHovered] = useState(false);
  const [hoveredEmoji, setHoveredEmoji] = useState("");

  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setCurrentMeme((prev) => (prev + 1) % memes.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isHovered]);

  useEffect(() => {
    const factInterval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % funFacts.length);
    }, 4000);
    return () => clearInterval(factInterval);
  }, []);

  const handleEmojiHover = useCallback((emoji: string) => {
    setIsEmojiHovered(true);
    setHoveredEmoji(emoji);
  }, []);

  const handleEmojiLeave = useCallback(() => {
    setIsEmojiHovered(false);
    setHoveredEmoji("");
  }, []);

  const featureCards = [
    { 
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ),
      title: "Midnight Magic", 
      desc: "ZK proofs that feel like actual wizardry. Your secrets stay secret.",
      stat: "0 data leaked, ever",
      color: "rgba(168, 85, 247, 0.3)",
    },
    { 
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: "Cardano Speed", 
      desc: "Settlement faster than your coffee order arrives.",
      stat: "~2 second finality",
      color: "rgba(59, 130, 246, 0.3)",
    },
    { 
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      title: "Military Encryption", 
      desc: "AES-256 keeps your data sleeping peacefully.",
      stat: "256-bit fortress",
      color: "rgba(20, 184, 166, 0.3)",
    },
  ];

  return (
    <section className="py-12 px-6 relative overflow-hidden" id="memes">
      {/* Falling Emojis Effect */}
      <FallingEmojis emoji={hoveredEmoji} isActive={isEmojiHovered} />
      
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-3xl" />
      </div>
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-purple-400/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header with animated badge */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          {/* Animated badge */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full mb-6 relative"
            style={{
              background: "linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(59, 130, 246, 0.15))",
              border: "1px solid rgba(168, 85, 247, 0.3)",
            }}
          >
            <motion.span 
              className="text-2xl"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🎭
            </motion.span>
            <span className="text-sm font-medium bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Community Corner
            </span>
            <motion.span 
              className="text-2xl"
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            >
              🎪
            </motion.span>
          </motion.div>
          
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            <span className="text-white">The </span>
            <span className="relative">
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                Cardano Corner
              </span>
              <motion.div
                className="absolute -bottom-2 left-0 right-0 h-1 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
              />
            </span>
          </h2>
          
          <p className="text-xl text-zinc-400 mb-4">
            Because privacy doesn't have to be <span className="text-purple-400">boring</span> ✨
          </p>

          {/* Rotating fun fact with icon */}
          <AnimatePresence mode="wait">
            <motion.div
              key={factIndex}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.95 }}
              className="inline-flex items-center gap-3 mt-4 px-5 py-3 rounded-xl bg-zinc-900/50 border border-white/5"
            >
              <span className="text-2xl">{funFacts[factIndex].icon}</span>
              <span className="text-sm text-zinc-300 italic">"{funFacts[factIndex].text}"</span>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Meme Carousel - Enhanced */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mb-16"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="relative">
            {/* Glow behind card */}
            <div 
              className={`absolute inset-0 rounded-3xl blur-3xl transition-colors duration-500 opacity-30`}
              style={{
                background: `linear-gradient(135deg, ${memes[currentMeme].glow === 'purple' ? '#a855f7' : memes[currentMeme].glow === 'red' ? '#ef4444' : memes[currentMeme].glow === 'teal' ? '#14b8a6' : '#3b82f6'}, transparent)`,
              }}
            />
            
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMeme}
                initial={{ opacity: 0, rotateY: 15, x: 100 }}
                animate={{ opacity: 1, rotateY: 0, x: 0 }}
                exit={{ opacity: 0, rotateY: -15, x: -100 }}
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
                className="relative rounded-3xl overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, rgba(39, 39, 42, 0.9), rgba(24, 24, 27, 0.95))",
                  boxShadow: "0 30px 60px -15px rgba(0, 0, 0, 0.5)",
                }}
              >
                {/* Gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${memes[currentMeme].bg} opacity-10`} />
                
                {/* Border glow */}
                <div className={`absolute inset-0 rounded-3xl border-2 border-transparent`} 
                  style={{ 
                    borderImage: `linear-gradient(135deg, ${memes[currentMeme].glow === 'purple' ? '#a855f7' : memes[currentMeme].glow === 'red' ? '#ef4444' : memes[currentMeme].glow === 'teal' ? '#14b8a6' : '#3b82f6'}40, transparent) 1` 
                  }} 
                />
                
                <div className="relative p-10 md:p-14 text-center">
                  {/* Emoji with glow - HOVER TO TRIGGER FALLING EFFECT */}
                  <motion.div 
                    className="relative inline-block mb-8 cursor-pointer"
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    onMouseEnter={() => handleEmojiHover(memes[currentMeme].emoji)}
                    onMouseLeave={handleEmojiLeave}
                    whileHover={{ scale: 1.2 }}
                  >
                    <span className="text-7xl md:text-8xl block relative z-10 select-none">{memes[currentMeme].emoji}</span>
                    <div className={`absolute inset-0 blur-2xl opacity-50 bg-gradient-to-br ${memes[currentMeme].bg}`} />
                    {/* Hover hint */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      whileHover={{ opacity: 1, y: 0 }}
                      className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-zinc-500 whitespace-nowrap"
                    >
                      ✨ Hover for magic
                    </motion.div>
                  </motion.div>
                  
                  {/* Title with gradient */}
                  <h3 className={`text-2xl md:text-3xl font-bold mb-6 bg-gradient-to-r ${memes[currentMeme].bg} bg-clip-text text-transparent`}>
                    {memes[currentMeme].title}
                  </h3>
                  
                  {/* Quote */}
                  <p className="text-lg md:text-xl text-zinc-300 leading-relaxed max-w-xl mx-auto font-medium">
                    {memes[currentMeme].quote}
                  </p>
                  
                  {/* Meme number indicator */}
                  <div className="mt-8 text-zinc-600 text-sm">
                    {currentMeme + 1} / {memes.length}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation - Enhanced */}
          <div className="flex justify-center items-center gap-3 mt-8">
            {memes.map((meme, i) => (
              <motion.button
                key={i}
                onClick={() => setCurrentMeme(i)}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                className={`relative h-3 rounded-full transition-all duration-300 ${
                  i === currentMeme ? 'w-10' : 'w-3'
                }`}
                style={{
                  background: i === currentMeme 
                    ? `linear-gradient(90deg, ${meme.glow === 'purple' ? '#a855f7' : meme.glow === 'red' ? '#ef4444' : meme.glow === 'teal' ? '#14b8a6' : '#3b82f6'}, ${meme.glow === 'purple' ? '#ec4899' : meme.glow === 'red' ? '#f97316' : meme.glow === 'teal' ? '#06b6d4' : '#6366f1'})`
                    : 'rgba(255,255,255,0.2)',
                }}
              >
                {i === currentMeme && (
                  <motion.div
                    className="absolute inset-0 rounded-full blur-sm"
                    style={{
                      background: `linear-gradient(90deg, ${meme.glow === 'purple' ? '#a855f7' : meme.glow === 'red' ? '#ef4444' : meme.glow === 'teal' ? '#14b8a6' : '#3b82f6'}, ${meme.glow === 'purple' ? '#ec4899' : meme.glow === 'red' ? '#f97316' : meme.glow === 'teal' ? '#06b6d4' : '#6366f1'})`,
                    }}
                    layoutId="memeIndicator"
                  />
                )}
              </motion.button>
            ))}
          </div>
          
          {/* Swipe hint */}
          <p className="text-center text-zinc-600 text-xs mt-4">
            Click dots or wait for auto-scroll • Hover to pause
          </p>
        </motion.div>

        {/* Feature Cards - 3D */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-6"
        >
          {featureCards.map((card, i) => (
            <FeatureCard3D key={i} card={card} index={i} />
          ))}
        </motion.div>
        
        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-4 px-6 py-3 rounded-2xl bg-zinc-900/50 border border-white/5">
            <span className="text-zinc-400 text-sm">Built with</span>
            <div className="flex items-center gap-3">
              <span className="text-purple-400 font-semibold">Midnight</span>
              <span className="text-zinc-600">+</span>
              <span className="text-blue-400 font-semibold">Cardano</span>
            </div>
            <span className="text-2xl">💜</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
