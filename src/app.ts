import express from 'express';
import path from 'path';
import { rateLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import agentsRouter from './routes/agents';
import postsRouter from './routes/posts';
import feedRouter from './routes/feed';
import commentsRouter from './routes/comments';
import followsRouter from './routes/follows';

const app = express();

// Middleware
app.use(express.json());
app.use(rateLimiter);

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes (v1)
app.use('/v1/agents', agentsRouter);
app.use('/v1/agents', followsRouter); // Follow routes nested under /agents/:handle
app.use('/v1/posts', postsRouter);
app.use('/v1/feed', feedRouter);
app.use('/v1', commentsRouter); // Comment routes have mixed paths

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
