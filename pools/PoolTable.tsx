import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown, Star, ChevronDown, ChevronUp, Plus, Minus } from 'lucide-react';
import PoolRowExpand from './PoolRowExpand';

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

type SortField = 'tvl' | 'volume24h' | 'volume7d' | 'feeAPR' | 'symbol' | 'lpCount';
type SortDirection = 'asc' | 'desc';

interface PoolTableProps {
  pools: PoolData[];
  loading: boolean;
  searchTerm: string;
  userLPBalances: Record<string, bigint>;
  showMyPoolsOnly: boolean;
}

export default function PoolTable({ 
  pools, 
  loading, 
  searchTerm, 
  userLPBalances,
  showMyPoolsOnly 
}: PoolTableProps) {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('tvl');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatNumber = (value: string, decimals: number = 2): string => {
    const num = Number(value);
    if (num === 0) return '0.00';
    if (num < 0.01) return '<0.01';
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const filteredAndSortedPools = pools
    .filter(pool => {
      // Filter by search term
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          pool.token0.symbol.toLowerCase().includes(search) ||
          pool.token1.symbol.toLowerCase().includes(search) ||
          pool.token0.name.toLowerCase().includes(search) ||
          pool.token1.name.toLowerCase().includes(search) ||
          pool.pairAddress.toLowerCase().includes(search);
        
        if (!matchesSearch) return false;
      }

      // Filter by My Pools toggle
      if (showMyPoolsOnly) {
        const userBalance = userLPBalances[pool.pairAddress] || BigInt(0);
        return userBalance > BigInt(0);
      }

      return true;
    })
    .sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortField) {
        case 'tvl':
          aValue = Number(a.tvl);
          bValue = Number(b.tvl);
          break;
        case 'volume24h':
          aValue = Number(a.volume24h);
          bValue = Number(b.volume24h);
          break;
        case 'volume7d':
          aValue = Number(a.volume7d);
          bValue = Number(b.volume7d);
          break;
        case 'feeAPR':
          aValue = parseFloat(a.feeAPR);
          bValue = parseFloat(b.feeAPR);
          break;
        case 'lpCount':
          aValue = a.lpCount;
          bValue = b.lpCount;
          break;
        case 'symbol':
          return sortDirection === 'asc'
            ? a.token0.symbol.localeCompare(b.token0.symbol)
            : b.token0.symbol.localeCompare(a.token0.symbol);
        default:
          return 0;
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 text-gray-400 hover:text-white -ml-2"
      onClick={() => handleSort(field)}
      aria-label={`Sort by ${children}`}
    >
      {children}
      <ArrowUpDown 
        className={`ml-2 h-4 w-4 ${sortField === field ? 'text-purple-400' : ''}`} 
        aria-hidden="true"
      />
    </Button>
  );

  const toggleExpand = (poolId: string) => {
    setExpandedPoolId(expandedPoolId === poolId ? null : poolId);
  };

  const handleAddLiquidity = (pool: PoolData) => {
    navigate('/liquidity', { 
      state: { 
        token0: pool.token0.address, 
        token1: pool.token1.address 
      } 
    });
  };

  const handleRemoveLiquidity = (pool: PoolData) => {
    navigate('/liquidity', { 
      state: { 
        token0: pool.token0.address, 
        token1: pool.token1.address,
        tab: 'remove'
      } 
    });
  };

  if (loading) {
    return (
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-white/5">
            <TableHead className="text-gray-400 w-8"></TableHead>
            <TableHead className="text-gray-400">Pool</TableHead>
            <TableHead className="text-gray-400">TVL</TableHead>
            <TableHead className="text-gray-400">Volume 24h</TableHead>
            <TableHead className="text-gray-400">Volume 7d</TableHead>
            <TableHead className="text-gray-400">Fee APR</TableHead>
            <TableHead className="text-gray-400"># LPs</TableHead>
            <TableHead className="text-gray-400">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i} className="border-white/10">
              <TableCell colSpan={8}>
                <Skeleton className="h-12 w-full bg-white/10" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (filteredAndSortedPools.length === 0) {
    return (
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-white/5">
            <TableHead className="text-gray-400 w-8"></TableHead>
            <TableHead className="text-gray-400">
              <SortButton field="symbol">Pool</SortButton>
            </TableHead>
            <TableHead className="text-gray-400">
              <SortButton field="tvl">TVL</SortButton>
            </TableHead>
            <TableHead className="text-gray-400">
              <SortButton field="volume24h">Volume 24h</SortButton>
            </TableHead>
            <TableHead className="text-gray-400">
              <SortButton field="volume7d">Volume 7d</SortButton>
            </TableHead>
            <TableHead className="text-gray-400">
              <SortButton field="feeAPR">Fee APR</SortButton>
            </TableHead>
            <TableHead className="text-gray-400">
              <SortButton field="lpCount"># LPs</SortButton>
            </TableHead>
            <TableHead className="text-gray-400">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="border-white/10">
            <TableCell colSpan={8} className="text-center text-gray-400 py-12">
              {showMyPoolsOnly 
                ? 'You have no liquidity positions. Add liquidity to get started.' 
                : searchTerm 
                ? 'No pools match your search.' 
                : 'No pools available. Create a pool by adding liquidity.'}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-white/10 hover:bg-white/5">
          <TableHead className="text-gray-400 w-8" aria-label="Expand row"></TableHead>
          <TableHead className="text-gray-400">
            <SortButton field="symbol">Pool</SortButton>
          </TableHead>
          <TableHead className="text-gray-400">
            <SortButton field="tvl">TVL</SortButton>
          </TableHead>
          <TableHead className="text-gray-400">
            <SortButton field="volume24h">Volume 24h</SortButton>
          </TableHead>
          <TableHead className="text-gray-400">
            <SortButton field="volume7d">Volume 7d</SortButton>
          </TableHead>
          <TableHead className="text-gray-400">
            <SortButton field="feeAPR">Fee APR</SortButton>
          </TableHead>
          <TableHead className="text-gray-400">
            <SortButton field="lpCount"># LPs</SortButton>
          </TableHead>
          <TableHead className="text-gray-400">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredAndSortedPools.map((pool) => {
          const userBalance = userLPBalances[pool.pairAddress] || BigInt(0);
          const hasPosition = userBalance > BigInt(0);
          const isExpanded = expandedPoolId === pool.id;
          
          return (
            <>
              <TableRow 
                key={pool.id} 
                className={`border-white/10 hover:bg-white/5 cursor-pointer ${
                  hasPosition ? 'bg-purple-500/5 border-l-4 border-l-purple-500' : ''
                }`}
                onClick={() => toggleExpand(pool.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleExpand(pool.id);
                  }
                }}
                aria-expanded={isExpanded}
                aria-label={`${pool.token0.symbol}/${pool.token1.symbol} pool details`}
              >
                <TableCell className="w-8">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  )}
                </TableCell>
                <TableCell className="font-medium text-white">
                  <div className="flex items-center gap-2">
                    {hasPosition && (
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" aria-label="Your position" />
                    )}
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" aria-hidden="true" />
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500" aria-hidden="true" />
                    </div>
                    <div>
                      <div>{pool.token0.symbol} / {pool.token1.symbol}</div>
                      {hasPosition && (
                        <div className="text-xs text-purple-400">Your Position</div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-white">
                  ${formatNumber(pool.tvl)}
                </TableCell>
                <TableCell className="text-white">
                  ${formatNumber(pool.volume24h)}
                </TableCell>
                <TableCell className="text-white">
                  ${formatNumber(pool.volume7d)}
                </TableCell>
                <TableCell>
                  <Badge 
                    className={`${
                      parseFloat(pool.feeAPR) > 10 
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : parseFloat(pool.feeAPR) > 5
                        ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                        : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                    }`}
                  >
                    {pool.feeAPR}%
                  </Badge>
                </TableCell>
                <TableCell className="text-white">
                  {pool.lpCount}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300"
                      onClick={() => handleAddLiquidity(pool)}
                      aria-label={`Add liquidity to ${pool.token0.symbol}/${pool.token1.symbol}`}
                    >
                      <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                      Add
                    </Button>
                    {hasPosition && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                        onClick={() => handleRemoveLiquidity(pool)}
                        aria-label={`Remove liquidity from ${pool.token0.symbol}/${pool.token1.symbol}`}
                      >
                        <Minus className="h-4 w-4 mr-1" aria-hidden="true" />
                        Remove
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow className="border-white/10">
                  <TableCell colSpan={8} className="p-0">
                    <PoolRowExpand pool={pool} />
                  </TableCell>
                </TableRow>
              )}
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}
