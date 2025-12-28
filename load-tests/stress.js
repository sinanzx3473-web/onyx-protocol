import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const quoteLatency = new Trend('quote_latency');
const poolsLatency = new Trend('pools_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },     // Ramp up to 100 users
    { duration: '3m', target: 250 },     // Ramp up to 250 users
    { duration: '3m', target: 400 },     // Ramp up to 400 users
    { duration: '2m', target: 500 },     // Ramp up to 500 users (peak)
    { duration: '5m', target: 500 },     // Stay at 500 users
    { duration: '3m', target: 0 },       // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],   // 95% of requests should be below 1s
    http_req_failed: ['rate<0.1'],       // Error rate should be less than 10%
    errors: ['rate<0.1'],                // Custom error rate should be less than 10%
    quote_latency: ['p(95)<800'],        // Quote endpoint p95 < 800ms
    pools_latency: ['p(95)<600'],        // Pools endpoint p95 < 600ms
  },
};

// Base URL - update this to your API endpoint
const BASE_URL = __ENV.API_URL || 'http://localhost:3001';

// Sample token addresses for testing
const TOKENS = {
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
};

export default function () {
  // Randomly select which endpoint to test
  const rand = Math.random();
  
  if (rand < 0.4) {
    // 40% - Test quote endpoint
    testQuoteEndpoint();
  } else if (rand < 0.7) {
    // 30% - Test pools endpoint
    testPoolsEndpoint();
  } else {
    // 30% - Test health endpoint
    testHealthEndpoint();
  }
  
  // Simulate user think time
  sleep(1 + Math.random() * 2);
}

function testQuoteEndpoint() {
  const params = {
    tokenIn: TOKENS.WETH,
    tokenOut: TOKENS.USDC,
    amountIn: '1000000000000000000', // 1 ETH in wei
  };
  
  const url = `${BASE_URL}/api/quote?${new URLSearchParams(params)}`;
  const res = http.get(url);
  
  quoteLatency.add(res.timings.duration);
  
  const success = check(res, {
    'quote status is 200': (r) => r.status === 200,
    'quote response time < 1s': (r) => r.timings.duration < 1000,
    'quote has valid data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.amountOut && body.priceImpact !== undefined;
      } catch (e) {
        return false;
      }
    },
  });
  
  errorRate.add(!success);
}

function testPoolsEndpoint() {
  const res = http.get(`${BASE_URL}/api/pools`);
  
  poolsLatency.add(res.timings.duration);
  
  const success = check(res, {
    'pools status is 200': (r) => r.status === 200,
    'pools response time < 800ms': (r) => r.timings.duration < 800,
    'pools returns array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body);
      } catch (e) {
        return false;
      }
    },
  });
  
  errorRate.add(!success);
}

function testHealthEndpoint() {
  const res = http.get(`${BASE_URL}/api/health`);
  
  const success = check(res, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  errorRate.add(!success);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-tests/stress-results.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  
  let summary = '\n';
  summary += `${indent}Stress Test Summary\n`;
  summary += `${indent}===================\n\n`;
  summary += `${indent}Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  summary += `${indent}Failed Requests: ${data.metrics.http_req_failed.values.passes}\n`;
  summary += `${indent}Request Duration (avg): ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `${indent}Request Duration (p95): ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}Request Duration (max): ${data.metrics.http_req_duration.values.max.toFixed(2)}ms\n`;
  summary += `${indent}Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%\n\n`;
  summary += `${indent}Endpoint Latencies (p95):\n`;
  summary += `${indent}  Quote: ${data.metrics.quote_latency.values['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}  Pools: ${data.metrics.pools_latency.values['p(95)'].toFixed(2)}ms\n`;
  
  return summary;
}
