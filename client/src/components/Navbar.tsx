import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

// All navigation items - uniform styling, all clickable
const navItems = [
  { id: "problem", label: "Problem" },
  { id: "solution", label: "Solution" },
  { id: "zk", label: "Demo" },
  { id: "dashboard", label: "Dashboard" },
  { id: "midnight", label: "Tech" },
  { id: "architecture", label: "Arch" },
  { id: "gdpr", label: "GDPR" },
  { id: "cardano", label: "Fun" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      
      // Calculate scroll progress
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalHeight) * 100;
      setScrollProgress(Math.min(progress, 100));
      
      const allSections = navItems.map(item => document.getElementById(item.id));
      const scrollPos = window.scrollY + 200;
      
      for (let i = allSections.length - 1; i >= 0; i--) {
        const section = allSections[i];
        if (section && section.offsetTop <= scrollPos) {
          setActiveSection(navItems[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Press 1-8 to navigate to sections
      const num = parseInt(e.key);
      if (num >= 1 && num <= 8 && navItems[num - 1]) {
        scrollTo(navItems[num - 1].id);
      }
      // Press Escape to close mobile menu
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
      // Press Home to scroll to top
      if (e.key === 'Home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  };

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
          scrolled ? "py-2" : "py-3"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-2xl transition-all duration-300 ${
            scrolled 
              ? "bg-black/90 backdrop-blur-xl border border-white/10 shadow-lg" 
              : "bg-black/50 backdrop-blur-md border border-white/5"
          }`}>
            {/* Logo - Clickable */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              {/* Animated Logo Icon */}
              <div className="relative">
                <motion.div 
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 via-cyan-500 to-purple-500 flex items-center justify-center shadow-lg shadow-teal-500/25"
                  animate={{ 
                    boxShadow: [
                      "0 4px 20px rgba(20, 184, 166, 0.3)",
                      "0 4px 30px rgba(20, 184, 166, 0.5)",
                      "0 4px 20px rgba(20, 184, 166, 0.3)"
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  {/* Brain + Lock combined icon */}
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
                    {/* Brain outline */}
                    <path 
                      d="M12 4C8 4 5 7 5 10.5C5 12.5 6 14 7.5 15C7.5 17 9 19 12 19C15 19 16.5 17 16.5 15C18 14 19 12.5 19 10.5C19 7 16 4 12 4Z" 
                      stroke="currentColor" 
                      strokeWidth="1.5" 
                      strokeLinecap="round"
                    />
                    {/* Lock keyhole in center */}
                    <circle cx="12" cy="11" r="2" fill="currentColor" />
                    <path d="M12 13V15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    {/* Neural connections */}
                    <path d="M8 9C8 9 9 10 10 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
                    <path d="M16 9C16 9 15 10 14 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
                  </svg>
                </motion.div>
                {/* Pulse ring */}
                <motion.div
                  className="absolute inset-0 rounded-xl border-2 border-teal-400/50"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                />
              </div>
              
              {/* Logo Text */}
              <div className="hidden sm:flex flex-col">
                <span className="font-black text-lg tracking-tight bg-gradient-to-r from-teal-300 via-cyan-300 to-purple-400 bg-clip-text text-transparent group-hover:from-teal-200 group-hover:to-purple-300 transition-all">
                  WhisperCache
                </span>
                <span className="text-[10px] text-zinc-500 font-medium tracking-widest uppercase -mt-0.5">
                  Private AI Memory
                </span>
              </div>
            </motion.div>

            {/* Nav Links - Desktop - All uniform */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative px-3 py-1.5 text-sm font-medium transition-all rounded-lg ${
                    activeSection === item.id
                      ? "text-teal-400 bg-teal-500/10"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.label}
                  {activeSection === item.id && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-teal-400 rounded-full"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </motion.button>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Scroll Progress Bar */}
        {scrolled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5"
          >
            <motion.div
              className="h-full bg-gradient-to-r from-teal-500 to-purple-500"
              style={{ width: `${scrollProgress}%` }}
              transition={{ duration: 0.1 }}
            />
          </motion.div>
        )}
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            
            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-16 left-4 right-4 z-50 p-4 rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-white/10 lg:hidden shadow-2xl"
            >
              <div className="grid grid-cols-2 gap-2">
                {navItems.map((item, i) => (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => scrollTo(item.id)}
                    className={`flex items-center justify-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      activeSection === item.id
                        ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                        : "text-zinc-300 hover:text-white hover:bg-white/5 border border-white/5"
                    }`}
                  >
                    {item.label}
                  </motion.button>
                ))}
              </div>
              
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
