import http from 'k6/http';
import { check, sleep } from 'k6';

// Soak test - maintain 100 VUs for 30 minutes to test memory leaks
export const options = {
  stages: [
    { duration: '2m', target: 100 },    // Ramp up to 100 VUs
    { duration: '30m', target: 100 },   // Sustained load for 30 minutes
    { duration: '2m', target: 0 },      // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% under 500ms
    http_req_failed: ['rate<0.01'],     // Error rate < 1%
    'http_req_duration{endpoint:health}': ['p(99)<300'],
    'http_req_duration{endpoint:quote}': ['p(99)<800'],
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
    'health response time OK': (r) => r.timings.duration < 1000,
  });
  
  // Test quote endpoint periodically
  if (Math.random() < 0.3) { // 30% of requests test quote
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
      'quote response time OK': (r) => r.timings.duration < 2000,
    });
  }
  
  sleep(2); // Steady request rate
}
