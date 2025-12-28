/**
 * @swagger
 * tags:
 *   name: Pools
 *   description: Liquidity pool information and analytics
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateSchema, schemas } from '../middleware/validation.js';
import { logger } from '../middleware/correlationId.js';

const router: Router = Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/pools:
 *   get:
 *     summary: List all liquidity pools
 *     description: Returns all pools with comprehensive analytics including TVL, volume, fees, and APR
 *     tags: [Pools]
 *     responses:
 *       200:
 *         description: Pools list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       pairAddress:
 *                         type: string
 *                       token0:
 *                         type: object
 *                         properties:
 *                           address:
 *                             type: string
 *                           symbol:
 *                             type: string
 *                           name:
 *                             type: string
 *                       token1:
 *                         type: object
 *                         properties:
 *                           address:
 *                             type: string
 *                           symbol:
 *                             type: string
 *                           name:
 *                             type: string
 *                       reserves:
 *                         type: object
 *                         properties:
 *                           token0:
 *                             type: string
 *                           token1:
 *                             type: string
 *                       totalSupply:
 *                         type: string
 *                       tvl:
 *                         type: string
 *                         description: Total Value Locked
 *                       volume24h:
 *                         type: string
 *                       volume7d:
 *                         type: string
 *                       fees24h:
 *                         type: string
 *                       fees7d:
 *                         type: string
 *                       totalFees:
 *                         type: string
 *                       feeAPR:
 *                         type: string
 *                         description: Annualized fee yield percentage
 *                       swapCount:
 *                         type: integer
 *                       lpCount:
 *                         type: integer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 count:
 *                   type: integer
 *                 correlationId:
 *                   type: string
 */
