# Load Testing Documentation

## Overview
Comprehensive load testing strategy for ONYX Protocol to ensure system reliability, performance, and scalability under various load conditions.

## Testing Strategy

### 1. Load Testing
**Objective**: Verify system performance under expected load

**Scenarios**:
- Normal traffic patterns
- Peak usage periods
- Gradual load increase
- Sustained load

**Metrics**:
- Response time (P50, P95, P99)
- Throughput (requests/second)
- Error rate
- Resource utilization

### 2. Stress Testing
**Objective**: Find system breaking point

**Scenarios**:
- Beyond normal capacity
- Resource exhaustion
- Cascading failures
- Recovery behavior

**Metrics**:
- Maximum concurrent users
- Failure threshold
- Recovery time
- Degradation patterns

### 3. Spike Testing
**Objective**: Test sudden traffic surge handling

**Scenarios**:
- Flash sales/events
- Viral content
- DDoS simulation
- Auto-scaling response

**Metrics**:
- Spike handling capacity
- Auto-scaling speed
- Error rate during spike
- Recovery time

### 4. Soak Testing
**Objective**: Verify long-term stability

**Scenarios**:
- 4+ hour sustained load
- Memory leak detection
- Connection pool exhaustion
- Resource cleanup

**Metrics**:
- Memory usage over time
- Connection stability
- Performance degradation
- Resource leaks

## Test Execution

### Prerequisites
```bash
# Install k6
brew install k6  # macOS
# or
sudo apt-get install k6  # Linux

# Start API server
cd api
pnpm install
pnpm dev

# Start Redis
docker run -d -p 6379:6379 redis:7-alpine
```

### Running Tests

#### Quick Load Test
```bash
k6 run load-tests/k6-config.js
```

#### Stress Test
```bash
k6 run load-tests/stress-test.js
```

#### Spike Test
```bash
k6 run load-tests/spike-test.js
```

#### Soak Test (4 hours)
```bash
k6 run load-tests/soak-test.js
```

### Custom Configuration
```bash
# Custom VUs and duration
k6 run --vus 100 --duration 30s load-tests/k6-config.js

# With specific API URL
API_URL=https://api.onyx.io k6 run load-tests/k6-config.js

# Output to JSON
k6 run --out json=results.json load-tests/k6-config.js
```

## Performance Baselines

### API Endpoints

