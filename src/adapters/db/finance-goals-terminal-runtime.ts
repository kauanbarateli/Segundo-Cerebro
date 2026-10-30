import "server-only";
import { ErroDeDominio } from "../../core/contracts/base";
import { goalRecord, goalUuid } from "../../core/financeiro/goals/goal-validation";
import { parseGoalJson } from "../../lib/finance-goals-json";
import { GOAL_HTTP_LIMITS } from "../../lib/finance-goals-http-contract";
import { GOAL_TERMINAL_ENVELOPE_BYTES, GOAL_TERMINAL_REPLY_JSON_LIMITS, type GoalTerminalReply } from "../../lib/finance-goals-terminal-contract";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { isTrustedHostedDatabaseOrigin } from "../../lib/auth/database-origin-server";
import { assertFeature } from "../../lib/auth/policy";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import { authDeploymentAllowed } from "../../lib/environment/application-destination";
import { CommitOutcomeUnknown } from "./capture-task-store";
import { FinanceRateLimitError } from "./finance-gateway";
import { decodeGoalTerminalReply, goalTerminalRpcRequest, type CapturedGoalTerminalAttempt } from "./finance-goals-terminal-canonical";

type Operation = "status" | "settle";
const rpcNames = Object.freeze({ status: "finance_goal_attempt_status", settle: "finance_goal_attempt_settle" });
const deadlineMs = 15_000;
function unavailable(writing: boolean): never { if (writing) throw new CommitOutcomeUnknown(); throw new AuthGuardError("unavailable"); }
function sqlFailure(value: unknown, writing: boolean): never {
  let code: unknown;
  try { code = goalRecord(value, ["code"], ["message", "details", "hint"]).code; } catch { return unavailable(writing); }
  if (code === "42501") throw new AuthGuardError("forbidden");
  if (code === "PT429") throw new FinanceRateLimitError();
  if (code === "23505" || code === "40001" || code === "40P01") throw new ErroDeDominio("CONFLICT", "O estado desta tentativa mudou. Consulte o mesmo conteúdo novamente.");
  // Request shape is already canonicalized by this server. A schema/codec/
  // result failure is not a caller validation error, nor proof of non-commit.
  return unavailable(writing);
}
/** A fixed actor, origin and two RPC names. No new-operation feature flag,
 * receipt search, financial commit, fallback, automatic retry or diagnostics. */
export function financeGoalsTerminalForRequest(config: SupabaseAuthConfig, actor: AuthenticatedIdentity, transport: typeof fetch = fetch, requestSignal?: AbortSignal) {
  if (!isTrustedHostedDatabaseOrigin(config) || !authDeploymentAllowed(process.env, config)) throw new AuthGuardError("unavailable");
  if (actor.mustChangePassword) throw new AuthGuardError("forbidden"); assertFeature(actor, "financeiro");
  goalUuid(actor.userId); goalUuid(actor.sessionId);
  const actorId = actor.userId, sessionId = actor.sessionId, origin = config.supabaseUrl, key = config.secretKey;
  async function call(operation: Operation, token: CapturedGoalTerminalAttempt): Promise<GoalTerminalReply> {
    const writing = operation === "settle", envelope = goalTerminalRpcRequest(token);
    if (token.binding.user_id !== actorId) throw new AuthGuardError("forbidden");
    const payload = JSON.stringify({ p_user: actorId, p_session: sessionId, p_request: envelope });
    // Fixed UUID/argument keys add less than 256 bytes to the bounded envelope.
    if (Buffer.byteLength(payload, "utf8") > GOAL_TERMINAL_ENVELOPE_BYTES + 256 || requestSignal?.aborted) return unavailable(writing);
    const url = new URL(`/rest/v1/rpc/${rpcNames[operation]}`, origin), controller = new AbortController(), deadline = Date.now() + deadlineMs;
    let failed = false, naturalEof = false, reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let pendingRead: Promise<ReadableStreamReadResult<Uint8Array>> | null = null, cancellation: Promise<void> | null = null;
    let rejectStopped!: (error: Error) => void;
    const stopped = new Promise<never>((_, reject) => { rejectStopped = reject; });
    void stopped.catch(() => undefined);
    const cancel = () => { if (reader && cancellation === null) { try { cancellation = reader.cancel().catch(() => undefined); } catch { cancellation = Promise.resolve(); } } };
    const stop = () => { if (!failed) { failed = true; controller.abort(); rejectStopped(writing ? new CommitOutcomeUnknown() : new AuthGuardError("unavailable")); cancel(); } };
    const check = () => { if (failed || requestSignal?.aborted || Date.now() >= deadline) { stop(); return unavailable(writing); } };
    const timer = setTimeout(stop, deadlineMs); requestSignal?.addEventListener("abort", stop, { once: true });
    try {
      check();
      const pendingFetch = transport(url, { method: "POST", redirect: "error", cache: "no-store", signal: controller.signal, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json", "User-Agent": "SegundoCerebro-FinanceGoalTerminal/2" }, body: payload });
      // A transport mock/implementation that ignores AbortSignal must not keep
      // a late response body alive after the caller's fixed deadline.
      void pendingFetch.then(late => { if (failed) { try { void late.body?.cancel().catch(() => undefined); } catch { /* no private diagnostics */ } } }, () => undefined);
      const response = await Promise.race([pendingFetch, stopped]); check();
      reader = response.body?.getReader() ?? null; if (!reader) return unavailable(writing);
      if (response.redirected || (response.url !== "" && response.url !== url.href) || !/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i.test(response.headers.get("content-type")?.trim() ?? "")) return unavailable(writing);
      const chunks: Uint8Array[] = []; let length = 0;
      while (true) {
        pendingRead = reader.read(); const next = await Promise.race([pendingRead, stopped]); pendingRead = null; check();
        if (next.done) { naturalEof = true; break; }
        length += next.value.byteLength; if (length > GOAL_HTTP_LIMITS.innerDtoBytes) return unavailable(writing);
        if (next.value.byteLength) chunks.push(Uint8Array.from(next.value));
      }
      const bytes = Buffer.concat(chunks);
      if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return unavailable(writing);
      let decoded: unknown;
      try { decoded = parseGoalJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes), GOAL_TERMINAL_REPLY_JSON_LIMITS); } catch { return unavailable(writing); }
      check(); if (!response.ok) return sqlFailure(decoded, writing); if (response.status !== 200) return unavailable(writing);
      // Do not leak a malformed upstream DTO as HTTP400 to the user's request.
      try { const reply = decodeGoalTerminalReply(token, decoded); check(); return reply; } catch { return unavailable(writing); }
    } catch (error) {
      if (error instanceof CommitOutcomeUnknown || error instanceof AuthGuardError || error instanceof FinanceRateLimitError || (error instanceof ErroDeDominio && error.code === "CONFLICT")) throw error;
      return unavailable(writing);
    } finally {
      clearTimeout(timer); requestSignal?.removeEventListener("abort", stop);
      if (!naturalEof) cancel();
      const release = () => { try { reader?.releaseLock(); } catch { /* release again after an outstanding read */ } };
      release(); if (pendingRead) void pendingRead.then(release, release);
    }
  }
  return Object.freeze({ status: (token: CapturedGoalTerminalAttempt) => call("status", token), settle: (token: CapturedGoalTerminalAttempt) => call("settle", token) });
}
