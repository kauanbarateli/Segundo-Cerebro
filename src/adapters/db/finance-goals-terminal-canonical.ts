import "server-only";
import { createHash } from "node:crypto";
import { assinatura, exigir } from "../../core/contracts/base";
import type { GoalCommand } from "../../core/financeiro/goals/goal-types";
import { decodeGoalCommand, goalUuid } from "../../core/financeiro/goals/goal-validation";
import { decodeGoalTerminalOutcome, GOAL_TERMINAL_CANONICAL_BYTES, GOAL_TERMINAL_ENVELOPE_BYTES, type GoalTerminalBinding, type GoalTerminalReply, type GoalTerminalRequest } from "../../lib/finance-goals-terminal-contract";
export { GOAL_TERMINAL_CANONICAL_VERSION, GOAL_TERMINAL_PROTOCOL_VERSION, GOAL_TERMINAL_CANONICAL_BYTES, GOAL_TERMINAL_ENVELOPE_BYTES, type GoalTerminalRequest, type GoalTerminalBinding, type GoalTerminalDisposition, type GoalTerminalReply } from "../../lib/finance-goals-terminal-contract";

/** Server trust boundary, NOT an independent SQL implementation of localeCompare.
 * No caller-supplied canonical string/digest, I/O, credentials or logging. */
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
export function decodeGoalTerminalReply(token: CapturedGoalTerminalAttempt, value: unknown): GoalTerminalReply {
  return decodeGoalTerminalOutcome(token.binding, original(token).request, value);
}
