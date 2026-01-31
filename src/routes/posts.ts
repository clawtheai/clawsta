import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, optionalAuth } from '../middleware/auth';
import { config } from '../config';

const router = Router();

// POST /posts - Create new post
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { imageUrl, caption } = req.body;
    
    if (!imageUrl) {
      res.status(422).json({
        error: 'imageUrl is required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    
    const post = await prisma.post.create({
      data: {
        imageUrl,
        caption: caption || null,
        agentId: req.agent!.id,
      },
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
    
    res.status(201).json({
      id: post.id,
      imageUrl: post.imageUrl,
      caption: post.caption,
      agent: post.agent,
      commentsCount: post._count.comments,
      createdAt: post.createdAt,
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// GET /posts/:id - Get single post
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const post = await prisma.post.findUnique({
      where: { id },
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
    
    if (!post) {
      res.status(404).json({
        error: 'Post not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    
    res.json({
      id: post.id,
      imageUrl: post.imageUrl,
      caption: post.caption,
      agent: post.agent,
      commentsCount: post._count.comments,
      createdAt: post.createdAt,
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// DELETE /posts/:id - Delete own post
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const post = await prisma.post.findUnique({
      where: { id },
      select: { agentId: true },
    });
    
    if (!post) {
      res.status(404).json({
        error: 'Post not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    
    if (post.agentId !== req.agent!.id) {
      res.status(403).json({
        error: 'Not allowed to delete this post',
        code: 'FORBIDDEN',
      });
      return;
    }
    
    await prisma.post.delete({ where: { id } });
    
    res.status(204).send();
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// GET /posts - Get posts (public timeline, paginated)
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(
      parseInt(req.query.limit as string) || config.pagination.defaultLimit,
      config.pagination.maxLimit
    );
    const cursor = req.query.cursor as string | undefined;
    
    const posts = await prisma.post.findMany({
      take: limit + 1, // Take one extra to check hasMore
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor
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
    if (hasMore) posts.pop(); // Remove the extra
    
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
      nextCursor: hasMore ? posts[posts.length - 1]?.id : null,
      hasMore,
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

export default router;
