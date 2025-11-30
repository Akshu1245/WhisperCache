/**
 * DID (Decentralized Identity) Authentication
 * 
 * Provides wallet-based authentication using:
 * - Simple header-based authentication (x-user-id / x-did-wallet)
 * - Organization-scoped access control (x-org-id)
 * - Role-based permissions (ADMIN, MEMBER, AUDITOR)
 * - Ed25519 signatures for authentication challenges (future)
 * - DID document structure for identity management
 * - Session tokens for authenticated requests
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { hashData, generateNonce } from './crypto';
import { 
  findOrCreateUser, 
  User, 
  getUserRole, 
  getUserOrganizations,
  Organization,
  UserRole as UserRoleType
} from './database';

// Extend Express Request to include user and org context
declare global {
  namespace Express {
    interface Request {
      user?: User;
      org?: Organization;
      userRole?: UserRoleType;
    }
  }
}

// ============================================================================
// Simple Header-Based Auth Middleware (DID/Wallet style)
// ============================================================================

/**
 * Simple auth middleware that uses x-user-id or x-did-wallet headers.
 * Creates user on first access.
 */
export function simpleAuthMiddleware(options?: { required?: boolean }) {
  const isRequired = options?.required ?? true;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check for user identification header
    const userId = req.headers['x-user-id'] as string;
    const didWallet = req.headers['x-did-wallet'] as string;
    const identifier = didWallet || userId;

    if (!identifier) {
      if (isRequired) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Provide x-user-id or x-did-wallet header'
        });
      }
      // Create a temporary guest user for optional auth
      const guestId = `guest_${crypto.randomBytes(8).toString('hex')}`;
      req.user = {
        id: guestId,
        didOrWallet: guestId,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      };
      return next();
    }

    try {
      // Find or create user based on identifier
      const user = findOrCreateUser(identifier);
      req.user = user;
      next();
    } catch (error) {
      console.error('[Auth] Error finding/creating user:', error);
      res.status(500).json({
        error: 'Authentication failed',
        message: 'Could not process user identity'
      });
    }
  };
}

/**
 * Optional auth - doesn't require auth but attaches user if header present
 */
export function optionalSimpleAuth() {
  return simpleAuthMiddleware({ required: false });
}

// ============================================================================
// Organization-Scoped Auth Middleware (Multi-tenant)
// ============================================================================

export interface OrgAuthOptions {
  required?: boolean;
  requireOrg?: boolean;
}

/**
 * Organization-aware auth middleware.
 * Resolves user, organization, and role from headers.
 * 
 * Headers:
 * - x-user-id or x-did-wallet: User identifier
 * - x-org-id: Organization ID (optional, defaults to user's default org)
 */
export function orgAuthMiddleware(options?: OrgAuthOptions) {
  const isRequired = options?.required ?? true;
  const requireOrg = options?.requireOrg ?? false;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check for user identification header
    const userId = req.headers['x-user-id'] as string;
    const didWallet = req.headers['x-did-wallet'] as string;
    const orgId = req.headers['x-org-id'] as string;
    const identifier = didWallet || userId;

    if (!identifier) {
      if (isRequired) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Provide x-user-id or x-did-wallet header'
        });
      }
      return next();
    }

    try {
      // Find or create user
      const user = findOrCreateUser(identifier);
      req.user = user;

      // Resolve organization context
      let targetOrgId = orgId || user.defaultOrgId;

      if (targetOrgId) {
        // Get user's role in the org
        const role = getUserRole(user.id, targetOrgId);
        
        if (role) {
          const { getOrganizationById } = await import('./database');
          const org = getOrganizationById(targetOrgId);
          if (org && org.status === 'ACTIVE') {
            req.org = org;
            req.userRole = role.role;
          }
        }
      } else if (!requireOrg) {
        // Try to get user's first org
        const orgs = getUserOrganizations(user.id);
        if (orgs.length > 0) {
          req.org = orgs[0].org;
          req.userRole = orgs[0].role;
        }
      }

      if (requireOrg && !req.org) {
        return res.status(403).json({
          error: 'Organization access required',
          message: 'You must be a member of an organization'
        });
      }

      next();
    } catch (error) {
      console.error('[Auth] Error in org auth:', error);
      res.status(500).json({
        error: 'Authentication failed',
        message: 'Could not process user identity'
      });
    }
  };
}

