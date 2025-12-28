import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Use existing correlation ID from header or generate new one
  const correlationId = (req.get('X-Correlation-ID') || uuidv4()) as string;
  
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
};

export const logger = {
  info: (message: string, meta?: Record<string, unknown>, correlationId?: string) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },
  
  error: (message: string, error?: Error, meta?: Record<string, unknown>, correlationId?: string) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      ...meta
    }));
  },
  
  warn: (message: string, meta?: Record<string, unknown>, correlationId?: string) => {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
};
