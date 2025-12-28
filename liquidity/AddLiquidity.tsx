import { useState, useEffect } from 'react';
import { Address, formatUnits, parseUnits } from 'viem';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Info, AlertTriangle, HelpCircle, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useRelayer } from '@/context/RelayerProvider';
import { useReferralTracking } from '@/hooks/useReferralTracking';
import { sqrt } from '@/utils/math';
import { DEX_CORE_ADDRESS, DEX_CORE_ABI, ERC20_ABI } from '@/utils/evmConfig';
import { PoolSelector } from './PoolSelector';
import { AmountInput } from './AmountInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TxSimulator } from '@/components/common/TxSimulator';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface AddLiquidityProps {
  tokens: Token[];
  tokenA: Token;
  tokenB: Token;
  onTokenAChange: (token: Token) => void;
  onTokenBChange: (token: Token) => void;
  slippageTolerance: string;
  deadline: string;
}

export function AddLiquidity({
  tokens,
  tokenA,
  tokenB,
  onTokenAChange,
  onTokenBChange,
  slippageTolerance,
  deadline,
}: AddLiquidityProps) {
  const { address } = useAccount();
  const { toast } = useToast();
  const { gaslessEnabled, setGaslessEnabled, relayerFeePercent, signAndRelayLiquidity, isRelaying } = useRelayer();
  const { trackLiquidity, hasReferrer } = useReferralTracking();
  
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [showSimulator, setShowSimulator] = useState(false);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ 
    hash,
    confirmations: 2 
  });

  // Track referral on successful transaction
  useEffect(() => {
    if (isSuccess && hash && hasReferrer && amountA && amountB) {
      const amtA = parseUnits(amountA, tokenA.decimals);
      const amtB = parseUnits(amountB, tokenB.decimals);
      trackLiquidity(tokenA.address as Address, tokenB.address as Address, amtA.toString(), amtB.toString());
    }
  }, [isSuccess, hash, hasReferrer, amountA, amountB, tokenA, tokenB, trackLiquidity]);

  // Get token balances
  const { data: balanceA } = useReadContract({
    address: tokenA.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const { data: balanceB } = useReadContract({
    address: tokenB.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // Get allowances
  const { data: allowanceA } = useReadContract({
    address: tokenA.address as Address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, DEX_CORE_ADDRESS as Address] : undefined,
  });

  const { data: allowanceB } = useReadContract({
    address: tokenB.address as Address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, DEX_CORE_ADDRESS as Address] : undefined,
  });

  // Get pool reserves
  const { data: reserves } = useReadContract({
    address: DEX_CORE_ADDRESS as Address,
    abi: DEX_CORE_ABI,
    functionName: 'getReserves',
    args: [tokenA.address as Address, tokenB.address as Address],
  });

  // Get LP token total supply
  const { data: lpTokenAddress } = useReadContract({
    address: DEX_CORE_ADDRESS as Address,
    abi: DEX_CORE_ABI,
    functionName: 'lpTokens',
    args: [tokenA.address as Address, tokenB.address as Address],
  });

  const { data: lpTotalSupply } = useReadContract({
    address: lpTokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'totalSupply',
    args: lpTokenAddress ? [] : undefined,
  });

  // Calculate current pool price
  const poolPrice = (() => {
    if (!reserves || reserves[0] === 0n || reserves[1] === 0n) return null;
    const price = (Number(reserves[1]) / Number(reserves[0])).toFixed(6);
    return price;
  })();

  // Calculate expected LP tokens
  const expectedLPTokens = (() => {
    if (!amountA || !amountB || !reserves || !lpTotalSupply) return '0';
    
    try {
      const amountABigInt = parseUnits(amountA, tokenA.decimals);
      const amountBBigInt = parseUnits(amountB, tokenB.decimals);
      const reserve0 = reserves[0] as bigint;
      const reserve1 = reserves[1] as bigint;

      if (reserve0 === 0n || reserve1 === 0n) {
        // First liquidity provision
        const liquidity = sqrt(amountABigInt * amountBBigInt);
        return formatUnits(liquidity, 18);
      }

      // Subsequent provisions
      const liquidity0 = (amountABigInt * lpTotalSupply) / reserve0;
      const liquidity1 = (amountBBigInt * lpTotalSupply) / reserve1;
      const liquidity = liquidity0 < liquidity1 ? liquidity0 : liquidity1;
      
      return formatUnits(liquidity, 18);
    } catch {
      return '0';
    }
  })();

  // Calculate pool share after adding liquidity
  const poolShareAfterAdd = (() => {
    if (!expectedLPTokens || expectedLPTokens === '0' || !lpTotalSupply) return '0';
    
    try {
      const expectedLP = parseUnits(expectedLPTokens, 18);
      const newTotalSupply = lpTotalSupply + expectedLP;
      const share = (Number(expectedLP) / Number(newTotalSupply)) * 100;
      return share.toFixed(4);
    } catch {
      return '0';
    }
  })();

  // Calculate price impact and detect volatile pairs
  const priceImpact = (() => {
    if (!amountA || !amountB || !reserves || reserves[0] === 0n || reserves[1] === 0n) return 0;
    
    try {
      const amountABigInt = parseUnits(amountA, tokenA.decimals);
      const amountBBigInt = parseUnits(amountB, tokenB.decimals);
      
      const currentPrice = Number(reserves[1]) / Number(reserves[0]);
      const providedPrice = Number(amountBBigInt) / Number(amountABigInt);
      
      const impact = Math.abs((providedPrice - currentPrice) / currentPrice) * 100;
      return impact;
    } catch {
      return 0;
    }
  })();

  const isVolatilePair = priceImpact > 2; // More than 2% price deviation

  const handleApproveToken = async (token: Token, amount: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: 'Error', description: 'Enter a valid amount', variant: 'destructive' });
      return;
    }

    try {
      writeContract({
        address: token.address as Address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [DEX_CORE_ADDRESS as Address, parseUnits(amount, token.decimals)],
      });
      toast({ title: 'Approval Pending', description: `Approving ${token.symbol}...` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to approve token', variant: 'destructive' });
    }
  };

  const handleAddLiquidity = async () => {
    if (!amountA || !amountB || parseFloat(amountA) <= 0 || parseFloat(amountB) <= 0) {
      toast({ title: 'Error', description: 'Enter valid amounts', variant: 'destructive' });
      return;
    }

    const amountADesired = parseUnits(amountA, tokenA.decimals);
    const amountBDesired = parseUnits(amountB, tokenB.decimals);
    const slippage = parseFloat(slippageTolerance || '0.5');
    const slippageMultiplier = (100 - slippage) / 100;
    const amountAMin = BigInt(Math.floor(Number(amountADesired) * slippageMultiplier));
    const amountBMin = BigInt(Math.floor(Number(amountBDesired) * slippageMultiplier));
    const deadlineMinutes = parseInt(deadline || '20', 10);
    const deadlineSeconds = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);

    // Gasless transaction flow
    if (gaslessEnabled) {
      try {
        const result = await signAndRelayLiquidity({
          tokenA: tokenA.address as Address,
          tokenB: tokenB.address as Address,
          amountA,
          amountB,
          amountAMin: amountAMin.toString(),
          amountBMin: amountBMin.toString(),
          deadline: deadlineSeconds,
          decimalsA: tokenA.decimals,
          decimalsB: tokenB.decimals,
          action: 'add',
        });

        if (result.success) {
          // Track referral if applicable
          if (hasReferrer) {
            const amtA = parseUnits(amountA, tokenA.decimals);
            const amtB = parseUnits(amountB, tokenB.decimals);
            await trackLiquidity(tokenA.address as Address, tokenB.address as Address, amtA.toString(), amtB.toString());
          }
          
          toast({ 
            title: 'Gasless Liquidity Added!', 
            description: 'Transaction relayed successfully',
          });
          setAmountA('');
          setAmountB('');
        }
      } catch (error) {
        toast({ title: 'Error', description: 'Gasless liquidity failed', variant: 'destructive' });
      }
      return;
    }

    // Regular transaction flow
    try {
      writeContract({
        address: DEX_CORE_ADDRESS as Address,
        abi: DEX_CORE_ABI,
        functionName: 'addLiquidity',
        args: [
          tokenA.address as Address,
          tokenB.address as Address,
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          address as Address,
          BigInt(deadlineSeconds),
        ],
      });
      toast({ title: 'Transaction Pending', description: 'Adding liquidity...' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add liquidity', variant: 'destructive' });
    }
  };

  const needsApprovalA = allowanceA !== undefined && amountA && 
    parseUnits(amountA, tokenA.decimals) > (allowanceA as bigint);
  const needsApprovalB = allowanceB !== undefined && amountB && 
    parseUnits(amountB, tokenB.decimals) > (allowanceB as bigint);

  return (
    <div className="space-y-8">
      {/* Ghost Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-brand-gold/40 tracking-[0.3em] uppercase font-mono">Ghost Mode</span>
        </div>
        <div className="flex items-center gap-2">
          {gaslessEnabled && (
            <span className="text-xs bg-brand-gold/10 text-brand-gold px-2 py-1 rounded-full font-semibold uppercase tracking-wide">Active</span>
          )}
          <Switch
            checked={gaslessEnabled}
            onCheckedChange={setGaslessEnabled}
            className="data-[state=checked]:bg-brand-gold"
            aria-label="Enable gasless transactions"
          />
        </div>
      </div>

      <div className="space-y-8">
        <div className="space-y-2">
          <label className="text-[10px] text-brand-gold/40 tracking-[0.3em] uppercase font-mono">{tokenA.symbol}</label>
          <AmountInput
            label={`${tokenA.symbol} Amount`}
            token={tokenA}
            amount={amountA}
            balance={balanceA as bigint}
            onAmountChange={setAmountA}
          />
        </div>

        <div className="flex justify-center">
          <Plus className="w-6 h-6 text-brand-gold drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-brand-gold/40 tracking-[0.3em] uppercase font-mono">{tokenB.symbol}</label>
          <AmountInput
            label={`${tokenB.symbol} Amount`}
            token={tokenB}
            amount={amountB}
            balance={balanceB as bigint}
            onAmountChange={setAmountB}
          />
        </div>
      </div>

      {/* Impermanent Loss Warning */}
      {isVolatilePair && amountA && amountB && (
        <Alert className="bg-yellow-500/10 border-yellow-500/50">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-yellow-200">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <strong>Impermanent Loss Warning:</strong> Price deviation detected ({priceImpact.toFixed(2)}%). 
                Adding liquidity at a different ratio than the pool may result in impermanent loss if prices revert.
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-yellow-300 hover:text-yellow-100 transition-colors flex-shrink-0" aria-label="Learn more about impermanent loss">
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm bg-gray-800 border-white/10 text-white">
                    <div className="space-y-2 text-xs">
                      <p className="font-semibold">What is Impermanent Loss?</p>
                      <p>When you provide liquidity, you deposit two tokens at a specific ratio. If the price ratio changes significantly, you may end up with less value than if you had simply held the tokens.</p>
                      <p className="font-semibold mt-2">Why does it happen?</p>
                      <p>Automated market makers rebalance your position as traders swap tokens. Large price movements mean your position gets rebalanced at unfavorable rates.</p>
                      <p className="font-semibold mt-2">How to minimize it?</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Provide liquidity to stable pairs (e.g., stablecoin pairs)</li>
                        <li>Choose pools with high trading fees to offset losses</li>
                        <li>Monitor price movements and adjust positions</li>
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Pool Information */}
      {reserves && Array.isArray(reserves) && reserves.length >= 2 ? (
        <div className="space-y-3 p-6 border border-brand-gold/10 rounded-lg bg-brand-gold/5">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-brand-gold/60" />
            <span className="text-[10px] text-brand-gold/40 tracking-[0.3em] uppercase font-mono">Pool Information</span>
          </div>
          
          {poolPrice && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-brand-platinum/60">Current Price</span>
              <span className="text-brand-platinum font-medium font-mono">
                1 {tokenA.symbol} = {poolPrice} {tokenB.symbol}
              </span>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-brand-platinum/60">Expected LP Tokens</span>
            <span className="text-brand-platinum font-medium font-mono">{parseFloat(expectedLPTokens).toFixed(6)}</span>
          </div>
          
          {poolShareAfterAdd !== '0' && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-brand-platinum/60">Your Pool Share</span>
              <span className="text-brand-platinum font-medium font-mono">{poolShareAfterAdd}%</span>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-brand-platinum/60">Slippage Tolerance</span>
            <span className="text-brand-platinum font-medium font-mono">{slippageTolerance}%</span>
          </div>

          {priceImpact > 0.1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-brand-platinum/60">Price Impact</span>
              <span className={`font-medium font-mono ${priceImpact > 2 ? 'text-yellow-400' : 'text-brand-platinum'}`}>
                {priceImpact.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      ) : null}

      {/* Reactor Bar Button */}
      {!address ? (
        <Button className="w-full py-6 border border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-brand-void uppercase tracking-[0.3em] transition-all font-heading text-sm" disabled tabIndex={0}>
          Connect Wallet
        </Button>
      ) : needsApprovalA ? (
        <Button
          className="w-full py-6 border border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-brand-void uppercase tracking-[0.3em] transition-all font-heading text-sm"
          onClick={() => handleApproveToken(tokenA, amountA)}
          disabled={isPending || isConfirming}
          aria-label={`Approve ${tokenA.symbol} for liquidity provision`}
          tabIndex={0}
        >
          {isPending || isConfirming ? 'Approving...' : `Approve ${tokenA.symbol}`}
        </Button>
      ) : needsApprovalB ? (
        <Button
          className="w-full py-6 border border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-brand-void uppercase tracking-[0.3em] transition-all font-heading text-sm"
          onClick={() => handleApproveToken(tokenB, amountB)}
          disabled={isPending || isConfirming}
          aria-label={`Approve ${tokenB.symbol} for liquidity provision`}
          tabIndex={0}
        >
          {isPending || isConfirming ? 'Approving...' : `Approve ${tokenB.symbol}`}
        </Button>
      ) : (
        <Button
          className="w-full py-6 border border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-brand-void uppercase tracking-[0.3em] transition-all font-heading text-sm"
          onClick={handleAddLiquidity}
          disabled={isPending || isConfirming || isRelaying || !amountA || !amountB}
          aria-label="Add liquidity to pool"
          tabIndex={0}
        >
          {isPending || isConfirming || isRelaying ? (
            <span className="flex items-center gap-2">
              {gaslessEnabled ? 'Signing & Relaying...' : 'Adding Liquidity...'}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {gaslessEnabled && <Zap className="w-5 h-5" />}
              {gaslessEnabled ? 'Ghost Add Liquidity' : 'Add Liquidity'}
            </span>
          )}
        </Button>
      )}
    </div>
  );
}