// GET /api/pools - List all pools with analytics
router.get('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const pools = await prisma.pool.findMany({
    include: {
      _count: {
        select: {
          swaps: true,
          lpPositions: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const poolsWithStats = await Promise.all(pools.map(async pool => {
    const reserve0 = BigInt(pool.reserve0 || '0');
    const reserve1 = BigInt(pool.reserve1 || '0');
    const tvl = reserve0 + reserve1;

    // Calculate 24h volume and fees
    const swaps24h = await prisma.swap.findMany({
      where: {
        poolId: pool.id,
        timestamp: {
          gte: twentyFourHoursAgo
        }
      }
    });

    let volume24h = BigInt(0);
    for (const swap of swaps24h) {
      const amount0 = BigInt(swap.amount0In || '0');
      const amount1 = BigInt(swap.amount1In || '0');
      volume24h += amount0 + amount1;
    }
    const fees24h = (volume24h * BigInt(3)) / BigInt(1000);

    // Calculate 7d volume and fees
    const swaps7d = await prisma.swap.findMany({
      where: {
        poolId: pool.id,
        timestamp: {
          gte: sevenDaysAgo
        }
      }
    });

    let volume7d = BigInt(0);
    for (const swap of swaps7d) {
      const amount0 = BigInt(swap.amount0In || '0');
      const amount1 = BigInt(swap.amount1In || '0');
      volume7d += amount0 + amount1;
    }
    const fees7d = (volume7d * BigInt(3)) / BigInt(1000);

    // Calculate total fees to date
    const allSwaps = await prisma.swap.findMany({
      where: {
        poolId: pool.id
      }
    });

    let totalVolume = BigInt(0);
    for (const swap of allSwaps) {
      const amount0 = BigInt(swap.amount0In || '0');
      const amount1 = BigInt(swap.amount1In || '0');
      totalVolume += amount0 + amount1;
    }
    const totalFees = (totalVolume * BigInt(3)) / BigInt(1000);

    // Calculate APR (annualized fee yield)
    let feeAPR = 0;
    if (tvl > BigInt(0) && fees24h > BigInt(0)) {
      // APR = (daily fees / TVL) * 365 * 100
      const dailyYield = Number(fees24h) / Number(tvl);
      feeAPR = dailyYield * 365 * 100;
    }

    return {
      id: pool.id,
      pairAddress: pool.pairAddress,
      token0: {
        address: pool.token0Address,
        symbol: pool.token0Symbol,
        name: pool.token0Name
      },
      token1: {
        address: pool.token1Address,
        symbol: pool.token1Symbol,
        name: pool.token1Name
      },
      reserves: {
        token0: pool.reserve0,
        token1: pool.reserve1
      },
      totalSupply: pool.totalSupply,
      tvl: tvl.toString(),
      volume24h: volume24h.toString(),
      volume7d: volume7d.toString(),
      fees24h: fees24h.toString(),
      fees7d: fees7d.toString(),
      totalFees: totalFees.toString(),
      feeAPR: feeAPR.toFixed(2),
      swapCount: pool._count.swaps,
      lpCount: pool._count.lpPositions,
      createdAt: pool.createdAt.toISOString(),
      updatedAt: pool.updatedAt.toISOString()
    };
  }));

  logger.info('Pools list fetched', {
    count: poolsWithStats.length
  }, req.correlationId);

  res.json({
    success: true,
    data: poolsWithStats,
    count: poolsWithStats.length,
    correlationId: req.correlationId
  });
  return;
}));

/**
 * @swagger
 * /api/pools/{tokenA}/{tokenB}:
 *   get:
 *     summary: Get specific pool details
 *     description: Returns detailed information for a specific pool including recent swaps and top LPs
 *     tags: [Pools]
 *     parameters:
 *       - in: path
 *         name: tokenA
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Address of first token
 *       - in: path
 *         name: tokenB
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Address of second token
 *     responses:
 *       200:
 *         description: Pool details retrieved successfully
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
 *                     pool:
 *                       $ref: '#/components/schemas/Pool'
 *                     stats24h:
 *                       type: object
 *                       properties:
 *                         volume:
 *                           type: string
 *                         fees:
 *                           type: string
 *                         swapCount:
 *                           type: integer
 *                     recentSwaps:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           txHash:
 *                             type: string
 *                           sender:
 *                             type: string
 *                           recipient:
 *                             type: string
 *                           amount0In:
 *                             type: string
 *                           amount1In:
 *                             type: string
 *                           amount0Out:
 *                             type: string
 *                           amount1Out:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           blockNumber:
 *                             type: string
 *                     topLPs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userAddress:
 *                             type: string
 *                           lpTokenBalance:
 *                             type: string
 *                           share:
 *                             type: string
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                 correlationId:
 *                   type: string
 *       404:
 *         description: Pool not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: 'NOT_FOUND'
 *                 message:
 *                   type: string
 *                 correlationId:
 *                   type: string
 */
// GET /api/pools/:tokenA/:tokenB - Get specific pool stats
router.get('/:tokenA/:tokenB', validateSchema(schemas.poolParams), asyncHandler(async (req: Request, res: Response): Promise<void> => {

  const { tokenA, tokenB } = req.params;

  // Find pool (order-agnostic)
  const pool = await prisma.pool.findFirst({
    where: {
      OR: [
        {
          token0Address: tokenA.toLowerCase(),
          token1Address: tokenB.toLowerCase()
        },
        {
          token0Address: tokenB.toLowerCase(),
          token1Address: tokenA.toLowerCase()
        }
      ]
    },
    include: {
      swaps: {
        orderBy: {
          timestamp: 'desc'
        },
        take: 10
      },
      lpPositions: {
        orderBy: {
          lpTokenBalance: 'desc'
        },
        take: 10
      }
    }
  });

  if (!pool) {
    logger.warn('Pool not found', {
      tokenA,
      tokenB
    }, req.correlationId);
    res.status(404).json({
      success: false,
      code: 'NOT_FOUND',
      message: 'Pool not found',
      correlationId: req.correlationId
    });
    return;
  }

  // Calculate 24h stats
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const swaps24h = await prisma.swap.count({
    where: {
      poolId: pool.id,
      timestamp: {
        gte: twentyFourHoursAgo
      }
    }
  });

  const recentSwaps = await prisma.swap.findMany({
    where: {
      poolId: pool.id,
      timestamp: {
        gte: twentyFourHoursAgo
      }
    }
  });

  let volume24h = BigInt(0);
  for (const swap of recentSwaps) {
    const amount0 = BigInt(swap.amount0In || '0');
    const amount1 = BigInt(swap.amount1In || '0');
    volume24h += amount0 + amount1;
  }

  const fees24h = (volume24h * BigInt(3)) / BigInt(1000);

  const reserve0 = BigInt(pool.reserve0 || '0');
  const reserve1 = BigInt(pool.reserve1 || '0');
  const tvl = reserve0 + reserve1;

  logger.info('Pool details fetched', {
    poolId: pool.id,
    tokenA,
    tokenB
  }, req.correlationId);

  res.json({
    success: true,
    data: {
      pool: {
        id: pool.id,
        pairAddress: pool.pairAddress,
        token0: {
          address: pool.token0Address,
          symbol: pool.token0Symbol,
          name: pool.token0Name
        },
        token1: {
          address: pool.token1Address,
          symbol: pool.token1Symbol,
          name: pool.token1Name
        },
        reserves: {
          token0: pool.reserve0,
          token1: pool.reserve1
        },
        totalSupply: pool.totalSupply,
        tvl: tvl.toString()
      },
      stats24h: {
        volume: volume24h.toString(),
        fees: fees24h.toString(),
        swapCount: swaps24h
      },
      recentSwaps: pool.swaps.map(swap => ({
        txHash: swap.txHash,
        sender: swap.sender,
        recipient: swap.recipient,
        amount0In: swap.amount0In,
        amount1In: swap.amount1In,
        amount0Out: swap.amount0Out,
        amount1Out: swap.amount1Out,
        timestamp: swap.timestamp.toISOString(),
        blockNumber: swap.blockNumber
      })),
      topLPs: pool.lpPositions.map(lp => ({
        userAddress: lp.userAddress,
        lpTokenBalance: lp.lpTokenBalance,
        share: lp.share,
        updatedAt: lp.updatedAt.toISOString()
      }))
    },
    correlationId: req.correlationId
  });
  return;
}));

export { router as poolsRouter };
