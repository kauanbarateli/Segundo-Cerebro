import "server-only";
import { ErroDeDominio } from "../../core/contracts/base";
import type { ReciboIdempotente } from "../../core/contracts/unit-of-work";
import { AuthGuardError } from "../../lib/auth/types";
import { CommitOutcomeUnknown } from "./capture-task-store";
import { ROUTINE_COMMANDS, type RoutineCommand } from "./projects-habits-commands";
import { validateRoutineSnapshot, type RoutineGateway, type RoutineSnapshot } from "./projects-habits-store";
export type RoutineOperation = RoutineCommand | "read.projects" | "read.habits";
export type RoutineRpc = (name: "projects_habits_snapshot" | "projects_habits_commit" | "projects_habits_receipt", args: { p_user: string; p_session: string; p_operation: RoutineOperation; p_request?: unknown; p_command?: string; p_client_id?: string }) => Promise<{ data: unknown; error: { code?: string } | null }>;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export class RoutineRateLimitError extends Error { constructor() { super("Aguarde um pouco antes de salvar novamente."); } }
export function parseRoutineSnapshot(value: unknown, actor: string): RoutineSnapshot {
  if (!record(value) || typeof value.revision !== "string" || !["projects", "habits", "entries", "pauses", "containers", "events", "receipts"].every(key => Array.isArray(value[key])) || Object.values(value).filter(Array.isArray).reduce((n, rows) => n + rows.length, 0) > 10000 || Buffer.byteLength(JSON.stringify(value), "utf8") > 8 * 1024 * 1024) throw new AuthGuardError("unavailable");
  const snapshot = value as unknown as RoutineSnapshot; validateRoutineSnapshot(snapshot, actor); return structuredClone(snapshot);
}
export function createRoutineGateway(actor: string, session: string, operation: RoutineOperation, rpc: RoutineRpc): RoutineGateway {
  if (!uuid(actor) || !uuid(session) || !(["read.projects", "read.habits"].includes(operation) || ROUTINE_COMMANDS.includes(operation as RoutineCommand))) throw new AuthGuardError("unavailable");
  async function call(name: Parameters<RoutineRpc>[0], extra: Partial<Parameters<RoutineRpc>[1]> = {}, writing = false) {
    let result; try { result = await rpc(name, { p_user: actor, p_session: session, p_operation: operation, ...extra }); } catch { if (writing) throw new CommitOutcomeUnknown(); throw new AuthGuardError("unavailable"); }
    if (result.error) { const code = result.error.code; if (code === "42501") throw new AuthGuardError("forbidden"); if (code === "PT429") throw new RoutineRateLimitError(); if (["23505", "40001", "40P01"].includes(code ?? "")) throw new ErroDeDominio("CONFLICT", "Os dados mudaram. Repita o mesmo envio."); if (["22023", "23514", "23503", "22P02"].includes(code ?? "")) throw new ErroDeDominio("VALIDATION", "Revise os dados da operação."); if (writing && !code) throw new CommitOutcomeUnknown(); throw new AuthGuardError("unavailable"); }
    return result.data;
  }
  return { actorId: actor, async snapshot() { return parseRoutineSnapshot(await call("projects_habits_snapshot"), actor); }, async receipt(command, clientId) { const value = await call("projects_habits_receipt", { p_command: command, p_client_id: clientId }); if (value === null) return null; if (!record(value) || value.user_id !== actor || value.command !== command || value.client_id !== clientId || typeof value.fingerprint !== "string") throw new AuthGuardError("unavailable"); return value as unknown as ReciboIdempotente; }, async commit(request) { const value = await call("projects_habits_commit", { p_request: request }, true); if (!record(value) || !["stale", "committed", "replayed"].includes(String(value.status)) || value.status !== "stale" && !Object.hasOwn(value, "result")) throw new CommitOutcomeUnknown(); return value.status === "stale" ? { status: "stale" } : { status: value.status as "committed" | "replayed", result: value.result }; } };
}
