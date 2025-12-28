/**
 * @swagger
 * tags:
 *   name: Referrals
 *   description: Referral code generation and tracking
 */

import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { isAddress, getAddress } from 'viem';

const router: Router = Router();

// In-memory storage (replace with database in production)
const referralCodes = new Map<string, string>(); // code -> address
const referralStats = new Map<string, {
  totalReferrals: number;
  totalVolume: string;
  totalRewards: string;
  monthlyVolume: string;
  monthlyReferrals: number;
  referrals: Set<string>;
}>();

const leaderboard = new Map<string, {
  address: string;
  volume: string;
  referrals: number;
  rewards: string;
}>();

/**
 * @swagger
 * /api/referrals/generate:
 *   post:
 *     summary: Generate referral code
 *     description: Generates a unique referral code for a wallet address
 *     tags: [Referrals]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *             properties:
 *               address:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *     responses:
 *       200:
 *         description: Referral code generated or retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: 'A1B2C3D4'
 *       400:
 *         description: Invalid address
 */
// Generate unique referral code for address
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { address } = req.body;

    if (!address || !isAddress(address)) {
      res.status(400).json({ error: 'Invalid address' });
      return;
    }

    const checksumAddress = getAddress(address);

    // Check if code already exists
    for (const [code, addr] of referralCodes.entries()) {
      if (addr.toLowerCase() === checksumAddress.toLowerCase()) {
        res.json({ code });
        return;
      }
    }

    // Generate new code: first 6 chars of hash(address + timestamp)
    const hash = createHash('sha256')
      .update(checksumAddress + Date.now())
      .digest('hex');
    const code = hash.substring(0, 8).toUpperCase();

    referralCodes.set(code, checksumAddress);

    // Initialize stats
    if (!referralStats.has(checksumAddress)) {
      referralStats.set(checksumAddress, {
        totalReferrals: 0,
        totalVolume: '0',
        totalRewards: '0',
        monthlyVolume: '0',
        monthlyReferrals: 0,
        referrals: new Set(),
      });
    }

    res.json({ code });
  } catch (error) {
    console.error('Error generating referral code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validate referral code and return referrer address
router.get('/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Invalid code' });
      return;
    }

    const referrer = referralCodes.get(code.toUpperCase());

    if (!referrer) {
      res.status(404).json({ error: 'Referral code not found' });
      return;
    }

    res.json({ referrer });
  } catch (error) {
    console.error('Error validating referral code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Track referral activity (called by frontend after swap/liquidity add)
router.post('/track', async (req: Request, res: Response): Promise<void> => {
  try {
    const { referrer, referee, volume, type: _type } = req.body;

    if (!referrer || !referee || !volume || !isAddress(referrer) || !isAddress(referee)) {
      res.status(400).json({ error: 'Invalid parameters' });
      return;
    }

    const checksumReferrer = getAddress(referrer);
    const checksumReferee = getAddress(referee);

    // Don't allow self-referral
    if (checksumReferrer.toLowerCase() === checksumReferee.toLowerCase()) {
      res.status(400).json({ error: 'Self-referral not allowed' });
      return;
    }

    // Get or create stats
    let stats = referralStats.get(checksumReferrer);
    if (!stats) {
      stats = {
        totalReferrals: 0,
        totalVolume: '0',
        totalRewards: '0',
        monthlyVolume: '0',
        monthlyReferrals: 0,
        referrals: new Set(),
      };
      referralStats.set(checksumReferrer, stats);
    }

    // Track new referral
    if (!stats.referrals.has(checksumReferee)) {
      stats.referrals.add(checksumReferee);
      stats.totalReferrals++;
      stats.monthlyReferrals++;
    }

    // Update volume
    const volumeBigInt = BigInt(volume);
    stats.totalVolume = (BigInt(stats.totalVolume) + volumeBigInt).toString();
    stats.monthlyVolume = (BigInt(stats.monthlyVolume) + volumeBigInt).toString();

    // Calculate reward (0.05% of volume)
    const reward = volumeBigInt * BigInt(5) / BigInt(10000);
    stats.totalRewards = (BigInt(stats.totalRewards) + reward).toString();

    // Update leaderboard
    leaderboard.set(checksumReferrer, {
      address: checksumReferrer,
      volume: stats.monthlyVolume,
      referrals: stats.monthlyReferrals,
      rewards: stats.totalRewards,
    });

    res.json({ success: true, reward: reward.toString() });
  } catch (error) {
    console.error('Error tracking referral:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get referral stats for address
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { address } = req.query;

    if (!address || typeof address !== 'string' || !isAddress(address)) {
      res.status(400).json({ error: 'Invalid address' });
      return;
    }

    const checksumAddress = getAddress(address);
    const stats = referralStats.get(checksumAddress);

    if (!stats) {
      res.json({
        totalReferrals: 0,
        totalVolume: '0',
        totalRewards: '0',
        monthlyVolume: '0',
        monthlyReferrals: 0,
        rank: null,
      });
      return;
    }

    // Calculate rank
    const sortedLeaderboard = Array.from(leaderboard.values())
      .sort((a, b) => {
        const volA = BigInt(a.volume);
        const volB = BigInt(b.volume);
        return volA > volB ? -1 : volA < volB ? 1 : 0;
      });

    const rank = sortedLeaderboard.findIndex(
      entry => entry.address.toLowerCase() === checksumAddress.toLowerCase()
    ) + 1;

    res.json({
      totalReferrals: stats.totalReferrals,
      totalVolume: stats.totalVolume,
      totalRewards: stats.totalRewards,
      monthlyVolume: stats.monthlyVolume,
      monthlyReferrals: stats.monthlyReferrals,
      rank: rank > 0 ? rank : null,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get monthly leaderboard
router.get('/leaderboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string, 10);

    const sortedLeaderboard = Array.from(leaderboard.values())
      .sort((a, b) => {
        const volA = BigInt(a.volume);
        const volB = BigInt(b.volume);
        return volA > volB ? -1 : volA < volB ? 1 : 0;
      })
      .slice(0, limitNum)
      .map((entry, index) => ({
        rank: index + 1,
        address: entry.address,
        volume: entry.volume,
        referrals: entry.referrals,
        rewards: entry.rewards,
      }));

    res.json({ leaderboard: sortedLeaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset monthly stats (call this via cron job at start of each month)
router.post('/reset-monthly', async (_req: Request, res: Response): Promise<void> => {
  try {
    // In production, add authentication/authorization here
    
    for (const stats of referralStats.values()) {
      stats.monthlyVolume = '0';
      stats.monthlyReferrals = 0;
    }

    leaderboard.clear();

    res.json({ success: true, message: 'Monthly stats reset' });
  } catch (error) {
    console.error('Error resetting monthly stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
export { router as referralsRouter };
