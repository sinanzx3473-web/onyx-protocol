# ONYX Protocol Monitoring Setup

This directory contains monitoring and observability configurations for production deployment.

## 📊 Grafana Dashboard

### Import Dashboard

1. **Access Grafana**: Navigate to your Grafana instance
2. **Import Dashboard**: 
   - Go to Dashboards → Import
   - Upload `grafana-dashboard.json`
   - Select your Prometheus datasource
3. **Configure Alerts**: Set up notification channels for critical alerts

### Dashboard Panels

The dashboard tracks:

- **API Performance**
  - Request rate (requests/sec)
  - Response time (P95, P99)
  - HTTP status codes distribution
  - Error rate percentage

- **System Resources**
  - CPU usage with 80% threshold alert
  - Memory consumption
  - Active connections with 1000 connection alert
  - Uptime tracking

- **Application Metrics**
  - Smart contract interaction rates
  - Gas price tracking across networks
  - Database query performance
  - WebSocket connection count

### Alert Configuration

Pre-configured alerts:
- **High API Response Time**: Triggers when P95 > 1s
- **High CPU Usage**: Triggers when CPU > 80%
- **High Connection Count**: Triggers when connections > 1000

## 🔍 Sentry Error Tracking

### Frontend Setup

1. **Get Sentry DSN**: Create a project at [sentry.io](https://sentry.io)
2. **Configure Environment Variables**:
   ```bash
   VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
   SENTRY_ORG=your-org
   SENTRY_PROJECT=onyx-frontend
   SENTRY_AUTH_TOKEN=your-auth-token
   ```

3. **Features Enabled**:
   - Browser performance tracing
   - Session replay for error debugging
   - Automatic error capture
   - User context tracking (wallet addresses)

### Backend Setup

1. **Configure Environment Variables**:
   ```bash
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   NODE_ENV=production
   ```

2. **Features Enabled**:
   - Node.js profiling
   - Request tracing
   - Error capture with context
   - Performance monitoring

### Sentry Best Practices

- **Sample Rates**: Production uses 20% sampling to reduce costs
- **Privacy**: Sensitive headers (authorization, cookies) are filtered
- **WalletConnect Filter**: Known non-blocking telemetry errors are filtered
- **User Context**: Wallet addresses tracked for debugging

## 📈 Prometheus Metrics

### Required Metrics

The Grafana dashboard expects these Prometheus metrics:

```
# HTTP Metrics
http_requests_total{method, route, status_code, environment}
http_request_duration_seconds{route}

# System Metrics
process_cpu_seconds_total
process_resident_memory_bytes
process_start_time_seconds
active_connections

# Application Metrics
contract_calls_total{contract, method}
gas_price_gwei{network}
db_query_duration_seconds{query_type}
websocket_connections_active
```

### Metrics Endpoint

The API exposes Prometheus metrics at:
```
GET /api/metrics
```

## 🚀 Deployment Checklist

### Before Production

- [ ] Configure Sentry DSN for frontend and backend
- [ ] Set up Prometheus scraping (30s interval recommended)
- [ ] Import Grafana dashboard
- [ ] Configure alert notification channels (Slack, PagerDuty, email)
- [ ] Test alerts by triggering threshold conditions
- [ ] Verify source maps upload to Sentry
- [ ] Set appropriate sample rates for production

### Monitoring Verification

```bash
# Check Prometheus metrics endpoint
curl http://localhost:3001/api/metrics

# Verify Sentry initialization (check logs)
# Frontend: "✅ Sentry monitoring initialized"
# Backend: "✅ Sentry monitoring initialized for backend"

# Test error tracking
# Trigger a test error and verify it appears in Sentry
```

## 📚 Additional Resources

- [Grafana Documentation](https://grafana.com/docs/)
- [Sentry Documentation](https://docs.sentry.io/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)

## 🔧 Troubleshooting

### Sentry Not Capturing Errors

1. Verify DSN is set correctly
2. Check console for initialization message
3. Ensure sample rates are not 0
4. Verify network connectivity to Sentry

### Grafana Dashboard Not Showing Data

1. Verify Prometheus datasource connection
2. Check metric names match your Prometheus config
3. Ensure Prometheus is scraping the `/api/metrics` endpoint
4. Verify time range selection in Grafana

### High Alert Noise

1. Adjust threshold values in dashboard JSON
2. Increase alert evaluation intervals
3. Configure alert grouping and deduplication
4. Set up maintenance windows for planned downtime
