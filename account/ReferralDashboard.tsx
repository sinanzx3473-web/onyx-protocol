import { useState, useEffect } from 'react';
import { useReferral } from '@/context/ReferralProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Users, TrendingUp, Award, DollarSign } from 'lucide-react';
import { formatUnits } from 'viem';

export function ReferralDashboard() {
  const { referralCode, referralLink, generateReferralCode, stats, loadStats } = useReferral();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const handleGenerateCode = async () => {
    setLoading(true);
    try {
      await generateReferralCode();
      toast({
        title: 'Referral Code Generated',
        description: 'Your unique referral link is ready to share!',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate referral code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!referralLink) return;

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Referral link copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Referral Link Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Referral Link
          </CardTitle>
          <CardDescription>
            Share your unique link and earn rewards when your referrals trade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!referralCode ? (
            <Button onClick={handleGenerateCode} disabled={loading} className="w-full">
              {loading ? 'Generating...' : 'Generate Referral Link'}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={referralLink || ''}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Your code:</span>
                <code className="px-2 py-1 bg-muted rounded font-mono">{referralCode}</code>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReferrals}</div>
              <p className="text-xs text-muted-foreground">
                {stats.monthlyReferrals} this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${parseFloat(formatUnits(BigInt(stats.totalVolume || '0'), 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                ${parseFloat(formatUnits(BigInt(stats.monthlyVolume || '0'), 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rewards</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${parseFloat(formatUnits(BigInt(stats.totalRewards || '0'), 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                0.05% of referred volume
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leaderboard Rank</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.rank ? `#${stats.rank}` : 'Unranked'}
              </div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How Referral Rewards Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              1
            </div>
            <div>
              <p className="font-medium">Share Your Link</p>
              <p className="text-muted-foreground">
                Copy your unique referral link and share it with friends, on social media, or in your community
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              2
            </div>
            <div>
              <p className="font-medium">They Trade</p>
              <p className="text-muted-foreground">
                When someone uses your link and makes swaps or adds liquidity, their activity is tracked on-chain
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              3
            </div>
            <div>
              <p className="font-medium">Earn Rewards</p>
              <p className="text-muted-foreground">
                You earn 0.05% of all trading volume from your referrals. Top monthly referrers get bonus rewards!
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Privacy First:</strong> All tracking is done on-chain using wallet addresses only. No personal data is collected or shared.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
