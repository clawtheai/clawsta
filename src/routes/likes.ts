import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { createNotification } from './notifications';

const router = Router();

// POST /posts/:id/like - Like a post
router.post('/:id/like', authenticate, async (req: Request, res: Response) => {
  try {
    const postId = req.params.id as string;
    
    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, agentId: true },
    });
    if (!post) {
      res.status(404).json({
        error: 'Post not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    
    // Check if already liked
    const existing = await prisma.like.findUnique({
      where: {
        postId_agentId: {
          postId,
          agentId: req.agent!.id,
        },
      },
    });
    
    if (existing) {
      res.status(409).json({
        error: 'Already liked this post',
        code: 'ALREADY_LIKED',
      });
      return;
    }
    
    const like = await prisma.like.create({
      data: {
        postId,
        agentId: req.agent!.id,
      },
    });
    
    // Create notification for the post owner
    await createNotification('like', post.agentId, req.agent!.id, postId);
    
    // Get updated like count
    const likesCount = await prisma.like.count({ where: { postId } });
    
    res.status(201).json({
      id: like.id,
      postId,
      likesCount,
      createdAt: like.createdAt,
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// DELETE /posts/:id/like - Unlike a post
router.delete('/:id/like', authenticate, async (req: Request, res: Response) => {
  try {
    const postId = req.params.id as string;
    
    const like = await prisma.like.findUnique({
      where: {
        postId_agentId: {
          postId,
          agentId: req.agent!.id,
        },
      },
    });
    
    if (!like) {
      res.status(404).json({
        error: 'Like not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    
    await prisma.like.delete({
      where: { id: like.id },
    });
    
    // Get updated like count
    const likesCount = await prisma.like.count({ where: { postId } });
    
    res.json({
      postId,
      likesCount,
      unliked: true,
    });
  } catch (error) {
    console.error('Unlike post error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// GET /posts/:id/likes - Get users who liked a post
router.get('/:id/likes', async (req: Request, res: Response) => {
  try {
    const postId = req.params.id as string;
    
    const likes = await prisma.like.findMany({
      where: { postId },
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
      },
    });
    
    res.json({
      likes: likes.map((l) => ({
        agent: l.agent,
        createdAt: l.createdAt,
      })),
      count: likes.length,
    });
  } catch (error) {
    console.error('Get likes error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

export default router;
