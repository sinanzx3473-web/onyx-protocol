import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Info, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePerps } from '@/hooks/usePerps';
import { createChart, ColorType, CandlestickData, Time, CandlestickSeries } from 'lightweight-charts';

export default function FuturesPage() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  // Use perps hook
  const { leverage, setLeverage, position, openPosition, closePosition } = usePerps();

  // Trading state
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [collateral, setCollateral] = useState('');
  const [positionSize, setPositionSize] = useState('');
  const [currentPrice, setCurrentPrice] = useState(3240.50);
  const [priceChange] = useState(2.34); // Percentage change

  // Calculate derived values
  const entryPrice = currentPrice;
  const liquidationPrice = side === 'long' 
    ? currentPrice * (1 - (1 / leverage) * 0.9)
    : currentPrice * (1 + (1 / leverage) * 0.9);

  // Initialize chart
  useEffect(() => {
    if (chartContainerRef.current && !chartRef.current) {
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#9CA3AF',
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });

      // Generate mock candlestick data
      const generateCandlestickData = (): CandlestickData[] => {
        const data: CandlestickData[] = [];
        let basePrice = 3200;
        const now = Math.floor(Date.now() / 1000);
        
        for (let i = 100; i >= 0; i--) {
          const time = (now - i * 300) as Time; // 5-minute candles
          const volatility = 20;
          
          const open = basePrice + (Math.random() - 0.5) * volatility;
          const close = open + (Math.random() - 0.5) * volatility;
          const high = Math.max(open, close) + Math.random() * volatility * 0.5;
          const low = Math.min(open, close) - Math.random() * volatility * 0.5;
          
          data.push({
            time,
            open,
            high,
            low,
            close,
          });
          
          basePrice = close;
        }
        
        // Update current price to last close
        setCurrentPrice(data[data.length - 1].close);
        
        return data;
      };

      const candlestickData = generateCandlestickData();
      candlestickSeries.setData(candlestickData);

      chartRef.current = chart;

      // Handle resize
      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      // Simulate live price updates
      const priceInterval = setInterval(() => {
        setCurrentPrice((prev) => {
          const change = (Math.random() - 0.5) * 5;
          return prev + change;
        });
      }, 2000);

      return () => {
        window.removeEventListener('resize', handleResize);
        clearInterval(priceInterval);
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      };
    }
  }, []);

  const handleOpenPosition = () => {
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to trade perpetuals.",
        variant: "destructive",
      });
      return;
    }

    if (!collateral || !positionSize) {
      toast({
        title: "Invalid Input",
        description: "Please enter collateral and position size.",
        variant: "destructive",
      });
      return;
    }

    const collateralAmount = parseFloat(collateral);
    openPosition(side, collateralAmount, leverage, currentPrice);
  };

  const handleClosePosition = () => {
    closePosition();
  };

  return (
    <div className="min-h-screen pt-24 pb-8">
      <div className="container mx-auto px-4">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-4xl font-heading font-bold bg-gradient-to-r from-brand-gold via-yellow-300 to-brand-gold bg-clip-text text-transparent mb-2">
            PERPETUAL FUTURES
          </h1>
          <p className="text-gray-400 text-sm">Trade with up to 100x leverage on crypto perpetuals</p>
        </motion.div>

        {/* Trading Terminal Grid */}
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
          {/* Chart Section - Left */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="col-span-8"
          >
            <Card className="glass-panel h-full flex flex-col">
              <CardContent className="p-4 flex-1 flex flex-col">
                {/* Chart Header */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold font-mono">ETH-PERP</h2>
                    <div className="flex items-center gap-2">
                      <span className={`text-3xl font-bold ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${currentPrice.toFixed(2)}
                      </span>
                      <span className={`text-sm font-mono ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {priceChange >= 0 ? '+' : ''}{priceChange}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="px-2 py-1 bg-white/5 rounded">24h Volume: $2.4B</span>
                    <span className="px-2 py-1 bg-white/5 rounded">Open Interest: $890M</span>
                  </div>
                </div>

                {/* Chart Container */}
                <div 
                  ref={chartContainerRef}
                  id="tv-chart" 
                  className="flex-1 bg-gradient-to-br from-black/40 to-brand-void/20 rounded-lg border border-white/5"
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Order Form - Right */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="col-span-4"
          >
            <Card className="glass-panel h-full flex flex-col">
              <CardContent className="p-4 flex-1 flex flex-col">
                {/* Active Position Banner */}
                {position && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mb-4 p-4 rounded-lg border-2 ${
                      position.side === 'long'
                        ? 'bg-green-500/10 border-green-500/50'
                        : 'bg-red-500/10 border-red-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-gray-400">ACTIVE POSITION</span>
                      <button
                        onClick={handleClosePosition}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`text-lg font-bold ${position.side === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                          {position.side.toUpperCase()} {position.size.toFixed(4)} ETH
                        </div>
                        <div className="text-xs text-gray-400 font-mono">
                          Entry: ${position.entryPrice.toFixed(2)} | {position.leverage}x
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold font-mono ${position.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {((position.pnl / position.collateral) * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Long/Short Tabs */}
                <div className="grid grid-cols-2 gap-2 mb-6">
                  <button
                    onClick={() => setSide('long')}
                    disabled={!!position}
                    className={`py-3 rounded-lg font-bold text-sm transition-all ${
                      side === 'long'
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/50'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <TrendingUp size={16} />
                      LONG
                    </div>
                  </button>
                  <button
                    onClick={() => setSide('short')}
                    disabled={!!position}
                    className={`py-3 rounded-lg font-bold text-sm transition-all ${
                      side === 'short'
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/50'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <TrendingDown size={16} />
                      SHORT
                    </div>
                  </button>
                </div>

                {/* Collateral Input */}
                <div className="mb-4">
                  <label className="block text-xs text-gray-400 mb-2 font-mono">COLLATERAL (USDC)</label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={collateral}
                      onChange={(e) => setCollateral(e.target.value)}
                      disabled={!!position}
                      className="bg-white/5 border-white/10 text-white font-mono text-lg pr-16 disabled:opacity-50"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-mono">
                      USDC
                    </span>
                  </div>
                </div>

                {/* Position Size Input */}
                <div className="mb-6">
                  <label className="block text-xs text-gray-400 mb-2 font-mono">POSITION SIZE (ETH)</label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={positionSize}
                      onChange={(e) => setPositionSize(e.target.value)}
                      disabled={!!position}
                      className="bg-white/5 border-white/10 text-white font-mono text-lg pr-16 disabled:opacity-50"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-mono">
                      ETH
                    </span>
                  </div>
                </div>

                {/* Leverage Slider */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs text-gray-400 font-mono">LEVERAGE</label>
                    <div className="text-right">
                      <div className={`text-3xl font-bold font-mono ${
                        side === 'long' ? 'text-green-400' : 'text-red-400'
                      } glow-text`}>
                        {leverage}x
                      </div>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={leverage}
                    onChange={(e) => setLeverage(parseInt(e.target.value))}
                    disabled={!!position}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: `linear-gradient(to right, ${
                        side === 'long' ? '#22c55e' : '#ef4444'
                      } 0%, ${
                        side === 'long' ? '#22c55e' : '#ef4444'
                      } ${leverage}%, rgba(255,255,255,0.1) ${leverage}%, rgba(255,255,255,0.1) 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1 font-mono">
                    <span>1x</span>
                    <span>25x</span>
                    <span>50x</span>
                    <span>75x</span>
                    <span>100x</span>
                  </div>
                </div>

                {/* Summary Box */}
                <div className="bg-white/5 rounded-lg p-4 mb-6 border border-white/10">
                  <div className="flex items-center gap-2 mb-3 text-xs text-gray-400">
                    <Info size={14} />
                    <span className="font-mono">POSITION SUMMARY</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400 font-mono">Entry Price</span>
                      <span className="text-white font-mono font-bold">${entryPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400 font-mono">Liquidation Price</span>
                      <span className="text-red-400 font-mono font-bold">${liquidationPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400 font-mono">Max Loss</span>
                      <span className="text-red-400 font-mono font-bold">
                        {collateral ? `$${collateral}` : '$0.00'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Open/Close Position Button */}
                {position ? (
                  <Button
                    onClick={handleClosePosition}
                    className={`w-full py-6 text-lg font-bold transition-all ${
                      position.pnl >= 0
                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/50'
                        : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/50'
                    }`}
                  >
                    CLOSE POSITION ({position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)})
                  </Button>
                ) : (
                  <Button
                    onClick={handleOpenPosition}
                    disabled={!isConnected || !collateral || !positionSize}
                    className={`w-full py-6 text-lg font-bold transition-all ${
                      side === 'long'
                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/50'
                        : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {!isConnected ? 'CONNECT WALLET' : `OPEN ${side.toUpperCase()}`}
                  </Button>
                )}

                {/* Risk Warning */}
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-xs text-yellow-400 font-mono">
                    ⚠️ High leverage trading carries significant risk. You can lose your entire collateral.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <style>{`
        .glow-text {
          text-shadow: 0 0 20px currentColor;
        }
        
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        }
        
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}
