import { useState, useEffect } from 'react';
import { Loader2, Trophy, Medal, Award } from 'lucide-react';
import { formatUnits } from 'viem';
import { useReferral } from '@/context/ReferralProvider';

interface LeaderboardEntry {
  rank: number;
  address: string;
  volume: string;
  referrals: number;
  rewards: string;
}

export default function RewardsPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { stats } = useReferral();

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const response = await fetch('/api/referrals/leaderboard?limit=50');
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const rewardTiers = [
    {
      rank: '1ST PLACE',
      description: 'Top monthly referrer',
      reward: '0.05% + 500 USDC',
      bonus: 'Base reward + bonus',
      icon: Trophy,
      special: true,
    },
    {
      rank: '2ND PLACE',
      description: 'Second highest volume',
      reward: '0.05% + 300 USDC',
      bonus: 'Base reward + bonus',
      icon: Medal,
      special: false,
    },
    {
      rank: '3RD PLACE',
      description: 'Third highest volume',
      reward: '0.05% + 150 USDC',
      bonus: 'Base reward + bonus',
      icon: Medal,
      special: false,
    },
  ];

  return (
    <div className="container mx-auto py-8 space-y-12 relative">
      {/* Atmospheric Gold Gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-brand-gold/5 blur-[100px] -z-10" />

      {/* Hero Header */}
      <div className="text-center space-y-4">
        <h1 className="font-heading text-4xl text-white tracking-wider">PROTOCOL BOUNTIES</h1>
        <p className="font-mono text-brand-gold/60 tracking-wide">
          Compete for dominance. Earn yield on every referral.
        </p>
      </div>

      {/* Leaderboard Section */}
      <div className="relative p-8 border border-white/10 bg-brand-obsidian/30 backdrop-blur-xl rounded-lg">
        <h2 className="font-heading text-2xl text-brand-platinum mb-6 tracking-widest">MONTHLY LEADERBOARD</h2>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 className="h-12 w-12 text-brand-gold animate-spin" />
            <p className="font-mono text-brand-platinum/50 text-sm tracking-widest">AWAITING REFERRAL DATA...</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 className="h-12 w-12 text-brand-gold animate-spin" style={{ animationDuration: '3s' }} />
            <p className="font-mono text-brand-platinum/50 text-sm tracking-widest">AWAITING REFERRAL DATA...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry) => (
              <div
                key={entry.address}
                className="flex items-center justify-between p-4 border border-white/5 bg-brand-void/20 hover:border-brand-gold/30 transition-all rounded"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-brand-gold/50 w-12">#{entry.rank}</span>
                  <span className="font-mono text-brand-platinum">{formatAddress(entry.address)}</span>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-xs text-brand-platinum/50 font-mono">VOLUME</p>
                    <p className="font-mono text-brand-platinum">
                      ${parseFloat(formatUnits(BigInt(entry.volume || '0'), 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-brand-platinum/50 font-mono">REFERRALS</p>
                    <p className="font-mono text-brand-platinum">{entry.referrals}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-brand-platinum/50 font-mono">REWARDS</p>
                    <p className="font-mono text-brand-success">
                      ${parseFloat(formatUnits(BigInt(entry.rewards || '0'), 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reward Tiers - Bounty Cards Grid */}
      <div>
        <h2 className="font-heading text-2xl text-brand-platinum mb-6 tracking-widest text-center">REWARD TIERS</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {rewardTiers.map((tier, index) => {
            const Icon = tier.icon;
            return (
              <div
                key={tier.rank}
                className={`relative p-8 border transition-all group overflow-hidden rounded-lg ${
                  tier.special
                    ? 'border-brand-gold/30 bg-brand-obsidian/30 shadow-[0_0_30px_-10px_rgba(212,175,55,0.3)]'
                    : 'border-white/10 bg-brand-obsidian/30 hover:border-brand-gold/50'
                }`}
              >
                {/* Rank Label */}
                <div className="flex items-center gap-3 mb-4">
                  <Icon className={`h-6 w-6 ${tier.special ? 'text-brand-gold' : 'text-brand-platinum/50'}`} />
                  <p className="text-xs font-mono text-brand-gold/50 uppercase tracking-widest">{tier.rank}</p>
                </div>

                {/* Reward Amount */}
                <p className="text-3xl font-mono text-brand-platinum mt-2 group-hover:text-brand-gold transition-colors">
                  {tier.reward}
                </p>

                {/* Bonus Description */}
                <p className="text-sm text-brand-success mt-1">{tier.bonus}</p>

                {/* Description */}
                <p className="text-sm text-brand-platinum/50 mt-4 font-mono">{tier.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Terms - Dark Glass Panel */}
      <div className="relative p-8 border border-white/10 bg-brand-obsidian/30 backdrop-blur-xl rounded-lg">
        <h2 className="font-heading text-xl text-brand-platinum mb-4 tracking-widest">TERMS & CONDITIONS</h2>
        <div className="space-y-2 text-sm text-brand-platinum/50 font-mono">
          <p>• Rewards are calculated based on verified on-chain trading volume from referred users</p>
          <p>• Leaderboard resets at 00:00 UTC on the 1st of each month</p>
          <p>• Bonus rewards are distributed within 7 days after month end</p>
          <p>• Self-referrals and wash trading are prohibited and will result in disqualification</p>
          <p>• The protocol reserves the right to adjust reward rates with 30 days notice</p>
          <p>• All tracking is done on-chain using wallet addresses only - no personal data collected</p>
        </div>
      </div>
    </div>
  );
}
