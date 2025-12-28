/**
 * @swagger
 * tags:
 *   name: Limit Orders
 *   description: Limit order creation, management, and matching
 */

import express, { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyMessage } from 'viem';
import { timingSafeEqual } from 'crypto';
import { validateCreateLimitOrder, validateCancelOrder, validateGetUserOrdersQuery, ValidationError } from '../validators/limit-orders.validator.js';

const router: Router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/limit-orders:
 *   post:
 *     summary: Create a new limit order
 *     description: Creates a limit order with signature verification
 *     tags: [Limit Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userAddress
 *               - fromToken
 *               - toToken
 *               - fromAmount
 *               - targetPrice
 *               - minReceived
 *               - orderType
 *               - expiryHours
 *               - signature
 *               - nonce
 *             properties:
 *               userAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *               fromToken:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *               toToken:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *               fromAmount:
 *                 type: string
 *                 pattern: '^\\d+$'
 *               targetPrice:
 *                 type: string
 *                 pattern: '^\\d+(\\.\\d+)?$'
 *               minReceived:
 *                 type: string
 *                 pattern: '^\\d+$'
 *               orderType:
 *                 type: string
 *                 enum: [limit, stop-loss]
 *               expiryHours:
 *                 type: string
 *                 pattern: '^\\d+$'
 *               signature:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]+$'
 *               nonce:
 *                 type: string
 *                 pattern: '^\\d+$'
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LimitOrder'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Invalid signature
 */
// Create a new limit order
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate and sanitize input
    let validatedData;
    try {
      validatedData = validateCreateLimitOrder(req.body);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        const errors = error.errors.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        res.status(400).json({ error: 'Invalid input', details: errors });
        return;
      }
      res.status(400).json({ error: 'Invalid input format' });
      return;
    }

    const {
      userAddress,
      fromToken,
      toToken,
      fromAmount,
      targetPrice,
      minReceived,
      orderType,
      expiryHours,
      signature,
      nonce,
    } = validatedData;

    // Calculate expiry time
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + parseInt(expiryHours));

    // Verify signature
    const message = `Create ${orderType} order: ${fromAmount} ${fromToken} for ${targetPrice} ${toToken} per token. Nonce: ${nonce}`;
    try {
      const isValid = await verifyMessage({
        address: userAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    } catch (error) {
      res.status(401).json({ error: 'Signature verification failed' });
      return;
    }

    // Create order in database
    const order = await prisma.limitOrder.create({
      data: {
        userAddress,
        fromToken,
        toToken,
        fromAmount,
        targetPrice,
        minReceived,
        orderType,
        status: 'open',
        expiryTime,
        signature,
        nonce,
      },
    });

    res.status(201).json(order);
    return;
  } catch (error) {
    console.error('Error creating limit order:', error);
    res.status(500).json({ error: 'Failed to create limit order' });
    return;
  }
});

/**
 * @swagger
 * /api/limit-orders/user/{address}:
 *   get:
 *     summary: Get user's limit orders
 *     description: Returns all limit orders for a specific user address
 *     tags: [Limit Orders]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, filled, cancelled, expired]
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LimitOrder'
 *       400:
 *         description: Invalid address format
 */
// Get all orders for a user
router.get('/user/:address', async (req: Request, res: Response): Promise<void> => {
  try {
    const { address } = req.params;

    // Validate address format
    const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
    if (!ETH_ADDRESS_REGEX.test(address)) {
      res.status(400).json({ error: 'Invalid address format' });
      return;
    }

    // Validate query parameters
    let validatedQuery;
    try {
      validatedQuery = validateGetUserOrdersQuery(req.query);
    } catch (error: any) {
      res.status(400).json({ error: 'Invalid query parameters' });
      return;
    }

    const where: any = { userAddress: address };
    if (validatedQuery.status) {
      where.status = validatedQuery.status;
    }

    const orders = await prisma.limitOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
    return;
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
    return;
  }
});

/**
 * @swagger
 * /api/limit-orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     description: Returns a specific limit order by its ID
 *     tags: [Limit Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LimitOrder'
 *       404:
 *         description: Order not found
 */
// Get a specific order by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const order = await prisma.limitOrder.findUnique({
      where: { id },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.json(order);
    return;
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
    return;
  }
});

/**
 * @swagger
 * /api/limit-orders/{id}/cancel:
 *   post:
 *     summary: Cancel a limit order
 *     description: Cancels an open limit order with signature verification
 *     tags: [Limit Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userAddress
 *               - signature
 *             properties:
 *               userAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *               signature:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]+$'
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LimitOrder'
 *       400:
 *         description: Invalid request or order cannot be cancelled
 *       401:
 *         description: Invalid signature
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Order not found
 */
