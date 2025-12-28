import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export interface ValidationError {
  success: false;
  code: string;
  message: string;
  details: Array<{
    field: string;
    message: string;
  }>;
}

// Zod schema validator middleware factory
export const validateSchema = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError: ValidationError = {
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        };
        res.status(400).json(validationError);
        return;
      }
      next(error);
    }
  };
};

// Common validation schemas
export const schemas = {
  gasEstimate: z.object({
    body: z.object({
      operation: z.enum(['swap', 'addLiquidity', 'removeLiquidity'], {
        errorMap: () => ({ message: 'Operation must be swap, addLiquidity, or removeLiquidity' })
      }),
      tokenA: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid tokenA address'),
      tokenB: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid tokenB address'),
      amount: z.string().min(1, 'Amount is required')
    })
  }),
  
  poolParams: z.object({
    params: z.object({
      tokenA: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid tokenA address'),
      tokenB: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid tokenB address')
    })
  }),
  
  analyticsQuery: z.object({
    query: z.object({
      days: z.string().regex(/^\d+$/).transform(Number).pipe(
        z.number().min(1).max(365)
      ).optional(),
      poolId: z.string().optional()
    })
  })
};

// Helper for validating request body with Zod schema
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError: ValidationError = {
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        };
        res.status(400).json(validationError);
        return;
      }
      next(error);
    }
  };
};
