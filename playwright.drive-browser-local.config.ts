import {defineConfig} from "@playwright/test";
import {dirname,join} from "node:path";
import {browserProcessEnvironment} from "./tests/e2e-auth-local/browser-process-environment.mjs";
import {driveEnvironment} from "./tests/e2e-auth-local/drive-browser-support.mjs";
const env=driveEnvironment(process.env);
process.env.PLAYWRIGHT_NO_COPY_PROMPT="1";
export default defineConfig({testDir:"./tests/e2e-auth-local",testMatch:"drive-browser-local.spec.ts",workers:1,fullyParallel:false,retries:0,timeout:390000,expect:{timeout:20000},reporter:"null",quiet:true,outputDir:join(dirname(env.reportPath),"playwright-private"),preserveOutput:"never",use:{baseURL:"http://127.0.0.1:3117",browserName:"chromium",headless:true,trace:"off",video:"off",screenshot:"off",acceptDownloads:true,serviceWorkers:"block",launchOptions:{env:browserProcessEnvironment(process.env),downloadsPath:join(dirname(env.reportPath),"browser-downloads")}}});
