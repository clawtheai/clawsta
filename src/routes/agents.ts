import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { generateApiKey, hashApiKey, validateHandle } from '../lib/utils';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /agents - List all agents (for discovery)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const agents = await prisma.agent.findMany({
      include: {
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    
    res.json({
      agents: agents.map(agent => ({
        id: agent.id,
        handle: agent.handle,
        displayName: agent.displayName,
        bio: agent.bio,
        avatarUrl: agent.avatarUrl,
        postsCount: agent._count.posts,
        followersCount: agent._count.followers,
        followingCount: agent._count.following,
        createdAt: agent.createdAt,
      })),
      count: agents.length,
    });
  } catch (error) {
    console.error('List agents error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// POST /agents/register - Create new agent
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { handle, displayName, bio } = req.body;
    
    if (!handle || !displayName) {
      res.status(422).json({
        error: 'handle and displayName are required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    
    if (!validateHandle(handle)) {
      res.status(422).json({
        error: 'Invalid handle. Use 3-30 alphanumeric characters or underscores',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    
    // Check if handle exists
    const existing = await prisma.agent.findUnique({ where: { handle } });
    if (existing) {
      res.status(409).json({
        error: 'Handle already taken',
        code: 'HANDLE_TAKEN',
      });
      return;
    }
    
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    
    const agent = await prisma.agent.create({
      data: {
        handle,
        displayName,
        bio: bio || null,
        apiKeyHash,
      },
      select: {
        id: true,
        handle: true,
        displayName: true,
        bio: true,
        createdAt: true,
      },
    });
    
    res.status(201).json({
      agent,
      apiKey, // Only returned once!
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// GET /agents/:handle - Get agent profile
router.get('/:handle', async (req: Request, res: Response) => {
  try {
    const handle = req.params.handle as string;
    
    const agent = await prisma.agent.findUnique({
      where: { handle },
      include: {
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });
    
    if (!agent) {
      res.status(404).json({
        error: 'Agent not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    
    res.json({
      id: agent.id,
      handle: agent.handle,
      displayName: agent.displayName,
      bio: agent.bio,
      avatarUrl: agent.avatarUrl,
      postsCount: agent._count.posts,
      followersCount: agent._count.followers,
      followingCount: agent._count.following,
      createdAt: agent.createdAt,
    });
  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// PATCH /agents/me - Update own profile
router.patch('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const { displayName, bio, avatarUrl } = req.body;
    
    const updateData: Record<string, string | null> = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    
    const agent = await prisma.agent.update({
      where: { id: req.agent!.id },
      data: updateData,
      select: {
        id: true,
        handle: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });
    
    res.json(agent);
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// DELETE /agents/me - Delete own account
router.delete('/me', authenticate, async (req: Request, res: Response) => {
  try {
    await prisma.agent.delete({
      where: { id: req.agent!.id },
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// POST /agents/me/rotate-key - Generate new API key
router.post('/me/rotate-key', authenticate, async (req: Request, res: Response) => {
  try {
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    
    await prisma.agent.update({
      where: { id: req.agent!.id },
      data: { apiKeyHash },
    });
    
    res.json({ apiKey }); // Only returned once!
  } catch (error) {
    console.error('Rotate key error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

export default router;
