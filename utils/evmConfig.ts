import metadata from '../metadata.json';

const targetChainName = import.meta.env.VITE_CHAIN || 'devnet';

const evmConfig = metadata.chains.find(chain => chain.network === targetChainName);

if (!evmConfig) {
  throw new Error(`Chain '${targetChainName}' not found in metadata.json`);
}

// Extract contract addresses and ABIs
const factoryContract = evmConfig.contracts.find(c => c.contractName === 'DEXFactory');
const routerContract = evmConfig.contracts.find(c => c.contractName === 'DEXRouter');
const dexCoreContract = evmConfig.contracts.find(c => c.contractName === 'DexCore');
const flashSwapContract = evmConfig.contracts.find(c => c.contractName === 'FlashSwap');
const bridgeAdapterContract = evmConfig.contracts.find(c => c.contractName === 'BridgeAdapter');
const mockTokenA = evmConfig.contracts.find(c => c.contractName === 'MockTokenA');
const mockTokenB = evmConfig.contracts.find(c => c.contractName === 'MockTokenB');

if (!factoryContract || !routerContract || !dexCoreContract || !flashSwapContract || !bridgeAdapterContract) {
  throw new Error('Required contracts not found in metadata.json');
}

export const selectedChain = evmConfig;
export const chainId = parseInt(evmConfig.chainId);
export const rpcUrl = evmConfig.rpc_url;

// Contract addresses
export const FACTORY_ADDRESS = factoryContract.address;
export const ROUTER_ADDRESS = routerContract.address;
export const DEX_CORE_ADDRESS = dexCoreContract.address;
export const FLASH_SWAP_ADDRESS = flashSwapContract.address;
export const BRIDGE_ADAPTER_ADDRESS = bridgeAdapterContract.address;
export const MOCK_TOKEN_A_ADDRESS = mockTokenA?.address || '';
export const MOCK_TOKEN_B_ADDRESS = mockTokenB?.address || '';

// Contract ABIs
export const FACTORY_ABI = factoryContract.abi;
export const ROUTER_ABI = routerContract.abi;
export const DEX_CORE_ABI = dexCoreContract.abi;
export const FLASH_SWAP_ABI = flashSwapContract.abi;
export const BRIDGE_ADAPTER_ABI = bridgeAdapterContract.abi;

// ERC20 ABI for token interactions
export const ERC20_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// DEX Pair ABI for liquidity pool interactions
export const PAIR_ABI = [
  {
    "inputs": [],
    "name": "getReserves",
    "outputs": [
      { "internalType": "uint112", "name": "reserve0", "type": "uint112" },
      { "internalType": "uint112", "name": "reserve1", "type": "uint112" },
      { "internalType": "uint32", "name": "blockTimestampLast", "type": "uint32" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token0",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token1",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

/**
 * To build for different chains, set the VITE_CHAIN environment variable:
 *
 * VITE_CHAIN=devnet pnpm run build    (for local development)
 * VITE_CHAIN=mainnet pnpm run build   (for production)
 * VITE_CHAIN=polygon pnpm run build   (for Polygon network)
 */
