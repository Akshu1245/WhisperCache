/**
 * Authentication Routes
 * 
 * Provides DID-based authentication endpoints:
 * - DID registration and resolution
 * - Challenge-response authentication
 * - Session management
 */

import { Router, Request, Response } from 'express';
import {
  createDIDDocument,
  resolveDID,
  generateAuthChallenge,
  verifyAuthResponse,
  createSession,
  validateSession,
  revokeSession,
  revokeAllSessions,
  getActiveSessions,
  generateDID,
  authMiddleware,
  DIDDocument,
  AuthChallenge,
  Session
} from '../lib/auth';
import { insertComplianceLog, getLatestLogHash } from '../lib/database';
import { hashData, generateNonce } from '../lib/crypto';

const router = Router();

/**
 * POST /api/auth/register
 * 
 * Register a new DID with a public key
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { publicKey, controller } = req.body;

    if (!publicKey) {
      return res.status(400).json({
        error: 'publicKey is required'
      });
    }

    // Validate public key format (expect hex string)
    if (!/^[0-9a-fA-F]{64}$/.test(publicKey)) {
      return res.status(400).json({
        error: 'Invalid public key format. Expected 64 character hex string.'
      });
    }

    // Create DID document
    const didDoc: DIDDocument = await createDIDDocument(publicKey, controller);

    // Log registration
    const logId = `log_${await generateNonce()}`.slice(0, 24);
    const previousLogHash = getLatestLogHash();
    const logHash = await hashData(JSON.stringify({
      id: logId,
      action: 'create',
      keyId: didDoc.id,
      timestamp: new Date().toISOString(),
      previousLogHash
    }));

    insertComplianceLog({
      id: logId,
      action: 'create',
      keyId: didDoc.id,
      timestamp: new Date().toISOString(),
      metadata: { event: 'did_registered' },
      previousLogHash,
      logHash
    });

    res.status(201).json({
      success: true,
      did: didDoc.id,
      document: didDoc
    });
  } catch (error) {
    console.error('DID registration error:', error);
    res.status(500).json({
      error: 'Failed to register DID'
    });
  }
});

/**
 * GET /api/auth/resolve/:did
 * 
 * Resolve a DID to its document
 */
router.get('/resolve/:did', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;

    const didDoc = resolveDID(did);

    if (!didDoc) {
      return res.status(404).json({
        error: 'DID not found'
      });
    }

    res.json({
      document: didDoc
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to resolve DID'
    });
  }
});

/**
 * POST /api/auth/challenge
 * 
 * Generate an authentication challenge for a DID
 */
router.post('/challenge', async (req: Request, res: Response) => {
  try {
    const { did } = req.body;

    if (!did) {
      return res.status(400).json({
        error: 'did is required'
      });
    }

    // Check if DID exists
    const didDoc = resolveDID(did);
    if (!didDoc) {
      return res.status(404).json({
        error: 'DID not found. Please register first.'
      });
    }

    // Generate challenge
    const challenge: AuthChallenge = await generateAuthChallenge(did);

    res.json({
      challenge: challenge.challenge,
      expiresAt: challenge.expiresAt,
      message: 'Sign this challenge with your private key'
    });
  } catch (error) {
    console.error('Challenge generation error:', error);
    res.status(500).json({
      error: 'Failed to generate challenge'
    });
  }
});

/**
 * POST /api/auth/authenticate
 * 
 * Authenticate with a signed challenge
 */
router.post('/authenticate', async (req: Request, res: Response) => {
  try {
    const { challenge, signature, did } = req.body;

    if (!challenge || !signature || !did) {
      return res.status(400).json({
        error: 'challenge, signature, and did are required'
      });
    }

    // Verify authentication
    const result = await verifyAuthResponse({ challenge, signature, did });

    if (!result.valid) {
      return res.status(401).json({
        error: result.error || 'Authentication failed'
      });
    }

    // Create session
    const session: Session = await createSession(did);

    // Log authentication
    const logId = `log_${await generateNonce()}`.slice(0, 24);
    const previousLogHash = getLatestLogHash();
    const logHash = await hashData(JSON.stringify({
      id: logId,
      action: 'access',
      keyId: did,
      timestamp: new Date().toISOString(),
      previousLogHash
    }));

    insertComplianceLog({
      id: logId,
      action: 'access',
      keyId: did,
      timestamp: new Date().toISOString(),
      metadata: { event: 'authentication_success', keyId: session.keyId },
      previousLogHash,
      logHash
    });

    res.json({
      success: true,
      token: session.token,
      keyId: session.keyId,
      expiresAt: session.expiresAt,
      permissions: session.permissions
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed'
    });
  }
});

