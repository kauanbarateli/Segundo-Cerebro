import { instanteValido } from "../contracts/base";

/** Browser projection. Registered timestamps do not certify activity or validity. */
export interface OwnSessionSummary {
  readonly isCurrent: boolean;
  readonly createdAt: string | null;
  readonly refreshedAt: string | null;
}
export interface OwnSessionsView {
  readonly sessions: readonly OwnSessionSummary[];
  readonly hasMore: boolean;
}
export interface OwnSessionsPort { read(): Promise<OwnSessionsView> }
export class OwnSessionsReadError extends Error {
  readonly code: "UNAVAILABLE" | "SESSION_CHANGED";
  constructor(code: "UNAVAILABLE" | "SESSION_CHANGED") {
    super("Não foi possível carregar as sessões desta conta.");
    this.name = "OwnSessionsReadError";
    this.code = code;
  }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ownSessionId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).length === fields.length && Object.keys(value).every(key => fields.includes(key));
const timestamp = (value: unknown): value is string | null => value === null || typeof value === "string" && value.length <= 64 && instanteValido(value);
const bounded = (rows: readonly unknown[], more: unknown) => rows.length <= 100 && typeof more === "boolean" && (!more || rows.length === 100);

/** Called by the server adapter with its verified current SID, never a form value. */
export function projectOwnSessions(value: unknown, expectedSessionId: string): OwnSessionsView {
  const unavailable = (): never => { throw new OwnSessionsReadError("UNAVAILABLE"); };
  const changed = (): never => { throw new OwnSessionsReadError("SESSION_CHANGED"); };
  if (!UUID.test(expectedSessionId)) return changed();
  if (!record(value) || !exact(value, ["sessions", "has_more"]) || !Array.isArray(value.sessions) || !bounded(value.sessions, value.has_more)) return unavailable();
  if (!value.sessions.length) return changed();
  const ids = new Set<string>();
  const sessions: OwnSessionSummary[] = [];
  for (const row of value.sessions) {
    if (!record(row) || !exact(row, ["id", "is_current", "created_at", "refreshed_at", "not_after"]) || typeof row.id !== "string" || !UUID.test(row.id) || typeof row.is_current !== "boolean" || !timestamp(row.created_at) || !timestamp(row.refreshed_at) || !timestamp(row.not_after)) return unavailable();
    const id = row.id.toLowerCase();
    if (ids.has(id)) return unavailable();
    ids.add(id);
    if (row.is_current !== (id === expectedSessionId.toLowerCase())) return changed();
    sessions.push({ isCurrent: row.is_current, createdAt: row.created_at, refreshedAt: row.refreshed_at });
  }
  if (!sessions[0]?.isCurrent || sessions.filter(row => row.isCurrent).length !== 1) return changed();
  return { sessions, hasMore: value.has_more === true };
}

/** The UI receives only this closed projection, never server/session identifiers. */
export function validOwnSessionsView(value: unknown): value is OwnSessionsView {
  if (!record(value) || !exact(value, ["sessions", "hasMore"]) || !Array.isArray(value.sessions) || !bounded(value.sessions, value.hasMore) || !value.sessions.length) return false;
  for (const row of value.sessions) {
    if (!record(row) || !exact(row, ["isCurrent", "createdAt", "refreshedAt"]) || typeof row.isCurrent !== "boolean" || !timestamp(row.createdAt) || !timestamp(row.refreshedAt)) return false;
  }
  return value.sessions[0]?.isCurrent === true && value.sessions.filter(row => row.isCurrent).length === 1;
}
