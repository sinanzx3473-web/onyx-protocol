import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity, Users, Clock, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface PoolData {
  id: string;
  pairAddress: string;
  token0: {
    address: string;
    symbol: string;
    name: string;
  };
  token1: {
    address: string;
    symbol: string;
    name: string;
  };
  reserves: {
    token0: string;
    token1: string;
  };
  totalSupply: string;
  tvl: string;
  volume24h: string;
  volume7d: string;
  fees24h: string;
  fees7d: string;
  totalFees: string;
  feeAPR: string;
  swapCount: number;
  lpCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PoolDetailsData {
  pool: {
    id: string;
    pairAddress: string;
    token0: {
      address: string;
      symbol: string;
      name: string;
    };
    token1: {
      address: string;
      symbol: string;
      name: string;
    };
    reserves: {
      token0: string;
      token1: string;
    };
    totalSupply: string;
    tvl: string;
  };
  stats24h: {
    volume: string;
    fees: string;
    swapCount: number;
  };
  recentSwaps: Array<{
    txHash: string;
    sender: string;
    recipient: string;
    amount0In: string;
    amount1In: string;
    amount0Out: string;
    amount1Out: string;
    timestamp: string;
    blockNumber: string;
  }>;
  topLPs: Array<{
    userAddress: string;
    lpTokenBalance: string;
    share: string;
    updatedAt: string;
  }>;
}

interface PoolRowExpandProps {
  pool: PoolData;
}

export default function PoolRowExpand({ pool }: PoolRowExpandProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<PoolDetailsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    fetchPoolDetails();
  }, [pool.id]);

  const fetchPoolDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `${API_BASE_URL}/api/pools/${pool.token0.address}/${pool.token1.address}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch pool details');
      }

      const data = await response.json();
      if (data.success) {
        setDetails(data.data);
      } else {
        throw new Error(data.message || 'Failed to fetch pool details');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pool details');
      console.error('Error fetching pool details:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value: string, decimals: number = 2): string => {
    const num = Number(value);
    if (num === 0) return '0.00';
    if (num < 0.01) return '<0.01';
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
  };

  const openExplorer = (txHash: string) => {
    const chain = import.meta.env.VITE_CHAIN || 'devnet';
    const explorerUrl = `https://${chain}.explorer.codenut.dev/tx/${txHash}`;
    window.open(explorerUrl, '_blank');
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="bg-black/20 p-6 space-y-4">
        <Skeleton className="h-32 w-full bg-white/10" />
        <Skeleton className="h-48 w-full bg-white/10" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="bg-black/20 p-6 text-center text-red-400">
        {error || 'Failed to load pool details'}
      </div>
    );
  }

  const volumeChange = Number(pool.volume24h) > 0 
    ? ((Number(pool.volume24h) / (Number(pool.volume7d) / 7)) - 1) * 100 
    : 0;

  return (
    <div className="bg-black/20 p-6 space-y-6 animate-in slide-in-from-top-2 duration-200">
      {/* Pool Info Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">
            {pool.token0.symbol} / {pool.token1.symbol} Pool Details
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Contract:</span>
            <code className="bg-white/5 px-2 py-1 rounded text-xs">
              {formatAddress(pool.pairAddress)}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-400 hover:text-white"
              onClick={() => copyToClipboard(pool.pairAddress, 'Contract address')}
              aria-label="Copy contract address"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <Badge variant="outline" className="text-gray-400 border-gray-600">
          Created {new Date(pool.createdAt).toLocaleDateString()}
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">24h Volume</span>
              <Activity className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-white">
              ${formatNumber(details.stats24h.volume)}
            </div>
            <div className={`text-xs flex items-center gap-1 mt-1 ${
              volumeChange >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {volumeChange >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(volumeChange).toFixed(2)}% vs 7d avg
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">24h Fees</span>
              <TrendingUp className="h-4 w-4 text-green-400" />
            </div>
            <div className="text-xl font-bold text-white">
              ${formatNumber(details.stats24h.fees)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Total: ${formatNumber(pool.totalFees)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">24h Swaps</span>
              <Activity className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-white">
              {details.stats24h.swapCount}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Total: {pool.swapCount} swaps
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Liquidity Providers</span>
              <Users className="h-4 w-4 text-yellow-400" />
            </div>
            <div className="text-xl font-bold text-white">
              {pool.lpCount}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Active positions
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Swaps */}
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              Recent Swaps
            </h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {details.recentSwaps.length > 0 ? (
                details.recentSwaps.map((swap, idx) => {
                  const isToken0In = Number(swap.amount0In) > 0;
                  const amountIn = isToken0In ? swap.amount0In : swap.amount1In;
                  const amountOut = isToken0In ? swap.amount1Out : swap.amount0Out;
                  const tokenIn = isToken0In ? pool.token0.symbol : pool.token1.symbol;
                  const tokenOut = isToken0In ? pool.token1.symbol : pool.token0.symbol;

                  return (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="text-sm text-white mb-1">
                          {formatNumber(amountIn, 4)} {tokenIn} → {formatNumber(amountOut, 4)} {tokenOut}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatTimeAgo(swap.timestamp)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                        onClick={() => openExplorer(swap.txHash)}
                        aria-label="View transaction"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-gray-400 py-8">
                  No recent swaps
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top LPs */}
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              Top Liquidity Providers
            </h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {details.topLPs.length > 0 ? (
                details.topLPs.map((lp, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="text-sm text-white font-mono">
                          {formatAddress(lp.userAddress)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {parseFloat(lp.share).toFixed(2)}% of pool
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                      onClick={() => copyToClipboard(lp.userAddress, 'LP address')}
                      aria-label="Copy LP address"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-8">
                  No liquidity providers yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pool Reserves */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-4">
          <h4 className="text-sm font-semibold text-white mb-4">Pool Reserves</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">{pool.token0.symbol}</div>
              <div className="text-xl font-bold text-white">
                {formatNumber(details.pool.reserves.token0, 4)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {pool.token0.name}
              </div>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">{pool.token1.symbol}</div>
              <div className="text-xl font-bold text-white">
                {formatNumber(details.pool.reserves.token1, 4)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {pool.token1.name}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
