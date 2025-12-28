import { Shield, Zap, Activity, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

export default function FlashSwapPage() {
  const [logs, setLogs] = useState<string[]>([
    '> Scanning Block 182934... No Arb found.',
    '> Scanning Block 182935... [ETH-USDC] Spread detected: 0.45%',
    '> Flash Loan Initiated: 1,000 ETH (Aave V3)',
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newLogs = [
        `> Scanning Block ${Math.floor(Math.random() * 100000) + 182900}... No Arb found.`,
        `> Scanning Block ${Math.floor(Math.random() * 100000) + 182900}... [ETH-USDC] Spread detected: ${(Math.random() * 0.5).toFixed(2)}%`,
        `> Flash Loan Initiated: ${Math.floor(Math.random() * 2000) + 500} ETH (Aave V3)`,
      ];
      setLogs(newLogs);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const vaults = [
    {
      id: 1,
      name: 'ETH/USDC ARB',
      status: 'LIVE',
      yield: '24.5',
      yieldLabel: 'APY',
      buttonText: 'Execute Flash',
      buttonEnabled: true,
      icon: TrendingUp,
    },
    {
      id: 2,
      name: 'STABLECOIN PEG',
      status: 'LIVE',
      yield: '12.8',
      yieldLabel: 'APY',
      buttonText: 'Auto-Loop',
      buttonEnabled: true,
      icon: Activity,
    },
    {
      id: 3,
      name: 'LIQUIDATIONS',
      status: 'LIVE',
      yield: '31.2',
      yieldLabel: 'APY',
      buttonText: 'Standby',
      buttonEnabled: false,
      icon: Zap,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="font-heading text-5xl md:text-6xl font-bold text-platinum tracking-widest">
          ACTIVE ARBITRAGE SCANNER
        </h1>
        <p className="font-sans text-xl text-brand-platinum/60 tracking-wide">
          Real-time opportunity detection across DEX protocols.
        </p>
      </div>

      {/* Safety Badge */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-6 py-3 bg-brand-gold/10 border border-brand-gold/30 rounded-full">
          <Shield className="w-5 h-5 text-brand-gold" />
          <span className="font-sans text-sm text-brand-gold font-medium tracking-wide">
            Contract Audited. Execution Atomic.
          </span>
        </div>
      </div>

      {/* Scanner Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        {vaults.map((vault) => (
          <div
            key={vault.id}
            className="relative border border-white/10 p-10 hover:border-brand-gold/50 transition-all duration-500 overflow-hidden group rounded-2xl"
          >
            {/* Scanner Effect Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-gold/10 to-transparent translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-1000 pointer-events-none" />

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-brand-gold/10 flex items-center justify-center">
                <vault.icon className="w-8 h-8 text-brand-gold" />
              </div>
            </div>

            {/* Strategy Name */}
            <h3 className="font-heading text-2xl text-platinum tracking-widest text-center mb-6">
              {vault.name}
            </h3>

            {/* Status with LED */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <p className="text-sm font-mono text-brand-platinum/70 uppercase tracking-wider">
                {vault.status}
              </p>
            </div>

            {/* Yield (APY) */}
            <div className="text-center mb-8">
              <p className="text-6xl font-mono text-brand-gold drop-shadow-[0_0_20px_rgba(212,175,55,0.5)] mb-2">
                {vault.yield}%
              </p>
              <p className="text-sm font-mono text-brand-platinum/50 uppercase tracking-widest">
                {vault.yieldLabel}
              </p>
            </div>

            {/* Action Button */}
            <Button
              disabled={!vault.buttonEnabled}
              className={`w-full font-sans font-bold uppercase tracking-wider ${
                vault.buttonEnabled
                  ? 'bg-brand-gold hover:bg-brand-gold/90 text-black'
                  : 'bg-brand-platinum/10 text-brand-platinum/30 cursor-not-allowed'
              }`}
            >
              {vault.buttonText}
            </Button>
          </div>
        ))}
      </div>

      {/* Live Execution Log */}
      <div className="border-t border-white/10 mt-20 pt-10">
        <h2 className="font-mono text-sm text-brand-gold/50 uppercase tracking-widest mb-6">
          LIVE OPPORTUNITY FEED
        </h2>
        <div className="space-y-2">
          {logs.map((log, index) => (
            <p key={index} className="font-mono text-xs text-white/40">
              {log}
            </p>
          ))}
        </div>
      </div>

      {/* Technical Details */}
      <div className="glass-onyx p-6 rounded-xl border border-brand-gold/20 mt-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-sm text-brand-platinum/50 uppercase tracking-widest mb-2 font-sans">
              Protocol Fee
            </p>
            <p className="text-2xl font-bold text-brand-gold font-sans tabular-nums">0.09%</p>
          </div>
          <div>
            <p className="text-sm text-brand-platinum/50 uppercase tracking-widest mb-2 font-sans">
              Execution Time
            </p>
            <p className="text-2xl font-bold text-brand-gold font-sans tabular-nums">&lt;1 Block</p>
          </div>
          <div>
            <p className="text-sm text-brand-platinum/50 uppercase tracking-widest mb-2 font-sans">
              Max Capacity
            </p>
            <p className="text-2xl font-bold text-brand-gold font-sans tabular-nums">∞</p>
          </div>
        </div>
      </div>
    </div>
  );
}
