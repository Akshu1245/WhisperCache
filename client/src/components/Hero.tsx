import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, memo } from "react";

// Glitch text characters for cyber effect
const glitchChars = "!@#$%^&*()_+{}|:<>?~`-=[]\\;',./";

// Dramatic privacy violations
const privacyHorrors = [
  { text: "Your deepest fears", emoji: "😰", subtext: "stored on corporate servers" },
  { text: "Your medical history", emoji: "🏥", subtext: "accessible to advertisers" },
  { text: "Your private thoughts", emoji: "💭", subtext: "training unknown AI models" },
  { text: "Your family secrets", emoji: "👨‍👩‍👧‍👦", subtext: "sold to data brokers" },
  { text: "Your financial struggles", emoji: "💸", subtext: "shared without consent" },
];

// Simplified floating shape - uses CSS animation instead of framer-motion
const FloatingShape = memo(({ delay, size, color, left, top }: any) => (
  <div
    className="absolute pointer-events-none animate-float"
    style={{ 
      left: `${left}%`, 
      top: `${top}%`,
      animationDelay: `${delay}s`,
    }}
  >
    <div
      className={`${size} rounded-lg blur-sm`}
      style={{
        background: `linear-gradient(135deg, ${color}40, ${color}10)`,
        border: `1px solid ${color}30`,
        transform: "perspective(1000px) rotateX(45deg) rotateY(45deg)",
      }}
    />
  </div>
));

// Simplified glow orb - static with CSS animation
const GlowOrb = memo(({ color, size, x, y, blur }: any) => (
  <div
    className="absolute rounded-full pointer-events-none animate-pulse-slow"
    style={{
      width: size,
      height: size,
      left: x,
      top: y,
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      filter: `blur(${blur}px)`,
      opacity: 0.4,
    }}
  />
));

