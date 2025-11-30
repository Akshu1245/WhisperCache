import express from 'express'
import cors from 'cors'
import zkRouter from './routes/zk'
import anchorRouter from './routes/anchor'
import blockchainAnchorRouter from './routes/blockchainAnchor'
import complianceRouter from './routes/compliance'
import authRouter from './routes/auth'
import memoryRouter from './routes/memory'
import keysRouter from './routes/keys'
import agentRouter from './routes/agent'
import merkleRouter from './routes/merkle'
import metricsRouter from './routes/metrics'
import orgRouter from './routes/org'
import policiesRouter from './routes/policies'
import gdprRouter from './routes/gdpr'
import { initCrypto } from './lib/crypto'
import { initDatabase, saveDatabase, closeDatabase, getDatabaseStats } from './lib/database'
import { initializeMidnight } from './lib/midnight'
import { initializeBlockchains, getBlockchainStatus } from './blockchain'
import { rateLimit, securityHeaders, cors as corsMiddleware } from './lib/security'
import { errorHandler } from './lib/errors'
import { getLogger, requestLogger } from './lib/logger'
import { performanceMonitor } from './services/performanceMonitor'
import { initProofQueue } from './services/proofJobQueue'

const logger = getLogger()

const app = express()

// Graceful shutdown handler
process.on('SIGINT', () => {
  logger.warn('Shutting down gracefully...')
  saveDatabase()
  closeDatabase()
  process.exit(0)
})

process.on('SIGTERM', () => {
  logger.warn('Received SIGTERM, shutting down...')
  saveDatabase()
  closeDatabase()
  process.exit(0)
})

// Initialize all services
async function initializeServices() {
  try {
    // Initialize cryptography
    await initCrypto()
    logger.info('Cryptography initialized (libsodium ready)')
    
    // Initialize database
    await initDatabase()
    logger.info('Database initialized (SQLite ready)')
    
    // Initialize Midnight network (legacy)
    try {
      await initializeMidnight()
      logger.info('Midnight network connected (devnet)')
    } catch (err) {
      logger.warn('Midnight network not available, using simulation mode')
    }

    // Initialize blockchain services (new)
    try {
      const blockchainStatus = await initializeBlockchains()
      if (blockchainStatus.midnight) {
        logger.info(`Midnight: ${blockchainStatus.midnight.network} @ block ${blockchainStatus.midnight.latestBlock}`)
      }
      if (blockchainStatus.cardano) {
        logger.info(`Cardano: ${blockchainStatus.cardano.network} @ slot ${blockchainStatus.cardano.slot}`)
      }
    } catch (err) {
      logger.warn('Blockchain services not available, using simulation mode')
    }

    // Initialize proof job queue (preload artifacts)
    try {
      await initProofQueue()
      logger.info('Proof queue initialized (artifacts cached)')
    } catch (err) {
      logger.warn('Proof queue init failed, using on-demand loading')
    }
    
    return true
  } catch (err) {
    logger.error('Failed to initialize services:', err instanceof Error ? err : { message: String(err) })
    return false
  }
}

// Start server after initialization
initializeServices().then((success) => {
  if (!success) {
    process.exit(1)
  }
  
  startServer()
}).catch(err => {
  logger.error('Fatal error during startup:', err)
  process.exit(1)
})

