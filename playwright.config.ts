import { defineConfig, devices } from "@playwright/test";

// End-to-end tests: `npm run test:e2e`.
// By default they start (or reuse) the dev server, which uses the dev database
// and its TEST: puzzles. Set E2E_BASE_URL to run them against a preview instead.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    {
      name: "phone",
      // A 390 px wide phone, as the spec designs for.
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