// Simplified Matrix rain - reduced count
const MatrixRain = memo(() => {
  const chars = "01";
  return (
    <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className="absolute text-teal-500 font-mono text-xs animate-matrix-rain"
          style={{ 
            left: `${i * 10}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${5 + Math.random() * 3}s`,
          }}
        >
          {[...Array(10)].map((_, j) => (
            <div key={j} className="my-1">
              {chars[Math.floor(Math.random() * chars.length)]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});

// 3D Rotating Shield/Vault Visual
const HeroVaultVisual = () => (
  <motion.div
    className="absolute right-10 top-1/2 -translate-y-1/2 w-80 h-80 hidden lg:block pointer-events-none"
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 2, duration: 1 }}
  >
    {/* Outer ring */}
    <motion.div
      className="absolute inset-0 rounded-full border-2 border-teal-500/20"
      animate={{ rotate: 360 }}
      transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
    />
    <motion.div
      className="absolute inset-4 rounded-full border border-purple-500/15"
      animate={{ rotate: -360 }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
    />
    <motion.div
      className="absolute inset-8 rounded-full border border-cyan-500/10"
      animate={{ rotate: 360 }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
    />
    
    {/* Center vault */}
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        className="w-32 h-32 rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-teal-500/30 flex items-center justify-center relative overflow-hidden"
        animate={{
          boxShadow: [
            "0 0 30px rgba(20, 184, 166, 0.2)",
            "0 0 60px rgba(20, 184, 166, 0.4)",
            "0 0 30px rgba(20, 184, 166, 0.2)",
          ],
        }}
        transition={{ duration: 3, repeat: Infinity }}
        style={{ transform: "perspective(500px) rotateY(-15deg)" }}
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-purple-500/10"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.span
          className="text-5xl relative z-10"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          🔐
        </motion.span>
      </motion.div>
    </div>
    
    {/* Orbiting particles */}
    {[0, 72, 144, 216, 288].map((angle, i) => (
      <motion.div
        key={i}
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 15 + i * 3, repeat: Infinity, ease: "linear" }}
        style={{ transform: `rotate(${angle}deg)` }}
      >
        <motion.div
          className="absolute w-3 h-3 rounded-full bg-teal-400/60"
          style={{ top: "5%", left: "50%", transform: "translateX(-50%)" }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
        />
      </motion.div>
    ))}
    
    {/* Data streams */}
    {[...Array(6)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute left-1/2 top-1/2 w-px h-24 origin-top"
        style={{ transform: `rotate(${i * 60}deg)` }}
      >
        <motion.div
          className="w-full h-4 bg-gradient-to-b from-teal-400/50 to-transparent"
          animate={{ y: [0, 80, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 2 + Math.random(), repeat: Infinity, delay: i * 0.3 }}
        />
      </motion.div>
    ))}
  </motion.div>
);

// Left side floating icons
const FloatingIcons = () => (
  <div className="absolute left-10 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-6 pointer-events-none">
    {[
      { emoji: "🧠", label: "AI Memory", delay: 0 },
      { emoji: "🔒", label: "Encrypted", delay: 0.2 },
      { emoji: "⚡", label: "Fast ZK", delay: 0.4 },
      { emoji: "🛡️", label: "Private", delay: 0.6 },
    ].map((item, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 3 + item.delay, duration: 0.5 }}
        className="flex items-center gap-3"
      >
        <motion.div
          className="w-14 h-14 rounded-2xl bg-zinc-900/80 border border-white/10 flex items-center justify-center"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}
          whileHover={{ scale: 1.1, borderColor: "rgba(20, 184, 166, 0.5)" }}
        >
          <span className="text-2xl">{item.emoji}</span>
        </motion.div>
        <motion.span
          className="text-xs text-zinc-500 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.5 + item.delay }}
        >
          {item.label}
        </motion.span>
      </motion.div>
    ))}
  </div>
);

export default function Hero() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [currentHorror, setCurrentHorror] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [glitchText, setGlitchText] = useState("");
  const [showSolution, setShowSolution] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      // Calculate tilt based on mouse position
      const x = (e.clientY / window.innerHeight - 0.5) * 10;
      const y = (e.clientX / window.innerWidth - 0.5) * -10;
      setTilt({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Glitch text effect
  useEffect(() => {
    const text = "WhisperCache";
    let iterations = 0;
    const maxIterations = text.length * 3;
    
    const interval = setInterval(() => {
      if (iterations >= maxIterations) {
        setGlitchText(text);
        setShowSolution(true);
        clearInterval(interval);
        return;
      }
      
      const revealed = Math.floor(iterations / 3);
      let result = "";
      for (let i = 0; i < text.length; i++) {
        if (i < revealed) {
          result += text[i];
        } else if (i === revealed) {
          result += glitchChars[Math.floor(Math.random() * glitchChars.length)];
        } else {
          result += glitchChars[Math.floor(Math.random() * glitchChars.length)];
        }
      }
      setGlitchText(result);
      iterations++;
    }, 50);

    // Start glitch after delay
    const startDelay = setTimeout(() => {
      setIsRevealed(true);
    }, 4000);

    return () => {
      clearInterval(interval);
      clearTimeout(startDelay);
    };
  }, []);

  // Rotate horror messages
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHorror((prev) => (prev + 1) % privacyHorrors.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const scrollToDemo = () => {
    document.getElementById("zk")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section 
      className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20 relative overflow-hidden"
      style={{ perspective: "1000px" }}
    >
      {/* Immersive background layers */}
      <div className="absolute inset-0 bg-[#08080c]" />
      
      {/* Animated mesh gradient */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 50%, rgba(20, 184, 166, 0.12), transparent),
            radial-gradient(ellipse 60% 40% at 70% 30%, rgba(168, 85, 247, 0.08), transparent),
            radial-gradient(ellipse 50% 50% at 30% 70%, rgba(59, 130, 246, 0.06), transparent)
          `,
        }}
        animate={{
          opacity: [0.6, 0.9, 0.6],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Matrix rain */}
      <MatrixRain />
      
      {/* Floating 3D shapes */}
      <FloatingShape delay={0} duration={8} size="w-20 h-20" color="#14b8a6" left={10} top={20} />
      <FloatingShape delay={1} duration={10} size="w-16 h-16" color="#a855f7" left={85} top={15} />
      <FloatingShape delay={2} duration={9} size="w-12 h-12" color="#3b82f6" left={20} top={70} />
      <FloatingShape delay={3} duration={11} size="w-24 h-24" color="#14b8a6" left={75} top={65} />
      <FloatingShape delay={0.5} duration={7} size="w-8 h-8" color="#f472b6" left={50} top={85} />
      
      {/* Glow orbs */}
      <GlowOrb color="rgba(20, 184, 166, 0.4)" size={600} x="10%" y="20%" blur={100} />
      <GlowOrb color="rgba(168, 85, 247, 0.3)" size={500} x="70%" y="60%" blur={120} />
      <GlowOrb color="rgba(59, 130, 246, 0.2)" size={400} x="50%" y="10%" blur={80} />
      
      {/* 3D Visual Elements */}
      <HeroVaultVisual />
      <FloatingIcons />
      
      {/* Cursor spotlight */}
      <div 
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: `radial-gradient(800px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(20, 184, 166, 0.12), transparent 40%)`
        }}
      />
      
      {/* Scan lines */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="w-full h-full" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)"
        }} />
      </div>
      
      {/* Main content with 3D tilt */}
      <motion.div 
        className="relative z-10 max-w-6xl mx-auto"
        style={{ 
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 0.1s ease-out"
        }}
      >
        
        {/* FEAR HOOK: What AI knows about you */}
        <motion.div
          initial={{ opacity: 0, y: -30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, type: "spring" }}
          className="mb-8"
        >
          {/* Warning badge with pulse */}
          <motion.div 
            className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-red-500/20 via-red-500/10 to-orange-500/20 border border-red-500/30 mb-6 backdrop-blur-sm"
            animate={{
              boxShadow: [
                "0 0 20px rgba(239, 68, 68, 0.3)",
                "0 0 40px rgba(239, 68, 68, 0.5)",
                "0 0 20px rgba(239, 68, 68, 0.3)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.span 
              className="text-2xl"
              animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              ⚠️
            </motion.span>
            <span className="text-sm md:text-base text-red-300 font-bold tracking-wide">
              YOUR PRIVACY IS BEING VIOLATED RIGHT NOW
            </span>
          </motion.div>
          
          {/* Rotating horror messages */}
          <div className="h-24 flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentHorror}
                initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -30, filter: "blur(10px)" }}
                transition={{ duration: 0.5 }}
                className="text-center"
              >
                <motion.div 
                  className="text-5xl md:text-6xl mb-2"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5 }}
                >
                  {privacyHorrors[currentHorror].emoji}
                </motion.div>
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">
                  {privacyHorrors[currentHorror].text}
                </div>
                <div className="text-red-400 text-lg font-medium">
                  {privacyHorrors[currentHorror].subtext}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* THE SOLUTION - Dramatic reveal */}
        <AnimatePresence>
          {isRevealed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.5 }}
            >
              {/* Solution transition */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="w-48 h-px bg-gradient-to-r from-transparent via-teal-500 to-transparent mx-auto mb-8"
              />
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-xl md:text-2xl text-zinc-400 mb-4 font-light"
              >
                But what if there was another way?
              </motion.p>

              {/* BRAND NAME with glitch effect */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.5, type: "spring", stiffness: 100 }}
                className="relative mb-6"
              >
                <motion.h1 
                  className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <span className="relative inline-block">
                    {/* Glow layer */}
                    <span 
                      className="absolute inset-0 bg-gradient-to-r from-teal-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent blur-2xl opacity-50"
                      aria-hidden="true"
                    >
                      {glitchText}
                    </span>
                    {/* Main text */}
                    <span className="relative bg-gradient-to-r from-teal-400 via-cyan-300 to-purple-400 bg-clip-text text-transparent">
                      {glitchText}
                    </span>
                    {/* Glitch overlay */}
                    <motion.span
                      className="absolute inset-0 bg-gradient-to-r from-red-500 via-transparent to-blue-500 bg-clip-text text-transparent mix-blend-overlay"
                      animate={{
                        x: [0, 2, -2, 0],
                        opacity: [0, 0.5, 0, 0.3, 0],
                      }}
                      transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 3 }}
                    >
                      {glitchText}
                    </motion.span>
                  </span>
                </motion.h1>
                
                {/* Animated underline */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 2, duration: 1, ease: "easeOut" }}
                  className="h-1 bg-gradient-to-r from-teal-500 via-cyan-400 to-purple-500 rounded-full mt-4 mx-auto"
                  style={{ maxWidth: "400px" }}
                />
              </motion.div>

              {/* Tagline */}
              {showSolution && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <p className="text-2xl md:text-3xl text-zinc-300 font-light mb-4 leading-relaxed">
                    AI that <span className="text-teal-400 font-semibold">remembers</span> everything,
                    <br />
                    without <span className="text-purple-400 font-semibold">seeing</span> anything.
                  </p>
                  
                  <motion.p 
                    className="text-lg text-zinc-500 max-w-2xl mx-auto mb-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                  >
                    Zero-knowledge proofs meet persistent memory. 
                    Your data stays encrypted. Your context stays perfect.
                  </motion.p>

                  {/* CTA Buttons */}
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.5 }}
                    className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
                  >
                    <motion.button
                      onClick={scrollToDemo}
                      className="group relative px-10 py-5 rounded-2xl font-bold text-lg overflow-hidden"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {/* Animated gradient background */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-500"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        style={{ width: "200%" }}
                      />
                      {/* Glow effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-cyan-500 opacity-0 group-hover:opacity-100 blur-xl transition-opacity" />
                      {/* Button content */}
                      <span className="relative z-10 flex items-center gap-3 text-slate-900">
                        <motion.span
                          animate={{ rotate: [0, 360] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                          🔐
                        </motion.span>
                        <span>Experience Zero-Knowledge</span>
                        <motion.span
                          animate={{ x: [0, 5, 0] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          →
                        </motion.span>
                      </span>
                    </motion.button>
                    
                    <motion.button
                      onClick={() => document.getElementById("problem")?.scrollIntoView({ behavior: "smooth" })}
                      className="group px-8 py-5 rounded-2xl font-semibold text-lg border-2 border-white/10 hover:border-purple-500/50 bg-white/5 hover:bg-purple-500/10 transition-all flex items-center gap-2"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <span>Learn How It Works</span>
                      <motion.span
                        animate={{ y: [0, 3, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        ↓
                      </motion.span>
                    </motion.button>
                  </motion.div>

                  {/* Stats with 3D cards */}
                  <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2 }}
                    className="grid grid-cols-3 gap-4 max-w-3xl mx-auto"
                  >
                    {[
                      { value: "0", label: "Bytes Exposed", icon: "🛡️", gradient: "from-teal-500 to-cyan-500" },
                      { value: "∞", label: "Memory Retained", icon: "🧠", gradient: "from-purple-500 to-pink-500" },
                      { value: "100%", label: "Privacy Guaranteed", icon: "✨", gradient: "from-blue-500 to-indigo-500" },
                    ].map((stat, i) => (
                      <motion.div
                        key={i}
                        className="relative group cursor-pointer"
                        whileHover={{ scale: 1.05, y: -5 }}
                        style={{ perspective: "1000px" }}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} rounded-2xl blur-xl opacity-0 group-hover:opacity-40 transition-opacity`} />
                        <div className="relative p-6 rounded-2xl bg-zinc-900/80 border border-white/10 group-hover:border-white/20 transition-all backdrop-blur-sm">
                          <motion.span 
                            className="text-3xl block mb-2"
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                          >
                            {stat.icon}
                          </motion.span>
                          <div className={`text-3xl md:text-4xl font-black bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                            {stat.value}
                          </div>
                          <div className="text-sm text-zinc-400 mt-1">{stat.label}</div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center cursor-pointer"
          onClick={() => document.getElementById("problem")?.scrollIntoView({ behavior: "smooth" })}
        >
          <span className="text-sm text-zinc-500 mb-2">Scroll to explore</span>
          <div className="w-6 h-10 rounded-full border-2 border-zinc-700 flex justify-center p-2">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-2 bg-teal-500 rounded-full"
            />
          </div>
        </motion.div>
      </motion.div>
      
    </section>
  );
}
