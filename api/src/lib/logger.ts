import winston from 'winston';
import * as Sentry from '@sentry/node';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, correlationId, ...metadata }) => {
  let msg = `${timestamp} [${level}]`;
  
  if (correlationId) {
    msg += ` [${correlationId}]`;
  }
  
  msg += `: ${message}`;
  
  // Add metadata if present
  const metaStr = Object.keys(metadata).length ? JSON.stringify(metadata, null, 2) : '';
  if (metaStr) {
    msg += `\n${metaStr}`;
  }
  
  return msg;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  defaultMeta: { service: 'dex-analytics-api' },
  transports: [
    // Console transport with colors for development
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
  ],
});

// Add file transports for production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Sentry integration for error logging
export function logError(error: Error, context?: Record<string, unknown>) {
  logger.error(error.message, { stack: error.stack, ...context });
  
  // Send to Sentry if configured
  if (process.env.SENTRY_DSN) {
    if (context) {
      Sentry.setContext('additional', context);
    }
    Sentry.captureException(error);
  }
}

// Structured logging helpers
export function logInfo(message: string, meta?: Record<string, unknown>) {
  logger.info(message, meta);
}

export function logWarn(message: string, meta?: Record<string, unknown>) {
  logger.warn(message, meta);
}

export function logDebug(message: string, meta?: Record<string, unknown>) {
  logger.debug(message, meta);
}

// Add correlation ID to log context
export function withCorrelationId(correlationId: string) {
  return {
    info: (message: string, meta?: Record<string, unknown>) => 
      logger.info(message, { correlationId, ...meta }),
    warn: (message: string, meta?: Record<string, unknown>) => 
      logger.warn(message, { correlationId, ...meta }),
    error: (message: string, meta?: Record<string, unknown>) => 
      logger.error(message, { correlationId, ...meta }),
    debug: (message: string, meta?: Record<string, unknown>) => 
      logger.debug(message, { correlationId, ...meta }),
  };
}

export default logger;
