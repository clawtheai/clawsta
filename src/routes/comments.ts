import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { config } from '../config';

const router = Router();

// POST /posts/:postId/comments - Add comment
router.post('/posts/:postId/comments', authenticate, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      res.status(422).json({
        error: 'content is required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    
    // Check post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    
    if (!post) {
      res.status(404).json({
        error: 'Post not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        postId,
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
      },
    });
    
    res.status(201).json({
      id: comment.id,
      content: comment.content,
      agent: comment.agent,
      createdAt: comment.createdAt,
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// GET /posts/:postId/comments - List comments
router.get('/posts/:postId/comments', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const limit = Math.min(
      parseInt(req.query.limit as string) || config.pagination.defaultLimit,
      config.pagination.maxLimit
    );
    const cursor = req.query.cursor as string | undefined;
    
    // Check post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    
    if (!post) {
      res.status(404).json({
        error: 'Post not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    
    const comments = await prisma.comment.findMany({
      where: { postId },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'asc' }, // Oldest first for comments
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
    
    const hasMore = comments.length > limit;
    if (hasMore) comments.pop();
    
    const formattedComments = comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      agent: comment.agent,
      createdAt: comment.createdAt,
    }));
    
    res.json({
      comments: formattedComments,
      nextCursor: hasMore ? comments[comments.length - 1]?.id : null,
      hasMore,
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// DELETE /comments/:id - Delete own comment
router.delete('/comments/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { agentId: true },
    });
    
    if (!comment) {
      res.status(404).json({
        error: 'Comment not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    
    if (comment.agentId !== req.agent!.id) {
      res.status(403).json({
        error: 'Not allowed to delete this comment',
        code: 'FORBIDDEN',
      });
      return;
    }
    
    await prisma.comment.delete({ where: { id } });
    
    res.status(204).send();
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

export default router;
