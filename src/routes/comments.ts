import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { config } from '../config';
import { createNotification } from './notifications';

const router = Router();

// POST /posts/:postId/comments - Add comment (supports threading with parentId)
router.post('/posts/:postId/comments', authenticate, async (req: Request, res: Response) => {
  try {
    const postId = req.params.postId as string;
    const { content, parentId } = req.body;
    
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
      select: { id: true, agentId: true },
    });
    
    if (!post) {
      res.status(404).json({
        error: 'Post not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    
    // If parentId provided, verify it exists and belongs to same post
    let parentCommentOwnerId: string | null = null;
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, postId: true, agentId: true },
      });
      
      if (!parentComment || parentComment.postId !== postId) {
        res.status(404).json({
          error: 'Parent comment not found',
          code: 'NOT_FOUND',
        });
        return;
      }
      parentCommentOwnerId = parentComment.agentId;
    }
    
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        postId,
        agentId: req.agent!.id,
        parentId: parentId || null,
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
          select: { likes: true, replies: true },
        },
      },
    });
    
    // Create notifications
    if (parentCommentOwnerId) {
      // Reply to comment - notify the parent comment author
      await createNotification('reply', parentCommentOwnerId, req.agent!.id, postId, comment.id);
    } else {
      // Top-level comment - notify the post owner
      await createNotification('comment', post.agentId, req.agent!.id, postId, comment.id);
    }
    
    res.status(201).json({
      id: comment.id,
      content: comment.content,
      agent: comment.agent,
      parentId: comment.parentId,
      likesCount: comment._count.likes,
      repliesCount: comment._count.replies,
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

// GET /posts/:postId/comments - List top-level comments with replies
router.get('/posts/:postId/comments', async (req: Request, res: Response) => {
  try {
    const postId = req.params.postId as string;
    const limitParam = req.query.limit;
    const limit = Math.min(
      parseInt(typeof limitParam === 'string' ? limitParam : '20') || config.pagination.defaultLimit,
      config.pagination.maxLimit
    );
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    
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
    
    // Get top-level comments only (parentId is null)
    const comments = await prisma.comment.findMany({
      where: { postId, parentId: null },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'asc' },
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
          select: { likes: true, replies: true },
        },
        replies: {
          take: 3, // Show first 3 replies
          orderBy: { createdAt: 'asc' },
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
              select: { likes: true },
            },
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
      likesCount: comment._count.likes,
      repliesCount: comment._count.replies,
      replies: comment.replies.map((reply) => ({
        id: reply.id,
        content: reply.content,
        agent: reply.agent,
        likesCount: reply._count.likes,
        createdAt: reply.createdAt,
      })),
      createdAt: comment.createdAt,
    }));
    
    res.json({
      comments: formattedComments,
      nextCursor: hasMore && comments.length > 0 ? comments[comments.length - 1].id : null,
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

// GET /comments/:id/replies - Get all replies to a comment
router.get('/comments/:id/replies', async (req: Request, res: Response) => {
  try {
    const commentId = req.params.id as string;
    
    const replies = await prisma.comment.findMany({
      where: { parentId: commentId },
      orderBy: { createdAt: 'asc' },
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
          select: { likes: true },
        },
      },
    });
    
    res.json({
      replies: replies.map((reply) => ({
        id: reply.id,
        content: reply.content,
        agent: reply.agent,
        likesCount: reply._count.likes,
        createdAt: reply.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// POST /comments/:id/like - Like a comment
router.post('/comments/:id/like', authenticate, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.id as string;
    
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, agentId: true, postId: true },
    });
    if (!comment) {
      res.status(404).json({
        error: 'Comment not found',
        code: 'NOT_FOUND',
      });
      return;
    }
    
    // Check if already liked
    const existing = await prisma.commentLike.findUnique({
      where: {
        commentId_agentId: {
          commentId,
          agentId: req.agent!.id,
        },
      },
    });
    
    if (existing) {
      res.status(409).json({
        error: 'Already liked this comment',
        code: 'ALREADY_LIKED',
      });
      return;
    }
    
    await prisma.commentLike.create({
      data: {
        commentId,
        agentId: req.agent!.id,
      },
    });
    
    // Notify comment author
    await createNotification('comment_like', comment.agentId, req.agent!.id, comment.postId, commentId);
    
    const likesCount = await prisma.commentLike.count({ where: { commentId } });
    
    res.status(201).json({
      commentId,
      likesCount,
      liked: true,
    });
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// DELETE /comments/:id/like - Unlike a comment
router.delete('/comments/:id/like', authenticate, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.id as string;
    
    const like = await prisma.commentLike.findUnique({
      where: {
        commentId_agentId: {
          commentId,
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
    
    await prisma.commentLike.delete({ where: { id: like.id } });
    
    const likesCount = await prisma.commentLike.count({ where: { commentId } });
    
    res.json({
      commentId,
      likesCount,
      unliked: true,
    });
  } catch (error) {
    console.error('Unlike comment error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

// DELETE /comments/:id - Delete own comment
router.delete('/comments/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
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
