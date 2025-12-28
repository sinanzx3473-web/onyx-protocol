import { useMemo } from 'react';
import { formatUnits } from 'viem';

interface EarningsData {
  '24h': string;
  '7d': string;
  '30d': string;
}

interface EarningsChartProps {
  earnings: EarningsData;
  className?: string;
}

export function EarningsChart({ earnings, className = '' }: EarningsChartProps) {
  const chartData = useMemo(() => {
    const data = [
      { period: '24h', value: parseFloat(formatUnits(BigInt(earnings['24h'] || '0'), 18)) },
      { period: '7d', value: parseFloat(formatUnits(BigInt(earnings['7d'] || '0'), 18)) },
      { period: '30d', value: parseFloat(formatUnits(BigInt(earnings['30d'] || '0'), 18)) }
    ];

    const maxValue = Math.max(...data.map(d => d.value), 0.01);

    return data.map(d => ({
      ...d,
      percentage: (d.value / maxValue) * 100
    }));
  }, [earnings]);

  const formatValue = (value: number) => {
    if (value === 0) return '0.00';
    if (value < 0.01) return '<0.01';
    return value.toFixed(4);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-lg font-semibold mb-4">Fee Earnings</h3>
        <div className="space-y-4">
          {chartData.map((item) => (
            <div key={item.period} className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-gray-700">{item.period}</span>
                <span className="font-semibold text-gray-900">
                  {formatValue(item.value)} ETH
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Last 24h</div>
          <div className="text-lg font-bold text-blue-600">
            {formatValue(chartData[0].value)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Last 7d</div>
          <div className="text-lg font-bold text-blue-600">
            {formatValue(chartData[1].value)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Last 30d</div>
          <div className="text-lg font-bold text-blue-600">
            {formatValue(chartData[2].value)}
          </div>
        </div>
      </div>
    </div>
  );
}
