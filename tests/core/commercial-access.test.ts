import { describe, expect, it } from "vitest";
import {
  parseCommercialAccessProjection, renewalRestrictionStartsAt,
  resolveCommercialAccess, resolveSelfManagementAccess,
  type CommercialAccessProjection, type CommercialSubject, type SelfManagementOperation,
} from "../../src/core/access/commercial-access";
import { FEATURE_KEYS, type AccessPolicy, type FeatureKey } from "../../src/core/access/resolve-access";

// Deliberately synthetic IDs. No account inventory, Auth or financial provider.
const USER = "10000000-0000-4000-8000-000000000001";
const OTHER = "10000000-0000-4000-8000-000000000002";
const SESSION = "20000000-0000-4000-8000-000000000001";
const EVIDENCE = "30000000-0000-4000-8000-000000000001";
const PERIOD = "40000000-0000-4000-8000-000000000001";
const CHARGE = "50000000-0000-4000-8000-000000000001";
const subject: CommercialSubject = { userId: USER, sessionId: SESSION, sessionActive: true, administrativelyBlocked: false, mustChangePassword: false };
const policy: AccessPolicy = { entitlements: {}, preferences: {}, isAdmin: false };
const free: CommercialAccessProjection = { version: 1, userId: USER, revision: "1", category: "current-free", eligibilityId: EVIDENCE };
const exempt: CommercialAccessProjection = { version: 1, userId: USER, revision: "2", category: "exempt", grantId: EVIDENCE };
const paid: CommercialAccessProjection = {
  version: 1, userId: USER, revision: "3", category: "paid",
  period: { id: PERIOD, startsAt: "2026-09-10T15:00:00.000Z", endsAtExclusive: "2026-10-10T15:00:00.000Z" },
  renewal: { chargeId: CHARGE, dueOn: "2026-10-10" },
};
const restricted: CommercialAccessProjection = { version: 1, userId: USER, revision: "4", category: "restricted", reason: "suspended" };
const now = Date.parse("2026-10-16T03:00:00.000Z");
function access(projection: unknown, overrides: Partial<Parameters<typeof resolveCommercialAccess>[0]> = {}) {
  return resolveCommercialAccess({ feature: "tarefas", subject, policy, projection, now, ...overrides });
}

describe("T-031 explicit authoritative commercial projection", () => {
  it.each([free, exempt, paid, restricted])("decodes a closed v1 projection ($category)", projection => {
    expect(parseCommercialAccessProjection(projection)).toEqual(projection);
  });
  it.each([
    null, undefined, {}, [], { ...free, version: 2 }, { ...free, revision: 1 }, { ...free, revision: "01" },
    { ...free, eligibilityId: undefined }, { ...exempt, grantId: undefined },
    { ...free, userId: "unverified-email@example.invalid" }, { ...free, role: "master" },
    { ...free, app_metadata: { free: true } }, { ...paid, renewal: undefined },
    { ...paid, period: { ...paid.period, startsAt: "2026-10-10T15:00:00.000Z" } },
    { ...paid, period: { ...paid.period, startsAt: "2026-09-10T12:00:00-03:00" } },
    { ...paid, period: { ...paid.period, endsAtExclusive: "2026-02-30T15:00:00.000Z" } },
    { ...paid, renewal: { chargeId: CHARGE, dueOn: "2026-11-10" } },
    { ...paid, renewal: { chargeId: CHARGE, dueOn: "2026-02-30" } },
    { ...paid, renewal: { chargeId: CHARGE, dueOn: "2026-10-10", firstPayment: true } },
    { ...restricted, reason: "browser-return-success" },
  ])("fails closed for missing/invalid/unreviewed state %#", projection => {
    expect(parseCommercialAccessProjection(projection)).toBeNull();
    expect(access(projection).allowed).toBe(false);
  });
  it("requires an explicit historical eligibility record, including for Master and Admin creations", () => {
    expect(access(free).allowed).toBe(true);
    expect(access(exempt).allowed).toBe(true);
    expect(access(null, { policy: { ...policy, isAdmin: true } })).toMatchObject({ allowed: false, reason: "commercial-state-unavailable" });
    expect(access({ version: 1, userId: USER, revision: "1", category: "current-free" }).allowed).toBe(false);
  });
  it("rejects another owner's authoritative-looking projection", () => {
    expect(access({ ...free, userId: OTHER })).toMatchObject({ allowed: false, reason: "commercial-owner-mismatch" });
  });
  it("keeps uncertainty and revocation closed even with future period facts", () => {
    expect(access({ ...restricted, reason: "needs-reconciliation" })).toMatchObject({ allowed: false, reason: "commercial-reconciliation-required" });
    expect(access({ ...restricted, reason: "revoked" }).allowed).toBe(false);
    expect(access({ ...free, category: "paid", period: paid.period, renewal: paid.renewal }).allowed).toBe(false);
  });
});

