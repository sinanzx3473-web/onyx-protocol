import { useState } from 'react';
import { Address, formatUnits, parseUnits } from 'viem';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Info, TrendingDown, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRelayer } from '@/context/RelayerProvider';
import { DEX_CORE_ADDRESS, DEX_CORE_ABI, ERC20_ABI } from '@/utils/evmConfig';
import { PoolSelector } from './PoolSelector';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface RemoveLiquidityProps {
  tokens: Token[];
  tokenA: Token;
  tokenB: Token;
  onTokenAChange: (token: Token) => void;
  onTokenBChange: (token: Token) => void;
  slippageTolerance: string;
  deadline: string;
}

export function RemoveLiquidity({
  tokens,
  tokenA,
  tokenB,
  onTokenAChange,
  onTokenBChange,
  slippageTolerance,
  deadline,
}: RemoveLiquidityProps) {
  const { address } = useAccount();
  const { toast } = useToast();
  const { gaslessEnabled, setGaslessEnabled, relayerFeePercent, signAndRelayLiquidity, isRelaying } = useRelayer();
  
  const [removePercentage, setRemovePercentage] = useState(50);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ 
    hash,
    confirmations: 2 
  });

  // Get LP token address
  const { data: lpTokenAddress } = useReadContract({
    address: DEX_CORE_ADDRESS as Address,
    abi: DEX_CORE_ABI,
    functionName: 'lpTokens',
    args: [tokenA.address as Address, tokenB.address as Address],
  });

  // Get LP token balance
  const { data: lpBalance } = useReadContract({
    address: lpTokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address && lpTokenAddress ? [address] : undefined,
  });

  // Get LP token total supply
  const { data: lpTotalSupply } = useReadContract({
    address: lpTokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'totalSupply',
    args: lpTokenAddress ? [] : undefined,
  });

  // Get LP token allowance
  const { data: lpAllowance } = useReadContract({
    address: lpTokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && lpTokenAddress ? [address, DEX_CORE_ADDRESS as Address] : undefined,
  });

  // Get pool reserves
  const { data: reserves } = useReadContract({
    address: DEX_CORE_ADDRESS as Address,
    abi: DEX_CORE_ABI,
    functionName: 'getReserves',
    args: [tokenA.address as Address, tokenB.address as Address],
  });

  // Calculate amounts to receive when removing liquidity
  const removeAmounts = (() => {
    if (!lpBalance || !reserves || !lpTotalSupply || lpTotalSupply === 0n) {
      return { amountA: '0', amountB: '0', lpAmount: '0' };
    }

    const lpToRemove = (lpBalance * BigInt(removePercentage)) / 100n;
    const amountA = (lpToRemove * (reserves[0] as bigint)) / lpTotalSupply;
    const amountB = (lpToRemove * (reserves[1] as bigint)) / lpTotalSupply;

    return {
      amountA: formatUnits(amountA, tokenA.decimals),
      amountB: formatUnits(amountB, tokenB.decimals),
      lpAmount: formatUnits(lpToRemove, 18),
    };
  })();

  // Calculate price impact of removing liquidity
  const priceImpact = (() => {
    if (!lpBalance || !reserves || !lpTotalSupply || lpTotalSupply === 0n) return 0;
    
    try {
      const lpToRemove = (lpBalance * BigInt(removePercentage)) / 100n;
      const shareRemoved = (Number(lpToRemove) / Number(lpTotalSupply)) * 100;
      
      // Price impact is proportional to share being removed
      // Large removals (>10%) can impact price significantly
      if (shareRemoved > 10) {
        return shareRemoved * 0.5; // Approximate impact
      }
      return shareRemoved * 0.1;
    } catch {
      return 0;
    }
  })();

  const handleApproveLPToken = async () => {
    if (!lpBalance || removePercentage <= 0) {
      toast({ title: 'Error', description: 'Select amount to remove', variant: 'destructive' });
      return;
    }

    const lpToRemove = (lpBalance * BigInt(removePercentage)) / 100n;

    try {
      writeContract({
        address: lpTokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [DEX_CORE_ADDRESS as Address, lpToRemove],
      });
      toast({ title: 'Approval Pending', description: 'Approving LP tokens...' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to approve LP token', variant: 'destructive' });
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!lpBalance || removePercentage <= 0) {
      toast({ title: 'Error', description: 'Select amount to remove', variant: 'destructive' });
      return;
    }

    const lpToRemove = (lpBalance * BigInt(removePercentage)) / 100n;
    const slippage = parseFloat(slippageTolerance || '0.5');
    const slippageMultiplier = (100 - slippage) / 100;

    // Calculate minimum amounts with slippage
    const amountAExpected = (lpToRemove * (reserves?.[0] as bigint || 0n)) / (lpTotalSupply || 1n);
    const amountBExpected = (lpToRemove * (reserves?.[1] as bigint || 0n)) / (lpTotalSupply || 1n);
    const amountAMin = BigInt(Math.floor(Number(amountAExpected) * slippageMultiplier));
    const amountBMin = BigInt(Math.floor(Number(amountBExpected) * slippageMultiplier));
    const deadlineMinutes = parseInt(deadline || '20', 10);
    const deadlineSeconds = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);

    // Gasless transaction flow
    if (gaslessEnabled) {
      try {
        const result = await signAndRelayLiquidity({
          tokenA: tokenA.address as Address,
          tokenB: tokenB.address as Address,
          amountA: formatUnits(lpToRemove, 18),
          amountB: '0',
          amountAMin: amountAMin.toString(),
          amountBMin: amountBMin.toString(),
          deadline: deadlineSeconds,
          decimalsA: 18,
          decimalsB: tokenB.decimals,
          action: 'remove',
        });

        if (result.success) {
          toast({ 
            title: 'Gasless Liquidity Removed!', 
            description: 'Transaction relayed successfully',
          });
        }
      } catch (error) {
        toast({ title: 'Error', description: 'Gasless removal failed', variant: 'destructive' });
      }
      return;
    }

    // Regular transaction flow
    try {
      writeContract({
        address: DEX_CORE_ADDRESS as Address,
        abi: DEX_CORE_ABI,
        functionName: 'removeLiquidity',
        args: [
          tokenA.address as Address,
          tokenB.address as Address,
          lpToRemove,
          amountAMin,
          amountBMin,
          address as Address,
          BigInt(deadlineSeconds),
        ],
      });
      toast({ title: 'Transaction Pending', description: 'Removing liquidity...' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to remove liquidity', variant: 'destructive' });
    }
  };

  const needsLPApproval = lpAllowance !== undefined && lpBalance && 
    ((lpBalance * BigInt(removePercentage)) / 100n) > (lpAllowance as bigint);

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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-brand-gold/40 tracking-[0.3em] uppercase font-mono">Amount to Remove</span>
            <span className="text-4xl font-heading text-brand-platinum">{removePercentage}<span className="text-brand-gold">%</span></span>
          </div>
          <Slider
            value={[removePercentage]}
            onValueChange={(value) => setRemovePercentage(value[0])}
            max={100}
            step={1}
            className="w-full"
            aria-label="Percentage of liquidity to remove"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setRemovePercentage(Math.max(0, removePercentage - 5));
              if (e.key === 'ArrowRight') setRemovePercentage(Math.min(100, removePercentage + 5));
            }}
          />
          <div className="flex gap-2">
            {[25, 50, 75, 100].map((percent) => (
              <Button
                key={percent}
                variant="outline"
                size="sm"
                onClick={() => setRemovePercentage(percent)}
                className={`flex-1 ${removePercentage === percent ? 'bg-brand-gold text-brand-void font-bold' : 'bg-transparent border-brand-gold/20 text-brand-platinum'} transition-all`}
                aria-label={`Set removal percentage to ${percent}%`}
                tabIndex={0}
              >
                {percent}%
              </Button>
            ))}
          </div>
        </div>

        {/* Preview amounts to receive */}
        {lpBalance && lpBalance > 0n && (
          <div className="space-y-3 p-6 border border-brand-gold/10 rounded-lg bg-brand-gold/5">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-brand-gold/60" />
              <span className="text-[10px] text-brand-gold/40 tracking-[0.3em] uppercase font-mono">You Will Receive</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-brand-platinum/60">{tokenA.symbol}</span>
              <span className="text-brand-platinum font-medium font-mono">{parseFloat(removeAmounts.amountA).toFixed(6)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-brand-platinum/60">{tokenB.symbol}</span>
              <span className="text-brand-platinum font-medium font-mono">{parseFloat(removeAmounts.amountB).toFixed(6)}</span>
            </div>
            
            <div className="pt-2 border-t border-brand-gold/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-brand-platinum/60">LP Tokens to Burn</span>
                <span className="text-brand-platinum font-medium font-mono">{parseFloat(removeAmounts.lpAmount).toFixed(6)}</span>
              </div>
            </div>

            {priceImpact > 1 && (
              <div className="pt-2 border-t border-brand-gold/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <TrendingDown className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-brand-platinum/60">Price Impact</span>
                  </div>
                  <span className={`font-medium font-mono ${priceImpact > 5 ? 'text-red-400' : 'text-yellow-400'}`}>
                    ~{priceImpact.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reactor Bar Button */}
      {!address ? (
        <Button className="w-full py-6 border border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-brand-void uppercase tracking-[0.3em] transition-all font-heading text-sm" disabled>
          Connect Wallet
        </Button>
      ) : !lpBalance || lpBalance === 0n ? (
        <Button className="w-full py-6 border border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-brand-void uppercase tracking-[0.3em] transition-all font-heading text-sm" disabled>
          No Liquidity to Remove
        </Button>
      ) : needsLPApproval ? (
        <Button
          className="w-full py-6 border border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-brand-void uppercase tracking-[0.3em] transition-all font-heading text-sm"
          onClick={handleApproveLPToken}
          disabled={isPending || isConfirming}
          aria-label="Approve LP tokens for removal"
          tabIndex={0}
        >
          {isPending || isConfirming ? 'Approving...' : 'Approve LP Token'}
        </Button>
      ) : (
        <Button
          className="w-full py-6 border border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-brand-void uppercase tracking-[0.3em] transition-all font-heading text-sm"
          onClick={handleRemoveLiquidity}
          disabled={isPending || isConfirming || isRelaying || removePercentage <= 0}
          aria-label="Remove liquidity from pool"
          tabIndex={0}
        >
          {isPending || isConfirming || isRelaying ? (
            <span className="flex items-center gap-2">
              {gaslessEnabled ? 'Signing & Relaying...' : 'Removing Liquidity...'}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {gaslessEnabled && <Zap className="w-5 h-5" />}
              {gaslessEnabled ? 'Ghost Remove Liquidity' : 'Remove Liquidity'}
            </span>
          )}
        </Button>
      )}
    </div>
  );
}
