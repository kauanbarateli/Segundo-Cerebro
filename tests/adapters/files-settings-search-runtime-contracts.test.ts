import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { createHash } from "node:crypto";
vi.mock("server-only", () => ({}));
vi.mock("../../src/adapters/db/files-policy", () => ({ readFilePolicy: () => ({ quota_bytes: 1024 ** 3, drive_max_bytes: 26214400, image_max_bytes: 8388608, max_pixels: 24000000, lease_seconds: 300 }) }));
import { cleanupFiles, filesServicesForRequest, FINAL_BUCKET, STAGING_BUCKET } from "../../src/adapters/db/files-runtime";
import { createDriveStore, FilesCommitUnknown, type DriveCommit } from "../../src/adapters/db/files-store";
import { settingsForRequest } from "../../src/adapters/db/settings-runtime";
import { searchForRequest } from "../../src/adapters/db/search-runtime";
import { SettingsRateLimitError, type AccountSettings, type SettingsCommand } from "../../src/core/configuracoes";
import type { Arquivo } from "../../src/core/drive";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import type { AuthenticatedIdentity } from "../../src/lib/auth/types";
import type { Database } from "../../src/lib/supabase/database.generated";

const owner = "31000000-0000-4000-8000-000000000001", session = "31000000-0000-4000-8000-000000000002", fileId = "31000000-0000-4000-8000-000000000003", folderId = "31000000-0000-4000-8000-000000000004";
const canary = "SYNTHETIC_PRIVATE_RPC_DIAGNOSTIC";
const config: SupabaseAuthConfig = { mode: "supabase", appOrigin: "https://example.invalid", supabaseUrl: "https://rishenjoikgmfubmnfiu.supabase.co", publishableKey: "sb_publishable_SYNTHETIC", secretKey: "sb_secret_SYNTHETIC", rateLimitSecret: "r".repeat(32), stateSecret: "s".repeat(32), secureCookies: true };
const actor: AuthenticatedIdentity = { userId: owner, sessionId: session, mustChangePassword: false, role: "user", entitlements: {} };
const bound = { p_user: owner, p_session: session };
const fixtureText = new TextEncoder().encode("Synthetic offline fixture.\n");
const savedFile: Arquivo = { id: fileId, user_id: owner, kind: "drive", folder_id: null, name: "Fixture.txt", mime: "text/plain", bytes: fixtureText.length, sha256: createHash("sha256").update(fixtureText).digest("hex"), width: null, height: null, starred: false, deleted_at: null, deletion_batch_id: null, created_at: "2026-10-10T02:00:00Z", updated_at: "2026-10-10T02:00:00Z", modified_at: "2026-10-10T02:00:00Z" };
const settings: AccountSettings = { user_id: owner, profile: { display_name: "Fixture", email: null, avatar_file_id: null }, preferences: { theme: "system", default_calendar_view: "week", values_hidden: false, meeting_reminders_enabled: true, meeting_reminder_minutes: 15 }, modules: [{ module_key: "inicio", visible: true, sort_order: 0 }] };
const driveState = { revision: "0", folders: [], files: [], projects: [], receipts: [], usage_bytes: 0, capacity_bytes: 1024 ** 3, max_file_bytes: 26214400 };
const driveRequest: DriveCommit = { expected_revision: "0", context: { user_id: owner, canal: "web" }, changes: [], events: [], receipt: { user_id: owner, command: "drive.folder.create", client_id: "stable-drive", fingerprint: "{}", result: null } };
interface Call { path: string; body: unknown; method: string | undefined; cache: RequestCache | undefined }
const calls: Call[] = [];
const replies = new Map<string, (body: Record<string, unknown>) => Response>();
let stagingBytes: Uint8Array = fixtureText;
let failDelete = false;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const transport = vi.fn<typeof fetch>(async (input, options) => {
  const url = new URL(String(input));
  if (url.origin !== config.supabaseUrl || url.search || !["/rest/v1/rpc/", "/storage/v1/object/"].some(prefix => url.pathname.startsWith(prefix))) throw new Error("Unexpected fake transport target");
  const body = typeof options?.body === "string" ? JSON.parse(options.body) : options?.body;
  calls.push({ path: url.pathname, body, method: options?.method, cache: options?.cache });
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    if (!object(body)) throw new Error("Expected fixed RPC argument object");
    const responder = replies.get(url.pathname.slice("/rest/v1/rpc/".length));
    if (!responder) throw new Error("Unexpected RPC in fake transport");
    return responder(body);
  }
  if (url.pathname.startsWith("/storage/v1/object/upload/sign/")) return json({ url: "/object/upload/sign/" + url.pathname.slice("/storage/v1/object/upload/sign/".length) + "?token=synthetic-ephemeral" });
  if (options?.method === "DELETE") return failDelete ? json({ message: canary }, 403) : json([]);
  if (options?.method === "GET" && url.pathname === `/storage/v1/object/${STAGING_BUCKET}/${owner}/${fileId}`) return new Response(new Blob([Uint8Array.from(stagingBytes)]), { status: 200 });
  if (options?.method === "POST" && url.pathname === `/storage/v1/object/${FINAL_BUCKET}/${owner}/${fileId}`) return json({ Key: `${FINAL_BUCKET}/${owner}/${fileId}` });
  throw new Error("Unexpected Storage operation in fake transport");
});
beforeEach(() => {
  vi.clearAllMocks(); calls.length = 0; replies.clear(); stagingBytes = fixtureText; failDelete = false;
  vi.stubGlobal("fetch", transport);
  replies.set("settings_snapshot", () => json(settings)); replies.set("settings_commit", () => json(settings));
  replies.set("global_search", () => json([{ id: fileId, user_id: owner, type: "file", title: "Fixture", rank: 1 }]));
  replies.set("file_avatar_set", body => json({ avatar_file_id: body.p_file }));
  replies.set("file_upload_reserve", body => json({ id: body.p_upload, user_id: owner, kind: body.p_kind, name: body.p_name, folder_id: body.p_folder, staging_path: `${owner}/${body.p_upload}`, final_path: `${owner}/${body.p_upload}`, max_bytes: body.p_max_bytes, quota_bytes: body.p_quota, expires_at: body.p_expires, status: "reserved", lease_id: null, lease_until: null, file_id: null }));
  replies.set("file_upload_claim", () => json({ reservation: { id: fileId, user_id: owner, kind: "drive", name: "Fixture.txt", folder_id: null, staging_path: `${owner}/${fileId}`, final_path: `${owner}/${fileId}`, max_bytes: 26214400 }, file: null }));
  replies.set("file_upload_complete", body => json(body.p_file));
  replies.set("file_upload_status", () => json({ file: savedFile }));
  replies.set("file_upload_release", () => new Response(null, { status: 204 }));
  replies.set("file_read_metadata", () => json({ file: savedFile, storage_path: `${owner}/${fileId}` }));
  replies.set("drive_snapshot", () => json(driveState)); replies.set("drive_commit", () => json({ status: "committed", result: null })); replies.set("drive_receipt", () => json(null));
  replies.set("file_cleanup_candidates", () => json([{ id: fileId, staging_path: `${owner}/${fileId}`, final_path: `${owner}/${fileId}`, remove_final: true }]));
  replies.set("file_cleanup_ack", () => new Response(null, { status: 204 })); replies.set("file_cleanup_log", () => new Response(null, { status: 204 }));
});
afterEach(() => { vi.unstubAllGlobals(); });
const rpcCalls = (name: string) => calls.filter(call => call.path === "/rest/v1/rpc/" + name);
const expectRpc = (name: string, body: unknown) => expect(rpcCalls(name).at(-1)).toEqual({ path: "/rest/v1/rpc/" + name, body, method: "POST", cache: "no-store" });

