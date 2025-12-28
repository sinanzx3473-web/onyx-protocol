/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Push notification subscription and management
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';

const router: Router = Router();

// Notification subscription schema
const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string()
  }),
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  preferences: z.object({
    transactions: z.boolean().default(true),
    poolChanges: z.boolean().default(true),
    volumeSpikes: z.boolean().default(true),
    priceAlerts: z.boolean().default(false)
  }).optional()
});

// Send notification schema
const sendNotificationSchema = z.object({
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(200),
  type: z.enum(['transaction', 'pool', 'volume', 'price']),
  data: z.record(z.any()).optional()
});

// In-memory storage for subscriptions (use database in production)
const subscriptions = new Map<string, any>();

/**
 * @swagger
 * /api/notifications/subscribe:
 *   post:
 *     summary: Subscribe to push notifications
 *     description: Subscribes a user to push notifications with customizable preferences
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - endpoint
 *               - keys
 *               - userAddress
 *             properties:
 *               endpoint:
 *                 type: string
 *                 format: uri
 *               keys:
 *                 type: object
 *                 required:
 *                   - p256dh
 *                   - auth
 *                 properties:
 *                   p256dh:
 *                     type: string
 *                   auth:
 *                     type: string
 *               userAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *               preferences:
 *                 type: object
 *                 properties:
 *                   transactions:
 *                     type: boolean
 *                     default: true
 *                   poolChanges:
 *                     type: boolean
 *                     default: true
 *                   volumeSpikes:
 *                     type: boolean
 *                     default: true
 *                   priceAlerts:
 *                     type: boolean
 *                     default: false
 *     responses:
 *       200:
 *         description: Subscription successful
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
 *       400:
 *         description: Invalid request
 */
router.post('/subscribe', validateRequest(subscriptionSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { endpoint, keys, userAddress, preferences } = req.body;

    // Store subscription
    subscriptions.set(userAddress.toLowerCase(), {
      endpoint,
      keys,
      preferences: preferences || {
        transactions: true,
        poolChanges: true,
        volumeSpikes: true,
        priceAlerts: false
      },
      subscribedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Successfully subscribed to notifications'
    });
  } catch (error) {
    console.error('Notification subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe to notifications'
    });
  }
});

/**
 * POST /api/notifications/unsubscribe
 * Unsubscribe from push notifications
 */
router.post('/unsubscribe', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userAddress } = req.body;

    if (!userAddress) {
      res.status(400).json({
        success: false,
        error: 'User address is required'
      });
      return;
    }

    subscriptions.delete(userAddress.toLowerCase());

    res.json({
      success: true,
      message: 'Successfully unsubscribed from notifications'
    });
  } catch (error) {
    console.error('Notification unsubscribe error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unsubscribe from notifications'
    });
  }
});

/**
 * GET /api/notifications/subscription/:address
 * Get notification subscription status
 */
router.get('/subscription/:address', async (req: Request, res: Response): Promise<void> => {
  try {
    const { address } = req.params;
    const subscription = subscriptions.get(address.toLowerCase());

    if (!subscription) {
      res.json({
        subscribed: false
      });
      return;
    }

    res.json({
      subscribed: true,
      preferences: subscription.preferences,
      subscribedAt: subscription.subscribedAt
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription status'
    });
  }
});

/**
 * POST /api/notifications/send
 * Send notification to user (internal use)
 */
router.post('/send', validateRequest(sendNotificationSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { userAddress, title, body, type, data } = req.body;

    const subscription = subscriptions.get(userAddress.toLowerCase());

    if (!subscription) {
      res.status(404).json({
        success: false,
        error: 'User not subscribed to notifications'
      });
      return;
    }

    // Check user preferences
    const typePreferenceMap: Record<string, keyof typeof subscription.preferences> = {
      transaction: 'transactions',
      pool: 'poolChanges',
      volume: 'volumeSpikes',
      price: 'priceAlerts'
    };

    const preferenceKey = typePreferenceMap[type];
    if (preferenceKey && !subscription.preferences[preferenceKey]) {
      res.json({
        success: true,
        message: 'Notification skipped due to user preferences'
      });
      return;
    }

    // In production, use web-push library to send actual push notifications
    // For now, just log and return success
    console.log('Sending notification:', {
      to: userAddress,
      title,
      body,
      type,
      data
    });

    res.json({
      success: true,
      message: 'Notification sent successfully'
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notification'
    });
  }
});

/**
 * PUT /api/notifications/preferences
 * Update notification preferences
 */
router.put('/preferences', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userAddress, preferences } = req.body;

    if (!userAddress) {
      res.status(400).json({
        success: false,
        error: 'User address is required'
      });
      return;
    }

    const subscription = subscriptions.get(userAddress.toLowerCase());

    if (!subscription) {
      res.status(404).json({
        success: false,
        error: 'User not subscribed to notifications'
      });
      return;
    }

    subscription.preferences = {
      ...subscription.preferences,
      ...preferences
    };

    subscriptions.set(userAddress.toLowerCase(), subscription);

    res.json({
      success: true,
      preferences: subscription.preferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update preferences'
    });
  }
});

export default router;
export { router as notificationsRouter };
