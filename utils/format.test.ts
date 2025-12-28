import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCompactNumber, formatPercentage } from './format';

describe('Format Utilities', () => {
  describe('formatCurrency', () => {
    it('should format USD currency correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0)).toBe('$0.00');
    });
  });

  describe('formatCompactNumber', () => {
    it('should format large numbers with K suffix', () => {
      expect(formatCompactNumber(1234)).toBe('1.2K');
    });
  });

  describe('formatPercentage', () => {
    it('should format decimal percentages correctly', () => {
      expect(formatPercentage(0.1234, 2, true)).toBe('12.34%');
    });
  });

  describe('System Health', () => {
    it('should pass sanity check', () => {
      expect(true).toBe(true);
    });
  });
});
