import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { asyncHandler, ErrorCodes } from '../middleware/errorHandler.js';
import { validateSchema, schemas } from '../middleware/validation.js';
import { logger } from '../middleware/correlationId.js';

/**
 * @swagger
 * /api/gas-estimate:
 *   post:
 *     summary: Estimate gas for operations
 *     description: Returns gas price estimates for swap, add liquidity, or remove liquidity operations
 *     tags: [Gas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operation
 *             properties:
 *               operation:
 *                 type: string
 *                 enum: [swap, addLiquidity, removeLiquidity]
 *                 description: Type of operation to estimate gas for
 *               tokenA:
 *                 type: string
 *                 description: Address of first token
 *               tokenB:
 *                 type: string
 *                 description: Address of second token
 *               amount:
 *                 type: string
 *                 description: Amount for the operation
 *     responses:
 *       200:
 *         description: Gas estimate successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 gasEstimate:
 *                   type: string
 *                 gasPrice:
 *                   type: string
 *                 maxFeePerGas:
 *                   type: string
 *                 maxPriorityFeePerGas:
 *                   type: string
 *                 estimatedCost:
 *                   type: string
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

const router: Router = Router();

// Gas usage ranges for sanity checks
const GAS_RANGES = {
  swap: { min: 100000, max: 250000, typical: 150000 },
  addLiquidity: { min: 150000, max: 350000, typical: 200000 },
  removeLiquidity: { min: 120000, max: 300000, typical: 180000 }
} as const;

// RPC endpoints with fallbacks
const RPC_ENDPOINTS = [
  process.env.RPC_URL,
  process.env.RPC_URL_FALLBACK,
  'https://eth-sepolia.g.alchemy.com/v2/demo'
].filter(Boolean) as string[];

let currentRpcIndex = 0;

const getProvider = async (): Promise<ethers.JsonRpcProvider> => {
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const rpcUrl = RPC_ENDPOINTS[(currentRpcIndex + i) % RPC_ENDPOINTS.length];
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      // Test connection
      await provider.getBlockNumber();
      currentRpcIndex = (currentRpcIndex + i) % RPC_ENDPOINTS.length;
      return provider;
    } catch (error) {
      logger.warn(`RPC endpoint ${rpcUrl} failed, trying next`, { error: error instanceof Error ? error.message : 'Unknown error' });
      continue;
    }
  }
  throw new Error('All RPC endpoints unavailable');
};

router.post('/', validateSchema(schemas.gasEstimate), asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { operation, tokenA, tokenB, amount } = req.body;
  const correlationId = req.correlationId;

  logger.info('Gas estimation request', {
    operation,
    tokenA,
    tokenB,
    amount,
    correlationId
  }, correlationId);

  // Get best available RPC provider
  let provider: ethers.JsonRpcProvider;
  try {
    provider = await getProvider();
  } catch (error) {
    logger.error('Failed to connect to any RPC endpoint', error as Error, {}, correlationId);
    res.status(503).json({
      success: false,
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message: 'Gas estimation service temporarily unavailable',
      correlationId
    });
    return;
  }

  // Get current gas price
  const feeData = await provider.getFeeData();
  
  // Get gas range for operation
  const gasRange = GAS_RANGES[operation as keyof typeof GAS_RANGES];
  let estimatedGas = BigInt(gasRange.typical);
  
  // Sanity check: ensure gas is within expected range
  if (estimatedGas < BigInt(gasRange.min)) {
    logger.warn('Gas estimate below minimum, adjusting', {
      operation,
      estimated: estimatedGas.toString(),
      min: gasRange.min
    }, correlationId);
    estimatedGas = BigInt(gasRange.min);
  } else if (estimatedGas > BigInt(gasRange.max)) {
    logger.warn('Gas estimate above maximum, adjusting', {
      operation,
      estimated: estimatedGas.toString(),
      max: gasRange.max
    }, correlationId);
    estimatedGas = BigInt(gasRange.max);
  }

  const gasPrice = feeData.gasPrice || BigInt(0);
  const maxFeePerGas = feeData.maxFeePerGas || gasPrice;
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || BigInt(0);

  const estimatedCost = estimatedGas * gasPrice;

  logger.info('Gas estimation completed', {
    operation,
    estimatedGas: estimatedGas.toString(),
    gasPrice: gasPrice.toString()
  }, correlationId);

  res.json({
    success: true,
    data: {
      operation,
      estimatedGas: estimatedGas.toString(),
      gasPrice: gasPrice.toString(),
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
      estimatedCostWei: estimatedCost.toString(),
      estimatedCostEth: ethers.formatEther(estimatedCost),
      gasRange: {
        min: gasRange.min.toString(),
        max: gasRange.max.toString()
      },
      timestamp: new Date().toISOString()
    },
    correlationId
  });
  return;
}));

export { router as gasRouter };
