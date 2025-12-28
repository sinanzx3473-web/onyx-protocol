import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Zap, DollarSign, TrendingDown, Clock, Fuel, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RouteStep {
  protocol: string;
  tokenIn: string;
  tokenOut: string;
  poolAddress?: string;
  amountIn: string;
  amountOut: string;
  fee: string;
}

interface Route {
  type: 'direct' | 'multi-hop' | 'external';
  steps: RouteStep[];
  totalAmountOut: string;
  totalGasEstimate: string;
  executionTime: number;
  priceImpact: number;
  route: string;
}

interface RouteOptimizerProps {
  tokenIn: { address: string; symbol: string; decimals: number };
  tokenOut: { address: string; symbol: string; decimals: number };
  amountIn: string;
  chainId: number;
  slippage: number;
  onRouteSelect: (route: Route) => void;
  selectedRoute: Route | null;
}

type RoutePreference = 'best-price' | 'fastest' | 'cheapest';

export function RouteOptimizer({
  tokenIn,
  tokenOut,
  amountIn,
  chainId,
  slippage,
  onRouteSelect,
  selectedRoute,
}: RouteOptimizerProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [bestRoute, setBestRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteExpiry, setQuoteExpiry] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [preference, setPreference] = useState<RoutePreference>('best-price');
  const [showAlternatives, setShowAlternatives] = useState(false);

  // Fetch routes from backend
  useEffect(() => {
    if (!amountIn || parseFloat(amountIn) <= 0) {
      setRoutes([]);
      setBestRoute(null);
      setQuoteExpiry(null);
      return;
    }

    const fetchRoutes = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            amountIn: (BigInt(parseFloat(amountIn) * 10 ** tokenIn.decimals)).toString(),
            chainId,
            slippage,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch routes');
        }

        const data = await response.json();
        
        if (data.success) {
          const allRoutes = [data.data.bestRoute, ...data.data.alternativeRoutes];
          setRoutes(allRoutes);
          setBestRoute(data.data.bestRoute);
          setQuoteExpiry(data.data.quoteExpiry);
          onRouteSelect(data.data.bestRoute);
        } else {
          throw new Error(data.message || 'Failed to fetch routes');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setRoutes([]);
        setBestRoute(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRoutes();
  }, [tokenIn.address, tokenOut.address, amountIn, chainId, slippage, tokenIn.decimals]);

  // Countdown timer for quote expiry
  useEffect(() => {
    if (!quoteExpiry) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((quoteExpiry - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setError('Quote expired. Refreshing...');
        setQuoteExpiry(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [quoteExpiry]);

  // Sort routes based on preference
  const sortedRoutes = useMemo(() => {
    if (routes.length === 0) return [];

    const sorted = [...routes];

    switch (preference) {
      case 'best-price':
        sorted.sort((a, b) => {
          const aOut = BigInt(a.totalAmountOut);
          const bOut = BigInt(b.totalAmountOut);
          return aOut > bOut ? -1 : aOut < bOut ? 1 : 0;
        });
        break;
      case 'fastest':
        sorted.sort((a, b) => a.executionTime - b.executionTime);
        break;
      case 'cheapest':
        sorted.sort((a, b) => {
          const aGas = BigInt(a.totalGasEstimate);
          const bGas = BigInt(b.totalGasEstimate);
          return aGas < bGas ? -1 : aGas > bGas ? 1 : 0;
        });
        break;
    }

    return sorted;
  }, [routes, preference]);

  const recommendedRoute = sortedRoutes[0] || null;

  const formatAmount = (amount: string, decimals: number) => {
    return (Number(amount) / 10 ** decimals).toFixed(6);
  };

  const formatGas = (gas: string) => {
    return (Number(gas) / 1000).toFixed(0) + 'k';
  };

  const formatTime = (ms: number) => {
    return (ms / 1000).toFixed(0) + 's';
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-blue-300">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">Finding best route...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-300">
            <Info className="w-5 h-5" />
            <span className="font-medium">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!recommendedRoute) return null;

  return (
    <div className="space-y-3">
      {/* Route Preference Selector */}
      <div className="flex gap-2">
        <Button
          variant={preference === 'best-price' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => {
            setPreference('best-price');
            if (sortedRoutes[0]) onRouteSelect(sortedRoutes[0]);
          }}
          className={cn(
            'flex-1 transition-all',
            preference === 'best-price'
              ? 'bg-purple-500 text-white hover:bg-purple-600'
              : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
          )}
        >
          <TrendingDown className="w-4 h-4 mr-1" />
          Best Price
        </Button>
        <Button
          variant={preference === 'fastest' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => {
            setPreference('fastest');
            if (sortedRoutes[0]) onRouteSelect(sortedRoutes[0]);
          }}
          className={cn(
            'flex-1 transition-all',
            preference === 'fastest'
              ? 'bg-purple-500 text-white hover:bg-purple-600'
              : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
          )}
        >
          <Zap className="w-4 h-4 mr-1" />
          Fastest
        </Button>
        <Button
          variant={preference === 'cheapest' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => {
            setPreference('cheapest');
            if (sortedRoutes[0]) onRouteSelect(sortedRoutes[0]);
          }}
          className={cn(
            'flex-1 transition-all',
            preference === 'cheapest'
              ? 'bg-purple-500 text-white hover:bg-purple-600'
              : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
          )}
        >
          <DollarSign className="w-4 h-4 mr-1" />
          Cheapest
        </Button>
      </div>

      {/* Recommended Route Card */}
      <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                Recommended
              </Badge>
              <CardTitle className="text-lg text-white">
                {formatAmount(recommendedRoute.totalAmountOut, tokenOut.decimals)} {tokenOut.symbol}
              </CardTitle>
            </div>
            {quoteExpiry && (
              <div className="flex items-center gap-1.5 text-sm text-green-300">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{timeRemaining}s</span>
              </div>
            )}
          </div>
          <CardDescription className="text-green-300/80">
            {recommendedRoute.route}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Route Visualization */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {recommendedRoute.steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2 flex-shrink-0">
                <div className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-xs text-gray-400">{step.protocol}</div>
                  <div className="text-sm font-medium text-white">
                    {formatAmount(step.amountOut, tokenOut.decimals)}
                  </div>
                </div>
                {idx < recommendedRoute.steps.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-green-400" />
                )}
              </div>
            ))}
          </div>

          {/* Route Stats */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-green-500/20">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-green-300/70 mb-1">
                <Fuel className="w-3 h-3" />
                Gas
              </div>
              <div className="text-sm font-semibold text-white">
                {formatGas(recommendedRoute.totalGasEstimate)}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-green-300/70 mb-1">
                <Clock className="w-3 h-3" />
                Time
              </div>
              <div className="text-sm font-semibold text-white">
                ~{formatTime(recommendedRoute.executionTime)}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-green-300/70 mb-1">
                <TrendingDown className="w-3 h-3" />
                Impact
              </div>
              <div className="text-sm font-semibold text-white">
                {recommendedRoute.priceImpact.toFixed(2)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alternative Routes Toggle */}
      {sortedRoutes.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAlternatives(!showAlternatives)}
          className="w-full text-gray-400 hover:text-white hover:bg-white/5"
        >
          {showAlternatives ? (
            <>
              <ChevronUp className="w-4 h-4 mr-2" />
              Hide {sortedRoutes.length - 1} alternative route{sortedRoutes.length > 2 ? 's' : ''}
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-2" />
              Show {sortedRoutes.length - 1} alternative route{sortedRoutes.length > 2 ? 's' : ''}
            </>
          )}
        </Button>
      )}

      {/* Alternative Routes */}
      {showAlternatives && sortedRoutes.slice(1).map((route, idx) => (
        <Card
          key={idx}
          className={cn(
            'cursor-pointer transition-all',
            selectedRoute === route
              ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30'
              : 'bg-white/5 border-white/10 hover:border-white/20'
          )}
          onClick={() => onRouteSelect(route)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-bold text-white">
                {formatAmount(route.totalAmountOut, tokenOut.decimals)} {tokenOut.symbol}
              </div>
              <Badge variant="outline" className="text-xs border-white/20 text-gray-400">
                {route.type}
              </Badge>
            </div>
            <div className="text-sm text-gray-400 mb-3">{route.route}</div>
            <div className="flex gap-4 text-xs text-gray-400">
              <span>Gas: {formatGas(route.totalGasEstimate)}</span>
              <span>Time: ~{formatTime(route.executionTime)}</span>
              <span>Impact: {route.priceImpact.toFixed(2)}%</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
