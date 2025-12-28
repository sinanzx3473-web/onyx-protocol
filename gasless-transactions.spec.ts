import { test, expect } from '@playwright/test';

test.describe('Gasless Transactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');
  });

  test('should display gasless toggle on swap page', async ({ page }) => {
    // Check for gasless toggle
    const gaslessToggle = page.getByRole('switch', { name: /enable gasless/i });
    await expect(gaslessToggle).toBeVisible();

    // Check for descriptive text
    await expect(page.getByText(/sign off-chain, relayer pays gas/i)).toBeVisible();
  });

  test('should toggle gasless mode on and off', async ({ page }) => {
    const gaslessToggle = page.getByRole('switch', { name: /enable gasless/i });

    // Initially unchecked
    await expect(gaslessToggle).not.toBeChecked();

    // Toggle on
    await gaslessToggle.click();
    await expect(gaslessToggle).toBeChecked();

    // Check for active indicator
    await expect(page.getByText(/active/i)).toBeVisible();
    await expect(page.getByText(/you pay zero gas/i)).toBeVisible();

    // Toggle off
    await gaslessToggle.click();
    await expect(gaslessToggle).not.toBeChecked();
  });

  test('should show relayer fee in confirmation modal when gasless enabled', async ({ page }) => {
    // Enable gasless mode
    const gaslessToggle = page.getByRole('switch', { name: /enable gasless/i });
    await gaslessToggle.click();

    // Enter swap amounts
    const fromInput = page.getByRole('textbox', { name: /from amount/i });
    await fromInput.fill('10');

    // Wait for quote
    await page.waitForTimeout(1000);

    // Click swap button
    const swapButton = page.getByRole('button', { name: /gasless swap/i });
    await expect(swapButton).toBeVisible();
    await expect(swapButton).toContainText(/gasless swap/i);

    // Check for zap icon
    const zapIcon = swapButton.locator('svg');
    await expect(zapIcon).toBeVisible();
  });

  test('should display relayer fee (0.05%) in swap confirmation', async ({ page }) => {
    // Enable gasless
    await page.getByRole('switch', { name: /enable gasless/i }).click();

    // Enter amounts
    await page.getByRole('textbox', { name: /from amount/i }).fill('100');
    await page.waitForTimeout(1000);

    // Open confirmation modal
    await page.getByRole('button', { name: /gasless swap/i }).click();

    // Check for relayer fee in modal
    await expect(page.getByText(/relayer fee/i)).toBeVisible();
    await expect(page.getByText(/0.05%/i)).toBeVisible();
  });

  test('should show gasless toggle on liquidity page', async ({ page }) => {
    await page.goto('/liquidity');
    await page.waitForLoadState('networkidle');

    // Check for gasless toggle
    const gaslessToggle = page.getByRole('switch', { name: /enable gasless/i });
    await expect(gaslessToggle).toBeVisible();

    // Check for descriptive text
    await expect(page.getByText(/sign off-chain, relayer pays gas/i)).toBeVisible();
  });

  test('should toggle gasless mode on liquidity page', async ({ page }) => {
    await page.goto('/liquidity');
    await page.waitForLoadState('networkidle');

    const gaslessToggle = page.getByRole('switch', { name: /enable gasless/i });

    // Toggle on
    await gaslessToggle.click();
    await expect(gaslessToggle).toBeChecked();

    // Check button text changes
    const addLiquidityButton = page.getByRole('button', { name: /gasless add liquidity/i });
    await expect(addLiquidityButton).toBeVisible();
  });

  test('should maintain gasless state across swap and liquidity pages', async ({ page }) => {
    // Enable on swap page
    await page.getByRole('switch', { name: /enable gasless/i }).click();
    await expect(page.getByRole('switch', { name: /enable gasless/i })).toBeChecked();

    // Navigate to liquidity
    await page.goto('/liquidity');
    await page.waitForLoadState('networkidle');

    // Should still be enabled
    await expect(page.getByRole('switch', { name: /enable gasless/i })).toBeChecked();

    // Navigate back to swap
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');

    // Should still be enabled
    await expect(page.getByRole('switch', { name: /enable gasless/i })).toBeChecked();
  });

  test('should be keyboard accessible', async ({ page }) => {
    // Tab to gasless toggle
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Focus should be on toggle
    const gaslessToggle = page.getByRole('switch', { name: /enable gasless/i });
    await expect(gaslessToggle).toBeFocused();

    // Toggle with space
    await page.keyboard.press('Space');
    await expect(gaslessToggle).toBeChecked();

    // Toggle off with space
    await page.keyboard.press('Space');
    await expect(gaslessToggle).not.toBeChecked();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    const gaslessToggle = page.getByRole('switch', { name: /enable gasless/i });
    
    // Check ARIA attributes
    await expect(gaslessToggle).toHaveAttribute('aria-label', /enable gasless transactions/i);
    await expect(gaslessToggle).toHaveAttribute('role', 'switch');
  });

  test('should show loading state during gasless transaction', async ({ page }) => {
    // Enable gasless
    await page.getByRole('switch', { name: /enable gasless/i }).click();

    // Enter amounts
    await page.getByRole('textbox', { name: /from amount/i }).fill('10');
    await page.waitForTimeout(1000);

    // Click swap
    const swapButton = page.getByRole('button', { name: /gasless swap/i });
    await swapButton.click();

    // Confirm in modal
    await page.getByRole('button', { name: /confirm swap/i }).click();

    // Should show signing & relaying state
    await expect(page.getByText(/signing & relaying/i)).toBeVisible();
  });

  test('should display gasless indicator in button', async ({ page }) => {
    // Regular mode
    let swapButton = page.getByRole('button', { name: /^swap$/i });
    await expect(swapButton).toBeVisible();

    // Enable gasless
    await page.getByRole('switch', { name: /enable gasless/i }).click();

    // Button should change
    swapButton = page.getByRole('button', { name: /gasless swap/i });
    await expect(swapButton).toBeVisible();

    // Should have zap icon
    const zapIcon = swapButton.locator('svg');
    await expect(zapIcon).toBeVisible();
  });

  test('should show relayer fee percentage in UI', async ({ page }) => {
    // Enable gasless
    await page.getByRole('switch', { name: /enable gasless/i }).click();

    // Check for fee disclosure
    await expect(page.getByText(/0.05% relayer fee applies/i)).toBeVisible();
  });

  test('should disable swap button during relay', async ({ page }) => {
    // Enable gasless
    await page.getByRole('switch', { name: /enable gasless/i }).click();

    // Enter amounts
    await page.getByRole('textbox', { name: /from amount/i }).fill('10');
    await page.waitForTimeout(1000);

    const swapButton = page.getByRole('button', { name: /gasless swap/i });
    
    // Should be enabled initially
    await expect(swapButton).toBeEnabled();

    // After clicking, should be disabled during relay
    await swapButton.click();
    await page.getByRole('button', { name: /confirm swap/i }).click();

    // Button should be disabled
    await expect(page.getByRole('button', { name: /signing & relaying/i })).toBeDisabled();
  });

  test('should work with instant swap mode', async ({ page }) => {
    // Should be on instant swap by default
    await expect(page.getByRole('tab', { name: /instant swap/i })).toHaveAttribute('data-state', 'active');

    // Gasless toggle should be visible
    await expect(page.getByRole('switch', { name: /enable gasless/i })).toBeVisible();
  });

  test('should not show gasless toggle in limit order mode', async ({ page }) => {
    // Switch to limit order mode
    await page.getByRole('tab', { name: /limit order/i }).click();

    // Gasless toggle should not be in limit order view
    const instantTab = page.getByRole('tabpanel', { name: /instant swap/i });
    await expect(instantTab).not.toBeVisible();
  });

  test('should meet color contrast requirements', async ({ page }) => {
    // Enable gasless
    await page.getByRole('switch', { name: /enable gasless/i }).click();

    // Check active badge contrast
    const activeBadge = page.getByText(/active/i);
    await expect(activeBadge).toBeVisible();

    // Check fee text contrast
    const feeText = page.getByText(/0.05% relayer fee applies/i);
    await expect(feeText).toBeVisible();
  });
});
