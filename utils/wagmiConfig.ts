import { http, createConfig, fallback } from 'wagmi';
import { defineChain } from 'viem';
import { selectedChain, chainId, rpcUrl } from './evmConfig';

// Define multiple RPC endpoints for fallback
const getRpcEndpoints = (): string[] => {
  const endpoints: string[] = [rpcUrl];
  
  // Add public RPC endpoints as fallbacks based on chain
  const publicEndpoints: Record<number, string[]> = {
    1: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'],
    11155111: ['https://rpc.sepolia.org', 'https://rpc2.sepolia.org'],
    137: ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon'],
    42161: ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum'],
    10: ['https://mainnet.optimism.io', 'https://rpc.ankr.com/optimism'],
    8453: ['https://mainnet.base.org', 'https://base.llamarpc.com'],
    56: ['https://bsc-dataseed.binance.org', 'https://rpc.ankr.com/bsc'],
  };
  
  // Add public endpoints for the current chain if available
  if (publicEndpoints[chainId]) {
    endpoints.push(...publicEndpoints[chainId]);
  }
  
  return endpoints;
};

const rpcEndpoints = getRpcEndpoints();

// Runtime chain ID validation
if (typeof window !== 'undefined') {
  window.addEventListener('load', async () => {
    if (window.ethereum) {
      try {
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        const expectedChainId = `0x${chainId.toString(16)}`;
        
        if (currentChainId !== expectedChainId) {
          console.warn(
            `Chain ID mismatch! Expected ${expectedChainId} (${chainId}), but wallet is on ${currentChainId}. ` +
            `Please switch to ${selectedChain.network} network.`
          );
        }
      } catch (error) {
        console.error('Failed to validate chain ID:', error);
      }
    }
  });
}

// Define custom chain from metadata
export const customChain = defineChain({
  id: chainId,
  name: selectedChain.network,
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: rpcEndpoints },
    public: { http: rpcEndpoints },
  },
});

export const wagmiConfig = createConfig({
  chains: [customChain],
  transports: {
    [customChain.id]: fallback(
      rpcEndpoints.map(endpoint => http(endpoint)),
      { rank: true }
    ),
  },
});
