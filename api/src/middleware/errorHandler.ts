// Copyright ONYX Protocol
import { Request, Response, NextFunction } from 'express';
import { logger } from './correlationId.js';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

// Standard error codes
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  BAD_REQUEST: 'BAD_REQUEST',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
} as const;

// Standard error response shape
interface ErrorResponse {
  success: false;
  code: string;
  message: string;
  details?: unknown;
  correlationId?: string;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || ErrorCodes.INTERNAL_ERROR;
  const correlationId = req.correlationId;

  // Rich context logging
  const logContext = {
    requestId: correlationId,
    statusCode,
    code,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    query: req.query,
    body: req.body,
    params: req.params
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    logger.error('Request error', err, {
      ...logContext,
      stack: err.stack
    }, correlationId);
  } else {
    logger.error('Request error', err, logContext, correlationId);
  }

  const errorResponse: ErrorResponse = {
    success: false,
    code,
    message,
    correlationId
  };

  // Include details in development or for specific error types
  if (process.env.NODE_ENV === 'development' || statusCode < 500) {
    errorResponse.details = err.details;
  }

  res.status(statusCode).json(errorResponse);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
