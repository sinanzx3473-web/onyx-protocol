/**
 * @swagger
 * tags:
 *   name: Quote
 *   description: Swap price quotes and route optimization
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../middleware/correlationId.js';
import { z } from 'zod';

const router: Router = Router();

// Security constants for transaction simulation bounds
const MAX_GAS_LIMIT = 10_000_000; // 10M gas limit
const MAX_ETH_VALUE = BigInt('100000000000000000000'); // 100 ETH in wei
const MAX_AMOUNT_IN = BigInt('1000000000000000000000000'); // 1M tokens (18 decimals)

// Validation schema for quote request
const quoteRequestSchema = z.object({
  tokenIn: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  tokenOut: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  amountIn: z.string().regex(/^\d+$/, 'Invalid amount'),
  chainId: z.number().int().positive(),
  slippage: z.number().min(0.01).max(50).optional().default(0.5),
  gasLimit: z.number().int().positive().max(MAX_GAS_LIMIT).optional(),
  value: z.string().regex(/^\d+$/).optional(),
});

interface RouteStep {
  protocol: string;
  tokenIn: string;
  tokenOut: string;
  poolAddress?: string;
  amountIn: string;
  amountOut: string;
  fee: string;
}

interface Route {
  type: 'direct' | 'multi-hop' | 'external';
  steps: RouteStep[];
  totalAmountOut: string;
  totalGasEstimate: string;
  executionTime: number; // milliseconds
  priceImpact: number; // percentage
  route: string; // human-readable route description
}

interface QuoteResponse {
  bestRoute: Route;
  alternativeRoutes: Route[];
  quoteExpiry: number; // timestamp
  quoteLockDuration: number; // seconds
}

// Mock function to simulate on-chain pool quote
async function getDirectPoolQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  _chainId: number
): Promise<Route | null> {
  // In production, this would call the DEXRouter contract
  // For now, simulate a direct swap with 0.3% fee
  const amountInBigInt = BigInt(amountIn);
  const fee = (amountInBigInt * BigInt(3)) / BigInt(1000);
  const amountOut = amountInBigInt - fee;

  return {
    type: 'direct',
    steps: [
      {
        protocol: 'YourDEX',
        tokenIn,
        tokenOut,
        poolAddress: '0x0000000000000000000000000000000000000001',
        amountIn,
        amountOut: amountOut.toString(),
        fee: fee.toString(),
      },
    ],
    totalAmountOut: amountOut.toString(),
    totalGasEstimate: '150000', // ~150k gas
    executionTime: 15000, // 15 seconds
    priceImpact: 0.3,
    route: `${tokenIn.slice(0, 6)}...${tokenIn.slice(-4)} → ${tokenOut.slice(0, 6)}...${tokenOut.slice(-4)}`,
  };
}

// Mock function to simulate multi-hop routing
async function getMultiHopQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  _chainId: number
): Promise<Route | null> {
  // Simulate routing through an intermediate token (e.g., WETH or stablecoin)
  const intermediateToken = '0x0000000000000000000000000000000000000002';
  const amountInBigInt = BigInt(amountIn);

  // First hop: tokenIn → intermediate (0.3% fee)
  const fee1 = (amountInBigInt * BigInt(3)) / BigInt(1000);
  const intermediateAmount = amountInBigInt - fee1;

  // Second hop: intermediate → tokenOut (0.3% fee)
  const fee2 = (intermediateAmount * BigInt(3)) / BigInt(1000);
  const finalAmount = intermediateAmount - fee2;

  // Multi-hop typically has slightly worse output but may have better liquidity
  const adjustedFinalAmount = (finalAmount * BigInt(98)) / BigInt(100); // 2% worse than direct

  return {
    type: 'multi-hop',
    steps: [
      {
        protocol: 'YourDEX',
        tokenIn,
        tokenOut: intermediateToken,
        poolAddress: '0x0000000000000000000000000000000000000003',
        amountIn,
        amountOut: intermediateAmount.toString(),
        fee: fee1.toString(),
      },
      {
        protocol: 'YourDEX',
        tokenIn: intermediateToken,
        tokenOut,
        poolAddress: '0x0000000000000000000000000000000000000004',
        amountIn: intermediateAmount.toString(),
        amountOut: adjustedFinalAmount.toString(),
        fee: fee2.toString(),
      },
    ],
    totalAmountOut: adjustedFinalAmount.toString(),
    totalGasEstimate: '280000', // ~280k gas (2 swaps)
    executionTime: 25000, // 25 seconds
    priceImpact: 0.6,
    route: `${tokenIn.slice(0, 6)}...${tokenIn.slice(-4)} → WETH → ${tokenOut.slice(0, 6)}...${tokenOut.slice(-4)}`,
  };
}

// Mock function to simulate external DEX aggregator (e.g., 0x, 1inch)
async function getExternalDexQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  _chainId: number
): Promise<Route | null> {
  // Simulate calling an external aggregator API
  // In production, this would call 0x API, 1inch API, etc.
  const amountInBigInt = BigInt(amountIn);

  // External aggregators often find better routes
  const fee = (amountInBigInt * BigInt(25)) / BigInt(10000); // 0.25% fee
  const amountOut = (amountInBigInt - fee) * BigInt(102) / BigInt(100); // 2% better than direct

  return {
    type: 'external',
    steps: [
      {
        protocol: 'Uniswap V3',
        tokenIn,
        tokenOut,
        amountIn,
        amountOut: amountOut.toString(),
        fee: fee.toString(),
      },
    ],
    totalAmountOut: amountOut.toString(),
    totalGasEstimate: '180000', // ~180k gas
    executionTime: 18000, // 18 seconds
    priceImpact: 0.25,
    route: `${tokenIn.slice(0, 6)}...${tokenIn.slice(-4)} → ${tokenOut.slice(0, 6)}...${tokenOut.slice(-4)} (Uniswap V3)`,
  };
}

/**
 * @swagger
 * /api/quote:
 *   post:
 *     summary: Get best swap route with alternatives
 *     description: Returns the optimal swap route along with alternative routes for token swaps
 *     tags: [Quote]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokenIn
 *               - tokenOut
 *               - amountIn
 *               - chainId
 *             properties:
 *               tokenIn:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 description: Address of input token
 *                 example: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
 *               tokenOut:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 description: Address of output token
 *                 example: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
 *               amountIn:
 *                 type: string
 *                 pattern: '^\\d+$'
 *                 description: Amount of input token (in wei/smallest unit)
 *                 example: '1000000000000000000'
 *               chainId:
 *                 type: integer
 *                 description: Chain ID for the swap
 *                 example: 1
 *               slippage:
 *                 type: number
 *                 minimum: 0.01
 *                 maximum: 50
 *                 default: 0.5
 *                 description: Slippage tolerance percentage
 *                 example: 0.5
 *               gasLimit:
 *                 type: integer
 *                 maximum: 10000000
 *                 description: Optional gas limit
 *               value:
 *                 type: string
 *                 pattern: '^\\d+$'
 *                 description: ETH value to send with transaction (in wei)
 *     responses:
 *       200:
 *         description: Quote generated successfully
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
 *                     bestRoute:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                           enum: [direct, multi-hop, external]
 *                         steps:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               protocol:
 *                                 type: string
 *                               tokenIn:
 *                                 type: string
 *                               tokenOut:
 *                                 type: string
 *                               poolAddress:
 *                                 type: string
 *                               amountIn:
 *                                 type: string
 *                               amountOut:
 *                                 type: string
 *                               fee:
 *                                 type: string
 *                         totalAmountOut:
 *                           type: string
 *                         totalGasEstimate:
 *                           type: string
 *                         executionTime:
 *                           type: number
 *                         priceImpact:
 *                           type: number
 *                         route:
 *                           type: string
 *                     alternativeRoutes:
 *                       type: array
 *                       items:
 *                         type: object
 *                     quoteExpiry:
 *                       type: integer
 *                       description: Unix timestamp when quote expires
 *                     quoteLockDuration:
 *                       type: integer
 *                       description: Quote validity duration in seconds
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Invalid request parameters
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
 *                   example: 'VALIDATION_ERROR'
 *                 message:
 *                   type: string
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                 correlationId:
 *                   type: string
 *       404:
 *         description: No routes found for token pair
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
 *                   example: 'NO_ROUTES_FOUND'
 *                 message:
 *                   type: string
 *                 correlationId:
 *                   type: string
 */
