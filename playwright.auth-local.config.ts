import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { localEnvironment, refuse } from "./tests/e2e-auth-local/support";
import { browserProcessEnvironment } from "./tests/e2e-auth-local/browser-process-environment.mjs";

const environment = localEnvironment(process.env);
const root = dirname(fileURLToPath(import.meta.url));
// Existence only: neither this config nor the spec loads a dotenv file.
if ([".env", ".env.local", ".env.development", ".env.development.local", ".env.production", ".env.production.local"]
  .some(name => existsSync(join(root, name)))) refuse("ENVIRONMENT_REFUSED");

export default defineConfig({
  testDir: "./tests/e2e-auth-local",
  testMatch: ["auth-local.spec.ts", "identity-data-api-local.spec.ts", "auth-password-local.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 240_000,
  globalTimeout: 300_000,
  reporter: "null",
  quiet: true,
  preserveOutput: "never",
  outputDir: join(dirname(environment.reportPath), "playwright-output"),
  use: {
    ...devices["Desktop Chrome"],
    baseURL: environment.appUrl,
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    trace: "off",
    video: "off",
    screenshot: "off",
    serviceWorkers: "block",
    launchOptions: { env: browserProcessEnvironment(process.env) },
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3117",
    cwd: root,
    env: { NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1" },
    url: `${environment.appUrl}/entrar`,
    reuseExistingServer: false,
    timeout: 90_000,
    stdout: "ignore",
    stderr: "ignore",
  },
});
