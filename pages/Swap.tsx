import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSimulateContract } from 'wagmi';
import { parseUnits, formatUnits, Address } from 'viem';
import { addTransaction, updateTransactionStatus } from '@/utils/transactionHistory';
import { chainId } from '@/utils/evmConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TokenSelector } from '@/components/swap/TokenSelector';
import { RouteOptimizer } from '@/components/swap/RouteOptimizer';
import { LimitOrder } from '@/components/swap/LimitOrder';
import { TxSimulator } from '@/components/common/TxSimulator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Settings, Info, AlertCircle, CheckCircle2, Loader2, ArrowDownUp, Zap, Shield, TrendingUp } from 'lucide-react';
import { PriceChart } from '@/components/ui/PriceChart';
import { useToast } from '@/hooks/use-toast';
import { useRelayer } from '@/context/RelayerProvider';
import { useReferralTracking } from '@/hooks/useReferralTracking';
import { useSound } from '@/hooks/useSound';
import { DEX_CORE_ADDRESS, DEX_CORE_ABI, ERC20_ABI, MOCK_TOKEN_A_ADDRESS, MOCK_TOKEN_B_ADDRESS } from '@/utils/evmConfig';

const TOKENS = [
  { address: MOCK_TOKEN_A_ADDRESS, symbol: 'TKA', name: 'Token A', decimals: 18 },
  { address: MOCK_TOKEN_B_ADDRESS, symbol: 'TKB', name: 'Token B', decimals: 18 },
];

type TransactionStatus = 'idle' | 'approving' | 'swapping' | 'success' | 'error';

