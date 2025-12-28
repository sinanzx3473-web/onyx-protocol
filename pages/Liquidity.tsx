import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Settings, X, BookOpen, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  MOCK_TOKEN_A_ADDRESS, 
  MOCK_TOKEN_B_ADDRESS 
} from '@/utils/evmConfig';
import { AddLiquidity } from '@/components/liquidity/AddLiquidity';
import { RemoveLiquidity } from '@/components/liquidity/RemoveLiquidity';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const TOKENS = [
  { address: MOCK_TOKEN_A_ADDRESS, symbol: 'TKA', name: 'Token A', decimals: 18 },
  { address: MOCK_TOKEN_B_ADDRESS, symbol: 'TKB', name: 'Token B', decimals: 18 },
];

export default function LiquidityPage() {
  const { address } = useAccount();
  const { toast } = useToast();
  
  // Token selection
  const [tokenA, setTokenA] = useState(TOKENS[0]);
  const [tokenB, setTokenB] = useState(TOKENS[1]);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'add' | 'remove'>('add');
  
  // Settings state
  const [slippageTolerance, setSlippageTolerance] = useState('0.5');
  const [slippageError, setSlippageError] = useState<string>('');
  const [deadlineError, setDeadlineError] = useState<string>('');
  
  // Slippage constraints (L-3)
  const MIN_SLIPPAGE = 0.01; // 0.01%
  const MAX_SLIPPAGE = 50; // 50%
  
  // Deadline constraints (M-9: Frontend Deadline Validation)
  const MIN_DEADLINE = 1; // 1 minute
  const MAX_DEADLINE = 60; // 60 minutes
  
  // Validate and cap slippage (L-3: Insufficient Input Validation)
  const handleSlippageChange = (value: string) => {
    setSlippageError('');
    
    if (value === '' || value === '.') {
      setSlippageTolerance(value);
      return;
    }
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      setSlippageError('Slippage must be a valid number');
      return;
    }
    
    if (numValue <= 0) {
      setSlippageError(`Slippage must be positive (min ${MIN_SLIPPAGE}%)`);
      return;
    }
    
    if (numValue < MIN_SLIPPAGE) {
      setSlippageError(`Slippage too low (min ${MIN_SLIPPAGE}%)`);
      return;
    }
    
    if (numValue > MAX_SLIPPAGE) {
      setSlippageTolerance(MAX_SLIPPAGE.toString());
      setSlippageError(`Slippage capped at ${MAX_SLIPPAGE}%`);
      return;
    }
    
    setSlippageTolerance(value);
  };
  
  // Validate deadline (M-9: Frontend Deadline Validation)
  const handleDeadlineChange = (value: string) => {
    setDeadlineError('');
    
    if (value === '') {
      setDeadline(value);
      return;
    }
    
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      setDeadlineError('Deadline must be a valid number');
      return;
    }
    
    // M-9: Enforce safety range [1, 60] minutes
    if (numValue < MIN_DEADLINE) {
      setDeadlineError(`Deadline too short (min ${MIN_DEADLINE} minute)`);
      toast({
        title: 'Unsafe Deadline',
        description: `Deadline must be at least ${MIN_DEADLINE} minute to prevent transaction failures.`,
        variant: 'destructive',
      });
      return;
    }
    
    if (numValue > MAX_DEADLINE) {
      setDeadlineError(`Deadline too long (max ${MAX_DEADLINE} minutes)`);
      toast({
        title: 'Unsafe Deadline',
        description: `Deadline exceeds ${MAX_DEADLINE} minutes. Long deadlines increase MEV risk and price impact.`,
        variant: 'destructive',
      });
      return;
    }
    
    setDeadline(value);
  };
  
  const [customSlippage, setCustomSlippage] = useState('');
  const [deadline, setDeadline] = useState<string>('20'); // minutes
  
  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('lp-onboarding-seen');
    if (!hasSeenOnboarding && address) {
      setShowOnboarding(true);
    }
  }, [address]);
  
  const dismissOnboarding = () => {
    localStorage.setItem('lp-onboarding-seen', 'true');
    setShowOnboarding(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Onboarding Banner */}
      {showOnboarding && (
        <Alert className="mb-6 bg-gradient-to-r from-brand-gold/10 to-amber-500/10 border-brand-gold/30">
          <BookOpen className="h-5 w-5 text-brand-gold" />
          <AlertDescription className="text-brand-platinum">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-lg font-heading text-brand-platinum">Welcome to Liquidity Provision! 👋</h3>
                <p className="text-sm text-brand-platinum/70">
                  <strong>What is liquidity provision?</strong> You deposit two tokens into a pool, enabling traders to swap between them. In return, you earn a share of trading fees.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div className="bg-white/5 p-3 rounded-lg">
                    <p className="text-xs font-semibold text-brand-gold mb-1">💰 Earn Trading Fees</p>
                    <p className="text-xs text-brand-platinum/60">Receive 0.3% of every trade in your pool proportional to your share</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-lg">
                    <p className="text-xs font-semibold text-amber-300 mb-1">⚠️ Impermanent Loss Risk</p>
                    <p className="text-xs text-brand-platinum/60">If token prices diverge significantly, you may have less value than holding</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-lg">
                    <p className="text-xs font-semibold text-brand-gold mb-1">🔄 Two-Sided Deposits</p>
                    <p className="text-xs text-brand-platinum/60">You must provide both tokens in the correct ratio based on current prices</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-lg">
                    <p className="text-xs font-semibold text-emerald-400 mb-1">📊 LP Tokens</p>
                    <p className="text-xs text-brand-platinum/60">Receive LP tokens representing your pool share, redeemable anytime</p>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={dismissOnboarding}
                className="text-gray-400 hover:text-white flex-shrink-0"
                aria-label="Dismiss onboarding"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
        {/* LEFT COLUMN: The Composer */}
        <div className="space-y-8">
          {/* Header with Settings */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-heading text-brand-platinum tracking-wider">LIQUIDITY</h1>
              <p className="text-[10px] text-brand-gold/40 tracking-[0.3em] uppercase mt-2">Silence is Luxury. Liquidity Refined.</p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="bg-transparent border-brand-gold/20 text-brand-gold hover:bg-brand-gold/10"
                  aria-label="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-onyx backdrop-blur-xl bg-brand-surface/90 border border-brand-gold/20">
                <DialogHeader>
                  <DialogTitle className="text-brand-platinum font-heading">SETTINGS</DialogTitle>
                  <DialogDescription className="text-brand-platinum/60 font-sans">
                    Customize your transaction preferences
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label className="text-brand-platinum font-sans">Slippage Tolerance (%)</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSlippageChange('0.1')}
                        className={`${slippageTolerance === '0.1' ? 'bg-brand-gold text-brand-void font-bold' : 'bg-transparent border-brand-gold/20 text-brand-platinum'}`}
                        aria-label="Set slippage to 0.1%"
                        tabIndex={0}
                      >
                        0.1%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSlippageChange('0.5')}
                        className={`${slippageTolerance === '0.5' ? 'bg-brand-gold text-brand-void font-bold' : 'bg-transparent border-brand-gold/20 text-brand-platinum'}`}
                        aria-label="Set slippage to 0.5%"
                        tabIndex={0}
                      >
                        0.5%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSlippageChange('1.0')}
                        className={`${slippageTolerance === '1.0' ? 'bg-brand-gold text-brand-void font-bold' : 'bg-transparent border-brand-gold/20 text-brand-platinum'}`}
                        aria-label="Set slippage to 1.0%"
                        tabIndex={0}
                      >
                        1.0%
                      </Button>
                      <Input
                        type="number"
                        placeholder="Custom"
                        value={customSlippage}
                        onChange={(e) => {
                          setCustomSlippage(e.target.value);
                          handleSlippageChange(e.target.value);
                        }}
                        className={`w-24 bg-transparent border-white/10 text-brand-platinum focus:border-brand-gold focus:ring-brand-gold/50 ${
                          slippageError ? 'border-red-500' : ''
                        }`}
                        min="0.01"
                        max="50"
                        step="0.01"
                        aria-label="Custom slippage percentage"
                        tabIndex={0}
                      />
                    </div>
                    {slippageError && (
                      <p className="text-xs text-red-400 mt-1">{slippageError}</p>
                    )}
                    <p className="text-xs text-gray-400">Min: {MIN_SLIPPAGE}% | Max: {MAX_SLIPPAGE}%</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-brand-platinum font-sans">Transaction Deadline (minutes)</Label>
                    <Input
                      type="number"
                      placeholder="20"
                      value={deadline}
                      onChange={(e) => handleDeadlineChange(e.target.value)}
                      className={`bg-transparent border-white/10 text-brand-platinum focus:border-brand-gold focus:ring-brand-gold/50 ${
                        deadlineError ? 'border-red-500' : ''
                      }`}
                      min="1"
                      max="60"
                      aria-label="Transaction deadline in minutes"
                      tabIndex={0}
                    />
                    {deadlineError && (
                      <p className="text-xs text-red-400 mt-1">{deadlineError}</p>
                    )}
                    <p className="text-xs text-gray-400">Range: {MIN_DEADLINE}-{MAX_DEADLINE} minutes</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Floating Tabs */}
          <div className="flex gap-8 border-b-2 border-brand-gold/10 pb-4">
            <button
              onClick={() => setActiveTab('add')}
              className={`text-sm tracking-[0.3em] uppercase font-bold transition-all ${
                activeTab === 'add'
                  ? 'text-brand-gold border-b-2 border-brand-gold pb-2 -mb-[18px]'
                  : 'text-white/30 hover:text-white/60'
              }`}
            >
              ADD
            </button>
            <button
              onClick={() => setActiveTab('remove')}
              className={`text-sm tracking-[0.3em] uppercase font-bold transition-all ${
                activeTab === 'remove'
                  ? 'text-brand-gold border-b-2 border-brand-gold pb-2 -mb-[18px]'
                  : 'text-white/30 hover:text-white/60'
              }`}
            >
              REMOVE
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'add' && (
            <AddLiquidity
              tokens={TOKENS}
              tokenA={tokenA}
              tokenB={tokenB}
              onTokenAChange={setTokenA}
              onTokenBChange={setTokenB}
              slippageTolerance={slippageTolerance}
              deadline={deadline}
            />
          )}

          {activeTab === 'remove' && (
            <RemoveLiquidity
              tokens={TOKENS}
              tokenA={tokenA}
              tokenB={tokenB}
              onTokenAChange={setTokenA}
              onTokenBChange={setTokenB}
              slippageTolerance={slippageTolerance}
              deadline={deadline}
            />
          )}
        </div>

        {/* RIGHT COLUMN: The Visualizer */}
        <div className="flex items-center justify-center">
          <div className="relative w-full max-w-md aspect-square">
            {/* Pool Composition Graphic */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Gold Circle */}
              <div 
                className="absolute w-64 h-64 rounded-full bg-brand-gold/20 blur-3xl animate-pulse"
                style={{ animationDuration: '4s' }}
              />
              {/* Platinum Circle */}
              <div 
                className="absolute w-64 h-64 rounded-full bg-brand-platinum/20 blur-3xl animate-pulse translate-x-12"
                style={{ animationDuration: '5s', animationDelay: '1s' }}
              />
              
              {/* Overlay Text */}
              <div className="relative z-10 text-center space-y-4">
                <div className="text-[10px] text-brand-gold/40 tracking-[0.3em] uppercase font-mono">
                  Pool Composition
                </div>
                <div className="text-6xl font-heading text-brand-platinum tracking-wider">
                  0.00<span className="text-brand-gold">%</span>
                </div>
                <div className="text-xs text-brand-platinum/60 tracking-[0.2em] uppercase">
                  Pool Share
                </div>
                
                {/* Token Labels */}
                <div className="flex items-center justify-center gap-4 mt-8">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-brand-gold/60 blur-sm" />
                    <span className="text-[10px] text-brand-gold/60 tracking-wider uppercase font-mono">
                      {tokenA.symbol}
                    </span>
                  </div>
                  <Plus className="w-4 h-4 text-brand-gold/40" />
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-brand-platinum/60 blur-sm" />
                    <span className="text-[10px] text-brand-platinum/60 tracking-wider uppercase font-mono">
                      {tokenB.symbol}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
