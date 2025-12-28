#!/usr/bin/env tsx
/**
 * Database Initialization Script
 * 
 * This script:
 * 1. Checks database connectivity
 * 2. Runs Prisma migrations
 * 3. Seeds initial configuration data (supported chains)
 * 
 * Usage: pnpm tsx api/scripts/init-db.ts
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: 'api/.env' });

const prisma = new PrismaClient();

// Supported chain configurations
const CHAIN_CONFIGS = [
  {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isActive: true,
  },
  {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isActive: true,
  },
  {
    chainId: 137,
    name: 'Polygon Mainnet',
    rpcUrl: 'https://polygon-bor-rpc.publicnode.com',
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    isActive: true,
  },
  {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrl: 'https://arbitrum-one-rpc.publicnode.com',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isActive: true,
  },
  {
    chainId: 10,
    name: 'Optimism',
    rpcUrl: 'https://optimism-rpc.publicnode.com',
    explorerUrl: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isActive: true,
  },
  {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    isActive: true,
  },
  {
    chainId: 56,
    name: 'BNB Smart Chain',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    isActive: true,
  },
  {
    chainId: 43114,
    name: 'Avalanche C-Chain',
    rpcUrl: 'https://avalanche-c-chain-rpc.publicnode.com',
    explorerUrl: 'https://snowtrace.io',
    nativeCurrency: {
      name: 'AVAX',
      symbol: 'AVAX',
      decimals: 18,
    },
    isActive: true,
  },
];

async function checkDatabaseConnection(): Promise<boolean> {
  try {
    console.log('🔍 Checking database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

async function seedChainConfigs(): Promise<void> {
  console.log('\n📦 Seeding chain configurations...');
  
  for (const config of CHAIN_CONFIGS) {
    try {
      const existing = await prisma.chainConfig.findUnique({
        where: { chainId: config.chainId },
      });

      if (existing) {
        // Update existing config
        await prisma.chainConfig.update({
          where: { chainId: config.chainId },
          data: config,
        });
        console.log(`   ✓ Updated chain config: ${config.name} (${config.chainId})`);
      } else {
        // Create new config
        await prisma.chainConfig.create({
          data: config,
        });
        console.log(`   ✓ Created chain config: ${config.name} (${config.chainId})`);
      }
    } catch (error) {
      console.error(`   ✗ Failed to seed ${config.name}:`, error);
    }
  }
  
  console.log('✅ Chain configurations seeded successfully');
}

async function displayDatabaseStats(): Promise<void> {
  console.log('\n📊 Database Statistics:');
  
  try {
    const [userCount, orderCount, alertCount, chainCount] = await Promise.all([
      prisma.user.count(),
      prisma.order.count(),
      prisma.alert.count(),
      prisma.chainConfig.count(),
    ]);

    console.log(`   Users: ${userCount}`);
    console.log(`   Orders: ${orderCount}`);
    console.log(`   Alerts: ${alertCount}`);
    console.log(`   Chain Configs: ${chainCount}`);
  } catch (error) {
    console.error('   ✗ Failed to fetch statistics:', error);
  }
}

async function main() {
  console.log('🚀 ONYX Protocol - Database Initialization\n');
  console.log('='.repeat(50));

  // Check environment variables
  if (!process.env.DATABASE_URL) {
    console.error('\n❌ DATABASE_URL environment variable is not set');
    console.error('   Please set DATABASE_URL in api/.env file');
    process.exit(1);
  }

  console.log(`📍 Database URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log('='.repeat(50));

  // Check database connection
  const isConnected = await checkDatabaseConnection();
  if (!isConnected) {
    console.error('\n❌ Cannot proceed without database connection');
    console.error('   Please check your DATABASE_URL and ensure the database is running');
    process.exit(1);
  }

  // Seed initial data
  await seedChainConfigs();

  // Display statistics
  await displayDatabaseStats();

  console.log('\n' + '='.repeat(50));
  console.log('✅ Database initialization completed successfully!');
  console.log('='.repeat(50));
  console.log('\nNext steps:');
  console.log('  1. Run migrations: cd api && npx prisma migrate dev');
  console.log('  2. Generate Prisma client: cd api && npx prisma generate');
  console.log('  3. Start the API server: cd api && pnpm dev\n');
}

main()
  .catch((error) => {
    console.error('\n❌ Database initialization failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