function startServer() {
  // Security middleware
  app.use(securityHeaders())
  app.use(requestLogger())
  
  // Rate limiting (100 requests per minute per IP)
  app.use(rateLimit({ maxRequests: 100, windowSeconds: 60 }))
  
  // CORS configuration
  app.use(corsMiddleware())

  app.use(express.json())

  app.use('/api/zk', zkRouter)
  app.use('/api/anchor', blockchainAnchorRouter)  // New blockchain anchor routes
  app.use('/api/anchor/legacy', anchorRouter)      // Keep legacy routes
  app.use('/api/blockchain', blockchainAnchorRouter) // Also expose at /blockchain
  app.use('/api/compliance', complianceRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/memory', memoryRouter)
  app.use('/api/keys', keysRouter)
  app.use('/api/agent', agentRouter)
  app.use('/api/merkle', merkleRouter)
  app.use('/api/metrics', metricsRouter)  // Metrics endpoints
  app.use('/api/org', orgRouter)           // Organization management
  app.use('/api/policies', policiesRouter) // Policy management
  app.use('/api/gdpr', gdprRouter)         // GDPR compliance endpoints
  
  // Prometheus metrics endpoint at root level for scraping
  app.get('/metrics', (_req, res) => {
    try {
      const metrics = performanceMonitor.toPrometheusFormat();
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(metrics);
    } catch (error: any) {
      res.status(500).send(`# Error: ${error.message}`);
    }
  });

  // Simple ready check (instant response)
  app.get('/api/ready', (_req, res) => {
    res.json({ status: 'ok', ready: true, timestamp: new Date().toISOString() });
  });

  // Health check endpoint with database and blockchain stats
  app.get('/api/health', async (_req, res) => {
    try {
      const dbStats = getDatabaseStats()
      const blockchainStatus = await getBlockchainStatus()
      
      res.json({
        status: 'healthy',
        services: {
          crypto: { status: 'ready', algorithm: 'XChaCha20-Poly1305' },
          database: { status: 'ready', type: 'SQLite', ...dbStats },
          midnight: { 
            status: blockchainStatus.midnight?.connected ? 'ready' : 'simulation',
            network: blockchainStatus.midnight?.network || 'devnet',
            block: blockchainStatus.midnight?.latestBlock
          },
          cardano: {
            status: blockchainStatus.cardano?.connected ? 'ready' : 'simulation',
            network: blockchainStatus.cardano?.network || 'preview',
            slot: blockchainStatus.cardano?.slot,
            epoch: blockchainStatus.cardano?.epoch
          }
        },
        blockchain: {
          ready: blockchainStatus.ready,
          midnight: blockchainStatus.midnight ? {
            connected: blockchainStatus.midnight.connected,
            network: blockchainStatus.midnight.network,
            block: blockchainStatus.midnight.latestBlock
          } : null,
          cardano: blockchainStatus.cardano ? {
            connected: blockchainStatus.cardano.connected,
            network: blockchainStatus.cardano.network,
            slot: blockchainStatus.cardano.slot,
            epoch: blockchainStatus.cardano.epoch
          } : null
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      res.json({
        status: 'degraded',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Global error handler (must be last middleware)
  app.use(errorHandler)

  const PORT = process.env.PORT || 4000
  const METRICS_PORT = process.env.METRICS_PORT || 9090
  
  app.listen(PORT, () => {
    console.log('')
    console.log('╔════════════════════════════════════════════════════════════╗')
    console.log('║  🚀 WhisperCache Server fully initialized                  ║')
    console.log('╠════════════════════════════════════════════════════════════╣')
    console.log(`║  Port: ${PORT}                                              ║`)
    console.log('║  Mode: Production (compiled)                               ║')
    console.log('║  Proofs: Cached & ready for demo                           ║')
    console.log('╚════════════════════════════════════════════════════════════╝')
    console.log('')
    console.log('Test server with:')
    console.log(`  curl http://localhost:${PORT}/api/health`)
    console.log(`  curl http://localhost:${PORT}/api/zk/midnight/queue-stats`)
    console.log('')
    logger.info(`WhisperCache Server running on port ${PORT}`)
    logger.info(`API endpoint: http://localhost:${PORT}/api`)
    logger.info(`Health check: http://localhost:${PORT}/api/health`)
    logger.info(`Metrics: http://localhost:${PORT}/metrics`)
    logger.info('Services: XChaCha20-Poly1305, Groth16+Poseidon, SQLite, Midnight (sim), Cardano (sim)')
  })
}
