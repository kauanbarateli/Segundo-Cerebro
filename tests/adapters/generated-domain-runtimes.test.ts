import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ googleConfig: vi.fn() }));
vi.mock("../../src/adapters/db/google-calendar-security", async importOriginal => ({
  ...await importOriginal<typeof import("../../src/adapters/db/google-calendar-security")>(),
  readGoogleCalendarConfig: seams.googleConfig,
}));
import { calendarAdminRuns, calendarJobs, calendarServices } from "../../src/adapters/db/google-calendar-runtime";
import { knowledgeGatewayForRequest } from "../../src/adapters/db/knowledge-runtime";
import { routineGatewayForRequest } from "../../src/adapters/db/projects-habits-runtime";
import { KnowledgeCommitUnknown, type KnowledgeCommit } from "../../src/adapters/db/knowledge-store";
import { CommitOutcomeUnknown } from "../../src/adapters/db/capture-task-store";
import type { RoutineCommit } from "../../src/adapters/db/projects-habits-store";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import type { AuthenticatedIdentity } from "../../src/lib/auth/types";
import type { Database } from "../../src/lib/supabase/database.generated";

const owner = "25000000-0000-4000-8000-000000000001";
const session = "25000000-0000-4000-8000-000000000002";
const account = "25000000-0000-4000-8000-000000000003";
const canary = "SYNTHETIC_PRIVATE_RPC_DIAGNOSTIC";
const config: SupabaseAuthConfig = {
  mode: "supabase", appOrigin: "https://example.invalid",
  supabaseUrl: "https://rishenjoikgmfubmnfiu.supabase.co",
  publishableKey: "sb_publishable_SYNTHETIC", secretKey: "sb_secret_SYNTHETIC",
  stateSecret: "s".repeat(32), rateLimitSecret: "r".repeat(32), secureCookies: true,
};
const identity: AuthenticatedIdentity = { userId: owner, sessionId: session, mustChangePassword: false, role: "user", entitlements: {} };
const bound = { p_user: owner, p_session: session };
const knowledgeState = { revision: "0", notebooks: [], pages: [], refs: [], links: [], targets: [], captures: [], receipts: [] };
const routineState = { revision: "0", projects: [], habits: [], entries: [], pauses: [], containers: [], events: [], receipts: [] };
const knowledgeRequest: KnowledgeCommit = {
  expected_revision: "0", context: { user_id: owner, canal: "web" }, changes: [], refs: [], events: [],
  receipt: { user_id: owner, command: "knowledge.notebook.create", client_id: "knowledge-client", fingerprint: "{}", result: null },
};
const routineRequest: RoutineCommit = {
  expectedRevision: "0", context: { user_id: owner, canal: "web" }, changes: [], events: [],
  receipt: { user_id: owner, command: "habit.mark", client_id: "routine-client", fingerprint: "{}", result: null },
};
const calls: { name: string; body: unknown; method: string | undefined; cache: RequestCache | undefined }[] = [];
let reply: unknown = {};
let status = 200;
const transport = vi.fn<typeof fetch>(async (input, options) => {
  const url = new URL(String(input));
  if (url.origin !== config.supabaseUrl || !url.pathname.startsWith("/rest/v1/rpc/") || url.search) throw new Error("Unexpected fake transport target");
  calls.push({ name: url.pathname.slice("/rest/v1/rpc/".length), body: JSON.parse(String(options?.body)), method: options?.method, cache: options?.cache });
  return new Response(JSON.stringify(reply), { status, headers: { "Content-Type": "application/json" } });
});
beforeEach(() => {
  vi.clearAllMocks(); calls.length = 0; reply = {}; status = 200;
  vi.stubGlobal("fetch", transport);
  seams.googleConfig.mockReturnValue({
    appOrigin: config.appOrigin, secureCookies: true, clientId: "synthetic.apps.googleusercontent.com",
    clientSecret: "synthetic-client-secret", stateSecret: "g".repeat(32), tokenKeyId: "synthetic",
    tokenKeys: new Map([["synthetic", Buffer.alloc(32, 7)]]), cronSecret: null,
    redirectUri: config.appOrigin + "/api/calendar/oauth/callback",
  });
});
afterEach(() => { vi.unstubAllGlobals(); });
const expectRpc = (name: string, body: unknown) => expect(calls.at(-1)).toEqual({ name, body, method: "POST", cache: "no-store" });

