import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Disable HMR for demo stability
    hmr: process.env.NODE_ENV === 'production' ? false : true
  },
  build: {
    // Optimize for production
    minify: 'terser',
    sourcemap: false,
    // Reduce chunk warnings
    chunkSizeWarningLimit: 1000
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['framer-motion', 'react', 'react-dom']
  }
})
