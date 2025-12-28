# Monitoring & Observability Setup

## Overview

Production-grade monitoring has been implemented across frontend and backend with Sentry integration, structured logging, and performance tracking.

## Frontend Monitoring

### Features Implemented
- ✅ Sentry error tracking with source maps
- ✅ Web Vitals monitoring (CLS, FID, FCP, LCP, TTFB)
- ✅ Session replay for debugging
- ✅ Performance transaction tracking
- ✅ User context tracking
- ✅ Breadcrumb logging

### Configuration

1. **Get Sentry DSN**: Sign up at https://sentry.io/ and create a project
2. **Update `.env`**:
```bash
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_SENTRY_ENVIRONMENT=production
VITE_ENABLE_PERFORMANCE_MONITORING=true
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
```

3. **Build Configuration**: Add to `.env` for source map upload:
```bash
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-auth-token
```

### Usage

```typescript
import { captureException, addBreadcrumb, setUser } from '@/lib/monitoring';

// Track errors
try {
  // risky operation
} catch (error) {
  captureException(error, { context: 'swap-operation' });
}

// Add debugging breadcrumbs
addBreadcrumb('User initiated swap', { amount: '100', token: 'USDC' });

// Set user context
setUser({ id: address, address });
```

## Backend Monitoring

### Features Implemented
- ✅ Sentry error tracking
- ✅ Winston structured logging
- ✅ Correlation ID tracking
- ✅ Prometheus metrics endpoint
- ✅ Performance profiling
- ✅ File-based log rotation

### Configuration

1. **Update `api/.env`**:
```bash
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
LOG_LEVEL=info
```

2. **Install profiling dependency** (manual step required):
```bash
cd api
pnpm add @sentry/profiling-node
```

### Log Levels
- `error`: Critical errors requiring immediate attention
- `warn`: Warning conditions
- `info`: Informational messages (default)
- `debug`: Detailed debugging information

### Usage

```typescript
import logger, { logError, logInfo, withCorrelationId } from './lib/logger';

// Standard logging
logInfo('User action', { userId: '123', action: 'swap' });

// Error logging with Sentry
try {
  // operation
} catch (error) {
  logError(error, { context: 'relay-transaction' });
}

// Correlation ID logging
const log = withCorrelationId(req.correlationId);
log.info('Processing request', { endpoint: '/api/swap' });
```

## Metrics Endpoint

Prometheus metrics available at: `http://localhost:3001/api/metrics`

### Metrics Tracked
- HTTP request duration
- HTTP request count by status code
- Active connections
- Error rates
- Custom business metrics

### Grafana Integration

1. Add Prometheus data source pointing to your API
2. Import dashboard template (create custom or use community templates)
3. Monitor:
   - Request rates
   - Error rates
   - Response times
   - System resources

## Production Deployment

### Frontend
1. Set environment variables in hosting platform (Vercel/Netlify)
2. Ensure `SENTRY_AUTH_TOKEN` is set for source map upload
3. Build will automatically upload source maps to Sentry

### Backend
1. Set all environment variables
2. Ensure log directory exists: `mkdir -p logs`
3. Configure log rotation (logrotate on Linux)
4. Set up Prometheus scraping
5. Configure Grafana dashboards

## Monitoring Checklist

- [ ] Sentry projects created for frontend and backend
- [ ] Environment variables configured
- [ ] Source maps uploading correctly
- [ ] Logs writing to files in production
- [ ] Prometheus metrics endpoint accessible
- [ ] Grafana dashboards configured
- [ ] Alert rules configured in Sentry
- [ ] Log rotation configured
- [ ] Performance budgets set

## Alert Configuration

### Recommended Sentry Alerts
1. **Error Rate**: Alert when error rate > 1% of requests
2. **Performance**: Alert when p95 response time > 2s
3. **Availability**: Alert on 5xx errors
4. **Custom**: Alert on specific error patterns

### Log Monitoring
- Set up alerts for ERROR level logs
- Monitor disk space for log files
- Configure log aggregation (optional: ELK stack, Datadog)

## Next Steps

1. Install `@sentry/profiling-node` in backend
2. Configure Sentry projects and get DSNs
3. Set up Grafana dashboards
4. Configure alert rules
5. Test error tracking in staging environment
6. Document runbook for common alerts

## Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Winston Documentation](https://github.com/winstonjs/winston)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Web Vitals](https://web.dev/vitals/)
