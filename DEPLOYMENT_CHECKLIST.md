# ONYX Protocol - Production Deployment Checklist

## Pre-Deployment Verification

### 1. Code Quality ✅
- [x] All TypeScript errors resolved
- [x] ESLint checks passing
- [x] Build completes successfully
- [x] No console errors in development
- [x] Code review completed

### 2. Security ✅
- [x] Environment variables validated
- [x] No secrets in client-side code
- [x] CORS whitelist configured
- [x] Rate limiting enabled
- [x] Helmet security headers active
- [x] CSP policy configured
- [ ] Security audit completed
- [ ] Penetration testing done

### 3. Monitoring & Observability ✅
- [x] Sentry configured (frontend & backend)
- [x] Prometheus metrics endpoint active
- [x] Winston logging configured
- [x] Correlation IDs implemented
- [x] Web Vitals tracking enabled
- [ ] Grafana dashboards created
- [ ] Alert rules configured

### 4. API Documentation ✅
- [x] Swagger UI accessible
- [x] All endpoints documented
- [x] Request/response schemas defined
- [x] Authentication documented

### 5. Performance ✅
- [x] Frontend bundle optimized
- [x] Code splitting implemented
- [x] Lazy loading configured
- [x] Compression enabled (gzip/brotli)
- [x] Cache-Control headers set
- [x] Database queries optimized
- [ ] CDN configured
- [ ] Image optimization

### 6. Testing ✅
- [x] Unit tests written
- [x] Integration tests passing
- [x] Load testing completed
- [x] Stress testing done
- [ ] E2E tests passing
- [ ] Cross-browser testing

### 7. CI/CD ✅
- [x] GitHub Actions workflows configured
- [x] Automated testing on PR
- [x] Contract deployment workflow
- [x] Dependency review enabled
- [x] Lighthouse CI configured

### 8. Database
- [ ] Production database provisioned
- [ ] Migrations tested
- [ ] Backup strategy configured
- [ ] Connection pooling optimized
- [ ] Indexes created
- [ ] Data retention policy defined

### 9. Infrastructure
- [ ] Production servers provisioned
- [ ] Load balancer configured
- [ ] SSL certificates installed
- [ ] DNS records configured
- [ ] Firewall rules set
- [ ] Auto-scaling configured

### 10. Smart Contracts
- [ ] Contracts audited
- [ ] Contracts deployed to mainnet
- [ ] Contract addresses updated in config
- [ ] Gas optimization verified
- [ ] Emergency pause mechanism tested

## Environment Configuration

### Required Environment Variables

#### Frontend (.env.production)
```bash
VITE_API_URL=https://api.onyx.protocol
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SENTRY_DSN=your-sentry-dsn
VITE_SENTRY_ENVIRONMENT=production
VITE_CONTRACT_ADDRESS=0x...
VITE_CHAIN_ID=1
VITE_RPC_URL=https://mainnet.infura.io/v3/your-key
```

#### Backend (.env.production)
```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
SENTRY_DSN=your-backend-sentry-dsn
JWT_SECRET=your-secure-secret
CORS_ORIGIN=https://onyx.protocol
RPC_URL=https://mainnet.infura.io/v3/your-key
PRIVATE_KEY=your-private-key
```

## Deployment Steps

### 1. Pre-Deployment
```bash
# 1. Create production branch
git checkout -b production
git push origin production

# 2. Update version
npm version patch  # or minor/major

# 3. Build frontend
pnpm run build

# 4. Run final tests
pnpm test
pnpm run test:e2e

# 5. Run verification
./verify.sh
```

### 2. Database Migration
```bash
# 1. Backup production database
pg_dump -h host -U user -d db > backup.sql

# 2. Run migrations
cd api
pnpm prisma migrate deploy

# 3. Verify migration
pnpm prisma migrate status
```

### 3. Backend Deployment
```bash
# 1. SSH to production server
ssh user@backend-server

# 2. Pull latest code
cd /var/www/onyx-api
git pull origin production

# 3. Install dependencies
pnpm install --production

# 4. Build
pnpm run build

# 5. Restart service
pm2 restart onyx-api
pm2 save

# 6. Check logs
pm2 logs onyx-api
```

### 4. Frontend Deployment
```bash
# 1. Build with production env
pnpm run build

# 2. Upload to CDN/hosting
# For Vercel:
vercel --prod

# For AWS S3:
aws s3 sync dist/ s3://your-bucket --delete

# For Netlify:
netlify deploy --prod
```

### 5. Smart Contract Deployment
```bash
# 1. Deploy contracts
cd contracts
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify

# 2. Update contract addresses
# Update src/config/contracts.ts with new addresses

# 3. Verify on Etherscan
forge verify-contract <address> <contract> --chain-id 1
```

