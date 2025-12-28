import { privateKeyToAccount } from 'viem/accounts';
import type { PrivateKeyAccount } from 'viem/accounts';

/**
 * Secure relayer configuration
 * Validates private key format and provides warnings for security issues
 */
class RelayerConfig {
  private privateKey: string | undefined;
  private account: PrivateKeyAccount | undefined;

  constructor() {
    this.privateKey = process.env.RELAYER_PRIVATE_KEY;
    this.validateAndInitialize();
  }

  private validateAndInitialize(): void {
    if (!this.privateKey) {
      console.warn('⚠️  RELAYER_PRIVATE_KEY not set - relay endpoint will not work');
      console.warn('⚠️  Set RELAYER_PRIVATE_KEY in .env file to enable gasless transactions');
      return;
    }

    // Validate private key format
    const privateKeyRegex = /^0x[a-fA-F0-9]{64}$/;
    if (!privateKeyRegex.test(this.privateKey)) {
      console.error('❌ RELAYER_PRIVATE_KEY has invalid format');
      console.error('❌ Expected format: 0x followed by 64 hexadecimal characters');
      console.error('❌ Relay service will be disabled');
      this.privateKey = undefined;
      return;
    }

    try {
      // Initialize account
      this.account = privateKeyToAccount(this.privateKey as `0x${string}`);
      console.log('✅ Relayer configured successfully');
      console.log(`✅ Relayer address: ${this.account.address}`);
      
      // Security warning for production
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️  SECURITY WARNING: Using private key from environment variable in production');
        console.warn('⚠️  Consider migrating to AWS KMS, HashiCorp Vault, or similar key management service');
      }
    } catch (error) {
      console.error('❌ Failed to initialize relayer account:', error);
      this.privateKey = undefined;
      this.account = undefined;
    }
  }

  /**
   * Get the relayer account
   * @returns PrivateKeyAccount or undefined if not configured
   */
  public getAccount(): PrivateKeyAccount | undefined {
    return this.account;
  }

  /**
   * Check if relayer is configured and ready
   * @returns true if relayer is ready to use
   */
  public isConfigured(): boolean {
    return this.account !== undefined;
  }

  /**
   * Get relayer address
   * @returns Address or undefined if not configured
   */
  public getAddress(): string | undefined {
    return this.account?.address;
  }
}

// Export singleton instance
export const relayerConfig = new RelayerConfig();
