import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
export default defineConfig({testDir:resolve("tests/e2e"),testMatch:"restore-acceptance.spec.ts",outputDir:resolve("work/restore-inspector-results"),workers:1,reporter:"list",forbidOnly:Boolean(process.env.CI),use:{trace:"off",browserName:"chromium"}});
