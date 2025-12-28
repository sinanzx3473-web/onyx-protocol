import axios from 'axios';

const ZERO_EX_API_BASE = 'https://sepolia.api.0x.org';

// Common token addresses on Sepolia
export const TOKEN_ADDRESSES: Record<string, string> = {
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  WETH: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  USDT: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
  DAI: '0x68194a729C2450ad26072b3D33ADaCbcef39D574',
};

export interface ZeroExQuote {
  price: string;
  guaranteedPrice: string;
  to: string;
  data: string;
  value: string;
  gas: string;
  estimatedGas: string;
  gasPrice: string;
  protocolFee: string;
  minimumProtocolFee: string;
  buyTokenAddress: string;
  sellTokenAddress: string;
  buyAmount: string;
  sellAmount: string;
  sources: Array<{
    name: string;
    proportion: string;
  }>;
  orders: any[];
  allowanceTarget: string;
  sellTokenToEthRate: string;
  buyTokenToEthRate: string;
}

export interface QuoteParams {
  sellToken: string;
  buyToken: string;
  sellAmount?: string;
  buyAmount?: string;
  slippagePercentage?: number;
  takerAddress?: string;
}

/**
 * Get a swap quote (simulated for demo)
 */
export const getQuote = async (params: QuoteParams): Promise<ZeroExQuote> => {
  // Simulate network delay for realism
  await new Promise(r => setTimeout(r, 800));
  
  // Resolve token symbols to addresses
  const sellTokenAddress = TOKEN_ADDRESSES[params.sellToken.toUpperCase()] || params.sellToken;
  const buyTokenAddress = TOKEN_ADDRESSES[params.buyToken.toUpperCase()] || params.buyToken;
  
  // Simulate realistic ETH/USDC pricing
  const basePrice = 3240.50;
  const variance = (Math.random() - 0.5) * 20; // ±10 variance
  const price = basePrice + variance;
  const guaranteedPrice = price * 0.995; // 0.5% slippage
  
  // Calculate amounts
  const sellAmount = params.sellAmount || '0';
  const sellAmountNum = parseFloat(sellAmount) / 1e18; // Assume 18 decimals
  const buyAmountNum = sellAmountNum * price;
  const buyAmount = Math.floor(buyAmountNum * 1e6).toString(); // USDC has 6 decimals
  
  return {
    price: price.toFixed(2),
    guaranteedPrice: guaranteedPrice.toFixed(2),
    to: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF', // 0x Router
    data: '0x', // Mock calldata
    value: params.sellToken.toUpperCase() === 'ETH' ? sellAmount : '0',
    gas: '150000',
    estimatedGas: '150000',
    gasPrice: '20000000000', // 20 gwei
    protocolFee: '0',
    minimumProtocolFee: '0',
    buyTokenAddress,
    sellTokenAddress,
    buyAmount,
    sellAmount: params.sellAmount || '0',
    sources: [
      { name: 'Uniswap_V3', proportion: '0.6' },
      { name: 'SushiSwap', proportion: '0.4' },
    ],
    orders: [],
    allowanceTarget: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF',
    sellTokenToEthRate: '1',
    buyTokenToEthRate: (1 / price).toFixed(8),
  };
};

/**
 * Get a price quote (simulated for demo)
 */
export const getPrice = async (params: QuoteParams): Promise<ZeroExQuote> => {
  // Reuse the simulated quote logic
  return getQuote(params);
};

/**
 * Format token amount from wei to human readable
 */
export const formatTokenAmount = (amount: string, decimals: number = 18): string => {
  const value = parseFloat(amount) / Math.pow(10, decimals);
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
};

/**
 * Parse token amount from human readable to wei
 */
export const parseTokenAmount = (amount: string, decimals: number = 18): string => {
  const value = parseFloat(amount) * Math.pow(10, decimals);
  return Math.floor(value).toString();
};
