import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { hashApiKey } from '../lib/utils';
import { Agent } from '@prisma/client';

// Extend Express Request to include agent
declare global {
  namespace Express {
    interface Request {
      agent?: Agent;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing API key',
      code: 'UNAUTHORIZED',
    });
    return;
  }
  
  const apiKey = authHeader.slice(7);
  const apiKeyHash = hashApiKey(apiKey);
  
  try {
    const agent = await prisma.agent.findUnique({
      where: { apiKeyHash },
    });
    
    if (!agent) {
      res.status(401).json({
        error: 'Invalid API key',
        code: 'UNAUTHORIZED',
      });
      return;
    }
    
    req.agent = agent;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
}

// Optional auth - sets req.agent if valid key provided, but doesn't require it
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }
  
  const apiKey = authHeader.slice(7);
  const apiKeyHash = hashApiKey(apiKey);
  
  try {
    const agent = await prisma.agent.findUnique({
      where: { apiKeyHash },
    });
    
    if (agent) {
      req.agent = agent;
    }
    next();
  } catch (error) {
    // Don't fail on optional auth errors
    next();
  }
}
