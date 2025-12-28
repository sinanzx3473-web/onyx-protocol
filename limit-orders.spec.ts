import { test, expect } from '@playwright/test';

test.describe('Limit Orders', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');
  });

  test('should display limit order tab on swap page', async ({ page }) => {
    // Check for swap mode tabs
    const instantTab = page.getByRole('tab', { name: /instant swap/i });
    const limitTab = page.getByRole('tab', { name: /limit order/i });

    await expect(instantTab).toBeVisible();
    await expect(limitTab).toBeVisible();
  });

  test('should switch between instant and limit order modes', async ({ page }) => {
    // Click limit order tab
    await page.getByRole('tab', { name: /limit order/i }).click();

    // Verify limit order UI is displayed
    await expect(page.getByText(/set a target price/i)).toBeVisible();
    await expect(page.getByLabel(/order type/i)).toBeVisible();
    await expect(page.getByLabel(/target price/i)).toBeVisible();

    // Switch back to instant
    await page.getByRole('tab', { name: /instant swap/i }).click();

    // Verify instant swap UI is displayed
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible();
  });

  test('should display limit and stop order type options', async ({ page }) => {
    await page.getByRole('tab', { name: /limit order/i }).click();

    // Check for order type tabs
    const limitOrderTab = page.getByRole('tab', { name: /limit order/i }).first();
    const stopOrderTab = page.getByRole('tab', { name: /stop order/i });

    await expect(limitOrderTab).toBeVisible();
    await expect(stopOrderTab).toBeVisible();
  });

  test('should show current price information', async ({ page }) => {
    await page.getByRole('tab', { name: /limit order/i }).click();

    // Current price should be displayed
    await expect(page.getByText(/current price/i)).toBeVisible();
  });

  test('should calculate minimum received based on target price', async ({ page }) => {
    await page.getByRole('tab', { name: /limit order/i }).click();

    // Enter amount in instant swap first to get a price
    await page.getByRole('tab', { name: /instant swap/i }).click();
    await page.getByLabel(/from amount/i).fill('10');
    
    // Switch to limit order
    await page.getByRole('tab', { name: /limit order/i }).click();

    // Enter target price
    const targetPriceInput = page.getByLabel(/target price/i);
    await targetPriceInput.fill('2.5');

    // Check that minimum received is calculated
    await expect(page.getByText(/you will receive/i)).toBeVisible();
  });

  test('should show price difference percentage', async ({ page }) => {
    await page.getByRole('tab', { name: /limit order/i }).click();

    // Enter amount in instant swap first
    await page.getByRole('tab', { name: /instant swap/i }).click();
    await page.getByLabel(/from amount/i).fill('10');
    
    // Switch to limit order
    await page.getByRole('tab', { name: /limit order/i }).click();

    // Enter target price different from current
    await page.getByLabel(/target price/i).fill('3.0');

    // Should show percentage difference
    await expect(page.locator('text=/[+-]?\\d+\\.\\d+%/')).toBeVisible();
  });

  test('should validate expiry time input', async ({ page }) => {
    await page.getByRole('tab', { name: /limit order/i }).click();

    const expiryInput = page.getByLabel(/expiry time/i);
    
    // Test minimum value
    await expiryInput.fill('0');
    await expect(expiryInput).toHaveValue('0');

    // Test maximum value
    await expiryInput.fill('200');
    await expect(expiryInput).toHaveValue('200');

    // Test valid value
    await expiryInput.fill('24');
    await expect(expiryInput).toHaveValue('24');
  });

  test('should require wallet connection to create order', async ({ page }) => {
    await page.getByRole('tab', { name: /limit order/i }).click();

    // Fill in order details
    await page.getByLabel(/target price/i).fill('2.5');
    await page.getByLabel(/expiry time/i).fill('24');

    // Create order button should be disabled without wallet
    const createButton = page.getByRole('button', { name: /create.*order/i });
    await expect(createButton).toBeDisabled();
  });

  test('should display order type descriptions', async ({ page }) => {
    await page.getByRole('tab', { name: /limit order/i }).click();

    // Check limit order description
    await expect(page.getByText(/execute when price reaches or exceeds target/i)).toBeVisible();

    // Switch to stop order
    await page.getByRole('tab', { name: /stop order/i }).click();

    // Check stop order description
    await expect(page.getByText(/execute when price drops to or below target/i)).toBeVisible();
  });

  test('should show info alert about off-chain monitoring', async ({ page }) => {
    await page.getByRole('tab', { name: /limit order/i }).click();

    // Check for info alert
    await expect(page.getByText(/monitored off-chain/i)).toBeVisible();
    await expect(page.getByText(/cancel anytime before execution/i)).toBeVisible();
  });

  test('should display my orders tab in account page', async ({ page }) => {
    await page.goto('/my-account');
    await page.waitForLoadState('networkidle');

    // Check for limit orders tab
    const ordersTab = page.getByRole('tab', { name: /limit orders/i });
    await expect(ordersTab).toBeVisible();
  });

  test('should show order status tabs in my orders', async ({ page }) => {
    await page.goto('/my-account');
    await page.waitForLoadState('networkidle');

    // Click limit orders tab
    await page.getByRole('tab', { name: /limit orders/i }).click();

    // Check for status tabs
    await expect(page.getByRole('tab', { name: /open/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /filled/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /cancelled/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /expired/i })).toBeVisible();
  });

  test('should show connect wallet message when not connected', async ({ page }) => {
    await page.goto('/my-account');
    await page.waitForLoadState('networkidle');

    // Click limit orders tab
    await page.getByRole('tab', { name: /limit orders/i }).click();

    // Should show connect wallet message
    await expect(page.getByText(/connect your wallet to view your limit orders/i)).toBeVisible();
  });

  test('should be keyboard accessible', async ({ page }) => {
    await page.getByRole('tab', { name: /limit order/i }).click();

    // Tab through form elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should be able to navigate to target price input
    const targetPriceInput = page.getByLabel(/target price/i);
    await targetPriceInput.focus();
    await expect(targetPriceInput).toBeFocused();

    // Should be able to navigate to expiry input
    await page.keyboard.press('Tab');
    const expiryInput = page.getByLabel(/expiry time/i);
    await expect(expiryInput).toBeFocused();

    // Should be able to navigate to create button
    await page.keyboard.press('Tab');
    const createButton = page.getByRole('button', { name: /create.*order/i });
    await expect(createButton).toBeFocused();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.getByRole('tab', { name: /limit order/i }).click();

    // Check for proper labels
    await expect(page.getByLabel(/target price/i)).toBeVisible();
    await expect(page.getByLabel(/expiry time/i)).toBeVisible();
    await expect(page.getByLabel(/order type/i)).toBeVisible();
  });

  test('should display order count in status tabs', async ({ page }) => {
    await page.goto('/my-account');
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: /limit orders/i }).click();

    // Status tabs should show counts
    await expect(page.getByRole('tab', { name: /open.*\(\d+\)/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /filled.*\(\d+\)/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /cancelled.*\(\d+\)/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /expired.*\(\d+\)/i })).toBeVisible();
  });
});
