/**
 * @swagger
 * tags:
 *   name: Alerts
 *   description: Price and volume alert configuration
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';

const router: Router = Router();

// Alert types
export type AlertType = 'price_cross' | 'volume_spike' | 'apr_change' | 'flash_loan_threshold';
export type AlertCondition = 'above' | 'below' | 'crosses_above' | 'crosses_below' | 'increases_by' | 'decreases_by';
export type DeliveryMethod = 'in_app' | 'email' | 'push' | 'webhook';

export interface Alert {
  id: string;
  userId: string;
  name: string;
  type: AlertType;
  condition: AlertCondition;
  targetValue: string;
  poolAddress?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  deliveryMethods: DeliveryMethod[];
  webhookUrl?: string;
  isActive: boolean;
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory storage (replace with database in production)
const alerts: Map<string, Alert> = new Map();

// Helper to generate alert ID
function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Validation middleware
const validateCreateAlert = [
  body('name').isString().trim().notEmpty().withMessage('Alert name is required'),
  body('type').isIn(['price_cross', 'volume_spike', 'apr_change', 'flash_loan_threshold']).withMessage('Invalid alert type'),
  body('condition').isIn(['above', 'below', 'crosses_above', 'crosses_below', 'increases_by', 'decreases_by']).withMessage('Invalid condition'),
  body('targetValue').isString().notEmpty().withMessage('Target value is required'),
  body('deliveryMethods').isArray({ min: 1 }).withMessage('At least one delivery method required'),
  body('deliveryMethods.*').isIn(['in_app', 'email', 'push', 'webhook']).withMessage('Invalid delivery method'),
  body('webhookUrl').optional().isURL().withMessage('Invalid webhook URL'),
  body('poolAddress').optional().isString(),
  body('tokenAddress').optional().isString(),
  body('tokenSymbol').optional().isString()
];

const validateUpdateAlert = [
  param('id').isString().notEmpty(),
  body('name').optional().isString().trim().notEmpty(),
  body('condition').optional().isIn(['above', 'below', 'crosses_above', 'crosses_below', 'increases_by', 'decreases_by']),
  body('targetValue').optional().isString().notEmpty(),
  body('deliveryMethods').optional().isArray({ min: 1 }),
  body('deliveryMethods.*').optional().isIn(['in_app', 'email', 'push', 'webhook']),
  body('webhookUrl').optional().isURL(),
  body('isActive').optional().isBoolean()
];

/**
 * @swagger
 * /api/alerts:
 *   get:
 *     summary: Get all alerts for user
 *     description: Returns all alerts for a specific user ID
 *     tags: [Alerts]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User identifier
 *     responses:
 *       200:
 *         description: Alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 alerts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       type:
 *                         type: string
 *                       condition:
 *                         type: string
 *                       targetValue:
 *                         type: string
 *                       isActive:
 *                         type: boolean
 *                       lastTriggered:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *       400:
 *         description: Missing userId parameter
 */
// GET /api/alerts - Get all alerts for user
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string;
    
    if (!userId) {
      res.status(400).json({ error: 'userId query parameter required' });
      return;
    }

    const userAlerts = Array.from(alerts.values()).filter(alert => alert.userId === userId);
    
    res.json({
      alerts: userAlerts,
      total: userAlerts.length
    });
    return;
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
    return;
  }
});

/**
 * @swagger
 * /api/alerts/{id}:
 *   get:
 *     summary: Get specific alert
 *     description: Returns details of a specific alert by ID
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 name:
 *                   type: string
 *                 type:
 *                   type: string
 *                 condition:
 *                   type: string
 *                 targetValue:
 *                   type: string
 *                 poolAddress:
 *                   type: string
 *                 tokenAddress:
 *                   type: string
 *                 deliveryMethods:
 *                   type: array
 *                   items:
 *                     type: string
 *                 isActive:
 *                   type: boolean
 *       404:
 *         description: Alert not found
 */
