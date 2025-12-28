/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: DEX analytics and statistics
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../middleware/correlationId.js';

const router: Router = Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/analytics:
 *   get:
 *     summary: Get DEX analytics
 *     description: Returns comprehensive DEX analytics including volume, fees, TVL, and user metrics
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     volume24h:
 *                       type: string
 *                       description: Total trading volume in last 24 hours
 *                     volume7d:
 *                       type: string
 *                       description: Total trading volume in last 7 days
 *                     fees24h:
 *                       type: string
 *                       description: Total fees collected in last 24 hours
 *                     fees7d:
 *                       type: string
 *                       description: Total fees collected in last 7 days
 *                     tvl:
 *                       type: string
 *                       description: Total Value Locked across all pools
 *                     uniqueUsers24h:
 *                       type: integer
 *                       description: Unique users in last 24 hours
 *                     swapCount24h:
 *                       type: integer
 *                       description: Number of swaps in last 24 hours
 *                     swapCount7d:
 *                       type: integer
 *                       description: Number of swaps in last 7 days
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 correlationId:
 *                   type: string
 */
router.get('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get swaps in last 24h
  const recentSwaps = await prisma.swap.findMany({
    where: {
      timestamp: {
        gte: twentyFourHoursAgo
      }
    },
    include: {
      pool: true
    }
  });

  // Get swaps in last 7d
  const swaps7d = await prisma.swap.findMany({
    where: {
      timestamp: {
        gte: sevenDaysAgo
      }
    }
  });

  // Calculate 24h volume
  let totalVolume24h = BigInt(0);
  const uniqueUsers = new Set<string>();

  for (const swap of recentSwaps) {
    const amount0 = BigInt(swap.amount0In || '0');
    const amount1 = BigInt(swap.amount1In || '0');
    totalVolume24h += amount0 + amount1;
    uniqueUsers.add(swap.sender);
  }

  // Calculate 7d volume
  let totalVolume7d = BigInt(0);
  for (const swap of swaps7d) {
    const amount0 = BigInt(swap.amount0In || '0');
    const amount1 = BigInt(swap.amount1In || '0');
    totalVolume7d += amount0 + amount1;
  }

  // Calculate fees (0.3% of volume)
  const totalFees24h = (totalVolume24h * BigInt(3)) / BigInt(1000);
  const totalFees7d = (totalVolume7d * BigInt(3)) / BigInt(1000);

  // Calculate TVL from all pools
  const allPools = await prisma.pool.findMany();
  let totalTVL = BigInt(0);

  for (const pool of allPools) {
    const reserve0 = BigInt(pool.reserve0 || '0');
    const reserve1 = BigInt(pool.reserve1 || '0');
    totalTVL += reserve0 + reserve1;
  }

  // Get or create analytics snapshot
  const snapshot = await prisma.analyticsSnapshot.create({
    data: {
      totalVolume24h: totalVolume24h.toString(),
      totalFees24h: totalFees24h.toString(),
      totalTVL: totalTVL.toString(),
      uniqueUsers24h: uniqueUsers.size,
      swapCount24h: recentSwaps.length
    }
  });

  logger.info('Analytics snapshot created', {
    volume24h: totalVolume24h.toString(),
    tvl: totalTVL.toString(),
    uniqueUsers24h: uniqueUsers.size
  }, req.correlationId);

  res.json({
    success: true,
    data: {
      volume24h: totalVolume24h.toString(),
      volume7d: totalVolume7d.toString(),
      fees24h: totalFees24h.toString(),
      fees7d: totalFees7d.toString(),
      tvl: totalTVL.toString(),
      uniqueUsers24h: uniqueUsers.size,
      swapCount24h: recentSwaps.length,
      swapCount7d: swaps7d.length,
      timestamp: snapshot.timestamp.toISOString()
    },
    correlationId: req.correlationId
  });
  return;
}));

export { router as analyticsRouter };
