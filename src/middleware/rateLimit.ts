import rateLimit from 'express-rate-limit';
import { config } from '../config';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMITED',
  },
  keyGenerator: (req) => {
    // Use API key hash if authenticated, otherwise IP
    return req.agent?.apiKeyHash || req.ip || 'unknown';
  },
});
