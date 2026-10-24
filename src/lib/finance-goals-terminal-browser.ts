import { assinatura } from "../core/contracts/base";
import type { GoalCommand } from "../core/financeiro/goals/goal-types";
import { decodeGoalCommand, goalRecord, goalUuid } from "../core/financeiro/goals/goal-validation";
import { decodeGoalTerminalOutcome, GOAL_TERMINAL_CANONICAL_BYTES, type GoalTerminalBinding, type GoalTerminalReply } from "./finance-goals-terminal-contract";

type Positive = Exclude<GoalTerminalReply, { kind: "uncertain" }>;
export interface GoalTerminalProof { readonly kind: "goal-terminal-positive" }
export type GoalTerminalClientOutcome = { reply: Extract<GoalTerminalReply, { kind: "uncertain" }>; proof: null } | { reply: Positive; proof: GoalTerminalProof };
export interface GoalTerminalBrowserCapture { readonly binding: Readonly<GoalTerminalBinding>; readonly epoch: string }
export type GoalTerminalDigest = (algorithm: "SHA-256", bytes: ArrayBuffer) => Promise<ArrayBuffer>;
const captures = new WeakMap<GoalTerminalBrowserCapture, { intent: GoalCommand; signature: string }>();
const proofs = new WeakMap<GoalTerminalProof, { owner: string; epoch: string; intent: GoalCommand; reply: Positive; consumed: boolean }>();
const requireValue = (value: unknown) => { if (!value) throw Error("Invalid terminal observation."); };

/** Bounds a local wait without retry. Late results cannot dispatch a follow-up. */
export async function waitGoalTerminal<T>(promise: Promise<T>, signal: AbortSignal, guard: () => void): Promise<T> {
  try { guard(); if (signal.aborted) throw Error("Terminal observation aborted."); }
  catch (error) { void promise.catch(() => undefined); throw error; } // Observe a late rejection; never continue a refused wait.
  let rejectAbort = () => undefined as void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = () => reject(Error("Terminal observation aborted.")); signal.addEventListener("abort", rejectAbort, { once: true }); });
  try { if (signal.aborted) rejectAbort(); const value = await Promise.race([promise, aborted]); guard(); if (signal.aborted) throw Error("Terminal observation aborted."); return value; }
  finally { signal.removeEventListener("abort", rejectAbort); }
}
const browserDigest: GoalTerminalDigest = (algorithm, bytes) => {
  if (!globalThis.crypto?.subtle) throw Error("Web Crypto unavailable.");
  return globalThis.crypto.subtle.digest(algorithm, bytes);
};
export async function captureGoalTerminalBrowserAttempt(owner: string, epoch: string, original: unknown, signal: AbortSignal, guard: () => void, digest: GoalTerminalDigest = browserDigest): Promise<GoalTerminalBrowserCapture> {
  guard(); goalUuid(owner); goalUuid(epoch);
  // Capture the whole original before the first await. The digest port never receives an intent alias.
  const intent = decodeGoalCommand(original), signature = assinatura(intent.input), encoded = new TextEncoder().encode(signature);
  requireValue(encoded.length > 0 && encoded.length <= GOAL_TERMINAL_CANONICAL_BYTES);
  const submitted = new Uint8Array(encoded), result = await waitGoalTerminal(Promise.resolve().then(() => { guard(); if (signal.aborted) throw Error("Aborted."); return digest("SHA-256", submitted.buffer); }), signal, guard);
  requireValue(result instanceof ArrayBuffer && result.byteLength === 32 && submitted.every((byte, index) => byte === encoded[index]));
  const inputDigest = Array.from(new Uint8Array(result).slice(), byte => byte.toString(16).padStart(2, "0")).join(""); guard();
  const capture = Object.freeze({ binding: Object.freeze({ version: 2 as const, user_id: owner, command: intent.command, client_id: intent.input.client_id, canonicalization_version: 1 as const, input_digest: inputDigest }), epoch });
  captures.set(capture, { intent, signature }); return capture;
}
export function goalTerminalBrowserIntent(capture: GoalTerminalBrowserCapture): GoalCommand {
  const state = captures.get(capture); requireValue(state); if (!state) throw Error("Unknown terminal capture."); return structuredClone(state.intent);
}
/** Only this validated transport path issues proof. There is no DTO/boolean proof constructor.
 * transport is the trusted client's bounded same-origin HTTP reader (or an explicit test fake).
 * Nominality prevents contract confusion; it is not protection from hostile same-origin JS. */
export async function receiveGoalTerminalBrowserOutcome(capture: GoalTerminalBrowserCapture, transport: () => Promise<unknown>, signal: AbortSignal, guard: () => void): Promise<GoalTerminalClientOutcome> {
  const state = captures.get(capture); if (!state) throw Error("Unknown terminal capture.");
  guard(); const wire = await waitGoalTerminal(Promise.resolve().then(() => { guard(); if (signal.aborted) throw Error("Aborted."); return transport(); }), signal, guard);
  const row = goalRecord(wire, ["ok", "result"]); requireValue(row.ok === true);
  const reply = decodeGoalTerminalOutcome(capture.binding, structuredClone(state.intent), row.result); guard();
  if (reply.kind === "uncertain") return { reply, proof: null };
  const proof = Object.freeze({ kind: "goal-terminal-positive" as const });
  proofs.set(proof, { owner: capture.binding.user_id, epoch: capture.epoch, intent: structuredClone(state.intent), reply: structuredClone(reply), consumed: false });
  return { reply: structuredClone(reply), proof };
}
export function inspectGoalTerminalProof(proof: GoalTerminalProof, owner: string, epoch: string, original: GoalCommand): Positive {
  const state = proofs.get(proof); requireValue(state && state.owner === owner && state.epoch === epoch);
  if (!state || assinatura(state.intent) !== assinatura(decodeGoalCommand(original))) throw Error("Terminal proof outside original intention.");
  return structuredClone(state.reply);
}
/** One write attempt per fresh positive response, even if durable acknowledgement fails. */
export function consumeGoalTerminalProof(proof: GoalTerminalProof, owner: string, epoch: string, original: GoalCommand): Positive {
  const reply = inspectGoalTerminalProof(proof, owner, epoch, original), state = proofs.get(proof);
  if (!state || state.consumed) throw Error("Terminal proof already consumed."); state.consumed = true; return reply;
}
