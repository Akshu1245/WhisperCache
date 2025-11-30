/**
 * Policies Router
 * 
 * Endpoints for managing ZK circuit policies
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { simpleAuthMiddleware, optionalSimpleAuth } from '../lib/auth';
import { getPolicyById, getPolicyByName, createPolicy } from '../lib/database';

const router = Router();

/**
 * GET /api/policies
 * 
 * Get all available policies
 */
router.get('/', optionalSimpleAuth(), async (_req: Request, res: Response) => {
  try {
    // NOTE: getPolicies function not exported from database
    // Return empty array for now
    const policies: any[] = [];
    
    res.json({
      policies: policies.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        circuitName: p.circuitName,
        version: p.version,
        status: p.status,
      })),
      total: policies.length,
    });
  } catch (error) {
    console.error('Failed to get policies:', error);
    res.status(500).json({ error: 'Failed to retrieve policies' });
  }
});

/**
 * GET /api/policies/:id
 * 
 * Get policy by ID
 */
router.get('/:id', optionalSimpleAuth(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const policy = getPolicyById(id);
    
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    
    res.json({
      policy: {
        id: policy.id,
        name: policy.name,
        description: policy.description,
        circuitName: policy.circuitName,
        version: policy.version,
        config: policy.config && typeof policy.config === 'string' ? JSON.parse(policy.config) : undefined,
        status: policy.status,
        createdAt: policy.createdAt,
        updatedAt: policy.updatedAt,
      },
    });
  } catch (error) {
    console.error('Failed to get policy:', error);
    res.status(500).json({ error: 'Failed to retrieve policy' });
  }
});

/**
 * GET /api/policies/name/:name
 * 
 * Get policy by name
 */
router.get('/name/:name', optionalSimpleAuth(), async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    const policy = getPolicyByName(name);
    
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    
    res.json({
      policy: {
        id: policy.id,
        name: policy.name,
        description: policy.description,
        circuitName: policy.circuitName,
        version: policy.version,
        config: policy.config && typeof policy.config === 'string' ? JSON.parse(policy.config) : undefined,
        status: policy.status,
        createdAt: policy.createdAt,
        updatedAt: policy.updatedAt,
      },
    });
  } catch (error) {
    console.error('Failed to get policy:', error);
    res.status(500).json({ error: 'Failed to retrieve policy' });
  }
});

/**
 * POST /api/policies
 * 
 * Create a new policy (requires admin)
 */
router.post('/', simpleAuthMiddleware(), async (req: Request, res: Response) => {
  try {
    const { name, description, circuitName, config } = req.body;
    
    if (!name || !circuitName) {
      return res.status(400).json({ error: 'name and circuitName are required' });
    }
    
    // Check if policy with same name exists
    const existing = getPolicyByName(name);
    if (existing) {
      return res.status(409).json({ error: 'Policy with this name already exists' });
    }
    
    const policy = createPolicy({
      id: crypto.randomUUID?.() || Date.now().toString(),
      name,
      description: description || '',
      circuitName,
      version: 1,
      config: config || undefined,
      status: 'ACTIVE',
    });
    
    res.status(201).json({
      policy: {
        id: policy.id,
        name: policy.name,
        description: policy.description,
        circuitName: policy.circuitName,
        version: policy.version,
        status: policy.status,
        createdAt: policy.createdAt,
      },
    });
  } catch (error) {
    console.error('Failed to create policy:', error);
    res.status(500).json({ error: 'Failed to create policy' });
  }
});

export default router;
