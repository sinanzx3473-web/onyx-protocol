/**
 * @swagger
 * tags:
 *   name: Trades
 *   description: Trade history and transaction tracking
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../middleware/correlationId.js';

const router: Router = Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/trades/{address}:
 *   get:
 *     summary: Get trade history
 *     description: Returns trade history for a wallet address with optional time filters
 *     tags: [Trades]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Wallet address
 *       - in: query
 *         name: startTime
 *         schema:
 *           type: string
 *         description: Start timestamp (Unix milliseconds)
 *       - in: query
 *         name: endTime
 *         schema:
 *           type: string
 *         description: End timestamp (Unix milliseconds)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [swap, add_liquidity, remove_liquidity]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: string
 *           default: '100'
 *         description: Maximum number of trades to return (max 1000)
 *     responses:
 *       200:
 *         description: Trade history retrieved successfully
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
 *                     swaps:
 *                       type: array
 *                       items:
 *                         type: object
 *                     liquidityEvents:
 *                       type: array
 *                       items:
 *                         type: object
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalSwaps:
 *                           type: integer
 *                         totalVolume:
 *                           type: string
 *                         totalLiquidityAdded:
 *                           type: string
 *                         totalLiquidityRemoved:
 *                           type: string
 *                 correlationId:
 *                   type: string
 */
router.get('/:address', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { address } = req.params;
  const { startTime, endTime, type, limit = '100' } = req.query;

  const walletAddress = address.toLowerCase();
  const limitNum = Math.min(parseInt(limit as string) || 100, 1000);

  // Build time filter
  const timeFilter: any = {};
  if (startTime) {
    timeFilter.gte = new Date(parseInt(startTime as string));
  }
  if (endTime) {
    timeFilter.lte = new Date(parseInt(endTime as string));
  }

  const whereClause: any = {
    sender: walletAddress
  };

  if (Object.keys(timeFilter).length > 0) {
    whereClause.timestamp = timeFilter;
  }

  // Get swaps
  const swaps = await prisma.swap.findMany({
    where: whereClause,
    include: {
      pool: true
    },
    orderBy: {
      timestamp: 'desc'
    },
    take: limitNum
  });

  // Get liquidity events
  const liquidityEvents = await prisma.liquidityEvent.findMany({
    where: {
      userAddress: walletAddress,
      ...(Object.keys(timeFilter).length > 0 ? { timestamp: timeFilter } : {})
    },
    orderBy: {
      timestamp: 'desc'
    },
    take: limitNum
  });
  const liquidityAdds = liquidityEvents.filter(e => e.type === 'ADD');
  const liquidityRemoves = liquidityEvents.filter(e => e.type === 'REMOVE');

  // Format trades
  const formattedSwaps = swaps.map(swap => ({
    hash: swap.txHash,
    type: 'swap' as const,
    timestamp: swap.timestamp.getTime(),
    pool: {
      token0: {
        address: swap.pool.token0Address,
        symbol: swap.pool.token0Symbol,
        name: swap.pool.token0Name
      },
      token1: {
        address: swap.pool.token1Address,
        symbol: swap.pool.token1Symbol,
        name: swap.pool.token1Name
      }
    },
    amount0In: swap.amount0In,
    amount1In: swap.amount1In,
    amount0Out: swap.amount0Out,
    amount1Out: swap.amount1Out,
    sender: swap.sender
  }));

  const formattedAdds = await Promise.all(liquidityAdds.map(async event => {
    const pool = await prisma.pool.findUnique({ where: { id: event.poolId } });
    return {
      hash: event.txHash,
      type: 'add_liquidity' as const,
      timestamp: event.timestamp.getTime(),
      pool: pool ? {
        token0: {
          address: pool.token0Address,
          symbol: pool.token0Symbol,
          name: pool.token0Name
        },
        token1: {
          address: pool.token1Address,
          symbol: pool.token1Symbol,
          name: pool.token1Name
        }
      } : null,
      amount0: event.amount0,
      amount1: event.amount1,
      sender: event.userAddress
    };
  }));

  const formattedRemoves = await Promise.all(liquidityRemoves.map(async event => {
    const pool = await prisma.pool.findUnique({ where: { id: event.poolId } });
    return {
      hash: event.txHash,
      type: 'remove_liquidity' as const,
      timestamp: event.timestamp.getTime(),
      pool: pool ? {
        token0: {
          address: pool.token0Address,
          symbol: pool.token0Symbol,
          name: pool.token0Name
        },
        token1: {
          address: pool.token1Address,
          symbol: pool.token1Symbol,
          name: pool.token1Name
        }
      } : null,
      amount0: event.amount0,
      amount1: event.amount1,
      sender: event.userAddress
    };
  }));

  // Combine and sort all trades
  let allTrades = [...formattedSwaps, ...formattedAdds, ...formattedRemoves];

  // Filter by type if specified
  if (type) {
    allTrades = allTrades.filter(trade => trade.type === type);
  }

  // Sort by timestamp descending
  allTrades.sort((a, b) => b.timestamp - a.timestamp);

  // Limit results
  allTrades = allTrades.slice(0, limitNum);

  logger.info('Trade history fetched', {
    address: walletAddress,
    count: allTrades.length,
    startTime,
    endTime,
    type
  }, req.correlationId);

  res.json({
    success: true,
    data: {
      address: walletAddress,
      trades: allTrades,
      count: allTrades.length,
      filters: {
        startTime: startTime ? new Date(parseInt(startTime as string)).toISOString() : null,
        endTime: endTime ? new Date(parseInt(endTime as string)).toISOString() : null,
        type: type || 'all'
      }
    },
    correlationId: req.correlationId
  });
}));

