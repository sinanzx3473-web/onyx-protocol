/**
 * @swagger
 * tags:
 *   name: Relay
 *   description: Gasless transaction relay service using EIP-712 signatures
 */

import { Router, Request, Response } from 'express';
import { verifyTypedData, Address } from 'viem';
import { sepolia, mainnet, polygon, arbitrum, optimism, base } from 'viem/chains';
import { redis } from '../middleware/rateLimiter.js';
import { relayerConfig } from '../config/relayer.js';
import { validateSwapMessage, validateLiquidityMessage, ValidationError } from '../validators/relay-tx.validator.js';

const router: Router = Router();

// Chain configuration
const CHAIN_MAP: Record<number, any> = {
  1: mainnet,
  11155111: sepolia,
  137: polygon,
  42161: arbitrum,
  10: optimism,
  8453: base,
};

// Anti-spam: Track nonces per user
const NONCE_EXPIRY = 5 * 60; // 5 minutes

interface SwapMessage {
  from: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  amountOutMin: string;
  deadline: number;
  nonce: number;
}

interface LiquidityMessage {
  from: Address;
  tokenA: Address;
  tokenB: Address;
  amountA: string;
  amountB: string;
  amountAMin: string;
  amountBMin: string;
  deadline: number;
  action: 'add' | 'remove';
  nonce: number;
}

// EIP-712 domain
const getDomain = (chainId: number) => ({
  name: 'DEX Meta-Transaction',
  version: '1',
  chainId: BigInt(chainId),
  verifyingContract: '0x0000000000000000000000000000000000000000' as Address,
});

// Verify signature and check nonce
async function verifyAndCheckNonce(
  message: any,
  signature: `0x${string}`,
  types: any,
  primaryType: string,
  chainId: number
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Verify signature
    const valid = await verifyTypedData({
      address: message.from,
      domain: getDomain(chainId),
      types,
      primaryType,
      message,
      signature,
    });

    if (!valid) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Check nonce hasn't been used (anti-replay)
    const nonceKey = `nonce:${message.from}:${message.nonce}`;
    const nonceExists = await redis.get(nonceKey);

    if (nonceExists) {
      return { valid: false, error: 'Nonce already used' };
    }

    // Store nonce with expiry
    await redis.setex(nonceKey, NONCE_EXPIRY, '1');

    return { valid: true };
  } catch (error: any) {
    console.error('Signature verification error:', error);
    return { valid: false, error: error.message };
  }
}

