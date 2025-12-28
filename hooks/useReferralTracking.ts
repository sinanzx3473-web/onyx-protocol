import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useReferral } from '@/context/ReferralProvider';
import { Address } from 'viem';

/**
 * Hook to track referral activity for swaps and liquidity operations
 */
export function useReferralTracking() {
  const { address } = useAccount();
  const { referrer } = useReferral();

  const trackSwap = async (tokenIn: Address, tokenOut: Address, amountIn: string) => {
    if (!address || !referrer) return;

    try {
      await fetch('/api/referrals/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrer,
          referee: address,
          volume: amountIn,
          type: 'swap',
        }),
      });
    } catch (error) {
      console.error('Failed to track referral swap:', error);
    }
  };

  const trackLiquidity = async (tokenA: Address, tokenB: Address, amountA: string, amountB: string) => {
    if (!address || !referrer) return;

    try {
      // Track total liquidity value (sum of both tokens)
      const totalVolume = (BigInt(amountA) + BigInt(amountB)).toString();

      await fetch('/api/referrals/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrer,
          referee: address,
          volume: totalVolume,
          type: 'add_liquidity',
        }),
      });
    } catch (error) {
      console.error('Failed to track referral liquidity:', error);
    }
  };

  return {
    trackSwap,
    trackLiquidity,
    hasReferrer: !!referrer,
  };
}
