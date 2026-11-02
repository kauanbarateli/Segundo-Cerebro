import { defineConfig, devices } from "@playwright/test";

/** Dedicated diagnostic only: real component/browser, synthetic HTTP/Auth.
 * No webServer, Supabase, real accounts, credentials, SQL or remote destination. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "feedback-session-browser.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report/feedback-focus" }]],
  outputDir: "test-results/feedback-focus",
  use: { ...devices["Desktop Chrome"], headless: true, serviceWorkers: "block", trace: "retain-on-failure", screenshot: "only-on-failure" },
});
