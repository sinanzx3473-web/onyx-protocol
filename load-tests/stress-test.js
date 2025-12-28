import http from 'k6/http';
import { check, sleep } from 'k6';

// Stress test - ramp to 500 VUs over 10 minutes to test database pooling
export const options = {
  stages: [
    { duration: '2m', target: 100 },    // Ramp up to 100 users
    { duration: '2m', target: 200 },    // Ramp to 200
    { duration: '2m', target: 300 },    // Ramp to 300
    { duration: '2m', target: 400 },    // Ramp to 400
    { duration: '2m', target: 500 },    // Ramp to 500 (10 min total)
    { duration: '5m', target: 500 },    // Maintain 500 VUs
    { duration: '3m', target: 0 },      // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<2000'],  // 99% under 2s
    http_req_failed: ['rate<0.05'],     // Error rate < 5%
    'http_req_duration{endpoint:health}': ['p(95)<500'],
    'http_req_duration{endpoint:quote}': ['p(95)<1000'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';

export default function () {
  // Test health endpoint
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    tags: { endpoint: 'health' },
  });
  
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });
  
  // Test quote endpoint with realistic payload
  const quotePayload = JSON.stringify({
    tokenIn: '0x0000000000000000000000000000000000000000',
    tokenOut: '0x1111111111111111111111111111111111111111',
    amount: '1000000000000000000',
    slippage: 0.5,
  });
  
  const quoteRes = http.post(`${BASE_URL}/api/quote`, quotePayload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'quote' },
  });
  
  check(quoteRes, {
    'quote status is 200': (r) => r.status === 200,
    'quote has amountOut': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.amountOut !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  sleep(1);
}
