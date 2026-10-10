import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { adminServicesForRequest } from "../../src/adapters/db/admin-runtime";
import { financeGatewayForRequest } from "../../src/adapters/db/finance-runtime";
import { vaultGatewayForRequest } from "../../src/adapters/db/vault-runtime";
import type { AdminIntent, AdminOperation } from "../../src/core/admin";
import type { VaultInput } from "../../src/core/cofre/types";
import type { VaultCommit } from "../../src/core/cofre/use-cases";
import type { FinanceCommit } from "../../src/adapters/db/finance-store";
import type { FinanceOperation } from "../../src/adapters/db/finance-gateway";
import type { SupabaseAuthConfig } from "../../src/lib/auth/config";
import type { AuthenticatedIdentity } from "../../src/lib/auth/types";

const owner = "26000000-0000-4000-8000-000000000001";
const session = "26000000-0000-4000-8000-000000000002";
const target = "26000000-0000-4000-8000-000000000003";
const id = "26000000-0000-4000-8000-000000000004";
const stamp = "2026-10-09T12:00:00Z";
const canary = "SYNTHETIC_PRIVATE_PROVIDER_DIAGNOSTIC";
const config: SupabaseAuthConfig = {
  mode: "supabase", appOrigin: "https://example.invalid",
  supabaseUrl: "https://rishenjoikgmfubmnfiu.supabase.co",
  publishableKey: "sb_publishable_SYNTHETIC", secretKey: "sb_secret_SYNTHETIC",
  stateSecret: "s".repeat(32), rateLimitSecret: "r".repeat(32), secureCookies: true,
};
const identity: AuthenticatedIdentity = { userId: owner, sessionId: session, mustChangePassword: false, role: "master", entitlements: {} };
const operation: AdminOperation = {
  operation_id: id, client_id: "admin-client", actor_user_id: owner, target_user_id: target,
  command: "admin.user.create", phase: "reserved", role: null, feature_key: null, allowed: null,
  created_at: stamp, updated_at: stamp,
};
const financeState = { revision: "7", accounts: [], categories: [], tags: [], transactions: [], budgets: [], events: [], receipts: [] };
const vaultState = { revision: "0", header: null, items: [] };
const vaultRequest: VaultInput = {
  command: "vault.item.create",
  input: { client_id: "vault-client", expected_revision: "0", id, version: 1, envelope: { iv: "AAAAAAAAAAAAAAAA", ciphertext: "A".repeat(64) } },
};
const vaultCommit: VaultCommit = {
  request: vaultRequest, metadata: { id, user_id: owner, operation: "item_created", version: 1, occurred_at: stamp },
  event_id: target, occurred_at: stamp, canal: "web",
};
const calls: { name: string; body: unknown; method: string | undefined; cache: RequestCache | undefined }[] = [];
let reply: unknown = null;
let status = 200;
const transport = vi.fn<typeof fetch>(async (input, options) => {
  const url = new URL(String(input));
  if (url.origin !== config.supabaseUrl || !url.pathname.startsWith("/rest/v1/rpc/") || url.search) throw new Error("Unexpected fake transport target");
  calls.push({ name: url.pathname.slice("/rest/v1/rpc/".length), body: JSON.parse(String(options?.body)), method: options?.method, cache: options?.cache });
  return new Response(JSON.stringify(reply), { status, headers: { "Content-Type": "application/json" } });
});
beforeEach(() => {
  calls.length = 0; reply = null; status = 200; vi.clearAllMocks();
  vi.stubGlobal("fetch", transport);
  vi.stubEnv("ADMIN_COMMAND_SECRET", "synthetic-admin-commitment-secret!".repeat(2));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const expectRpc = (name: string, body: unknown) => expect(calls.at(-1)).toEqual({ name, body, method: "POST", cache: "no-store" });

describe("Official Admin, Finance and Vault signatures through the real SDK with fake fetch", () => {
  it("Admin sends only each RPC's arguments and keeps one server execution claim across its saga", async () => {
    const { port } = adminServicesForRequest(config, identity);
    reply = { users: [], audit: [], operations: [] };
    await port.requireMaster();
    expect(await port.snapshot()).toEqual(reply);
    expectRpc("admin_snapshot", { p_actor: owner, p_session: session });

    const intent: AdminIntent = { command: operation.command, client_id: operation.client_id, commitment: "a".repeat(64) };
    reply = operation;
    expect(await port.reserve(intent)).toEqual(operation);
    const execution = expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expectRpc("admin_reserve", { p_actor: owner, p_session: session, p_execution: execution, p_intent: intent });
    const reserved = calls.at(-1)!.body;
    expect(reserved).toMatchObject({ p_execution: execution });
    const claim = (reserved as { p_execution: string }).p_execution;
    const bound = { p_actor: owner, p_session: session, p_execution: claim, p_operation: id };

    expect(await port.claim(id)).toEqual(operation);
    expectRpc("admin_claim", bound);
    expect(await port.guard(id)).toEqual(operation);
    expectRpc("admin_operation_guard", bound);
    reply = { ...operation, phase: "auth_applied" };
    expect(await port.transition(id, "auth_applied", true)).toEqual(reply);
    expectRpc("admin_transition", { ...bound, p_phase: "auth_applied", p_release: true });
    reply = { ...operation, phase: "complete" };
    expect(await port.complete(id)).toEqual(reply);
    expectRpc("admin_complete", bound);
    expect(calls).toHaveLength(7);
    expect(JSON.stringify(calls)).not.toMatch(/password|email|sb_secret|p_user/);
  });

  it("Admin cached denial prevents even a real SDK RPC request", async () => {
    const { port } = adminServicesForRequest(config, { ...identity, entitlements: { admin: false } });
    await expect(port.requireMaster()).rejects.toMatchObject({ code: "forbidden" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("Admin still rejects foreign operation results from an otherwise successful SDK response", async () => {
    const { port } = adminServicesForRequest(config, identity);
    reply = { ...operation, actor_user_id: target };
    await expect(port.reserve({ command: operation.command, client_id: operation.client_id, commitment: "a".repeat(64) })).rejects.toMatchObject({ code: "unavailable" });
  });

  it("Finance preserves the native string revision and sends no request payload on read/receipt RPCs", async () => {
    const gateway = financeGatewayForRequest(config, identity, "read.finance");
    reply = financeState;
    expect(await gateway.snapshot()).toEqual(financeState);
    expectRpc("finance_snapshot", { p_user: owner, p_session: session, p_operation: "read.finance" });
    reply = "7";
    expect(await gateway.currentRevision()).toBe("7");
    expectRpc("finance_revision", { p_user: owner, p_session: session, p_operation: "read.finance" });
    reply = null;
    expect(await gateway.receipt("finance.account.close", "finance-client")).toBeNull();
    expectRpc("finance_receipt", { p_user: owner, p_session: session, p_operation: "read.finance", p_command: "finance.account.close", p_client_id: "finance-client" });
    expect(calls).toHaveLength(3);
  });

  it.each([
    ["finance.account.update", "finance_commit"],
    ["finance.transfer.create", "transfer"],
    ["finance.statement.pay", "pay_statement"],
    ["finance.series.create", "create_series"],
    ["finance.account.close", "close_account"],
  ] as const)("Finance %s carries the complete CAS request to %s without receipt-only fields", async (command, name) => {
    const gateway = financeGatewayForRequest(config, identity, command);
    const request: FinanceCommit = {
      expectedRevision: "7", context: { user_id: owner, canal: "web" }, changes: [], events: [],
      receipt: { user_id: owner, command, client_id: "finance-client", fingerprint: "{}", result: null },
    };
    reply = { status: "stale" };
    expect(await gateway.commit(request)).toEqual({ status: "stale" });
    expectRpc(name, { p_user: owner, p_session: session, p_operation: command, p_request: request });
    expect(calls).toHaveLength(1);
  });

  it("Finance rejects a numeric revision despite a successful SDK response", async () => {
    reply = 7;
    await expect(financeGatewayForRequest(config, identity, "read.finance").currentRevision()).rejects.toMatchObject({ code: "unavailable" });
  });

  it("Vault sends only ciphertext, permitted metadata and its exact request on each RPC", async () => {
    const gateway = vaultGatewayForRequest(config, identity, vaultRequest.command);
    const bound = { p_user: owner, p_session: session, p_operation: vaultRequest.command };
    reply = vaultState;
    expect(await gateway.snapshot()).toEqual(vaultState);
    expectRpc("vault_snapshot", bound);
    reply = null;
    expect(await gateway.receipt(vaultRequest)).toBeNull();
    expectRpc("vault_receipt", { ...bound, p_request: vaultRequest });
    reply = { id, revision: "1" };
    expect(await gateway.commit(vaultCommit)).toEqual(reply);
    expectRpc("vault_commit", { ...bound, p_request: vaultCommit });
    expect(calls).toHaveLength(3);
    expect(JSON.stringify(calls)).not.toMatch(/password|username|title|kit|sb_secret/);
  });

  it("Vault still reconciles a malformed successful write using the original cipher request", async () => {
    const gateway = vaultGatewayForRequest(config, identity, vaultRequest.command);
    reply = { private_provider_details: canary };
    transport.mockImplementationOnce(async (input, options) => {
      const response = await transport.getMockImplementation()!(input, options);
      reply = { id, revision: "1" };
      return response;
    });
    expect(await gateway.commit(vaultCommit)).toEqual({ id, revision: "1" });
    expect(calls.map(call => call.name)).toEqual(["vault_commit", "vault_receipt"]);
    expectRpc("vault_receipt", { p_user: owner, p_session: session, p_operation: vaultRequest.command, p_request: vaultRequest });
  });

  it.each(["admin", "finance", "vault"] as const)("%s maps current SQL denial without leaking provider fields", async feature => {
    status = 403; reply = { code: "42501", message: canary, details: canary, hint: canary };
    const request = feature === "admin" ? adminServicesForRequest(config, identity).port.requireMaster()
      : feature === "finance" ? financeGatewayForRequest(config, identity, "read.finance").snapshot()
      : vaultGatewayForRequest(config, identity, "read.vault").snapshot();
    await expect(request).rejects.toMatchObject({ code: "forbidden" });
    await expect(request).rejects.not.toThrow(canary);
    expect(calls).toHaveLength(1);
  });

  it("all three adapters deny any other project before constructing an SDK request", () => {
    const foreign = { ...config, supabaseUrl: "https://other-personal-project.example.invalid" };
    expect(() => adminServicesForRequest(foreign, identity)).toThrow();
    expect(() => financeGatewayForRequest(foreign, identity, "read.finance" satisfies FinanceOperation)).toThrow();
    expect(() => vaultGatewayForRequest(foreign, identity, "read.vault")).toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
});
