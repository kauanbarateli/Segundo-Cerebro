import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createActivityGateway, type ActivityRpc } from "../../src/adapters/db/activity-gateway";
import type { AuthenticatedIdentity } from "../../src/lib/auth/types";
import { ACTIVITY_FEATURES, type ActivityType } from "../../src/core/activity";
const id = "10000000-0000-4000-8000-000000000001", foreign = "10000000-0000-4000-8000-000000000002";
const identity: AuthenticatedIdentity = { userId: id, sessionId: id, mustChangePassword: false, entitlements: {} };
const row = { id, user_id: id, entity_type: "capture", entity_id: id, action: "updated", canal: "web", occurred_at: "2026-10-07T20:00:00.000002Z", title: "Nota", changed_fields: ["content"] };
const query = { limit: 20, cursor: null };
describe("Activity server gateway", () => {
  it("checks owner, strips it from presentation, preserves the RPC cursor precision", async () => {
    const rpc = vi.fn<ActivityRpc>().mockResolvedValue({ error: null, data: { items: [row], next_cursor: null } });
    const cursor = { id, occurred_at: "2026-10-07T20:00:00.000003Z" };
    const page = await createActivityGateway(identity, rpc).page({ limit: 20, cursor });
    expect(page.items[0]).not.toHaveProperty("user_id"); expect(page.items[0]?.occurred_at).toBe(row.occurred_at);
    expect(rpc).toHaveBeenCalledWith({ p_user: id, p_session: id, p_limit: 20, p_before_time: cursor.occurred_at, p_before_id: id });
    page.items[0]!.changed_fields.push("title"); expect(row.changed_fields).toEqual(["content"]);
  });
  it.each([{ user_id: foreign }, { before: { content: "secret" } }, { title: "a".repeat(201) }, { changed_fields: ["password"] }])("fails closed for invalid projection %j", async patch => {
    const rpc: ActivityRpc = async () => ({ error: null, data: { items: [{ ...row, ...patch }], next_cursor: null } });
    await expect(createActivityGateway(identity, rpc).page(query)).rejects.toMatchObject({ code: "unavailable" });
  });
  it("a vetoed entity returned unexpectedly cannot cross the boundary", async () => {
    const rpc: ActivityRpc = async () => ({ error: null, data: { items: [row], next_cursor: null } });
    await expect(createActivityGateway({ ...identity, entitlements: { capturar: false } }, rpc).page(query)).rejects.toMatchObject({ code: "unavailable" });
  });
  it.each(Object.keys(ACTIVITY_FEATURES) as ActivityType[])("aplica o veto de origem também a %s", entity_type => {
    const rpc: ActivityRpc = async () => ({ error: null, data: { items: [{ ...row, entity_type, title: null, changed_fields: [] }], next_cursor: null } });
    return expect(createActivityGateway({ ...identity, entitlements: { [ACTIVITY_FEATURES[entity_type]]: false } }, rpc).page(query)).rejects.toMatchObject({ code: "unavailable" });
  });
  it.each([{ inicio: false }])("denies Activity itself before RPC", async entitlements => {
    const rpc = vi.fn<ActivityRpc>();
    await expect(createActivityGateway({ ...identity, entitlements }, rpc).page(query)).rejects.toMatchObject({ code: "forbidden" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("database failures remain failures rather than empty pages", async () => {
    await expect(createActivityGateway(identity, async () => ({ data: null, error: { code: "42501" } })).page(query)).rejects.toMatchObject({ code: "forbidden" });
    await expect(createActivityGateway(identity, async () => ({ data: null, error: { code: "P0001" } })).page(query)).rejects.toMatchObject({ code: "unavailable" });
  });
});
