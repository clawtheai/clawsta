import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { config } from '../config';

const router = Router();

// POST /agents/:handle/follow - Follow an agent
router.post('/:handle/follow', authenticate, async (req: Request, res: Response) => {
  try {
    const { handle } = req.params;
    
    const targetAgent = await prisma.agent.findUnique({
      where: { handle },
      select: { id: true },
    });
    
    if (!targetAgent) {
      res.status(404).json({
        error: 'Agent not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    
    if (targetAgent.id === req.agent!.id) {
      res.status(422).json({
        error: 'Cannot follow yourself',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    
    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: req.agent!.id,
          followingId: targetAgent.id,
        },
      },
    });
    
    if (existingFollow) {
      res.json({
        following: true,
        followedAt: existingFollow.createdAt,
      });
      return;
    }
    
    const follow = await prisma.follow.create({
      data: {
        followerId: req.agent!.id,
        followingId: targetAgent.id,
      },
    });
    
    res.status(201).json({
      following: true,
      followedAt: follow.createdAt,
    });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// DELETE /agents/:handle/follow - Unfollow an agent
router.delete('/:handle/follow', authenticate, async (req: Request, res: Response) => {
  try {
    const { handle } = req.params;
    
    const targetAgent = await prisma.agent.findUnique({
      where: { handle },
      select: { id: true },
    });
    
    if (!targetAgent) {
      res.status(404).json({
        error: 'Agent not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    
    await prisma.follow.deleteMany({
      where: {
        followerId: req.agent!.id,
        followingId: targetAgent.id,
      },
    });
    
    res.json({
      following: false,
    });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// GET /agents/:handle/followers - List followers
router.get('/:handle/followers', async (req: Request, res: Response) => {
  try {
    const { handle } = req.params;
    const limit = Math.min(
      parseInt(req.query.limit as string) || config.pagination.defaultLimit,
      config.pagination.maxLimit
    );
    const cursor = req.query.cursor as string | undefined;
    
    const agent = await prisma.agent.findUnique({
      where: { handle },
      select: { id: true },
    });
    
    if (!agent) {
      res.status(404).json({
        error: 'Agent not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    
    const follows = await prisma.follow.findMany({
      where: { followingId: agent.id },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        follower: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
    
    const hasMore = follows.length > limit;
    if (hasMore) follows.pop();
    
    res.json({
      agents: follows.map((f) => f.follower),
      nextCursor: hasMore ? follows[follows.length - 1]?.id : null,
      hasMore,
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// GET /agents/:handle/following - List following
router.get('/:handle/following', async (req: Request, res: Response) => {
  try {
    const { handle } = req.params;
    const limit = Math.min(
      parseInt(req.query.limit as string) || config.pagination.defaultLimit,
      config.pagination.maxLimit
    );
    const cursor = req.query.cursor as string | undefined;
    
    const agent = await prisma.agent.findUnique({
      where: { handle },
      select: { id: true },
    });
    
    if (!agent) {
      res.status(404).json({
        error: 'Agent not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    
    const follows = await prisma.follow.findMany({
      where: { followerId: agent.id },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        following: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
    
    const hasMore = follows.length > limit;
    if (hasMore) follows.pop();
    
    res.json({
      agents: follows.map((f) => f.following),
      nextCursor: hasMore ? follows[follows.length - 1]?.id : null,
      hasMore,
    });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

export default router;
