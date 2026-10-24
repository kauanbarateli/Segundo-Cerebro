/** Original routes -> Calendar runtime/installed SDK -> canonical SQL in RAM.
 * Auth identity/configuration and every Google HTTP response are explicit
 * synthetic seams. No Next server, GoTrue, hosted database or Google service
 * is started. A fake Google 200 is not a real revocation acknowledgement. */
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createOnboardingCandidateSql } from "../helpers/onboarding-candidate-sql";
import type { GoogleCalendarConfig } from "../../src/adapters/db/google-calendar-security";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import type { AuthenticatedIdentity } from "../../src/lib/auth/types";
import type { CalendarSnapshot, EncryptedCalendarTokens } from "../../src/core/calendario";

vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ authConfig: vi.fn(), googleConfig: vi.fn(), identity: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.authConfig }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: async () => ({ gateway: { readIdentity: seams.identity } }) }));
vi.mock("../../src/adapters/db/google-calendar-security", async original => ({
  ...await original<typeof import("../../src/adapters/db/google-calendar-security")>(),
  readGoogleCalendarConfig: seams.googleConfig,
}));
import { POST as START } from "../../src/app/api/calendar/oauth/start/route";
import { GET as CALLBACK } from "../../src/app/api/calendar/oauth/callback/route";
import { GET, POST } from "../../src/app/api/calendar/route";
import { calendarTokenCipher, GOOGLE_FLOW_COOKIE, verifyGoogleFlow } from "../../src/adapters/db/google-calendar-security";

const owner = "69000000-0000-4000-8000-000000000001", session = "69000000-0000-4000-8000-000000000002";
const foreign = "69000000-0000-4000-8000-000000000003";
const origin = "https://calendar-oauth-sql.test", api = "https://rishenjoikgmfubmnfiu.supabase.co";
const auth: SupabaseAuthConfig = {
  mode: "supabase", appOrigin: origin, supabaseUrl: api, secureCookies: true,
  publishableKey: "sb_publishable_SYNTHETIC", secretKey: "sb_secret_SYNTHETIC",
  stateSecret: "s".repeat(32), rateLimitSecret: "r".repeat(32),
};
const google: GoogleCalendarConfig = {
  appOrigin: origin, secureCookies: true, clientId: "synthetic.apps.googleusercontent.com",
  clientSecret: "SYNTHETIC_GOOGLE_CLIENT_SECRET", stateSecret: "g".repeat(32),
  tokenKeyId: "synthetic", tokenKeys: new Map([["synthetic", Buffer.alloc(32, 7)]]),
  cronSecret: null, redirectUri: origin + "/api/calendar/oauth/callback",
};
const actor: AuthenticatedIdentity = { userId: owner, sessionId: session, role: "user", mustChangePassword: false, entitlements: {} };
const access = "SYNTHETIC_GOOGLE_ACCESS", refresh = "SYNTHETIC_GOOGLE_REFRESH", code = "SYNTHETIC_OAUTH_CODE";
const granted = ["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/calendar.calendarlist.readonly", "https://www.googleapis.com/auth/calendar.events.readonly"];
const window = { start_day: "2026-10-01", end_day: "2026-11-01" };
const write = (body: unknown) => new Request(origin + "/api/calendar", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Expected-User-ID": owner }, body: JSON.stringify(body),
});
const read = () => new Request(origin + "/api/calendar", { headers: { "X-Expected-User-ID": owner } });
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