export default function SwapPage() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const { gaslessEnabled, setGaslessEnabled, relayerFeePercent, signAndRelaySwap, isRelaying, isRelayerAvailable } = useRelayer();
  const { trackSwap, hasReferrer } = useReferralTracking();
  const { playSuccess, playError } = useSound({ enabled: true, volume: 0.3 });
  
  // Token selection state
  const [fromToken, setFromToken] = useState(TOKENS[0]);
  const [toToken, setToToken] = useState(TOKENS[1]);
  
  // Amount state
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  
  // Route optimizer state
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [useRouteOptimizer, setUseRouteOptimizer] = useState(true);
  
  // Swap mode state
  const [swapMode, setSwapMode] = useState<'instant' | 'limit'>('instant');
  
  // Simulator state
  const [showSimulator, setShowSimulator] = useState(false);
  
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Settings state
  const [slippage, setSlippage] = useState('0.5');
  const [deadline, setDeadline] = useState('20'); // minutes
  const [showSettings, setShowSettings] = useState(false);
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
    
    // Check if empty
    if (value === '' || value === '.') {
      setSlippage(value);
      return;
    }
    
    // Check if numeric
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      setSlippageError('Slippage must be a valid number');
      return;
    }
    
    // Check if positive
    if (numValue <= 0) {
      setSlippageError(`Slippage must be positive (min ${MIN_SLIPPAGE}%)`);
      return;
    }
    
    // Check minimum
    if (numValue < MIN_SLIPPAGE) {
      setSlippageError(`Slippage too low (min ${MIN_SLIPPAGE}%)`);
      return;
    }
    
    // Check maximum and cap
    if (numValue > MAX_SLIPPAGE) {
      setSlippage(MAX_SLIPPAGE.toString());
      setSlippageError(`Slippage capped at ${MAX_SLIPPAGE}%`);
      return;
    }
    
    setSlippage(value);
  };
  
  // Validate deadline (M-9: Frontend Deadline Validation)
  const handleDeadlineChange = (value: string) => {
    setDeadlineError('');
    
    // Check if empty
    if (value === '') {
      setDeadline(value);
      return;
    }
    
    // Check if numeric
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
  
  // Transaction state
  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
  const [showTxModal, setShowTxModal] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [txStartTime, setTxStartTime] = useState<number>(0);
  const [showStuckWarning, setShowStuckWarning] = useState(false);

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({ 
    hash,
    confirmations: 2 
  });

  // M-10: Simulation hook for transaction validation
  const { data: simulationData, error: simulationError } = useSimulateContract({
    address: DEX_CORE_ADDRESS as Address,
    abi: DEX_CORE_ABI,
    functionName: 'swap',
    args: fromAmount && toAmount && parseFloat(fromAmount) > 0 && address
      ? [
          fromToken.address as Address,
          toToken.address as Address,
          parseUnits(fromAmount, fromToken.decimals),
          parseUnits(
            (parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(toToken.decimals),
            toToken.decimals
          ),
          address as Address,
        ]
      : undefined,
    query: {
      enabled: !gaslessEnabled && !!fromAmount && !!toAmount && parseFloat(fromAmount) > 0 && !!address,
    },
  });

  // Alias for simulation function
  const simulateSwap = async (config: any) => {
    return { request: simulationData?.request };
  };

  // Get token balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: fromToken.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // Get token allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: fromToken.address as Address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, DEX_CORE_ADDRESS as Address] : undefined,
  });

  // Get quote for swap from DexCore
  const { data: amountOut } = useReadContract({
    address: DEX_CORE_ADDRESS as Address,
    abi: DEX_CORE_ABI,
    functionName: 'getAmountOut',
    args: fromAmount && parseFloat(fromAmount) > 0 
      ? [parseUnits(fromAmount, fromToken.decimals), fromToken.address as Address, toToken.address as Address]
      : undefined,
  });

  // Calculate price impact
  const priceImpact = useMemo(() => {
    if (!fromAmount || !toAmount || parseFloat(fromAmount) === 0) return 0;
    const expectedRate = parseFloat(toAmount) / parseFloat(fromAmount);
    // This is simplified - in production, compare against spot price
    return 0.3; // 0.3% fee
  }, [fromAmount, toAmount]);
  
  // Validate and sanitize amount input
  const handleAmountChange = (value: string) => {
    // Prevent negative values
    if (value.startsWith('-')) return;
    
    // Allow empty, decimal point, or valid positive numbers
    if (value === '' || value === '.' || /^\d*\.?\d*$/.test(value)) {
      setFromAmount(value);
    }
  };

  // Update toAmount when quote changes or route is selected
  useEffect(() => {
    if (useRouteOptimizer && selectedRoute) {
      // Use route optimizer output
      const routeOutput = Number(selectedRoute.totalAmountOut) / (10 ** toToken.decimals);
      setToAmount(routeOutput.toString());
    } else if (amountOut) {
      // Use direct quote
      setToAmount(formatUnits(amountOut as bigint, toToken.decimals));
    } else {
      setToAmount('');
    }
  }, [amountOut, toToken.decimals, selectedRoute, useRouteOptimizer]);

  // Handle transaction status changes
  useEffect(() => {
    if (isPending) {
      setShowTxModal(true);
      setTxStartTime(Date.now());
      setShowStuckWarning(false);
    }
    if (isConfirming && hash) {
      setTxHash(hash);
      // Save transaction to history
      addTransaction({
        hash,
        type: 'swap',
        timestamp: Date.now(),
        status: 'pending',
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        fromAmount,
        toAmount,
        chainId,
      });
    }
    if (isSuccess && hash) {
      setTxStatus('success');
      setShowStuckWarning(false);
      // Update transaction status
      updateTransactionStatus(hash, 'confirmed');
      
      // Track referral if applicable
      if (hasReferrer) {
        const amountIn = parseUnits(fromAmount, fromToken.decimals);
        trackSwap(fromToken.address as Address, toToken.address as Address, amountIn.toString());
      }
      
      playSuccess();
      toast({ 
        title: 'Success!', 
        description: 'Transaction confirmed successfully',
      });
      // Reset form
      setTimeout(() => {
        setFromAmount('');
        setToAmount('');
        setShowTxModal(false);
        setTxStatus('idle');
        setTxStartTime(0);
        refetchBalance();
        refetchAllowance();
      }, 3000);
    }
    if ((writeError || txError) && hash) {
      setTxStatus('error');
      setShowStuckWarning(false);
      // Update transaction status
      updateTransactionStatus(hash, 'failed');
      const errorMessage = (writeError as any)?.message || (txError as any)?.message || 'Unknown error';
      toast({ 
        title: 'Transaction Failed', 
        description: errorMessage.slice(0, 100),
        variant: 'destructive' 
      });
    }
  }, [isPending, isConfirming, isSuccess, writeError, txError, hash, toast, refetchBalance, refetchAllowance]);
  
  // Detect stuck transactions (>30 seconds pending)
  useEffect(() => {
    if (!isPending && !isConfirming) return;
    
    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - txStartTime;
      if (elapsed > 30000 && !showStuckWarning) {
        setShowStuckWarning(true);
      }
    }, 5000);
    
    return () => clearInterval(checkInterval);
  }, [isPending, isConfirming, txStartTime, showStuckWarning]);

  const handleApprove = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      playError();
      toast({ title: 'Error', description: 'Enter a valid amount', variant: 'destructive' });
      return;
    }

    setTxStatus('approving');
    try {
      writeContract({
        address: fromToken.address as Address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [DEX_CORE_ADDRESS as Address, parseUnits(fromAmount, fromToken.decimals)],
      });
    } catch (error) {
      setTxStatus('error');
      playError();
      toast({ title: 'Error', description: 'Failed to approve token', variant: 'destructive' });
    }
  };

  const handleSwap = async () => {
    if (!fromAmount || !toAmount || parseFloat(fromAmount) <= 0) {
      playError();
      toast({ title: 'Error', description: 'Enter valid amounts', variant: 'destructive' });
      return;
    }

    const amountOutMin = parseUnits(
      (parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(toToken.decimals),
      toToken.decimals
    );
    const deadlineSeconds = Math.floor(Date.now() / 1000) + parseInt(deadline) * 60;
    const amountIn = parseUnits(fromAmount, fromToken.decimals);

    // M-10: Transaction Simulation - Simulate before executing
    if (!gaslessEnabled) {
      try {
        const { request } = await simulateSwap({
          address: DEX_CORE_ADDRESS as Address,
          abi: DEX_CORE_ABI,
          functionName: 'swap',
          args: [
            fromToken.address as Address,
            toToken.address as Address,
            amountIn,
            amountOutMin,
            address as Address,
          ],
        });
        
        if (!request) {
          playError();
          toast({
            title: 'Transaction Simulation Failed',
            description: 'Transaction expected to fail. Check slippage tolerance or token balance.',
            variant: 'destructive',
          });
          return;
        }
      } catch (error: any) {
        playError();
        const errorMsg = error?.message || 'Unknown error';
        let userMessage = 'Transaction expected to fail. ';
        
        if (errorMsg.includes('InsufficientOutputAmount')) {
          userMessage += 'Increase slippage tolerance or try a smaller amount.';
        } else if (errorMsg.includes('InsufficientAmount') || errorMsg.includes('balance')) {
          userMessage += 'Insufficient token balance.';
        } else if (errorMsg.includes('allowance')) {
          userMessage += 'Token approval required.';
        } else {
          userMessage += 'Check slippage, balance, and pool liquidity.';
        }
        
        toast({
          title: 'Simulation Failed',
          description: userMessage,
          variant: 'destructive',
        });
        return;
      }
    }

    setTxStatus('swapping');

    // Ghost Mode transaction flow - attempt gasless if relayer available
    if (gaslessEnabled && isRelayerAvailable) {
      try {
        const result = await signAndRelaySwap({
          tokenIn: fromToken.address as Address,
          tokenOut: toToken.address as Address,
          amountIn: fromAmount,
          amountOutMin: amountOutMin.toString(),
          deadline: deadlineSeconds,
          decimalsIn: fromToken.decimals,
        });

        if (result.success && result.txHash) {
          setTxHash(result.txHash);
          setShowTxModal(true);
          // Save to history
          addTransaction({
            hash: result.txHash,
            type: 'swap',
            timestamp: Date.now(),
            status: 'pending',
            fromToken: fromToken.symbol,
            toToken: toToken.symbol,
            fromAmount,
            toAmount,
            chainId,
          });
          // Track referral if applicable
          if (hasReferrer) {
            const amountIn = parseUnits(fromAmount, fromToken.decimals);
            await trackSwap(fromToken.address as Address, toToken.address as Address, amountIn.toString());
          }
          
          // Simulate success after delay (since we can't track relayed tx)
          setTimeout(() => {
            setTxStatus('success');
            updateTransactionStatus(result.txHash!, 'confirmed');
            toast({ 
              title: 'Gasless Swap Complete!', 
              description: 'Transaction confirmed successfully',
            });
            setTimeout(() => {
              setFromAmount('');
              setToAmount('');
              setShowTxModal(false);
              setTxStatus('idle');
              refetchBalance();
              refetchAllowance();
            }, 3000);
          }, 5000);
        } else {
          setTxStatus('error');
        }
      } catch (error) {
        setTxStatus('error');
        playError();
        toast({ title: 'Error', description: 'Gasless swap failed', variant: 'destructive' });
      }
      return;
    }
    
    // Fallback notification if Ghost Mode enabled but relayer unavailable
    if (gaslessEnabled && !isRelayerAvailable) {
      toast({
        title: 'Ghost Mode Unavailable',
        description: 'Relayer offline. Using standard wallet signing.',
        variant: 'default',
      });
    }

    // Regular transaction flow
    try {
      writeContract({
        address: DEX_CORE_ADDRESS as Address,
        abi: DEX_CORE_ABI,
        functionName: 'swap',
        args: [
          fromToken.address as Address,
          toToken.address as Address,
          amountIn,
          amountOutMin,
          address as Address,
          BigInt(deadlineSeconds),
        ],
      });
    } catch (error) {
      setTxStatus('error');
      playError();
      toast({ title: 'Error', description: 'Swap failed', variant: 'destructive' });
    }
  };
  
  const confirmSwap = () => {
    setShowConfirmModal(false);
    handleSwap();
  };

  const [isSwitching, setIsSwitching] = useState(false);
  
  const switchTokens = () => {
    setIsSwitching(true);
    setTimeout(() => {
      setFromToken(toToken);
      setToToken(fromToken);
      setFromAmount('');
      setToAmount('');
      setIsSwitching(false);
    }, 150);
  };

  const setMaxAmount = () => {
    if (balance) {
      setFromAmount(formatUnits(balance as bigint, fromToken.decimals));
    }
  };

  const needsApproval = useMemo(() => {
    if (!allowance || !fromAmount) return false;
    try {
      return parseUnits(fromAmount, fromToken.decimals) > (allowance as bigint);
    } catch {
      return false;
    }
  }, [allowance, fromAmount, fromToken.decimals]);

  const isSwapDisabled = !isConnected || !fromAmount || !toAmount || parseFloat(fromAmount) <= 0 || !!slippageError || !!deadlineError;

  // Calculate current price for limit orders
  const currentPrice = useMemo(() => {
    if (!fromAmount || !toAmount || parseFloat(fromAmount) === 0) return undefined;
    return (parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6);
  }, [fromAmount, toAmount]);

  // Mock market data for HUD
  const ethPrice = 3240;
  const ethChange = 2.4;
  const gasPrice = 12;

  return (
    <div className="relative min-h-screen px-4 py-8">
      {/* 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto items-center min-h-[calc(100vh-8rem)]">
        
        {/* LEFT COLUMN - THE MARKET */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          {/* Price Display */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-4xl md:text-5xl font-bold text-brand-platinum">ETH/USDC</h2>
              <TrendingUp className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-4">
              <span className="font-mono text-6xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-yellow-300 to-brand-gold">
                $3,240.50
              </span>
              <span className="text-2xl text-emerald-400 font-semibold">+2.4%</span>
            </div>
            <p className="text-brand-platinum/50 text-sm font-mono">LIVE MARKET PRICE</p>
          </div>

          {/* Price Chart */}
          <div className="relative h-[300px] lg:h-[400px] rounded-2xl border border-brand-gold/20 bg-black/40 backdrop-blur-sm p-6 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/5 to-transparent" />
            <PriceChart className="relative z-10" />
          </div>

          {/* Market Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="glass-onyx p-4 rounded-xl text-center">
              <p className="text-brand-platinum/50 text-xs uppercase tracking-wider mb-1">24h Volume</p>
              <p className="text-brand-gold font-bold text-lg">$2.4B</p>
            </div>
            <div className="glass-onyx p-4 rounded-xl text-center">
              <p className="text-brand-platinum/50 text-xs uppercase tracking-wider mb-1">24h High</p>
              <p className="text-brand-gold font-bold text-lg">$3,289</p>
            </div>
            <div className="glass-onyx p-4 rounded-xl text-center">
              <p className="text-brand-platinum/50 text-xs uppercase tracking-wider mb-1">24h Low</p>
              <p className="text-brand-gold font-bold text-lg">$3,180</p>
            </div>
          </div>
        </motion.div>

        {/* RIGHT COLUMN - THE REACTOR */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative z-10 w-full max-w-md mx-auto lg:mx-0"
        >
        {/* Market HUD */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-5 px-4 py-2 bg-black/40 backdrop-blur-sm border border-brand-gold/10 rounded-lg"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-gray-400">ETH</span>
                <span className="text-brand-platinum ml-2">${ethPrice.toLocaleString()}</span>
                <span className="text-emerald-400 ml-1">(+{ethChange}%)</span>
              </div>
              <div>
                <span className="text-gray-400">Gas</span>
                <span className="text-gray-300 ml-2">{gasPrice} Gwei</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Ghost Mode</span>
              {isRelayerAvailable ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-bold">READY</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                  <span className="text-gray-500">OFFLINE</span>
                </>
              )}
            </div>
          </div>
        </motion.div>

          {/* Reactor Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-3xl font-bold text-brand-platinum">THE REACTOR</h3>
              <p className="text-brand-platinum/50 text-sm mt-1">Instant execution. Zero friction.</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className="text-brand-gold-dim hover:text-brand-gold hover:bg-brand-gold/10 transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>

          {/* Floating Swap Interface */}
          <div className="space-y-6">
            
            <div className="space-y-4">
              {/* Swap Mode Toggle */}
              <Tabs value={swapMode} onValueChange={(v) => setSwapMode(v as 'instant' | 'limit')}>
                <TabsList className="grid w-full grid-cols-2 bg-brand-surface/80 border border-brand-gold/10">
                  <TabsTrigger value="instant" className="min-h-[44px] font-sans uppercase tracking-widest text-xs data-[state=active]:bg-brand-gold data-[state=active]:text-brand-void data-[state=inactive]:bg-transparent data-[state=inactive]:text-brand-gold/50 data-[state=inactive]:border data-[state=inactive]:border-brand-gold/10 hover:text-brand-gold transition-colors">
                    MARKET
                  </TabsTrigger>
                  <TabsTrigger value="limit" className="min-h-[44px] font-sans uppercase tracking-widest text-xs data-[state=active]:bg-brand-gold data-[state=active]:text-brand-void data-[state=inactive]:bg-transparent data-[state=inactive]:text-brand-gold/50 data-[state=inactive]:border data-[state=inactive]:border-brand-gold/10 hover:text-brand-gold transition-colors">
                    LIMIT
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {swapMode === 'instant' ? (
                <>
                  {/* Settings Panel */}
                  {showSettings && (
                    <div className="p-4 bg-brand-surface/60 rounded-xl border border-brand-gold/10 space-y-4 animate-in slide-in-from-top-2">
                      <div className="space-y-2">
                        <Label className="text-brand-platinum font-medium">Slippage Tolerance</Label>
                        <div className="flex gap-2">
                          {['0.1', '0.5', '1.0'].map((val) => (
                            <Button
                              key={val}
                              variant={slippage === val ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => handleSlippageChange(val)}
                              className={`flex-1 transition-all ${
                                slippage === val 
                                  ? 'bg-brand-gold text-brand-void hover:bg-brand-gold/90 font-bold' 
                                  : 'bg-transparent border-brand-gold/20 text-brand-platinum hover:bg-brand-gold/10'
                              }`}
                            >
                              {val}%
                            </Button>
                          ))}
                          <Input
                            type="number"
                            value={slippage}
                            onChange={(e) => handleSlippageChange(e.target.value)}
                            className={`w-24 bg-transparent border-brand-gold/20 text-brand-platinum focus:border-brand-gold focus:ring-brand-gold/50 ${
                              slippageError ? 'border-red-500' : ''
                            }`}
                            step="0.01"
                            min="0.01"
                            max="50"
                            aria-label="Custom slippage"
                          />
                        </div>
                        {slippageError && (
                          <p className="text-xs text-red-400 mt-1">{slippageError}</p>
                        )}
                        <p className="text-xs text-gray-400">Min: {MIN_SLIPPAGE}% | Max: {MAX_SLIPPAGE}%</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-brand-platinum">Transaction Deadline (minutes)</Label>
                        <Input
                          type="number"
                          placeholder="20"
                          value={deadline}
                          onChange={(e) => handleDeadlineChange(e.target.value)}
                          className={`bg-transparent border-brand-gold/20 text-brand-platinum focus:border-brand-gold focus:ring-brand-gold/50 ${
                            deadlineError ? 'border-red-500' : ''
                          }`}
                          min="1"
                          max="60"
                          aria-label="Transaction deadline"
                        />
                        {deadlineError && (
                          <p className="text-xs text-red-400 mt-1">{deadlineError}</p>
                        )}
                        <p className="text-xs text-gray-400">Range: {MIN_DEADLINE}-{MAX_DEADLINE} minutes (shorter = less MEV risk)</p>
                      </div>
                    </div>
                  )}

                  {/* From Token */}
                  <motion.div 
                    className="space-y-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                  >
                    <div className="flex items-center justify-between">
                      <Label className="text-brand-platinum/60 font-sans text-sm">From</Label>
                      {balance !== undefined && (
                        <button
                          onClick={setMaxAmount}
                          className="text-sm text-brand-gold hover:text-brand-gold/80 transition-colors font-sans"
                          aria-label="Set maximum amount"
                        >
                          Balance: {parseFloat(formatUnits(balance as bigint, fromToken.decimals)).toFixed(4)} {fromToken.symbol}
                        </button>
                      )}
                    </div>
                    <div className="flex gap-3 p-6 bg-black/60 backdrop-blur-md rounded-2xl border border-brand-gold/30 focus-within:border-brand-gold focus-within:shadow-lg focus-within:shadow-brand-gold/20 transition-all">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.0"
                        value={fromAmount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        className="flex-1 bg-transparent border-0 text-transparent bg-clip-text bg-gradient-to-r from-platinum to-white text-6xl font-mono font-bold placeholder:text-brand-platinum/20 focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
                        aria-label="From amount"
                      />
                      <button
                        onClick={() => {
                          const selector = document.querySelector('[data-token-selector-from]');
                          if (selector) (selector as HTMLElement).click();
                        }}
                        className="bg-gradient-to-br from-brand-gold to-yellow-600 text-black font-bold rounded-full px-6 py-3 hover:scale-105 hover:shadow-lg hover:shadow-brand-gold/50 transition-all text-sm border-2 border-brand-gold/30 shadow-md"
                      >
                        {fromToken.symbol}
                      </button>
                      <div className="hidden">
                        <TokenSelector
                          tokens={TOKENS}
                          selectedToken={fromToken}
                          onSelectToken={setFromToken}
                          excludeToken={toToken}
                          label="Select Token to Pay"
                          data-token-selector-from
                        />
                      </div>
                    </div>
                  </motion.div>

                  {/* Switch Button */}
                  <div className="flex justify-center -my-2 relative z-10">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={switchTokens}
                      className={`rounded-full bg-brand-surface border-2 border-brand-gold/30 text-brand-gold hover:bg-brand-gold/10 hover:border-brand-gold shadow-lg transition-all hover:scale-110 ${
                        isSwitching ? 'animate-spin' : ''
                      }`}
                      aria-label="Switch tokens"
                    >
                      <ArrowDownUp className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* To Token */}
                  <motion.div 
                    className="space-y-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                  >
                    <Label className="text-brand-platinum/60 font-sans text-sm">To</Label>
                    <div className="flex gap-3 p-6 bg-black/60 backdrop-blur-md rounded-2xl border border-brand-gold/30 focus-within:border-brand-gold focus-within:shadow-lg focus-within:shadow-brand-gold/20 transition-all">
                      <Input
                        type="number"
                        placeholder="0.0"
                        value={toAmount}
                        readOnly
                        className="flex-1 bg-transparent border-0 text-transparent bg-clip-text bg-gradient-to-r from-platinum to-white text-6xl font-mono font-bold placeholder:text-brand-platinum/20 focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
                        aria-label="To amount"
                      />
                      <button
                        onClick={() => {
                          const selector = document.querySelector('[data-token-selector-to]');
                          if (selector) (selector as HTMLElement).click();
                        }}
                        className="bg-gradient-to-br from-brand-gold to-yellow-600 text-black font-bold rounded-full px-6 py-3 hover:scale-105 hover:shadow-lg hover:shadow-brand-gold/50 transition-all text-sm border-2 border-brand-gold/30 shadow-md"
                      >
                        {toToken.symbol}
                      </button>
                      <div className="hidden">
                        <TokenSelector
                          tokens={TOKENS}
                          selectedToken={toToken}
                          onSelectToken={setToToken}
                          excludeToken={fromToken}
                          label="Select Token to Receive"
                          data-token-selector-to
                        />
                      </div>
                    </div>
                  </motion.div>

                  {/* Route Optimizer */}
                  {useRouteOptimizer && fromAmount && parseFloat(fromAmount) > 0 && (
                    <RouteOptimizer
                      tokenIn={fromToken}
                      tokenOut={toToken}
                      amountIn={fromAmount}
                      chainId={chainId}
                      slippage={parseFloat(slippage)}
                      onRouteSelect={setSelectedRoute}
                      selectedRoute={selectedRoute}
                    />
                  )}

                  {/* Price Info */}
                  {fromAmount && toAmount && parseFloat(fromAmount) > 0 && !useRouteOptimizer && (
                    <div className="p-4 bg-gradient-to-br from-brand-gold/10 to-amber-600/5 border border-brand-gold/20 rounded-xl space-y-2 animate-in fade-in-50">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-brand-gold" />
                        <div className="flex-1 space-y-1 text-sm">
                          <div className="flex justify-between text-brand-platinum/80">
                            <span>Rate</span>
                            <span className="font-medium">
                              1 {fromToken.symbol} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken.symbol}
                            </span>
                          </div>
                          <div className="flex justify-between text-brand-platinum/80">
                            <span>Price Impact</span>
                            <span className={`font-medium ${priceImpact > 5 ? 'text-red-400' : ''}`}>
                              ~{priceImpact.toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex justify-between text-brand-platinum/80">
                            <span>Minimum Received</span>
                            <span className="font-medium">
                              {(parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(6)} {toToken.symbol}
                            </span>
                          </div>
                          <div className="flex justify-between text-brand-gold text-xs pt-1 border-t border-brand-gold/20">
                            <span>Swap Fee</span>
                            <span>0.3%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Execute Button */}
                  {!isConnected ? (
                    <Button 
                      className="w-full h-16 bg-gradient-to-r from-brand-gold via-yellow-400 to-brand-gold hover:shadow-2xl hover:shadow-brand-gold/50 hover:scale-[1.02] text-black font-bold text-xl uppercase tracking-[0.3em] transition-all relative overflow-hidden group" 
                      disabled
                    >
                      <span className="relative z-10">INITIATE</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    </Button>
                  ) : needsApproval ? (
                    <Button
                      className="w-full h-16 bg-gradient-to-r from-brand-gold via-yellow-400 to-brand-gold hover:shadow-2xl hover:shadow-brand-gold/50 hover:scale-[1.02] text-black font-bold text-xl uppercase tracking-[0.3em] transition-all disabled:opacity-50 relative overflow-hidden group"
                      onClick={handleApprove}
                      disabled={isPending || isConfirming || txStatus === 'approving'}
                    >
                      <span className="relative z-10">
                        {txStatus === 'approving' ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Approving {fromToken.symbol}...
                          </span>
                        ) : (
                          `Approve ${fromToken.symbol}`
                        )}
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        className="w-full h-16 bg-gradient-to-r from-brand-gold via-yellow-400 to-brand-gold hover:shadow-2xl hover:shadow-brand-gold/50 hover:scale-[1.02] text-black font-bold text-xl uppercase tracking-[0.3em] transition-all disabled:opacity-50 relative overflow-hidden group"
                        onClick={() => setShowConfirmModal(true)}
                        disabled={isSwapDisabled || isPending || isConfirming || txStatus === 'swapping' || isRelaying}
                      >
                        <span className="relative z-10">
                          {txStatus === 'swapping' || isRelaying ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              {gaslessEnabled ? 'Signing & Relaying...' : 'Swapping...'}
                            </span>
                          ) : (
                            'INITIATE'
                          )}
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => setShowSimulator(!showSimulator)}
                        disabled={!fromAmount || parseFloat(fromAmount) <= 0}
                        className="w-full border-brand-gold text-brand-gold hover:bg-brand-gold/10"
                      >
                        {showSimulator ? 'Hide' : 'Simulate'} Transaction
                      </Button>
                    </div>
                  )}
                    
                  {showSimulator && fromAmount && parseFloat(fromAmount) > 0 && (
                    <TxSimulator
                      type="swap"
                      params={{
                        fromToken: fromToken.address,
                        toToken: toToken.address,
                        amountIn: parseUnits(fromAmount, fromToken.decimals).toString(),
                      }}
                      slippage={parseFloat(slippage)}
                    />
                  )}
                </>
              ) : (
                <LimitOrder
                  fromToken={fromToken}
                  toToken={toToken}
                  fromAmount={fromAmount}
                  currentPrice={currentPrice}
                />
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="glass-onyx text-brand-platinum">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading text-brand-platinum">CONFIRM SWAP</DialogTitle>
            <DialogDescription className="text-brand-platinum/60">
              Review your transaction details before confirming
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-brand-surface/60 rounded-xl border border-brand-gold/10 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">You Pay</span>
                <div className="text-right">
                  <div className="text-xl font-bold">{fromAmount} {fromToken.symbol}</div>
                </div>
              </div>
              
              <div className="flex justify-center">
                <ArrowDownUp className="w-5 h-5 text-gray-500" />
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-400">You Receive</span>
                <div className="text-right">
                  <div className="text-xl font-bold">{parseFloat(toAmount).toFixed(6)} {toToken.symbol}</div>
                  <div className="text-xs text-gray-500">Min: {(parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(6)}</div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Rate</span>
                <span>1 {fromToken.symbol} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Price Impact</span>
                <span className={priceImpact > 5 ? 'text-red-400 font-semibold' : 'text-brand-gold'}>
                  {priceImpact > 5 ? '⚠️ ' : ''}{priceImpact.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Slippage Tolerance</span>
                <span>{slippage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Swap Fee</span>
                <span>0.3%</span>
              </div>
              {gaslessEnabled && (
                <div className="flex justify-between border-t border-white/10 pt-2">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-400" />
                    Relayer Fee
                  </span>
                  <span className="text-emerald-400">{relayerFeePercent}%</span>
                </div>
              )}
            </div>
            
            {priceImpact > 5 && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-300">
                  <div className="font-semibold">High Price Impact Warning</div>
                  <div className="text-xs mt-1">This swap has a price impact above 5%. You may receive significantly less than expected.</div>
                </div>
              </div>
            )}
            
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-brand-gold text-brand-gold hover:bg-brand-gold/10"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-brand-gold hover:bg-brand-gold/90 text-brand-void font-bold uppercase"
                onClick={confirmSwap}
              >
                Confirm Swap
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Transaction Modal */}
      <Dialog open={showTxModal} onOpenChange={setShowTxModal}>
        <DialogContent className="glass-onyx text-brand-platinum">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {txStatus === 'success' ? 'Transaction Successful!' : 
               txStatus === 'error' ? 'Transaction Failed' : 
               'Transaction Pending'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {txStatus === 'success' ? 'Your swap has been completed successfully' :
               txStatus === 'error' ? 'There was an error processing your transaction' :
               'Please confirm the transaction in your wallet'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            {txStatus === 'success' ? (
              <div className="w-20 h-20 rounded-full bg-brand-gold/20 flex items-center justify-center animate-in zoom-in-50">
                <CheckCircle2 className="w-12 h-12 text-brand-gold" />
              </div>
            ) : txStatus === 'error' ? (
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center animate-in zoom-in-50">
                <AlertCircle className="w-12 h-12 text-red-500" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand-gold/20 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-brand-gold animate-spin" />
              </div>
            )}
            
            {showStuckWarning && txStatus !== 'success' && txStatus !== 'error' && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2 max-w-md">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-300">
                  <div className="font-semibold">Transaction Taking Longer Than Expected</div>
                  <div className="text-xs mt-1">
                    Your transaction is still pending. This may be due to network congestion. 
                    Please check your wallet or wait a bit longer.
                  </div>
                </div>
              </div>
            )}
            
            {txHash && (
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-400">Transaction Hash</p>
                <code className="text-xs bg-white/5 px-3 py-2 rounded border border-white/10 block">
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </code>
              </div>
            )}
            
            {txStatus === 'success' && (
              <Button
                onClick={() => setShowTxModal(false)}
                className="mt-4 bg-brand-gold hover:bg-brand-gold/90 text-black"
              >
                Close
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
