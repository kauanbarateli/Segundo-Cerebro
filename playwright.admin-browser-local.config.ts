import { defineConfig } from "@playwright/test";
import { dirname, join } from "node:path";
import { browserProcessEnvironment } from "./tests/e2e-auth-local/browser-process-environment.mjs";
import { adminBrowserEnvironment } from "./tests/e2e-auth-local/admin-browser-support.mjs";
import { verifyQualifiedChromium } from "./tests/e2e-auth-local/qualified-chromium.mjs";
const environment = adminBrowserEnvironment(process.env);
const qualifiedChromium = await verifyQualifiedChromium();
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
export default defineConfig({
  testDir:"./tests/e2e-auth-local", testMatch:"admin-browser-local.spec.ts",
  grep:new RegExp("^.*" + environment.case + "$"), workers:1, fullyParallel:false,
  retries:0, timeout:380000, expect:{timeout:20000}, reporter:[["./tests/e2e-auth-local/next-stop-reporter.mjs"]], quiet:true,
  outputDir:join(dirname(environment.reportPath),"playwright-private"), preserveOutput:"never",
  use:{baseURL:"http://127.0.0.1:3117",browserName:"chromium",headless:true,trace:"off",video:"off",screenshot:"off",acceptDownloads:false,serviceWorkers:"block",launchOptions:{executablePath:qualifiedChromium.executablePath,env:browserProcessEnvironment(process.env)}},
});
