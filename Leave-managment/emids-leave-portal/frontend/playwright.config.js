import { defineConfig, devices } from '@playwright/test'

// E2E tests run against the real hosted Supabase project. Serial execution
// (workers: 1) keeps mutating specs from stepping on each other.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5180',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run dev -- --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: true,
    timeout: 120_000
  }
})
