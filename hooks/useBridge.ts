import { useState, useCallback } from 'react';
import { useToast } from './use-toast';

type BridgeStatus = 'IDLE' | 'WARPING' | 'COMPLETED';

interface BridgeStep {
  message: string;
  progress: number;
}

const BRIDGE_STEPS: BridgeStep[] = [
  { message: 'Confirming on source chain...', progress: 20 },
  { message: 'Locking assets in bridge contract...', progress: 40 },
  { message: 'Crossing the quantum hyperlane...', progress: 60 },
  { message: 'Minting on destination chain...', progress: 80 },
  { message: 'Finalizing transaction...', progress: 95 },
];

export function useBridge() {
  const { toast } = useToast();
  const [status, setStatus] = useState<BridgeStatus>('IDLE');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [txHash, setTxHash] = useState('');

  const bridgeAssets = useCallback(
    async (
      amount: string,
      asset: string,
      sourceChain: string,
      targetChain: string
    ) => {
      // Reset state
      setStatus('WARPING');
      setProgress(0);
      setCurrentStep('Initiating warp sequence...');

      // Generate fake transaction hash
      const fakeTxHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`;
      setTxHash(fakeTxHash);

      // Simulate bridge process with progress updates
      for (let i = 0; i < BRIDGE_STEPS.length; i++) {
        const step = BRIDGE_STEPS[i];
        
        // Wait for step duration (1 second per step)
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        setCurrentStep(step.message);
        setProgress(step.progress);
      }

      // Final completion
      await new Promise((resolve) => setTimeout(resolve, 500));
      setProgress(100);
      setCurrentStep('Transfer complete!');
      setStatus('COMPLETED');

      // Show success toast
      toast({
        title: 'Warp Successful! 🌌',
        description: `${amount} ${asset} bridged from ${sourceChain} to ${targetChain}`,
      });
    },
    [toast]
  );

  const reset = useCallback(() => {
    setStatus('IDLE');
    setProgress(0);
    setCurrentStep('');
    setTxHash('');
  }, []);

  return {
    status,
    progress,
    currentStep,
    txHash,
    bridgeAssets,
    reset,
  };
}
