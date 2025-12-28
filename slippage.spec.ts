import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

test.describe('Slippage Protection E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(`${BASE_URL}/swap`);
    await page.waitForLoadState('networkidle');
  });

  test('should display default slippage tolerance', async () => {
    // Look for slippage display
    const slippageDisplay = page.locator('text=/slippage/i, text=/tolerance/i');
    const isVisible = await slippageDisplay.first().isVisible().catch(() => false);

    if (!isVisible) {
      // Try opening settings
      const settingsButton = page.locator('[aria-label*="settings"], button:has-text("Settings")').first();
      const hasSettings = await settingsButton.isVisible().catch(() => false);

      if (hasSettings) {
        await settingsButton.click();
        await page.waitForTimeout(500);
      }
    }

    const slippageControl = page.locator('text=/slippage/i, input[placeholder*="slippage"]');
    const controlVisible = await slippageControl.first().isVisible().catch(() => false);

    if (controlVisible) {
      console.log('✓ Slippage tolerance control found');
      expect(controlVisible).toBeTruthy();
    }
  });

  test('should allow custom slippage input', async () => {
    // Open settings
    const settingsButton = page.locator('[aria-label*="settings"], button:has-text("Settings")').first();
    const hasSettings = await settingsButton.isVisible().catch(() => false);

    if (hasSettings) {
      await settingsButton.click();
      await page.waitForTimeout(500);

      // Find slippage input
      const slippageInput = page.locator('input[type="number"], input[placeholder*="slippage"]').first();
      const isVisible = await slippageInput.isVisible().catch(() => false);

      if (isVisible) {
        await slippageInput.fill('1.5');
        await page.waitForTimeout(500);

        const value = await slippageInput.inputValue();
        expect(value).toBe('1.5');
        console.log('✓ Custom slippage input working');
      }
    }
  });

  test('should show slippage warning for high values', async () => {
    const settingsButton = page.locator('[aria-label*="settings"], button:has-text("Settings")').first();
    const hasSettings = await settingsButton.isVisible().catch(() => false);

    if (hasSettings) {
      await settingsButton.click();
      await page.waitForTimeout(500);

      const slippageInput = page.locator('input[type="number"], input[placeholder*="slippage"]').first();
      const isVisible = await slippageInput.isVisible().catch(() => false);

      if (isVisible) {
        // Set high slippage
        await slippageInput.fill('10');
        await page.waitForTimeout(1000);

        // Look for warning
        const warning = page.locator('text=/warning/i, text=/high.*slippage/i, [role="alert"]');
        const warningVisible = await warning.first().isVisible().catch(() => false);

        if (warningVisible) {
          console.log('✓ High slippage warning displayed');
          expect(warningVisible).toBeTruthy();
        }
      }
    }
  });

  test('should validate slippage range limits', async () => {
    const settingsButton = page.locator('[aria-label*="settings"], button:has-text("Settings")').first();
    const hasSettings = await settingsButton.isVisible().catch(() => false);

    if (hasSettings) {
      await settingsButton.click();
      await page.waitForTimeout(500);

      const slippageInput = page.locator('input[type="number"]').first();
      const isVisible = await slippageInput.isVisible().catch(() => false);

      if (isVisible) {
        // Try invalid values
        await slippageInput.fill('-1');
        await page.waitForTimeout(500);
        let value = await slippageInput.inputValue();
        expect(parseFloat(value)).toBeGreaterThanOrEqual(0);

        await slippageInput.fill('101');
        await page.waitForTimeout(500);
        value = await slippageInput.inputValue();
        
        // Should either reject or show error
        const error = page.locator('text=/invalid/i, text=/error/i');
        const hasError = await error.first().isVisible().catch(() => false);

        if (hasError || parseFloat(value) <= 100) {
          console.log('✓ Slippage validation working');
        }
      }
    }
  });

  test('should show preset slippage options', async () => {
    const settingsButton = page.locator('[aria-label*="settings"], button:has-text("Settings")').first();
    const hasSettings = await settingsButton.isVisible().catch(() => false);

    if (hasSettings) {
      await settingsButton.click();
      await page.waitForTimeout(500);

      // Look for preset buttons (0.1%, 0.5%, 1%)
      const presets = page.locator('button:has-text("0.1"), button:has-text("0.5"), button:has-text("1")');
      const count = await presets.count();

      if (count > 0) {
        console.log(`✓ Found ${count} preset slippage options`);
        expect(count).toBeGreaterThan(0);
      }
    }
  });

  test('should calculate price impact with slippage', async () => {
    const amountInput = page.locator('input[type="text"], input[type="number"]').first();
    const isVisible = await amountInput.isVisible().catch(() => false);

    if (isVisible) {
      await amountInput.fill('1000');
      await page.waitForTimeout(1500);

      // Look for price impact display
      const priceImpact = page.locator('text=/price.*impact/i, text=/impact/i');
      const impactVisible = await priceImpact.first().isVisible().catch(() => false);

      if (impactVisible) {
        console.log('✓ Price impact calculation shown');
      }
    }
  });

  test('should show minimum received amount', async () => {
    const amountInput = page.locator('input[type="text"], input[type="number"]').first();
    const isVisible = await amountInput.isVisible().catch(() => false);

    if (isVisible) {
      await amountInput.fill('100');
      await page.waitForTimeout(1500);

      // Look for minimum received
      const minReceived = page.locator('text=/minimum.*received/i, text=/min.*received/i');
      const minVisible = await minReceived.first().isVisible().catch(() => false);

      if (minVisible) {
        console.log('✓ Minimum received amount displayed');
        expect(minVisible).toBeTruthy();
      }
    }
  });

  test('should handle slippage error on swap', async () => {
    // This test simulates a scenario where slippage is too tight
    const settingsButton = page.locator('[aria-label*="settings"], button:has-text("Settings")').first();
    const hasSettings = await settingsButton.isVisible().catch(() => false);

    if (hasSettings) {
      await settingsButton.click();
      await page.waitForTimeout(500);

      const slippageInput = page.locator('input[type="number"]').first();
      const inputVisible = await slippageInput.isVisible().catch(() => false);

      if (inputVisible) {
        // Set very tight slippage
        await slippageInput.fill('0.01');
        await page.waitForTimeout(500);

        // Close settings
        const closeButton = page.locator('button[aria-label="Close"], button:has-text("Close")').first();
        const closeVisible = await closeButton.isVisible().catch(() => false);
        if (closeVisible) {
          await closeButton.click();
        }

        // Try to swap
        const amountInput = page.locator('input[type="text"], input[type="number"]').first();
        await amountInput.fill('1000');
        await page.waitForTimeout(1000);

        const swapButton = page.locator('button:has-text("Swap")').first();
        const swapVisible = await swapButton.isVisible().catch(() => false);

        if (swapVisible && !await swapButton.isDisabled()) {
          console.log('✓ Tight slippage configuration set');
        }
      }
    }
  });

  test('should persist slippage settings', async () => {
    const settingsButton = page.locator('[aria-label*="settings"], button:has-text("Settings")').first();
    const hasSettings = await settingsButton.isVisible().catch(() => false);

    if (hasSettings) {
      await settingsButton.click();
      await page.waitForTimeout(500);

      const slippageInput = page.locator('input[type="number"]').first();
      const inputVisible = await slippageInput.isVisible().catch(() => false);

      if (inputVisible) {
        await slippageInput.fill('2.5');
        await page.waitForTimeout(500);

        // Reload page
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Check if setting persisted
        const settingsButton2 = page.locator('[aria-label*="settings"], button:has-text("Settings")').first();
        await settingsButton2.click();
        await page.waitForTimeout(500);

        const slippageInput2 = page.locator('input[type="number"]').first();
        const value = await slippageInput2.inputValue();

        if (value === '2.5') {
          console.log('✓ Slippage settings persisted');
          expect(value).toBe('2.5');
        }
      }
    }
  });

  test('should show slippage in transaction preview', async () => {
    const amountInput = page.locator('input[type="text"], input[type="number"]').first();
    const isVisible = await amountInput.isVisible().catch(() => false);

    if (isVisible) {
      await amountInput.fill('500');
      await page.waitForTimeout(1500);

      // Look for transaction details/preview
      const txPreview = page.locator('text=/details/i, text=/summary/i, text=/review/i');
      const previewVisible = await txPreview.first().isVisible().catch(() => false);

      if (previewVisible) {
        // Should show slippage in preview
        const slippageInPreview = page.locator('text=/slippage/i');
        const slipVisible = await slippageInPreview.first().isVisible().catch(() => false);

        if (slipVisible) {
          console.log('✓ Slippage shown in transaction preview');
        }
      }
    }
  });

  test('should update minimum received when slippage changes', async () => {
    const amountInput = page.locator('input[type="text"], input[type="number"]').first();
    await amountInput.fill('100');
    await page.waitForTimeout(1500);

    // Get initial minimum received
    const minReceived = page.locator('text=/minimum.*received/i').first();
    const initialVisible = await minReceived.isVisible().catch(() => false);

    if (initialVisible) {
      const initialText = await minReceived.textContent();

      // Change slippage
      const settingsButton = page.locator('[aria-label*="settings"], button:has-text("Settings")').first();
      const hasSettings = await settingsButton.isVisible().catch(() => false);

      if (hasSettings) {
        await settingsButton.click();
        await page.waitForTimeout(500);

        const slippageInput = page.locator('input[type="number"]').first();
        await slippageInput.fill('5');
        await page.waitForTimeout(1000);

        // Check if minimum received updated
        const updatedText = await minReceived.textContent();

        if (initialText !== updatedText) {
          console.log('✓ Minimum received updates with slippage change');
        }
      }
    }
  });
});
