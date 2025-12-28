import { useState, useMemo } from 'react';
import { formatUnits } from 'viem';

interface Trade {
  hash: string;
  type: 'swap' | 'add_liquidity' | 'remove_liquidity';
  timestamp: number;
  pool: {
    token0: string;
    token1: string;
  };
  amount0In?: string;
  amount1In?: string;
  amount0Out?: string;
  amount1Out?: string;
  amount0?: string;
  amount1?: string;
  liquidity?: string;
}

interface TradesTableProps {
  trades: Trade[];
  className?: string;
}

export function TradesTable({ trades, className = '' }: TradesTableProps) {
  const [filter, setFilter] = useState<'all' | 'swap' | 'add_liquidity' | 'remove_liquidity'>('all');

  const filteredTrades = useMemo(() => {
    if (filter === 'all') return trades;
    return trades.filter(trade => trade.type === filter);
  }, [trades, filter]);

  const exportToCSV = () => {
    const headers = ['Hash', 'Type', 'Date', 'Token0', 'Token1', 'Amount0', 'Amount1'];
    const rows = filteredTrades.map(trade => {
      const date = new Date(trade.timestamp).toISOString();
      const amount0 = trade.amount0In || trade.amount0Out || trade.amount0 || '0';
      const amount1 = trade.amount1In || trade.amount1Out || trade.amount1 || '0';
      
      return [
        trade.hash,
        trade.type,
        date,
        trade.pool.token0,
        trade.pool.token1,
        formatUnits(BigInt(amount0), 18),
        formatUnits(BigInt(amount1), 18)
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'swap':
        return 'Swap';
      case 'add_liquidity':
        return 'Add LP';
      case 'remove_liquidity':
        return 'Remove LP';
      default:
        return type;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'swap':
        return 'bg-blue-100 text-blue-800';
      case 'add_liquidity':
        return 'bg-green-100 text-green-800';
      case 'remove_liquidity':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Trade History</h3>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Download CSV
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('swap')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filter === 'swap'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Swaps
        </button>
        <button
          onClick={() => setFilter('add_liquidity')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filter === 'add_liquidity'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Add Liquidity
        </button>
        <button
          onClick={() => setFilter('remove_liquidity')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filter === 'remove_liquidity'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Remove Liquidity
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pool
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Transaction
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTrades.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No trades found
                </td>
              </tr>
            ) : (
              filteredTrades.map((trade) => (
                <tr key={trade.hash} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getTypeBadgeColor(
                        trade.type
                      )}`}
                    >
                      {getTypeLabel(trade.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {trade.pool.token0.slice(0, 6)}.../{trade.pool.token1.slice(0, 6)}...
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(trade.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <a
                      href={`https://etherscan.io/tx/${trade.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {trade.hash.slice(0, 10)}...{trade.hash.slice(-8)}
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredTrades.length > 0 && (
        <div className="text-sm text-gray-500 text-center">
          Showing {filteredTrades.length} {filteredTrades.length === 1 ? 'trade' : 'trades'}
        </div>
      )}
    </div>
  );
}
