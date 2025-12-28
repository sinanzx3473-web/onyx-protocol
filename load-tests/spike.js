import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '10s', target: 0 },      // Start with 0 users
    { duration: '1m', target: 1000 },    // Spike to 1000 users in 1 minute
    { duration: '30s', target: 1000 },   // Stay at 1000 users for 30 seconds
    { duration: '1m', target: 0 },       // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],    // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.05'],      // Error rate should be less than 5%
    errors: ['rate<0.05'],               // Custom error rate should be less than 5%
  },
};

// Base URL - update this to your API endpoint
const BASE_URL = __ENV.API_URL || 'http://localhost:3001';

export default function () {
  // Test health endpoint
  const healthRes = http.get(`${BASE_URL}/api/health`);
  
  const healthCheck = check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 200ms': (r) => r.timings.duration < 200,
    'health has correct structure': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'healthy';
      } catch (e) {
        return false;
      }
    },
  });
  
  errorRate.add(!healthCheck);
  
  // Small sleep to simulate real user behavior
  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-tests/spike-results.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = '\n';
  summary += `${indent}Spike Test Summary\n`;
  summary += `${indent}==================\n\n`;
  summary += `${indent}Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  summary += `${indent}Failed Requests: ${data.metrics.http_req_failed.values.passes}\n`;
  summary += `${indent}Request Duration (avg): ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `${indent}Request Duration (p95): ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}Request Duration (max): ${data.metrics.http_req_duration.values.max.toFixed(2)}ms\n`;
  summary += `${indent}Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%\n`;
  
  return summary;
}
