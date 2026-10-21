import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  // Hosted Windows runners render the detailed room in software. CI traces show
  // screenshots and clicks progressing, but the complete flow exceeds 90 s.
  timeout: process.env.CI ? 300000 : 90000,
  expect: { timeout: process.env.CI ? 30000 : 15000 },
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
})
