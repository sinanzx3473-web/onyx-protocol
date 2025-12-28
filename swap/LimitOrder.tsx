import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LimitOrderProps {
  fromToken: { address: string; symbol: string; name: string; decimals: number };
  toToken: { address: string; symbol: string; name: string; decimals: number };
  fromAmount: string;
  currentPrice?: string;
}

export function LimitOrder({ fromToken, toToken, fromAmount, currentPrice }: LimitOrderProps) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();

  const [orderType, setOrderType] = useState<'limit' | 'stop'>('limit');
  const [targetPrice, setTargetPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [expiryHours, setExpiryHours] = useState('24');
  const [isCreating, setIsCreating] = useState(false);

  // Calculate minimum received based on target price and amount
  const minReceived = amount && targetPrice 
    ? (parseFloat(amount) * parseFloat(targetPrice)).toFixed(6)
    : '0';

  // Price difference percentage
  const priceDiff = currentPrice && targetPrice
    ? (((parseFloat(targetPrice) - parseFloat(currentPrice)) / parseFloat(currentPrice)) * 100).toFixed(2)
    : null;

  const handleCreateOrder = async () => {
    if (!isConnected || !address) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to create a limit order',
        variant: 'destructive',
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount to swap',
        variant: 'destructive',
      });
      return;
    }

    if (!targetPrice || parseFloat(targetPrice) <= 0) {
      toast({
        title: 'Invalid price',
        description: 'Please enter a valid target price',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      // Generate unique nonce
      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Create message to sign
      const message = `Create ${orderType} order: ${amount} ${fromToken.address} for ${targetPrice} ${toToken.address} per token. Nonce: ${nonce}`;

      // Request signature
      const signature = await signMessageAsync({ message });

      // Convert amounts to wei (assuming 18 decimals)
      const fromAmountWei = (parseFloat(amount) * 1e18).toString();
      const minReceivedWei = (parseFloat(minReceived) * 1e18).toString();

      // Create order via API
      const response = await fetch('/api/limit-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          fromToken: fromToken.address,
          toToken: toToken.address,
          fromAmount: fromAmountWei,
          targetPrice,
          minReceived: minReceivedWei,
          orderType,
          expiryHours: parseInt(expiryHours),
          signature,
          nonce,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create order');
      }

      const order = await response.json();

      toast({
        title: 'Order created successfully',
        description: `Your ${orderType} order will execute when price ${orderType === 'limit' ? 'reaches' : 'drops to'} ${targetPrice} ${toToken.symbol}`,
      });

      // Reset form
      setTargetPrice('');
      setAmount('');
      setExpiryHours('24');
    } catch (error) {
      console.error('Error creating limit order:', error);
      toast({
        title: 'Failed to create order',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="mt-10 flex flex-col gap-10">
      
      {/* 1. Order Type Tabs (Minimal Text) */}
      <div className="flex gap-8 border-b border-white/5 pb-4">
        <button
          onClick={() => setOrderType('limit')}
          className={`flex items-center gap-2 text-sm tracking-[0.2em] transition-all ${
            orderType === 'limit' 
              ? 'text-brand-gold font-bold drop-shadow-[0_0_10px_rgba(212,175,55,0.5)]' 
              : 'text-white/20 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          LIMIT ORDER
        </button>
        <button
          onClick={() => setOrderType('stop')}
          className={`flex items-center gap-2 text-sm tracking-[0.2em] transition-all ${
            orderType === 'stop' 
              ? 'text-brand-gold font-bold drop-shadow-[0_0_10px_rgba(212,175,55,0.5)]' 
              : 'text-white/20 hover:text-white'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          STOP ORDER
        </button>
      </div>

      {/* Current Price Display */}
      {currentPrice && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-white/40 tracking-[0.2em] uppercase text-[10px]">Current Price</span>
          <span className="text-brand-gold font-mono">{parseFloat(currentPrice).toFixed(6)} {toToken.symbol}</span>
        </div>
      )}

      {/* 2. Target Price Input (The Hero Input) */}
      <div className="space-y-3">
        <label className="text-[10px] text-brand-gold/40 uppercase tracking-[0.2em] font-mono">
          Target Price ({toToken.symbol} per {fromToken.symbol})
        </label>
        <input
          type="number"
          step="0.000001"
          placeholder="0.00"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
          className="w-full bg-transparent border-0 border-b border-white/10 focus:border-brand-gold outline-none text-2xl text-brand-platinum placeholder:text-white/20 transition-all pb-2"
        />
        {priceDiff && (
          <p className={`text-xs ${parseFloat(priceDiff) >= 0 ? 'text-brand-gold' : 'text-red-400'}`}>
            {parseFloat(priceDiff) >= 0 ? '+' : ''}{priceDiff}% from current price
          </p>
        )}
      </div>

      {/* 3. Amount Input (The Secondary Input) */}
      <div className="space-y-3">
        <label className="text-[10px] text-brand-gold/40 uppercase tracking-[0.2em] font-mono">
          Amount ({fromToken.symbol})
        </label>
        <input
          type="number"
          step="0.000001"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-transparent border-0 border-b border-white/10 focus:border-brand-gold outline-none text-2xl text-brand-platinum placeholder:text-white/20 transition-all pb-2"
        />
      </div>

      {/* Expected Output */}
      {minReceived !== '0' && (
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-brand-gold/40 uppercase tracking-[0.2em] font-mono">You will receive (minimum)</span>
          <span className="text-xl font-bold text-brand-gold">{minReceived} {toToken.symbol}</span>
        </div>
      )}

      {/* 4. Expiry Selector (Minimal Pills) */}
      <div className="space-y-3">
        <label className="text-[10px] text-brand-gold/40 uppercase tracking-[0.2em] font-mono flex items-center gap-2">
          <Clock className="w-3 h-3" />
          Expiry Time
        </label>
        <div className="flex gap-3">
          {['1', '6', '24', '72'].map((hours) => (
            <button
              key={hours}
              onClick={() => setExpiryHours(hours)}
              className={`px-4 py-2 rounded-full text-xs tracking-[0.15em] transition-all ${
                expiryHours === hours
                  ? 'bg-brand-gold/20 text-brand-gold border border-brand-gold'
                  : 'bg-transparent text-white/30 border border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              {hours}H
            </button>
          ))}
        </div>
        <p className="text-xs text-white/40">
          Order expires in {expiryHours} hours if not filled
        </p>
      </div>

      {/* 5. The Ghost Button */}
      <button
        onClick={handleCreateOrder}
        disabled={!isConnected || !amount || !targetPrice || isCreating}
        className="w-full py-4 border border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-brand-void transition-all uppercase tracking-[0.2em] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-brand-gold"
      >
        {isCreating ? 'CREATING...' : 'INITIALIZE STRATEGY'}
      </button>

      {/* Info Text */}
      <p className="text-xs text-white/30 text-center">
        Your order will be monitored off-chain and executed automatically when conditions are met.
      </p>
    </div>
  );
}
