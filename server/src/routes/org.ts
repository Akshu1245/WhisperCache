/**
 * Organization Routes
 * 
 * Multi-tenant organization management:
 * - Create and manage organizations
 * - User roles and membership
 * - Organization-scoped data access
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  createOrganization,
  getOrganizationById,
  getOrganizationBySlug,
  updateOrganization,
  listOrganizations,
  assignUserRole,
  getUserRole,
  getUserOrganizations,
  getOrganizationMembers,
  removeUserFromOrg,
  countMemoriesByOrgId,
  countProofsByOrgId,
  countAnchorsByOrgId,
  getComplianceLogsByOrgId,
  getAnchorsByOrgId,
  getLatestLogHash,
  Organization,
  UserRole
} from '../lib/database';
import { simpleAuthMiddleware } from '../lib/auth';
import { hashData, generateNonce } from '../lib/crypto';

const router = Router();

// ============================================================================
// Organization Management
// ============================================================================

/**
 * POST /api/org
 * Create a new organization
 * 
 * For bootstrap: First user becomes ADMIN
 * After bootstrap: Requires ADMIN role in an existing org
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, slug } = req.body;
    const userIdentifier = req.headers['x-user-id'] as string || req.headers['x-did-wallet'] as string;

    if (!name || !slug) {
      return res.status(400).json({
        error: 'name and slug are required'
      });
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({
        error: 'slug must be lowercase alphanumeric with hyphens only'
      });
    }

    // Check if slug already exists
    const existing = getOrganizationBySlug(slug);
    if (existing) {
      return res.status(409).json({
        error: 'Organization with this slug already exists'
      });
    }

    // Create organization
    const orgId = `org_${crypto.randomBytes(12).toString('hex')}`;
    const org = createOrganization({
      id: orgId,
      name,
      slug,
      status: 'ACTIVE'
    });

    // If user is authenticated, make them admin
    if (userIdentifier) {
      const { findOrCreateUser } = await import('../lib/database');
      const user = findOrCreateUser(userIdentifier, orgId);
      assignUserRole(user.id, orgId, 'ADMIN');
    }

    res.status(201).json({
      success: true,
      organization: org
    });
  } catch (error) {
    console.error('[Org] Error creating organization:', error);
    res.status(500).json({
      error: 'Failed to create organization'
    });
  }
});

/**
 * GET /api/org/me
 * Get current user's organization and role info
 */
router.get('/me', simpleAuthMiddleware({ required: true }), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const orgs = getUserOrganizations(user.id);

    // Get current org context (from header or default)
    const requestedOrgId = req.headers['x-org-id'] as string;
    let currentOrg = null;
    let currentRole: UserRole | null = null;

    if (requestedOrgId) {
      const orgData = orgs.find(o => o.org.id === requestedOrgId);
      if (orgData) {
        currentOrg = orgData.org;
        currentRole = orgData.role;
      }
    } else if (user.defaultOrgId) {
      const orgData = orgs.find(o => o.org.id === user.defaultOrgId);
      if (orgData) {
        currentOrg = orgData.org;
        currentRole = orgData.role;
      }
    } else if (orgs.length > 0) {
      currentOrg = orgs[0].org;
      currentRole = orgs[0].role;
    }

    res.json({
      user: {
        id: user.id,
        didOrWallet: user.didOrWallet,
        defaultOrgId: user.defaultOrgId
      },
      currentOrganization: currentOrg,
      currentRole,
      organizations: orgs.map(o => ({
        ...o.org,
        role: o.role
      }))
    });
  } catch (error) {
    console.error('[Org] Error fetching user org info:', error);
    res.status(500).json({
      error: 'Failed to fetch organization info'
    });
  }
});

/**
 * GET /api/org/:orgId
 * Get organization details
 */
