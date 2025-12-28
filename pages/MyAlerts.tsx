import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Radio, TrendingUp, Activity, Zap } from 'lucide-react';

interface Alert {
  id: string;
  userId: string;
  name: string;
  type: 'price_cross' | 'volume_spike' | 'apr_change' | 'flash_loan_threshold';
  condition: string;
  targetValue: string;
  poolAddress?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  deliveryMethods: string[];
  webhookUrl?: string;
  isActive: boolean;
  lastTriggered?: string;
  createdAt: string;
  updatedAt: string;
}

export default function MyAlerts() {
  const { address, isConnected } = useAccount();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (address) {
      fetchAlerts();
    }
  }, [address]);

  const fetchAlerts = async () => {
    if (!address) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/alerts?userId=${address}`);
      const data = await response.json();
      
      if (response.ok) {
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock alerts for demonstration
  const mockPriceAlerts = [
    { symbol: 'ETH', condition: '> $3,500', status: 'ACTIVE', color: 'text-gold' },
    { symbol: 'BTC', condition: '< $60,000', status: 'TRIGGERED', color: 'text-success' },
    { symbol: 'USDC', condition: '≠ $1.00', status: 'ARMED', color: 'text-gold' }
  ];

  const mockChainAlerts = [
    'Whale Alert: 500 ETH moved to Coinbase',
    'Large Swap: 1M USDC → ETH on Uniswap',
    'Flash Loan: 10,000 ETH borrowed on Aave'
  ];

  return (
    <div className="relative min-h-screen bg-void text-platinum p-8">
      {/* Layer A: Monitor Wall Background */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-500 ${
        !isConnected ? 'blur-md opacity-30 scale-95' : ''
      }`}>
        
        {/* Monitor 1: Price Sentinels */}
        <div className="bg-black/40 backdrop-blur-md border border-gold/30 rounded-lg p-6 border-t-2 border-t-gold shadow-[0_0_30px_rgba(212,175,55,0.1)]">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-gold" />
            <h3 className="font-['Cinzel'] text-gold tracking-widest text-sm">PRICE SENTINELS</h3>
          </div>
          <div className="space-y-3">
            {mockPriceAlerts.map((alert, idx) => (
              <div key={idx} className="font-mono text-xs flex items-center justify-between py-2 border-b border-gold/10">
                <span className="text-platinum/70">{alert.symbol}</span>
                <span className="text-platinum/50">{alert.condition}</span>
                <span className={`${alert.color} font-bold tracking-wider`}>[{alert.status}]</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monitor 2: On-Chain Radar */}
        <div className="bg-black/40 backdrop-blur-md border border-success/30 rounded-lg p-6 border-t-2 border-t-success shadow-[0_0_30px_rgba(34,197,94,0.1)]">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-5 h-5 text-success" />
            <h3 className="font-['Cinzel'] text-success tracking-widest text-sm">ON-CHAIN RADAR</h3>
          </div>
          <div className="space-y-3 overflow-hidden">
            {mockChainAlerts.map((alert, idx) => (
              <div key={idx} className="font-mono text-xs text-platinum/70 py-2 border-b border-success/10 animate-pulse">
                <div className="whitespace-nowrap overflow-hidden">
                  {alert}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monitor 3: Gas Tracker */}
        <div className="bg-black/40 backdrop-blur-md border border-danger/30 rounded-lg p-6 border-t-2 border-t-danger shadow-[0_0_30px_rgba(239,68,68,0.1)]">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-5 h-5 text-danger" />
            <h3 className="font-['Cinzel'] text-danger tracking-widest text-sm">GAS TRACKER</h3>
          </div>
          <div className="space-y-3">
            <div className="font-mono text-xs flex items-center justify-between py-2 border-b border-danger/10">
              <span className="text-platinum/70">Current</span>
              <span className="text-platinum/50">45 GWEI</span>
              <span className="text-success font-bold tracking-wider">[NORMAL]</span>
            </div>
            <div className="font-mono text-xs flex items-center justify-between py-2 border-b border-danger/10">
              <span className="text-platinum/70">Alert</span>
              <span className="text-platinum/50">&gt; 50 GWEI</span>
              <span className="text-gold font-bold tracking-wider">[ARMED]</span>
            </div>
            <div className="font-mono text-xs flex items-center justify-between py-2 border-b border-danger/10">
              <span className="text-platinum/70">Peak</span>
              <span className="text-platinum/50">120 GWEI</span>
              <span className="text-danger font-bold tracking-wider">[CRITICAL]</span>
            </div>
          </div>
        </div>
      </div>

      {/* Layer B: Signal Decryption Overlay */}
      {!isConnected && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-xl border border-gold/30 rounded-lg p-12 flex flex-col items-center shadow-[0_0_50px_rgba(212,175,55,0.1)] pointer-events-auto max-w-md w-full mx-4">
            
            {/* Radar Sweep Animation */}
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-gold/0 via-gold/30 to-gold/0 animate-spin" 
                   style={{ animationDuration: '3s' }}></div>
              <div className="absolute inset-2 rounded-full bg-void/80 backdrop-blur-sm flex items-center justify-center">
                <Radio className="w-12 h-12 text-gold animate-pulse" />
              </div>
            </div>

            {/* Title */}
            <h2 className="font-['Cinzel'] text-2xl text-gold tracking-widest mb-3 text-center">
              SIGNAL ENCRYPTED
            </h2>

            {/* Subtitle */}
            <p className="font-mono text-sm text-platinum/50 mb-8 text-center tracking-wide">
              Connect wallet to establish uplink.
            </p>

            {/* Connect Button */}
            <button 
              className="w-full py-4 border border-gold text-gold font-bold hover:bg-gold hover:text-black uppercase tracking-[0.2em] transition-all duration-300 rounded"
              onClick={() => {
                // Trigger wallet connection via navbar
                document.querySelector('w3m-button')?.shadowRoot?.querySelector('button')?.click();
              }}
            >
              ESTABLISH UPLINK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
