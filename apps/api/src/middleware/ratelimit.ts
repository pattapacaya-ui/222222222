import type { Env } from '../types';
import type { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function rateLimit(
  action: string,
  maxAttempts: number,
  windowSeconds: number
) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
    const key = `rl:${action}:${ip}`;
    const now = Date.now();

    let entry: RateLimitEntry = { count: 0, resetAt: now + windowSeconds * 1000 };
    const stored = await c.env.RATE_LIMIT_KV.get(key, 'json') as RateLimitEntry | null;

    if (stored && stored.resetAt > now) {
      entry = stored;
    }

    entry.count += 1;

    await c.env.RATE_LIMIT_KV.put(key, JSON.stringify(entry), {
      expirationTtl: Math.ceil((entry.resetAt - now) / 1000) + 1,
    });

    c.header('X-RateLimit-Limit', maxAttempts.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, maxAttempts - entry.count).toString());
    c.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

    if (entry.count > maxAttempts) {
      return c.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.', status: 429 } },
        429
      );
    }

    await next();
  };
}
