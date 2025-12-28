import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Perform any global setup here
  console.log('Setting up E2E test environment...');
  
  await browser.close();
}

export default globalSetup;
