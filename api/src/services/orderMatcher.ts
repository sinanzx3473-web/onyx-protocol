import { PrismaClient } from '@prisma/client';
// import { createPublicClient, http } from 'viem';
// import { sepolia } from 'viem/chains';

const prisma = new PrismaClient();

// Create a public client for reading on-chain prices (for future use)
// const publicClient = createPublicClient({
//   chain: sepolia,
//   transport: http(),
// });

interface PriceData {
  fromToken: string;
  toToken: string;
  price: string; // toToken per fromToken
  timestamp: number;
}

// Cache for current prices
const priceCache = new Map<string, PriceData>();
const PRICE_CACHE_TTL = 10000; // 10 seconds

/**
 * Get current market price for a token pair
 * In production, this would query DEX pools or price oracles
 */
async function getCurrentPrice(fromToken: string, toToken: string): Promise<string | null> {
  const cacheKey = `${fromToken}-${toToken}`;
  const cached = priceCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
    return cached.price;
  }

  try {
    // Query the quote API for current price
    const response = await fetch(`http://localhost:3001/api/quote?fromToken=${fromToken}&toToken=${toToken}&amount=1000000000000000000`);
    
    if (!response.ok) {
      console.error('Failed to fetch price from quote API');
      return null;
    }

    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      return null;
    }

    // Get best route price
    const bestRoute = data.routes[0];
    const price = (parseFloat(bestRoute.expectedOutput) / parseFloat('1')).toString();

    // Cache the price
    priceCache.set(cacheKey, {
      fromToken,
      toToken,
      price,
      timestamp: Date.now(),
    });

    return price;
  } catch (error) {
    console.error('Error fetching current price:', error);
    return null;
  }
}

/**
 * Check if a limit order should be executed
 */
function shouldExecuteLimitOrder(currentPrice: string, targetPrice: string, orderType: string): boolean {
  const current = parseFloat(currentPrice);
  const target = parseFloat(targetPrice);

  if (orderType === 'limit') {
    // Limit order: execute when price reaches or exceeds target
    return current >= target;
  } else if (orderType === 'stop') {
    // Stop order: execute when price drops to or below target
    return current <= target;
  }

  return false;
}

/**
 * Execute a limit order by calling the DEX contract
 * In production, this would use a relay service with gas sponsorship
 */
async function executeOrder(order: any): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    console.log(`Executing order ${order.id} for user ${order.userAddress}`);
    
    // Use database transaction with serializable isolation to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Lock the order by updating status to 'executing'
      const lockedOrder = await tx.limitOrder.updateMany({
        where: {
          id: order.id,
          status: 'open', // Only lock if still open
        },
        data: {
          status: 'executing',
          updatedAt: new Date(),
        },
      });

      // If no rows updated, order was already locked/filled by another process
      if (lockedOrder.count === 0) {
        throw new Error('Order already being processed or no longer open');
      }

      // In a real implementation:
      // 1. Verify the user's signature
      // 2. Check token allowances
      // 3. Execute the swap via relay contract
      // 4. Return transaction hash
      
      // For now, simulate execution
      const mockTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
      
      return mockTxHash;
    }, {
      isolationLevel: 'Serializable', // Prevent race conditions
    });
    
    return {
      success: true,
      txHash: result,
    };
  } catch (error) {
    console.error(`Error executing order ${order.id}:`, error);
    
    // Rollback order status if execution failed
    try {
      await prisma.limitOrder.updateMany({
        where: {
          id: order.id,
          status: 'executing',
        },
        data: {
          status: 'open',
          updatedAt: new Date(),
        },
      });
    } catch (rollbackError) {
      console.error(`Failed to rollback order ${order.id}:`, rollbackError);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Main matching loop - checks all open orders and executes when conditions are met
 */
export async function matchOrders(): Promise<void> {
  try {
    // Get all open orders that haven't expired
    const openOrders = await prisma.limitOrder.findMany({
      where: {
        status: 'open',
        expiryTime: { gt: new Date() },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Checking ${openOrders.length} open orders...`);

    for (const order of openOrders) {
      try {
        // Get current market price
        const currentPrice = await getCurrentPrice(order.fromToken, order.toToken);

        if (!currentPrice) {
          console.log(`Could not fetch price for ${order.fromToken}/${order.toToken}`);
          continue;
        }

        // Check if order should be executed
        if (shouldExecuteLimitOrder(currentPrice, order.targetPrice, order.orderType)) {
          console.log(`Order ${order.id} conditions met! Current: ${currentPrice}, Target: ${order.targetPrice}`);

          // Execute the order
          const result = await executeOrder(order);

          if (result.success && result.txHash) {
            // Calculate filled amount (in production, get from transaction receipt)
            const filledAmount = order.minReceived;

            // Update order status
            await prisma.limitOrder.update({
              where: { id: order.id },
              data: {
                status: 'filled',
                filledAt: new Date(),
                txHash: result.txHash,
                filledAmount,
                updatedAt: new Date(),
              },
            });

            console.log(`✓ Order ${order.id} filled successfully. TX: ${result.txHash}`);
          } else {
            console.error(`✗ Failed to execute order ${order.id}:`, result.error);
          }
        }
      } catch (error) {
        console.error(`Error processing order ${order.id}:`, error);
      }
    }

    // Expire old orders
    const expireResult = await prisma.limitOrder.updateMany({
      where: {
        status: 'open',
        expiryTime: { lte: new Date() },
      },
      data: {
        status: 'expired',
        updatedAt: new Date(),
      },
    });

    if (expireResult.count > 0) {
      console.log(`Expired ${expireResult.count} orders`);
    }
  } catch (error) {
    console.error('Error in order matching loop:', error);
  }
}

/**
 * Start the order matching service
 */
export function startOrderMatcher(intervalMs: number = 5000): NodeJS.Timeout {
  console.log(`Starting order matcher with ${intervalMs}ms interval`);
  
  // Run immediately
  matchOrders();
  
  // Then run on interval
  return setInterval(matchOrders, intervalMs);
}
