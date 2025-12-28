import { test, expect } from '@playwright/test';

test.describe('Command Palette - Keyboard Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should open command palette with Ctrl+K', async ({ page }) => {
    // Press Ctrl+K to open command palette
    await page.keyboard.press('Control+k');
    
    // Verify command palette is visible
    await expect(page.getByPlaceholder('Type a command or search...')).toBeVisible();
  });

  test('should open command palette with Cmd+K on Mac', async ({ page }) => {
    // Press Cmd+K to open command palette
    await page.keyboard.press('Meta+k');
    
    // Verify command palette is visible
    await expect(page.getByPlaceholder('Type a command or search...')).toBeVisible();
  });

  test('should close command palette with Escape', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Control+k');
    await expect(page.getByPlaceholder('Type a command or search...')).toBeVisible();
    
    // Close with Escape
    await page.keyboard.press('Escape');
    
    // Verify command palette is closed
    await expect(page.getByPlaceholder('Type a command or search...')).not.toBeVisible();
  });

  test('should search and filter commands', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Control+k');
    
    // Type search query
    await page.getByPlaceholder('Type a command or search...').fill('swap');
    
    // Verify swap-related commands are visible
    await expect(page.getByText('Swap Tokens')).toBeVisible();
    
    // Verify unrelated commands are filtered out
    await expect(page.getByText('Add Liquidity')).not.toBeVisible();
  });

  test('should navigate to swap page via command palette', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Control+k');
    
    // Search for swap
    await page.getByPlaceholder('Type a command or search...').fill('swap');
    
    // Select swap command with Enter
    await page.keyboard.press('Enter');
    
    // Verify navigation to swap page
    await expect(page).toHaveURL(/.*\/swap/);
  });

  test('should navigate to liquidity page via command palette', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Control+k');
    
    // Search for liquidity
    await page.getByPlaceholder('Type a command or search...').fill('add liquidity');
    
    // Select command with Enter
    await page.keyboard.press('Enter');
    
    // Verify navigation to liquidity page
    await expect(page).toHaveURL(/.*\/liquidity/);
  });

  test('should navigate to flash loan page via command palette', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Control+k');
    
    // Search for flash loan
    await page.getByPlaceholder('Type a command or search...').fill('flash');
    
    // Select command with Enter
    await page.keyboard.press('Enter');
    
    // Verify navigation to flash swap page
    await expect(page).toHaveURL(/.*\/flash-swap/);
  });

  test('should navigate to pools page via command palette', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Control+k');
    
    // Search for pools
    await page.getByPlaceholder('Type a command or search...').fill('pools');
    
    // Select command with Enter
    await page.keyboard.press('Enter');
    
    // Verify navigation to pools page
    await expect(page).toHaveURL(/.*\/pools/);
  });

  test('should navigate to portfolio page via command palette', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Control+k');
    
    // Search for portfolio
    await page.getByPlaceholder('Type a command or search...').fill('portfolio');
    
    // Select command with Enter
    await page.keyboard.press('Enter');
    
    // Verify navigation to portfolio page
    await expect(page).toHaveURL(/.*\/portfolio/);
  });

  test('should copy contract address to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Open command palette
    await page.keyboard.press('Control+k');
    
    // Search for contract address
    await page.getByPlaceholder('Type a command or search...').fill('copy dex core');
    
    // Select command with Enter
    await page.keyboard.press('Enter');
    
    // Verify toast notification
    await expect(page.getByText('Copied to clipboard')).toBeVisible();
  });

  test('should show all command groups', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Control+k');
    
    // Verify command groups are visible
    await expect(page.getByText('Navigation')).toBeVisible();
    await expect(page.getByText('Contracts')).toBeVisible();
    await expect(page.getByText('Settings')).toBeVisible();
    await expect(page.getByText('Analytics')).toBeVisible();
    await expect(page.getByText('Developer')).toBeVisible();
  });

  test('should navigate with arrow keys', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Control+k');
    
    // Navigate down with arrow key
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    
    // Press Enter to select
    await page.keyboard.press('Enter');
    
    // Verify command palette closed and action executed
    await expect(page.getByPlaceholder('Type a command or search...')).not.toBeVisible();
  });

  test('should search by keywords', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Control+k');
    
    // Search using keyword "trade" (keyword for swap)
    await page.getByPlaceholder('Type a command or search...').fill('trade');
    
    // Verify swap command is visible
    await expect(page.getByText('Swap Tokens')).toBeVisible();
  });

  test('should show slippage setting commands', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Control+k');
    
    // Search for slippage
    await page.getByPlaceholder('Type a command or search...').fill('slippage');
    
    // Verify slippage commands are visible
    await expect(page.getByText('Set Slippage to 0.5%')).toBeVisible();
    await expect(page.getByText('Set Slippage to 1%')).toBeVisible();
    await expect(page.getByText('Set Slippage to 3%')).toBeVisible();
  });

  test('should complete full workflow without mouse', async ({ page }) => {
    // Start from home page
    await expect(page).toHaveURL(/.*\/swap/);
    
    // Open command palette with keyboard
    await page.keyboard.press('Control+k');
    
    // Search for liquidity
    await page.keyboard.type('liquidity');
    
    // Navigate to liquidity page
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/.*\/liquidity/);
    
    // Open command palette again
    await page.keyboard.press('Control+k');
    
    // Search for pools
    await page.keyboard.type('pools');
    
    // Navigate to pools page
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/.*\/pools/);
    
    // Open command palette again
    await page.keyboard.press('Control+k');
    
    // Search for history
    await page.keyboard.type('history');
    
    // Navigate to history page
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/.*\/history/);
    
    // Verify entire workflow completed without mouse interaction
  });

  test('should show "No results found" for invalid search', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Control+k');
    
    // Search for non-existent command
    await page.getByPlaceholder('Type a command or search...').fill('xyz123invalid');
    
    // Verify no results message
    await expect(page.getByText('No results found.')).toBeVisible();
  });

  test('should open command palette via button click', async ({ page }) => {
    // Click the Ctrl+K button in the header
    await page.getByRole('button', { name: /ctrl\+k/i }).click();
    
    // Verify command palette is visible
    await expect(page.getByPlaceholder('Type a command or search...')).toBeVisible();
  });

  test('should show contract addresses in search results', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Control+k');
    
    // Search for router
    await page.getByPlaceholder('Type a command or search...').fill('router');
    
    // Verify router address command is visible with address in description
    const routerCommand = page.getByText('Copy Router Address');
    await expect(routerCommand).toBeVisible();
  });

  test('should handle rapid open/close operations', async ({ page }) => {
    // Rapidly open and close command palette
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Control+k');
      await expect(page.getByPlaceholder('Type a command or search...')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByPlaceholder('Type a command or search...')).not.toBeVisible();
    }
  });

  test('should maintain search state when reopening', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Control+k');
    
    // Type search query
    await page.getByPlaceholder('Type a command or search...').fill('swap');
    
    // Close palette
    await page.keyboard.press('Escape');
    
    // Reopen palette
    await page.keyboard.press('Control+k');
    
    // Search field should be empty on reopen
    await expect(page.getByPlaceholder('Type a command or search...')).toHaveValue('');
  });
});
