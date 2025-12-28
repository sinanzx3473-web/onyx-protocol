/**
 * Calculate square root of a bigint value
 * Uses Babylonian method (Newton's method) for integer square root
 * @param value The value to calculate square root for
 * @returns The integer square root
 */
export function sqrt(value: bigint): bigint {
  if (value < 0n) {
    throw new Error('Square root of negative numbers is not supported');
  }
  
  if (value < 2n) {
    return value;
  }
  
  let z = value;
  let x = value / 2n + 1n;
  
  while (x < z) {
    z = x;
    x = (value / x + x) / 2n;
  }
  
  return z;
}
