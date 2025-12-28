import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const requestCount = new Counter('request_count');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '5m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'],                  // Error rate < 1%
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';

export default function () {
  // Test health endpoint
  testHealthEndpoint();
  
  // Test gas estimation
  testGasEstimation();
  
  // Test analytics
  testAnalytics();
  
  // Test pools
  testPools();
  
  sleep(1);
}

function testHealthEndpoint() {
  const res = http.get(`${BASE_URL}/api/health`);
  
  const success = check(res, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 200ms': (r) => r.timings.duration < 200,
    'health has status field': (r) => JSON.parse(r.body).status !== undefined,
  });
  
  errorRate.add(!success);
  apiDuration.add(res.timings.duration);
  requestCount.add(1);
}

function testGasEstimation() {
  const payload = JSON.stringify({
    from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    value: '1000000000000000',
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const res = http.post(`${BASE_URL}/api/gas-estimate`, payload, params);
  
  const success = check(res, {
    'gas estimation status is 200': (r) => r.status === 200,
    'gas estimation response time < 500ms': (r) => r.timings.duration < 500,
    'gas estimation has gasLimit': (r) => {
      try {
        return JSON.parse(r.body).gasLimit !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  errorRate.add(!success);
  apiDuration.add(res.timings.duration);
  requestCount.add(1);
}

function testAnalytics() {
  const res = http.get(`${BASE_URL}/api/analytics/volume?period=24h`);
  
  const success = check(res, {
    'analytics status is 200': (r) => r.status === 200,
    'analytics response time < 1s': (r) => r.timings.duration < 1000,
  });
  
  errorRate.add(!success);
  apiDuration.add(res.timings.duration);
  requestCount.add(1);
}

function testPools() {
  const res = http.get(`${BASE_URL}/api/pools`);
  
  const success = check(res, {
    'pools status is 200': (r) => r.status === 200,
    'pools response time < 500ms': (r) => r.timings.duration < 500,
    'pools returns array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body));
      } catch {
        return false;
      }
    },
  });
  
  errorRate.add(!success);
  apiDuration.add(res.timings.duration);
  requestCount.add(1);
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = '\n';
  summary += `${indent}Test Summary:\n`;
  summary += `${indent}  Total Requests: ${data.metrics.request_count.values.count}\n`;
  summary += `${indent}  Failed Requests: ${data.metrics.http_req_failed.values.passes}\n`;
  summary += `${indent}  Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%\n`;
  summary += `${indent}  Avg Duration: ${data.metrics.api_duration.values.avg.toFixed(2)}ms\n`;
  summary += `${indent}  P95 Duration: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}  P99 Duration: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
  
  return summary;
}
