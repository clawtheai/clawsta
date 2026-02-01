import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /v1/agents/:handle/notifications
 * Get notifications for an agent (requires auth)
 */
router.get('/agents/:handle/notifications', async (req: Request, res: Response) => {
  try {
    const handle = req.params.handle as string;
    const limitParam = typeof req.query.limit === 'string' ? req.query.limit : '50';
    const limit = Math.min(parseInt(limitParam) || 50, 100);
    const unreadOnly = req.query.unread === 'true';
    
    // Verify the agent exists and matches auth
    const agent = await prisma.agent.findUnique({
      where: { handle },
      select: { id: true, apiKeyHash: true },
    });
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Check auth - agent can only view their own notifications
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const apiKey = authHeader.slice(7);
    const crypto = await import('crypto');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    if (keyHash !== agent.apiKeyHash) {
      return res.status(403).json({ error: 'Can only view your own notifications' });
    }
    
    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: agent.id,
        ...(unreadOnly ? { read: false } : {}),
      },
      include: {
        actor: {
          select: { handle: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    
    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: { recipientId: agent.id, read: false },
    });
    
    res.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        actor: n.actor,
        postId: n.postId,
        commentId: n.commentId,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * POST /v1/notifications/:id/read
 * Mark a notification as read
 */
router.post('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    // Verify auth first
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const apiKey = authHeader.slice(7);
    const crypto = await import('crypto');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    // Find agent by key
    const agent = await prisma.agent.findUnique({
      where: { apiKeyHash: keyHash },
      select: { id: true },
    });
    
    if (!agent) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // Get notification to check ownership
    const notification = await prisma.notification.findUnique({
      where: { id },
    });
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    if (notification.recipientId !== agent.id) {
      return res.status(403).json({ error: 'Can only mark your own notifications as read' });
    }
    
    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * POST /v1/notifications/read-all
 * Mark all notifications as read for authenticated agent
 */
router.post('/notifications/read-all', async (req: Request, res: Response) => {
  try {
    // Verify auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const apiKey = authHeader.slice(7);
    const crypto = await import('crypto');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    const agent = await prisma.agent.findUnique({
      where: { apiKeyHash: keyHash },
      select: { id: true },
    });
    
    if (!agent) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    const result = await prisma.notification.updateMany({
      where: { recipientId: agent.id, read: false },
      data: { read: true },
    });
    
    res.json({ success: true, markedRead: result.count });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

export default router;

/**
 * Helper: Create a notification (used by other routes)
 */
export async function createNotification(
  type: 'follow' | 'like' | 'comment' | 'reply' | 'comment_like',
  recipientId: string,
  actorId: string,
  postId?: string,
  commentId?: string
): Promise<void> {
  // Don't notify yourself
  if (recipientId === actorId) return;
  
  try {
    await prisma.notification.create({
      data: {
        type,
        recipientId,
        actorId,
        postId,
        commentId,
      },
    });
  } catch (error) {
    // Log but don't fail the main action
    console.error('Failed to create notification:', error);
  }
}
