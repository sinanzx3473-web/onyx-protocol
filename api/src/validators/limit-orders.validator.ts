import { z } from 'zod';

/**
 * Ethereum address validation regex
 */
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Ethereum signature validation regex (65 bytes = 130 hex chars)
 */
const ETH_SIGNATURE_REGEX = /^0x[a-fA-F0-9]{130}$/;

/**
 * Numeric string validation (for amounts and prices)
 */
const NUMERIC_STRING_REGEX = /^\d+(\.\d+)?$/;

/**
 * Create limit order validation schema
 */
export const CreateLimitOrderSchema = z.object({
  userAddress: z.string().regex(ETH_ADDRESS_REGEX, 'Invalid user address format'),
  fromToken: z.string().regex(ETH_ADDRESS_REGEX, 'Invalid fromToken address format'),
  toToken: z.string().regex(ETH_ADDRESS_REGEX, 'Invalid toToken address format'),
  fromAmount: z.string().regex(NUMERIC_STRING_REGEX, 'Invalid fromAmount format'),
  targetPrice: z.string().regex(NUMERIC_STRING_REGEX, 'Invalid targetPrice format'),
  minReceived: z.string().regex(NUMERIC_STRING_REGEX, 'Invalid minReceived format'),
  orderType: z.enum(['limit', 'stop'], { errorMap: () => ({ message: 'Order type must be "limit" or "stop"' }) }),
  expiryHours: z.string().regex(/^\d+$/, 'Invalid expiryHours format').transform(Number),
  signature: z.string().regex(ETH_SIGNATURE_REGEX, 'Invalid signature format'),
  nonce: z.string().regex(/^\d+$/, 'Invalid nonce format'),
});

/**
 * Cancel order validation schema
 */
export const CancelOrderSchema = z.object({
  userAddress: z.string().regex(ETH_ADDRESS_REGEX, 'Invalid user address format'),
  signature: z.string().regex(ETH_SIGNATURE_REGEX, 'Invalid signature format'),
});

/**
 * Get user orders query validation schema
 */
export const GetUserOrdersQuerySchema = z.object({
  status: z.enum(['open', 'filled', 'cancelled', 'expired']).optional(),
});

/**
 * Validate create limit order request
 */
export function validateCreateLimitOrder(data: unknown) {
  return CreateLimitOrderSchema.parse(data);
}

/**
 * Validate cancel order request
 */
export function validateCancelOrder(data: unknown) {
  return CancelOrderSchema.parse(data);
}

/**
 * Validate get user orders query
 */
export function validateGetUserOrdersQuery(data: unknown) {
  return GetUserOrdersQuerySchema.parse(data);
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  public errors: Array<{ field: string; message: string }>;
  
  constructor(message: string, errors: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}
