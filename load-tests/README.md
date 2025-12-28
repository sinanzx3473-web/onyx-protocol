# Load Testing Infrastructure

This directory contains k6 load testing scripts for the ONYX Protocol API.

## Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

## Running Load Tests

### Spike Test
Simulates sudden traffic spike (0 → 1000 users in 1 minute):
```bash
k6 run load-tests/spike.js
# Or use npm script:
pnpm test:load:spike
```

### Stress Test
Gradually ramps traffic (0 → 500 users over 10 minutes):
```bash
k6 run load-tests/stress.js
# Or use npm script:
pnpm test:load:stress
```

### Soak Test
Sustained load (100 users for 30 minutes) to detect memory leaks:
```bash
k6 run load-tests/soak.js
# Or use npm script:
pnpm test:load:soak
```

## Configuration

Set the API URL via environment variable:
```bash
API_URL=http://localhost:3001 k6 run load-tests/stress.js
```

Default API URL: `http://localhost:3001`

## Test Scripts Overview

### spike.js
- **Duration**: ~3 minutes
- **Peak Load**: 1000 concurrent users
- **Target**: `/api/health`
- **Purpose**: Test system behavior under sudden traffic spikes
- **Thresholds**:
  - p95 response time < 500ms
  - Error rate < 5%

### stress.js
- **Duration**: ~18 minutes
- **Peak Load**: 500 concurrent users
- **Targets**: `/api/quote`, `/api/pools`, `/api/health`
- **Purpose**: Find system breaking point under gradually increasing load
- **Thresholds**:
  - p95 response time < 1000ms
  - Error rate < 10%
  - Quote endpoint p95 < 800ms
  - Pools endpoint p95 < 600ms

### soak.js
- **Duration**: 32 minutes
- **Sustained Load**: 100 concurrent users
- **Targets**: `/api/analytics/*`, `/api/pools`, `/api/health`
- **Purpose**: Detect memory leaks and performance degradation over time
- **Thresholds**:
  - p95 response time < 1500ms
  - Error rate < 5%
  - Response time trend < 2000ms (memory leak detection)

## Results

Test results are saved to:
- `load-tests/spike-results.json`
- `load-tests/stress-results.json`
- `load-tests/soak-results.json`
- `load-tests/soak-summary.txt`

## NPM Scripts Available

**Note**: Due to file protection, these scripts need to be manually added to `package.json`:

```json
"scripts": {
  "type-check": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui",
  "test:load": "k6 run load-tests/stress.js",
  "test:load:spike": "k6 run load-tests/spike.js",
  "test:load:stress": "k6 run load-tests/stress.js",
  "test:load:soak": "k6 run load-tests/soak.js"
}
```

## Interpreting Results

### Key Metrics
- **http_reqs**: Total number of HTTP requests
- **http_req_duration**: Response time statistics
- **http_req_failed**: Failed request rate
- **errors**: Custom error rate from checks

### Success Criteria
- ✅ All thresholds pass
- ✅ Error rate < 5% for spike/soak, < 10% for stress
- ✅ p95 response times within limits
- ✅ No significant response time degradation in soak test

### Warning Signs
- ⚠️ Increasing response times over duration (memory leak)
- ⚠️ High error rates (> 10%)
- ⚠️ Threshold violations
- ⚠️ Response time degradation ratio > 2.5x in soak test

## CI/CD Integration

The load tests can be integrated into your CI/CD pipeline. See `.github/workflows/production.yml` for the automated quality checks that run before deployment.

For production load testing, consider:
1. Running tests against staging environment before production deployment
2. Setting up automated performance regression detection
3. Monitoring key metrics over time to establish baselines
4. Scheduling regular soak tests to catch memory leaks early
