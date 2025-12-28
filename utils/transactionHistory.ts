/**
 * Transaction History Utility
 * Manages transaction history persistence using localStorage
 */

export interface Transaction {
  hash: string;
  type: 'swap' | 'add_liquidity' | 'remove_liquidity' | 'flash_swap';
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  fromToken?: string;
  toToken?: string;
  fromAmount?: string;
  toAmount?: string;
  chainId: number;
}

const STORAGE_KEY = 'dex_transaction_history';
const MAX_TRANSACTIONS = 100; // Keep last 100 transactions

/**
 * Get all transactions from localStorage
 */
export function getTransactionHistory(): Transaction[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const transactions = JSON.parse(stored) as Transaction[];
    return Array.isArray(transactions) ? transactions : [];
  } catch (error) {
    console.error('Failed to load transaction history:', error);
    return [];
  }
}

/**
 * Add a new transaction to history
 */
export function addTransaction(transaction: Transaction): void {
  try {
    const history = getTransactionHistory();
    
    // Add new transaction at the beginning
    history.unshift(transaction);
    
    // Keep only the most recent transactions
    const trimmed = history.slice(0, MAX_TRANSACTIONS);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to save transaction:', error);
  }
}

/**
 * Update transaction status
 */
export function updateTransactionStatus(
  hash: string,
  status: Transaction['status']
): void {
  try {
    const history = getTransactionHistory();
    const index = history.findIndex(tx => tx.hash === hash);
    
    if (index !== -1) {
      history[index].status = status;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }
  } catch (error) {
    console.error('Failed to update transaction status:', error);
  }
}

/**
 * Get transactions for a specific chain
 */
export function getTransactionsByChain(chainId: number): Transaction[] {
  const history = getTransactionHistory();
  return history.filter(tx => tx.chainId === chainId);
}

/**
 * Get transactions by type
 */
export function getTransactionsByType(type: Transaction['type']): Transaction[] {
  const history = getTransactionHistory();
  return history.filter(tx => tx.type === type);
}

/**
 * Clear all transaction history
 */
export function clearTransactionHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear transaction history:', error);
  }
}

/**
 * Get pending transactions
 */
export function getPendingTransactions(): Transaction[] {
  const history = getTransactionHistory();
  return history.filter(tx => tx.status === 'pending');
}

/**
 * Remove old transactions (older than 30 days)
 */
export function cleanupOldTransactions(): void {
  try {
    const history = getTransactionHistory();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    const filtered = history.filter(tx => tx.timestamp > thirtyDaysAgo);
    
    if (filtered.length !== history.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error('Failed to cleanup old transactions:', error);
  }
}
