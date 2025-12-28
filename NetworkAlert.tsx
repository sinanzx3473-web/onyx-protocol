import { useEffect, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Wifi, WifiOff, X } from 'lucide-react';
import { chainId as expectedChainId } from '@/utils/evmConfig';

export function NetworkAlert() {
  const { isConnected } = useAccount();
  const currentChainId = useChainId();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isWrongNetwork = isConnected && currentChainId !== expectedChainId;

  const handleSwitchNetwork = async () => {
    if (typeof window.ethereum === 'undefined') return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${expectedChainId.toString(16)}` }],
      });
    } catch (error: any) {
      console.error('Failed to switch network:', error);
      
      // If chain doesn't exist, try to add it
      if (error.code === 4902) {
        const network = import.meta.env.VITE_CHAIN || 'devnet';
        const rpcUrl = `https://${network}.rpc.onyx.dev`;
        
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${expectedChainId.toString(16)}`,
                chainName: `CodeNut ${network.charAt(0).toUpperCase() + network.slice(1)}`,
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: [rpcUrl],
                blockExplorerUrls: [`https://${network}.explorer.codenut.dev`],
              },
            ],
          });
        } catch (addError) {
          console.error('Failed to add network:', addError);
        }
      }
    }
  };

  if (!isOnline) {
    return (
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-2xl px-4" role="alert" aria-live="assertive">
        <Alert className="bg-red-500/20 border-red-500/50 border-2">
          <WifiOff className="h-5 w-5 text-red-400" aria-hidden="true" />
          <AlertTitle className="text-red-300 font-bold">No Internet Connection</AlertTitle>
          <AlertDescription className="text-red-200">
            You are currently offline. Please check your internet connection to use the DEX.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isWrongNetwork && !dismissed) {
    const networkName = import.meta.env.VITE_CHAIN || 'devnet';
    
    return (
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-2xl px-4" role="alert" aria-live="polite">
        <Alert className="bg-yellow-500/20 border-yellow-500/50 border-2">
          <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
          <div className="flex-1">
            <AlertTitle className="text-yellow-300 font-bold">Wrong Network Detected</AlertTitle>
            <AlertDescription className="text-yellow-200">
              You're connected to the wrong network. Please switch to {networkName} (Chain ID: {expectedChainId}) to use this application. All transactions are disabled until you switch networks.
            </AlertDescription>
            <Button
              onClick={handleSwitchNetwork}
              className="mt-3 bg-yellow-500 hover:bg-yellow-600 text-black min-h-[44px]"
              size="sm"
              aria-label={`Switch to ${networkName} network`}
            >
              Switch to {networkName}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            className="absolute top-2 right-2 min-h-[44px] min-w-[44px] text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
            aria-label="Dismiss network warning"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Alert>
      </div>
    );
  }

  return null;
}
