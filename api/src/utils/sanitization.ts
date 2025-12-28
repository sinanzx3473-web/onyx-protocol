// Copyright ONYX Protocol
/**
 * Input sanitization utilities for database queries
 * Prevents DoS attacks and SQL injection attempts
 */

/**
 * Sanitize search strings by removing special characters
 * that could cause performance issues in database queries
 * 
 * @param input - The search string to sanitize
 * @returns Sanitized string safe for database queries
 */
export function sanitizeSearchString(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove special characters that could cause DoS
  // Keep alphanumeric, spaces, hyphens, and underscores
  return input
    .replace(/[^\w\s-]/g, '')
    .trim()
    .slice(0, 100); // Limit length to prevent excessive queries
}

/**
 * Sanitize numeric input to ensure it's a valid number
 * 
 * @param input - The numeric input to sanitize
 * @param defaultValue - Default value if input is invalid
 * @returns Sanitized number
 */
export function sanitizeNumericInput(input: any, defaultValue: number = 0): number {
  const parsed = Number(input);
  
  if (isNaN(parsed) || !isFinite(parsed)) {
    return defaultValue;
  }
  
  return parsed;
}

/**
 * Sanitize pagination parameters
 * 
 * @param page - Page number
 * @param limit - Items per page
 * @returns Sanitized pagination parameters
 */
export function sanitizePagination(page: any, limit: any): { page: number; limit: number } {
  const sanitizedPage = Math.max(1, sanitizeNumericInput(page, 1));
  const sanitizedLimit = Math.min(100, Math.max(1, sanitizeNumericInput(limit, 10)));
  
  return {
    page: sanitizedPage,
    limit: sanitizedLimit
  };
}

/**
 * Sanitize array of strings
 * 
 * @param input - Array of strings to sanitize
 * @param maxLength - Maximum array length
 * @returns Sanitized array
 */
export function sanitizeStringArray(input: any, maxLength: number = 50): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  
  return input
    .slice(0, maxLength)
    .filter(item => typeof item === 'string')
    .map(item => sanitizeSearchString(item))
    .filter(item => item.length > 0);
}

/**
 * Sanitize Ethereum address
 * 
 * @param address - Ethereum address to sanitize
 * @returns Sanitized address or empty string if invalid
 */
export function sanitizeAddress(address: any): string {
  if (typeof address !== 'string') {
    return '';
  }
  
  // Basic Ethereum address validation (0x + 40 hex chars)
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  
  if (!addressRegex.test(address)) {
    return '';
  }
  
  return address.toLowerCase();
}

/**
 * Sanitize object keys to prevent prototype pollution
 * 
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): Partial<T> {
  if (!obj || typeof obj !== 'object') {
    return {};
  }
  
  const sanitized: Partial<T> = {};
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && !dangerousKeys.includes(key)) {
      sanitized[key] = obj[key];
    }
  }
  
  return sanitized;
}
