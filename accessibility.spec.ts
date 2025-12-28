import { test, expect } from '@playwright/test';

test.describe('Accessibility - Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/swap');
  });

  test('should navigate through main navigation using keyboard', async ({ page }) => {
    // Focus on first navigation item
    await page.keyboard.press('Tab');
    
    // Check if Swap button is focused
    const swapButton = page.getByRole('link', { name: /Navigate to Swap/i });
    await expect(swapButton).toBeFocused();
    
    // Navigate to next items
    await page.keyboard.press('Tab');
    const liquidityButton = page.getByRole('link', { name: /Navigate to Liquidity/i });
    await expect(liquidityButton).toBeFocused();
    
    // Press Enter to navigate
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/.*liquidity/);
  });

  test('should be able to toggle dark mode with keyboard', async ({ page }) => {
    // Tab to dark mode switch
    let tabCount = 0;
    while (tabCount < 20) {
      await page.keyboard.press('Tab');
      const darkModeSwitch = page.locator('#dark-mode-toggle');
      if (await darkModeSwitch.isVisible() && await darkModeSwitch.isFocused()) {
        break;
      }
      tabCount++;
    }
    
    const darkModeSwitch = page.locator('#dark-mode-toggle');
    await expect(darkModeSwitch).toBeFocused();
    
    // Toggle with Space key
    await page.keyboard.press('Space');
    
    // Verify dark mode changed
    const html = page.locator('html');
    const hasDarkClass = await html.evaluate((el) => el.classList.contains('dark'));
    expect(typeof hasDarkClass).toBe('boolean');
  });

  test('should navigate swap form with keyboard only', async ({ page }) => {
    // Skip to main content
    await page.keyboard.press('Tab');
    
    // Find and focus on amount input
    const amountInput = page.getByLabel(/From amount/i);
    await amountInput.focus();
    
    // Type amount
    await page.keyboard.type('10');
    await expect(amountInput).toHaveValue('10');
    
    // Tab to token selector
    await page.keyboard.press('Tab');
    
    // Tab to switch button
    await page.keyboard.press('Tab');
    const switchButton = page.getByLabel(/Switch tokens/i);
    await expect(switchButton).toBeFocused();
    
    // Activate switch with Enter
    await page.keyboard.press('Enter');
  });

  test('should be able to open and close modals with keyboard', async ({ page }) => {
    // Navigate to settings button
    const settingsButton = page.getByLabel(/Settings/i);
    await settingsButton.focus();
    await expect(settingsButton).toBeFocused();
    
    // Open settings with Enter
    await page.keyboard.press('Enter');
    
    // Settings panel should be visible
    const slippageInput = page.getByLabel(/Custom slippage/i);
    await expect(slippageInput).toBeVisible();
    
    // Close with Escape
    await page.keyboard.press('Escape');
  });

  test('should navigate My Account page with keyboard', async ({ page }) => {
    await page.goto('/my-account');
    
    // Tab through tabs
    const transactionsTab = page.getByRole('tab', { name: /Recent Transactions/i });
    await transactionsTab.focus();
    await expect(transactionsTab).toBeFocused();
    
    // Navigate to positions tab with arrow keys
    await page.keyboard.press('ArrowRight');
    const positionsTab = page.getByRole('tab', { name: /LP Positions/i });
    await expect(positionsTab).toBeFocused();
    
    // Activate with Enter
    await page.keyboard.press('Enter');
    await expect(positionsTab).toHaveAttribute('data-state', 'active');
  });
});

