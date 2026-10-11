import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import type { AuthenticatedIdentity } from "../../src/lib/auth/types";
import type { AccountSettings } from "../../src/core/configuracoes";
vi.mock("server-only", () => ({}));
const sdk = vi.hoisted(() => ({ create: vi.fn(), rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: sdk.create }));
import * as origin from "../../src/lib/auth/database-origin-server";
import { settingsForRequest } from "../../src/adapters/db/settings-runtime";
import { adminServicesForRequest } from "../../src/adapters/db/admin-runtime";

const policy = origin.isTrustedDatabaseOrigin;
const actor: AuthenticatedIdentity = { userId: "11000000-0000-4000-8000-000000000001", sessionId: "11000000-0000-4000-8000-000000000011", role: "master", mustChangePassword: false, entitlements: {} };
const config: SupabaseAuthConfig = { mode: "supabase", appOrigin: "http://127.0.0.1:3117", supabaseUrl: "http://127.0.0.1:54321", publishableKey: "sb_publishable_synthetic_admin_fixture", secretKey: "sb_secret_synthetic_admin_fixture", stateSecret: "synthetic-state-exclusive-secret-32-bytes", rateLimitSecret: "synthetic-rate-exclusive-secret-32-bytes", secureCookies: false };
const adminSecret = "synthetic-admin-exclusive-secret-32-bytes";
const environment = (): Record<string, string | undefined> => ({
  NODE_ENV: "development", APP_MODE: "supabase", APP_URL: config.appOrigin, SUPABASE_URL: config.supabaseUrl,
  CI: "true", GITHUB_ACTIONS: "true", SC_AUTH_LOCAL_CI_RUN: "1", SC_ADMIN_BROWSER_LOCAL_CI_RUN: "1", SC_ADMIN_BROWSER_RUN: "1", SC_ADMIN_BROWSER_CASE: "BLOCK_LIVE_BROWSER",
  SC_ADMIN_BROWSER_NAMESPACE: "sc-admin-native-" + "a".repeat(32), SC_ADMIN_BROWSER_PROJECT: "sc-auth-ci-" + "b".repeat(24), SC_ADMIN_BROWSER_SYSTEM: "7250000000000000001", GITHUB_SHA: "c".repeat(40),
  SUPABASE_PUBLISHABLE_KEY: config.publishableKey, SUPABASE_SECRET_KEY: config.secretKey, AUTH_STATE_SECRET: config.stateSecret, AUTH_RATE_LIMIT_SECRET: config.rateLimitSecret, ADMIN_COMMAND_SECRET: adminSecret,
});
const settings: AccountSettings = { user_id: actor.userId, profile: { display_name: "Offline fixture", email: null, avatar_file_id: null }, preferences: { theme: "system", default_calendar_view: "week", values_hidden: false, meeting_reminders_enabled: true, meeting_reminder_minutes: 15 }, modules: [] };
beforeEach(() => { vi.clearAllMocks(); sdk.create.mockReturnValue({ rpc: sdk.rpc, auth: {} }); vi.stubEnv("ADMIN_COMMAND_SECRET", adminSecret); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("server database destination", () => {
  it("preserves the exact personal hosted destination without a local opt-in", () => {
    const personal = { ...config, supabaseUrl: "https://rishenjoikgmfubmnfiu.supabase.co", appOrigin: "https://segundo-cerebro-of.vercel.app", secureCookies: true };
    for (const platform of ["linux", "win32", "darwin"] as const) expect(policy(personal, { NODE_ENV: "production" }, platform)).toBe(true);
    for (const supabaseUrl of [personal.supabaseUrl + "/", "http://rishenjoikgmfubmnfiu.supabase.co", "https://foreign-project.supabase.co", "https://blacksheep.example.invalid", "https://voe.example.invalid"]) expect(policy({ ...personal, supabaseUrl }, environment(), "linux")).toBe(false);
  });
  it("admits only the two marked disposable Admin cases on Linux", () => {
    for (const caseName of ["BLOCK_LIVE_BROWSER", "FIRST_FORCED_BROWSER"]) expect(policy(config, { ...environment(), SC_ADMIN_BROWSER_CASE: caseName }, "linux")).toBe(true);
    for (const platform of ["win32", "darwin"] as const) expect(policy(config, environment(), platform)).toBe(false);
  });
  it("requires every existing opt-in and development boundary", () => {
    for (const name of ["NODE_ENV", "APP_MODE", "CI", "GITHUB_ACTIONS", "SC_AUTH_LOCAL_CI_RUN", "SC_ADMIN_BROWSER_LOCAL_CI_RUN", "SC_ADMIN_BROWSER_RUN"]) {
      const absent = environment(); delete absent[name]; expect(policy(config, absent, "linux")).toBe(false);
      expect(policy(config, { ...environment(), [name]: name === "NODE_ENV" ? "production" : "false" }, "linux")).toBe(false);
    }
    expect(policy(config, { ...environment(), SC_ADMIN_BROWSER_RUN: undefined, SC_FILES_LOCAL_CI_RUN: "1" }, "linux")).toBe(false);
    expect(policy({ ...config, secureCookies: true }, environment(), "linux")).toBe(false);
  });
  it("rejects endpoint aliases and mismatches even if environment and config agree", () => {
    for (const appOrigin of ["http://localhost:3117", "http://127.0.0.1:3118", "https://127.0.0.1:3117", config.appOrigin + "/", config.appOrigin + "?", "http://user:password@127.0.0.1:3117"]) expect(policy({ ...config, appOrigin }, { ...environment(), APP_URL: appOrigin }, "linux")).toBe(false);
    for (const supabaseUrl of ["http://localhost:54321", "http://127.0.0.1:54322", "https://127.0.0.1:54321", config.supabaseUrl + "/", "https://foreign-project.supabase.co"]) expect(policy({ ...config, supabaseUrl }, { ...environment(), SUPABASE_URL: supabaseUrl }, "linux")).toBe(false);
    expect(policy(config, { ...environment(), APP_URL: "http://127.0.0.1:3118" }, "linux")).toBe(false);
    expect(policy(config, { ...environment(), SUPABASE_URL: "http://127.0.0.1:54322" }, "linux")).toBe(false);
  });
  it("requires the existing case, namespace, project, system and source bindings", () => {
    for (const [name, value] of [["SC_ADMIN_BROWSER_CASE", "CREATE_FORCED"], ["SC_ADMIN_BROWSER_NAMESPACE", "sc-admin-native-foreign"], ["SC_ADMIN_BROWSER_PROJECT", "rishenjoikgmfubmnfiu"], ["SC_ADMIN_BROWSER_SYSTEM", "1"], ["GITHUB_SHA", "HEAD"]]) expect(policy(config, { ...environment(), [name!]: value }, "linux")).toBe(false);
    for (const name of ["SC_ADMIN_BROWSER_CASE", "SC_ADMIN_BROWSER_NAMESPACE", "SC_ADMIN_BROWSER_PROJECT", "SC_ADMIN_BROWSER_SYSTEM", "GITHUB_SHA"]) { const absent = environment(); delete absent[name]; expect(policy(config, absent, "linux")).toBe(false); }
  });
  it("binds configuration keys and exclusive secrets without coercion", () => {
    for (const name of ["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "AUTH_STATE_SECRET", "AUTH_RATE_LIMIT_SECRET"]) expect(policy(config, { ...environment(), [name]: "synthetic-mismatch" }, "linux")).toBe(false);
    expect(policy(config, { ...environment(), ADMIN_COMMAND_SECRET: config.stateSecret }, "linux")).toBe(false);
    expect(policy(config, { ...environment(), ADMIN_COMMAND_SECRET: "short" }, "linux")).toBe(false);
    for (const patch of [{ stateSecret: "short" }, { secretKey: "legacy-jwt" }, { publishableKey: "legacy-anon" }]) {
      const changed = { ...config, ...patch }; expect(policy(changed, { ...environment(), SUPABASE_SECRET_KEY: changed.secretKey, SUPABASE_PUBLISHABLE_KEY: changed.publishableKey, AUTH_STATE_SECRET: changed.stateSecret }, "linux")).toBe(false);
    }
  });
  it("refuses external credentials and environment families before a client exists", () => {
    for (const name of ["GH_TOKEN", "GITHUB_TOKEN", "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL", "DATABASE_URL", "PGPASSWORD", "VERCEL", "GOOGLE_CLIENT_SECRET", "AWS_ACCESS_KEY_ID", "DOCKER_HOST", "SC_AUTH_LIVE_RUN", "SC_BACKUP_RUN"]) expect(policy(config, { ...environment(), [name]: "synthetic-unusable-external-value" }, "linux")).toBe(false);
    expect(policy(config, { ...environment(), GH_TOKEN: undefined, GITHUB_TOKEN: "" }, "linux")).toBe(true);
  });
  it("does not invoke environment or configuration getters or value coercion", () => {
    let reads = 0;
    const accessor = Object.defineProperty(environment(), "GH_TOKEN", { enumerable: true, get() { reads++; throw Error("PRIVATE_CANARY"); } }); expect(policy(config, accessor, "linux")).toBe(false);
    const hidden = Object.defineProperty(environment(), "GH_TOKEN", { enumerable: false, value: "synthetic-unusable" }); expect(policy(config, hidden, "linux")).toBe(false);
    const cfg = Object.defineProperty({ ...config }, "supabaseUrl", { enumerable: true, get() { reads++; throw Error("PRIVATE_CANARY"); } }); expect(policy(cfg, environment(), "linux")).toBe(false);
    const malformed = Object.defineProperty(environment(), "SC_ADMIN_BROWSER_CASE", { enumerable: true, value: { toString() { reads++; throw Error("PRIVATE_CANARY"); } } }); expect(policy(config, malformed, "linux")).toBe(false); expect(reads).toBe(0);
  });
});

describe("runtime integration with explicit offline policy and SDK doubles", () => {
  it("keeps an invalid local environment and every foreign project before SDK construction", () => {
    const invalid = { ...environment(), SC_AUTH_LOCAL_CI_RUN: undefined };
    vi.spyOn(origin, "isTrustedDatabaseOrigin").mockImplementation(cfg => policy(cfg, invalid, "linux"));
    for (const cfg of [config, { ...config, supabaseUrl: "https://foreign-project.supabase.co" }]) {
      expect(() => settingsForRequest(cfg, actor)).toThrow(); expect(() => adminServicesForRequest(cfg, actor)).toThrow();
    }
    expect(sdk.create).not.toHaveBeenCalled(); expect(sdk.rpc).not.toHaveBeenCalled();
  });
  it("constructs only the bound local SDK after the actual policy accepts the synthetic Linux fixture", async () => {
    // This explicit platform/environment port is a unit seam, never native proof.
    vi.spyOn(origin, "isTrustedDatabaseOrigin").mockImplementation(cfg => policy(cfg, environment(), "linux"));
    sdk.rpc.mockResolvedValue({ data: settings, error: null });
    await expect(settingsForRequest(config, actor).load()).resolves.toEqual(settings);
    expect(sdk.create).toHaveBeenLastCalledWith(config.supabaseUrl, config.secretKey, expect.objectContaining({ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }));
    expect(sdk.rpc).toHaveBeenLastCalledWith("settings_snapshot", { p_user: actor.userId, p_session: actor.sessionId });
    sdk.rpc.mockResolvedValue({ data: null, error: null }); await adminServicesForRequest(config, actor).port.requireMaster();
    expect(sdk.create).toHaveBeenCalledTimes(2); expect(sdk.rpc).toHaveBeenLastCalledWith("admin_snapshot", { p_actor: actor.userId, p_session: actor.sessionId });
  });
  it("retains the hosted destination and the downstream master fence", async () => {
    const personal = { ...config, supabaseUrl: "https://rishenjoikgmfubmnfiu.supabase.co" };
    settingsForRequest(personal, actor); const services = adminServicesForRequest(personal, { ...actor, role: "user" });
    await expect(services.port.requireMaster()).rejects.toThrow(); expect(sdk.create).toHaveBeenCalledTimes(2); expect(sdk.rpc).not.toHaveBeenCalled();
    for (const call of sdk.create.mock.calls) expect(call[0]).toBe(personal.supabaseUrl);
  });
});
