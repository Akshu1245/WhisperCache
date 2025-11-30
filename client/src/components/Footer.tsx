import { motion } from "framer-motion";

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      viewport={{ once: true }}
      className="py-24 px-8 max-w-4xl mx-auto text-center"
    >
      <h2 className="text-4xl md:text-5xl font-bold mb-6">
        The Future of Private AI
      </h2>
      
      <p className="text-xl md:text-2xl text-gray-600 mb-12">
        WhisperCache lets AI remember you — without ever exposing you. Your story stays yours.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="text-2xl mb-2">🌙</div>
          <div className="font-bold text-lg">Built on Midnight</div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="text-2xl mb-2">🔐</div>
          <div className="font-bold text-lg">Powered by Zero-Knowledge Proofs</div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="text-2xl mb-2">⚡</div>
          <div className="font-bold text-lg">Ready for AI Integration</div>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        onClick={scrollToTop}
        className="px-8 py-4 bg-black text-white rounded-full text-lg font-medium"
      >
        Watch the Live Demo →
      </motion.button>
    </motion.div>
  );
}
