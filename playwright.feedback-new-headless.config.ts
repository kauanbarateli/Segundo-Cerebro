import { defineConfig, devices } from "@playwright/test";

/** Separate experiment: Chromium's new headless mode, no webServer. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "feedback-session-browser.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report/feedback-focus-new-headless" }]],
  outputDir: "test-results/feedback-focus-new-headless",
  use: { ...devices["Desktop Chrome"], channel: "chromium", headless: true, serviceWorkers: "block", trace: "retain-on-failure", screenshot: "only-on-failure" },
});
