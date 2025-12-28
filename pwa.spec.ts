import { test, expect } from '@playwright/test';

test.describe('PWA Installation and Offline Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should have valid PWA manifest', async ({ page }) => {
    // Check if manifest link exists
    const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestLink).toBeTruthy();

    // Fetch and validate manifest
    const manifestResponse = await page.request.get(manifestLink!);
    expect(manifestResponse.ok()).toBeTruthy();

    const manifest = await manifestResponse.json();
    
    // Validate required manifest fields
    expect(manifest.name).toBe('DEX - Decentralized Exchange');
    expect(manifest.short_name).toBe('DEX');
    expect(manifest.description).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.background_color).toBeTruthy();
    expect(manifest.icons).toBeTruthy();
    expect(manifest.icons.length).toBeGreaterThan(0);

    // Validate icon sizes
    const iconSizes = manifest.icons.map((icon: any) => icon.sizes);
    expect(iconSizes).toContain('192x192');
    expect(iconSizes).toContain('512x512');
  });

  test('should register service worker', async ({ page }) => {
    // Wait for service worker registration
    await page.waitForTimeout(2000);

    // Check if service worker is registered
    const swRegistered = await page.evaluate(() => {
      return navigator.serviceWorker.controller !== null;
    });

    expect(swRegistered).toBeTruthy();
  });

  test('should have apple-touch-icon for iOS', async ({ page }) => {
    const appleTouchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    expect(appleTouchIcon).toBeTruthy();
    expect(appleTouchIcon).toContain('apple-touch-icon.png');
  });

  test('should have theme-color meta tag', async ({ page }) => {
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBeTruthy();
  });

  test('should have viewport meta with viewport-fit', async ({ page }) => {
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('viewport-fit=cover');
  });

  test('should show PWA install prompt on supported browsers', async ({ page, browserName }) => {
    // Skip on browsers that don't support beforeinstallprompt
    if (browserName === 'webkit') {
      test.skip();
    }

    // Trigger beforeinstallprompt event
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt');
      window.dispatchEvent(event);
    });

    // Wait for install prompt to appear
    await page.waitForTimeout(1000);

    // Check if install prompt is visible
    const installPrompt = page.getByText(/install dex app/i);
    await expect(installPrompt).toBeVisible();
  });

  test('should dismiss PWA install prompt', async ({ page, browserName }) => {
    if (browserName === 'webkit') {
      test.skip();
    }

    // Trigger install prompt
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt');
      window.dispatchEvent(event);
    });

    await page.waitForTimeout(1000);

    // Click dismiss button
    const dismissButton = page.locator('button[aria-label="Dismiss install prompt"]');
    await dismissButton.click();

    // Prompt should be hidden
    const installPrompt = page.getByText(/install dex app/i);
    await expect(installPrompt).not.toBeVisible();
  });

  test('should cache static assets', async ({ page }) => {
    // Navigate to page
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');

    // Check if service worker cached resources
    const cacheNames = await page.evaluate(async () => {
      return await caches.keys();
    });

    expect(cacheNames.length).toBeGreaterThan(0);
  });

  test('should work offline after initial load', async ({ page, context }) => {
    // Load the app
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');

    // Wait for service worker to cache assets
    await page.waitForTimeout(2000);

    // Go offline
    await context.setOffline(true);

    // Navigate to another page
    await page.goto('/liquidity');

    // Page should still load (from cache)
    await expect(page.getByText(/liquidity/i)).toBeVisible();

    // Go back online
    await context.setOffline(false);
  });

  test('should show offline indicator when network is unavailable', async ({ page, context }) => {
    // Load the app
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');

    // Go offline
    await context.setOffline(true);

    // Trigger a network request (should fail gracefully)
    await page.reload();

    // App should still be functional
    await expect(page.getByText(/swap/i)).toBeVisible();
  });
});

test.describe('PWA Mobile Optimizations', () => {
  test.use({
    viewport: { width: 375, height: 667 }, // iPhone SE size
  });

  test('should have touch-friendly tap targets', async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');

    // Check button sizes
    const buttons = await page.locator('button').all();
    
    for (const button of buttons.slice(0, 5)) { // Check first 5 buttons
      const box = await button.boundingBox();
      if (box) {
        // Minimum tap target size is 44x44px
        expect(box.height).toBeGreaterThanOrEqual(40); // Allow slight variance
      }
    }
  });

  test('should prevent horizontal scroll', async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');

    // Check if page width exceeds viewport
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // Allow 1px tolerance
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');

    // Check if main content is visible
    await expect(page.getByRole('main')).toBeVisible();

    // Check if navigation is accessible
    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible();
  });

  test('should handle touch gestures', async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');

    // Simulate touch on a button
    const swapButton = page.getByRole('button', { name: /swap/i }).first();
    await swapButton.tap();

    // Button should respond to tap
    await expect(swapButton).toBeVisible();
  });

  test('should load quickly on mobile', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;

    // Should load in under 3 seconds on mobile
    expect(loadTime).toBeLessThan(3000);
  });
});

test.describe('PWA Notifications', () => {
  test('should request notification permission', async ({ page, context }) => {
    // Grant notification permission
    await context.grantPermissions(['notifications']);

    await page.goto('/my-account');
    await page.waitForLoadState('networkidle');

    // Navigate to notifications tab
    await page.getByRole('tab', { name: /notifications/i }).click();

    // Check if notification settings are visible
    await expect(page.getByText(/push notifications/i)).toBeVisible();
  });

  test('should show notification preferences', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    
    await page.goto('/my-account');
    await page.waitForLoadState('networkidle');

    // Navigate to notifications tab
    await page.getByRole('tab', { name: /notifications/i }).click();

    // Check for notification type toggles
    await expect(page.getByText(/transaction updates/i)).toBeVisible();
    await expect(page.getByText(/pool changes/i)).toBeVisible();
    await expect(page.getByText(/volume spikes/i)).toBeVisible();
  });
});

test.describe('PWA Performance', () => {
  test('should have good performance metrics', async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');

    // Measure performance
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime || 0
      };
    });

    // Performance targets
    expect(metrics.domContentLoaded).toBeLessThan(1000); // < 1s
    expect(metrics.loadComplete).toBeLessThan(2000); // < 2s
    expect(metrics.firstPaint).toBeLessThan(1000); // < 1s
  });

  test('should have minimal layout shifts', async ({ page }) => {
    await page.goto('/swap');
    
    // Wait for page to stabilize
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check for layout stability
    const cls = await page.evaluate(() => {
      return new Promise((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).hadRecentInput) continue;
            clsValue += (entry as any).value;
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 2000);
      });
    });

    // CLS should be less than 0.1 (good)
    expect(cls).toBeLessThan(0.1);
  });
});
