import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Request, Response, NextFunction } from 'express';

/**
 * Initialize Sentry monitoring for the backend API
 * Includes Node profiling, performance tracking, and error monitoring
 */
export function initializeMonitoring() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn('⚠️  Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    
    // Performance Monitoring
    integrations: [
      // CPU and memory profiling
      nodeProfilingIntegration(),
    ],

    // Performance monitoring sample rate
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    
    // Profiling sample rate
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      
      return event;
    },

    // Additional context
    initialScope: {
      tags: {
        app: 'onyx-protocol',
        layer: 'backend',
      },
    },
  });

  console.log('✅ Sentry monitoring initialized for backend');
}

/**
 * Express middleware to track requests and errors with Sentry
 */
export function sentryMiddleware() {
  return {
    // Request handler - must be first middleware
    requestHandler: Sentry.Handlers.requestHandler({
      ip: true,
      user: ['id', 'address'],
    }),

    // Tracing handler for performance monitoring
    tracingHandler: Sentry.Handlers.tracingHandler(),

    // Error handler - must be after all routes
    errorHandler: Sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Capture all errors with status >= 500
        return true;
      },
    }),
  };
}

/**
 * Manually capture an exception with additional context
 */
export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(address: string | null, metadata?: Record<string, any>) {
  if (address) {
    Sentry.setUser({ 
      id: address,
      ...metadata,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    data,
    level: 'info',
  });
}

/**
 * Start a new transaction for performance tracking
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startTransaction({
    name,
    op,
  });
}