describe("Official Files, Settings and Search contracts through the real SDK with fake transport", () => {
  it("Settings snapshot and each command preserve identity and exact JSON payload", async () => {
    const port = settingsForRequest(config, actor);
    expect(await port.load()).toEqual(settings); expectRpc("settings_snapshot", bound);
    const commands: SettingsCommand[] = [{ command: "settings.profile.update", input: { client_id: "profile", display_name: "Fixture" } }, { command: "settings.preferences.update", input: { client_id: "preferences", patch: { theme: "dark", values_hidden: true } } }, { command: "settings.modules.update", input: { client_id: "modules", modules: settings.modules } }];
    for (const command of commands) { expect(await port.commit(command)).toEqual(settings); expectRpc("settings_commit", { ...bound, p_request: command }); }
    expect(calls).toHaveLength(4);
  });
  it("Settings keeps wrong-owner and malformed responses closed, and maps SQL rate limits", async () => {
    for (const value of [{ ...settings, user_id: fileId }, { ...settings, token: canary }, { ...settings, preferences: { ...settings.preferences, meeting_reminder_minutes: 999 } }]) {
      replies.set("settings_snapshot", () => json(value)); await expect(settingsForRequest(config, actor).load()).rejects.toMatchObject({ code: "unavailable" });
    }
    replies.set("settings_commit", () => json({ code: "PT429", message: canary }, 429));
    await expect(settingsForRequest(config, actor).commit({ command: "settings.profile.update", input: { client_id: "stable", display_name: "Fixture" } })).rejects.toBeInstanceOf(SettingsRateLimitError);
  });
  it("Search preserves its literal arguments, bounded results and derived href", async () => {
    expect(await searchForRequest(config, actor).query("ação")).toEqual([{ id: fileId, type: "file", title: "Fixture", rank: 1, href: "/drive?file=" + fileId }]);
    expectRpc("global_search", { ...bound, p_term: "ação" }); expect(calls).toHaveLength(1);
  });
  it("Search rejects foreign ownership, secret fields, illegal ranks and an excessive result set", async () => {
    const valid = { id: fileId, user_id: owner, type: "file", title: "Fixture", rank: 1 };
    for (const rows of [[{ ...valid, user_id: fileId }], [{ ...valid, token: canary }], [{ ...valid, rank: 1.5 }], [{ ...valid, type: "vault" }], Array.from({ length: 71 }, () => valid)]) {
      replies.set("global_search", () => json(rows)); await expect(searchForRequest(config, actor).query("fixture")).rejects.toMatchObject({ code: "unavailable" });
    }
  });
  it("root and explicit-folder reservations keep SQL UUID null on the wire and mint only staging capabilities", async () => {
    for (const folder of [null, folderId]) {
      const reserved = await filesServicesForRequest(config, actor).reserve("drive", "Fixture.txt", folder, "stable-reserve");
      expectRpc("file_upload_reserve", { ...bound, p_kind: "drive", p_name: "Fixture.txt", p_folder: folder, p_client_id: "stable-reserve", p_upload: reserved.id, p_max_bytes: 26214400, p_quota: 1024 ** 3, p_expires: expect.stringMatching(/^\d{4}-\d\d-\d\dT/) });
      expect(reserved.token).toBe("synthetic-ephemeral");
      expect(calls.at(-1)?.path).toBe(`/storage/v1/object/upload/sign/${STAGING_BUCKET}/${owner}/${reserved.id}`);
      expect(calls.some(call => call.path.includes("upload/sign/" + FINAL_BUCKET))).toBe(false);
    }
  });
  it("avatar removal serializes explicit null rather than dropping or widening its argument object", async () => {
    for (const file of [null, fileId]) {
      expect(await filesServicesForRequest(config, actor).avatar(file, "stable-avatar")).toEqual({ avatar_file_id: file });
      expectRpc("file_avatar_set", { ...bound, p_file: file, p_client_id: "stable-avatar" });
    }
  });
  it("finalization uses real byte validation and hashing before the typed atomic metadata RPC", async () => {
    const file = await filesServicesForRequest(config, actor).finalize(fileId, "stable-finalize");
    expect(file).toMatchObject({ id: fileId, user_id: owner, bytes: fixtureText.length, mime: "text/plain", sha256: savedFile.sha256 });
    const claim = rpcCalls("file_upload_claim")[0]!;
    expect(claim.body).toEqual({ ...bound, p_upload: fileId, p_client_id: "stable-finalize", p_lease: expect.stringMatching(/^[a-f0-9-]{36}$/) });
    expectRpc("file_upload_complete", { ...bound, p_upload: fileId, p_client_id: "stable-finalize", p_lease: (claim.body as Record<string, unknown>).p_lease, p_file: file, p_quota: 1024 ** 3 });
    const upload = calls.find(call => call.path === `/storage/v1/object/${FINAL_BUCKET}/${owner}/${fileId}`)!;
    expect(upload.method).toBe("POST"); expect(upload.body).toEqual(fixtureText);
    expect(calls.indexOf(upload)).toBeLessThan(calls.indexOf(rpcCalls("file_upload_complete")[0]!));
    expect(rpcCalls("file_upload_release")).toHaveLength(0);
  });
  it("an unknown completion outcome reconciles only through the typed owner-bound status RPC", async () => {
    replies.set("file_upload_complete", () => json({ message: canary }, 500));
    expect(await filesServicesForRequest(config, actor).finalize(fileId, "stable-finalize")).toEqual(savedFile);
    expectRpc("file_upload_status", { ...bound, p_upload: fileId });
    expect(rpcCalls("file_upload_complete")).toHaveLength(1); expect(rpcCalls("file_upload_release")).toHaveLength(0);
  });
  it("invalid staged bytes release the exact lease without publishing a final object", async () => {
    stagingBytes = new Uint8Array([0, 1, 2]);
    await expect(filesServicesForRequest(config, actor).finalize(fileId, "stable-finalize")).rejects.toMatchObject({ code: "VALIDATION" });
    expectRpc("file_upload_release", { ...bound, p_upload: fileId, p_lease: (rpcCalls("file_upload_claim")[0]!.body as Record<string, unknown>).p_lease });
    expect(calls.some(call => call.path === `/storage/v1/object/${FINAL_BUCKET}/${owner}/${fileId}`)).toBe(false);
  });
  it("revoked or foreign file metadata cannot mint a Storage read capability", async () => {
    replies.set("file_read_metadata", () => json({ code: "42501", message: canary }, 403));
    await expect(filesServicesForRequest(config, actor).signedRead(fileId)).rejects.toMatchObject({ code: "forbidden" });
    replies.set("file_read_metadata", () => json({ file: { ...savedFile, user_id: folderId }, storage_path: `${folderId}/${fileId}` }));
    await expect(filesServicesForRequest(config, actor).signedRead(fileId)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(calls.every(call => call.path.startsWith("/rest/v1/rpc/"))).toBe(true);
  });
  it("Drive gateway preserves operation, owner, receipt and validated store snapshot semantics", async () => {
    const gateway = filesServicesForRequest(config, actor).gateway("drive.folder.create");
    expect(await createDriveStore(gateway).snapshot()).toEqual(driveState);
    expectRpc("drive_snapshot", { ...bound, p_operation: "drive.folder.create", p_quota: 1024 ** 3, p_max_bytes: 26214400 });
    expect(await gateway.commit(driveRequest)).toEqual({ status: "committed", result: null });
    expectRpc("drive_commit", { ...bound, p_operation: "drive.folder.create", p_request: driveRequest });
    expect(await gateway.receipt("drive.folder.create", "stable-drive")).toBeNull();
    expectRpc("drive_receipt", { ...bound, p_operation: "drive.folder.create", p_command: "drive.folder.create", p_client_id: "stable-drive" });
    replies.set("drive_snapshot", () => json({ ...driveState, files: [{ ...savedFile, user_id: folderId }] }));
    await expect(createDriveStore(gateway).snapshot()).rejects.toThrow();
  });
  it("no-argument cleanup uses the real SDK and acknowledges only after both exact-path deletions", async () => {
    expect(await cleanupFiles(config)).toEqual({ removed: 1, failed: 0 });
    expectRpc("file_cleanup_candidates", {});
    expect(calls.filter(call => call.method === "DELETE").map(call => ({ path: call.path, body: call.body }))).toEqual([{ path: `/storage/v1/object/${STAGING_BUCKET}`, body: { prefixes: [`${owner}/${fileId}`] } }, { path: `/storage/v1/object/${FINAL_BUCKET}`, body: { prefixes: [`${owner}/${fileId}`] } }]);
    expectRpc("file_cleanup_ack", { p_upload: fileId }); expectRpc("file_cleanup_log", { p_removed: 1, p_failed: 0 });
    const acknowledgement = calls.indexOf(rpcCalls("file_cleanup_ack")[0]!);
    expect(calls.filter(call => call.method === "DELETE").every(call => calls.indexOf(call) < acknowledgement)).toBe(true);
  });
  it("cleanup removal failures never acknowledge or release quota, and malformed paths do not reach Storage", async () => {
    failDelete = true;
    expect(await cleanupFiles(config)).toEqual({ removed: 0, failed: 1 });
    expect(rpcCalls("file_cleanup_ack")).toHaveLength(0); expectRpc("file_cleanup_log", { p_removed: 0, p_failed: 1 });
    calls.length = 0; replies.set("file_cleanup_candidates", () => json([{ id: fileId, staging_path: "../escape", final_path: "../escape", remove_final: true }]));
    await expect(cleanupFiles(config)).rejects.toMatchObject({ code: "unavailable" });
    expect(calls).toHaveLength(1);
  });
  it("provider failures retain closed outcomes without serializing private diagnostics", async () => {
    for (const name of ["settings_snapshot", "global_search", "file_avatar_set"]) replies.set(name, () => json({ message: canary }, 500));
    for (const action of [() => settingsForRequest(config, actor).load(), () => searchForRequest(config, actor).query("fixture"), () => filesServicesForRequest(config, actor).avatar(null, "stable")]) {
      try { await action(); throw new Error("Expected closed failure"); }
      catch (error) { expect(String(error)).not.toContain(canary); expect(error instanceof FilesCommitUnknown || object(error) && error.code === "unavailable").toBe(true); }
    }
  });
  it("personal pins refuse alternate projects before any SDK transport", async () => {
    const other = { ...config, supabaseUrl: "https://foreign.example.invalid" };
    for (const create of [() => filesServicesForRequest(other, actor), () => settingsForRequest(other, actor), () => searchForRequest(other, actor)]) expect(create).toThrow();
    await expect(cleanupFiles(other)).rejects.toMatchObject({ code: "unavailable" }); expect(transport).not.toHaveBeenCalled();
  });
  it("official no-argument and UUID scalar types stay strict rather than becoming a planned overlay", () => {
    expectTypeOf<Database["public"]["Functions"]["file_cleanup_candidates"]["Args"]>().toEqualTypeOf<never>();
    expectTypeOf<Database["public"]["Functions"]["file_upload_reserve"]["Args"]["p_folder"]>().toEqualTypeOf<string>();
    expectTypeOf<Database["public"]["Functions"]["file_avatar_set"]["Args"]["p_file"]>().toEqualTypeOf<string>();
  });
});
