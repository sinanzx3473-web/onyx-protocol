import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { Request } from 'express';

// Initialize Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  lazyConnect: true, // Don't connect immediately
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('✓ Redis connected for rate limiting');
});

// Attempt to connect to Redis
redis.connect().catch((err) => {
  console.error('Failed to connect to Redis:', err.message);
  console.warn('⚠️  Rate limiting will use in-memory store (not recommended for production)');
});

// Key generator combining IP + User-Agent for better rate limiting
const keyGenerator = (req: Request): string => {
  const ip = ipKeyGenerator(req);
  const userAgent = req.get('user-agent') || 'unknown';
  // Hash the user agent to keep key size manageable
  const uaHash = Buffer.from(userAgent).toString('base64').slice(0, 16);
  return `${ip}:${uaHash}`;
};

// Standard error message
const standardLimitMessage = {
  success: false,
  code: 'RATE_LIMIT_EXCEEDED',
  message: 'Too many requests from this IP, please try again later.',
  details: {
    retryAfter: 'Check Retry-After header'
  }
};

// General rate limiter (100 requests per 15 minutes)
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true, // Enable RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  keyGenerator,
  handler: (_req, res) => {
    const retryAfter = Math.ceil(15 * 60); // 15 minutes in seconds
    res.set('Retry-After', retryAfter.toString());
    res.status(429).json(standardLimitMessage);
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  },
  store: new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible
    sendCommand: (...args: string[]) => redis.call(...args),
    prefix: 'rl:general:',
  }),
});

// Stricter rate limiter for gas estimation (10 requests per minute)
export const gasLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true, // Enable RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  keyGenerator,
  handler: (_req, res) => {
    const retryAfter = Math.ceil(1 * 60); // 1 minute in seconds
    res.set('Retry-After', retryAfter.toString());
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many gas estimation requests, please try again later.',
      details: {
        retryAfter: 'Check Retry-After header'
      }
    });
  },
  store: new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible
    sendCommand: (...args: string[]) => redis.call(...args),
    prefix: 'rl:gas:',
  }),
});

// Analytics rate limiter (30 requests per 5 minutes)
export const analyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  standardHeaders: true, // Enable RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  keyGenerator,
  handler: (_req, res) => {
    const retryAfter = Math.ceil(5 * 60); // 5 minutes in seconds
    res.set('Retry-After', retryAfter.toString());
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many analytics requests, please try again later.',
      details: {
        retryAfter: 'Check Retry-After header'
      }
    });
  },
  store: new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible
    sendCommand: (...args: string[]) => redis.call(...args),
    prefix: 'rl:analytics:',
  }),
});

// M-4 FIX: Stricter relay transaction rate limiter (10 requests per 15 minutes)
export const relayLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true, // Enable RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  keyGenerator,
  handler: (_req, res) => {
    const retryAfter = Math.ceil(15 * 60); // 15 minutes in seconds
    res.set('Retry-After', retryAfter.toString());
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many relay requests, please try again later.',
      details: {
        retryAfter: 'Check Retry-After header'
      }
    });
  },
  store: new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible
    sendCommand: (...args: string[]) => redis.call(...args),
    prefix: 'rl:relay:',
  }),
});

// M-4 FIX: Governance rate limiter (20 requests per 5 minutes)
export const governanceLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20,
  standardHeaders: true, // Enable RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  keyGenerator,
  handler: (_req, res) => {
    const retryAfter = Math.ceil(5 * 60); // 5 minutes in seconds
    res.set('Retry-After', retryAfter.toString());
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many governance requests, please try again later.',
      details: {
        retryAfter: 'Check Retry-After header'
      }
    });
  },
  store: new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible
    sendCommand: (...args: string[]) => redis.call(...args),
    prefix: 'rl:governance:',
  }),
});

export { redis };
