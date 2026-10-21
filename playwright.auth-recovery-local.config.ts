import {defineConfig} from "@playwright/test";
import {dirname,join} from "node:path";
import {browserProcessEnvironment} from "./tests/e2e-auth-local/browser-process-environment.mjs";
import {recoveryEnvironment,RECOVERY_APP} from "./tests/e2e-auth-local/auth-recovery-support.mjs";
import {verifyQualifiedChromium} from "./tests/e2e-auth-local/qualified-chromium.mjs";
const environment=recoveryEnvironment(process.env);
const qualifiedChromium=await verifyQualifiedChromium();
process.env.PLAYWRIGHT_NO_COPY_PROMPT="1";
export default defineConfig({testDir:"./tests/e2e-auth-local",testMatch:"auth-recovery-local.spec.ts",workers:1,fullyParallel:false,retries:0,timeout:320000,expect:{timeout:20000},reporter:[["./tests/e2e-auth-local/next-stop-reporter.mjs"]],quiet:true,outputDir:join(dirname(environment.reportPath),"playwright-private"),preserveOutput:"never",use:{baseURL:RECOVERY_APP,browserName:"chromium",headless:true,trace:"off",video:"off",screenshot:"off",acceptDownloads:false,serviceWorkers:"block",launchOptions:{executablePath:qualifiedChromium.executablePath,env:browserProcessEnvironment(process.env)}}});
