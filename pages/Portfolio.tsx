import { useAccount } from 'wagmi';
import { Fingerprint, TrendingUp, Award, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function Portfolio() {
  const { address, isConnected } = useAccount();

  // Mock data for the background dashboard
  const mockStats = {
    netWorth: '$1,248,430.00',
    pnl24h: '+$12,403',
    pnlPercent: '+4.2%',
    claimableRewards: '450 ONYX'
  };

  const mockAssets = [
    { name: 'ETH', allocation: 45, value: '$561,793.50' },
    { name: 'USDC', allocation: 30, value: '$374,529.00' },
    { name: 'WBTC', allocation: 15, value: '$187,264.50' },
    { name: 'Other', allocation: 10, value: '$124,843.00' }
  ];

  const mockActivity = [
    { type: 'swap', desc: 'Swapped 10 ETH → 18,450 USDC', time: '2m ago', profit: true },
    { type: 'add', desc: 'Added liquidity to ETH/USDC', time: '1h ago', profit: true },
    { type: 'claim', desc: 'Claimed 125 ONYX rewards', time: '3h ago', profit: true },
    { type: 'swap', desc: 'Swapped 0.5 WBTC → 8.2 ETH', time: '5h ago', profit: false },
    { type: 'remove', desc: 'Removed liquidity from DAI/USDC', time: '12h ago', profit: false }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Scanner Line Animation */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-brand-gold to-transparent opacity-30 animate-[scan_4s_ease-in-out_infinite]" />
      </div>

      {/* Layer A: Background Dashboard (The Tease) */}
      <div
        className={`relative transition-all duration-700 ${
          !isConnected ? 'blur-lg opacity-30 scale-95 pointer-events-none' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          {/* Top Row: Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Net Worth */}
            <div className="glass-panel p-8 border border-brand-gold/20">
              <div className="text-xs font-mono text-brand-platinum/50 tracking-[0.2em] mb-2">
                NET WORTH
              </div>
              <div className="text-5xl font-bold text-brand-gold tracking-tight">
                {mockStats.netWorth}
              </div>
            </div>

            {/* Card 2: 24H PNL */}
            <div className="glass-panel p-8 border border-green-500/20">
              <div className="text-xs font-mono text-brand-platinum/50 tracking-[0.2em] mb-2">
                24H PNL
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-bold text-green-400">
                  {mockStats.pnl24h}
                </div>
                <div className="text-2xl text-green-400/70">
                  ({mockStats.pnlPercent})
                </div>
              </div>
            </div>

            {/* Card 3: Claimable Rewards */}
            <div className="glass-panel p-8 border border-brand-gold/20">
              <div className="text-xs font-mono text-brand-platinum/50 tracking-[0.2em] mb-2">
                CLAIMABLE REWARDS
              </div>
              <div className="text-4xl font-bold text-brand-platinum">
                {mockStats.claimableRewards}
              </div>
            </div>
          </div>

          {/* Middle Row: Asset Allocation & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Asset Allocation with CSS Donut Chart */}
            <div className="glass-panel p-8 border border-white/10">
              <h3 className="text-lg font-mono text-brand-platinum tracking-[0.15em] mb-6">
                ASSET ALLOCATION
              </h3>
              
              <div className="flex items-center justify-center mb-8">
                {/* CSS-only Donut Chart */}
                <div className="relative w-48 h-48">
                  {/* Outer ring segments */}
                  <div className="absolute inset-0 rounded-full" style={{
                    background: `conic-gradient(
                      from 0deg,
                      #D4AF37 0deg ${mockAssets[0].allocation * 3.6}deg,
                      #E5E7EB ${mockAssets[0].allocation * 3.6}deg ${(mockAssets[0].allocation + mockAssets[1].allocation) * 3.6}deg,
                      #60A5FA ${(mockAssets[0].allocation + mockAssets[1].allocation) * 3.6}deg ${(mockAssets[0].allocation + mockAssets[1].allocation + mockAssets[2].allocation) * 3.6}deg,
                      #9CA3AF ${(mockAssets[0].allocation + mockAssets[1].allocation + mockAssets[2].allocation) * 3.6}deg 360deg
                    )`
                  }} />
                  {/* Inner circle to create donut */}
                  <div className="absolute inset-8 rounded-full bg-brand-obsidian border border-white/5" />
                  {/* Center text */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-xs text-brand-platinum/50 font-mono">TOTAL</div>
                      <div className="text-sm font-bold text-brand-gold">100%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-3">
                {mockAssets.map((asset, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: i === 0 ? '#D4AF37' : i === 1 ? '#E5E7EB' : i === 2 ? '#60A5FA' : '#9CA3AF'
                        }}
                      />
                      <span className="text-sm font-mono text-brand-platinum">{asset.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-brand-platinum/70">{asset.allocation}%</div>
                      <div className="text-xs text-brand-platinum/50">{asset.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Recent Activity */}
            <div className="glass-panel p-8 border border-white/10">
              <h3 className="text-lg font-mono text-brand-platinum tracking-[0.15em] mb-6">
                RECENT ACTIVITY
              </h3>
              
              <div className="space-y-4">
                {mockActivity.map((activity, i) => (
                  <div 
                    key={i}
                    className="flex items-start gap-3 pb-4 border-b border-white/5 last:border-0"
                  >
                    <div className={`mt-1 ${activity.profit ? 'text-green-400' : 'text-brand-platinum/50'}`}>
                      {activity.profit ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-brand-platinum font-mono truncate">
                        {activity.desc}
                      </div>
                      <div className="text-xs text-brand-platinum/40 mt-1">
                        {activity.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Layer B: Security Access Terminal (The Overlay) */}
      {!isConnected && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
          <div className="glass-panel p-12 flex flex-col items-center border border-brand-gold/30 shadow-[0_0_100px_rgba(212,175,55,0.2)] max-w-md w-full">
            {/* Pulsing Fingerprint Icon */}
            <div className="mb-8">
              <Fingerprint className="w-20 h-20 text-brand-gold animate-pulse" strokeWidth={1.5} />
            </div>

            {/* Title */}
            <h2 className="font-heading text-2xl text-brand-platinum tracking-widest text-center mb-3">
              IDENTITY VERIFICATION REQUIRED
            </h2>

            {/* Subtitle */}
            <p className="font-mono text-sm text-brand-platinum/50 text-center mb-8">
              Connect wallet to decrypt portfolio data.
            </p>

            {/* Scan Identity Button */}
            <button className="w-full py-4 border border-brand-gold text-brand-gold font-bold hover:bg-brand-gold hover:text-black uppercase tracking-[0.2em] transition-all duration-300 rounded">
              Scan Identity
            </button>

            {/* Security Indicators */}
            <div className="mt-8 flex items-center gap-6 text-xs font-mono text-brand-platinum/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />
                <span>ENCRYPTED</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />
                <span>SECURE</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Line Keyframes */}
      <style>{`
        @keyframes scan {
          0%, 100% {
            top: 0%;
            opacity: 0;
          }
          10% {
            opacity: 0.3;
          }
          50% {
            top: 100%;
            opacity: 0.3;
          }
          90% {
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  );
}