/**
 * @swagger
 * /api/relay-tx:
 *   post:
 *     summary: Relay gasless transaction
 *     description: Relays swap or liquidity transactions on behalf of users using EIP-712 signatures for gasless execution
 *     tags: [Relay]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required:
 *                   - type
 *                   - message
 *                   - signature
 *                   - chainId
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [swap]
 *                     example: 'swap'
 *                   message:
 *                     type: object
 *                     required:
 *                       - from
 *                       - tokenIn
 *                       - tokenOut
 *                       - amountIn
 *                       - amountOutMin
 *                       - deadline
 *                       - nonce
 *                     properties:
 *                       from:
 *                         type: string
 *                         pattern: '^0x[a-fA-F0-9]{40}$'
 *                       tokenIn:
 *                         type: string
 *                         pattern: '^0x[a-fA-F0-9]{40}$'
 *                       tokenOut:
 *                         type: string
 *                         pattern: '^0x[a-fA-F0-9]{40}$'
 *                       amountIn:
 *                         type: string
 *                         pattern: '^\\d+$'
 *                       amountOutMin:
 *                         type: string
 *                         pattern: '^\\d+$'
 *                       deadline:
 *                         type: integer
 *                         description: Unix timestamp
 *                       nonce:
 *                         type: integer
 *                   signature:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]{130}$'
 *                     description: EIP-712 signature
 *                   chainId:
 *                     type: integer
 *                     example: 11155111
 *               - type: object
 *                 required:
 *                   - type
 *                   - message
 *                   - signature
 *                   - chainId
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [liquidity]
 *                     example: 'liquidity'
 *                   message:
 *                     type: object
 *                     required:
 *                       - from
 *                       - tokenA
 *                       - tokenB
 *                       - amountA
 *                       - amountB
 *                       - amountAMin
 *                       - amountBMin
 *                       - deadline
 *                       - action
 *                       - nonce
 *                     properties:
 *                       from:
 *                         type: string
 *                         pattern: '^0x[a-fA-F0-9]{40}$'
 *                       tokenA:
 *                         type: string
 *                         pattern: '^0x[a-fA-F0-9]{40}$'
 *                       tokenB:
 *                         type: string
 *                         pattern: '^0x[a-fA-F0-9]{40}$'
 *                       amountA:
 *                         type: string
 *                         pattern: '^\\d+$'
 *                       amountB:
 *                         type: string
 *                         pattern: '^\\d+$'
 *                       amountAMin:
 *                         type: string
 *                         pattern: '^\\d+$'
 *                       amountBMin:
 *                         type: string
 *                         pattern: '^\\d+$'
 *                       deadline:
 *                         type: integer
 *                       action:
 *                         type: string
 *                         enum: [add, remove]
 *                       nonce:
 *                         type: integer
 *                   signature:
 *                     type: string
 *                     pattern: '^0x[a-fA-F0-9]{130}$'
 *                   chainId:
 *                     type: integer
 *     responses:
 *       200:
 *         description: Transaction relayed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 txHash:
 *                   type: string
 *                   description: Transaction hash
 *                 relayer:
 *                   type: string
 *                   description: Relayer address
 *                 gasUsed:
 *                   type: string
 *       400:
 *         description: Invalid request or signature
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 details:
 *                   type: array
 *                   items:
 *                     type: object
 *       503:
 *         description: Relayer service not configured
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 */
// Relay swap transaction
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, message, signature, chainId } = req.body;

    // Validate request
    if (!type || !message || !signature || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, message, signature, chainId',
      });
    }

    // Validate and sanitize message based on type
    let validatedMessage: any;
    try {
      if (type === 'swap') {
        validatedMessage = validateSwapMessage(message);
      } else if (type === 'liquidity') {
        validatedMessage = validateLiquidityMessage(message);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid transaction type. Must be "swap" or "liquidity"',
        });
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid message format',
          details: error.errors,
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid message format',
      });
    }

    if (!relayerConfig.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Relayer service not configured',
      });
    }

    // Get chain
    const chain = CHAIN_MAP[chainId];
    if (!chain) {
      return res.status(400).json({
        success: false,
        error: `Unsupported chain ID: ${chainId}`,
      });
    }

    // Get relayer account from secure config
    const relayerAccount = relayerConfig.getAccount()!;

    // Create wallet client (for future use)
    // const walletClient = createWalletClient({
    //   account: relayerAccount,
    //   chain,
    //   transport: http(RPC_URL),
    // }).extend(publicActions);

    // Handle different transaction types
    if (type === 'swap') {
      const swapMessage = validatedMessage as SwapMessage;

      // Verify signature and nonce
      const verification = await verifyAndCheckNonce(
        swapMessage,
        signature,
        {
          SwapRequest: [
            { name: 'from', type: 'address' },
            { name: 'tokenIn', type: 'address' },
            { name: 'tokenOut', type: 'address' },
            { name: 'amountIn', type: 'uint256' },
            { name: 'amountOutMin', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
          ],
        },
        'SwapRequest',
        chainId
      );

      if (!verification.valid) {
        return res.status(400).json({
          success: false,
          error: verification.error || 'Invalid signature',
        });
      }

      // Check deadline
      if (swapMessage.deadline < Math.floor(Date.now() / 1000)) {
        return res.status(400).json({
          success: false,
          error: 'Transaction deadline has passed',
        });
      }

      // TODO: Execute swap via forwarder contract
      // For now, return mock response
      const mockTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;

      // Log sanitized transaction (safe to log after validation)
      console.log('📤 Relaying swap transaction:', {
        from: swapMessage.from,
        tokenIn: swapMessage.tokenIn,
        tokenOut: swapMessage.tokenOut,
        amountIn: swapMessage.amountIn,
        relayer: relayerAccount.address,
      });

      return res.json({
        success: true,
        txHash: mockTxHash,
        relayer: relayerAccount.address,
        gasUsed: '150000', // Mock gas
      });
    } else if (type === 'liquidity') {
      const liquidityMessage = validatedMessage as LiquidityMessage;

      // Verify signature and nonce
      const verification = await verifyAndCheckNonce(
        liquidityMessage,
        signature,
        {
          LiquidityRequest: [
            { name: 'from', type: 'address' },
            { name: 'tokenA', type: 'address' },
            { name: 'tokenB', type: 'address' },
            { name: 'amountA', type: 'uint256' },
            { name: 'amountB', type: 'uint256' },
            { name: 'amountAMin', type: 'uint256' },
            { name: 'amountBMin', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
            { name: 'action', type: 'string' },
            { name: 'nonce', type: 'uint256' },
          ],
        },
        'LiquidityRequest',
        chainId
      );

      if (!verification.valid) {
        return res.status(400).json({
          success: false,
          error: verification.error || 'Invalid signature',
        });
      }

      // Check deadline
      if (liquidityMessage.deadline < Math.floor(Date.now() / 1000)) {
        return res.status(400).json({
          success: false,
          error: 'Transaction deadline has passed',
        });
      }

      // TODO: Execute liquidity action via forwarder contract
      const mockTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;

      console.log('📤 Relaying liquidity transaction:', {
        from: liquidityMessage.from,
        action: liquidityMessage.action,
        tokenA: liquidityMessage.tokenA,
        tokenB: liquidityMessage.tokenB,
        relayer: relayerAccount.address,
      });

      return res.json({
        success: true,
        txHash: mockTxHash,
        relayer: relayerAccount.address,
        gasUsed: '200000', // Mock gas
      });
    } else {
      return res.status(400).json({
        success: false,
        error: `Unsupported transaction type: ${type}`,
      });
    }
  } catch (error: any) {
    console.error('Relay transaction error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

export default router;
export { router as relayTxRouter };
