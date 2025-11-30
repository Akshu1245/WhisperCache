import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#08080c] flex items-center justify-center p-4">
      <div className="text-center max-w-xl">
        {/* Animated 404 */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.8 }}
          className="mb-8"
        >
          <div className="relative inline-block">
            {/* Glowing background */}
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-purple-500/20 blur-3xl" />
            
            {/* 404 Text */}
            <h1 className="relative text-[120px] md:text-[180px] font-black leading-none">
              <span className="bg-gradient-to-br from-teal-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent">
                4
              </span>
              <motion.span
                animate={{ 
                  rotateY: [0, 360],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="inline-block bg-gradient-to-br from-purple-400 via-pink-400 to-teal-400 bg-clip-text text-transparent"
              >
                0
              </motion.span>
              <span className="bg-gradient-to-br from-cyan-400 via-teal-400 to-purple-500 bg-clip-text text-transparent">
                4
              </span>
            </h1>
          </div>
        </motion.div>

        {/* Lock Icon */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-teal-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-teal-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Page Not Found
          </h2>
          <p className="text-zinc-400 mb-8 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved. 
            Your privacy is still protected though!
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <a
            href="/"
            className="px-8 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 rounded-xl text-white font-semibold transition-all hover:scale-105 shadow-lg shadow-teal-500/25"
          >
            Go Home
          </a>
          <button
            onClick={() => window.history.back()}
            className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-zinc-300 font-medium transition-all hover:scale-105"
          >
            Go Back
          </button>
        </motion.div>

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-teal-500/30 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
