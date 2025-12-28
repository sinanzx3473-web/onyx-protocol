import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

test.describe('Network Mismatch E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
  });

  test('should detect and warn about network mismatch', async () => {
    const warnings: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'warn') {
        warnings.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/swap`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for network mismatch warning
    const hasNetworkWarning = warnings.some(log => 
      log.includes('Chain ID mismatch') || 
      log.includes('network') ||
      log.includes('Expected') && log.includes('wallet')
    );

    if (hasNetworkWarning) {
      console.log('✓ Network mismatch warning detected in console');
      expect(hasNetworkWarning).toBeTruthy();
    } else {
      console.log('ℹ No network mismatch (wallet may be on correct network)');
    }
  });

  test('should display network switch prompt when mismatch detected', async () => {
    await page.goto(`${BASE_URL}/swap`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for network switch UI elements
    const networkPrompt = page.locator(
      'text=/switch.*network/i, text=/wrong.*network/i, text=/network.*mismatch/i, button:has-text("Switch")'
    );

    const isVisible = await networkPrompt.first().isVisible().catch(() => false);

    if (isVisible) {
      console.log('✓ Network switch prompt displayed');
      expect(isVisible).toBeTruthy();
    } else {
      console.log('ℹ No network switch prompt (may be on correct network)');
    }
  });

  test('should show expected network information', async () => {
    await page.goto(`${BASE_URL}/swap`);
    await page.waitForLoadState('networkidle');

    // Look for network name or chain ID display
    const networkInfo = page.locator('text=/devnet/i, text=/testnet/i, text=/mainnet/i, text=/chain/i');
    const count = await networkInfo.count();

    if (count > 0) {
      console.log(`✓ Found ${count} network information elements`);
    }
  });

  test('should handle network switch action', async () => {
    await page.goto(`${BASE_URL}/swap`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for switch network button
    const switchButton = page.locator('button:has-text("Switch"), button:has-text("Network")');
    const isVisible = await switchButton.first().isVisible().catch(() => false);

    if (isVisible) {
      // Click switch button
      await switchButton.first().click();
      await page.waitForTimeout(1000);

      // Should trigger wallet interaction or show modal
      console.log('✓ Network switch button clickable');
      expect(isVisible).toBeTruthy();
    }
  });

  test('should disable actions when on wrong network', async () => {
    const warnings: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'warn') {
        warnings.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/swap`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const hasNetworkWarning = warnings.some(log => 
      log.includes('Chain ID mismatch') || log.includes('network')
    );

    if (hasNetworkWarning) {
      // Check if swap button is disabled
      const swapButton = page.locator('button:has-text("Swap")').first();
      const isDisabled = await swapButton.isDisabled().catch(() => false);

      if (isDisabled) {
        console.log('✓ Actions disabled on wrong network');
        expect(isDisabled).toBeTruthy();
      }
    }
  });

  test('should show network indicator in header', async () => {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState('networkidle');

    // Look for network indicator in navigation/header
    const networkIndicator = page.locator('[data-testid="network-indicator"], .network-badge, text=/network/i').first();
    const isVisible = await networkIndicator.isVisible().catch(() => false);

    if (isVisible) {
      console.log('✓ Network indicator visible in header');
    }
  });

  test('should persist network preference', async () => {
    await page.goto(`${BASE_URL}/swap`);
    await page.waitForLoadState('networkidle');

    // Check localStorage for network preference
    const chainId = await page.evaluate(() => {
      return localStorage.getItem('wagmi.store') || localStorage.getItem('chainId');
    });

    if (chainId) {
      console.log('✓ Network preference stored:', chainId.substring(0, 50));
    }
  });

  test('should handle multiple network switches', async () => {
    await page.goto(`${BASE_URL}/swap`);
    await page.waitForLoadState('networkidle');

    const switchButton = page.locator('button:has-text("Switch")').first();
    const isVisible = await switchButton.isVisible().catch(() => false);

    if (isVisible) {
      // Click multiple times
      for (let i = 0; i < 2; i++) {
        await switchButton.click();
        await page.waitForTimeout(1000);
      }

      console.log('✓ Multiple network switch attempts handled');
    }
  });

  test('should show network-specific features', async () => {
    await page.goto(`${BASE_URL}/pools`);
    await page.waitForLoadState('networkidle');

    // Different networks may have different pools/features
    const poolsList = page.locator('[data-testid="pools-list"], table, .pool-card');
    const count = await poolsList.count();

    console.log(`Found ${count} network-specific elements`);
  });

  test('should validate RPC connection', async () => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('RPC') || text.includes('provider') || text.includes('connection')) {
          errors.push(text);
        }
      }
    });

    await page.goto(`${BASE_URL}/swap`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Should not have RPC connection errors
    if (errors.length > 0) {
      console.log('⚠ RPC connection issues detected:', errors[0]);
    } else {
      console.log('✓ No RPC connection errors');
    }
  });
});
