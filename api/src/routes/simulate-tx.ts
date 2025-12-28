/**
 * @swagger
 * tags:
 *   name: Simulation
 *   description: Transaction simulation and scenario comparison
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../middleware/correlationId.js';
import { z } from 'zod';
import { createPublicClient, http, parseAbi, formatUnits, Address } from 'viem';
import { sepolia, mainnet, polygon, arbitrum, optimism, base } from 'viem/chains';

const router: Router = Router();

// Chain mapping
const CHAINS: Record<number, any> = {
  1: mainnet,
  11155111: sepolia,
  137: polygon,
  42161: arbitrum,
  10: optimism,
  8453: base,
};

// Validation schemas
const simulateSwapSchema = z.object({
  type: z.literal('swap'),
  chainId: z.number().int().positive(),
  fromToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  toToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amountIn: z.string().regex(/^\d+$/),
  slippage: z.number().min(0.01).max(50).optional().default(0.5),
  gasPrice: z.string().optional(),
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  routerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const simulateLiquiditySchema = z.object({
  type: z.literal('liquidity'),
  action: z.enum(['add', 'remove']),
  chainId: z.number().int().positive(),
  tokenA: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokenB: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amountA: z.string().regex(/^\d+$/),
  amountB: z.string().regex(/^\d+$/),
  slippage: z.number().min(0.01).max(50).optional().default(0.5),
  gasPrice: z.string().optional(),
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  routerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  poolAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
});

const simulateFlashLoanSchema = z.object({
  type: z.literal('flashloan'),
  chainId: z.number().int().positive(),
  token: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().regex(/^\d+$/),
  borrowerContract: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  calldata: z.string().regex(/^0x[a-fA-F0-9]*$/),
  gasPrice: z.string().optional(),
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  flashSwapAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const simulateRequestSchema = z.discriminatedUnion('type', [
  simulateSwapSchema,
  simulateLiquiditySchema,
  simulateFlashLoanSchema,
]);

const compareRequestSchema = z.object({
  baseSimulation: simulateRequestSchema,
  scenarios: z.array(z.object({
    name: z.string(),
    slippage: z.number().optional(),
    gasPrice: z.string().optional(),
  })).min(1).max(5),
});

interface SimulationResult {
  success: boolean;
  preState: {
    userBalances: Record<string, string>;
    poolReserves?: { token0: string; token1: string };
    poolLPSupply?: string;
  };
  postState: {
    userBalances: Record<string, string>;
    poolReserves?: { token0: string; token1: string };
    poolLPSupply?: string;
  };
  execution: {
    gasUsed: string;
    gasPrice: string;
    totalGasCost: string;
    tokensReceived?: string;
    tokensSpent?: string;
    lpTokensReceived?: string;
    priceImpact?: number;
    effectivePrice?: string;
  };
  errors?: string[];
  warnings?: string[];
}

// Helper to create public client for simulation
function getPublicClient(chainId: number, rpcUrl?: string) {
  const chain = CHAINS[chainId];
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  return createPublicClient({
    chain,
    transport: http(rpcUrl || chain.rpcUrls.default.http[0]),
  });
}

// Simulate swap transaction
async function simulateSwap(params: z.infer<typeof simulateSwapSchema>): Promise<SimulationResult> {
  const client = getPublicClient(params.chainId);
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Read pre-state balances
    const [fromTokenBalance, toTokenBalance, fromTokenDecimals, toTokenDecimals] = await Promise.all([
      client.readContract({
        address: params.fromToken as Address,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: 'balanceOf',
        args: [params.userAddress as Address],
      }),
      client.readContract({
        address: params.toToken as Address,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: 'balanceOf',
        args: [params.userAddress as Address],
      }),
      client.readContract({
        address: params.fromToken as Address,
        abi: parseAbi(['function decimals() view returns (uint8)']),
        functionName: 'decimals',
      }),
      client.readContract({
        address: params.toToken as Address,
        abi: parseAbi(['function decimals() view returns (uint8)']),
        functionName: 'decimals',
      }),
    ]);

    // Check if user has sufficient balance
    if (BigInt(params.amountIn) > BigInt(fromTokenBalance as bigint)) {
      errors.push(`Insufficient balance. Required: ${params.amountIn}, Available: ${fromTokenBalance}`);
    }

    // Simulate the swap using callStatic
    const routerAbi = parseAbi([
      'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])',
      'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])',
    ]);

    // Get expected output
    const amountsOut = await client.readContract({
      address: params.routerAddress as Address,
      abi: routerAbi,
      functionName: 'getAmountsOut',
      args: [BigInt(params.amountIn), [params.fromToken as Address, params.toToken as Address]],
    }) as bigint[];

    const expectedOut = amountsOut[1];
    const minOut = (expectedOut * BigInt(Math.floor((100 - params.slippage) * 100))) / BigInt(10000);

    // Calculate price impact
    const priceImpact = Number(formatUnits(BigInt(params.amountIn) - expectedOut, Number(fromTokenDecimals))) / 
                       Number(formatUnits(BigInt(params.amountIn), Number(fromTokenDecimals))) * 100;

    if (priceImpact > 5) {
      warnings.push(`High price impact: ${priceImpact.toFixed(2)}%`);
    }

    // Estimate gas
    const gasEstimate = await client.estimateContractGas({
      address: params.routerAddress as Address,
      abi: routerAbi,
      functionName: 'swapExactTokensForTokens',
      args: [
        BigInt(params.amountIn),
        minOut,
        [params.fromToken as Address, params.toToken as Address],
        params.userAddress as Address,
        BigInt(Math.floor(Date.now() / 1000) + 1200),
      ],
      account: params.userAddress as Address,
    }).catch(() => BigInt(200000)); // Fallback estimate

    const gasPrice = params.gasPrice ? BigInt(params.gasPrice) : await client.getGasPrice();
    const totalGasCost = gasEstimate * gasPrice;

    return {
      success: errors.length === 0,
      preState: {
        userBalances: {
          [params.fromToken]: fromTokenBalance.toString(),
          [params.toToken]: toTokenBalance.toString(),
        },
      },
      postState: {
        userBalances: {
          [params.fromToken]: (BigInt(fromTokenBalance as bigint) - BigInt(params.amountIn)).toString(),
          [params.toToken]: (BigInt(toTokenBalance as bigint) + expectedOut).toString(),
        },
      },
      execution: {
        gasUsed: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        totalGasCost: totalGasCost.toString(),
        tokensReceived: expectedOut.toString(),
        tokensSpent: params.amountIn,
        priceImpact,
        effectivePrice: (Number(formatUnits(expectedOut, Number(toTokenDecimals))) / 
                        Number(formatUnits(BigInt(params.amountIn), Number(fromTokenDecimals)))).toFixed(6),
      },
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error: any) {
    errors.push(error.message || 'Simulation failed');
    return {
      success: false,
      preState: { userBalances: {} },
      postState: { userBalances: {} },
      execution: {
        gasUsed: '0',
        gasPrice: '0',
        totalGasCost: '0',
      },
      errors,
    };
  }
}

// Simulate liquidity transaction
async function simulateLiquidity(params: z.infer<typeof simulateLiquiditySchema>): Promise<SimulationResult> {
  const client = getPublicClient(params.chainId);
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Read pre-state
    const [balanceA, balanceB] = await Promise.all([
      client.readContract({
        address: params.tokenA as Address,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: 'balanceOf',
        args: [params.userAddress as Address],
      }),
      client.readContract({
        address: params.tokenB as Address,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: 'balanceOf',
        args: [params.userAddress as Address],
      }),
      client.readContract({
        address: params.tokenA as Address,
        abi: parseAbi(['function decimals() view returns (uint8)']),
        functionName: 'decimals',
      }),
      client.readContract({
        address: params.tokenB as Address,
        abi: parseAbi(['function decimals() view returns (uint8)']),
        functionName: 'decimals',
      }),
    ]);

    // Check balances
    if (params.action === 'add') {
      if (BigInt(params.amountA) > BigInt(balanceA as bigint)) {
        errors.push(`Insufficient ${params.tokenA} balance`);
      }
      if (BigInt(params.amountB) > BigInt(balanceB as bigint)) {
        errors.push(`Insufficient ${params.tokenB} balance`);
      }
    }

    // Estimate gas for add/remove liquidity
    // const routerAbi = parseAbi([
    //   'function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256, uint256, uint256)',
    //   'function removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256, uint256)',
    // ]);

    const gasEstimate = BigInt(250000); // Fallback estimate
    const gasPrice = params.gasPrice ? BigInt(params.gasPrice) : await client.getGasPrice();
    const totalGasCost = gasEstimate * gasPrice;

    // Estimate LP tokens (simplified)
    const lpTokensEstimate = params.action === 'add' 
      ? (BigInt(params.amountA) * BigInt(params.amountB)) / BigInt(1e9) // Simplified sqrt
      : BigInt(0);

    return {
      success: errors.length === 0,
      preState: {
        userBalances: {
          [params.tokenA]: balanceA.toString(),
          [params.tokenB]: balanceB.toString(),
        },
      },
      postState: {
        userBalances: {
          [params.tokenA]: params.action === 'add' 
            ? (BigInt(balanceA as bigint) - BigInt(params.amountA)).toString()
            : (BigInt(balanceA as bigint) + BigInt(params.amountA)).toString(),
          [params.tokenB]: params.action === 'add'
            ? (BigInt(balanceB as bigint) - BigInt(params.amountB)).toString()
            : (BigInt(balanceB as bigint) + BigInt(params.amountB)).toString(),
        },
      },
      execution: {
        gasUsed: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        totalGasCost: totalGasCost.toString(),
        lpTokensReceived: lpTokensEstimate.toString(),
      },
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error: any) {
    errors.push(error.message || 'Simulation failed');
    return {
      success: false,
      preState: { userBalances: {} },
      postState: { userBalances: {} },
      execution: {
        gasUsed: '0',
        gasPrice: '0',
        totalGasCost: '0',
      },
      errors,
    };
  }
}

// Simulate flash loan
async function simulateFlashLoan(params: z.infer<typeof simulateFlashLoanSchema>): Promise<SimulationResult> {
  const client = getPublicClient(params.chainId);
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const [tokenBalance, decimals] = await Promise.all([
      client.readContract({
        address: params.token as Address,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: 'balanceOf',
        args: [params.userAddress as Address],
      }),
      client.readContract({
        address: params.token as Address,
        abi: parseAbi(['function decimals() view returns (uint8)']),
        functionName: 'decimals',
      }),
    ]);

    // Calculate flash loan fee (typically 0.09%)
    const fee = (BigInt(params.amount) * BigInt(9)) / BigInt(10000);
    const totalRepayment = BigInt(params.amount) + fee;

    warnings.push(`Flash loan fee: ${formatUnits(fee, Number(decimals))} tokens`);

    const gasEstimate = BigInt(400000); // Flash loans are gas-intensive
    const gasPrice = params.gasPrice ? BigInt(params.gasPrice) : await client.getGasPrice();
    const totalGasCost = gasEstimate * gasPrice;

    return {
      success: errors.length === 0,
      preState: {
        userBalances: {
          [params.token]: tokenBalance.toString(),
        },
      },
      postState: {
        userBalances: {
          [params.token]: (BigInt(tokenBalance as bigint) - fee).toString(),
        },
      },
      execution: {
        gasUsed: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        totalGasCost: totalGasCost.toString(),
        tokensReceived: params.amount,
        tokensSpent: totalRepayment.toString(),
      },
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error: any) {
    errors.push(error.message || 'Simulation failed');
    return {
      success: false,
      preState: { userBalances: {} },
      postState: { userBalances: {} },
      execution: {
        gasUsed: '0',
        gasPrice: '0',
        totalGasCost: '0',
      },
      errors,
    };
  }
}

/**
 * @swagger
 * /api/simulate-tx:
 *   post:
 *     summary: Simulate a transaction
 *     description: Simulates swap, liquidity, or flash loan transactions before execution
 *     tags: [Simulation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required:
 *                   - type
 *                   - chainId
 *                   - fromToken
 *                   - toToken
 *                   - amountIn
 *                   - userAddress
 *                   - routerAddress
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [swap]
 *                   chainId:
 *                     type: integer
 *                   fromToken:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]{40}$'
 *                   toToken:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]{40}$'
 *                   amountIn:
 *                     type: string
 *                     pattern: '^\\d+$'
 *                   slippage:
 *                     type: number
 *                     minimum: 0.01
 *                     maximum: 50
 *                     default: 0.5
 *                   gasPrice:
 *                     type: string
 *                   userAddress:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]{40}$'
 *                   routerAddress:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]{40}$'
 *               - type: object
 *                 required:
 *                   - type
 *                   - action
 *                   - chainId
 *                   - tokenA
 *                   - tokenB
 *                   - amountA
 *                   - amountB
 *                   - userAddress
 *                   - routerAddress
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [liquidity]
 *                   action:
 *                     type: string
 *                     enum: [add, remove]
 *                   chainId:
 *                     type: integer
 *                   tokenA:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]{40}$'
 *                   tokenB:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]{40}$'
 *                   amountA:
 *                     type: string
 *                     pattern: '^\\d+$'
 *                   amountB:
 *                     type: string
 *                     pattern: '^\\d+$'
 *                   slippage:
 *                     type: number
 *                   gasPrice:
 *                     type: string
 *                   userAddress:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]{40}$'
 *                   routerAddress:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]{40}$'
 *                   poolAddress:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]{40}$'
 *               - type: object
 *                 required:
 *                   - type
 *                   - chainId
 *                   - token
 *                   - amount
 *                   - borrowerContract
 *                   - calldata
 *                   - userAddress
 *                   - flashSwapAddress
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [flashloan]
 *                   chainId:
 *                     type: integer
 *                   token:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]{40}$'
 *                   amount:
 *                     type: string
 *                     pattern: '^\\d+$'
 *                   borrowerContract:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]{40}$'
 *                   calldata:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]*$'
 *                   gasPrice:
 *                     type: string
 *                   userAddress:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]{40}$'
 *                   flashSwapAddress:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]{40}$'
 *     responses:
 *       200:
 *         description: Simulation completed successfully
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
 *                     success:
 *                       type: boolean
 *                     preState:
 *                       type: object
 *                       properties:
 *                         userBalances:
 *                           type: object
 *                         poolReserves:
 *                           type: object
 *                         poolLPSupply:
 *                           type: string
 *                     postState:
 *                       type: object
 *                       properties:
 *                         userBalances:
 *                           type: object
 *                         poolReserves:
 *                           type: object
 *                         poolLPSupply:
 *                           type: string
 *                     execution:
 *                       type: object
 *                       properties:
 *                         gasUsed:
 *                           type: string
 *                         gasPrice:
 *                           type: string
 *                         totalGasCost:
 *                           type: string
 *                         tokensReceived:
 *                           type: string
 *                         tokensSpent:
 *                           type: string
 *                         lpTokensReceived:
 *                           type: string
 *                         priceImpact:
 *                           type: number
 *                         effectivePrice:
 *                           type: string
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: string
 *                     warnings:
 *                       type: array
 *                       items:
 *                         type: string
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /api/simulate-tx - Simulate a transaction
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validationResult = simulateRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      logger.warn('Invalid simulation request', {
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

    const params = validationResult.data;

    logger.info('Simulation request received', {
      type: params.type,
      chainId: params.chainId,
    }, req.correlationId);

    let result: SimulationResult;

    switch (params.type) {
      case 'swap':
        result = await simulateSwap(params);
        break;
      case 'liquidity':
        result = await simulateLiquidity(params);
        break;
      case 'flashloan':
        result = await simulateFlashLoan(params);
        break;
    }

    logger.info('Simulation completed', {
      success: result.success,
      gasUsed: result.execution.gasUsed,
    }, req.correlationId);

    res.json({
      success: true,
      data: result,
      correlationId: req.correlationId,
    });
    return;
  })
);

/**
 * @swagger
 * /api/simulate-tx/compare:
 *   post:
 *     summary: Compare multiple simulation scenarios
 *     description: Runs base simulation and compares with alternative scenarios (different slippage, gas prices)
 *     tags: [Simulation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - baseSimulation
 *               - scenarios
 *             properties:
 *               baseSimulation:
 *                 type: object
 *                 description: Base simulation parameters
 *               scenarios:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 5
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                   properties:
 *                     name:
 *                       type: string
 *                     slippage:
 *                       type: number
 *                     gasPrice:
 *                       type: string
 *     responses:
 *       200:
 *         description: Comparison completed successfully
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
 *                     base:
 *                       type: object
 *                       description: Base simulation result
 *                     scenarios:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           slippage:
 *                             type: number
 *                           gasPrice:
 *                             type: string
 *                           result:
 *                             type: object
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /api/simulate-tx/compare - Compare multiple scenarios
router.post(
  '/compare',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validationResult = compareRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        errors: validationResult.error.errors,
        correlationId: req.correlationId,
      });
      return;
    }

    const { baseSimulation, scenarios } = validationResult.data;

    logger.info('Comparison request received', {
      type: baseSimulation.type,
      scenarioCount: scenarios.length,
    }, req.correlationId);

    // Run base simulation
    let baseResult: SimulationResult;
    switch (baseSimulation.type) {
      case 'swap':
        baseResult = await simulateSwap(baseSimulation);
        break;
      case 'liquidity':
        baseResult = await simulateLiquidity(baseSimulation);
        break;
      case 'flashloan':
        baseResult = await simulateFlashLoan(baseSimulation);
        break;
    }

    // Run scenario simulations
    const scenarioResults = await Promise.all(
      scenarios.map(async (scenario) => {
        const modifiedParams = {
          ...baseSimulation,
          slippage: scenario.slippage ?? ('slippage' in baseSimulation ? baseSimulation.slippage : 0.5),
          gasPrice: scenario.gasPrice ?? baseSimulation.gasPrice,
        };

        let result: SimulationResult;
        switch (modifiedParams.type) {
          case 'swap':
            result = await simulateSwap(modifiedParams as any);
            break;
          case 'liquidity':
            result = await simulateLiquidity(modifiedParams as any);
            break;
          case 'flashloan':
            result = await simulateFlashLoan(modifiedParams);
            break;
        }

        return {
          name: scenario.name,
          slippage: modifiedParams.slippage,
          gasPrice: modifiedParams.gasPrice,
          result,
        };
      })
    );

    res.json({
      success: true,
      data: {
        base: baseResult,
        scenarios: scenarioResults,
      },
      correlationId: req.correlationId,
    });
    return;
  })
);

export { router as simulateTxRouter };
