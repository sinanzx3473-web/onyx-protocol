import { Router, Request, Response } from 'express';
import { relayerService } from '../services/relayerService.js';

const router: Router = Router();

// Health check endpoint
router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await relayerService.getRelayerStatus();
    
    const isHealthy = status.every((chain: any) => 
      chain.balance && parseFloat(chain.balance) > 0.01 // At least 0.01 ETH
    );

    res.json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      chains: status,
    });
    return;
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    return;
  }
});

// Balance monitoring endpoint
router.get('/balances', async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await relayerService.getRelayerStatus();
    
    const balances = status.map((chain: any) => ({
      chainId: chain.chainId,
      balance: chain.balance,
      balanceWei: chain.balanceWei,
      isLow: parseFloat(chain.balance || '0') < 0.05, // Alert threshold: 0.05 ETH
      isCritical: parseFloat(chain.balance || '0') < 0.01, // Critical threshold: 0.01 ETH
    }));

    res.json({
      balances,
      timestamp: new Date().toISOString(),
    });
    return;
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Alerts endpoint - returns chains with low balance
router.get('/alerts', async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await relayerService.getRelayerStatus();
    
    const alerts = status
      .filter((chain: any) => parseFloat(chain.balance || '0') < 0.05)
      .map((chain: any) => ({
        chainId: chain.chainId,
        balance: chain.balance,
        severity: parseFloat(chain.balance || '0') < 0.01 ? 'critical' : 'warning',
        message: `Relayer balance low on chain ${chain.chainId}: ${chain.balance} ETH`,
        timestamp: new Date().toISOString(),
      }));

    res.json({
      alerts,
      count: alerts.length,
      timestamp: new Date().toISOString(),
    });
    return;
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Metrics endpoint - transaction stats
router.get('/metrics', async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await relayerService.getRelayerStatus();
    
    // In production, you would track these metrics in a database or monitoring service
    // For now, return basic relayer status
    res.json({
      relayerAddress: status[0]?.relayerAddress || 'Not configured',
      supportedChains: status.length,
      chains: status.map((chain: any) => ({
        chainId: chain.chainId,
        balance: chain.balance,
        forwarderAddress: chain.forwarderAddress,
      })),
      timestamp: new Date().toISOString(),
    });
    return;
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
export { router as monitoringRouter };
