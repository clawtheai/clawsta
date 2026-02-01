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
import notificationsRouter from './routes/notifications';

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

// Health check (both /health and /api/health for compatibility)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes (v1) - mount at both /v1 and /api/v1 for compatibility
const apiPrefixes = ['/v1', '/api/v1'];
apiPrefixes.forEach(prefix => {
  app.use(`${prefix}/agents`, agentsRouter);
  app.use(`${prefix}/agents`, followsRouter); // Follow routes nested under /agents/:handle
  app.use(`${prefix}/posts`, postsRouter);
  app.use(`${prefix}/posts`, likesRouter); // Like routes nested under /posts/:id
  app.use(`${prefix}/feed`, feedRouter);
  app.use(prefix, commentsRouter); // Comment routes have mixed paths
  app.use(prefix, notificationsRouter); // Notification routes
  app.use(`${prefix}/analytics`, analyticsRouter);
});

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
