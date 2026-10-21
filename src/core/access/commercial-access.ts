import { diaCivilDe, FUSO_DO_APP, instanteDe, SO_DATA } from "../tempo";
import { FEATURE_KEYS, resolveAccess, type AccessPolicy, type AccessResolution, type FeatureKey } from "./resolve-access";

/** T-031 expansion contract only. No runtime consumer is enabled by this file.
 * Load current authoritative facts on every authorization, never JWT/user metadata.
 * Parsing checks shape and ownership; it does not authenticate the fact's source. */
export interface CommercialSubject {
  readonly userId: string;
  readonly sessionId: string;
  readonly sessionActive: boolean;
  readonly administrativelyBlocked: boolean;
  readonly mustChangePassword: boolean;
}

interface ProjectionHeader {
  readonly version: 1;
  readonly userId: string;
  /** Decimal database revision, represented as text to avoid bigint precision loss. */
  readonly revision: string;
}
export interface RecognizedPeriod {
  readonly id: string;
  readonly startsAt: string;
  /** Half-open interval [startsAt, endsAtExclusive), to review with the ledger owner. */
  readonly endsAtExclusive: string;
}
export interface RenewalObligation {
  readonly chargeId: string;
  /** The unpaid renewal of this period, not any future invoice or initial checkout. */
  readonly dueOn: string;
}
export type CommercialAccessProjection = ProjectionHeader & (
  | { readonly category: "current-free"; readonly eligibilityId: string }
  | { readonly category: "exempt"; readonly grantId: string }
  | { readonly category: "paid"; readonly period: RecognizedPeriod; readonly renewal: RenewalObligation | null }
  | { readonly category: "restricted"; readonly reason: "unclassified" | "suspended" | "ended" | "revoked" | "needs-reconciliation" }
);

export type CommercialAccessReason = AccessResolution["reason"]
  | "session-required" | "administratively-blocked" | "password-change-required"
  | "commercial-state-unavailable" | "commercial-owner-mismatch"
  | "commercial-reconciliation-required" | "commercial-restricted"
  | "paid-period-not-started" | "paid-period-ended" | "renewal-overdue"
  | "invalid-clock" | "feature-unavailable" | "management-operation-denied";
