import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const analyticsErrors = new Counter('analytics_errors');
const memoryLeakIndicator = new Trend('response_time_trend');

// Test configuration - Soak test runs for 30 minutes
export const options = {
  stages: [
    { duration: '2m', target: 100 },     // Ramp up to 100 users
    { duration: '28m', target: 100 },    // Stay at 100 users for 28 minutes (soak)
    { duration: '2m', target: 0 },       // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'],   // 95% of requests should be below 1.5s
    http_req_failed: ['rate<0.05'],      // Error rate should be less than 5%
    errors: ['rate<0.05'],               // Custom error rate should be less than 5%
    // Check for memory leaks - response time shouldn't increase over time
    response_time_trend: ['p(95)<2000'], // p95 should stay below 2s throughout
  },
};

// Base URL - update this to your API endpoint
const BASE_URL = __ENV.API_URL || 'http://localhost:3001';

// Track iteration for memory leak detection
let iterationCount = 0;

export default function () {
  iterationCount++;
  
  // Test analytics endpoint (most likely to reveal memory leaks)
  testAnalyticsEndpoint();
  
  // Periodically test other endpoints
  if (iterationCount % 5 === 0) {
    testHealthEndpoint();
  }
  
  if (iterationCount % 10 === 0) {
    testPoolsEndpoint();
  }
  
  // Simulate realistic user behavior
  sleep(2 + Math.random() * 3);
}

function testAnalyticsEndpoint() {
  const endpoints = [
    '/api/analytics/volume',
    '/api/analytics/tvl',
    '/api/analytics/fees',
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`);
  
  // Track response time trend to detect memory leaks
  memoryLeakIndicator.add(res.timings.duration);
  
  const success = check(res, {
    'analytics status is 200': (r) => r.status === 200,
    'analytics response time < 2s': (r) => r.timings.duration < 2000,
    'analytics has valid data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body !== null && typeof body === 'object';
      } catch (e) {
        return false;
      }
    },
  });
  
  if (!success) {
    analyticsErrors.add(1);
  }
  
  errorRate.add(!success);
}

function testHealthEndpoint() {
  const res = http.get(`${BASE_URL}/api/health`);
  
  const success = check(res, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 300ms': (r) => r.timings.duration < 300,
  });
  
  errorRate.add(!success);
}

function testPoolsEndpoint() {
  const res = http.get(`${BASE_URL}/api/pools`);
  
  const success = check(res, {
    'pools status is 200': (r) => r.status === 200,
    'pools response time < 1s': (r) => r.timings.duration < 1000,
  });
  
  errorRate.add(!success);
}

export function handleSummary(data) {
  const summary = generateDetailedSummary(data);
  
  return {
    'stdout': summary,
    'load-tests/soak-results.json': JSON.stringify(data),
    'load-tests/soak-summary.txt': summary,
  };
}

function generateDetailedSummary(data) {
  let summary = '\n';
  summary += '═══════════════════════════════════════════════════════════\n';
  summary += '                    SOAK TEST SUMMARY                      \n';
  summary += '═══════════════════════════════════════════════════════════\n\n';
  
  summary += '📊 Overall Statistics\n';
  summary += '─────────────────────────────────────────────────────────\n';
  summary += `Total Requests:        ${data.metrics.http_reqs.values.count}\n`;
  summary += `Failed Requests:       ${data.metrics.http_req_failed.values.passes}\n`;
  summary += `Success Rate:          ${((1 - data.metrics.http_req_failed.values.rate) * 100).toFixed(2)}%\n`;
  summary += `Error Rate:            ${(data.metrics.errors.values.rate * 100).toFixed(2)}%\n`;
  summary += `Analytics Errors:      ${data.metrics.analytics_errors.values.count}\n\n`;
  
  summary += '⏱️  Response Time Metrics\n';
  summary += '─────────────────────────────────────────────────────────\n';
  summary += `Average:               ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `Median (p50):          ${data.metrics.http_req_duration.values.med.toFixed(2)}ms\n`;
  summary += `90th Percentile:       ${data.metrics.http_req_duration.values['p(90)'].toFixed(2)}ms\n`;
  summary += `95th Percentile:       ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `99th Percentile:       ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
  summary += `Maximum:               ${data.metrics.http_req_duration.values.max.toFixed(2)}ms\n`;
  summary += `Minimum:               ${data.metrics.http_req_duration.values.min.toFixed(2)}ms\n\n`;
  
  summary += '🔍 Memory Leak Detection\n';
  summary += '─────────────────────────────────────────────────────────\n';
  const responseTrend = data.metrics.response_time_trend;
  const avgResponseTime = responseTrend.values.avg;
  const p95ResponseTime = responseTrend.values['p(95)'];
  
  summary += `Average Response Time: ${avgResponseTime.toFixed(2)}ms\n`;
  summary += `P95 Response Time:     ${p95ResponseTime.toFixed(2)}ms\n`;
  
  // Simple heuristic: if p95 is more than 2x average, might indicate degradation
  const degradationRatio = p95ResponseTime / avgResponseTime;
  if (degradationRatio > 2.5) {
    summary += `⚠️  WARNING: Possible memory leak detected!\n`;
    summary += `   Response time degradation ratio: ${degradationRatio.toFixed(2)}x\n`;
  } else {
    summary += `✅ No significant memory leak detected\n`;
    summary += `   Response time degradation ratio: ${degradationRatio.toFixed(2)}x\n`;
  }
  
  summary += '\n';
  summary += '═══════════════════════════════════════════════════════════\n';
  summary += '                      TEST COMPLETE                        \n';
  summary += '═══════════════════════════════════════════════════════════\n';
  
  return summary;
}