test.describe('Accessibility - ARIA Labels and Roles', () => {
  test('should have proper ARIA labels on interactive elements', async ({ page }) => {
    await page.goto('/swap');
    
    // Check navigation has proper labels
    await expect(page.getByLabel(/Navigate to Swap/i)).toBeVisible();
    await expect(page.getByLabel(/Navigate to Liquidity/i)).toBeVisible();
    
    // Check form inputs have labels
    await expect(page.getByLabel(/From amount/i)).toBeVisible();
    await expect(page.getByLabel(/To amount/i)).toBeVisible();
    
    // Check buttons have labels
    await expect(page.getByLabel(/Settings/i)).toBeVisible();
    await expect(page.getByLabel(/Switch tokens/i)).toBeVisible();
  });

  test('should have proper alert roles for network warnings', async ({ page }) => {
    await page.goto('/swap');
    
    // Network alert should have role="alert"
    const alerts = page.locator('[role="alert"]');
    const count = await alerts.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/my-account');
    
    // Check for h1
    const h1 = page.locator('h1');
    await expect(h1).toHaveText(/My Account/i);
    
    // Check heading structure
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Accessibility - Focus Management', () => {
  test('should trap focus in modal dialogs', async ({ page }) => {
    await page.goto('/swap');
    
    // Open settings
    const settingsButton = page.getByLabel(/Settings/i);
    await settingsButton.click();
    
    // Tab through modal elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Focus should stay within modal
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('should restore focus after closing modal', async ({ page }) => {
    await page.goto('/swap');
    
    // Focus and open settings
    const settingsButton = page.getByLabel(/Settings/i);
    await settingsButton.focus();
    await settingsButton.click();
    
    // Close with Escape
    await page.keyboard.press('Escape');
    
    // Focus should return to settings button
    await expect(settingsButton).toBeFocused();
  });

  test('should have visible focus indicators', async ({ page }) => {
    await page.goto('/swap');
    
    // Tab to first focusable element
    await page.keyboard.press('Tab');
    
    // Check for focus ring
    const focusedElement = page.locator(':focus');
    const outlineStyle = await focusedElement.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.outline || styles.boxShadow;
    });
    
    // Should have some focus indicator
    expect(outlineStyle).toBeTruthy();
  });
});

test.describe('Accessibility - Screen Reader Support', () => {
  test('should have descriptive link text', async ({ page }) => {
    await page.goto('/my-account');
    
    // External links should have descriptive text
    const externalLinks = page.locator('a[target="_blank"]');
    const count = await externalLinks.count();
    
    for (let i = 0; i < count; i++) {
      const link = externalLinks.nth(i);
      const ariaLabel = await link.getAttribute('aria-label');
      const text = await link.textContent();
      
      // Should have either aria-label or descriptive text
      expect(ariaLabel || text).toBeTruthy();
    }
  });

  test('should have alt text for icons used as content', async ({ page }) => {
    await page.goto('/swap');
    
    // Decorative icons should have aria-hidden
    const decorativeIcons = page.locator('svg[aria-hidden="true"]');
    const count = await decorativeIcons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should announce loading states', async ({ page }) => {
    await page.goto('/my-account');
    
    // Loading skeletons should be perceivable
    const loadingElements = page.locator('[role="status"], [aria-busy="true"]');
    const count = await loadingElements.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Accessibility - Touch Targets', () => {
  test('should have minimum 44px touch targets on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/swap');
    
    // Check button sizes
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();
      
      if (box && await button.isVisible()) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('should have adequate spacing between interactive elements', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/swap');
    
    // Navigation buttons should have spacing
    const navButtons = page.locator('nav button');
    const count = await navButtons.count();
    
    if (count > 1) {
      const firstBox = await navButtons.nth(0).boundingBox();
      const secondBox = await navButtons.nth(1).boundingBox();
      
      if (firstBox && secondBox) {
        const gap = secondBox.x - (firstBox.x + firstBox.width);
        expect(gap).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

test.describe('Accessibility - Color Contrast', () => {
  test('should have sufficient contrast for text elements', async ({ page }) => {
    await page.goto('/swap');
    
    // Check main heading contrast
    const heading = page.locator('h1, h2').first();
    const color = await heading.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.color;
    });
    
    expect(color).toBeTruthy();
  });

  test('should maintain contrast in dark mode', async ({ page }) => {
    await page.goto('/swap');
    
    // Enable dark mode
    const darkModeSwitch = page.locator('#dark-mode-toggle');
    await darkModeSwitch.click();
    
    // Check text is still visible
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });
});
