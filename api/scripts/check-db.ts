#!/usr/bin/env tsx
/**
 * Quick Database Health Check
 * 
 * Usage: pnpm tsx api/scripts/check-db.ts
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: 'api/.env' });

const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('🔍 ONYX Protocol - Database Health Check\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not configured');
    process.exit(1);
  }

  try {
    // Test connection
    console.log('Testing database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful\n');

    // Check tables exist
    console.log('Checking database schema...');
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    
    if (tables.length === 0) {
      console.log('⚠️  No tables found. Run migrations first:');
      console.log('   cd api && npx prisma migrate dev\n');
    } else {
      console.log(`✅ Found ${tables.length} tables\n`);
      
      // Display counts
      console.log('📊 Record Counts:');
      const [users, orders, alerts, chains] = await Promise.all([
        prisma.user.count().catch(() => 0),
        prisma.order.count().catch(() => 0),
        prisma.alert.count().catch(() => 0),
        prisma.chainConfig.count().catch(() => 0),
      ]);

      console.log(`   Users: ${users}`);
      console.log(`   Orders: ${orders}`);
      console.log(`   Alerts: ${alerts}`);
      console.log(`   Chain Configs: ${chains}\n`);

      if (chains === 0) {
        console.log('💡 Tip: Seed initial data with:');
        console.log('   pnpm tsx api/scripts/init-db.ts\n');
      }
    }

    console.log('✅ Database is healthy and ready!');
  } catch (error) {
    console.error('❌ Database check failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
