import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createOwnSessionsGateway, type OwnSessionsRpc } from "../../src/adapters/db/own-sessions-gateway";
const userId = "10000000-0000-4000-8000-000000000001", sid = "10000000-0000-4000-8000-000000000011", other = "10000000-0000-4000-8000-000000000012";
const actor = { userId, sessionId: sid, mustChangePassword: false };
const payload = () => ({ sessions: [{ id: sid, is_current: true, created_at: null, refreshed_at: null, not_after: null }, { id: other, is_current: false, created_at: null, refreshed_at: null, not_after: null }], has_more: false });
describe("own registered sessions gateway", () => {
  it("uses no RPC arguments and projects only metadata for the verified SID", async () => {
    const rpc = vi.fn<OwnSessionsRpc>().mockResolvedValue({ data: payload(), error: null });
    const view = await createOwnSessionsGateway(actor, rpc).read();
    expect(rpc).toHaveBeenCalledExactlyOnceWith(); expect(view.sessions[0]?.isCurrent).toBe(true);
    expect(JSON.stringify(view)).not.toContain(sid); expect(JSON.stringify(view)).not.toContain(other); expect(view).not.toHaveProperty("not_after");
  });
  it.each([{ ...actor, mustChangePassword: true }, { ...actor, entitlements: { configuracoes: false } }])("refuses access before any RPC %#", async identity => {
    const rpc = vi.fn<OwnSessionsRpc>(); await expect(createOwnSessionsGateway(identity, rpc).read()).rejects.toMatchObject({ code: "forbidden" }); expect(rpc).not.toHaveBeenCalled();
  });
  it("invalid identity cannot instantiate a usable port", () => {
    const rpc = vi.fn<OwnSessionsRpc>(); expect(() => createOwnSessionsGateway({ ...actor, sessionId: "invalid" }, rpc)).toThrow(); expect(() => createOwnSessionsGateway({ ...actor, userId: "invalid" }, rpc)).toThrow(); expect(rpc).not.toHaveBeenCalled();
  });
  it("42501 is forbidden and does not invent a changed SID", async () => {
    const rpc = vi.fn<OwnSessionsRpc>().mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(createOwnSessionsGateway(actor, rpc).read()).rejects.toMatchObject({ code: "forbidden" });
  });
  it("provider payload and thrown messages never become a domain error", async () => {
    let reads = 0; const failure = Object.defineProperty({}, "message", { get() { reads++; return "PRIVATE_PROVIDER_CANARY"; } });
    const rpc = vi.fn<OwnSessionsRpc>().mockRejectedValue(failure);
    await expect(createOwnSessionsGateway(actor, rpc).read()).rejects.toMatchObject({ code: "UNAVAILABLE" }); expect(reads).toBe(0);
    rpc.mockResolvedValue({ data: null, error: { code: "XX000" } }); await expect(createOwnSessionsGateway(actor, rpc).read()).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
  it("absence or another current SID closes the stale page", async () => {
    const rpc = vi.fn<OwnSessionsRpc>().mockResolvedValue({ data: { sessions: [], has_more: false }, error: null });
    await expect(createOwnSessionsGateway(actor, rpc).read()).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    rpc.mockResolvedValue({ data: payload(), error: null }); await expect(createOwnSessionsGateway({ ...actor, sessionId: other }, rpc).read()).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  });
});