/**
 * GET /api/trades/:address/summary
 * Get trade summary statistics
 */
router.get('/:address/summary', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { address } = req.params;
  const walletAddress = address.toLowerCase();

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get swap counts and volumes for different periods
  const [swaps24h, swaps7d, swaps30d, swapsAll] = await Promise.all([
    prisma.swap.findMany({
      where: {
        sender: walletAddress,
        timestamp: { gte: oneDayAgo }
      }
    }),
    prisma.swap.findMany({
      where: {
        sender: walletAddress,
        timestamp: { gte: sevenDaysAgo }
      }
    }),
    prisma.swap.findMany({
      where: {
        sender: walletAddress,
        timestamp: { gte: thirtyDaysAgo }
      }
    }),
    prisma.swap.findMany({
      where: {
        sender: walletAddress
      }
    })
  ]);

  const calculateVolume = (swaps: Array<{ amount0In: string; amount1In: string }>) => {
    let volume = BigInt(0);
    for (const swap of swaps) {
      const amount0 = BigInt(swap.amount0In || '0');
      const amount1 = BigInt(swap.amount1In || '0');
      volume += amount0 + amount1;
    }
    return volume.toString();
  };

  // Get liquidity event counts
  const [liquidityAdds24h, liquidityAdds7d, liquidityAdds30d] = await Promise.all([
    prisma.liquidityEvent.count({
      where: {
        userAddress: walletAddress,
        type: 'ADD',
        timestamp: { gte: oneDayAgo }
      }
    }),
    prisma.liquidityEvent.count({
      where: {
        userAddress: walletAddress,
        type: 'ADD',
        timestamp: { gte: sevenDaysAgo }
      }
    }),
    prisma.liquidityEvent.count({
      where: {
        userAddress: walletAddress,
        type: 'ADD',
        timestamp: { gte: thirtyDaysAgo }
      }
    })
  ]);

  res.json({
    success: true,
    data: {
      address: walletAddress,
      swaps: {
        '24h': {
          count: swaps24h.length,
          volume: calculateVolume(swaps24h)
        },
        '7d': {
          count: swaps7d.length,
          volume: calculateVolume(swaps7d)
        },
        '30d': {
          count: swaps30d.length,
          volume: calculateVolume(swaps30d)
        },
        all: {
          count: swapsAll.length,
          volume: calculateVolume(swapsAll)
        }
      },
      liquidityAdds: {
        '24h': liquidityAdds24h,
        '7d': liquidityAdds7d,
        '30d': liquidityAdds30d
      },
      lastUpdated: new Date().toISOString()
    },
    correlationId: req.correlationId
  });
}));

export { router as tradesRouter };