export interface CommercialAccessResolution {
  readonly allowed: boolean;
  readonly visible: boolean;
  readonly reason: CommercialAccessReason;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESTRICTED_REASONS = ["unclassified", "suspended", "ended", "revoked", "needs-reconciliation"] as const;
const MANAGEMENT_OPERATIONS = ["security", "subscription", "data-request"] as const;
export type SelfManagementOperation = typeof MANAGEMENT_OPERATIONS[number];

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function uuid(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }
function instant(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
function civilDate(value: unknown): value is string {
  return typeof value === "string" && SO_DATA.test(value) && !value.startsWith("0000-") && instanteDe(value) !== null;
}
function validClock(now: number): boolean {
  return Number.isSafeInteger(now) && Math.abs(now) <= 8_640_000_000_000_000;
}
function deny(reason: CommercialAccessReason): CommercialAccessResolution {
  return { allowed: false, visible: false, reason };
}
function subjectReason(subject: CommercialSubject | null): CommercialAccessReason | null {
  if (!subject || !uuid(subject.userId) || !uuid(subject.sessionId) || subject.sessionActive !== true) return "session-required";
  if (subject.administrativelyBlocked !== false) return "administratively-blocked";
  if (subject.mustChangePassword !== false) return "password-change-required";
  return null;
}

/** Strict decoding rejects browser patches, unknown versions, editable metadata,
 * provider payloads and future fields until their own contract is reviewed. */
export function parseCommercialAccessProjection(value: unknown): CommercialAccessProjection | null {
  if (!record(value) || value.version !== 1 || !uuid(value.userId)
    || typeof value.revision !== "string" || !/^(0|[1-9]\d{0,18})$/.test(value.revision)) return null;
  const header = ["version", "userId", "revision", "category"];
  switch (value.category) {
    case "current-free":
      return exact(value, [...header, "eligibilityId"]) && uuid(value.eligibilityId) ? value as unknown as CommercialAccessProjection : null;
    case "exempt":
      return exact(value, [...header, "grantId"]) && uuid(value.grantId) ? value as unknown as CommercialAccessProjection : null;
    case "restricted":
      return exact(value, [...header, "reason"]) && RESTRICTED_REASONS.some(reason => reason === value.reason) ? value as unknown as CommercialAccessProjection : null;
    case "paid": {
      if (!exact(value, [...header, "period", "renewal"]) || !record(value.period)
        || !exact(value.period, ["id", "startsAt", "endsAtExclusive"]) || !uuid(value.period.id)
        || !instant(value.period.startsAt) || !instant(value.period.endsAtExclusive)
        || Date.parse(value.period.startsAt) >= Date.parse(value.period.endsAtExclusive)) return null;
      if (value.renewal !== null) {
        if (!record(value.renewal) || !exact(value.renewal, ["chargeId", "dueOn"])
          || !uuid(value.renewal.chargeId) || !civilDate(value.renewal.dueOn)
          || value.renewal.dueOn !== diaCivilDe(value.period.endsAtExclusive, FUSO_DO_APP)) return null;
      }
      return value as unknown as CommercialAccessProjection;
    }
    default: return null;
  }
}

/** Civil D+6, using existing IANA/compatible midnight handling (including DST).
 * UTC arithmetic below moves a calendar date; it never adds UTC hours to a debt. */
export function renewalRestrictionStartsAt(dueOn: string): string | null {
  if (!civilDate(dueOn)) return null;
  const date = new Date(`${dueOn}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 6);
  const target = date.toISOString().slice(0, 10);
  if (!civilDate(target)) return null;
  return instanteDe(target, FUSO_DO_APP);
}

/** This is a module/content authorization, including full Settings snapshots.
 * Minimal account management has its separate operation-specific boundary below.
 * No call changes identity, entitlements, preferences, ledger, receipts or events. */
export function resolveCommercialAccess(input: {
  readonly feature: FeatureKey;
  readonly subject: CommercialSubject | null;
  readonly policy: AccessPolicy;
  readonly projection: unknown;
  readonly now: number;
}): CommercialAccessResolution {
  const identityReason = subjectReason(input.subject);
  if (identityReason) return deny(identityReason);
  if (!FEATURE_KEYS.includes(input.feature)) return deny("feature-unavailable");
  const entitlement = resolveAccess(input.feature, input.policy);
  if (!entitlement.allowed) return entitlement;
  if (!validClock(input.now)) return deny("invalid-clock");
  const projection = parseCommercialAccessProjection(input.projection);
  if (!projection) return deny("commercial-state-unavailable");
  if (projection.userId !== input.subject!.userId) return deny("commercial-owner-mismatch");
  if (projection.category === "restricted") return deny(projection.reason === "needs-reconciliation" ? "commercial-reconciliation-required" : "commercial-restricted");
  if (projection.category === "current-free" || projection.category === "exempt") return entitlement;
  if (input.now < Date.parse(projection.period.startsAt)) return deny("paid-period-not-started");
  // A relevant unpaid renewal must apply its cutoff even if an inconsistent paid
  // interval would extend further; the producer must reconcile causal conflicts.
  if (projection.renewal !== null) {
    const cutoff = renewalRestrictionStartsAt(projection.renewal.dueOn);
    if (cutoff === null) return deny("commercial-state-unavailable");
    if (input.now >= Date.parse(cutoff)) return deny("renewal-overdue");
  }
  if (input.now < Date.parse(projection.period.endsAtExclusive)) return entitlement;
  if (projection.renewal !== null) return entitlement;
  return deny("paid-period-ended");
}

/** A narrow policy contract, not an endpoint or permission to expose a snapshot.
 * Current session/owner/moderation and Configurações veto still apply. Source data
 * must come from dedicated minimal queries; profile/focus/context are excluded.
 * Logout, login and mandatory password change retain their existing Auth flows. */
export function resolveSelfManagementAccess(input: {
  readonly operation: SelfManagementOperation;
  readonly ownerId: string;
  readonly subject: CommercialSubject | null;
  readonly policy: AccessPolicy;
}): CommercialAccessResolution {
  const identityReason = subjectReason(input.subject);
  if (identityReason) return deny(identityReason);
  if (!uuid(input.ownerId) || input.ownerId !== input.subject!.userId) return deny("commercial-owner-mismatch");
  if (!MANAGEMENT_OPERATIONS.some(operation => operation === input.operation)) return deny("management-operation-denied");
  return resolveAccess("configuracoes", input.policy);
}