describe("T-031 session, moderation, entitlement and preference composition", () => {
  it.each([free, exempt, paid])("never overrides manual veto for $category", projection => {
    expect(access(projection, { now: Date.parse("2026-10-10T14:00:00.000Z"), policy: { ...policy, entitlements: { tarefas: false } } }))
      .toEqual({ allowed: false, visible: false, reason: "entitlement-denied" });
  });
  it("hiding is a preference, not a revocation or grant", () => {
    const hidden = { ...policy, preferences: { tarefas: { visible: false, order: 4 } } };
    expect(access(free, { policy: hidden })).toEqual({ allowed: true, visible: false, reason: "allowed" });
    expect(access(restricted, { policy: hidden }).allowed).toBe(false);
  });
  it("paid or free does not promote anyone to Master, and a Master veto remains effective", () => {
    expect(access(free, { feature: "admin" })).toMatchObject({ allowed: false, reason: "admin-required" });
    expect(access(free, { feature: "admin", policy: { ...policy, isAdmin: true, entitlements: { admin: false } } }))
      .toMatchObject({ allowed: false, reason: "entitlement-denied" });
  });
  it.each([
    [null, "session-required"],
    [{ ...subject, sessionActive: false }, "session-required"],
    [{ ...subject, sessionId: "stale-cookie" }, "session-required"],
    [{ ...subject, administrativelyBlocked: true }, "administratively-blocked"],
    [{ ...subject, mustChangePassword: true }, "password-change-required"],
  ] as const)("requires current identity state %#", (actor, reason) => {
    expect(access(free, { subject: actor })).toMatchObject({ allowed: false, reason });
  });
  it("does not turn a commercially suspended actor into an anonymous identity or mutate policies", () => {
    const before = structuredClone({ subject, policy, restricted });
    expect(access(restricted)).toMatchObject({ allowed: false, reason: "commercial-restricted" });
    expect({ subject, policy, restricted }).toEqual(before);
    expect(subject.sessionActive).toBe(true);
  });
  it.each(FEATURE_KEYS)("restricts full module access, including %s", feature => {
    expect(access(restricted, { feature, policy: { ...policy, isAdmin: true } }).allowed).toBe(false);
  });
  it("rejects unsupported capability keys at runtime", () => {
    expect(access(free, { feature: "subscription-admin" as FeatureKey })).toMatchObject({ allowed: false, reason: "feature-unavailable" });
  });
  it.each([NaN, Infinity, -Infinity, now + 0.1, 8_640_000_000_000_001])("fails closed for an invalid explicit clock %s", clock => {
    expect(access(free, { now: clock })).toMatchObject({ allowed: false, reason: "invalid-clock" });
  });
});

