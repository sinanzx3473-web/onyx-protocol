import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { Address } from 'viem';

interface ReferralContextType {
  referralCode: string | null;
  referralLink: string | null;
  referrer: Address | null;
  generateReferralCode: () => Promise<string>;
  setReferrer: (referrer: Address) => void;
  stats: ReferralStats | null;
  loadStats: () => Promise<void>;
}

interface ReferralStats {
  totalReferrals: number;
  totalVolume: string;
  totalRewards: string;
  rank: number | null;
  monthlyVolume: string;
  monthlyReferrals: number;
}

const ReferralContext = createContext<ReferralContextType | undefined>(undefined);

export function useReferral() {
  const context = useContext(ReferralContext);
  if (!context) {
    throw new Error('useReferral must be used within ReferralProvider');
  }
  return context;
}

interface ReferralProviderProps {
  children: ReactNode;
}

export function ReferralProvider({ children }: ReferralProviderProps) {
  const { address } = useAccount();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [referrer, setReferrerState] = useState<Address | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);

  // Load referral code from localStorage or generate new one
  useEffect(() => {
    if (!address) {
      setReferralCode(null);
      setReferralLink(null);
      return;
    }

    const storedCode = localStorage.getItem(`referral_code_${address}`);
    if (storedCode) {
      setReferralCode(storedCode);
      setReferralLink(`${window.location.origin}?ref=${storedCode}`);
    }
  }, [address]);

  // Check for referrer in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    
    if (refCode && address) {
      // Store referrer mapping
      const storedReferrer = localStorage.getItem(`referrer_${address}`);
      if (!storedReferrer) {
        // Validate and store referrer code
        validateAndStoreReferrer(refCode);
      }
    }
  }, [address]);

  const validateAndStoreReferrer = async (refCode: string) => {
    try {
      // Call backend to validate referral code and get referrer address
      const response = await fetch(`/api/referrals/validate?code=${refCode}`);
      if (response.ok) {
        const { referrer: referrerAddress } = await response.json();
        
        // Don't allow self-referral
        if (referrerAddress.toLowerCase() !== address?.toLowerCase()) {
          localStorage.setItem(`referrer_${address}`, referrerAddress);
          setReferrerState(referrerAddress as Address);
        }
      }
    } catch (error) {
      console.error('Failed to validate referral code:', error);
    }
  };

  const generateReferralCode = async (): Promise<string> => {
    if (!address) throw new Error('Wallet not connected');

    try {
      // Generate unique code based on wallet address
      const response = await fetch('/api/referrals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) throw new Error('Failed to generate referral code');

      const { code } = await response.json();
      
      // Store code
      localStorage.setItem(`referral_code_${address}`, code);
      setReferralCode(code);
      setReferralLink(`${window.location.origin}?ref=${code}`);

      return code;
    } catch (error) {
      console.error('Error generating referral code:', error);
      throw error;
    }
  };

  const loadStats = async () => {
    if (!address) return;

    try {
      const response = await fetch(`/api/referrals/stats?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load referral stats:', error);
    }
  };

  const setReferrer = (newReferrer: Address) => {
    if (!address) return;
    
    // Don't allow self-referral
    if (newReferrer.toLowerCase() === address.toLowerCase()) return;
    
    localStorage.setItem(`referrer_${address}`, newReferrer);
    setReferrerState(newReferrer);
  };

  return (
    <ReferralContext.Provider
      value={{
        referralCode,
        referralLink,
        referrer,
        generateReferralCode,
        setReferrer,
        stats,
        loadStats,
      }}
    >
      {children}
    </ReferralContext.Provider>
  );
}
