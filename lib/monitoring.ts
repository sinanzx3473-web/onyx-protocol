import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry monitoring for the frontend application
 * Includes browser tracing, session replay, and error tracking
 */
export function initializeMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    
    // Performance Monitoring
    integrations: [
      Sentry.browserTracingIntegration(),
      
      // Session Replay for debugging
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Performance monitoring sample rate
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.2 : 1.0,
    
    // Session replay sample rates
    replaysSessionSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    
    // Trace propagation targets
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/preview-.*\.codenut\.dev/,
      /^https:\/\/.*\.onyx-protocol\.com/,
    ],

    // Capture unhandled promise rejections
    beforeSend(event, hint) {
      // Filter out WalletConnect telemetry errors (known non-blocking issue)
      if (
        event.exception?.values?.[0]?.value?.includes('walletconnect') ||
        event.request?.url?.includes('pulse.walletconnect.org')
      ) {
        return null;
      }
      
      return event;
    },

    // Additional context
    initialScope: {
      tags: {
        app: 'onyx-protocol',
        layer: 'frontend',
      },
    },
  });

  console.log('✅ Sentry monitoring initialized');
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
export function setUser(address: string | null) {
  if (address) {
    Sentry.setUser({ id: address });
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
