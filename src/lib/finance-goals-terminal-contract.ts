/** Pure terminal protocol. No capture, hashing, transport, SDK or server import.
 * The expected digest belongs to the caller's privately captured original. */
import { exigir } from "../core/contracts/base";
import type { GoalCommand, GoalCommandResult } from "../core/financeiro/goals/goal-types";
import { decodeGoalCommandResult } from "../core/financeiro/goals/goal-use-cases";
import { decodeGoalCommand, goalRecord, goalTimestamp, goalUuid } from "../core/financeiro/goals/goal-validation";

export const GOAL_TERMINAL_CANONICAL_VERSION = 1;
export const GOAL_TERMINAL_PROTOCOL_VERSION = 2;
export const GOAL_TERMINAL_CANONICAL_BYTES = 65_536;
export const GOAL_TERMINAL_ENVELOPE_BYTES = 262_144;
export const GOAL_TERMINAL_HTTP_PATHS = Object.freeze({
  status: "/api/finance/goals/attempt/status",
  settle: "/api/finance/goals/attempt/settle",
});
export const GOAL_TERMINAL_REPLY_JSON_LIMITS = Object.freeze({ maxDepth: 6, maxProperties: 64 });
export interface GoalTerminalRequest {
  version: 2; canonicalization_version: 1; command: GoalCommand["command"];
  client_id: string; canonical_input: string;
}
export interface GoalTerminalBinding {
  version: 2; user_id: string; command: GoalCommand["command"]; client_id: string;
  canonicalization_version: 1; input_digest: string;
}
export interface GoalTerminalDisposition extends GoalTerminalBinding { id: string; closed_at: string }
export type GoalTerminalReply =
  | { version: 2; kind: "confirmed"; binding: GoalTerminalBinding; result: GoalCommandResult }
  | { version: 2; kind: "closed"; binding: GoalTerminalBinding; disposition: GoalTerminalDisposition }
  | { version: 2; kind: "uncertain"; binding: GoalTerminalBinding };

const bindingKeys = ["version", "user_id", "command", "client_id", "canonicalization_version", "input_digest"];
function binding(value: unknown, expected: Readonly<GoalTerminalBinding>): GoalTerminalBinding {
  const row = goalRecord(value, bindingKeys);
  exigir(row.version === 2 && row.canonicalization_version === 1 && row.user_id === expected.user_id && row.command === expected.command && row.client_id === expected.client_id && row.input_digest === expected.input_digest, "Resposta terminal fora da intenção capturada.");
  return { ...expected };
}
/** Shape and correlation check only: this does not compute a digest or turn a
 * caller-supplied structural object into a nominal server/browser capture. */
export function decodeGoalTerminalOutcome(expected: Readonly<GoalTerminalBinding>, original: GoalCommand, value: unknown): GoalTerminalReply {
  const request = decodeGoalCommand(original), local = goalRecord(expected, bindingKeys);
  goalUuid(local.user_id); goalUuid(local.client_id);
  exigir(local.version === 2 && local.canonicalization_version === 1 && local.command === request.command && local.client_id === request.input.client_id && typeof local.input_digest === "string" && /^[0-9a-f]{64}$/.test(local.input_digest), "Vínculo terminal inválido.");
  const trusted: GoalTerminalBinding = { version: 2, user_id: local.user_id, command: request.command, client_id: local.client_id, canonicalization_version: 1, input_digest: local.input_digest };
  const row = goalRecord(value, ["version", "kind", "binding"], ["result", "disposition"]);
  exigir(row.version === 2, "Versão terminal indisponível."); const checked = binding(row.binding, trusted);
  if (row.kind === "uncertain") {
    goalRecord(value, ["version", "kind", "binding"]); return { version: 2, kind: "uncertain", binding: checked };
  }
  if (row.kind === "confirmed") {
    goalRecord(value, ["version", "kind", "binding", "result"]);
    return { version: 2, kind: "confirmed", binding: checked, result: decodeGoalCommandResult(row.result, structuredClone(request), checked.user_id) };
  }
  exigir(row.kind === "closed", "Estado terminal indisponível."); goalRecord(value, ["version", "kind", "binding", "disposition"]);
  const closed = goalRecord(row.disposition, ["version", "id", "user_id", "command", "client_id", "canonicalization_version", "input_digest", "closed_at"]);
  binding({ version: closed.version, user_id: closed.user_id, command: closed.command, client_id: closed.client_id, canonicalization_version: closed.canonicalization_version, input_digest: closed.input_digest }, checked);
  goalUuid(closed.id); goalTimestamp(closed.closed_at);
  return { version: 2, kind: "closed", binding: checked, disposition: { ...checked, id: closed.id, closed_at: closed.closed_at } };
}
