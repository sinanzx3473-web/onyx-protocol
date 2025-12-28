# Disaster Recovery Plan

## Overview

This document outlines disaster recovery procedures for the ONYX DEX Protocol. It covers catastrophic failures across smart contracts, backend infrastructure, and frontend applications.

**Recovery Time Objective (RTO)**: 4 hours  
**Recovery Point Objective (RPO)**: 1 hour

## Table of Contents

1. [Database Disaster Recovery](#database-disaster-recovery)
2. [Frontend Disaster Recovery](#frontend-disaster-recovery)
3. [Smart Contract Disaster Recovery](#smart-contract-disaster-recovery)
4. [Infrastructure Disaster Recovery](#infrastructure-disaster-recovery)
5. [Data Backup Strategy](#data-backup-strategy)
6. [Recovery Testing](#recovery-testing)

---

## Database Disaster Recovery

### Backup Strategy

**Automated Backups**:
- **Frequency**: Every 6 hours
- **Retention**: 30 days
- **Location**: AWS S3 (encrypted at rest)
- **Type**: Full database dump + WAL archives

**Backup Verification**:
- Daily automated restore test to staging environment
- Weekly manual verification of backup integrity

### Scenario 1: Database Corruption

**Detection**:
```bash
# Check database integrity
psql $DATABASE_URL -c "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) FROM pg_database;"

# Check for corruption
psql $DATABASE_URL -c "SELECT * FROM pg_stat_database WHERE datname = 'onyx_dex';"
```

**Recovery Steps**:

1. **Stop All Services**
   ```bash
   # Stop API server
   cd api
   pnpm stop
   
   # Verify no active connections
   psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE datname = 'onyx_dex';"
   ```

2. **Restore from Latest Backup**
   ```bash
   # Download latest backup from S3
   aws s3 cp s3://onyx-backups/postgres/latest.dump /tmp/restore.dump
   
   # Drop existing database (CAUTION!)
   dropdb onyx_dex
   
   # Create fresh database
   createdb onyx_dex
   
   # Restore from backup
   pg_restore -d onyx_dex -v /tmp/restore.dump
   
   # Verify restoration
   psql onyx_dex -c "SELECT COUNT(*) FROM pools;"
   psql onyx_dex -c "SELECT COUNT(*) FROM trades;"
   ```

3. **Apply WAL Archives (Point-in-Time Recovery)**
   ```bash
   # If you need to recover to specific timestamp
   # Restore base backup first, then apply WAL files
   
   # Set recovery target
   echo "recovery_target_time = '2025-12-02 12:00:00'" >> /var/lib/postgresql/data/recovery.conf
   
   # Restart PostgreSQL to apply WAL
   systemctl restart postgresql
   
   # Verify recovery point
   psql onyx_dex -c "SELECT pg_last_wal_replay_lsn();"
   ```

4. **Restart Services**
   ```bash
   cd api
   pnpm start
   
   # Verify API health
   curl https://api.onyx.io/api/health
   ```

**Estimated Recovery Time**: 30-60 minutes

### Scenario 2: Complete Database Loss

**Recovery Steps**:

1. **Provision New Database Instance**
   ```bash
   # Using managed PostgreSQL (e.g., AWS RDS)
   aws rds create-db-instance \
     --db-instance-identifier onyx-dex-recovery \
     --db-instance-class db.t3.large \
     --engine postgres \
     --master-username admin \
     --master-user-password $SECURE_PASSWORD \
     --allocated-storage 100
   
   # Wait for instance to be available
   aws rds wait db-instance-available --db-instance-identifier onyx-dex-recovery
   ```

2. **Restore from S3 Backup**
   ```bash
   # Get new database endpoint
   NEW_DB_URL=$(aws rds describe-db-instances \
     --db-instance-identifier onyx-dex-recovery \
     --query 'DBInstances[0].Endpoint.Address' \
     --output text)
   
   # Download and restore backup
   aws s3 cp s3://onyx-backups/postgres/latest.dump /tmp/restore.dump
   pg_restore -h $NEW_DB_URL -U admin -d onyx_dex -v /tmp/restore.dump
   ```

3. **Update Application Configuration**
   ```bash
   # Update environment variables
   export DATABASE_URL="postgresql://admin:$PASSWORD@$NEW_DB_URL:5432/onyx_dex"
   
   # Update API configuration
   cd api
   echo "DATABASE_URL=$DATABASE_URL" >> .env
   
   # Restart services
   pnpm restart
   ```

**Estimated Recovery Time**: 2-4 hours

---

## Frontend Disaster Recovery

### Backup Strategy

**Deployment History**:
- Vercel maintains automatic deployment history
- Git repository serves as source of truth
- CDN caching provides redundancy

### Scenario 1: Broken Production Deployment

**Detection**:
```bash
# Check deployment status
vercel ls

# Check build logs
vercel logs <deployment-url>

# Monitor error rates
curl https://api.onyx.io/api/monitoring/errors
```

**Recovery Steps**:

1. **Immediate Rollback**
   ```bash
   # List recent deployments
   vercel ls --prod
   
   # Rollback to previous working deployment
   vercel rollback <previous-deployment-url>
   
   # Verify rollback
   curl -I https://app.onyx.io
   ```

2. **Alternative: Deploy from Last Known Good Commit**
   ```bash
   # Find last working commit
   git log --oneline -10
   
   # Checkout last good commit
   git checkout <commit-hash>
   
   # Deploy to production
   pnpm build
   vercel --prod
   
   # Verify deployment
   curl https://app.onyx.io/api/health
   ```

**Estimated Recovery Time**: 5-10 minutes

### Scenario 2: CDN/Hosting Provider Outage

**Recovery Steps**:

1. **Deploy to Backup Hosting (Netlify)**
   ```bash
   # Install Netlify CLI
   npm install -g netlify-cli
   
   # Login to Netlify
   netlify login
   
   # Deploy to Netlify
   pnpm build
   netlify deploy --prod --dir=dist
   
   # Update DNS to point to Netlify
   # app.onyx.io -> netlify-deployment-url
   ```

2. **Update DNS Records**
   ```bash
   # Using Cloudflare API
   curl -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{
       "type": "CNAME",
       "name": "app",
       "content": "backup-deployment.netlify.app",
       "ttl": 120,
       "proxied": true
     }'
   ```

**Estimated Recovery Time**: 15-30 minutes

### Scenario 3: Complete Repository Loss

**Recovery Steps**:

1. **Restore from Git Backup**
   ```bash
   # Clone from backup mirror (GitHub -> GitLab mirror)
   git clone https://gitlab.com/onyx-dex/frontend-backup.git
   cd frontend-backup
   
   # Verify integrity
   git log --oneline -10
   git status
   
   # Push to new primary repository
   git remote add origin https://github.com/onyx-dex/frontend-new.git
   git push -u origin main
   ```

2. **Redeploy Application**
   ```bash
   # Install dependencies
   pnpm install
   
   # Build and deploy
   pnpm build
   vercel --prod
   ```

**Estimated Recovery Time**: 30-60 minutes

---

## Smart Contract Disaster Recovery

### Backup Strategy

**Immutability Considerations**:
- Smart contracts are immutable once deployed
- Recovery requires deploying new contracts or using upgrade mechanisms
- All contract code is version controlled and verified on Etherscan

### Scenario 1: Critical Vulnerability Discovered

**Recovery Steps**:

1. **Immediate Pause**
   ```bash
   # Pause all affected contracts
   cd contracts
   
   cast send $DEXCORE_ADDRESS "schedulePause()" \
     --private-key $PAUSER_KEY \
     --rpc-url $RPC_URL
   
   cast send $DEXCORE_ADDRESS "pause()" \
     --private-key $PAUSER_KEY \
     --rpc-url $RPC_URL
   ```

2. **Emergency Fund Withdrawal (If Necessary)**
   ```bash
   # Only callable when paused
   cast send $DEXCORE_ADDRESS \
     "emergencyWithdraw(address,uint256,address)" \
     $TOKEN_ADDRESS \
     $(cast call $TOKEN_ADDRESS "balanceOf(address)(uint256)" $DEXCORE_ADDRESS) \
     $SECURE_MULTISIG \
     --private-key $ADMIN_KEY \
     --rpc-url $RPC_URL
   ```

3. **Deploy Fixed Contracts**
   ```bash
   # Deploy new implementation
   forge script script/Deploy.s.sol:DeployScript \
     --rpc-url $RPC_URL \
     --broadcast \
     --verify
   
   # Record new addresses
   echo "New DexCore: $(cat broadcast/Deploy.s.sol/1/run-latest.json | jq -r '.transactions[0].contractAddress')"
   ```

4. **Migrate Liquidity (If Using Proxy Pattern)**
   ```bash
   # If using UUPS or Transparent Proxy
   cast send $PROXY_ADMIN \
     "upgrade(address,address)" \
     $PROXY_ADDRESS \
     $NEW_IMPLEMENTATION \
     --private-key $ADMIN_KEY \
     --rpc-url $RPC_URL
   
   # Verify upgrade
   cast call $PROXY_ADDRESS "implementation()(address)" --rpc-url $RPC_URL
   ```

5. **Manual Migration (If No Proxy)**
   ```solidity
   // Users must manually migrate liquidity
   // 1. Remove liquidity from old contract
   // 2. Add liquidity to new contract
   
   // Provide migration UI and incentives
   ```

**Estimated Recovery Time**: 4-24 hours (depending on migration complexity)

### Scenario 2: Governance Timelock Compromise

**Recovery Steps**:

1. **Deploy New Timelock**
   ```bash
   cd contracts
   
   # Deploy new GovernanceTimelock
   forge create src/GovernanceTimelock.sol:GovernanceTimelock \
     --constructor-args 172800 $NEW_ADMIN_ADDRESS \
     --rpc-url $RPC_URL \
     --private-key $DEPLOYER_KEY \
     --verify
   ```

2. **Transfer Ownership**
   ```bash
   # Transfer admin roles to new timelock
   cast send $DEXCORE_ADDRESS \
     "grantRole(bytes32,address)" \
     $(cast keccak "GOVERNANCE_ROLE") \
     $NEW_TIMELOCK_ADDRESS \
     --private-key $CURRENT_ADMIN_KEY
   
   # Revoke old timelock
   cast send $DEXCORE_ADDRESS \
     "revokeRole(bytes32,address)" \
     $(cast keccak "GOVERNANCE_ROLE") \
     $OLD_TIMELOCK_ADDRESS \
     --private-key $CURRENT_ADMIN_KEY
   ```

3. **Update Frontend Configuration**
   ```typescript
   // src/utils/evmConfig.ts
   export const GOVERNANCE_TIMELOCK = "0x..."; // New address
   ```

**Estimated Recovery Time**: 2-4 hours

### Scenario 3: Oracle Manipulation

**Recovery Steps**:

1. **Pause Trading**
   ```bash
   cast send $DEXCORE_ADDRESS "pause()" \
     --private-key $PAUSER_KEY \
     --rpc-url $RPC_URL
   ```

2. **Deploy New Oracle**
   ```bash
   forge create src/PriceOracle.sol:PriceOracle \
     --rpc-url $RPC_URL \
     --private-key $DEPLOYER_KEY \
     --verify
   ```

3. **Update Oracle Reference**
   ```bash
   # If oracle is upgradeable
   cast send $DEXCORE_ADDRESS \
     "setOracle(address)" \
     $NEW_ORACLE_ADDRESS \
     --private-key $ADMIN_KEY \
     --rpc-url $RPC_URL
   ```

4. **Resume Trading**
   ```bash
   cast send $DEXCORE_ADDRESS "unpause()" \
     --private-key $PAUSER_KEY \
     --rpc-url $RPC_URL
   ```

**Estimated Recovery Time**: 1-2 hours

---

## Infrastructure Disaster Recovery

### Scenario 1: API Server Outage

**Recovery Steps**:

1. **Check Service Health**
   ```bash
   # Check process status
   pm2 status
   
   # Check logs
   pm2 logs api --lines 100
   
   # Check system resources
   top
   df -h
   ```

2. **Restart Services**
   ```bash
   cd api
   
   # Restart with PM2
   pm2 restart api
   
   # Or restart manually
   pnpm stop
   pnpm start
   ```

3. **Deploy to Backup Server**
   ```bash
   # SSH to backup server
   ssh backup-api.onyx.io
   
   # Pull latest code
   cd /opt/onyx-api
   git pull origin main
   
   # Install dependencies and start
   pnpm install
   pnpm build
   pnpm start
   
   # Update load balancer to point to backup
   ```

**Estimated Recovery Time**: 15-30 minutes

### Scenario 2: RPC Provider Failure

**Recovery Steps**:

1. **Switch to Backup RPC**
   ```bash
   # Update environment variables
   export RPC_URL="https://backup-rpc-provider.com/api-key"
   
   # Update frontend configuration
   # src/utils/evmConfig.ts
   export const RPC_URLS = {
     mainnet: "https://backup-rpc-provider.com/api-key",
     // ...
   };
   
   # Redeploy frontend
   pnpm build
   vercel --prod
   ```

2. **Configure Automatic Failover**
   ```typescript
   // Implement RPC fallback logic
   const providers = [
     "https://primary-rpc.com",
     "https://backup-rpc-1.com",
     "https://backup-rpc-2.com",
   ];
   
   async function getProvider() {
     for (const url of providers) {
       try {
         const provider = new ethers.JsonRpcProvider(url);
         await provider.getBlockNumber(); // Health check
         return provider;
       } catch (error) {
         console.warn(`RPC ${url} failed, trying next...`);
       }
     }
     throw new Error("All RPC providers failed");
   }
   ```

**Estimated Recovery Time**: 10-20 minutes

### Scenario 3: Redis Cache Failure

**Recovery Steps**:

1. **Verify Redis Status**
   ```bash
   # Check Redis connection
   redis-cli ping
   
   # Check memory usage
   redis-cli info memory
   
   # Check for errors
   redis-cli info stats
   ```

2. **Restart Redis**
   ```bash
   # Restart Redis service
   systemctl restart redis
   
   # Verify restart
   redis-cli ping
   ```

3. **Restore from RDB Snapshot**
   ```bash
   # Stop Redis
   systemctl stop redis
   
   # Restore from backup
   cp /backup/redis/dump.rdb /var/lib/redis/dump.rdb
   
   # Start Redis
   systemctl start redis
   ```

4. **Fallback to In-Memory Rate Limiting**
   ```typescript
   // api/src/middleware/rateLimiter.ts
   // If Redis fails, rate limiting automatically falls back to in-memory store
   // No action needed - already implemented
   ```

**Estimated Recovery Time**: 5-15 minutes

---

## Data Backup Strategy

### Automated Backup Schedule

| Component | Frequency | Retention | Location | Encryption |
|-----------|-----------|-----------|----------|------------|
| PostgreSQL Database | Every 6 hours | 30 days | AWS S3 | AES-256 |
| PostgreSQL WAL | Continuous | 7 days | AWS S3 | AES-256 |
| Redis RDB | Daily | 7 days | AWS S3 | AES-256 |
| Git Repositories | Real-time | Indefinite | GitHub + GitLab | N/A |
| Environment Configs | Weekly | 90 days | AWS Secrets Manager | AES-256 |
| Smart Contract ABIs | On deployment | Indefinite | GitHub + IPFS | N/A |

### Backup Verification

**Daily Automated Tests**:
```bash
#!/bin/bash
# /opt/scripts/verify-backups.sh

# Test database backup
aws s3 cp s3://onyx-backups/postgres/latest.dump /tmp/test-restore.dump
pg_restore --list /tmp/test-restore.dump > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Database backup valid"
else
  echo "❌ Database backup corrupted"
  # Send alert
fi

# Test Redis backup
aws s3 cp s3://onyx-backups/redis/dump.rdb /tmp/test-redis.rdb
redis-check-rdb /tmp/test-redis.rdb
if [ $? -eq 0 ]; then
  echo "✅ Redis backup valid"
else
  echo "❌ Redis backup corrupted"
fi
```

### Backup Restoration Testing

**Monthly Drill**:
1. Restore database to staging environment
2. Restore Redis cache to staging
3. Deploy frontend to staging
4. Run integration tests
5. Verify data integrity
6. Document any issues

---

## Recovery Testing

### Quarterly Disaster Recovery Drills

**Q1: Database Failure Simulation**
- Simulate database corruption
- Practice restoration from backup
- Measure actual RTO/RPO
- Update procedures based on findings

**Q2: Smart Contract Emergency**
- Simulate critical vulnerability
- Practice emergency pause
- Test fund withdrawal procedures
- Verify communication protocols

**Q3: Infrastructure Failure**
- Simulate complete server outage
- Practice failover to backup infrastructure
- Test DNS updates
- Verify monitoring alerts

**Q4: Full System Disaster**
- Simulate complete system failure
- Practice full recovery from backups
- Test all recovery procedures
- Conduct post-drill review

### Recovery Metrics

**Target Metrics**:
- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour
- **Backup Success Rate**: 99.9%
- **Restoration Success Rate**: 100%

**Actual Metrics** (Updated Quarterly):
- Last successful backup: [Timestamp]
- Last successful restoration test: [Timestamp]
- Average recovery time: [Duration]
- Backup failures (last 90 days): [Count]

---

## Emergency Contacts

### Infrastructure Team
- **DevOps Lead**: [Name] - [Phone] - [Email]
- **Database Admin**: [Name] - [Phone] - [Email]
- **Security Engineer**: [Name] - [Phone] - [Email]

### Service Providers
- **AWS Support**: 1-800-XXX-XXXX (Enterprise Support)
- **Vercel Support**: support@vercel.com
- **Alchemy Support**: support@alchemy.com
- **Cloudflare Support**: 1-888-XXX-XXXX

### Backup Locations
- **Primary Database Backups**: s3://onyx-backups/postgres/
- **Redis Backups**: s3://onyx-backups/redis/
- **Configuration Backups**: AWS Secrets Manager
- **Code Repository Mirror**: https://gitlab.com/onyx-dex/

---

## Appendix

### A. Recovery Checklist

**Pre-Recovery**:
- [ ] Incident severity assessed
- [ ] Incident Commander assigned
- [ ] Recovery team assembled
- [ ] Stakeholders notified
- [ ] Backup integrity verified

**During Recovery**:
- [ ] Services stopped (if required)
- [ ] Backup restoration initiated
- [ ] Progress monitored and logged
- [ ] Stakeholders updated every 30 minutes
- [ ] Recovery steps documented

**Post-Recovery**:
- [ ] Services verified operational
- [ ] Data integrity confirmed
- [ ] Monitoring alerts reviewed
- [ ] Post-mortem scheduled
- [ ] Procedures updated

### B. Useful Recovery Commands

```bash
# Database
pg_dump $DATABASE_URL > backup.sql
pg_restore -d $DATABASE_URL backup.sql
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('onyx_dex'));"

# Redis
redis-cli BGSAVE
redis-cli LASTSAVE
redis-cli --rdb /backup/dump.rdb

# Git
git clone --mirror https://github.com/onyx-dex/frontend.git
git bundle create repo.bundle --all

# AWS S3
aws s3 sync /local/backup s3://onyx-backups/
aws s3 cp s3://onyx-backups/latest.dump /tmp/restore.dump

# Vercel
vercel ls --prod
vercel rollback <deployment-url>
vercel logs <deployment-url>

# Smart Contracts
cast call $CONTRACT "paused()(bool)" --rpc-url $RPC_URL
cast send $CONTRACT "pause()" --private-key $KEY --rpc-url $RPC_URL
forge verify-contract $ADDRESS $CONTRACT --chain-id 1
```

---

**Last Updated**: 2025-12-02  
**Version**: 1.0  
**Owner**: Infrastructure Team  
**Review Cycle**: Quarterly  
**Next Drill**: 2025-03-01
