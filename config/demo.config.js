/**
 * WhisperCache Production Config
 * 
 * Optimized settings for demo - no hot reload, no watch modes
 */

module.exports = {
  // Server settings
  server: {
    port: 4000,
    host: '0.0.0.0',
    
    // Disable development features
    hotReload: false,
    watchMode: false,
    
    // Production optimizations
    compression: true,
    cacheControl: true,
    
    // Timeouts
    requestTimeout: 30000,
    keepAliveTimeout: 65000
  },
  
  // ZK Proof settings
  zk: {
    // Pre-compute proofs on startup
    precompute: true,
    
    // Cache size (number of proofs)
    cacheSize: 100,
    
    // Use cached proofs when available
    useCache: true,
    
    // Fallback to instant mock if real proof takes too long
    fallbackTimeout: 5000,
    
    // Always use simulation for demo stability
    forceSimulation: true
  },
  
  // Blockchain settings
  blockchain: {
    // Use simulation for demo (no network delays)
    midnight: {
      mode: 'simulation',
      network: 'devnet'
    },
    cardano: {
      mode: 'simulation', 
      network: 'preview'
    }
  },
  
  // Database settings
  database: {
    // Use in-memory for speed
    type: 'memory',
    
    // Persist to file on shutdown
    persistOnShutdown: true,
    
    // Pre-seed with demo data
    seedDemoData: true
  },
  
  // Logging
  logging: {
    level: 'warn',  // Reduce log noise during demo
    console: true,
    file: false
  }
};
