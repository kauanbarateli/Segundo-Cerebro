import { afterEach, describe, expect, it, vi } from "vitest";
import { createAttributesClient, decodeAttributeSnapshot } from "../../src/lib/onboarding-attributes-client";

const owner = "69000000-0000-4000-8000-000000000001", projectId = "69000000-0000-4000-8000-000000000002";
const profile = { displayName: "Pessoa", focus: "work", revision: "opaque/v2:hash" };
const project = { projectId, context: "study", revision: "another:opaque/revision" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
const passed = (value = profile) => json({ ok: true, result: value });
afterEach(() => vi.useRealTimers());

describe("onboarding attributes owner-bound browser port", () => {
  it("reads the fixed same-origin endpoint with owner, no cache or redirects", async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("/api/onboarding/attributes?kind=profile");
      expect(init).toMatchObject({ method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error", headers: { "X-Expected-User-ID": owner } });
      expect(init.body).toBeUndefined(); return passed();
    });
    const client = createAttributesClient(owner, fetcher);
    expect(await client.read({ kind: "profile" })).toEqual({ ok: true, result: profile });
    expect(fetcher).toHaveBeenCalledTimes(1); client.dispose();
  });
  it("checks project binding, opaque revision and nullable context", async () => {
    const fetcher = vi.fn(async (url: string) => { expect(url).toBe("/api/onboarding/attributes?kind=project&id=" + projectId); return json({ ok: true, result: project }); });
    const client = createAttributesClient(owner, fetcher);
    expect(await client.read({ kind: "project", projectId })).toEqual({ ok: true, result: project });
    expect(decodeAttributeSnapshot({ ...project, context: null }, { kind: "project", projectId })).toEqual({ ...project, context: null });
    expect(decodeAttributeSnapshot({ ...project, projectId: owner }, { kind: "project", projectId })).toBeNull(); client.dispose();
  });
  it.each([
    { ...profile, userId: owner }, { ...profile, focus: "admin" }, { ...profile, revision: 3 }, { ...profile, revision: "" },
    { ...profile, revision: "x".repeat(257) }, { ...profile, displayName: "x".repeat(121) }, { ...profile, focus: undefined },
  ])("refuses malformed or extended profile snapshots", value => { expect(decodeAttributeSnapshot(value, { kind: "profile" })).toBeNull(); });
  it("does not invoke accessors and catches refused object inspection", () => {
    const read = vi.fn(), value = { ...profile }; Object.defineProperty(value, "focus", { get: read });
    expect(decodeAttributeSnapshot(value, { kind: "profile" })).toBeNull(); expect(read).not.toHaveBeenCalled();
    expect(decodeAttributeSnapshot(new Proxy({}, { ownKeys() { throw new Error("private"); } }), { kind: "profile" })).toBeNull();
  });
  it("keeps exact body/clientId after uncertainty, coalesces double submit and caches success", async () => {
    const requests: RequestInit[] = []; let release!: (value: Response) => void;
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(init); return requests.length === 1 ? new Promise<Response>(resolve => { release = resolve; }) : passed();
    });
    const client = createAttributesClient(owner, fetcher), attempt = client.prepare({ kind: "profile" }, "opaque/v1", "work", "stable-client");
    const first = attempt.submit(); expect(attempt.submit()).toBe(first); expect(fetcher).toHaveBeenCalledTimes(1);
    release(json({ ok: false, code: "COMMIT_UNKNOWN", message: "Não confirmado." }, 503));
    expect(await first).toMatchObject({ ok: false, reason: "uncertain" });
    expect(await attempt.submit()).toEqual({ ok: true, result: profile });
    expect(requests[0]!.body).toBe(requests[1]!.body);
    expect(JSON.parse(requests[1]!.body as string)).toEqual({ kind: "profile", clientId: "stable-client", expectedRevision: "opaque/v1", patch: { focus: "work" } });
    expect(requests[1]).toMatchObject({ method: "PATCH", headers: { "X-Expected-User-ID": owner, "Content-Type": "application/json" } });
    expect(await attempt.submit()).toEqual({ ok: true, result: profile }); expect(fetcher).toHaveBeenCalledTimes(2); client.dispose();
  });
  it("sends project context/null with the exact project and CAS revision", async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("/api/onboarding/attributes");
      expect(JSON.parse(init.body as string)).toEqual({ kind: "project", projectId, clientId: "context-clear", expectedRevision: project.revision, context: null });
      return json({ ok: true, result: { ...project, context: null } });
    });
    const client = createAttributesClient(owner, fetcher);
    expect(await client.prepare({ kind: "project", projectId }, project.revision, null, "context-clear").submit()).toMatchObject({ ok: true }); client.dispose();
  });
  it.each([[403, "FORBIDDEN"], [400, "VALIDATION"], [409, "CONFLICT"]] as const)("uncertainty remains locked after retry HTTP%s/%s until the original receipt succeeds", async (status, code) => {
    const bodies: string[] = [];
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(init.body as string);
      return bodies.length === 1 ? json({ ok: false, code: "COMMIT_UNKNOWN", message: "Indefinido." }, 503)
        : bodies.length === 2 ? json({ ok: false, code, message: "A tentativa atual foi recusada." }, status) : passed();
    });
    const client = createAttributesClient(owner, fetcher);
    const original = client.prepare({ kind: "profile" }, "opaque/v1", "work", "original-intent");
    const prepreparedOther = client.prepare({ kind: "profile" }, "opaque/v1", "study", "must-not-send");
    expect(await original.submit()).toMatchObject({ reason: "uncertain" });
    expect(() => client.prepare({ kind: "profile" }, "opaque/v1", "personal")).toThrow("envio original");
    expect(await prepreparedOther.submit()).toMatchObject({ reason: "uncertain" }); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await original.submit()).toMatchObject({ reason: "uncertain" });
    expect(() => client.prepare({ kind: "profile" }, "opaque/v1", "personal", "another-id")).toThrow("envio original");
    expect(await original.submit()).toEqual({ ok: true, result: profile });
    expect(bodies).toHaveLength(3); expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0]!)).toMatchObject({ clientId: "original-intent", expectedRevision: "opaque/v1", patch: { focus: "work" } });
    expect(() => client.prepare({ kind: "profile" }, profile.revision, "personal", "after-confirmation")).not.toThrow(); client.dispose();
  });
  it("session change after uncertainty invalidates the owner without claiming the previous commit was absent", async () => {
    let calls = 0;
    const fetcher = vi.fn(async () => ++calls === 1 ? json({ ok: false, code: "COMMIT_UNKNOWN", message: "Indefinido." }, 503) : json({ ok: false, code: "SESSION_CHANGED", message: "A conta mudou." }, 409));
    const client = createAttributesClient(owner, fetcher), original = client.prepare({ kind: "profile" }, "opaque", "work", "original");
    expect(await original.submit()).toMatchObject({ reason: "uncertain" }); expect(await original.submit()).toMatchObject({ reason: "session-changed" });
    expect(await original.submit()).toMatchObject({ reason: "session-changed" });
    expect(() => client.prepare({ kind: "profile" }, "new", "personal", "other")).toThrow(); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    [401, "UNAUTHENTICATED", "session-changed"], [409, "SESSION_CHANGED", "session-changed"],
    [409, "CONFLICT", "conflict"], [400, "VALIDATION", "rejected"], [403, "FORBIDDEN", "rejected"],
    [503, "UNAVAILABLE", "uncertain"], [503, "COMMIT_UNKNOWN", "uncertain"], [409, "invented", "uncertain"],
  ] as const)("maps HTTP%s/%s to a closed recovery state", async (status, code, reason) => {
    const fetcher = vi.fn(async () => json({ ok: false, code, message: "Texto do servidor não substitui orientação local." }, status));
    const client = createAttributesClient(owner, fetcher), attempt = client.prepare({ kind: "profile" }, "opaque", "work", "id");
    expect(await attempt.submit()).toMatchObject({ ok: false, reason });
    if (reason === "session-changed") { expect(await client.read({ kind: "profile" })).toMatchObject({ reason }); expect(fetcher).toHaveBeenCalledTimes(1); }
    client.dispose();
  });
  it("refuses nominal success that did not confirm the chosen value", async () => {
    const client = createAttributesClient(owner, async () => passed({ ...profile, focus: "study" }));
    expect(await client.prepare({ kind: "profile" }, "revision", "work", "id").submit()).toMatchObject({ ok: false, reason: "uncertain" }); client.dispose();
  });
  it.each([
    () => new Response("not json", { headers: { "Content-Type": "text/plain" } }),
    () => new Response("{", { headers: { "Content-Type": "application/json" } }),
    () => json({ ok: true, result: profile, extra: "refused" }),
    () => new Response("{}", { headers: { "Content-Type": "application/json", "Content-Length": "8193" } }),
    () => json({ ok: true, result: { ...profile, displayName: "x".repeat(9000) } }),
  ])("keeps malformed and oversized write replies uncertain", async response => {
    const client = createAttributesClient(owner, async () => response());
    expect(await client.prepare({ kind: "profile" }, "revision", "work", "id").submit()).toMatchObject({ ok: false, reason: "uncertain" }); client.dispose();
  });
  it("refuses invalid inputs and demo owners before network or write", async () => {
    const fetcher = vi.fn(async () => passed()), demo = createAttributesClient("demo-user", fetcher);
    expect(await demo.read({ kind: "profile" })).toMatchObject({ reason: "session-changed" });
    expect(() => demo.prepare({ kind: "profile" }, "revision", "work", "id")).toThrow();
    const client = createAttributesClient(owner, fetcher);
    expect(() => client.prepare({ kind: "project", projectId: "https://foreign.invalid" }, "revision", "work", "id")).toThrow();
    expect(() => client.prepare({ kind: "project", projectId }, "revision", "mixed", "id")).toThrow();
    expect(() => client.prepare({ kind: "profile" }, "", "work", "id")).toThrow();
    expect(fetcher).not.toHaveBeenCalled(); client.dispose();
  });
  it("bounds a stalled transport without confirming the write", async () => {
    vi.useFakeTimers(); const fetcher = vi.fn(() => new Promise<Response>(() => undefined));
    const client = createAttributesClient(owner, fetcher), pending = client.prepare({ kind: "profile" }, "revision", "work", "id").submit();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await pending).toMatchObject({ ok: false, reason: "uncertain" }); expect(fetcher).toHaveBeenCalledTimes(1); client.dispose();
  });
  it("disposal rejects late replies and prevents writes by an old owner's attempt", async () => {
    let release!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(resolve => { release = resolve; }));
    const client = createAttributesClient(owner, fetcher), attempt = client.prepare({ kind: "profile" }, "revision", "work", "id"), pending = attempt.submit();
    client.dispose(); release(passed());
    expect(await pending).toMatchObject({ reason: "session-changed" });
    expect(await attempt.submit()).toMatchObject({ reason: "session-changed" }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
