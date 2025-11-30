import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

/**
 * Floating Action Button (FAB)
 * 
 * Psychology-based quick navigation:
 * - For JUDGES: Quick access to demo, tech sections
 * - For USERS: Easy navigation to key features
 * - For BUILDERS: Dashboard and admin shortcuts
 * 
 * Positioned bottom-right for easy thumb access on mobile
 */

const quickLinks = [
  { id: "zk", label: "Live Demo", icon: "⚡", color: "from-teal-500 to-cyan-500", primary: true },
  { id: "dashboard", label: "Dashboard", icon: "📊", color: "from-purple-500 to-pink-500" },
  { id: "midnight", label: "Tech", icon: "🔐", color: "from-blue-500 to-indigo-500" },
  { id: "problem", label: "Why?", icon: "💡", color: "from-orange-500 to-amber-500" },
];

export default function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [currentSection, setCurrentSection] = useState("");

  // Show FAB after scrolling down
  useEffect(() => {
    const handleScroll = () => {
      setShowButton(window.scrollY > 300);
      
      // Update current section
      const sections = ["problem", "solution", "zk", "dashboard", "admin", "midnight", "vault", "future", "cardano"];
      const scrollPos = window.scrollY + window.innerHeight / 2;
      
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i]);
        if (section && section.offsetTop <= scrollPos) {
          setCurrentSection(sections[i]);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setIsOpen(false);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {showButton && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
        >
          {/* Expanded menu */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="flex flex-col gap-2 mb-2"
              >
                {/* Quick links */}
                {quickLinks.map((link, i) => (
                  <motion.button
                    key={link.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => scrollTo(link.id)}
                    className={`flex items-center gap-3 pl-4 pr-5 py-2.5 rounded-full bg-gradient-to-r ${link.color} shadow-lg hover:shadow-xl transition-shadow group`}
                  >
                    <span className="text-lg">{link.icon}</span>
                    <span className="text-sm font-semibold text-white whitespace-nowrap">
                      {link.label}
                    </span>
                    {link.id === currentSection && (
                      <span className="w-2 h-2 rounded-full bg-white/50 animate-pulse" />
                    )}
                  </motion.button>
                ))}

                {/* Scroll to top */}
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: quickLinks.length * 0.05 }}
                  onClick={scrollToTop}
                  className="flex items-center gap-3 pl-4 pr-5 py-2.5 rounded-full bg-zinc-800 border border-white/10 shadow-lg hover:bg-zinc-700 transition-colors"
                >
                  <span className="text-lg">⬆️</span>
                  <span className="text-sm font-medium text-white">Back to Top</span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main FAB button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(!isOpen)}
            className={`relative w-14 h-14 rounded-full shadow-lg transition-all duration-300 ${
              isOpen 
                ? "bg-zinc-800 border border-white/10" 
                : "bg-gradient-to-r from-teal-500 to-cyan-500 shadow-teal-500/30"
            }`}
          >
            {/* Pulse ring */}
            {!isOpen && (
              <motion.div
                className="absolute inset-0 rounded-full bg-teal-500"
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            
            <div className="relative z-10 flex items-center justify-center w-full h-full">
              <motion.span
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-2xl"
              >
                {isOpen ? "✕" : "🚀"}
              </motion.span>
            </div>
          </motion.button>

          {/* Tooltip hint */}
          {!isOpen && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1 }}
              className="absolute bottom-0 right-16 bg-zinc-900 border border-white/10 px-3 py-1.5 rounded-lg shadow-lg"
            >
              <span className="text-xs text-zinc-300 whitespace-nowrap">Quick Navigate</span>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-zinc-900 border-r border-t border-white/10 rotate-45" />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