describe("T-031 civil renewal boundary and half-open recognized periods", () => {
  it.each([
    ["2026-10-10", "2026-10-16T03:00:00.000Z"],
    ["2026-12-29", "2027-01-04T03:00:00.000Z"],
    ["2024-02-24", "2024-03-01T03:00:00.000Z"],
    ["2025-02-24", "2025-03-02T03:00:00.000Z"],
    // The first valid instant on 04/11 was 01:00; UTC-3 would get it wrong later in DST.
    ["2018-10-29", "2018-11-04T03:00:00.000Z"],
    ["2018-11-04", "2018-11-10T02:00:00.000Z"],
    ["2019-02-11", "2019-02-17T03:00:00.000Z"],
  ])("computes civil D+6 for %s independently of machine/browser timezone", (dueOn, cutoff) => {
    expect(renewalRestrictionStartsAt(dueOn)).toBe(cutoff);
  });
  it.each(["2026-02-30", "2026-13-01", "10/10/2026", "2026-10-10T00:00:00Z", "0000-01-01", "9999-12-31"])("rejects invalid/unsupported boundary date %s", date => {
    expect(renewalRestrictionStartsAt(date)).toBeNull();
  });
  it("allows until the last millisecond of day15 and restricts exactly at day16 in São Paulo", () => {
    expect(access(paid, { now: now - 1 }).allowed).toBe(true);
    expect(access(paid)).toMatchObject({ allowed: false, reason: "renewal-overdue" });
    expect(access(paid, { now: now + 1 }).allowed).toBe(false);
    // No webhook/cron status or client timezone input is needed to effect the cutoff.
    expect(access(paid, { now: Date.parse("2026-10-16T00:00:00.000-03:00") })).toEqual(access(paid));
  });
  it("does not extend a cancelled period with grace when no renewal is exigible", () => {
    const cancelled = { ...paid, renewal: null };
    const end = Date.parse(paid.period.endsAtExclusive);
    expect(access(cancelled, { now: end - 1 }).allowed).toBe(true);
    expect(access(cancelled, { now: end })).toMatchObject({ allowed: false, reason: "paid-period-ended" });
    expect(access(cancelled, { now: end + 1 }).allowed).toBe(false);
  });
  it("never treats a future initial payment/period as grace or present access", () => {
    expect(access(paid, { now: Date.parse(paid.period.startsAt) - 1 })).toMatchObject({ allowed: false, reason: "paid-period-not-started" });
    expect(access(paid, { now: Date.parse(paid.period.startsAt) }).allowed).toBe(true);
    expect(access(paid, { now: Date.parse("2026-10-01T03:00:00.000Z") }).allowed).toBe(true);
  });
  it("applies the cutoff around the historical DST jump", () => {
    const dst = { ...paid, period: { id: PERIOD, startsAt: "2018-09-29T15:00:00.000Z", endsAtExclusive: "2018-10-29T15:00:00.000Z" }, renewal: { chargeId: CHARGE, dueOn: "2018-10-29" } };
    const cutoff = Date.parse("2018-11-04T03:00:00.000Z");
    expect(access(dst, { now: cutoff - 1 }).allowed).toBe(true);
    expect(access(dst, { now: cutoff }).allowed).toBe(false);
  });
  it("is deterministic for a replay of the same authoritative facts and clock", () => {
    expect(access(paid)).toEqual(access(structuredClone(paid)));
  });
});

describe("T-031 minimum self-management has a separate boundary", () => {
  it.each(["security", "subscription", "data-request"] as const)("allows own %s with no commercial period", operation => {
    expect(resolveSelfManagementAccess({ operation, ownerId: USER, subject, policy })).toMatchObject({ allowed: true });
    expect(access(restricted, { feature: "configuracoes" }).allowed).toBe(false);
  });
  it.each(["module-snapshot", "profile-focus", "project-context", "avatar-upload", "arbitrary-rpc"])("does not open %s as account management", operation => {
    expect(resolveSelfManagementAccess({ operation: operation as SelfManagementOperation, ownerId: USER, subject, policy }))
      .toMatchObject({ allowed: false, reason: "management-operation-denied" });
  });
  it("preserves owner, session, moderation and manual Settings veto", () => {
    const input = { operation: "subscription" as const, ownerId: USER, subject, policy };
    expect(resolveSelfManagementAccess({ ...input, ownerId: OTHER }).allowed).toBe(false);
    expect(resolveSelfManagementAccess({ ...input, subject: { ...subject, sessionActive: false } }).allowed).toBe(false);
    expect(resolveSelfManagementAccess({ ...input, subject: { ...subject, administrativelyBlocked: true } }).allowed).toBe(false);
    expect(resolveSelfManagementAccess({ ...input, policy: { ...policy, entitlements: { configuracoes: false } } })).toMatchObject({ allowed: false, reason: "entitlement-denied" });
  });
});
