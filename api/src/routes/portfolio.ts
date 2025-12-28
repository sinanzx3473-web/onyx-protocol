/**
 * @swagger
 * tags:
 *   name: Portfolio
 *   description: User portfolio tracking and analytics
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../middleware/correlationId.js';

const router: Router = Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/portfolio/{address}:
 *   get:
 *     summary: Get user portfolio
 *     description: Returns comprehensive portfolio data including LP positions, swap history, and fees earned
 *     tags: [Portfolio]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Wallet address
 *     responses:
 *       200:
 *         description: Portfolio retrieved successfully
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
 *                     address:
 *                       type: string
 *                     lpPositions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           poolId:
 *                             type: string
 *                           token0:
 *                             type: object
 *                           token1:
 *                             type: object
 *                           liquidity:
 *                             type: string
 *                           share:
 *                             type: string
 *                           feesEarned:
 *                             type: string
 *                     totalFeesEarned:
 *                       type: string
 *                     totalSwaps:
 *                       type: integer
 *                     totalVolume:
 *                       type: string
 *                     recentSwaps:
 *                       type: array
 *                       items:
 *                         type: object
 *                 correlationId:
 *                   type: string
 */
router.get('/:address', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { address } = req.params;
  const walletAddress = address.toLowerCase();

  // Get all LP positions for this address
  const lpPositions = await prisma.liquidityPosition.findMany({
    where: {
      owner: walletAddress,
      liquidity: {
        gt: '0'
      }
    }
  });

  // Get all swaps by this address
  const swaps = await prisma.swap.findMany({
    where: {
      sender: walletAddress
    },
    include: {
      pool: true
    },
    orderBy: {
      timestamp: 'desc'
    },
    take: 1000 // Last 1000 swaps
  });

  // Calculate total fees earned from LP positions
  let totalFeesEarned = BigInt(0);
  const positionDetails = [];

  for (const position of lpPositions) {
    const pool = await prisma.pool.findUnique({ where: { id: position.poolId } });
    if (!pool) continue;
    const userLiquidity = BigInt(position.liquidity);
    const totalLiquidity = BigInt(pool.totalSupply || '0');

    if (totalLiquidity > 0) {
      // Calculate user's share of pool
      const sharePercent = Number(userLiquidity) / Number(totalLiquidity);

      // Get pool's accumulated fees (0.3% of all swaps)
      const poolSwaps = await prisma.swap.findMany({
        where: {
          poolId: pool.id
        }
      });

      let poolVolume = BigInt(0);
      for (const swap of poolSwaps) {
        const amount0 = BigInt(swap.amount0In || '0');
        const amount1 = BigInt(swap.amount1In || '0');
        poolVolume += amount0 + amount1;
      }

      const poolFees = (poolVolume * BigInt(3)) / BigInt(1000);
      const userFees = BigInt(Math.floor(Number(poolFees) * sharePercent));
      totalFeesEarned += userFees;

      positionDetails.push({
        poolId: pool.id,
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
        liquidity: position.liquidity,
        sharePercent: (sharePercent * 100).toFixed(4),
        feesEarned: userFees.toString(),
        reserve0: pool.reserve0,
        reserve1: pool.reserve1
      });
    }
  }

  // Calculate P&L from swaps
  let totalSwapVolume = BigInt(0);
  for (const swap of swaps) {
    const amount0 = BigInt(swap.amount0In || '0');
    const amount1 = BigInt(swap.amount1In || '0');
    totalSwapVolume += amount0 + amount1;
  }

  // Calculate time-based earnings
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const calculateEarningsForPeriod = async (since: Date) => {
    let earnings = BigInt(0);
    
    for (const position of lpPositions) {
      const pool = await prisma.pool.findUnique({ where: { id: position.poolId } });
      if (!pool) continue;
      const userLiquidity = BigInt(position.liquidity);
      const totalLiquidity = BigInt(pool.totalSupply || '0');

      if (totalLiquidity > 0) {
        const sharePercent = Number(userLiquidity) / Number(totalLiquidity);

        const periodSwaps = await prisma.swap.findMany({
          where: {
            poolId: pool.id,
            timestamp: {
              gte: since
            }
          }
        });

        let periodVolume = BigInt(0);
        for (const swap of periodSwaps) {
          const amount0 = BigInt(swap.amount0In || '0');
          const amount1 = BigInt(swap.amount1In || '0');
          periodVolume += amount0 + amount1;
        }

        const periodFees = (periodVolume * BigInt(3)) / BigInt(1000);
        const userPeriodFees = BigInt(Math.floor(Number(periodFees) * sharePercent));
        earnings += userPeriodFees;
      }
    }

    return earnings.toString();
  };

  const [earnings24h, earnings7d, earnings30d] = await Promise.all([
    calculateEarningsForPeriod(oneDayAgo),
    calculateEarningsForPeriod(sevenDaysAgo),
    calculateEarningsForPeriod(thirtyDaysAgo)
  ]);

  logger.info('Portfolio data fetched', {
    address: walletAddress,
    lpPositions: lpPositions.length,
    totalSwaps: swaps.length
  }, req.correlationId);

  res.json({
    success: true,
    data: {
      address: walletAddress,
      lpPositions: positionDetails,
      totalFeesEarned: totalFeesEarned.toString(),
      earnings: {
        '24h': earnings24h,
        '7d': earnings7d,
        '30d': earnings30d
      },
      swapCount: swaps.length,
      totalSwapVolume: totalSwapVolume.toString(),
      lastUpdated: new Date().toISOString()
    },
    correlationId: req.correlationId
  });
}));

