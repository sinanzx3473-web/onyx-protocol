import { ethers } from 'ethers';

interface ForwardRequest {
  from: string;
  to: string;
  value: string;
  gas: string;
  nonce: string;
  data: string;
}

interface RelayRequest {
  request: ForwardRequest;
  signature: string;
  chainId: number;
}

interface RelayerConfig {
  privateKey: string;
  minBalance: string; // Minimum ETH balance before alerting
  networks: {
    [chainId: number]: {
      rpcUrl: string;
      forwarderAddress: string;
    };
  };
}

class RelayerService {
  private static instance: RelayerService;
  private config: RelayerConfig;
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  private wallets: Map<number, ethers.Wallet> = new Map();
  private forwarderAbi = [
    'function execute(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature) external payable returns (bool, bytes)',
    'function getNonce(address from) external view returns (uint256)',
    'function verify(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature) external view returns (bool)'
  ];

  private constructor() {
    // Validate critical environment variables at startup
    this.validateEnvironment();
    
    this.config = {
      privateKey: process.env.RELAYER_PRIVATE_KEY || '',
      minBalance: process.env.RELAYER_MIN_BALANCE || '0.1',
      networks: {
        20258: { // devnet
          rpcUrl: process.env.DEVNET_RPC_URL || 'https://dev-rpc.codenut.dev',
          forwarderAddress: process.env.DEVNET_FORWARDER_ADDRESS || ''
        }
      }
    };

    this.initializeProviders();
  }

  private validateEnvironment(): void {
    // Check if RELAYER_PRIVATE_KEY is set
    if (!process.env.RELAYER_PRIVATE_KEY) {
      throw new Error('CRITICAL: Missing RELAYER_PRIVATE_KEY environment variable. Server cannot start without relayer configuration.');
    }

    // Validate private key format (0x + 64 hex characters)
    const privateKeyRegex = /^0x[a-fA-F0-9]{64}$/;
    if (!privateKeyRegex.test(process.env.RELAYER_PRIVATE_KEY)) {
      throw new Error('CRITICAL: Invalid RELAYER_PRIVATE_KEY format. Expected 0x followed by 64 hexadecimal characters.');
    }

    // Validate the private key is not a placeholder
    const placeholderKeys = [
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x1111111111111111111111111111111111111111111111111111111111111111'
    ];
    
    if (placeholderKeys.includes(process.env.RELAYER_PRIVATE_KEY.toLowerCase())) {
      throw new Error('CRITICAL: RELAYER_PRIVATE_KEY appears to be a placeholder value. Please configure a real private key.');
    }

    console.log('✓ Relayer configuration validated successfully');
  }

  private initializeProviders() {
    for (const [chainId, network] of Object.entries(this.config.networks)) {
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      const wallet = new ethers.Wallet(this.config.privateKey, provider);
      
      this.providers.set(Number(chainId), provider);
      this.wallets.set(Number(chainId), wallet);
    }
  }

  async relayTransaction(relayRequest: RelayRequest): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const { request, signature, chainId } = relayRequest;

      // Validate chain support
      const wallet = this.wallets.get(chainId);
      const network = this.config.networks[chainId];
      
      if (!wallet || !network) {
        return { success: false, error: 'Unsupported network' };
      }

      // Check relayer balance
      const balance = await wallet.provider!.getBalance(wallet.address);
      const minBalance = ethers.parseEther(this.config.minBalance);
      
      if (balance < minBalance) {
        console.error(`Low relayer balance on chain ${chainId}: ${ethers.formatEther(balance)} ETH`);
        // Still attempt relay but log warning
      }

      // Get forwarder contract
      const forwarder = new ethers.Contract(
        network.forwarderAddress,
        this.forwarderAbi,
        wallet
      );

      // Verify signature before relaying
      const isValid = await forwarder.verify(request, signature);
      if (!isValid) {
        return { success: false, error: 'Invalid signature' };
      }

      // Execute meta-transaction
      const tx = await forwarder.execute(request, signature, {
        gasLimit: BigInt(request.gas) + 50000n // Add buffer for forwarder overhead
      });

      const receipt = await tx.wait();

      return {
        success: receipt.status === 1,
        txHash: receipt.hash
      };
    } catch (error: any) {
      console.error('Relay error:', error);
      return {
        success: false,
        error: error.message || 'Unknown relay error'
      };
    }
  }

  async getRelayerStatusByChain(chainId: number): Promise<{
    address: string;
    balance: string;
    nonce: number;
    healthy: boolean;
  }> {
    const wallet = this.wallets.get(chainId);
    
    if (!wallet) {
      throw new Error('Unsupported network');
    }

    const balance = await wallet.provider!.getBalance(wallet.address);
    const nonce = await wallet.getNonce();
    const minBalance = ethers.parseEther(this.config.minBalance);

    return {
      address: wallet.address,
      balance: ethers.formatEther(balance),
      nonce,
      healthy: balance >= minBalance
    };
  }

  async getUserNonce(chainId: number, userAddress: string): Promise<string> {
    const network = this.config.networks[chainId];
    const provider = this.providers.get(chainId);

    if (!provider || !network) {
      throw new Error('Unsupported network');
    }

    const forwarder = new ethers.Contract(
      network.forwarderAddress,
      this.forwarderAbi,
      provider
    );

    const nonce = await forwarder.getNonce(userAddress);
    return nonce.toString();
  }

  getForwarderAddress(chainId: number): string | undefined {
    return this.config.networks[chainId]?.forwarderAddress;
  }

  getSupportedChains(): number[] {
    return Object.keys(this.config.networks).map(Number);
  }

  async getRelayerStatus(): Promise<Array<{
    chainId: number;
    relayerAddress: string;
    balance: string | null;
    balanceWei: string | null;
    forwarderAddress: string;
    healthy: boolean;
  }>> {
    const status = [];
    
    for (const [chainId, network] of Object.entries(this.config.networks)) {
      const wallet = this.wallets.get(Number(chainId));
      
      if (!wallet) {
        status.push({
          chainId: Number(chainId),
          relayerAddress: 'Not configured',
          balance: null,
          balanceWei: null,
          forwarderAddress: network.forwarderAddress,
          healthy: false,
        });
        continue;
      }

      try {
        const balance = await wallet.provider!.getBalance(wallet.address);
        const minBalance = ethers.parseEther(this.config.minBalance);

        status.push({
          chainId: Number(chainId),
          relayerAddress: wallet.address,
          balance: ethers.formatEther(balance),
          balanceWei: balance.toString(),
          forwarderAddress: network.forwarderAddress,
          healthy: balance >= minBalance,
        });
      } catch (error) {
        console.error(`Failed to get status for chain ${chainId}:`, error);
        status.push({
          chainId: Number(chainId),
          relayerAddress: wallet.address,
          balance: null,
          balanceWei: null,
          forwarderAddress: network.forwarderAddress,
          healthy: false,
        });
      }
    }

    return status;
  }

  static getInstance(): RelayerService {
    if (!RelayerService.instance) {
      RelayerService.instance = new RelayerService();
    }
    return RelayerService.instance;
  }
}

export const relayerService = RelayerService.getInstance();
