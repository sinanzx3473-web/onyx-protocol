import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useAccount, useSignTypedData, useChainId } from 'wagmi';
import { Address, parseUnits, encodeFunctionData } from 'viem';
import { DEX_CORE_ADDRESS, DEX_CORE_ABI, FLASH_SWAP_ADDRESS, FLASH_SWAP_ABI } from '@/utils/evmConfig';
import { useToast } from '@/hooks/use-toast';

interface RelayerContextType {
  gaslessEnabled: boolean;
  setGaslessEnabled: (enabled: boolean) => void;
  relayerFeePercent: number;
  signAndRelaySwap: (params: SwapParams) => Promise<RelayResult>;
  signAndRelayLiquidity: (params: LiquidityParams) => Promise<RelayResult>;
  signAndRelayFlashLoan: (borrower: Address, token: Address, amount: bigint, calldata: Address) => Promise<RelayResult>;
  isRelaying: boolean;
  isRelayerAvailable: boolean;
}

interface SwapParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  amountOutMin: string;
  deadline: number;
  decimalsIn: number;
}

interface LiquidityParams {
  tokenA: Address;
  tokenB: Address;
  amountA: string;
  amountB: string;
  amountAMin: string;
  amountBMin: string;
  deadline: number;
  decimalsA: number;
  decimalsB: number;
  action: 'add' | 'remove';
}

interface RelayResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

const RelayerContext = createContext<RelayerContextType | undefined>(undefined);

const RELAYER_FEE_PERCENT = 0.05; // 0.05% fee
const RELAYER_API_URL = import.meta.env.VITE_API_URL || '';

interface ForwardRequest {
  from: string;
  to: string;
  value: string;
  gas: string;
  nonce: string;
  data: string;
  [key: string]: unknown;
}

