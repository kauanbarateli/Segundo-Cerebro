import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const sdk = vi.hoisted(() => ({ create: vi.fn(), server: vi.fn(), rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: sdk.create }));
vi.mock("@supabase/ssr", () => ({ createServerClient: sdk.server }));
import { HOMOLOGATION_DATABASE_ORIGIN as HOMOLOG, PERSONAL_DATABASE_ORIGIN as PERSONAL, HOMOLOGATION_BRANCH, HOMOLOGATION_PROJECT, authDeploymentAllowed, isolatedApplicationOrigin, requiresIsolatedDestination, trustedHostedDatabaseOrigin } from "../../src/lib/environment/application-destination";
import { readAuthConfiguration, type SupabaseAuthConfig } from "../../src/lib/auth/config";
import { createPrivilegedClient, createRequestClient } from "../../src/lib/auth/clients";
import { updateSessionMiddleware } from "../../src/lib/auth/middleware-session";
import { isTrustedDatabaseOrigin, isTrustedHostedDatabaseOrigin } from "../../src/lib/auth/database-origin-server";
import { resolveStorageOrigin } from "../../src/lib/files/storage-origin-server";
import { signedUploadUrl } from "../../src/lib/files/storage-origin";
import { contentSecurityPolicy, createNonce, cspStorageOrigin, cspStorageOriginForRequest } from "../../src/lib/security/csp";
import { captureTaskGatewayForRequest } from "../../src/adapters/db/capture-task-runtime";
import { activityGatewayForRequest } from "../../src/adapters/db/activity-runtime";
import { financeGatewayForRequest } from "../../src/adapters/db/finance-runtime";
import { routineGatewayForRequest } from "../../src/adapters/db/projects-habits-runtime";
import { knowledgeGatewayForRequest } from "../../src/adapters/db/knowledge-runtime";
import { vaultGatewayForRequest } from "../../src/adapters/db/vault-runtime";
import { searchForRequest } from "../../src/adapters/db/search-runtime";
import { settingsForRequest } from "../../src/adapters/db/settings-runtime";
import { adminServicesForRequest } from "../../src/adapters/db/admin-runtime";
import { calendarJobs } from "../../src/adapters/db/google-calendar-runtime";
import { cleanupFiles, filesServicesForRequest } from "../../src/adapters/db/files-runtime";