router.get('/:orgId', simpleAuthMiddleware({ required: true }), async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const user = req.user!;

    // Check user has access to this org
    const role = getUserRole(user.id, orgId);
    if (!role) {
      return res.status(403).json({
        error: 'You do not have access to this organization'
      });
    }

    const org = getOrganizationById(orgId);
    if (!org) {
      return res.status(404).json({
        error: 'Organization not found'
      });
    }

    res.json({
      organization: org,
      role: role.role
    });
  } catch (error) {
    console.error('[Org] Error fetching organization:', error);
    res.status(500).json({
      error: 'Failed to fetch organization'
    });
  }
});

/**
 * GET /api/org/:orgId/dashboard
 * Get organization dashboard stats
 */
router.get('/:orgId/dashboard', simpleAuthMiddleware({ required: true }), async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const user = req.user!;

    // Check user has access
    const role = getUserRole(user.id, orgId);
    if (!role) {
      return res.status(403).json({
        error: 'You do not have access to this organization'
      });
    }

    const org = getOrganizationById(orgId);
    if (!org) {
      return res.status(404).json({
        error: 'Organization not found'
      });
    }

    // Get stats
    const memoriesCount = countMemoriesByOrgId(orgId);
    const proofsCount = countProofsByOrgId(orgId);
    const anchorsCount = countAnchorsByOrgId(orgId);
    const members = getOrganizationMembers(orgId);

    // Get latest anchor for Merkle root info
    const latestAnchors = getAnchorsByOrgId(orgId, { limit: 1 });
    const latestAnchor = latestAnchors[0] || null;

    // Get latest log hash
    const latestLogHash = getLatestLogHash();

    res.json({
      organization: org,
      stats: {
        totalMemories: memoriesCount,
        totalProofs: proofsCount,
        totalAnchors: anchorsCount,
        totalMembers: members.length
      },
      latestAnchor: latestAnchor ? {
        txHash: latestAnchor.txHash,
        midnightTxId: (latestAnchor as any).midnightTxId,
        cardanoTxId: (latestAnchor as any).cardanoTxId,
        network: latestAnchor.network,
        createdAt: latestAnchor.createdAt,
        status: latestAnchor.status
      } : null,
      latestMerkleRoot: latestLogHash,
      role: role.role
    });
  } catch (error) {
    console.error('[Org] Error fetching dashboard:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard'
    });
  }
});

/**
 * GET /api/org/:orgId/members
 * List organization members (ADMIN only)
 */
router.get('/:orgId/members', simpleAuthMiddleware({ required: true }), async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const user = req.user!;

    // Check user has ADMIN access
    const role = getUserRole(user.id, orgId);
    if (!role || role.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Admin access required'
      });
    }

    const members = getOrganizationMembers(orgId);

    res.json({
      members: members.map(m => ({
        userId: m.user.id,
        didOrWallet: m.user.didOrWallet,
        role: m.role,
        createdAt: m.user.createdAt,
        lastSeenAt: m.user.lastSeenAt
      }))
    });
  } catch (error) {
    console.error('[Org] Error fetching members:', error);
    res.status(500).json({
      error: 'Failed to fetch members'
    });
  }
});

/**
 * POST /api/org/:orgId/members
 * Add or update member (ADMIN only)
 */
router.post('/:orgId/members', simpleAuthMiddleware({ required: true }), async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { userId, didOrWallet, role } = req.body;
    const currentUser = req.user!;

    // Validate role
    if (!role || !['ADMIN', 'MEMBER', 'AUDITOR'].includes(role)) {
      return res.status(400).json({
        error: 'Valid role required (ADMIN, MEMBER, AUDITOR)'
      });
    }

    // Check current user has ADMIN access
    const currentRole = getUserRole(currentUser.id, orgId);
    if (!currentRole || currentRole.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Admin access required'
      });
    }

    // Find or create the target user
    let targetUserId = userId;
    if (!targetUserId && didOrWallet) {
      const { findOrCreateUser } = await import('../lib/database');
      const targetUser = findOrCreateUser(didOrWallet);
      targetUserId = targetUser.id;
    }

    if (!targetUserId) {
      return res.status(400).json({
        error: 'userId or didOrWallet required'
      });
    }

    // Assign role
    const userRole = assignUserRole(targetUserId, orgId, role as UserRole);

    res.status(201).json({
      success: true,
      membership: userRole
    });
  } catch (error) {
    console.error('[Org] Error adding member:', error);
    res.status(500).json({
      error: 'Failed to add member'
    });
  }
});