/**
 * Role requirement middleware.
 * Must be used after orgAuthMiddleware.
 */
export function requireRole(requiredRole: UserRoleType) {
  const roleHierarchy: Record<UserRoleType, number> = {
    'ADMIN': 3,
    'MEMBER': 2,
    'AUDITOR': 1
  };

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!req.org || !req.userRole) {
      return res.status(403).json({
        error: 'Organization membership required'
      });
    }

    if (roleHierarchy[req.userRole] < roleHierarchy[requiredRole]) {
      return res.status(403).json({
        error: `${requiredRole} role required`,
        message: `Your role (${req.userRole}) does not have sufficient permissions`
      });
    }

    next();
  };
}

/**
 * Auditor access check - can read but not modify
 */
export function auditorCannotModify() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.userRole === 'AUDITOR' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return res.status(403).json({
        error: 'Auditors have read-only access',
        message: 'You cannot modify data with Auditor role'
      });
    }
    next();
  };
}

// ============================================================================
// Legacy DID Document Types (W3C DID Core compatible)
// ============================================================================

// DID Document structure (W3C DID Core compatible)
export interface DIDDocument {
  '@context': string[];
  id: string;
  controller: string;
  verificationMethod: VerificationMethod[];
  authentication: string[];
  assertionMethod?: string[];
  created: string;
  updated: string;
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
  publicKeyHex?: string;
}

// Authentication challenge
export interface AuthChallenge {
  challenge: string;
  did: string;
  expiresAt: string;
  nonce: string;
}

// Authentication response
export interface AuthResponse {
  challenge: string;
  signature: string;
  did: string;
}

// Session token
export interface Session {
  token: string;
  did: string;
  keyId: string;
  createdAt: string;
  expiresAt: string;
  permissions: string[];
}

// In-memory stores (in production, use database)
const challenges = new Map<string, AuthChallenge>();
const sessions = new Map<string, Session>();
const didDocuments = new Map<string, DIDDocument>();

// Session expiry time (24 hours)
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;
// Challenge expiry time (5 minutes)
const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Generate a DID from a public key
 * Uses did:key method for simplicity
 */
export function generateDID(publicKeyHex: string): string {
  // did:key method - derive DID from public key
  const keyHash = crypto
    .createHash('sha256')
    .update(publicKeyHex)
    .digest('hex')
    .slice(0, 32);
  
  return `did:midnight:${keyHash}`;
}

/**
 * Create a DID document for a new identity
 */
export async function createDIDDocument(
  publicKeyHex: string,
  controller?: string
): Promise<DIDDocument> {
  const did = generateDID(publicKeyHex);
  const now = new Date().toISOString();
  
  const verificationMethodId = `${did}#key-1`;
  
  const doc: DIDDocument = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://midnight.network/ns/did/v1'
    ],
    id: did,
    controller: controller || did,
    verificationMethod: [
      {
        id: verificationMethodId,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyHex: publicKeyHex
      }
    ],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId],
    created: now,
    updated: now
  };

  // Store DID document
  didDocuments.set(did, doc);

  return doc;
}

/**
 * Resolve a DID to its document
 */
export function resolveDID(did: string): DIDDocument | null {
  return didDocuments.get(did) || null;
}

/**
 * Generate an authentication challenge
 */
export async function generateAuthChallenge(did: string): Promise<AuthChallenge> {
  const nonce = await generateNonce();
  const challenge = await hashData(`${did}:${nonce}:${Date.now()}`);
  const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_MS).toISOString();

  const authChallenge: AuthChallenge = {
    challenge,
    did,
    expiresAt,
    nonce
  };

  // Store challenge
  challenges.set(challenge, authChallenge);

  // Clean up expired challenges periodically
  setTimeout(() => {
    challenges.delete(challenge);
  }, CHALLENGE_EXPIRY_MS);

  return authChallenge;
}

