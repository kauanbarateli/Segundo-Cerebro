import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { calendarTokenCipher, googleAuthorizationUrl, newGoogleFlow, readGoogleCalendarConfig, validCalendarCron, verifyGoogleFlow, type GoogleCalendarConfig } from "../../src/adapters/db/google-calendar-security";
import { googleCalendarProvider } from "../../src/adapters/db/google-calendar-provider";
import { createCalendarRepository, type CalendarRpc } from "../../src/adapters/db/google-calendar-runtime";
import { executeCalendarCommand } from "../../src/core/calendario";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
const owner = "25000000-0000-4000-8000-000000000001", session = "25000000-0000-4000-8000-000000000002", account = "25000000-0000-4000-8000-000000000003", now = Date.parse("2026-10-09T12:00:00Z"), window = { start_day: "2026-10-01", end_day: "2026-11-01" };
const config: GoogleCalendarConfig = { appOrigin: "http://127.0.0.1:3000", secureCookies: false, clientId: "test.apps.googleusercontent.com", clientSecret: "fake-google-client-secret", stateSecret: "calendar-state-secret-test-only-at-least-32", tokenKeyId: "v1", tokenKeys: new Map([["v1", Buffer.alloc(32, 2)]]), cronSecret: "calendar-cron-secret-test-only-at-least-32", redirectUri: "http://127.0.0.1:3000/api/calendar/oauth/callback" };
const tokens = { access_token: "fake-private-access", refresh_token: "fake-private-refresh", expires_at: "2026-10-09T14:00:00Z", scopes: ["openid"] };
describe("Calendar own OAuth state and ciphertext", () => {
 it("PKCE S256 and offline consent request read-only scopes only", () => { const flow = newGoogleFlow(config, owner, session, now), url = new URL(googleAuthorizationUrl(config, flow.state, flow.verifier)); expect(url.searchParams.get("code_challenge_method")).toBe("S256"); expect(url.searchParams.get("code_challenge")).not.toBe(flow.verifier); expect(url.searchParams.get("access_type")).toBe("offline"); expect(url.searchParams.get("scope")).toContain("calendar.events.readonly"); expect(url.href).not.toContain(flow.verifier); expect(flow.state).not.toContain(owner); expect(verifyGoogleFlow(config, flow.state, flow.cookie(account), owner, session, now)?.flow.account_id).toBe(account); });
 it.each(["state", "cookie", "owner", "session", "expired", "wrong-purpose"])("rejects %s without verifier recovery", kind => { const flow = newGoogleFlow(config, owner, session, now); expect(verifyGoogleFlow(config, kind === "state" ? flow.state + "x" : kind === "wrong-purpose" ? flow.cookie(account) : flow.state, kind === "cookie" ? flow.cookie(account) + "x" : flow.cookie(account), kind === "owner" ? account : owner, kind === "session" ? account : session, kind === "expired" ? now + 600_000 : now)).toBeNull(); });
 it("AES-GCM binds owner, account, credential version and key-id", () => { const cipher = calendarTokenCipher(config), encrypted = cipher.encrypt(owner, account, 1, tokens); expect(cipher.decrypt(owner, account, 1, encrypted)).toEqual(tokens); expect(JSON.stringify(encrypted)).not.toContain(tokens.refresh_token); for (const [u, a, v] of [[account, account, 1], [owner, session, 1], [owner, account, 2]] as const) expect(() => cipher.decrypt(u, a, v, encrypted)).toThrow(); expect(() => cipher.decrypt(owner, account, 1, { ...encrypted, tag: Buffer.alloc(16).toString("base64") })).toThrow(); });
 it("old key can decrypt during rotation while new encryption uses active key", () => { const old = calendarTokenCipher(config).encrypt(owner, account, 1, tokens), rotated = { ...config, tokenKeyId: "v2", tokenKeys: new Map([...config.tokenKeys, ["v2", Buffer.alloc(32, 3)]]) }; expect(calendarTokenCipher(rotated).decrypt(owner, account, 1, old)).toEqual(tokens); expect(calendarTokenCipher(rotated).encrypt(owner, account, 1, tokens).key_id).toBe("v2"); });
 it("configuration rejects shared signing secret and invalid AES key", () => { const auth = { appOrigin: config.appOrigin, secureCookies: false, stateSecret: "auth-state-test-distinct", rateLimitSecret: "auth-rate-test-distinct", secretKey: "server-secret-test-distinct" } as SupabaseAuthConfig; const env = { GOOGLE_OAUTH_CLIENT_ID: config.clientId, GOOGLE_OAUTH_CLIENT_SECRET: config.clientSecret, GOOGLE_CALENDAR_STATE_SECRET: config.stateSecret, GOOGLE_CALENDAR_TOKEN_KEY_ID: "v1", GOOGLE_CALENDAR_TOKEN_KEY: Buffer.alloc(32, 2).toString("base64") }; expect(readGoogleCalendarConfig(auth, env).tokenKeyId).toBe("v1"); expect(() => readGoogleCalendarConfig(auth, { ...env, GOOGLE_CALENDAR_TOKEN_KEY: "short" })).toThrow(); expect(() => readGoogleCalendarConfig(auth, { ...env, GOOGLE_CALENDAR_STATE_SECRET: auth.secretKey })).toThrow(); });
 it("Google cron and file cleanup cannot share their Bearer secret", () => {
  const auth = { appOrigin: config.appOrigin, secureCookies: false, stateSecret: "auth-state-test-distinct", rateLimitSecret: "auth-rate-test-distinct", secretKey: "server-secret-test-distinct" } as SupabaseAuthConfig;
  const env = { GOOGLE_OAUTH_CLIENT_ID: config.clientId, GOOGLE_OAUTH_CLIENT_SECRET: config.clientSecret, GOOGLE_CALENDAR_STATE_SECRET: config.stateSecret, GOOGLE_CALENDAR_TOKEN_KEY_ID: "v1", GOOGLE_CALENDAR_TOKEN_KEY: Buffer.alloc(32, 2).toString("base64"), GOOGLE_CALENDAR_CRON_SECRET: config.cronSecret!, CRON_SECRET: "separate-file-cleanup-secret-test-only" };
  expect(readGoogleCalendarConfig(auth, env).cronSecret).toBe(config.cronSecret);
  expect(() => readGoogleCalendarConfig(auth, { ...env, CRON_SECRET: config.cronSecret! })).toThrow();
 });
 it.each([null, "Bearer bad", "", "Bearer " + config.cronSecret + "x"])("cron rejects invalid authorization %#", value => expect(validCalendarCron(config.cronSecret, value)).toBe(false));
});
describe("Google HTTP fake transport, no credentials or external calls", () => {
 it("requests only the permitted participant projection with a bounded roster, retaining provider omission", async () => {
  const transport = vi.fn<typeof fetch>(async () => json({ items: [{ id: "event", start: { date: "2026-10-10" }, end: { date: "2026-10-11" }, attendeesOmitted: true, attendees: [{ email: "self@example.invalid", self: true }] }], nextSyncToken: "next" }));
  const provider = googleCalendarProvider(config, async () => undefined, transport);
  const page = await provider.events("fake", "source", { window, sync_token: null, page_token: null });
  const url = new URL(String(transport.mock.calls[0]![0]));
  expect(url.searchParams.get("maxAttendees")).toBe("200");
  expect(url.searchParams.get("fields")).toContain("attendees(displayName,email,responseStatus,self,organizer,optional,resource),attendeesOmitted");
  expect(url.searchParams.get("fields")).not.toMatch(/photo|comment/);
  expect(page.items[0]).toMatchObject({ attendees_omitted: true, attendees: [{ email: "self@example.invalid", self: true }] });
  expect(transport).toHaveBeenCalledOnce();
 });
 const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
 it("fresh access/quota guard precedes every fixed-host HTTP request", async () => { const guard = vi.fn(async () => undefined), transport = vi.fn<typeof fetch>(async () => json({ sub: "stable-sub", email: "verified@example.invalid", email_verified: true })), provider = googleCalendarProvider(config, guard, transport, () => now); await provider.profile("fake-access"); expect(guard.mock.invocationCallOrder[0]).toBeLessThan(transport.mock.invocationCallOrder[0]!); const [url, options] = transport.mock.calls[0]!; expect(String(url)).toBe("https://openidconnect.googleapis.com/v1/userinfo"); expect(options).toMatchObject({ redirect: "error", cache: "no-store" }); guard.mockRejectedValueOnce(new Error("denied")); await expect(provider.profile("fake-access")).rejects.toThrow(); expect(transport).toHaveBeenCalledOnce(); });
 it("full bounded query and incremental cursor use compatible Google parameters", async () => { const transport = vi.fn<typeof fetch>(async () => json({ items: [], nextSyncToken: "next" })), provider = googleCalendarProvider(config, async () => undefined, transport); await provider.events("fake", "x?evil=/../", { window, sync_token: null, page_token: null }); const full = new URL(String(transport.mock.calls[0]![0])); expect(full.origin).toBe("https://www.googleapis.com"); expect(full.searchParams.get("timeMin")).toContain("2026-10-01"); await provider.events("fake", "source", { window, sync_token: "opaque", page_token: "page" }); const incremental = new URL(String(transport.mock.calls[1]![0])); expect(incremental.searchParams.has("timeMin")).toBe(false); expect(incremental.searchParams.has("timeMax")).toBe(false); expect(incremental.searchParams.has("orderBy")).toBe(false); expect(incremental.searchParams.get("syncToken")).toBe("opaque"); });
 it.each([[410, "expired_cursor"], [429, "quota"], [401, "reauthorize"], [500, "unavailable"]] as const)("maps HTTP%s without reflecting remote body", async (status, kind) => { const provider = googleCalendarProvider(config, async () => undefined, async () => json({ error: "private-canary-token" }, status)); await expect(provider.events("fake", "source", { window, sync_token: "old", page_token: null })).rejects.toMatchObject({ kind }); await expect(provider.profile("fake")).rejects.not.toThrow("private-canary"); });
 it("requires verified profile and rejects impossible pagination", async () => { const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ sub: "s", email: "x@example.invalid", email_verified: false })).mockResolvedValueOnce(json({ items: [], nextPageToken: "p", nextSyncToken: "s" })), provider = googleCalendarProvider(config, async () => undefined, transport); await expect(provider.profile("fake")).rejects.toThrow(); await expect(provider.events("fake", "source", { window, sync_token: null, page_token: null })).rejects.toThrow(); });
 it("stores actual granted scopes, refresh allows omitted scope/token", async () => { const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ access_token: "fake", refresh_token: "refresh", token_type: "Bearer", expires_in: 3600, scope: "openid https://www.googleapis.com/auth/userinfo.email" })).mockResolvedValueOnce(json({ access_token: "new", token_type: "Bearer", expires_in: 3600 })), provider = googleCalendarProvider(config, async () => undefined, transport, () => now); expect((await provider.exchange("code", "verifier")).scopes).toEqual(["openid", "https://www.googleapis.com/auth/userinfo.email"]); expect((await provider.refresh("refresh")).scopes).toBeNull(); });
 it("revocation uses POST fixed endpoint and no event write method exists", async () => { const transport = vi.fn<typeof fetch>(async () => new Response("", { status: 200 })), provider = googleCalendarProvider(config, async () => undefined, transport); await provider.revoke("fake"); expect(String(transport.mock.calls[0]![0])).toBe("https://oauth2.googleapis.com/revoke"); expect(transport.mock.calls[0]![1]?.method).toBe("POST"); expect(Object.keys(provider)).toEqual(["exchange", "refresh", "profile", "calendars", "events", "revoke"]); });
 it.each([201, 204, 400, 503])("HTTP %s does not confirm revocation or expose the provider error", async status => {
  const response = new Response(status === 204 ? null : JSON.stringify({ error: "PRIVATE_REVOCATION_FAILURE" }), { status });
  const transport = vi.fn<typeof fetch>(async () => response);
  const provider = googleCalendarProvider(config, async () => undefined, transport);
  await expect(provider.revoke("fake-refresh-token")).rejects.toMatchObject({ kind: "unavailable" });
  expect(transport).toHaveBeenCalledOnce();
  expect(response.bodyUsed).toBe(false);
 });
 it("the original Core retains the disconnect fence after HTTP400 and finishes only after HTTP200 retry", async () => {
  const cipher = calendarTokenCipher(config);
  const commands: string[] = [];
  let pending = false, removed = false;
  const encrypted = cipher.encrypt(owner, account, 1, tokens);
  const rpc: CalendarRpc = vi.fn(async args => {
   commands.push(args.p_command);
   if (args.p_command === "guard") return { data: {}, error: null };
   if (args.p_command === "disconnect") {
    pending = true;
    return { data: { id: account, user_id: owner, google_sub: "fake-stable-sub", revision: "1", credential_version: 1, status: "revocation_pending", tokens: encrypted, calendars: [] }, error: null };
   }
   if (args.p_command === "finish_disconnect") { removed = true; pending = false; return { data: {}, error: null }; }
   if (args.p_command === "snapshot") return { data: { accounts: [], calendars: [], items: [], sync_runs: [], window: null, preferences: { default_calendar_view: "month", meeting_reminders_enabled: true, meeting_reminder_minutes: 10 } }, error: null };
   throw new Error("Unexpected test RPC");
  });
  const repo = createCalendarRepository(owner, session, rpc, { execution: "25000000-0000-4000-8000-000000000004" });
  const transport = vi.fn<typeof fetch>()
   .mockImplementationOnce(async () => { expect(pending).toBe(true); return json({ error: "invalid_token" }, 400); })
   .mockImplementationOnce(async () => { expect(pending).toBe(true); return new Response("", { status: 200 }); });
  const provider = googleCalendarProvider(config, () => repo.requireAccess(), transport);
  const request = { command: "calendar.disconnect", input: { client_id: "same-disconnect-operation", account_id: account } };
  await expect(executeCalendarCommand(repo, provider, cipher, request, new Date(now).toISOString())).rejects.toMatchObject({ kind: "unavailable" });
  expect(pending).toBe(true);
  expect(removed).toBe(false);
  expect(commands).not.toContain("finish_disconnect");
  expect(commands).not.toContain("snapshot");
  await executeCalendarCommand(repo, provider, cipher, request, new Date(now).toISOString());
  expect(pending).toBe(false);
  expect(removed).toBe(true);
  expect(commands.filter(command => command === "finish_disconnect")).toHaveLength(1);
  expect(commands.at(-1)).toBe("snapshot");
  expect(transport).toHaveBeenCalledTimes(2);
 });
});