/**
 * POST /api/auth/logout
 * 
 * Logout (revoke current session)
 */
router.post('/logout', authMiddleware(), async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.slice(7);
    
    if (token) {
      revokeSession(token);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Logout failed'
    });
  }
});

/**
 * POST /api/auth/logout-all
 * 
 * Logout from all devices (revoke all sessions for DID)
 */
router.post('/logout-all', authMiddleware(), async (req: any, res: Response) => {
  try {
    const did = req.did;
    const count = revokeAllSessions(did);

    // Log logout
    const logId = `log_${await generateNonce()}`.slice(0, 24);
    const previousLogHash = getLatestLogHash();
    const logHash = await hashData(JSON.stringify({
      id: logId,
      action: 'access',
      keyId: did,
      timestamp: new Date().toISOString(),
      previousLogHash
    }));

    insertComplianceLog({
      id: logId,
      action: 'access',
      keyId: did,
      timestamp: new Date().toISOString(),
      metadata: { event: 'logout_all', sessionsRevoked: count },
      previousLogHash,
      logHash
    });

    res.json({
      success: true,
      sessionsRevoked: count
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to logout from all devices'
    });
  }
});

/**
 * GET /api/auth/sessions
 * 
 * Get all active sessions for the authenticated DID
 */
router.get('/sessions', authMiddleware(), async (req: any, res: Response) => {
  try {
    const did = req.did;
    const sessions = getActiveSessions(did);

    res.json({
      count: sessions.length,
      sessions: sessions.map(s => ({
        keyId: s.keyId,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        permissions: s.permissions,
        // Don't expose full token
        tokenPrefix: s.token.slice(0, 8) + '...'
      }))
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get sessions'
    });
  }
});

/**
 * GET /api/auth/me
 * 
 * Get current session info
 */
router.get('/me', authMiddleware(), async (req: any, res: Response) => {
  try {
    const session = req.session;
    const didDoc = resolveDID(session.did);

    res.json({
      did: session.did,
      keyId: session.keyId,
      permissions: session.permissions,
      expiresAt: session.expiresAt,
      document: didDoc
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get user info'
    });
  }
});

/**
 * POST /api/auth/refresh
 * 
 * Refresh session token (extends expiry)
 */
router.post('/refresh', authMiddleware(), async (req: any, res: Response) => {
  try {
    const oldSession = req.session;
    const token = req.headers.authorization?.slice(7);

    // Revoke old session
    if (token) {
      revokeSession(token);
    }

    // Create new session
    const newSession = await createSession(oldSession.did, oldSession.permissions);

    res.json({
      success: true,
      token: newSession.token,
      keyId: newSession.keyId,
      expiresAt: newSession.expiresAt
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to refresh session'
    });
  }
});

/**
 * POST /api/auth/demo
 * 
 * Demo authentication (for development/testing only)
 * Creates a temporary DID and session
 */
router.post('/demo', async (_req: Request, res: Response) => {
  try {
    // Generate demo public key
    const demoPublicKey = require('crypto').randomBytes(32).toString('hex');
    
    // Create DID document
    const didDoc = await createDIDDocument(demoPublicKey);
    
    // Create session immediately (skip challenge for demo)
    const session = await createSession(didDoc.id, ['read', 'write', 'prove']);

    res.json({
      success: true,
      message: 'Demo session created. This is for testing only.',
      did: didDoc.id,
      token: session.token,
      keyId: session.keyId,
      expiresAt: session.expiresAt,
      permissions: session.permissions
    });
  } catch (error) {
    console.error('Demo auth error:', error);
    res.status(500).json({
      error: 'Failed to create demo session'
    });
  }
});

export default router;
