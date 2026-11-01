import { defineConfig, devices } from "@playwright/test";

/** Separate headed experiment under Xvfb, no webServer. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "feedback-session-browser.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report/feedback-focus-headed" }]],
  outputDir: "test-results/feedback-focus-headed",
  use: { ...devices["Desktop Chrome"], headless: false, serviceWorkers: "block", trace: "retain-on-failure", screenshot: "only-on-failure" },
});