describe("Official generated RPC signatures through the installed SDK and fake transport", () => {
  it("Knowledge snapshot/commit/receipt send exactly their generated argument keys", async () => {
    const gateway = knowledgeGatewayForRequest(config, identity, "knowledge.notebook.create");
    reply = knowledgeState;
    const snapshot = gateway.snapshot();
    expect(snapshot).toBeInstanceOf(Promise);
    expect(await snapshot).toEqual(knowledgeState);
    expectRpc("knowledge_snapshot", { ...bound, p_operation: "knowledge.notebook.create" });
    reply = { status: "committed", result: null };
    expect(await gateway.commit(knowledgeRequest)).toEqual(reply);
    expectRpc("knowledge_commit", { ...bound, p_operation: "knowledge.notebook.create", p_request: knowledgeRequest });
    reply = null;
    expect(await gateway.receipt("knowledge.notebook.create", "knowledge-client")).toBeNull();
    expectRpc("knowledge_receipt", { ...bound, p_operation: "knowledge.notebook.create", p_command: "knowledge.notebook.create", p_client_id: "knowledge-client" });
    expect(calls).toHaveLength(3);
  });
  it("Projects/Habits snapshot/commit/receipt retain exact arguments and await the SDK builder", async () => {
    const gateway = routineGatewayForRequest(config, identity, "habit.mark");
    reply = routineState;
    const snapshot = gateway.snapshot();
    expect(snapshot).toBeInstanceOf(Promise);
    expect(await snapshot).toEqual(routineState);
    expectRpc("projects_habits_snapshot", { ...bound, p_operation: "habit.mark" });
    reply = { status: "committed", result: null };
    expect(await gateway.commit(routineRequest)).toEqual(reply);
    expectRpc("projects_habits_commit", { ...bound, p_operation: "habit.mark", p_request: routineRequest });
    reply = null;
    expect(await gateway.receipt("habit.mark", "routine-client")).toBeNull();
    expectRpc("projects_habits_receipt", { ...bound, p_operation: "habit.mark", p_command: "habit.mark", p_client_id: "routine-client" });
    expect(calls).toHaveLength(3);
  });
  it("Calendar web RPC sends a session UUID and preserves the explicit input", async () => {
    const services = calendarServices(config, identity);
    await services.repo.select(account, false, "calendar-client");
    expect(calls).toHaveLength(1);
    expectRpc("google_calendar_call", {
      ...bound, p_cron: false, p_command: "select",
      p_input: { calendar_id: account, selected: false, client_id: "calendar-client" },
      p_execution: expect.stringMatching(/^[a-f0-9-]{36}$/),
    });
  });
  it("Calendar cron keeps SQL-compatible p_session null on the wire without widening the official schema", async () => {
    await calendarServices(config, { userId: owner, sessionId: null }, true).repo.requireAccess();
    expectRpc("google_calendar_call", {
      p_user: owner, p_session: null, p_cron: true, p_command: "guard", p_input: {},
      p_execution: expect.stringMatching(/^[a-f0-9-]{36}$/),
    });
    expect(Object.keys(calls[0]!.body as object)).toHaveLength(6);
  });
  it("The no-argument Calendar jobs RPC sends an empty SDK body and keeps jobs private", async () => {
    reply = [{ user_id: owner, account_id: account }];
    expect(await calendarJobs(config)).toEqual(reply);
    expectRpc("google_calendar_jobs", {});
    reply = [{ user_id: owner, account_id: account, access_token: canary }];
    await expect(calendarJobs(config)).rejects.toMatchObject({ code: "unavailable" });
  });
  it("Calendar Admin runs bind actor and session through the generated Args", async () => {
    reply = [];
    expect(await calendarAdminRuns(config, identity)).toEqual([]);
    expectRpc("google_calendar_admin_runs", { p_actor: owner, p_session: session });
  });
  it("Calendar rejects web-null and cron-session contexts before any transport call", () => {
    expect(() => calendarServices(config, { userId: owner, sessionId: null })).toThrow();
    expect(() => calendarServices(config, identity, true)).toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it("All three adapters preserve the personal-project pin before transport", async () => {
    const foreign = { ...config, supabaseUrl: "https://foreign.invalid" };
    expect(() => knowledgeGatewayForRequest(foreign, identity, "read.knowledge")).toThrow();
    expect(() => routineGatewayForRequest(foreign, identity, "read.habits")).toThrow();
    expect(() => calendarServices(foreign, identity)).toThrow();
    await expect(calendarJobs(foreign)).rejects.toMatchObject({ code: "unavailable" });
    await expect(calendarAdminRuns(foreign, identity)).rejects.toMatchObject({ code: "unavailable" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("Knowledge rejects a foreign commit before transport and routine rejects a foreign read DTO", async () => {
    await expect(knowledgeGatewayForRequest(config, identity, "knowledge.notebook.create").commit({
      ...knowledgeRequest, context: { user_id: session, canal: "web" },
    })).rejects.toThrow();
    // Routine owner checks run in its store before the gateway; the read DTO remains owner checked here.
    reply = { ...routineState, projects: [{ id: account, user_id: session }] };
    await expect(routineGatewayForRequest(config, identity, "read.projects").snapshot()).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });
  it("A generated Json return still requires domain DTO validation", async () => {
    reply = { ...knowledgeState, pages: [{ id: account, user_id: session }] };
    await expect(knowledgeGatewayForRequest(config, identity, "read.knowledge").snapshot()).rejects.toMatchObject({ code: "unavailable" });
    reply = null;
    await expect(calendarServices(config, identity).repo.snapshot()).rejects.toMatchObject({ code: "unavailable" });
  });
  it.each(["knowledge", "routine", "calendar"] as const)("SQL forbidden remains closed for %s", async kind => {
    reply = { code: "42501", message: canary, details: canary, hint: canary }; status = 403;
    const pending = kind === "knowledge"
      ? knowledgeGatewayForRequest(config, identity, "read.knowledge").snapshot()
      : kind === "routine"
        ? routineGatewayForRequest(config, identity, "read.habits").snapshot()
        : calendarServices(config, identity).repo.requireAccess();
    await expect(pending).rejects.toMatchObject({ code: "forbidden" });
    await expect(pending).rejects.not.toThrow(canary);
    expect(calls).toHaveLength(1);
  });
  it.each(["knowledge", "routine"] as const)("A backend failure without a SQL code preserves an unknown %s commit outcome", async kind => {
    reply = { message: canary }; status = 503;
    const pending = kind === "knowledge"
      ? knowledgeGatewayForRequest(config, identity, "knowledge.notebook.create").commit(knowledgeRequest)
      : routineGatewayForRequest(config, identity, "habit.mark").commit(routineRequest);
    await expect(pending).rejects.toBeInstanceOf(kind === "knowledge" ? KnowledgeCommitUnknown : CommitOutcomeUnknown);
    await expect(pending).rejects.not.toThrow(canary);
    expect(calls).toHaveLength(1);
  });
  it.each(["knowledge", "routine"] as const)("A rejected fetch preserves an unknown %s commit without a second request", async kind => {
    transport.mockRejectedValueOnce(new Error(canary));
    const pending = kind === "knowledge"
      ? knowledgeGatewayForRequest(config, identity, "knowledge.notebook.create").commit(knowledgeRequest)
      : routineGatewayForRequest(config, identity, "habit.mark").commit(routineRequest);
    await expect(pending).rejects.toBeInstanceOf(kind === "knowledge" ? KnowledgeCommitUnknown : CommitOutcomeUnknown);
    await expect(pending).rejects.not.toThrow(canary);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("Generated contracts retain no-arg and UUID distinctions", () => {
    expectTypeOf<Database["public"]["Functions"]["google_calendar_jobs"]["Args"]>().toEqualTypeOf<never>();
    expectTypeOf<Database["public"]["Functions"]["google_calendar_call"]["Args"]["p_session"]>().toEqualTypeOf<string>();
    expectTypeOf<Database["public"]["Functions"]["knowledge_commit"]["Args"]["p_request"]>().toEqualTypeOf<Database["public"]["Functions"]["projects_habits_commit"]["Args"]["p_request"]>();
  });
});
