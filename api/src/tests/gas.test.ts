import { describe, it, expect } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3001';

describe('Gas Estimate Endpoint', () => {
  it('should estimate gas for swap operation', async () => {
    const response = await fetch(`${API_URL}/api/gas-estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'swap',
        tokenA: '0x1234567890123456789012345678901234567890',
        tokenB: '0x0987654321098765432109876543210987654321',
        amount: '1000000000000000000'
      })
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('estimatedGas');
    expect(data.data).toHaveProperty('gasPrice');
    expect(data.data).toHaveProperty('estimatedCostWei');
    expect(data.data).toHaveProperty('estimatedCostEth');
    expect(data.data.operation).toBe('swap');
  });

  it('should reject invalid operation', async () => {
    const response = await fetch(`${API_URL}/api/gas-estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'invalid',
        tokenA: '0x1234567890123456789012345678901234567890',
        tokenB: '0x0987654321098765432109876543210987654321',
        amount: '1000000000000000000'
      })
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Validation failed');
  });

  it('should reject invalid token address', async () => {
    const response = await fetch(`${API_URL}/api/gas-estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'swap',
        tokenA: 'invalid-address',
        tokenB: '0x0987654321098765432109876543210987654321',
        amount: '1000000000000000000'
      })
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should estimate gas for addLiquidity operation', async () => {
    const response = await fetch(`${API_URL}/api/gas-estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'addLiquidity',
        tokenA: '0x1234567890123456789012345678901234567890',
        tokenB: '0x0987654321098765432109876543210987654321',
        amount: '1000000000000000000'
      })
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.operation).toBe('addLiquidity');
  });
});
