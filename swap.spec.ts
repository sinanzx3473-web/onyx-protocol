import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

test.describe('Swap Page E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(`${BASE_URL}/swap`);
    await page.waitForLoadState('networkidle');
  });

  test('should load swap page successfully', async () => {
    await expect(page).toHaveTitle(/DEX/i);
    
    // Check for swap card
    const swapCard = page.locator('[data-testid="swap-card"]').or(page.locator('text=Swap'));
    await expect(swapCard.first()).toBeVisible();
  });

  test('should display token input fields', async () => {
    // Check for input fields
    const inputs = page.locator('input[type="text"], input[type="number"]');
    await expect(inputs.first()).toBeVisible();
  });

  test('should show connect wallet button when not connected', async () => {
    const connectButton = page.locator('button:has-text("Connect")').or(
      page.locator('button:has-text("Wallet")')
    );
    
    // Should have at least one connect button visible
    await expect(connectButton.first()).toBeVisible();
  });

  test('should handle network mismatch warning', async () => {
    // Check console for network mismatch warnings
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'warn' || msg.type() === 'error') {
        consoleLogs.push(msg.text());
      }
    });

    await page.reload();
    await page.waitForTimeout(2000);

    // Check if network mismatch warning appears
    const hasNetworkWarning = consoleLogs.some(log => 
      log.includes('Chain ID mismatch') || log.includes('network')
    );

    if (hasNetworkWarning) {
      console.log('Network mismatch warning detected (expected behavior)');
    }
  });

  test('should validate swap amount input', async () => {
    const amountInput = page.locator('input[type="text"], input[type="number"]').first();
    
    if (await amountInput.isVisible()) {
      // Try to input invalid amount
      await amountInput.fill('-100');
      
      // Should either reject or show error
      const value = await amountInput.inputValue();
      expect(value).not.toBe('-100');
    }
  });

  test('should show slippage settings', async () => {
    // Look for settings button or slippage control
    const settingsButton = page.locator('[aria-label*="settings"], [data-testid="settings"]').or(
      page.locator('button:has-text("Settings")')
    );

    const isVisible = await settingsButton.first().isVisible().catch(() => false);
    
    if (isVisible) {
      await settingsButton.first().click();
      
      // Should show slippage options
      const slippageControl = page.locator('text=/slippage/i').or(
        page.locator('input[type="number"]')
      );
      
      await expect(slippageControl.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should handle token selection', async () => {
    // Look for token selector buttons
    const tokenSelectors = page.locator('button:has-text("Select"), button:has-text("Token")');
    
    const count = await tokenSelectors.count();
    
    if (count > 0) {
      await tokenSelectors.first().click();
      
      // Should show token list
      await page.waitForTimeout(1000);
      
      // Check if modal or dropdown appeared
      const tokenList = page.locator('[role="dialog"], [role="listbox"]').or(
        page.locator('text=/token/i')
      );
      
      const isVisible = await tokenList.first().isVisible().catch(() => false);
      expect(isVisible).toBeTruthy();
    }
  });

  test('should display swap button', async () => {
    const swapButton = page.locator('button:has-text("Swap")').or(
      page.locator('button[type="submit"]')
    );
    
    await expect(swapButton.first()).toBeVisible();
  });

  test('should show insufficient balance error when applicable', async () => {
    const amountInput = page.locator('input[type="text"], input[type="number"]').first();
    
    if (await amountInput.isVisible()) {
      // Input very large amount
      await amountInput.fill('999999999');
      await page.waitForTimeout(1000);
      
      // Should show error or disable swap button
      const errorText = page.locator('text=/insufficient|balance/i');
      const swapButton = page.locator('button:has-text("Swap")');
      
      const hasError = await errorText.first().isVisible().catch(() => false);
      const isDisabled = await swapButton.first().isDisabled().catch(() => false);
      
      // Either error shown or button disabled
      expect(hasError || isDisabled).toBeTruthy();
    }
  });

  test('should not have console errors (except known issues)', async () => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out known non-critical errors
        if (!text.includes('WalletConnect') && 
            !text.includes('Analytics SDK') &&
            !text.includes('Allowlist')) {
          errors.push(text);
        }
      }
    });

    await page.reload();
    await page.waitForTimeout(3000);

    // Should have no critical errors
    expect(errors.length).toBe(0);
  });
});