export function RelayerProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();
  const { toast } = useToast();
  
  const [gaslessEnabled, setGaslessEnabled] = useState(false);
  const [isRelaying, setIsRelaying] = useState(false);
  const [forwarderAddress, setForwarderAddress] = useState<Address | null>(null);
  const [isRelayerAvailable, setIsRelayerAvailable] = useState(false);

  // Fetch forwarder address on mount
  useEffect(() => {
    const fetchForwarder = async () => {
      // Skip if API URL not configured
      if (!RELAYER_API_URL) {
        setIsRelayerAvailable(false);
        return;
      }

      try {
        const response = await fetch(`${RELAYER_API_URL}/api/relayer/forwarder/${chainId}`);
        const data = await response.json();
        if (data.forwarderAddress) {
          setForwarderAddress(data.forwarderAddress as Address);
          setIsRelayerAvailable(true);
        } else {
          setIsRelayerAvailable(false);
        }
      } catch (error) {
        // Silently fail if relayer not available
        setIsRelayerAvailable(false);
      }
    };
    if (chainId) {
      fetchForwarder();
    }
  }, [chainId]);

  // EIP-712 domain for MinimalForwarder
  const getForwarderDomain = useCallback(() => {
    if (!forwarderAddress) return null;
    return {
      name: 'MinimalForwarder',
      version: '0.0.1',
      chainId: BigInt(chainId),
      verifyingContract: forwarderAddress,
    };
  }, [chainId, forwarderAddress]);

  // Sign and relay swap transaction using MinimalForwarder
  const signAndRelaySwap = useCallback(async (params: SwapParams): Promise<RelayResult> => {
    if (!address || !forwarderAddress) {
      return { success: false, error: 'Wallet not connected or forwarder not available' };
    }

    setIsRelaying(true);
    try {
      // Get user's nonce from relayer
      const nonceResponse = await fetch(`${RELAYER_API_URL}/api/relayer/nonce/${chainId}/${address}`);
      const { nonce } = await nonceResponse.json();

      // Encode swap function call
      const amountIn = parseUnits(params.amountIn, params.decimalsIn);
      const data = encodeFunctionData({
        abi: DEX_CORE_ABI,
        functionName: 'swap',
        args: [
          params.tokenIn,
          params.tokenOut,
          amountIn,
          BigInt(params.amountOutMin),
          address,
        ],
      });

      // Build forward request
      const request: ForwardRequest = {
        from: address,
        to: DEX_CORE_ADDRESS,
        value: '0',
        gas: '500000',
        nonce,
        data,
      };

      // EIP-712 types for MinimalForwarder
      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      };

      const domain = getForwarderDomain();
      if (!domain) {
        throw new Error('Forwarder domain not available');
      }

      // Sign the forward request
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'ForwardRequest',
        message: request,
      });

      // Send to relayer backend
      const response = await fetch(`${RELAYER_API_URL}/api/relayer/relay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request,
          signature,
          chainId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Relay failed');
      }

      toast({
        title: 'Gasless Swap Submitted',
        description: `Transaction relayed successfully. Hash: ${result.txHash.slice(0, 10)}...`,
      });

      return {
        success: true,
        txHash: result.txHash,
      };
    } catch (error: any) {
      console.error('Relay swap error:', error);
      toast({
        title: 'Relay Failed',
        description: error.message || 'Failed to relay transaction',
        variant: 'destructive',
      });
      return {
        success: false,
        error: error.message,
      };
    } finally {
      setIsRelaying(false);
    }
  }, [address, chainId, forwarderAddress, signTypedDataAsync, getForwarderDomain, toast]);

  // Sign and relay liquidity transaction using MinimalForwarder
  const signAndRelayLiquidity = useCallback(async (params: LiquidityParams): Promise<RelayResult> => {
    if (!address || !forwarderAddress) {
      return { success: false, error: 'Wallet not connected or forwarder not available' };
    }

    setIsRelaying(true);
    try {
      // Get user's nonce from relayer
      const nonceResponse = await fetch(`${RELAYER_API_URL}/api/relayer/nonce/${chainId}/${address}`);
      const { nonce } = await nonceResponse.json();

      // Encode liquidity function call
      const amountA = parseUnits(params.amountA, params.decimalsA);
      const amountB = parseUnits(params.amountB, params.decimalsB);
      const amountAMin = parseUnits(params.amountAMin, params.decimalsA);
      const amountBMin = parseUnits(params.amountBMin, params.decimalsB);

      const data = encodeFunctionData({
        abi: DEX_CORE_ABI,
        functionName: params.action === 'add' ? 'addLiquidity' : 'removeLiquidity',
        args: params.action === 'add'
          ? [params.tokenA, params.tokenB, amountA, amountB, BigInt(0)]
          : [params.tokenA, params.tokenB, amountA, amountAMin, amountBMin],
      });

      // Build forward request
      const request: ForwardRequest = {
        from: address,
        to: DEX_CORE_ADDRESS,
        value: '0',
        gas: '500000',
        nonce,
        data,
      };

      // EIP-712 types for MinimalForwarder
      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      };

      const domain = getForwarderDomain();
      if (!domain) {
        throw new Error('Forwarder domain not available');
      }

      // Sign the forward request
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'ForwardRequest',
        message: request,
      });

      // Send to relayer backend
      const response = await fetch(`${RELAYER_API_URL}/api/relayer/relay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request,
          signature,
          chainId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Relay failed');
      }

      toast({
        title: 'Gasless Liquidity Submitted',
        description: `Transaction relayed successfully. Hash: ${result.txHash.slice(0, 10)}...`,
      });

      return {
        success: true,
        txHash: result.txHash,
      };
    } catch (error: any) {
      console.error('Relay liquidity error:', error);
      toast({
        title: 'Relay Failed',
        description: error.message || 'Failed to relay transaction',
        variant: 'destructive',
      });
      return {
        success: false,
        error: error.message,
      };
    } finally {
      setIsRelaying(false);
    }
  }, [address, chainId, forwarderAddress, signTypedDataAsync, getForwarderDomain, toast]);

  // Sign and relay flash loan transaction
  const signAndRelayFlashLoan = useCallback(async (
    borrower: Address,
    token: Address,
    amount: bigint,
    calldata: Address
  ): Promise<RelayResult> => {
    if (!address || !forwarderAddress) {
      return { success: false, error: 'Wallet not connected or forwarder not available' };
    }

    setIsRelaying(true);
    try {
      // Get user's nonce from relayer
      const nonceResponse = await fetch(`${RELAYER_API_URL}/api/relayer/nonce/${chainId}/${address}`);
      const { nonce } = await nonceResponse.json();

      // Encode flash loan function call
      const data = encodeFunctionData({
        abi: FLASH_SWAP_ABI,
        functionName: 'flashLoan',
        args: [borrower, token, amount, calldata],
      });

      // Build forward request
      const request: ForwardRequest = {
        from: address,
        to: FLASH_SWAP_ADDRESS,
        value: '0',
        gas: '800000', // Higher gas for flash loans
        nonce,
        data,
      };

      // EIP-712 types for MinimalForwarder
      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      };

      const domain = getForwarderDomain();
      if (!domain) {
        throw new Error('Forwarder domain not available');
      }

      // Sign the forward request
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'ForwardRequest',
        message: request,
      });

      // Send to relayer backend
      const response = await fetch(`${RELAYER_API_URL}/api/relayer/relay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request,
          signature,
          chainId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Relay failed');
      }

      toast({
        title: 'Gasless Flash Loan Submitted',
        description: `Transaction relayed successfully. Hash: ${result.txHash.slice(0, 10)}...`,
      });

      return {
        success: true,
        txHash: result.txHash,
      };
    } catch (error: any) {
      console.error('Relay flash loan error:', error);
      toast({
        title: 'Relay Failed',
        description: error.message || 'Failed to relay flash loan transaction',
        variant: 'destructive',
      });
      return {
        success: false,
        error: error.message,
      };
    } finally {
      setIsRelaying(false);
    }
  }, [address, chainId, forwarderAddress, signTypedDataAsync, getForwarderDomain, toast]);

  return (
    <RelayerContext.Provider
      value={{
        gaslessEnabled,
        setGaslessEnabled,
        relayerFeePercent: RELAYER_FEE_PERCENT,
        signAndRelaySwap,
        signAndRelayLiquidity,
        signAndRelayFlashLoan,
        isRelaying,
        isRelayerAvailable,
      }}
    >
      {children}
    </RelayerContext.Provider>
  );
}

export function useRelayer() {
  const context = useContext(RelayerContext);
  if (!context) {
    throw new Error('useRelayer must be used within RelayerProvider');
  }
  return context;
}
