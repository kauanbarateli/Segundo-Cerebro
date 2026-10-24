import "server-only";
import { createHash } from "node:crypto";
import { assinatura, exigir } from "../../core/contracts/base";
import type { GoalCommand, GoalCommandResult } from "../../core/financeiro/goals/goal-types";
import { decodeGoalCommandResult } from "../../core/financeiro/goals/goal-use-cases";
import { decodeGoalCommand, goalRecord, goalTimestamp, goalUuid } from "../../core/financeiro/goals/goal-validation";

/** Server trust boundary, NOT an independent SQL implementation of localeCompare.
 * No caller-supplied canonical string/digest, I/O, credentials or logging. */
export const GOAL_TERMINAL_CANONICAL_VERSION = 1;
export const GOAL_TERMINAL_PROTOCOL_VERSION = 2;
export const GOAL_TERMINAL_CANONICAL_BYTES = 65_536;
export const GOAL_TERMINAL_ENVELOPE_BYTES = 262_144;
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
export interface CapturedGoalTerminalAttempt { readonly binding: Readonly<GoalTerminalBinding> }
const captured = new WeakMap<CapturedGoalTerminalAttempt, { request: GoalCommand; envelope: GoalTerminalRequest }>();
const utf8 = (value: string) => Buffer.byteLength(value, "utf8");
const digest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

export function captureGoalTerminalAttempt(userId: string, original: unknown): CapturedGoalTerminalAttempt {
  goalUuid(userId);
  // Decode clones descriptors and preserves strings; never normalize a journal's
  // name, Unicode, null/omission, revision or UUID into a different intention.
  const request = decodeGoalCommand(original), canonical = assinatura(request.input);
  exigir(utf8(canonical) <= GOAL_TERMINAL_CANONICAL_BYTES, "Intenção terminal excede o limite.");
  const envelope: GoalTerminalRequest = { version: 2, canonicalization_version: 1, command: request.command, client_id: request.input.client_id, canonical_input: canonical };
  exigir(utf8(JSON.stringify(envelope)) <= GOAL_TERMINAL_ENVELOPE_BYTES, "Envelope terminal excede o limite.");
  const binding: GoalTerminalBinding = { version: 2, user_id: userId, command: request.command, client_id: request.input.client_id, canonicalization_version: 1, input_digest: digest(canonical) };
  const token = Object.freeze({ binding: Object.freeze(binding) });
  captured.set(token, { request, envelope }); return token;
}
function original(token: CapturedGoalTerminalAttempt) {
  const value = captured.get(token); exigir(value !== undefined, "Captura terminal não reconhecida."); return value;
}
/** Independent copy for each future RPC. Mutating it cannot change the capture. */
export function goalTerminalRpcRequest(token: CapturedGoalTerminalAttempt): GoalTerminalRequest { return structuredClone(original(token).envelope); }
function binding(value: unknown, expected: Readonly<GoalTerminalBinding>): GoalTerminalBinding {
  const row = goalRecord(value, ["version", "user_id", "command", "client_id", "canonicalization_version", "input_digest"]);
  exigir(row.version === 2 && row.canonicalization_version === 1 && row.user_id === expected.user_id && row.command === expected.command && row.client_id === expected.client_id && row.input_digest === expected.input_digest, "Resposta terminal fora da intenção capturada.");
  return { ...expected };
}
export function decodeGoalTerminalReply(token: CapturedGoalTerminalAttempt, value: unknown): GoalTerminalReply {
  const state = original(token), row = goalRecord(value, ["version", "kind", "binding"], ["result", "disposition"]);
  exigir(row.version === 2, "Versão terminal indisponível."); const checked = binding(row.binding, token.binding);
  if (row.kind === "uncertain") {
    goalRecord(value, ["version", "kind", "binding"]); return { version: 2, kind: "uncertain", binding: checked };
  }
  if (row.kind === "confirmed") {
    goalRecord(value, ["version", "kind", "binding", "result"]);
    return { version: 2, kind: "confirmed", binding: checked, result: decodeGoalCommandResult(row.result, structuredClone(state.request), checked.user_id) };
  }
  exigir(row.kind === "closed", "Estado terminal indisponível."); goalRecord(value, ["version", "kind", "binding", "disposition"]);
  const closed = goalRecord(row.disposition, ["version", "id", "user_id", "command", "client_id", "canonicalization_version", "input_digest", "closed_at"]);
  binding({ version: closed.version, user_id: closed.user_id, command: closed.command, client_id: closed.client_id, canonicalization_version: closed.canonicalization_version, input_digest: closed.input_digest }, checked);
  goalUuid(closed.id); goalTimestamp(closed.closed_at);
  return { version: 2, kind: "closed", binding: checked, disposition: { ...checked, id: closed.id, closed_at: closed.closed_at } };
}
