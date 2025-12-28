import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Settings2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Chain = 'devnet' | 'testnet' | 'mainnet';

const CHAIN_INFO: Record<Chain, { name: string; description: string; color: string }> = {
  devnet: {
    name: 'Development Network',
    description: 'For testing and development only. Tokens have no real value.',
    color: 'text-blue-400',
  },
  testnet: {
    name: 'Test Network',
    description: 'Public testnet for final testing before mainnet deployment.',
    color: 'text-yellow-400',
  },
  mainnet: {
    name: 'Mainnet',
    description: 'Production network with real assets. Use with caution.',
    color: 'text-green-400',
  },
};

export function ChainSelector() {
  const [open, setOpen] = useState(false);
  const [selectedChain, setSelectedChain] = useState<Chain>('devnet');
  const [needsReload, setNeedsReload] = useState(false);

  useEffect(() => {
    // Load saved chain preference
    const savedChain = localStorage.getItem('selectedChain') as Chain | null;
    const envChain = (import.meta.env.VITE_CHAIN || 'devnet') as Chain;
    
    if (savedChain && savedChain !== envChain) {
      setSelectedChain(savedChain);
      setNeedsReload(true);
    } else {
      setSelectedChain(envChain);
    }
  }, []);

  const handleChainChange = (chain: Chain) => {
    const currentChain = import.meta.env.VITE_CHAIN || 'devnet';
    
    if (chain !== currentChain) {
      localStorage.setItem('selectedChain', chain);
      setSelectedChain(chain);
      setNeedsReload(true);
    }
  };

  const handleApplyChanges = () => {
    if (needsReload) {
      // In a real implementation, this would update the environment and reload
      window.location.reload();
    }
    setOpen(false);
  };

  const currentChain = (import.meta.env.VITE_CHAIN || 'devnet') as Chain;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-white/20 text-white hover:bg-white/10 min-h-[44px] gap-2"
          aria-label="Open network settings"
        >
          <Settings2 className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">{CHAIN_INFO[currentChain].name}</span>
          <span className="sm:hidden">Network</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gradient-to-br from-black/95 to-black/90 border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Network Settings</DialogTitle>
          <DialogDescription className="text-gray-400">
            Select the blockchain network for this application
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="chain-select" className="text-white font-medium">
              Select Network
            </Label>
            <Select value={selectedChain} onValueChange={handleChainChange}>
              <SelectTrigger 
                id="chain-select"
                className="bg-white/5 border-white/20 text-white min-h-[44px]"
                aria-label="Select blockchain network"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/95 border-white/10 text-white">
                {(Object.keys(CHAIN_INFO) as Chain[]).map((chain) => (
                  <SelectItem 
                    key={chain} 
                    value={chain}
                    className="focus:bg-white/10 focus:text-white min-h-[44px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        chain === 'mainnet' ? 'bg-green-500' :
                        chain === 'testnet' ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`} aria-hidden="true" />
                      {CHAIN_INFO[chain].name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chain Info */}
          <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                selectedChain === 'mainnet' ? 'bg-green-500' :
                selectedChain === 'testnet' ? 'bg-yellow-500' :
                'bg-blue-500'
              }`} aria-hidden="true" />
              <h3 className={`font-semibold ${CHAIN_INFO[selectedChain].color}`}>
                {CHAIN_INFO[selectedChain].name}
              </h3>
            </div>
            <p className="text-sm text-gray-400">
              {CHAIN_INFO[selectedChain].description}
            </p>
          </div>

          {/* Warning for Mainnet */}
          {selectedChain === 'mainnet' && (
            <Alert className="bg-red-500/10 border-red-500/30" role="alert">
              <AlertCircle className="h-4 w-4 text-red-400" aria-hidden="true" />
              <AlertDescription className="text-red-300 text-sm">
                <strong>Warning:</strong> Mainnet uses real assets. Double-check all transactions before confirming.
              </AlertDescription>
            </Alert>
          )}

          {/* Reload Notice */}
          {needsReload && selectedChain !== currentChain && (
            <Alert className="bg-blue-500/10 border-blue-500/30" role="alert" aria-live="polite">
              <AlertCircle className="h-4 w-4 text-blue-400" aria-hidden="true" />
              <AlertDescription className="text-blue-300 text-sm">
                The page will reload to apply network changes.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1 border-white/20 text-white hover:bg-white/10 min-h-[44px]"
              aria-label="Cancel network change"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyChanges}
              disabled={!needsReload}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 min-h-[44px]"
              aria-label="Apply network changes and reload"
            >
              {needsReload ? 'Apply & Reload' : 'No Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
