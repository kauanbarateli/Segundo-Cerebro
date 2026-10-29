import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { OnboardingPortError } from "../../src/core/onboarding/types";
vi.mock("../../src/lib/auth/database-origin-server", () => ({ isTrustedHostedDatabaseOrigin: () => true }));
vi.mock("../../src/lib/environment/application-destination", () => ({ authDeploymentAllowed: () => true }));
const { onboardingRpcForRequest } = await import("../../src/adapters/db/onboarding-gateway");
const config = { supabaseUrl: "https://project.supabase.co", secretKey: "test-secret" } as never;
const actor = { userId: "11111111-1111-4111-8111-111111111111", sessionId: "22222222-2222-4222-8222-222222222222" } as never;
const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
const failure = async (status: number, code: string, writing = true) => {
  const rpc = onboardingRpcForRequest(config, actor, reply(status, { code, message: "x" }));
  return rpc("save", {}, writing).then(() => null, (error: unknown) => error);
};
describe("onboarding RPC gateway maps database errors to port errors", () => {
  it("returns the JSON result of a successful call", async () => {
    const rpc = onboardingRpcForRequest(config, actor, reply(200, { ok: true }));
    await expect(rpc("snapshot", {}, false)).resolves.toEqual({ ok: true });
  });
  it.each(["PT409", "40001", "23505", "22023", "23514", "P0002"])("SQLSTATE %s is a CONFLICT", async code => {
    const error = await failure(code === "PT409" ? 409 : 400, code);
    expect(error).toBeInstanceOf(OnboardingPortError);
    expect((error as OnboardingPortError).code).toBe("CONFLICT");
  });
  it("42501 is FORBIDDEN", async () => {
    expect(((await failure(403, "42501")) as OnboardingPortError).code).toBe("FORBIDDEN");
  });
  it("an unknown database code is COMMIT_UNKNOWN for writes and UNAVAILABLE for reads", async () => {
    expect(((await failure(500, "XX000", true)) as OnboardingPortError).code).toBe("COMMIT_UNKNOWN");
    expect(((await failure(500, "XX000", false)) as OnboardingPortError).code).toBe("UNAVAILABLE");
  });
  it("a transport failure on a write is COMMIT_UNKNOWN, never a silent success", async () => {
    const rpc = onboardingRpcForRequest(config, actor, (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch);
    await expect(rpc("save", {}, true)).rejects.toMatchObject({ code: "COMMIT_UNKNOWN" });
  });
  it("sends the actor and operation to the private RPC with the service key only on the server request", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const transport = (async (url: URL, init: RequestInit) => { captured = { url: String(url), init }; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    await onboardingRpcForRequest(config, actor, transport)("snapshot", {}, false);
    expect(captured!.url).toBe("https://project.supabase.co/rest/v1/rpc/onboarding_call");
    expect(JSON.parse(String(captured!.init.body))).toMatchObject({ p_user: (actor as { userId: string }).userId, p_operation: "snapshot" });
  });
});