## Post-Deployment Verification

### 1. Smoke Tests
```bash
# Health check
curl https://api.onyx.protocol/api/health

# Metrics endpoint
curl https://api.onyx.protocol/metrics

# API docs
curl https://api.onyx.protocol/api-docs/

# Frontend
curl -I https://onyx.protocol
```

### 2. Monitoring Setup
- [ ] Verify Sentry receiving errors
- [ ] Check Prometheus metrics
- [ ] Confirm logs being written
- [ ] Test alert notifications
- [ ] Verify uptime monitoring

### 3. Performance Checks
- [ ] Run Lighthouse audit (score > 90)
- [ ] Check Core Web Vitals
- [ ] Verify API response times < 200ms
- [ ] Test under load (k6 tests)
- [ ] Check CDN cache hit rate

### 4. Security Verification
```bash
# SSL/TLS check
openssl s_client -connect onyx.protocol:443

# Security headers
curl -I https://onyx.protocol | grep -E "X-|Content-Security"

# CORS check
curl -H "Origin: http://malicious.com" https://api.onyx.protocol/api/orders
```

### 5. Functional Testing
- [ ] User registration works
- [ ] Login/logout works
- [ ] Order creation works
- [ ] Contract interaction works
- [ ] Gas estimation accurate
- [ ] Transaction signing works
- [ ] Notifications sent

## Rollback Plan

### If Issues Detected

#### 1. Frontend Rollback
```bash
# Revert to previous deployment
vercel rollback  # or your hosting platform command
```

#### 2. Backend Rollback
```bash
# SSH to server
ssh user@backend-server

# Checkout previous version
cd /var/www/onyx-api
git checkout <previous-commit>

# Restart
pm2 restart onyx-api
```

#### 3. Database Rollback
```bash
# Restore from backup
psql -h host -U user -d db < backup.sql

# Or rollback migration
pnpm prisma migrate resolve --rolled-back <migration-name>
```

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Application Health**
   - Uptime percentage (target: 99.9%)
   - Response time (target: < 200ms)
   - Error rate (target: < 0.1%)

2. **Infrastructure**
   - CPU usage (alert: > 80%)
   - Memory usage (alert: > 85%)
   - Disk space (alert: > 90%)
   - Network bandwidth

3. **Database**
   - Connection pool usage
   - Query performance
   - Replication lag
   - Deadlocks

4. **Business Metrics**
   - Active users
   - Order volume
   - Transaction success rate
   - Gas costs

### Alert Channels
- [ ] PagerDuty configured
- [ ] Slack notifications set up
- [ ] Email alerts configured
- [ ] SMS for critical alerts

## Incident Response

### Severity Levels

**P0 - Critical (< 15 min response)**
- Complete service outage
- Data breach
- Security vulnerability

**P1 - High (< 1 hour response)**
- Partial service degradation
- Performance issues affecting > 50% users
- Failed deployments

**P2 - Medium (< 4 hours response)**
- Minor feature issues
- Performance degradation < 50% users
- Non-critical bugs

**P3 - Low (< 24 hours response)**
- Cosmetic issues
- Documentation updates
- Enhancement requests

### Incident Response Steps
1. Acknowledge alert
2. Assess severity
3. Notify team
4. Investigate root cause
5. Implement fix or rollback
6. Verify resolution
7. Post-mortem analysis
8. Update runbooks

## Maintenance Windows

### Scheduled Maintenance
- **Frequency**: Monthly
- **Duration**: 2 hours
- **Time**: Sunday 2-4 AM UTC
- **Notification**: 7 days advance notice

### Emergency Maintenance
- Immediate notification
- Status page update
- Social media announcement
- Email to affected users

## Success Criteria

Deployment is successful when:

- ✅ All health checks passing
- ✅ Zero critical errors in logs
- ✅ Performance metrics within targets
- ✅ Security scans clean
- ✅ Monitoring active and alerting
- ✅ User acceptance testing passed
- ✅ Rollback plan tested and ready
- ✅ Team trained on incident response

## Post-Launch Tasks

### Week 1
- [ ] Monitor error rates closely
- [ ] Review performance metrics
- [ ] Collect user feedback
- [ ] Address critical bugs

### Week 2-4
- [ ] Optimize based on real usage
- [ ] Fine-tune caching
- [ ] Adjust rate limits
- [ ] Update documentation

### Ongoing
- [ ] Weekly performance reviews
- [ ] Monthly security audits
- [ ] Quarterly disaster recovery drills
- [ ] Continuous optimization

---

**Last Updated**: $(date)
**Deployment Version**: v1.0.0
**Next Review**: $(date -d "+1 month")
