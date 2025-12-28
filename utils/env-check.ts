/**
 * Environment Variable Validation
 * 
 * Validates critical environment variables on app startup.
 * Logs critical errors to console if required variables are missing.
 */

interface EnvConfig {
  VITE_WALLETCONNECT_PROJECT_ID?: string;
  VITE_CHAIN?: string;
}

/**
 * Validates required environment variables
 * @returns true if all required variables are present, false otherwise
 */
export function validateEnvironment(): boolean {
  const env: EnvConfig = {
    VITE_WALLETCONNECT_PROJECT_ID: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
    VITE_CHAIN: import.meta.env.VITE_CHAIN,
  };

  const errors: string[] = [];

  // Check VITE_WALLETCONNECT_PROJECT_ID
  if (!env.VITE_WALLETCONNECT_PROJECT_ID) {
    errors.push('VITE_WALLETCONNECT_PROJECT_ID is not set');
  }

  // Check VITE_CHAIN
  if (!env.VITE_CHAIN) {
    errors.push('VITE_CHAIN is not set');
  }

  // Log errors if any
  if (errors.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables:');
    errors.forEach(error => console.error(`  - ${error}`));
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    console.error('See .env.example for reference.');
    return false;
  }

  console.log('✅ Environment validation passed');
  return true;
}