/**
 * GET /api/portfolio/:address/multi
 * Get aggregated portfolio data for multiple wallet addresses
 */
router.post('/multi', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { addresses } = req.body;

  if (!Array.isArray(addresses) || addresses.length === 0) {
    res.status(400).json({
      success: false,
      error: 'addresses must be a non-empty array'
    });
  }

  const normalizedAddresses = addresses.map((addr: string) => addr.toLowerCase());

  // Aggregate data from all addresses
  const aggregatedData = {
    addresses: normalizedAddresses,
    totalFeesEarned: BigInt(0),
    totalSwapVolume: BigInt(0),
    lpPositions: [] as any[],
    swapCount: 0,
    earnings: {
      '24h': BigInt(0),
      '7d': BigInt(0),
      '30d': BigInt(0)
    }
  };

  for (const address of normalizedAddresses) {
    const lpPositions = await prisma.liquidityPosition.findMany({
      where: {
        owner: address,
        liquidity: {
          gt: '0'
        }
      }
    });

    const swaps = await prisma.swap.findMany({
      where: {
        sender: address
      }
    });

    aggregatedData.swapCount += swaps.length;

    // Calculate fees for this address
    for (const position of lpPositions) {
      const pool = await prisma.pool.findUnique({ where: { id: position.poolId } });
      if (!pool) continue;
      const userLiquidity = BigInt(position.liquidity);
      const totalLiquidity = BigInt(pool.totalSupply || '0');

      if (totalLiquidity > 0) {
        const sharePercent = Number(userLiquidity) / Number(totalLiquidity);

        const poolSwaps = await prisma.swap.findMany({
          where: {
            poolId: pool.id
          }
        });

        let poolVolume = BigInt(0);
        for (const swap of poolSwaps) {
          const amount0 = BigInt(swap.amount0In || '0');
          const amount1 = BigInt(swap.amount1In || '0');
          poolVolume += amount0 + amount1;
        }

        const poolFees = (poolVolume * BigInt(3)) / BigInt(1000);
        const userFees = BigInt(Math.floor(Number(poolFees) * sharePercent));
        aggregatedData.totalFeesEarned += userFees;

        aggregatedData.lpPositions.push({
          address,
          poolId: pool.id,
          token0: pool.token0Address,
          token1: pool.token1Address,
          liquidity: position.liquidity,
          sharePercent: (sharePercent * 100).toFixed(4),
          feesEarned: userFees.toString()
        });
      }
    }

    // Calculate swap volume
    for (const swap of swaps) {
      const amount0 = BigInt(swap.amount0In || '0');
      const amount1 = BigInt(swap.amount1In || '0');
      aggregatedData.totalSwapVolume += amount0 + amount1;
    }
  }

  res.json({
    success: true,
    data: {
      ...aggregatedData,
      totalFeesEarned: aggregatedData.totalFeesEarned.toString(),
      totalSwapVolume: aggregatedData.totalSwapVolume.toString(),
      earnings: {
        '24h': aggregatedData.earnings['24h'].toString(),
        '7d': aggregatedData.earnings['7d'].toString(),
        '30d': aggregatedData.earnings['30d'].toString()
      },
      lastUpdated: new Date().toISOString()
    },
    correlationId: req.correlationId
  });
}));

export { router as portfolioRouter };
