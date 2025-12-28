// Copyright ONYX Protocol
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initializeMonitoring, sentryMiddleware } from './lib/monitoring.js';
import logger, { withCorrelationId } from './lib/logger.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { healthRouter } from './routes/health.js';
import { gasRouter } from './routes/gas.js';
import { analyticsRouter } from './routes/analytics.js';
import { poolsRouter } from './routes/pools.js';
import { quoteRouter } from './routes/quote.js';
import limitOrdersRouter from './routes/limit-orders.js';
import relayTxRouter from './routes/relay-tx.js';
import referralsRouter from './routes/referrals.js';
import { portfolioRouter } from './routes/portfolio.js';
import { tradesRouter } from './routes/trades.js';
import { simulateTxRouter } from './routes/simulate-tx.js';
import notificationsRouter from './routes/notifications.js';
import alertsRouter from './routes/alerts.js';
import governanceRouter from './routes/governance.js';
import relayerRouter from './routes/relayer.js';
import monitoringRouter from './routes/monitoring.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startOrderMatcher } from './services/orderMatcher.js';
import { alertMonitor } from './services/alertMonitor.js';
import { generalLimiter, gasLimiter, analyticsLimiter, relayLimiter, governanceLimiter } from './middleware/rateLimiter.js';
import { correlationIdMiddleware } from './middleware/correlationId.js';
import { metricsMiddleware, metricsHandler } from './middleware/metrics.js';
import { compressionMiddleware } from './middleware/compression.js';
import { noCache, shortCache, mediumCache, conditionalCache } from './middleware/cacheControl.js';

dotenv.config();

// Initialize monitoring first
initializeMonitoring();

// Validate required environment variables
const requiredEnvVars = ['NODE_ENV'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables', { missingEnvVars });
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Validate PORT if provided
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  logger.error('Invalid PORT value', { PORT });
  console.error('❌ Invalid PORT value in environment variables. Must be between 1 and 65535.');
  process.exit(1);
}

// Log environment info
logger.info('Environment variables validated');
logger.info('Server configuration', { 
  environment: process.env.NODE_ENV || 'development',
  port: PORT,
  apiVersion: process.env.API_VERSION || '1.0.0'
});
console.log('✓ Environment variables validated');
console.log(`✓ Running in ${process.env.NODE_ENV || 'development'} mode`);
console.log(`✓ Server will start on port ${PORT}`);

const app: express.Application = express();

const API_VERSION = process.env.API_VERSION || '1.0.0';

// Sentry request handler - must be first middleware
const sentry = sentryMiddleware();
app.use(sentry.requestHandler);
app.use(sentry.tracingHandler);

// CORS whitelist configuration
const allowedOrigins = [
  'https://app.onyx.io',
  'http://localhost:5173',
  'https://preview-2ed750b0-35b1-40a7-8f94-05dfedc67d62.codenut.dev'
];

// M-3 FIX: Strict CORS configuration requiring Origin header for sensitive routes
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Strict CORS for sensitive routes - require Origin header
const strictCorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // M-3 FIX: Reject requests without Origin header for sensitive routes
    if (!origin) {
      return callback(new Error('Origin header required for this endpoint'));
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware - order matters!
// A+ Production Security: Strict security headers with helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed for some web3 wallets
      connectSrc: [
        "'self'",
        "https://*.alchemy.com",
        "https://*.infura.io",
        "https://*.quicknode.com",
        "wss://*.alchemy.com",
        "wss://*.infura.io",
        "wss://*.quicknode.com"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"], // Prevent clickjacking
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' }, // X-Frame-Options: DENY
  noSniff: true, // X-Content-Type-Options: nosniff
  xssFilter: true, // X-XSS-Protection: 1; mode=block
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
// Apply compression for all responses
app.use(compressionMiddleware);

// Apply default CORS globally (will be overridden for specific routes)
app.use(express.json());

// Correlation ID and metrics tracking
app.use(correlationIdMiddleware);
app.use(metricsMiddleware);

// Custom morgan format with correlation ID and structured logging
morgan.token('correlation-id', (req: any) => req.correlationId || '-');
app.use(morgan(':method :url :status :response-time ms - :correlation-id', {
  stream: {
    write: (message: string) => {
      logger.info(message.trim());
    }
  }
}));

// API version header
app.use((_req, res, next) => {
  res.setHeader('X-API-Version', API_VERSION);
  next();
});

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ONYX Protocol API Docs',
}));

// Swagger JSON endpoint
app.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes with appropriate CORS policies and cache strategies
// M-3 FIX: Health endpoint allows no-origin requests
app.use('/api/health', cors(corsOptions), noCache, healthRouter);
app.use('/api/metrics', cors(corsOptions), noCache, metricsHandler); // Prometheus metrics endpoint
app.use('/api/gas-estimate', cors(corsOptions), gasLimiter, shortCache, gasRouter);
app.use('/api/analytics', cors(corsOptions), analyticsLimiter, mediumCache, analyticsRouter);
app.use('/api/pools', cors(corsOptions), shortCache, poolsRouter);
app.use('/api/quote', cors(corsOptions), shortCache, quoteRouter);
app.use('/api/limit-orders', cors(corsOptions), conditionalCache, limitOrdersRouter);
// M-3 FIX: Sensitive routes require Origin header
app.use('/api/relay-tx', cors(strictCorsOptions), relayLimiter, noCache, relayTxRouter);
app.use('/api/referrals', cors(corsOptions), conditionalCache, referralsRouter);
app.use('/api/portfolio', cors(corsOptions), conditionalCache, portfolioRouter);
app.use('/api/trades', cors(corsOptions), conditionalCache, tradesRouter);
app.use('/api/simulate-tx', cors(corsOptions), noCache, simulateTxRouter);
app.use('/api/notifications', cors(corsOptions), conditionalCache, notificationsRouter);
app.use('/api/alerts', cors(corsOptions), conditionalCache, alertsRouter);
// M-3 & M-4 FIX: Governance requires Origin header and stricter rate limiting
app.use('/api/governance', cors(strictCorsOptions), governanceLimiter, mediumCache, governanceRouter);
app.use('/api/relayer', cors(strictCorsOptions), relayLimiter, noCache, relayerRouter);
app.use('/api/monitoring', cors(corsOptions), noCache, monitoringRouter);

// Sentry error handler - must be before other error handlers
app.use(sentry.errorHandler);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

app.listen(PORT, () => {
  logger.info('Server started', { port: PORT, environment: process.env.NODE_ENV || 'development' });
  console.log(`🚀 DEX Analytics API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Start order matching service
  startOrderMatcher(5000); // Check every 5 seconds
  logger.info('Order matching service started');
  console.log('📈 Order matching service started');
  
  // Start alert monitoring service
  alertMonitor.start(5000); // Check every 5 seconds
  logger.info('Alert monitoring service started');
});

// Export app for testing
export { app };
export default app;
