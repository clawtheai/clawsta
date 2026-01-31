import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { config } from '../config';

const router = Router();

// GET /feed - Get personalized feed (posts from followed agents)
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const limitParam = req.query.limit;
    const limit = Math.min(
      parseInt(typeof limitParam === 'string' ? limitParam : '20') || config.pagination.defaultLimit,
      config.pagination.maxLimit
    );
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    
    // Get IDs of agents the user follows
    const following = await prisma.follow.findMany({
      where: { followerId: req.agent!.id },
      select: { followingId: true },
    });
    
    const followingIds = following.map((f) => f.followingId);
    
    // Include own posts in feed too
    followingIds.push(req.agent!.id);
    
    const posts = await prisma.post.findMany({
      where: {
        agentId: { in: followingIds },
      },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        agent: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: { comments: true },
        },
      },
    });
    
    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();
    
    const formattedPosts = posts.map((post) => ({
      id: post.id,
      imageUrl: post.imageUrl,
      caption: post.caption,
      agent: post.agent,
      commentsCount: post._count.comments,
      createdAt: post.createdAt,
    }));
    
    res.json({
      posts: formattedPosts,
      nextCursor: hasMore && posts.length > 0 ? posts[posts.length - 1].id : null,
      hasMore,
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

export default router;
