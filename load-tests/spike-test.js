import http from 'k6/http';
import { check, sleep } from 'k6';

// Spike test - sudden traffic surge to test rate limits
export const options = {
  stages: [
    { duration: '10s', target: 50 },     // Normal load
    { duration: '30s', target: 1000 },   // Instant spike to 1000 VUs
    { duration: '2m', target: 1000 },    // Maintain spike
    { duration: '30s', target: 50 },     // Return to normal
    { duration: '2m', target: 50 },      // Recovery period
  ],
  thresholds: {
    http_req_duration: ['p(99)<5000'],   // Allow higher latency during spike
    http_req_failed: ['rate<0.15'],      // Error rate < 15% (rate limiting expected)
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';

export default function () {
  // Test both health and quote endpoints
  const healthRes = http.get(`${BASE_URL}/api/health`);
  
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health response time OK': (r) => r.timings.duration < 5000,
  });
  
  // Test quote endpoint with sample data
  const quotePayload = JSON.stringify({
    tokenIn: '0x0000000000000000000000000000000000000000',
    tokenOut: '0x1111111111111111111111111111111111111111',
    amount: '1000000000000000000',
    slippage: 0.5,
  });
  
  const quoteRes = http.post(`${BASE_URL}/api/quote`, quotePayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(quoteRes, {
    'quote status is 200 or 429': (r) => r.status === 200 || r.status === 429, // Rate limiting expected
  });
  
  sleep(0.5); // Aggressive request rate
}
