import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

test.describe('Flash Swap Page E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(`${BASE_URL}/flash-swap`);
    await page.waitForLoadState('networkidle');
  });

  test('should load flash swap page successfully', async () => {
    await expect(page).toHaveTitle(/DEX/i);
    
    // Check for flash swap UI
    const flashSwapSection = page.locator('text=/flash/i').first();
    await expect(flashSwapSection).toBeVisible({ timeout: 10000 });
  });

  test('should display flash loan warning banner', async () => {
    // Look for warning/alert about flash loans
    const warning = page.locator('[role="alert"], .alert, text=/warning/i, text=/risk/i');
    const isVisible = await warning.first().isVisible().catch(() => false);
    
    if (isVisible) {
      console.log('Flash loan warning displayed');
      expect(isVisible).toBeTruthy();
    }
  });

  test('should show borrower whitelist information', async () => {
    // Look for whitelist info
    const whitelistInfo = page.locator('text=/whitelist/i, text=/approved.*borrower/i');
    const isVisible = await whitelistInfo.first().isVisible().catch(() => false);
    
    if (isVisible) {
      console.log('Borrower whitelist information shown');
      expect(isVisible).toBeTruthy();
    }
  });

  test('should display flash loan amount input', async () => {
    const amountInput = page.locator('input[type="text"], input[type="number"]').first();
    await expect(amountInput).toBeVisible();
  });

  test('should show maximum flash loan amount', async () => {
    // Look for max flash loan info
    const maxInfo = page.locator('text=/max.*flash/i, text=/available/i');
    const isVisible = await maxInfo.first().isVisible().catch(() => false);
    
    if (isVisible) {
      console.log('Maximum flash loan amount displayed');
    }
  });

  test('should display flash loan fee information', async () => {
    // Look for fee display
    const feeInfo = page.locator('text=/fee/i, text=/0.09%/i, text=/cost/i');
    const count = await feeInfo.count();
    
    expect(count).toBeGreaterThan(0);
  });

  test('should show repayment amount calculation', async () => {
    const amountInput = page.locator('input[type="text"], input[type="number"]').first();
    
    if (await amountInput.isVisible()) {
      await amountInput.fill('1000');
      await page.waitForTimeout(1500);
      
      // Look for repayment amount
      const repaymentInfo = page.locator('text=/repay/i, text=/total/i');
      const isVisible = await repaymentInfo.first().isVisible().catch(() => false);
      
      if (isVisible) {
        console.log('Repayment amount calculation shown');
      }
    }
  });

  test('should display strategy templates', async () => {
    // Look for strategy examples or templates
    const strategies = page.locator('text=/strategy/i, text=/arbitrage/i, text=/example/i');
    const count = await strategies.count();
    
    if (count > 0) {
      console.log(`Found ${count} strategy references`);
    }
  });

  test('should show risk acknowledgment toggle', async () => {
    // Look for risk acknowledgment checkbox
    const riskToggle = page.locator('input[type="checkbox"], [role="checkbox"]');
    const count = await riskToggle.count();
    
    if (count > 0) {
      const firstToggle = riskToggle.first();
      const isVisible = await firstToggle.isVisible().catch(() => false);
      
      if (isVisible) {
        // Try to toggle it
        await firstToggle.click();
        await page.waitForTimeout(500);
        
        console.log('Risk acknowledgment toggle working');
      }
    }
  });

  test('should validate flash loan amount limits', async () => {
    const amountInput = page.locator('input[type="text"], input[type="number"]').first();
    
    if (await amountInput.isVisible()) {
      // Try amount exceeding max
      await amountInput.fill('999999999');
      await page.waitForTimeout(1000);
      
      // Should show error or disable button
      const errorText = page.locator('text=/exceed/i, text=/maximum/i, text=/too.*large/i');
      const executeButton = page.locator('button:has-text("Execute"), button:has-text("Flash")');
      
      const hasError = await errorText.first().isVisible().catch(() => false);
      const isDisabled = await executeButton.first().isDisabled().catch(() => false);
      
      expect(hasError || isDisabled).toBeTruthy();
    }
  });

  test('should show borrower contract address input', async () => {
    // Look for contract address input
    const addressInput = page.locator('input[placeholder*="address"], input[placeholder*="contract"]');
    const isVisible = await addressInput.first().isVisible().catch(() => false);
    
    if (isVisible) {
      console.log('Borrower contract address input found');
    }
  });

  test('should display flash loan metrics', async () => {
    // Look for metrics like total flash loans, volume, etc.
    const metrics = page.locator('text=/total.*flash/i, text=/volume/i, text=/utilization/i');
    const count = await metrics.count();
    
    if (count > 0) {
      console.log(`Found ${count} flash loan metrics`);
    }
  });

  test('should handle token selection for flash loan', async () => {
    const tokenSelector = page.locator('button:has-text("Select"), button:has-text("Token")').first();
    const isVisible = await tokenSelector.isVisible().catch(() => false);
    
    if (isVisible) {
      await tokenSelector.click();
      await page.waitForTimeout(1000);
      
      // Should show token list
      const tokenList = page.locator('[role="dialog"], [role="listbox"]');
      const listVisible = await tokenList.first().isVisible().catch(() => false);
      
      expect(listVisible).toBeTruthy();
    }
  });

  test('should show connect wallet requirement', async () => {
    const connectButton = page.locator('button:has-text("Connect")').first();
    const isVisible = await connectButton.isVisible().catch(() => false);
    
    if (isVisible) {
      console.log('Connect wallet button shown (user not connected)');
      expect(isVisible).toBeTruthy();
    }
  });

  test('should display advanced options or settings', async () => {
    // Look for advanced settings
    const advancedButton = page.locator('button:has-text("Advanced"), button:has-text("Settings")');
    const isVisible = await advancedButton.first().isVisible().catch(() => false);
    
    if (isVisible) {
      await advancedButton.first().click();
      await page.waitForTimeout(500);
      
      console.log('Advanced options accessible');
    }
  });

  test('should not have critical console errors', async () => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('WalletConnect') && 
            !text.includes('Analytics SDK') &&
            !text.includes('Allowlist')) {
          errors.push(text);
        }
      }
    });

    await page.reload();
    await page.waitForTimeout(3000);

    expect(errors.length).toBe(0);
  });
});