// GET /api/alerts/:id - Get specific alert
router.get('/:id', param('id').isString(), async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const alert = alerts.get(req.params.id);
    
    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    res.json(alert);
    return;
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({ error: 'Failed to fetch alert' });
    return;
  }
});

/**
 * @swagger
 * /api/alerts:
 *   post:
 *     summary: Create new alert
 *     description: Creates a new price, volume, APR, or flash loan alert with customizable delivery methods
 *     tags: [Alerts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - name
 *               - type
 *               - condition
 *               - targetValue
 *               - deliveryMethods
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User identifier
 *               name:
 *                 type: string
 *                 description: Alert name
 *               type:
 *                 type: string
 *                 enum: [price_cross, volume_spike, apr_change, flash_loan_threshold]
 *               condition:
 *                 type: string
 *                 enum: [above, below, crosses_above, crosses_below, increases_by, decreases_by]
 *               targetValue:
 *                 type: string
 *                 description: Threshold value
 *               poolAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *               tokenAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *               tokenSymbol:
 *                 type: string
 *               deliveryMethods:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [in_app, email, push, webhook]
 *               webhookUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       201:
 *         description: Alert created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 name:
 *                   type: string
 *                 type:
 *                   type: string
 *                 isActive:
 *                   type: boolean
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error
 */
// POST /api/alerts - Create new alert
router.post('/', validateCreateAlert, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const userId = req.body.userId || req.query.userId;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    // Validate webhook URL if webhook delivery is selected
    if (req.body.deliveryMethods.includes('webhook') && !req.body.webhookUrl) {
      res.status(400).json({ error: 'webhookUrl required for webhook delivery' });
      return;
    }

    const alertId = generateAlertId();
    const now = new Date();

    const newAlert: Alert = {
      id: alertId,
      userId,
      name: req.body.name,
      type: req.body.type,
      condition: req.body.condition,
      targetValue: req.body.targetValue,
      poolAddress: req.body.poolAddress,
      tokenAddress: req.body.tokenAddress,
      tokenSymbol: req.body.tokenSymbol,
      deliveryMethods: req.body.deliveryMethods,
      webhookUrl: req.body.webhookUrl,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    alerts.set(alertId, newAlert);

    res.status(201).json(newAlert);
    return;
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ error: 'Failed to create alert' });
    return;
  }
});

/**
 * @swagger
 * /api/alerts/{id}:
 *   patch:
 *     summary: Update alert
 *     description: Updates an existing alert configuration
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               condition:
 *                 type: string
 *                 enum: [above, below, crosses_above, crosses_below, increases_by, decreases_by]
 *               targetValue:
 *                 type: string
 *               deliveryMethods:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [in_app, email, push, webhook]
 *               webhookUrl:
 *                 type: string
 *                 format: uri
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Alert updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: Alert not found
 *       400:
 *         description: Validation error
 */
// PATCH /api/alerts/:id - Update alert
router.patch('/:id', validateUpdateAlert, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const alert = alerts.get(req.params.id);
    
    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    // Update only provided fields
    const updatedAlert: Alert = {
      ...alert,
      ...(req.body.name && { name: req.body.name }),
      ...(req.body.condition && { condition: req.body.condition }),
      ...(req.body.targetValue && { targetValue: req.body.targetValue }),
      ...(req.body.deliveryMethods && { deliveryMethods: req.body.deliveryMethods }),
      ...(req.body.webhookUrl !== undefined && { webhookUrl: req.body.webhookUrl }),
      ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
      updatedAt: new Date()
    };

    alerts.set(req.params.id, updatedAlert);

    res.json(updatedAlert);
    return;
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({ error: 'Failed to update alert' });
    return;
  }
});

/**
 * @swagger
 * /api/alerts/{id}:
 *   delete:
 *     summary: Delete alert
 *     description: Deletes an existing alert
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert deleted successfully
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
 *       404:
 *         description: Alert not found
 */