// POST /api/quote - Get best swap route with alternatives
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validationResult = quoteRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      logger.warn('Invalid quote request', {
        errors: validationResult.error.errors,
      }, req.correlationId);

      res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        errors: validationResult.error.errors,
        correlationId: req.correlationId,
      });
      return;
    }

    const { tokenIn, tokenOut, amountIn, chainId, slippage: _slippage, gasLimit, value } = validationResult.data;

    // Security: Validate amountIn bounds
    const amountInBigInt = BigInt(amountIn);
    if (amountInBigInt > MAX_AMOUNT_IN) {
      logger.warn('Amount exceeds maximum allowed', {
        amountIn,
        max: MAX_AMOUNT_IN.toString(),
      }, req.correlationId);

      res.status(400).json({
        success: false,
        code: 'AMOUNT_TOO_HIGH',
        message: 'Amount exceeds maximum allowed value',
        correlationId: req.correlationId,
      });
      return;
    }

    // Security: Validate gas limit if provided
    if (gasLimit && gasLimit > MAX_GAS_LIMIT) {
      logger.warn('Gas limit exceeds maximum', {
        gasLimit,
        max: MAX_GAS_LIMIT,
      }, req.correlationId);

      res.status(400).json({
        success: false,
        code: 'GAS_LIMIT_TOO_HIGH',
        message: 'Gas limit exceeds maximum allowed',
        correlationId: req.correlationId,
      });
      return;
    }

    // Security: Validate ETH value if provided
    if (value) {
      const valueBigInt = BigInt(value);
      if (valueBigInt > MAX_ETH_VALUE) {
        logger.warn('Value exceeds maximum allowed', {
          value,
          max: MAX_ETH_VALUE.toString(),
        }, req.correlationId);

        res.status(400).json({
          success: false,
          code: 'VALUE_TOO_HIGH',
          message: 'Transaction value exceeds maximum allowed',
          correlationId: req.correlationId,
        });
        return;
      }
    }

    logger.info('Quote request received', {
      tokenIn,
      tokenOut,
      amountIn,
      chainId,
      slippage: _slippage,
    }, req.correlationId);

    // Fetch quotes from multiple sources in parallel
    const [directQuote, multiHopQuote, externalQuote] = await Promise.allSettled([
      getDirectPoolQuote(tokenIn, tokenOut, amountIn, chainId),
      getMultiHopQuote(tokenIn, tokenOut, amountIn, chainId),
      getExternalDexQuote(tokenIn, tokenOut, amountIn, chainId),
    ]);

    const routes: Route[] = [];

    if (directQuote.status === 'fulfilled' && directQuote.value) {
      routes.push(directQuote.value);
    }
    if (multiHopQuote.status === 'fulfilled' && multiHopQuote.value) {
      routes.push(multiHopQuote.value);
    }
    if (externalQuote.status === 'fulfilled' && externalQuote.value) {
      routes.push(externalQuote.value);
    }

    if (routes.length === 0) {
      logger.warn('No routes found', {
        tokenIn,
        tokenOut,
      }, req.correlationId);

      res.status(404).json({
        success: false,
        code: 'NO_ROUTES_FOUND',
        message: 'No swap routes available for this token pair',
        correlationId: req.correlationId,
      });
      return;
    }

    // Sort routes by total output (descending)
    routes.sort((a, b) => {
      const aOut = BigInt(a.totalAmountOut);
      const bOut = BigInt(b.totalAmountOut);
      return aOut > bOut ? -1 : aOut < bOut ? 1 : 0;
    });

    const bestRoute = routes[0];
    const alternativeRoutes = routes.slice(1);

    // Quote expires in 30 seconds
    const quoteExpiry = Date.now() + 30000;

    const response: QuoteResponse = {
      bestRoute,
      alternativeRoutes,
      quoteExpiry,
      quoteLockDuration: 30,
    };

    logger.info('Quote generated', {
      bestRouteType: bestRoute.type,
      bestAmountOut: bestRoute.totalAmountOut,
      alternativeCount: alternativeRoutes.length,
    }, req.correlationId);

    res.json({
      success: true,
      data: response,
      correlationId: req.correlationId,
    });
  })
);

/**
 * @swagger
 * /api/quote/health:
 *   get:
 *     summary: Quote service health check
 *     description: Returns health status of the quote service
 *     tags: [Quote]
 *     responses:
 *       200:
 *         description: Service is operational
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Quote service is operational'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
// GET /api/quote/health - Health check endpoint
router.get('/health', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    message: 'Quote service is operational',
    timestamp: new Date().toISOString(),
  });
}));

export { router as quoteRouter };
