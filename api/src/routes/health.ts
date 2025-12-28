// Copyright ONYX Protocol
import { Router, Request, Response } from 'express';
import { redis } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { PrismaClient } from '@prisma/client';

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API and its dependencies
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy or degraded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     version:
 *                       type: string
 *                     uptime:
 *                       type: number
 *                     checks:
 *                       type: object
 *                       properties:
 *                         database:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [up, down]
 *                             latency:
 *                               type: number
 *                         redis:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [up, down]
 *                             latency:
 *                               type: number
 *                         memory:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [ok, warning, critical]
 *                             usage:
 *                               type: object
 *                             percentage:
 *                               type: number
 *       503:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

const prisma = new PrismaClient();

const router: Router = Router();

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: {
      status: 'up' | 'down';
      latency?: number;
      error?: string;
    };
    redis: {
      status: 'up' | 'down';
      latency?: number;
      error?: string;
    };
    memory: {
      status: 'ok' | 'warning' | 'critical';
      usage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
      };
      percentage: number;
    };
  };
}

router.get('/', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0',
    uptime: process.uptime(),
    checks: {
      database: { status: 'down' },
      redis: { status: 'down' },
      memory: { 
        status: 'ok',
        usage: {
          heapUsed: 0,
          heapTotal: 0,
          external: 0,
          rss: 0
        },
        percentage: 0
      }
    }
  };

  // Check Database (Prisma)
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;
    result.checks.database = {
      status: 'up',
      latency: dbLatency
    };
  } catch (error) {
    result.checks.database = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    result.status = 'unhealthy';
  }

  // Check Redis
  try {
    const redisStart = Date.now();
    await redis.ping();
    const redisLatency = Date.now() - redisStart;
    result.checks.redis = {
      status: 'up',
      latency: redisLatency
    };
  } catch (error) {
    result.checks.redis = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    result.status = 'degraded';
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  const memPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  result.checks.memory = {
    status: memPercentage > 90 ? 'critical' : memPercentage > 75 ? 'warning' : 'ok',
    usage: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024) // MB
    },
    percentage: Math.round(memPercentage * 100) / 100
  };

  if (result.checks.memory.status === 'critical') {
    result.status = 'unhealthy';
  } else if (result.checks.memory.status === 'warning' && result.status === 'healthy') {
    result.status = 'degraded';
  }

  // Determine overall health status
  if (result.checks.database.status === 'down' || result.checks.redis.status === 'down') {
    result.status = 'unhealthy';
  }

  // Set appropriate status code
  const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json({
    success: result.status !== 'unhealthy',
    data: result
  });
  return;
}));

export { router as healthRouter };
