import { Request, Response, NextFunction } from 'express';
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// Create a Registry
export const register = new Registry();

// HTTP request duration histogram
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

// HTTP request counter
export const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Error counter
export const errorCounter = new Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'error_code']
});

// Rate limit counter
export const rateLimitCounter = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['route']
});

// Active connections gauge
export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestCounter);
register.registerMetric(errorCounter);
register.registerMetric(rateLimitCounter);
register.registerMetric(activeConnections);

// Middleware to track metrics
export const metricsMiddleware = (_req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Increment active connections
  activeConnections.inc();
  
  // Track response
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = _req.route?.path || _req.path;
    const statusCode = res.statusCode.toString();
    
    // Record duration
    httpRequestDuration.labels(_req.method, route, statusCode).observe(duration);
    
    // Increment request counter
    httpRequestCounter.labels(_req.method, route, statusCode).inc();
    
    // Track errors
    if (res.statusCode >= 400) {
      errorCounter.labels(_req.method, route, statusCode).inc();
    }
    
    // Track rate limits
    if (res.statusCode === 429) {
      rateLimitCounter.labels(route).inc();
    }
    
    // Decrement active connections
    activeConnections.dec();
  });
  
  next();
};

// Metrics endpoint handler
export const metricsHandler = async (_req: Request, res: Response): Promise<void> => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};