it("synthetic Google journey composes START/PKCE/cookie -> positive CALLBACK -> real AAD envelope/SQL/event -> pending/retried disconnect", async () => {
  seams.authConfig.mockReturnValue(auth); seams.googleConfig.mockReturnValue(google); seams.identity.mockResolvedValue(actor);
  // Even bootstrap has no native fetch fallback; the RAM fixture uses installed
  // local WASM bytes. Replace this refusal only with the closed transport below.
  vi.stubGlobal("fetch", () => { throw new Error("Only declared synthetic HTTP transports are allowed."); });
  const db = await createOnboardingCandidateSql();
  const rpcCommands: string[] = [], googleCalls: string[] = [];
  let challenge = "", verifier = "", exchangeCount = 0, revokeCount = 0;
  try {
    await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','calendar-owner@example.invalid'),($2,'authenticated','authenticated','calendar-foreign@example.invalid')", [owner, foreign]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [session, owner]);
    expect((await db.query("select role from public.user_roles where user_id=$1", [owner])).rows).toEqual([{ role: "user" }]);
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, options?: RequestInit) => {
      const request = new Request(input, options), url = new URL(request.url);
      expect(options?.cache).toBe("no-store");
      if (url.origin === api) {
        if(url.pathname==="/rest/v1/rpc/onboarding_call") {
          expect(url.search).toBe("");expect(request.method).toBe("POST");expect(request.headers.get("apikey")).toBe(auth.secretKey);expect(request.headers.get("authorization")).toBe("Bearer "+auth.secretKey);
          const onboardingArgs=await request.json();expect(Object.keys(onboardingArgs).sort()).toEqual(["p_operation","p_request","p_session","p_user"]);
          expect(onboardingArgs.p_user).toBe(owner);expect(onboardingArgs.p_session).toBe(session);expect(onboardingArgs.p_operation).toBe("oauth_classify");
          try {const result=await db.transaction(async tx=>{await tx.exec("set local role service_role");return tx.query<{value:unknown}>("select public.onboarding_call($1::uuid,$2::uuid,$3::text,$4::jsonb) as value",[owner,session,onboardingArgs.p_operation,JSON.stringify(onboardingArgs.p_request)]);});
            expect(result.rows[0]!.value).toEqual({kind:"direct"});return Response.json(result.rows[0]!.value);
          }catch(error){const code=error&&typeof error==="object"&&"code" in error?String(error.code):"XX000";return Response.json({code,message:"SYNTHETIC_SQL_REFUSAL"},{status:400});}
        }
        expect(url.pathname).toBe("/rest/v1/rpc/google_calendar_call"); expect(url.search).toBe(""); expect(url.hash).toBe("");
        expect(request.method).toBe("POST"); expect(request.headers.get("apikey")).toBe(auth.secretKey);
        expect(request.headers.get("authorization")).toBe("Bearer " + auth.secretKey);
        const args = await request.json();
        expect(Object.keys(args).sort()).toEqual(["p_command", "p_cron", "p_execution", "p_input", "p_session", "p_user"]);
        expect(args.p_user).toBe(owner); expect(args.p_session).toBe(session); expect(args.p_cron).toBe(false);
        expect(args.p_execution).toMatch(/^[a-f0-9-]{36}$/); rpcCommands.push(args.p_command);
        try {
          // Same public function as PostgREST, under its real service_role grant.
          // Parameterized arguments are passed unchanged; no derived SQL body.
          const result = await db.transaction(async tx => {
            await tx.exec("set local role service_role");
            return tx.query<{ value: unknown }>("select public.google_calendar_call($1::uuid,$2::uuid,$3::text,$4::jsonb,$5::boolean,$6::uuid) as value", [args.p_user, args.p_session, args.p_command, JSON.stringify(args.p_input), args.p_cron, args.p_execution]);
          });
          return Response.json(result.rows[0]!.value);
        } catch (error) {
          const sqlCode = error && typeof error === "object" && "code" in error ? String(error.code) : "XX000";
          return Response.json({ code: sqlCode, message: "SYNTHETIC_SQL_REFUSAL" }, { status: 400 });
        }
      }
      expect(options?.redirect).toBe("error"); expect(options?.signal).toBeInstanceOf(AbortSignal);
      googleCalls.push(request.method + " " + url.origin + url.pathname);
      if (url.href === "https://oauth2.googleapis.com/token") {
        expect(request.method).toBe("POST"); const body = new URLSearchParams(await request.text());
        expect([...body.keys()].sort()).toEqual(["client_id", "client_secret", "code", "code_verifier", "grant_type", "redirect_uri"]);
        expect(body.get("grant_type")).toBe("authorization_code"); expect(body.get("code")).toBe(code);
        expect(body.get("client_id")).toBe(google.clientId); expect(body.get("client_secret")).toBe(google.clientSecret);
        expect(body.get("redirect_uri")).toBe(google.redirectUri); expect(body.get("code_verifier")).toBe(verifier);
        expect(createHash("sha256").update(body.get("code_verifier")!).digest("base64url")).toBe(challenge);
        expect((await db.query("select state from app_private.google_oauth_flows where user_id=$1", [owner])).rows).toEqual([{ state: "consumed" }]);
        exchangeCount++; return Response.json({ access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: 3600, scope: granted.join(" ") });
      }
      if (url.href === "https://oauth2.googleapis.com/revoke") {
        expect(request.method).toBe("POST"); const body = new URLSearchParams(await request.text());
        expect([...body.keys()]).toEqual(["token"]); expect(body.get("token")).toBe(refresh);
        expect((await db.query("select status from public.calendar_accounts where user_id=$1", [owner])).rows).toEqual([{ status: "revocation_pending" }]);
        expect((await db.query("select count(*)::integer as n from public.calendar_sources where user_id=$1", [owner])).rows).toEqual([{ n: 0 }]);
        revokeCount++; return revokeCount === 1 ? Response.json({ error: "invalid_token" }, { status: 400 }) : new Response("", { status: 200 });
      }
      expect(request.method).toBe("GET"); expect(request.headers.get("authorization")).toBe("Bearer " + access);
      if (url.href === "https://openidconnect.googleapis.com/v1/userinfo") return Response.json({ sub: "SYNTHETIC_GOOGLE_SUB", email: "google@example.invalid", email_verified: true });
      if (url.origin === "https://www.googleapis.com" && url.pathname === "/calendar/v3/users/me/calendarList") return Response.json({ items: [{ id: "synthetic-calendar", summary: "Calendário sintético", accessRole: "reader" }] });
      if (url.origin === "https://www.googleapis.com" && url.pathname === "/calendar/v3/calendars/synthetic-calendar/events") {
        expect(url.searchParams.get("timeMin")).toBe("2026-10-01T03:00:00.000Z"); expect(url.searchParams.get("timeMax")).toBe("2026-11-01T03:00:00.000Z");
        expect(url.searchParams.has("syncToken")).toBe(false);
        return Response.json({ items: [{ id: "synthetic-event", summary: "Evento Google sintético", start: { date: "2026-10-09" }, end: { date: "2026-10-12" } }], nextSyncToken: "SYNTHETIC_CURSOR" });
      }
      throw new Error("Unexpected synthetic transport target; real network is forbidden.");
    });

    const started = await START(write({ client_id: "synthetic-start" })); expect(started.status).toBe(200);
    const startBody = await started.json(); expect(Object.keys(startBody).sort()).toEqual(["authorization_url", "ok"]);
    const authorization = new URL(startBody.authorization_url); expect(authorization.origin).toBe("https://accounts.google.com");
    expect(authorization.pathname).toBe("/o/oauth2/v2/auth"); expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    challenge = authorization.searchParams.get("code_challenge")!; const state = authorization.searchParams.get("state")!;
    const cookie = started.cookies.get(GOOGLE_FLOW_COOKIE)!.value;
    expect(started.headers.get("set-cookie")).toContain("HttpOnly"); expect(started.headers.get("set-cookie")).toContain("Secure");
    const verified = verifyGoogleFlow(google, state, cookie, owner, session, Date.now()); expect(verified).not.toBeNull();
    verifier = verified!.flow.verifier; const account = verified!.flow.account_id;
    expect(authorization.href).not.toContain(verifier);
    const callback = (callbackState = state) => new NextRequest(google.redirectUri + "?state=" + encodeURIComponent(callbackState) + "&code=" + code, { headers: { Cookie: GOOGLE_FLOW_COOKIE + "=" + cookie } });
    const rejected = await CALLBACK(callback(state + "x"));
    expect(rejected.headers.get("location")).toBe(origin + "/calendario?notice=connection-failed"); expect(exchangeCount).toBe(0);
    expect((await db.query("select state from app_private.google_oauth_flows where user_id=$1", [owner])).rows).toEqual([{ state: "pending" }]);

    const connected = await CALLBACK(callback()); expect(connected.status).toBe(303);
    expect(connected.headers.get("location")).toBe(origin + "/calendario?notice=connected");
    expect(connected.headers.get("set-cookie")).toContain("Max-Age=0"); expect(exchangeCount).toBe(1);
    const credentials = await db.query<{ envelope: EncryptedCalendarTokens; credential_version: number }>("select c.envelope,a.credential_version from app_private.google_credentials c join public.calendar_accounts a on a.user_id=c.user_id and a.id=c.account_id where c.user_id=$1 and c.account_id=$2", [owner, account]);
    expect(credentials.rows).toHaveLength(1); const stored = credentials.rows[0]!;
    expect(stored.credential_version).toBe(1); expect(Object.keys(stored.envelope).sort()).toEqual(["ciphertext", "iv", "key_id", "tag", "version"]);
    expect(JSON.stringify(stored.envelope)).not.toContain(access); expect(JSON.stringify(stored.envelope)).not.toContain(refresh);
    const cipher = calendarTokenCipher(google), decoded = cipher.decrypt(owner, account, stored.credential_version, stored.envelope);
    expect(decoded).toMatchObject({ access_token: access, refresh_token: refresh, scopes: granted });
    expect(() => cipher.decrypt(foreign, account, stored.credential_version, stored.envelope)).toThrow();
    expect(() => cipher.decrypt(owner, session, stored.credential_version, stored.envelope)).toThrow();
    expect(() => cipher.decrypt(owner, account, stored.credential_version + 1, stored.envelope)).toThrow();
    expect((await db.query("select state from app_private.google_oauth_flows where user_id=$1", [owner])).rows).toEqual([{ state: "complete" }]);
    const replay = await CALLBACK(callback()); expect(replay.headers.get("location")).toBe(origin + "/calendario?notice=connection-failed");
    expect(exchangeCount).toBe(1); expect((await db.query("select envelope from app_private.google_credentials where account_id=$1", [account])).rows).toEqual([{ envelope: stored.envelope }]);

    const synced = await POST(write({ command: "calendar.sync", input: { client_id: "synthetic-sync", ...window } })); expect(synced.status).toBe(200);
    const syncBody = await synced.json(); expect(syncBody.ok).toBe(true);
    const snapshotResponse = await GET(read()); expect(snapshotResponse.status).toBe(200);
    const snapshot: CalendarSnapshot = await snapshotResponse.json(); expect(snapshot.window).toEqual(window);
    expect(snapshot.accounts).toEqual([expect.objectContaining({ id: account, user_id: owner, status: "connected", scopes: granted })]);
    expect(snapshot.items).toEqual([expect.objectContaining({ user_id: owner, account_id: account, title: "Evento Google sintético", all_day: true })]);
    // PostgreSQL keeps its civil-zone representation; compare the actual
    // instants without rewriting the original DTO into a parallel format.
    expect(Date.parse(snapshot.items[0]!.starts_at)).toBe(Date.parse("2026-10-09T03:00:00.000Z"));
    expect(Date.parse(snapshot.items[0]!.ends_at)).toBe(Date.parse("2026-10-12T03:00:00.000Z"));
    expect(snapshot.sync_runs).toEqual([expect.objectContaining({ status: "complete", calendar_count: 1, event_count: 1 })]);
    expect((await db.query("select id from public.calendar_events where user_id=$1", [owner])).rows).toEqual([{ id: snapshot.items[0]!.id }]);
    for (const secret of [access, refresh, code, verifier, "ciphertext", "SYNTHETIC_CURSOR"]) expect(JSON.stringify(snapshot)).not.toContain(secret);

    const disconnect = { command: "calendar.disconnect", input: { client_id: "synthetic-disconnect", account_id: account } };
    const pending = await POST(write(disconnect)); expect(pending.status).toBe(503); expect(revokeCount).toBe(1);
    expect(rpcCommands).not.toContain("finish_disconnect");
    expect((await db.query("select envelope from app_private.google_credentials where account_id=$1", [account])).rows).toEqual([{ envelope: stored.envelope }]);
    const fenced: CalendarSnapshot = await (await GET(read())).json();
    expect(fenced.accounts).toEqual([expect.objectContaining({ id: account, status: "revocation_pending" })]);
    expect(fenced.items).toEqual([]); expect(fenced.calendars).toEqual([]); expect(fenced.window).toBeNull();
    const removed = await POST(write(disconnect)); expect(removed.status).toBe(200); expect(revokeCount).toBe(2);
    expect(rpcCommands.filter(command => command === "finish_disconnect")).toHaveLength(1);
    const final: CalendarSnapshot = (await removed.json()).result;
    expect(final.accounts).toEqual([]); expect(final.calendars).toEqual([]); expect(final.items).toEqual([]); expect(final.window).toBeNull();
    expect((await db.query("select (select count(*) from public.calendar_accounts where user_id=$1)::integer as accounts,(select count(*) from app_private.google_credentials where user_id=$1)::integer as credentials,(select count(*) from public.calendar_events where user_id=$1)::integer as events,(select count(*) from app_private.google_calendar_cursors where user_id=$1)::integer as cursors", [owner])).rows).toEqual([{ accounts: 0, credentials: 0, events: 0, cursors: 0 }]);
    expect((await db.query("select result from app_private.command_receipts where user_id=$1 and command='calendar.disconnect' and client_id='synthetic-disconnect'", [owner])).rows).toEqual([{ result: { account_id: account, revoked: true } }]);
    const completed = await POST(write(disconnect)); expect(completed.status).toBe(200); expect(revokeCount).toBe(2);
    expect((await db.query("select count(*)::integer as n from auth.users")).rows).toEqual([{ n: 2 }]);
    const metadata = (await db.query("select before,after from public.domain_events where user_id=$1 and entity_type like 'calendar_%'", [owner])).rows;
    for (const secret of [access, refresh, code, verifier, "ciphertext", "google@example.invalid", "SYNTHETIC_CURSOR"]) expect(JSON.stringify(metadata)).not.toContain(secret);
    expect(googleCalls).toEqual([
      "POST https://oauth2.googleapis.com/token", "GET https://openidconnect.googleapis.com/v1/userinfo",
      "GET https://www.googleapis.com/calendar/v3/users/me/calendarList", "GET https://www.googleapis.com/calendar/v3/calendars/synthetic-calendar/events",
      "POST https://oauth2.googleapis.com/revoke", "POST https://oauth2.googleapis.com/revoke",
    ]);
  } finally { await db.close(); }
});