| Endpoint | P95 Target | P99 Target | Error Rate |
|----------|-----------|-----------|------------|
| /api/health | < 100ms | < 200ms | < 0.1% |
| /api/gas-estimate | < 300ms | < 500ms | < 1% |
| /api/analytics/* | < 500ms | < 1000ms | < 1% |
| /api/pools | < 300ms | < 500ms | < 1% |
| /api/quote | < 400ms | < 800ms | < 1% |
| /api/limit-orders | < 300ms | < 500ms | < 1% |
| /api/relay-tx | < 1000ms | < 2000ms | < 2% |

### System Capacity

| Metric | Target | Maximum |
|--------|--------|---------|
| Concurrent Users | 200 | 500 |
| Requests/Second | 1000 | 2000 |
| CPU Usage | < 70% | < 90% |
| Memory Usage | < 80% | < 95% |
| Database Connections | < 50 | < 100 |
| Redis Connections | < 100 | < 200 |

## Monitoring During Tests

### System Metrics
```bash
# CPU and Memory
htop

# Network
iftop

# Disk I/O
iotop

# Database
# Monitor Prisma connection pool
# Check query performance
```

### Application Metrics
```bash
# Prometheus metrics
curl http://localhost:3001/api/metrics

# Health check
curl http://localhost:3001/api/health

# Logs
tail -f api/logs/combined.log
```

### k6 Metrics
- Real-time terminal output
- JSON export for analysis
- Cloud dashboard (if using k6 Cloud)

## Bottleneck Identification

### Common Bottlenecks

#### 1. Database
**Symptoms**:
- High query latency
- Connection pool exhaustion
- Slow response times

**Solutions**:
- Add indexes
- Optimize queries
- Increase connection pool
- Implement caching

#### 2. Redis
**Symptoms**:
- Rate limiting failures
- Cache misses
- Connection errors

**Solutions**:
- Increase Redis memory
- Optimize cache strategy
- Add Redis cluster
- Implement connection pooling

#### 3. API Server
**Symptoms**:
- High CPU usage
- Memory leaks
- Slow processing

**Solutions**:
- Optimize algorithms
- Add horizontal scaling
- Implement request queuing
- Enable compression

#### 4. Network
**Symptoms**:
- High latency
- Bandwidth saturation
- Connection timeouts

**Solutions**:
- Use CDN
- Enable compression
- Optimize payload size
- Add load balancer

## Optimization Workflow

### 1. Baseline Testing
```bash
# Run initial load test
k6 run load-tests/k6-config.js > baseline.txt

# Record metrics
# - Response times
# - Error rates
# - Resource usage
```

### 2. Identify Bottlenecks
```bash
# Analyze results
# - Check P95/P99 latencies
# - Review error logs
# - Monitor system resources
```

### 3. Implement Optimizations
- Database query optimization
- Caching implementation
- Code optimization
- Infrastructure scaling

### 4. Re-test
```bash
# Run same test
k6 run load-tests/k6-config.js > optimized.txt

# Compare results
diff baseline.txt optimized.txt
```

### 5. Iterate
- Continue until targets met
- Document changes
- Update baselines

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run Load Tests
  run: |
    # Start services
    docker-compose up -d
    
    # Wait for services
    sleep 10
    
    # Run tests
    k6 run --quiet load-tests/k6-config.js
    
    # Check exit code
    if [ $? -ne 0 ]; then
      echo "Load tests failed"
      exit 1
    fi
```

### Scheduled Testing
```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
```

## Reporting

### Test Results Format
```json
{
  "metrics": {
    "http_req_duration": {
      "avg": 150.5,
      "p95": 300.2,
      "p99": 500.8
    },
    "http_req_failed": {
      "rate": 0.005
    },
    "http_reqs": {
      "count": 50000
    }
  }
}
```

### Performance Dashboard
- Grafana for visualization
- Prometheus for metrics storage
- Alerts for threshold violations

## Best Practices

### 1. Test Realistic Scenarios
- Use production-like data
- Simulate real user behavior
- Include think time
- Vary request patterns

### 2. Gradual Load Increase
- Start small
- Ramp up slowly
- Monitor continuously
- Stop at breaking point

### 3. Isolate Variables
- Test one change at a time
- Control environment
- Consistent test data
- Reproducible results

### 4. Monitor Everything
- System resources
- Application metrics
- Database performance
- Network traffic

### 5. Document Results
- Record baselines
- Track improvements
- Note configurations
- Share findings

## Troubleshooting

### High Error Rates
1. Check API logs
2. Verify rate limiting
3. Review database connections
4. Check Redis availability

### Slow Response Times
1. Profile database queries
2. Check cache hit rates
3. Review API logic
4. Monitor network latency

### Resource Exhaustion
1. Check memory leaks
2. Review connection pools
3. Monitor file descriptors
4. Check disk space

### Inconsistent Results
1. Ensure clean state
2. Control external factors
3. Use fixed test data
4. Run multiple iterations

## Next Steps

1. ✅ Set up k6 load testing suite
2. ⏳ Run baseline tests
3. ⏳ Identify bottlenecks
4. ⏳ Implement optimizations
5. ⏳ Verify improvements
6. ⏳ Integrate into CI/CD
7. ⏳ Set up monitoring dashboards
8. ⏳ Schedule regular tests

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [Performance Testing Guide](https://www.guru99.com/performance-testing.html)
- [API Performance Optimization](https://www.nginx.com/blog/10-tips-for-10x-application-performance/)