// Synthetic public hostname: actual Vercel branch URL is verified separately.
const HOST = "segundo-cerebro-git-homologacao-kauanbarateli.vercel.app", APP = "https://" + HOST;
const ENV: Record<string, string> = Object.freeze({
  APP_DEPLOYMENT_TARGET: "homologation", APP_MODE: "supabase", APP_URL: APP, SUPABASE_URL: HOMOLOG, NODE_ENV: "production",
  VERCEL: "1", VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "preview", VERCEL_PROJECT_ID: HOMOLOGATION_PROJECT,
  VERCEL_GIT_PROVIDER: "github", VERCEL_GIT_REPO_OWNER: "kauanbarateli", VERCEL_GIT_REPO_SLUG: "Segundo-Cerebro", VERCEL_GIT_COMMIT_REF: HOMOLOGATION_BRANCH,
  VERCEL_BRANCH_URL: HOST, VERCEL_PROJECT_PRODUCTION_URL: "www.segundocerebroapp.com.br",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_homologation", SUPABASE_SECRET_KEY: "sb_secret_offline_fixture",
  AUTH_STATE_SECRET: "synthetic-homolog-state-exclusive-32-bytes", AUTH_RATE_LIMIT_SECRET: "synthetic-homolog-rate-exclusive-32-bytes",
});
const actor = { userId: "10000000-0000-4000-8000-000000000001", sessionId: "10000000-0000-4000-8000-000000000002", role: "master" as const, mustChangePassword: false, entitlements: {} };
const jar = { getAll: () => [], set: vi.fn() };
function config(): SupabaseAuthConfig { const result = readAuthConfiguration(ENV); if (result.mode !== "supabase") throw new Error("FIXTURE_REFUSED"); return result; }
function install(environment: Record<string, string | undefined>) { for (const [name, value] of Object.entries(environment)) vi.stubEnv(name, value); }
const required = Object.keys(ENV).filter(name => !["VERCEL_TARGET_ENV", "VERCEL_PROJECT_PRODUCTION_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "AUTH_STATE_SECRET", "AUTH_RATE_LIMIT_SECRET"].includes(name));
beforeEach(() => { vi.resetAllMocks(); sdk.create.mockReturnValue({ rpc: sdk.rpc, auth: {} }); sdk.server.mockReturnValue({ auth: { getUser: sdk.getUser } }); sdk.getUser.mockResolvedValue({ data: { user: null }, error: null }); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("isolated hosted destination, without SDK or external I/O", () => {
  it("binds all public facts exactly and keeps the optional target environment explicit", () => {
    expect(isolatedApplicationOrigin(ENV)).toBe(APP);
    expect(trustedHostedDatabaseOrigin(config(), ENV)).toBe(HOMOLOG);
    expect(authDeploymentAllowed(ENV, config())).toBe(true);
    expect(isolatedApplicationOrigin({ ...ENV, VERCEL_TARGET_ENV: undefined })).toBe(APP);
    for (const field of required) {
      expect(isolatedApplicationOrigin({ ...ENV, [field]: undefined }), field).toBeUndefined();
      expect(isolatedApplicationOrigin({ ...ENV, [field]: "PRIVATE_CANARY" }), field).toBeUndefined();
    }
    expect(isolatedApplicationOrigin({ ...ENV, VERCEL_TARGET_ENV: "private-custom-environment" })).toBeUndefined();
  });
  it("refuses production Preview, wrong ref, branch, repo, project and canonical URL aliases", () => {
    for (const patch of [
      { SUPABASE_URL: PERSONAL }, { VERCEL_ENV: "production" }, { VERCEL_GIT_COMMIT_REF: "main" }, { VERCEL_GIT_REPO_OWNER: "contasvoedigital" },
      { VERCEL_GIT_REPO_SLUG: "segundo-cerebro" }, { VERCEL_PROJECT_ID: HOMOLOGATION_PROJECT + "x" }, { APP_MODE: "demo" }, { NODE_ENV: "development" },
      { APP_DEPLOYMENT_TARGET: "production" }, { APP_URL: APP + "/" }, { APP_URL: APP + "?x=1" }, { APP_URL: "https://www.segundocerebroapp.com.br" },
      { VERCEL_BRANCH_URL: "https://" + HOST }, { VERCEL_BRANCH_URL: HOST + "/" }, { VERCEL_BRANCH_URL: HOST + ".attacker.invalid" },
      { VERCEL_BRANCH_URL: "arbitrary-deployment.vercel.app", APP_URL: "https://arbitrary-deployment.vercel.app" }, { VERCEL_PROJECT_PRODUCTION_URL: HOST },
    ]) {
      const environment = { ...ENV, ...patch };
      expect(authDeploymentAllowed(environment)).toBe(false);
      expect(() => readAuthConfiguration(environment)).toThrow("Autenticação indisponível neste ambiente.");
      expect(trustedHostedDatabaseOrigin(config(), environment)).toBeUndefined();
    }
    expect(authDeploymentAllowed({ APP_MODE: "supabase", VERCEL_ENV: "preview", SUPABASE_URL: PERSONAL })).toBe(false);
    expect(authDeploymentAllowed({ APP_MODE: "demo", VERCEL_GIT_COMMIT_REF: HOMOLOGATION_BRANCH })).toBe(false);
    expect(authDeploymentAllowed({ APP_MODE: "demo", SUPABASE_URL: HOMOLOG })).toBe(false);
  });
  it("also refuses normalized TWry aliases in the reader without a marker or Preview", () => {
    for (const supabaseUrl of [HOMOLOG + "/", HOMOLOG.toUpperCase(), HOMOLOG + ":443"]) {
      const environment: Record<string, string> = { ...ENV, SUPABASE_URL: supabaseUrl, APP_URL: "https://www.segundocerebroapp.com.br" };
      delete environment.APP_DEPLOYMENT_TARGET; for (const name of Object.keys(environment)) if (name.startsWith("VERCEL")) delete environment[name];
      expect(requiresIsolatedDestination(environment)).toBe(false); // Alias becomes known only after URL normalization.
      expect(() => readAuthConfiguration(environment)).toThrow("Autenticação indisponível neste ambiente.");
    }
    expect(sdk.server).not.toHaveBeenCalled(); expect(sdk.create).not.toHaveBeenCalled();
  });
  it("preserves ordinary demo, production and local capabilities without granting homologation", () => {
    expect(readAuthConfiguration({})).toEqual({ mode: "demo" });
    expect(authDeploymentAllowed({ APP_MODE: "demo", VERCEL_ENV: "preview" })).toBe(true);
    expect(trustedHostedDatabaseOrigin({ supabaseUrl: PERSONAL }, { NODE_ENV: "production" })).toBe(PERSONAL);
    const local = { mode: "supabase", supabaseUrl: "http://127.0.0.1:54321", appOrigin: "http://127.0.0.1:3117", secureCookies: false };
    expect(trustedHostedDatabaseOrigin(local, { APP_MODE: "supabase", SC_ADMIN_BROWSER_RUN: "1", SC_FILES_LOCAL_CI_RUN: "1" })).toBeUndefined();
    expect(authDeploymentAllowed({ ...ENV, VERCEL: undefined, SC_ADMIN_BROWSER_RUN: "1", SC_FILES_LOCAL_CI_RUN: "1", SC_AUTH_LOCAL_CI_RUN: "1" })).toBe(false);
  });
  it("does not invoke relevant accessors, inherited fields or coercion and refuses throwing reflection", () => {
    let reads = 0;
    for (const field of required) {
      const environment = Object.defineProperty({ ...ENV }, field, { enumerable: true, get() { reads++; throw new Error("PRIVATE_CANARY"); } });
      expect(authDeploymentAllowed(environment)).toBe(false);
      const inherited = Object.create({ [field]: ENV[field] }) as Record<string, string>; Object.assign(inherited, ENV); delete inherited[field];
      expect(authDeploymentAllowed(inherited)).toBe(false);
    }
    expect(authDeploymentAllowed({ ...ENV, VERCEL_PROJECT_ID: { toString() { reads++; throw new Error("PRIVATE_CANARY"); } } })).toBe(false);
    const hostile = new Proxy(ENV, { getOwnPropertyDescriptor() { throw new Error("PRIVATE_CANARY"); } });
    expect(authDeploymentAllowed(hostile)).toBe(false);
    const cfg = Object.defineProperty({ ...config() }, "supabaseUrl", { enumerable: true, get() { reads++; throw new Error("PRIVATE_CANARY"); } });
    expect(authDeploymentAllowed(ENV, cfg)).toBe(false); expect(reads).toBe(0);
    expect(requiresIsolatedDestination(hostile)).toBe(true);
  });
});

describe("original server factories and Edge middleware with SDK doubles", () => {
  it("constructs only the configured homologation SDK and retains no-store and host-only cookies", async () => {
    install(ENV); const cfg = config();
    createRequestClient(cfg, jar, false); createPrivilegedClient(cfg);
    expect(sdk.server).toHaveBeenCalledWith(HOMOLOG, cfg.publishableKey, expect.objectContaining({ cookieOptions: expect.objectContaining({ domain: undefined, secure: true, httpOnly: true }) }));
    expect(sdk.create).toHaveBeenCalledWith(HOMOLOG, cfg.secretKey, expect.objectContaining({ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }));
    const response = await updateSessionMiddleware(new NextRequest(APP + "/entrar"), new Headers());
    expect(response.status).toBe(200); expect(sdk.getUser).toHaveBeenCalledOnce();
  });
  it("rejects mismatches before either Auth SDK, middleware refresh or a domain client exists", async () => {
    const cfg = config(); install({ ...ENV, VERCEL_PROJECT_ID: "foreign-project" });
    expect(() => createRequestClient(cfg, jar, false)).toThrow(); expect(() => createPrivilegedClient(cfg)).toThrow();
    for (const factory of [
      () => captureTaskGatewayForRequest(cfg, actor, "read.captures"), () => activityGatewayForRequest(cfg, actor),
      () => financeGatewayForRequest(cfg, actor, "read.finance"), () => routineGatewayForRequest(cfg, actor, "read.projects"),
      () => knowledgeGatewayForRequest(cfg, actor, "read.knowledge"), () => vaultGatewayForRequest(cfg, actor, "read.vault"),
      () => searchForRequest(cfg, actor), () => settingsForRequest(cfg, actor), () => adminServicesForRequest(cfg, actor), () => filesServicesForRequest(cfg, actor),
    ]) expect(factory).toThrow();
    await expect(calendarJobs(cfg)).rejects.toThrow(); await expect(cleanupFiles(cfg)).rejects.toThrow();
    const response = await updateSessionMiddleware(new NextRequest(APP + "/entrar"), new Headers());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("foreign-project");
    expect(sdk.create).not.toHaveBeenCalled(); expect(sdk.server).not.toHaveBeenCalled(); expect(sdk.rpc).not.toHaveBeenCalled(); expect(sdk.getUser).not.toHaveBeenCalled();
  });
  it("refuses direct Auth construction for a production Preview or a cross-project config", () => {
    const cfg = config();
    for (const environment of [{ ...ENV, VERCEL_ENV: "production" }, { ...ENV, SUPABASE_URL: PERSONAL }, { ...ENV, VERCEL_GIT_COMMIT_REF: "main" }]) {
      install(environment);
      expect(() => createRequestClient(cfg, jar, false)).toThrow(); expect(() => createPrivilegedClient(cfg)).toThrow();
    }
    install(ENV);
    for (const changed of [{ ...cfg, supabaseUrl: PERSONAL }, { ...cfg, appOrigin: APP + "/" }, { ...cfg, secureCookies: false }]) {
      expect(() => createRequestClient(changed, jar, false)).toThrow(); expect(() => createPrivilegedClient(changed)).toThrow();
    }
    expect(sdk.server).not.toHaveBeenCalled(); expect(sdk.create).not.toHaveBeenCalled();
  });
  it("binds the original hosted adapters to the tuple and does not broaden the Admin local exception", () => {
    install(ENV); const cfg = config();
    expect(isTrustedHostedDatabaseOrigin(cfg)).toBe(true); expect(isTrustedDatabaseOrigin(cfg, ENV, "win32")).toBe(true);
    captureTaskGatewayForRequest(cfg, actor, "read.captures"); financeGatewayForRequest(cfg, actor, "read.finance"); settingsForRequest(cfg, actor);
    expect(sdk.create).toHaveBeenCalledTimes(3); for (const call of sdk.create.mock.calls) expect(call[0]).toBe(HOMOLOG);
    expect(isTrustedHostedDatabaseOrigin({ ...cfg, supabaseUrl: "http://127.0.0.1:54321" }, { APP_MODE: "supabase", SC_ADMIN_BROWSER_RUN: "1" })).toBe(false);
    for (const changed of [{ ...cfg, supabaseUrl: PERSONAL }, { ...cfg, appOrigin: "https://other.vercel.app" }, { ...cfg, secureCookies: false }]) expect(isTrustedHostedDatabaseOrigin(changed)).toBe(false);
  });
});

describe("original Storage resolver, signed URL validator and CSP", () => {
  it("resolves only the bound hosted project, not production or disposable local credentials", () => {
    const cfg = config(); expect(resolveStorageOrigin(cfg, ENV, "win32")).toBe(HOMOLOG);
    for (const environment of [{ ...ENV, VERCEL_PROJECT_ID: undefined }, { ...ENV, SUPABASE_URL: PERSONAL }, { ...ENV, APP_URL: APP + "/" }]) expect(resolveStorageOrigin(cfg, environment, "linux")).toBeUndefined();
    expect(resolveStorageOrigin({ ...cfg, supabaseUrl: PERSONAL }, ENV, "linux")).toBeUndefined();
    expect(resolveStorageOrigin({ ...cfg, supabaseUrl: "http://127.0.0.1:54321" }, ENV, "linux")).toBeUndefined();
    const path = `/storage/v1/object/upload/sign/second-brain-staging/${actor.userId}/${actor.sessionId}?token=synthetic-token`;
    expect(signedUploadUrl(HOMOLOG + path, HOMOLOG, actor.userId, actor.sessionId, "synthetic-token")).toBe(HOMOLOG + path);
    for (const origin of [PERSONAL, "http://127.0.0.1:54321", "https://foreign.supabase.co"]) expect(signedUploadUrl(origin + path, HOMOLOG, actor.userId, actor.sessionId, "synthetic-token")).toBeNull();
    expect(signedUploadUrl(HOMOLOG + path, PERSONAL, actor.userId, actor.sessionId, "synthetic-token")).toBeNull();
  });
  it("allows only homologation Storage on the real canonical request, with no fallback for refused contexts", async () => {
    expect(cspStorageOrigin(APP, ENV)).toBe(HOMOLOG);
    expect(cspStorageOriginForRequest(new NextRequest(APP + "/capturar"), ENV)).toBe(HOMOLOG);
    const policy = await contentSecurityPolicy(createNonce(), { https: true, storageOrigin: cspStorageOrigin(APP, ENV) });
    expect(policy).toContain(HOMOLOG + "/storage/v1/"); expect(policy).not.toContain(PERSONAL);
    for (const origin of ["https://www.segundocerebroapp.com.br", "https://other.vercel.app"]) {
      const selection = cspStorageOriginForRequest(new NextRequest(origin + "/capturar", { headers: { origin: APP, "x-forwarded-host": HOST } }), ENV);
      expect(selection).toBeNull();
      const refused = await contentSecurityPolicy(createNonce(), { https: true, storageOrigin: selection });
      expect(refused).not.toContain("supabase.co"); expect(refused).toContain("connect-src 'self';");
    }
    expect(cspStorageOrigin(APP, { ...ENV, VERCEL_ENV: "production" })).toBeNull();
    let reads = 0; const forged = { get url(): string { reads++; throw new Error("PRIVATE_CANARY"); } } as Request;
    expect(cspStorageOriginForRequest(forged, ENV)).toBeNull(); expect(reads).toBe(0);
    expect(cspStorageOrigin(APP, {})).toBe(PERSONAL);
  });
});
