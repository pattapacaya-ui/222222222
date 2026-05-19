import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './types';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import sessionRoutes from './routes/sessions';
import orgRoutes from './routes/organizations';
import apiKeyRoutes from './routes/apikeys';
import webhookRoutes from './routes/webhooks';
import adminRoutes from './routes/admin';
import oauthRoutes from './routes/oauth';
import wellknownRoutes from './routes/wellknown';

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors({
  origin: (origin) => origin ?? '*',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400,
}));

// Mount routes
app.route('/v1/auth', authRoutes);
app.route('/v1/users', userRoutes);
app.route('/v1/sessions', sessionRoutes);
app.route('/v1/organizations', orgRoutes);
app.route('/v1/api-keys', apiKeyRoutes);
app.route('/v1/webhooks', webhookRoutes);
app.route('/v1/admin', adminRoutes);
app.route('/v1/oauth', oauthRoutes);
app.route('', wellknownRoutes);

// Health check
app.get('/health', (c) => c.json({
  status: 'ok',
  version: '1.0.0',
  name: 'LegionAuth API',
  timestamp: new Date().toISOString(),
}));

// 404 handler
app.notFound((c) => c.json({
  error: { code: 'NOT_FOUND', message: 'The requested endpoint does not exist', status: 404 }
}, 404));

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    error: { code: 'INTERNAL_ERROR', message: 'An internal server error occurred', status: 500 }
  }, 500);
});

export default app;
