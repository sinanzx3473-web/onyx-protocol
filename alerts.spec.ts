import { test, expect } from '@playwright/test';

test.describe('Custom Alerts / Watchlist', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my-alerts');
    await page.waitForLoadState('networkidle');
  });

  test('should show connect wallet prompt when not connected', async ({ page }) => {
    // Check for connect wallet message
    await expect(page.getByText(/connect wallet/i)).toBeVisible();
    await expect(page.getByText(/please connect your wallet to manage alerts/i)).toBeVisible();
  });

  test('should display empty state when no alerts exist', async ({ page, context }) => {
    // Mock wallet connection
    await context.addCookies([{
      name: 'mock_wallet',
      value: '0x1234567890123456789012345678901234567890',
      domain: 'localhost',
      path: '/'
    }]);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check for empty state
    await expect(page.getByText(/no alerts yet/i)).toBeVisible();
    await expect(page.getByText(/create your first alert/i)).toBeVisible();
  });

  test('should open create alert modal', async ({ page }) => {
    // Click create alert button
    await page.getByRole('button', { name: /create alert/i }).first().click();

    // Modal should be visible
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/create new alert/i)).toBeVisible();
  });

  test('should create a price alert', async ({ page }) => {
    // Open create modal
    await page.getByRole('button', { name: /create alert/i }).first().click();

    // Fill in alert details
    await page.getByLabel(/alert name/i).fill('ETH Above $2000');
    
    // Select alert type
    await page.getByLabel(/alert type/i).click();
    await page.getByText(/price alert/i).click();

    // Select condition
    await page.getByLabel(/condition/i).click();
    await page.getByText(/above/i).first().click();

    // Enter target value
    await page.getByLabel(/target value/i).fill('2000');

    // Enter token symbol
    await page.getByLabel(/token symbol/i).fill('ETH');

    // Select delivery methods (in-app is default)
    await page.getByLabel(/push notification/i).check();

    // Submit form
    await page.getByRole('button', { name: /create alert/i }).last().click();

    // Should show success message
    await expect(page.getByText(/alert created successfully/i)).toBeVisible();
  });

  test('should create a volume spike alert', async ({ page }) => {
    await page.getByRole('button', { name: /create alert/i }).first().click();

    await page.getByLabel(/alert name/i).fill('High Volume Alert');
    
    await page.getByLabel(/alert type/i).click();
    await page.getByText(/volume spike/i).click();

    await page.getByLabel(/target value/i).fill('100');

    await page.getByRole('button', { name: /create alert/i }).last().click();

    await expect(page.getByText(/alert created successfully/i)).toBeVisible();
  });

  test('should create an APR change alert', async ({ page }) => {
    await page.getByRole('button', { name: /create alert/i }).first().click();

    await page.getByLabel(/alert name/i).fill('APR Below 10%');
    
    await page.getByLabel(/alert type/i).click();
    await page.getByText(/apr change/i).click();

    await page.getByLabel(/condition/i).click();
    await page.getByText(/below/i).first().click();

    await page.getByLabel(/target value/i).fill('10');

    await page.getByRole('button', { name: /create alert/i }).last().click();

    await expect(page.getByText(/alert created successfully/i)).toBeVisible();
  });

  test('should create a flash loan threshold alert', async ({ page }) => {
    await page.getByRole('button', { name: /create alert/i }).first().click();

    await page.getByLabel(/alert name/i).fill('Large Flash Loan');
    
    await page.getByLabel(/alert type/i).click();
    await page.getByText(/flash loan alert/i).click();

    await page.getByLabel(/target value/i).fill('1000000');

    await page.getByRole('button', { name: /create alert/i }).last().click();

    await expect(page.getByText(/alert created successfully/i)).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.getByRole('button', { name: /create alert/i }).first().click();

    // Try to submit without filling fields
    await page.getByRole('button', { name: /create alert/i }).last().click();

    // Should show validation error
    await expect(page.getByText(/please enter an alert name/i)).toBeVisible();
  });

  test('should require webhook URL when webhook delivery is selected', async ({ page }) => {
    await page.getByRole('button', { name: /create alert/i }).first().click();

    await page.getByLabel(/alert name/i).fill('Test Alert');
    await page.getByLabel(/target value/i).fill('100');
    
    // Select webhook delivery
    await page.getByLabel(/webhook/i).check();

    // Submit without webhook URL
    await page.getByRole('button', { name: /create alert/i }).last().click();

    await expect(page.getByText(/please enter a webhook url/i)).toBeVisible();
  });

  test('should toggle alert on/off', async ({ page }) => {
    // Assuming an alert exists
    const alertSwitch = page.locator('button[role="switch"]').first();
    
    // Get initial state
    const initialState = await alertSwitch.getAttribute('aria-checked');
    
    // Toggle
    await alertSwitch.click();
    
    // Wait for update
    await page.waitForTimeout(500);
    
    // State should have changed
    const newState = await alertSwitch.getAttribute('aria-checked');
    expect(newState).not.toBe(initialState);
  });

  test('should edit an existing alert', async ({ page }) => {
    // Click edit button on first alert
    await page.getByRole('button', { name: /edit/i }).first().click();

    // Modal should open with existing data
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/edit alert/i)).toBeVisible();

    // Modify alert name
    const nameInput = page.getByLabel(/alert name/i);
    await nameInput.clear();
    await nameInput.fill('Updated Alert Name');

    // Submit
    await page.getByRole('button', { name: /update alert/i }).click();

    await expect(page.getByText(/alert updated successfully/i)).toBeVisible();
  });

  test('should delete an alert', async ({ page }) => {
    // Mock confirmation dialog
    page.on('dialog', dialog => dialog.accept());

    // Click delete button
    await page.getByRole('button', { name: /delete/i }).first().click();

    // Should show success message
    await expect(page.getByText(/alert deleted successfully/i)).toBeVisible();
  });

  test('should display alert details correctly', async ({ page }) => {
    // Check if alert card displays all information
    const alertCard = page.locator('[class*="card"]').first();

    await expect(alertCard.getByText(/condition/i)).toBeVisible();
    await expect(alertCard.getByText(/target value/i)).toBeVisible();
    await expect(alertCard.getByText(/delivery/i)).toBeVisible();
    await expect(alertCard.getByText(/last triggered/i)).toBeVisible();
  });

  test('should show different alert type icons', async ({ page }) => {
    // Price alert icon
    await expect(page.locator('svg').first()).toBeVisible();
  });

  test('should support multiple delivery methods', async ({ page }) => {
    await page.getByRole('button', { name: /create alert/i }).first().click();

    await page.getByLabel(/alert name/i).fill('Multi-delivery Alert');
    await page.getByLabel(/target value/i).fill('100');

    // Select multiple delivery methods
    await page.getByLabel(/in-app notification/i).check();
    await page.getByLabel(/push notification/i).check();
    await page.getByLabel(/email/i).check();

    await page.getByRole('button', { name: /create alert/i }).last().click();

    await expect(page.getByText(/alert created successfully/i)).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Page should be usable on mobile
    await expect(page.getByRole('heading', { name: /my alerts/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create alert/i })).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Intercept API call and return error
    await page.route('/api/alerts', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should show error message
    await expect(page.getByText(/failed to load alerts/i)).toBeVisible();
  });
});

test.describe('Alert Evaluation API', () => {
  test('should evaluate price cross alerts', async ({ request }) => {
    const response = await request.post('/api/alerts/evaluate', {
      data: {
        tokenAddress: '0x123',
        price: '2100'
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('triggered');
    expect(data).toHaveProperty('alerts');
  });

  test('should evaluate volume spike alerts', async ({ request }) => {
    const response = await request.post('/api/alerts/evaluate', {
      data: {
        poolAddress: '0x456',
        volume24h: '150'
      }
    });

    expect(response.ok()).toBeTruthy();
  });

  test('should evaluate APR change alerts', async ({ request }) => {
    const response = await request.post('/api/alerts/evaluate', {
      data: {
        poolAddress: '0x789',
        apr: '8.5'
      }
    });

    expect(response.ok()).toBeTruthy();
  });

  test('should evaluate flash loan threshold alerts', async ({ request }) => {
    const response = await request.post('/api/alerts/evaluate', {
      data: {
        flashLoanAmount: '2000000'
      }
    });

    expect(response.ok()).toBeTruthy();
  });
});
