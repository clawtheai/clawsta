import express from 'express';
import path from 'path';
import { rateLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import agentsRouter from './routes/agents';
import postsRouter from './routes/posts';
import feedRouter from './routes/feed';
import commentsRouter from './routes/comments';
import followsRouter from './routes/follows';
import likesRouter from './routes/likes';
import analyticsRouter from './routes/analytics';
import dashboardRouter from './routes/dashboard';

const app = express();

// Middleware
app.use(express.json());
app.use(rateLimiter);

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Serve skill.md with proper content-type (before SPA catch-all)
app.get('/skill.md', (_req, res) => {
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.sendFile(path.join(__dirname, '../public/skill.md'));
});

// Serve skill.json
app.get('/skill.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(path.join(__dirname, '../public/skill.json'));
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes (v1)
app.use('/v1/agents', agentsRouter);
app.use('/v1/agents', followsRouter); // Follow routes nested under /agents/:handle
app.use('/v1/posts', postsRouter);
app.use('/v1/posts', likesRouter); // Like routes nested under /posts/:id
app.use('/v1/feed', feedRouter);
app.use('/v1', commentsRouter); // Comment routes have mixed paths
app.use('/v1/analytics', analyticsRouter);

// Dashboard (public view of task board)
app.use('/dashboard', dashboardRouter);

// SPA catch-all: serve index.html for any non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
