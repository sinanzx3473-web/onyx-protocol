import { Router, Request, Response } from 'express';
import { relayerService } from '../services/relayerService.js';

const router: Router = Router();

// Relay a meta-transaction
router.post('/relay', async (req: Request, res: Response): Promise<void> => {
  try {
    const { request, signature, chainId } = req.body;

    if (!request || !signature || !chainId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const result = await relayerService.relayTransaction({
      request,
      signature,
      chainId: Number(chainId)
    });

    if (result.success) {
      res.json({
        success: true,
        txHash: result.txHash
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Relay endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get relayer status for a specific chain
router.get('/status/:chainId', async (req: Request, res: Response): Promise<void> => {
  try {
    const chainId = Number(req.params.chainId);
    const status = await relayerService.getRelayerStatusByChain(chainId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's nonce for meta-transactions
router.get('/nonce/:chainId/:address', async (req: Request, res: Response): Promise<void> => {
  try {
    const chainId = Number(req.params.chainId);
    const { address } = req.params;

    const nonce = await relayerService.getUserNonce(chainId, address);
    res.json({ nonce });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get forwarder address for a chain
router.get('/forwarder/:chainId', async (req: Request, res: Response): Promise<void> => {
  try {
    const chainId = Number(req.params.chainId);
    const forwarderAddress = relayerService.getForwarderAddress(chainId);
    
    if (!forwarderAddress) {
      res.status(404).json({ error: 'Forwarder not found for this chain' });
      return;
    }

    res.json({ forwarderAddress });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get supported chains
router.get('/chains', async (_req: Request, res: Response): Promise<void> => {
  try {
    const chains = relayerService.getSupportedChains();
    res.json({ chains });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
export { router as relayerRouter };