// DELETE /api/alerts/:id - Delete alert
router.delete('/:id', param('id').isString(), async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const alert = alerts.get(req.params.id);
    
    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    alerts.delete(req.params.id);

    res.json({ success: true, message: 'Alert deleted successfully' });
    return;
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
    return;
  }
});

/**
 * @swagger
 * /api/alerts/{id}/toggle:
 *   post:
 *     summary: Toggle alert status
 *     description: Toggles the active/inactive status of an alert
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert status toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 isActive:
 *                   type: boolean
 *       404:
 *         description: Alert not found
 */
// POST /api/alerts/:id/toggle - Toggle alert active status
router.post('/:id/toggle', param('id').isString(), async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const alert = alerts.get(req.params.id);
    
    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const updatedAlert: Alert = {
      ...alert,
      isActive: !alert.isActive,
      updatedAt: new Date()
    };

    alerts.set(req.params.id, updatedAlert);

    res.json(updatedAlert);
    return;
  } catch (error) {
    console.error('Error toggling alert:', error);
    res.status(500).json({ error: 'Failed to toggle alert' });
    return;
  }
});

// POST /api/alerts/evaluate - Evaluate alerts against current market data
router.post('/evaluate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { poolAddress, tokenAddress, price, volume24h, apr, flashLoanAmount } = req.body;

    const triggeredAlerts: Alert[] = [];

    // Evaluate all active alerts
    for (const alert of alerts.values()) {
      if (!alert.isActive) continue;

      let shouldTrigger = false;

      // Match alert to relevant data
      if (alert.poolAddress && alert.poolAddress !== poolAddress) continue;
      if (alert.tokenAddress && alert.tokenAddress !== tokenAddress) continue;

      // Evaluate based on alert type
      switch (alert.type) {
        case 'price_cross':
          if (price) {
            const targetPrice = parseFloat(alert.targetValue);
            const currentPrice = parseFloat(price);
            
            if (alert.condition === 'above' && currentPrice > targetPrice) shouldTrigger = true;
            if (alert.condition === 'below' && currentPrice < targetPrice) shouldTrigger = true;
            if (alert.condition === 'crosses_above' && currentPrice > targetPrice) shouldTrigger = true;
            if (alert.condition === 'crosses_below' && currentPrice < targetPrice) shouldTrigger = true;
          }
          break;

        case 'volume_spike':
          if (volume24h) {
            const targetIncrease = parseFloat(alert.targetValue);
            // Assume volume24h includes percentage increase
            const volumeIncrease = parseFloat(volume24h);
            
            if (alert.condition === 'increases_by' && volumeIncrease >= targetIncrease) shouldTrigger = true;
          }
          break;

        case 'apr_change':
          if (apr) {
            const targetAPR = parseFloat(alert.targetValue);
            const currentAPR = parseFloat(apr);
            
            if (alert.condition === 'above' && currentAPR > targetAPR) shouldTrigger = true;
            if (alert.condition === 'below' && currentAPR < targetAPR) shouldTrigger = true;
            if (alert.condition === 'decreases_by') {
              // Assume targetValue is percentage decrease
              shouldTrigger = true; // Implement proper logic
            }
          }
          break;

        case 'flash_loan_threshold':
          if (flashLoanAmount) {
            const targetAmount = parseFloat(alert.targetValue);
            const loanAmount = parseFloat(flashLoanAmount);
            
            if (alert.condition === 'above' && loanAmount > targetAmount) shouldTrigger = true;
          }
          break;
      }

      if (shouldTrigger) {
        // Update last triggered time
        alert.lastTriggered = new Date();
        alerts.set(alert.id, alert);
        triggeredAlerts.push(alert);
      }
    }

    res.json({
      triggered: triggeredAlerts.length,
      alerts: triggeredAlerts
    });
    return;
  } catch (error) {
    console.error('Error evaluating alerts:', error);
    res.status(500).json({ error: 'Failed to evaluate alerts' });
    return;
  }
});

export default router;
export { router as alertsRouter };
