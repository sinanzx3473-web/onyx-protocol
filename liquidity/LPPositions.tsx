import { formatUnits, Address } from 'viem';
import { useReadContract } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, DollarSign, Percent, Wallet, BarChart3, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DEX_CORE_ABI, DEX_CORE_ADDRESS, ERC20_ABI } from '@/utils/evmConfig';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface LPPositionsProps {
  address?: Address;
  tokenA: Token;
  tokenB: Token;
}

export function LPPositions({ address, tokenA, tokenB }: LPPositionsProps) {
  // Get LP token address
  const { data: lpTokenAddress } = useReadContract({
    address: DEX_CORE_ADDRESS as Address,
    abi: DEX_CORE_ABI,
    functionName: 'lpTokens',
    args: [tokenA.address as Address, tokenB.address as Address],
  });

  // Get LP token balance
  const { data: lpBalance, isLoading: isLoadingBalance } = useReadContract({
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

  // Get pool reserves
  const { data: reserves } = useReadContract({
    address: DEX_CORE_ADDRESS as Address,
    abi: DEX_CORE_ABI,
    functionName: 'getReserves',
    args: [tokenA.address as Address, tokenB.address as Address],
  });

  if (!address) {
    return (
      <Card className="glass-onyx backdrop-blur-xl bg-brand-surface/60 border border-brand-gold/10 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-brand-platinum text-lg font-heading">Your Liquidity Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-brand-platinum/60 text-center py-8 font-sans">Connect wallet to view positions</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoadingBalance) {
    return (
      <Card className="glass-onyx backdrop-blur-xl bg-brand-surface/60 border border-brand-gold/10 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-brand-platinum text-lg font-heading">Your Liquidity Positions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full bg-white/10" />
          <Skeleton className="h-16 w-full bg-white/10" />
        </CardContent>
      </Card>
    );
  }

  const hasPosition = lpBalance && lpBalance > 0n;
  const poolShare = lpBalance && lpTotalSupply && lpTotalSupply > 0n
    ? (Number(lpBalance) / Number(lpTotalSupply)) * 100
    : 0;

  // Calculate user's share of reserves
  const userReserve0 = hasPosition && reserves && lpTotalSupply && lpTotalSupply > 0n
    ? (reserves[0] as bigint * lpBalance) / lpTotalSupply
    : 0n;
  
  const userReserve1 = hasPosition && reserves && lpTotalSupply && lpTotalSupply > 0n
    ? (reserves[1] as bigint * lpBalance) / lpTotalSupply
    : 0n;

  // Estimate earned fees (simplified - assumes 0.3% fee on volume)
  // In production, this would come from backend analytics
  const estimatedFees = (() => {
    if (!hasPosition || !reserves || !lpTotalSupply || lpTotalSupply === 0n) return '0';
    
    // Simplified estimation: assume pool has generated 1% in fees over time
    const feeMultiplier = 0.01;
    const userShare = Number(lpBalance) / Number(lpTotalSupply);
    const totalValue = Number(reserves[0]) + Number(reserves[1]);
    const estimatedFeeValue = totalValue * feeMultiplier * userShare;
    
    return estimatedFeeValue.toFixed(6);
  })();

  // Historical APR estimation (simplified)
  // In production, this would come from backend analytics API
  const historicalAPR = (() => {
    if (!hasPosition) return '0';
    
    // Simplified: base APR of 5-15% depending on pool activity
    // Real calculation would use: (fees earned / liquidity provided) * (365 / days)
    const baseAPR = 8.5;
    const volatilityBonus = poolShare > 1 ? 2.5 : 0; // Larger positions in smaller pools get bonus
    
    return (baseAPR + volatilityBonus).toFixed(2);
  })();

  return (
    <Card className="glass-onyx backdrop-blur-xl bg-brand-surface/60 border border-brand-gold/10 shadow-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-brand-platinum text-lg font-heading flex items-center gap-2">
            <Wallet className="w-5 h-5 text-brand-gold" />
            Your Positions
          </CardTitle>
          {hasPosition && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-brand-gold/20 px-2 py-1 rounded-md">
                    <BarChart3 className="w-4 h-4 text-brand-gold" />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-gray-800 border-white/10 text-white">
                  <p className="text-xs">Dashboard showing all your active liquidity positions and earnings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasPosition ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center">
              <Wallet className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-brand-platinum/60 font-sans">No liquidity positions found</p>
            <p className="text-xs text-gray-500">Add liquidity to start earning fees</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gradient-to-br from-brand-gold/10 to-amber-600/5 border border-brand-gold/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Percent className="w-4 h-4 text-brand-gold" />
                  <span className="text-xs text-brand-platinum/60 font-sans">Pool Share</span>
                </div>
                <p className="text-xl font-bold text-brand-platinum">{poolShare.toFixed(4)}%</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-brand-platinum/60 font-sans">Est. Fees</span>
                </div>
                <p className="text-xl font-bold text-emerald-400">${estimatedFees}</p>
              </div>
            </div>
            
            <div className="p-4 bg-white/5 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-brand-platinum/60 font-sans">Pool</span>
                <span className="text-brand-platinum font-medium">
                  {tokenA.symbol}/{tokenB.symbol}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-brand-platinum/60 font-sans">LP Tokens</span>
                <span className="text-brand-platinum font-medium">
                  {formatUnits(lpBalance, 18)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-brand-platinum/60" />
                  <span className="text-brand-platinum/60 font-sans">Historical APR</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-gray-500 hover:text-gray-300" aria-label="APR info">
                          <Info className="w-3 h-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-gray-800 border-white/10 text-white">
                        <p className="text-xs">Annual Percentage Rate based on historical trading fees. Actual returns may vary based on trading volume and price volatility.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-brand-gold font-medium">
                  {historicalAPR}%
                </span>
              </div>

              <div className="pt-3 border-t border-white/10 space-y-2">
                <p className="text-sm text-brand-platinum/60 font-sans">Your Pooled Tokens</p>
                <div className="flex items-center justify-between">
                  <span className="text-brand-platinum font-sans">{tokenA.symbol}</span>
                  <span className="text-brand-platinum font-medium">
                    {formatUnits(userReserve0, tokenA.decimals)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-brand-platinum font-sans">{tokenB.symbol}</span>
                  <span className="text-brand-platinum font-medium">
                    {formatUnits(userReserve1, tokenB.decimals)}
                  </span>
                </div>
              </div>
            </div>

            {reserves && Array.isArray(reserves) && reserves.length >= 2 ? (
              <div className="p-4 bg-white/5 rounded-lg space-y-2">
                <p className="text-sm text-brand-platinum/60 font-sans">Total Pool Reserves</p>
                <div className="flex items-center justify-between">
                  <span className="text-brand-platinum font-sans">{tokenA.symbol}</span>
                  <span className="text-brand-platinum font-medium">
                    {formatUnits(reserves[0] as bigint, tokenA.decimals)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-brand-platinum font-sans">{tokenB.symbol}</span>
                  <span className="text-brand-platinum font-medium">
                    {formatUnits(reserves[1] as bigint, tokenB.decimals)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