/**
 * DELETE /api/org/:orgId/members/:memberId
 * Remove member from org (ADMIN only)
 */
router.delete('/:orgId/members/:memberId', simpleAuthMiddleware({ required: true }), async (req: Request, res: Response) => {
  try {
    const { orgId, memberId } = req.params;
    const currentUser = req.user!;

    // Check current user has ADMIN access
    const currentRole = getUserRole(currentUser.id, orgId);
    if (!currentRole || currentRole.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Admin access required'
      });
    }

    // Can't remove yourself if you're the only admin
    if (memberId === currentUser.id) {
      const members = getOrganizationMembers(orgId);
      const adminCount = members.filter(m => m.role === 'ADMIN').length;
      if (adminCount <= 1) {
        return res.status(400).json({
          error: 'Cannot remove the only admin'
        });
      }
    }

    removeUserFromOrg(memberId, orgId);

    res.json({
      success: true
    });
  } catch (error) {
    console.error('[Org] Error removing member:', error);
    res.status(500).json({
      error: 'Failed to remove member'
    });
  }
});

/**
 * GET /api/org/:orgId/compliance-logs
 * Get compliance logs for org (ADMIN or AUDITOR)
 */
router.get('/:orgId/compliance-logs', simpleAuthMiddleware({ required: true }), async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { userId, action, entityType, startDate, endDate, limit, offset } = req.query;
    const currentUser = req.user!;

    // Check user has ADMIN or AUDITOR access
    const role = getUserRole(currentUser.id, orgId);
    if (!role || (role.role !== 'ADMIN' && role.role !== 'AUDITOR')) {
      return res.status(403).json({
        error: 'Admin or Auditor access required'
      });
    }

    const logs = getComplianceLogsByOrgId(orgId, {
      userId: userId as string,
      action: action as string,
      entityType: entityType as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string) : 100,
      offset: offset ? parseInt(offset as string) : 0
    });

    res.json({
      logs,
      count: logs.length
    });
  } catch (error) {
    console.error('[Org] Error fetching compliance logs:', error);
    res.status(500).json({
      error: 'Failed to fetch compliance logs'
    });
  }
});

/**
 * GET /api/org/:orgId/anchors
 * Get anchor transactions for org
 */
router.get('/:orgId/anchors', simpleAuthMiddleware({ required: true }), async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { limit, offset } = req.query;
    const currentUser = req.user!;

    // Check user has access
    const role = getUserRole(currentUser.id, orgId);
    if (!role) {
      return res.status(403).json({
        error: 'You do not have access to this organization'
      });
    }

    const anchors = getAnchorsByOrgId(orgId, {
      limit: limit ? parseInt(limit as string) : 100,
      offset: offset ? parseInt(offset as string) : 0
    });

    res.json({
      anchors: anchors.map(a => ({
        id: a.id,
        txHash: a.txHash,
        midnightTxId: (a as any).midnightTxId,
        cardanoTxId: (a as any).cardanoTxId,
        proofHash: a.proofHash,
        memoryHash: a.memoryHash,
        network: a.network,
        status: a.status,
        createdAt: a.createdAt,
        confirmedAt: a.confirmedAt
      })),
      count: anchors.length
    });
  } catch (error) {
    console.error('[Org] Error fetching anchors:', error);
    res.status(500).json({
      error: 'Failed to fetch anchors'
    });
  }
});

export default router;