/**
 * Verify an authentication response
 * 
 * In production, this would verify the Ed25519 signature
 * against the public key in the DID document
 */
export async function verifyAuthResponse(
  response: AuthResponse
): Promise<{ valid: boolean; error?: string }> {
  // Get the challenge
  const challenge = challenges.get(response.challenge);
  
  if (!challenge) {
    return { valid: false, error: 'Challenge not found or expired' };
  }

  // Check expiry
  if (new Date(challenge.expiresAt) < new Date()) {
    challenges.delete(response.challenge);
    return { valid: false, error: 'Challenge expired' };
  }

  // Check DID matches
  if (challenge.did !== response.did) {
    return { valid: false, error: 'DID mismatch' };
  }

  // Get DID document for signature verification
  const didDoc = resolveDID(response.did);
  
  if (!didDoc) {
    return { valid: false, error: 'DID not found' };
  }

  // In production, verify Ed25519 signature here
  // For now, we accept any signature with valid format (64 bytes hex = 128 chars)
  if (!response.signature || response.signature.length < 64) {
    return { valid: false, error: 'Invalid signature format' };
  }

  // Signature verification would use:
  // const publicKey = didDoc.verificationMethod[0].publicKeyHex;
  // const isValid = ed25519.verify(signature, challenge, publicKey);

  // Delete used challenge
  challenges.delete(response.challenge);

  return { valid: true };
}

/**
 * Create a session token after successful authentication
 */
export async function createSession(
  did: string,
  permissions: string[] = ['read', 'write']
): Promise<Session> {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MS);

  // Generate key ID for this session
  const keyId = `key_${crypto.randomBytes(8).toString('hex')}`;

  const session: Session = {
    token,
    did,
    keyId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    permissions
  };

  // Store session
  sessions.set(token, session);

  // Auto-expire session
  setTimeout(() => {
    sessions.delete(token);
  }, SESSION_EXPIRY_MS);

  return session;
}

/**
 * Validate a session token
 */
export function validateSession(token: string): Session | null {
  const session = sessions.get(token);
  
  if (!session) {
    return null;
  }

  // Check expiry
  if (new Date(session.expiresAt) < new Date()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

/**
 * Revoke a session
 */
export function revokeSession(token: string): boolean {
  return sessions.delete(token);
}

/**
 * Get all active sessions for a DID
 */
export function getActiveSessions(did: string): Session[] {
  const activeSessions: Session[] = [];
  const now = new Date();

  for (const session of sessions.values()) {
    if (session.did === did && new Date(session.expiresAt) > now) {
      activeSessions.push(session);
    }
  }

  return activeSessions;
}

/**
 * Revoke all sessions for a DID
 */
export function revokeAllSessions(did: string): number {
  let count = 0;
  
  for (const [token, session] of sessions.entries()) {
    if (session.did === did) {
      sessions.delete(token);
      count++;
    }
  }

  return count;
}

/**
 * Check if session has a specific permission
 */
export function hasPermission(session: Session, permission: string): boolean {
  return session.permissions.includes(permission) || session.permissions.includes('admin');
}

/**
 * Express middleware for authentication
 */
export function authMiddleware(requiredPermission?: string) {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.slice(7); // Remove 'Bearer '
    const session = validateSession(token);

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    if (requiredPermission && !hasPermission(session, requiredPermission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Attach session to request
    req.session = session;
    req.did = session.did;
    req.keyId = session.keyId;

    next();
  };
}

/**
 * Optional auth middleware - doesn't require auth but attaches session if present
 */
export function optionalAuthMiddleware() {
  return (req: any, _res: any, next: any) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const session = validateSession(token);
      
      if (session) {
        req.session = session;
        req.did = session.did;
        req.keyId = session.keyId;
      }
    }

    next();
  };
}
