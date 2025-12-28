import { useState, useEffect, useRef } from 'react';
import { useToast } from './use-toast';

interface Position {
  side: 'long' | 'short';
  size: number;
  collateral: number;
  leverage: number;
  entryPrice: number;
  liqPrice: number;
  pnl: number;
  currentPrice: number;
}

export function usePerps() {
  const { toast } = useToast();
  const [leverage, setLeverage] = useState(10);
  const [position, setPosition] = useState<Position | null>(null);
  const pnlIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Simulate live PnL updates
  useEffect(() => {
    if (position) {
      pnlIntervalRef.current = setInterval(() => {
        setPosition((prev) => {
          if (!prev) return null;

          // Simulate price movement (±0.5% per second)
          const priceChange = (Math.random() - 0.5) * prev.entryPrice * 0.01;
          const newPrice = prev.currentPrice + priceChange;

          // Calculate PnL based on position side
          let pnl: number;
          if (prev.side === 'long') {
            pnl = (newPrice - prev.entryPrice) * prev.size;
          } else {
            pnl = (prev.entryPrice - newPrice) * prev.size;
          }

          // Check liquidation
          const isLiquidated = prev.side === 'long' 
            ? newPrice <= prev.liqPrice
            : newPrice >= prev.liqPrice;

          if (isLiquidated) {
            toast({
              title: "Position Liquidated",
              description: `Your ${prev.side} position was liquidated at $${newPrice.toFixed(2)}`,
              variant: "destructive",
            });
            return null;
          }

          return {
            ...prev,
            currentPrice: newPrice,
            pnl,
          };
        });
      }, 1000);

      return () => {
        if (pnlIntervalRef.current) {
          clearInterval(pnlIntervalRef.current);
        }
      };
    }
  }, [position, toast]);

  const openPosition = (
    side: 'long' | 'short',
    collateralAmount: number,
    leverageAmount: number,
    currentPrice: number
  ) => {
    const size = collateralAmount * leverageAmount;
    const entryPrice = currentPrice;
    
    // Calculate liquidation price
    // For long: liqPrice = entry * (1 - 1/leverage * 0.9)
    // For short: liqPrice = entry * (1 + 1/leverage * 0.9)
    const liqPrice = side === 'long'
      ? entryPrice * (1 - (1 / leverageAmount) * 0.9)
      : entryPrice * (1 + (1 / leverageAmount) * 0.9);

    const newPosition: Position = {
      side,
      size,
      collateral: collateralAmount,
      leverage: leverageAmount,
      entryPrice,
      liqPrice,
      pnl: 0,
      currentPrice: entryPrice,
    };

    setPosition(newPosition);

    toast({
      title: `${side.toUpperCase()} Position Opened`,
      description: `${size.toFixed(4)} ETH at ${leverageAmount}x leverage`,
    });
  };

  const closePosition = () => {
    if (position) {
      const finalPnl = position.pnl;
      const finalPnlPercent = (finalPnl / position.collateral) * 100;

      toast({
        title: "Position Closed",
        description: `Final P&L: ${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)} (${finalPnlPercent >= 0 ? '+' : ''}${finalPnlPercent.toFixed(2)}%)`,
        variant: finalPnl >= 0 ? "default" : "destructive",
      });

      setPosition(null);
    }
  };

  return {
    leverage,
    setLeverage,
    position,
    openPosition,
    closePosition,
  };
}
