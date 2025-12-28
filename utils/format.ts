/**
 * Format a number as currency with proper decimals and separators
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 2)
 * @param currency - Currency symbol (default: '$')
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number,
  decimals: number = 2,
  currency: string = '$'
): string {
  if (isNaN(value)) {
    return `${currency}0.00`;
  }

  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${currency}${formatted}`;
}

/**
 * Format a number with K, M, B suffixes for large numbers
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string with suffix
 */
export function formatCompactNumber(value: number, decimals: number = 1): string {
  if (isNaN(value)) return '0';
  if (value === 0) return '0';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1e9) {
    return `${sign}${(absValue / 1e9).toFixed(decimals)}B`;
  }
  if (absValue >= 1e6) {
    return `${sign}${(absValue / 1e6).toFixed(decimals)}M`;
  }
  if (absValue >= 1e3) {
    return `${sign}${(absValue / 1e3).toFixed(decimals)}K`;
  }

  return `${sign}${absValue.toFixed(decimals)}`;
}

/**
 * Format a percentage value
 * @param value - The numeric value (0-100 or 0-1 based on isDecimal)
 * @param decimals - Number of decimal places (default: 2)
 * @param isDecimal - Whether input is decimal (0-1) or percentage (0-100)
 * @returns Formatted percentage string
 */
export function formatPercentage(
  value: number,
  decimals: number = 2,
  isDecimal: boolean = false
): string {
  if (isNaN(value)) return '0%';

  const percentValue = isDecimal ? value * 100 : value;
  return `${percentValue.toFixed(decimals)}%`;
}