// Cancel an order
router.post('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Validate and sanitize input
    let validatedData;
    try {
      validatedData = validateCancelOrder(req.body);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        const errors = error.errors.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        res.status(400).json({ error: 'Invalid input', details: errors });
        return;
      }
      res.status(400).json({ error: 'Invalid input format' });
      return;
    }

    const { userAddress, signature } = validatedData;

    // Get the order
    const order = await prisma.limitOrder.findUnique({
      where: { id },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Verify ownership using constant-time comparison to prevent timing attacks
    try {
      const orderAddr = Buffer.from(order.userAddress.toLowerCase().slice(2), 'hex');
      const userAddr = Buffer.from(userAddress.toLowerCase().slice(2), 'hex');
      
      if (orderAddr.length !== userAddr.length || !timingSafeEqual(orderAddr, userAddr)) {
        res.status(403).json({ error: 'Not authorized to cancel this order' });
        return;
      }
    } catch (error) {
      res.status(400).json({ error: 'Invalid address format' });
      return;
    }

    // Check if order can be cancelled
    if (order.status !== 'open') {
      res.status(400).json({ error: `Cannot cancel order with status: ${order.status}` });
      return;
    }

    // Verify cancellation signature
    const message = `Cancel order ${id}`;
    try {
      const isValid = await verifyMessage({
        address: userAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    } catch (error) {
      res.status(401).json({ error: 'Signature verification failed' });
      return;
    }

    // Update order status
    const updatedOrder = await prisma.limitOrder.update({
      where: { id },
      data: { status: 'cancelled', updatedAt: new Date() },
    });

    res.json(updatedOrder);
    return;
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
    return;
  }
});

/**
 * @swagger
 * /api/limit-orders/matching/open:
 *   get:
 *     summary: Get all open orders
 *     description: Returns all open orders for the matching engine
 *     tags: [Limit Orders]
 *     responses:
 *       200:
 *         description: Open orders retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LimitOrder'
 */
// Get all open orders (for matching engine)
router.get('/matching/open', async (_req: Request, res: Response): Promise<void> => {
  try {
    const orders = await prisma.limitOrder.findMany({
      where: {
        status: 'open',
        expiryTime: { gt: new Date() },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(orders);
    return;
  } catch (error) {
    console.error('Error fetching open orders:', error);
    res.status(500).json({ error: 'Failed to fetch open orders' });
    return;
  }
});

/**
 * @swagger
 * /api/limit-orders/{id}/fill:
 *   post:
 *     summary: Mark order as filled
 *     description: Marks a limit order as filled (called by matching engine)
 *     tags: [Limit Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - txHash
 *               - filledAmount
 *             properties:
 *               txHash:
 *                 type: string
 *               filledAmount:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order filled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LimitOrder'
 *       400:
 *         description: Invalid request or order cannot be filled
 *       404:
 *         description: Order not found
 */
// Mark order as filled (called by matching engine)
router.post('/:id/fill', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { txHash, filledAmount } = req.body;

    if (!txHash || !filledAmount) {
      res.status(400).json({ error: 'Missing txHash or filledAmount' });
      return;
    }

    const order = await prisma.limitOrder.findUnique({
      where: { id },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (order.status !== 'open') {
      res.status(400).json({ error: `Cannot fill order with status: ${order.status}` });
      return;
    }

    const updatedOrder = await prisma.limitOrder.update({
      where: { id },
      data: {
        status: 'filled',
        filledAt: new Date(),
        txHash,
        filledAmount,
        updatedAt: new Date(),
      },
    });

    res.json(updatedOrder);
    return;
  } catch (error) {
    console.error('Error filling order:', error);
    res.status(500).json({ error: 'Failed to fill order' });
    return;
  }
});

/**
 * @swagger
 * /api/limit-orders/maintenance/expire:
 *   post:
 *     summary: Expire old orders
 *     description: Marks expired orders as expired (cron job endpoint)
 *     tags: [Limit Orders]
 *     responses:
 *       200:
 *         description: Orders expired successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 expired:
 *                   type: integer
 */
// Expire old orders (cron job endpoint)
router.post('/maintenance/expire', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await prisma.limitOrder.updateMany({
      where: {
        status: 'open',
        expiryTime: { lte: new Date() },
      },
      data: {
        status: 'expired',
        updatedAt: new Date(),
      },
    });

    res.json({ expired: result.count });
    return;
  } catch (error) {
    console.error('Error expiring orders:', error);
    res.status(500).json({ error: 'Failed to expire orders' });
    return;
  }
});

export default router;
export { router as limitOrdersRouter };
