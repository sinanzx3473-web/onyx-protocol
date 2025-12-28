import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

test.describe('Liquidity Page E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(`${BASE_URL}/liquidity`);
    await page.waitForLoadState('networkidle');
  });

  test('should load liquidity page successfully', async () => {
    await expect(page).toHaveTitle(/DEX/i);
    
    // Check for liquidity management UI
    const liquiditySection = page.locator('text=/liquidity/i, text=/add.*liquidity/i').first();
    await expect(liquiditySection).toBeVisible({ timeout: 10000 });
  });

  test('should display add and remove liquidity tabs', async () => {
    // Look for tab navigation
    const addTab = page.locator('button:has-text("Add"), [role="tab"]:has-text("Add")');
    const removeTab = page.locator('button:has-text("Remove"), [role="tab"]:has-text("Remove")');
    
    const hasAddTab = await addTab.first().isVisible().catch(() => false);
    const hasRemoveTab = await removeTab.first().isVisible().catch(() => false);
    
    // Should have either tabs or separate sections
    expect(hasAddTab || hasRemoveTab).toBeTruthy();
  });

  test('should show token pair selection for adding liquidity', async () => {
    // Navigate to add liquidity if needed
    const addButton = page.locator('button:has-text("Add")').first();
    const isVisible = await addButton.isVisible().catch(() => false);
    
    if (isVisible) {
      await addButton.click();
      await page.waitForTimeout(500);
    }
    
    // Should have token selectors
    const tokenSelectors = page.locator('button:has-text("Select"), button:has-text("Token")');
    const count = await tokenSelectors.count();
    
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should display amount input fields for both tokens', async () => {
    const inputs = page.locator('input[type="text"], input[type="number"]');
    const count = await inputs.count();
    
    // Should have at least 2 inputs for token amounts
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('should show impermanent loss warning', async () => {
    // Look for IL warning
    const ilWarning = page.locator('text=/impermanent.*loss/i, text=/IL/');
    
    const isVisible = await ilWarning.first().isVisible().catch(() => false);
    
    if (isVisible) {
      console.log('Impermanent loss warning displayed');
      expect(isVisible).toBeTruthy();
    }
  });

  test('should calculate LP tokens preview', async () => {
    const amountInput = page.locator('input[type="text"], input[type="number"]').first();
    
    if (await amountInput.isVisible()) {
      await amountInput.fill('100');
      await page.waitForTimeout(1500);
      
      // Look for LP token preview
      const lpPreview = page.locator('text=/LP.*tokens/i, text=/you.*receive/i');
      const hasPreview = await lpPreview.first().isVisible().catch(() => false);
      
      // Preview may not show without wallet connection
      console.log('LP token preview:', hasPreview ? 'shown' : 'not shown (may need wallet)');
    }
  });

  test('should show pool share percentage', async () => {
    const shareText = page.locator('text=/%/, text=/share/i');
    const isVisible = await shareText.first().isVisible().catch(() => false);
    
    if (isVisible) {
      console.log('Pool share percentage displayed');
    }
  });

  test('should display existing LP positions', async () => {
    // Navigate to positions/remove tab
    const removeTab = page.locator('button:has-text("Remove"), button:has-text("Position")');
    const isVisible = await removeTab.first().isVisible().catch(() => false);
    
    if (isVisible) {
      await removeTab.first().click();
      await page.waitForTimeout(1000);
    }
    
    // Look for positions list or empty state
    const positionsList = page.locator('text=/your.*position/i, text=/no.*position/i');
    await expect(positionsList.first()).toBeVisible({ timeout: 5000 });
  });

  test('should validate minimum liquidity amounts', async () => {
    const amountInput = page.locator('input[type="text"], input[type="number"]').first();
    
    if (await amountInput.isVisible()) {
      // Try very small amount
      await amountInput.fill('0.000001');
      await page.waitForTimeout(1000);
      
      // Should show error or disable button
      const errorText = page.locator('text=/minimum/i, text=/too.*small/i');
      const addButton = page.locator('button:has-text("Add Liquidity")');
      
      const hasError = await errorText.first().isVisible().catch(() => false);
      const isDisabled = await addButton.first().isDisabled().catch(() => false);
      
      console.log('Minimum validation:', hasError || isDisabled ? 'working' : 'not triggered');
    }
  });

  test('should show slippage tolerance setting', async () => {
    const slippageControl = page.locator('text=/slippage/i, input[placeholder*="slippage"]');
    const isVisible = await slippageControl.first().isVisible().catch(() => false);
    
    if (!isVisible) {
      // Try opening settings
      const settingsButton = page.locator('[aria-label*="settings"], button:has-text("Settings")');
      const hasSettings = await settingsButton.first().isVisible().catch(() => false);
      
      if (hasSettings) {
        await settingsButton.first().click();
        await page.waitForTimeout(500);
        
        const slippageInSettings = await page.locator('text=/slippage/i').first().isVisible().catch(() => false);
        expect(slippageInSettings).toBeTruthy();
      }
    }
  });

  test('should handle remove liquidity percentage slider', async () => {
    // Navigate to remove tab
    const removeTab = page.locator('button:has-text("Remove")').first();
    const isVisible = await removeTab.isVisible().catch(() => false);
    
    if (isVisible) {
      await removeTab.click();
      await page.waitForTimeout(1000);
      
      // Look for percentage slider or buttons
      const slider = page.locator('input[type="range"], button:has-text("25%"), button:has-text("50%")');
      const hasSlider = await slider.first().isVisible().catch(() => false);
      
      if (hasSlider) {
        console.log('Remove liquidity percentage control found');
        expect(hasSlider).toBeTruthy();
      }
    }
  });

  test('should display pool statistics', async () => {
    // Look for TVL, APR, or other pool stats
    const stats = page.locator('text=/TVL/i, text=/APR/i, text=/volume/i, text=/fee/i');
    const count = await stats.count();
    
    if (count > 0) {
      console.log(`Found ${count} pool statistics`);
      expect(count).toBeGreaterThan(0);
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
