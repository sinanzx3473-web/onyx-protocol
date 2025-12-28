import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Droplet, AlertCircle, RefreshCw } from 'lucide-react';
import PoolTable from '@/components/pools/PoolTable';
import SearchFilter from '@/components/pools/SearchFilter';

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

type SortField = 'tvl' | 'volume24h' | 'volume7d' | 'feeAPR' | 'symbol';
type SortDirection = 'asc' | 'desc';

export default function PoolsPage() {
  const { address } = useAccount();
  const [pools, setPools] = useState<PoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userLPBalances, setUserLPBalances] = useState<Record<string, bigint>>({});
  const [showMyPoolsOnly, setShowMyPoolsOnly] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    fetchPools();
  }, []);

  // Fetch user LP balances for all pools
  useEffect(() => {
    if (!address || pools.length === 0) return;

    const fetchUserBalances = async () => {
      const balances: Record<string, bigint> = {};
      for (const pool of pools) {
        try {
          const response = await fetch(
            `https://${import.meta.env.VITE_CHAIN || 'devnet'}.rpc.codenut.dev`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_call',
                params: [
                  {
                    to: pool.pairAddress,
                    data: `0x70a08231000000000000000000000000${address.slice(2)}`, // balanceOf(address)
                  },
                  'latest',
                ],
                id: 1,
              }),
            }
          );
          const data = await response.json();
          if (data.result) {
            balances[pool.pairAddress] = BigInt(data.result);
          }
        } catch (err) {
          console.error(`Failed to fetch balance for pool ${pool.pairAddress}:`, err);
        }
      }
      setUserLPBalances(balances);
    };

    fetchUserBalances();
  }, [address, pools]);

  const fetchPools = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/pools`);
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        throw new Error(`Failed to fetch pools: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setPools(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch pools');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pools');
      console.error('Error fetching pools:', err);
    } finally {
      setLoading(false);
    }
  };



  const myPoolsCount = useMemo(() => {
    return pools.filter(pool => {
      const userBalance = userLPBalances[pool.pairAddress] || BigInt(0);
      return userBalance > BigInt(0);
    }).length;
  }, [pools, userLPBalances]);

  const formatNumber = (value: string, decimals: number = 2): string => {
    const num = Number(value);
    if (num === 0) return '0.00';
    if (num < 0.01) return '<0.01';
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const totalTVL = pools.reduce((sum, pool) => sum + Number(pool.tvl), 0);
  const totalVolume24h = pools.reduce((sum, pool) => sum + Number(pool.volume24h), 0);
  const totalVolume7d = pools.reduce((sum, pool) => sum + Number(pool.volume7d), 0);

  const stats = [
    {
      title: 'Total Pools',
      value: pools.length.toString(),
      icon: Droplet,
      color: 'text-blue-400',
    },
    {
      title: 'Total Value Locked',
      value: `$${formatNumber(totalTVL.toString())}`,
      icon: TrendingUp,
      color: 'text-green-400',
    },
    {
      title: '24h Volume',
      value: `$${formatNumber(totalVolume24h.toString())}`,
      icon: BarChart3,
      color: 'text-purple-400',
    },
  ];



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Liquidity Pools</h1>
          <p className="text-gray-400">View and analyze all liquidity pools</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchPools}
          disabled={loading}
          className="bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white w-fit"
          aria-label="Refresh pools data"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-black/40 border-white/10 backdrop-blur-lg">
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full bg-white/10" />
              </CardContent>
            </Card>
          ))
        ) : (
          stats.map((stat) => (
            <Card key={stat.title} className="bg-black/40 border-white/10 backdrop-blur-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">{stat.title}</p>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                  </div>
                  <stat.icon className={`w-8 h-8 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="bg-red-500/10 border-red-500/50">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-400">
            {error}
            <Button
              variant="link"
              size="sm"
              className="ml-2 text-red-400 underline"
              onClick={fetchPools}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Filter */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
        <CardContent className="p-6">
          <SearchFilter
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            showMyPoolsOnly={showMyPoolsOnly}
            onToggleMyPools={() => setShowMyPoolsOnly(!showMyPoolsOnly)}
            myPoolsCount={myPoolsCount}
            totalPoolsCount={pools.length}
          />
        </CardContent>
      </Card>

      {/* Pools Table */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
        <CardContent className="p-6">
          <PoolTable
            pools={pools}
            loading={loading}
            searchTerm={searchTerm}
            userLPBalances={userLPBalances}
            showMyPoolsOnly={showMyPoolsOnly}
          />
        </CardContent>
      </Card>
    </div>
  );
}
