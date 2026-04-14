import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 600_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:8077',
    headless: false,        // PJ likes visual debug
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  webServer: {
    command: 'cd .. && rm -f data/tracker.db && .venv/bin/python -m uvicorn backend.app:app --host 0.0.0.0 --port 8077',
    port: 8077,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
