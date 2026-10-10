import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assinatura, ErroDeDominio } from "../../core/contracts";
import type { AdminAuthPort, AdminIntent, AdminOperation, AdminPort, AdminSnapshot } from "../../core/admin";
import { AdminAuthUncertainError } from "../../core/admin";
import { createPrivilegedClient } from "../../lib/auth/clients";
import type { SupabaseAuthConfig } from "../../lib/auth/config";
import { AuthGuardError, type AuthenticatedIdentity } from "../../lib/auth/types";
import type { Database, Json } from "../../lib/supabase/database.generated";
import { FEATURE_KEYS } from "../../core/access/resolve-access";
type RpcName = "admin_snapshot" | "admin_reserve" | "admin_claim" | "admin_operation_guard" | "admin_transition" | "admin_complete";
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const actions = ["admin.user.create", "admin.user.block", "admin.user.unblock", "admin.user.force_password", "admin.user.role", "admin.user.entitlement"];
const phases = ["reserved", "auth_applied", "revoked", "complete", "needs_reconciliation"];
const timestamp = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v));
function unavailable(): never { throw new AuthGuardError("unavailable"); }
export function parseAdminOperation(value: unknown): AdminOperation {
 if (!record(value) || !uuid(value.operation_id) || !uuid(value.actor_user_id) || !uuid(value.target_user_id) || typeof value.client_id !== "string" || !value.client_id.trim() || value.client_id.length > 200 || !actions.includes(String(value.command)) || !phases.includes(String(value.phase)) || !timestamp(value.created_at) || !timestamp(value.updated_at) || (value.role !== null && value.role !== "user" && value.role !== "master") || (value.feature_key !== null && !FEATURE_KEYS.includes(value.feature_key as typeof FEATURE_KEYS[number])) || (value.allowed !== null && typeof value.allowed !== "boolean")) unavailable();
 if (Object.keys(value).some(key => !["operation_id", "client_id", "actor_user_id", "target_user_id", "command", "phase", "role", "feature_key", "allowed", "created_at", "updated_at"].includes(key))) unavailable();
 return structuredClone(value) as unknown as AdminOperation;
}
export function adminCommitment(config: SupabaseAuthConfig, environment: Record<string, string | undefined> = process.env) {
 const secret = environment.ADMIN_COMMAND_SECRET;
 if (!secret || new TextEncoder().encode(secret).length < 32 || [config.secretKey, config.stateSecret, config.rateLimitSecret].includes(secret)) unavailable();
 return (value: unknown) => createHmac("sha256", secret).update(assinatura(value)).digest("hex");
}
export interface AdminRpc { (name: RpcName, args: { p_actor: string; p_session: string; p_intent?: unknown; p_operation?: string; p_phase?: string; p_execution?: string; p_release?: boolean }): Promise<{ data: unknown; error: { code?: string } | null }> }
export function createAdminPort(actor: AuthenticatedIdentity, rpc: AdminRpc, executionId: string = randomUUID()): AdminPort {
 if (!uuid(executionId)) unavailable();
 async function call(name: RpcName, extra: { p_intent?: AdminIntent; p_operation?: string; p_phase?: string; p_execution?: string; p_release?: boolean } = {}) {
  let result; try { result = await rpc(name, { p_actor: actor.userId, p_session: actor.sessionId, ...extra }); } catch { return unavailable(); }
  if (result.error) { if (result.error.code === "42501") throw new AuthGuardError("forbidden"); if (result.error.code === "23505") throw new ErroDeDominio("CONFLICT", "Esta identificação já pertence a outro envio. Use os dados originais."); if (result.error.code === "40001") throw new ErroDeDominio("CONFLICT", "Há uma operação ou execução pendente. Sem confirmação do término no Auth, a retomada exige revisão operacional."); if (["22023", "23514", "23503"].includes(result.error.code ?? "")) throw new ErroDeDominio("VALIDATION", "A operação não pode ser concluída. Confira o alvo e as salvaguardas administrativas."); return unavailable(); }
  return result.data;
 }
 return {
  async requireMaster() { if (actor.mustChangePassword || actor.role !== "master" || actor.entitlements?.admin === false) throw new AuthGuardError("forbidden"); await call("admin_snapshot"); },
  async snapshot() {
   const value = await call("admin_snapshot"); if (!record(value) || Object.keys(value).some(key => !["users", "audit", "operations"].includes(key)) || !Array.isArray(value.users) || !Array.isArray(value.audit) || !Array.isArray(value.operations)) unavailable();
   for (const user of value.users) {
    if (!record(user) || !uuid(user.user_id) || (user.email !== null && typeof user.email !== "string") || !timestamp(user.created_at) || (user.last_sign_in_at !== null && !timestamp(user.last_sign_in_at)) || !["user", "master"].includes(String(user.role)) || !["active", "blocked"].includes(String(user.status)) || typeof user.must_change_password !== "boolean" || typeof user.admin_allowed !== "boolean" || !Number.isInteger(user.active_sessions) || (user.active_sessions as number) < 0 || (user.pending_operation !== null && !uuid(user.pending_operation)) || Object.keys(user).some(key => !["user_id", "email", "created_at", "last_sign_in_at", "role", "status", "must_change_password", "admin_allowed", "active_sessions", "pending_operation"].includes(key))) unavailable();
   }
   for (const entry of value.audit) if (!record(entry) || !uuid(entry.id) || !uuid(entry.actor_user_id) || !uuid(entry.target_user_id) || !uuid(entry.operation_id) || !actions.includes(String(entry.action)) || !phases.includes(String(entry.phase)) || !timestamp(entry.occurred_at) || Object.keys(entry).some(key => !["id", "actor_user_id", "target_user_id", "operation_id", "action", "phase", "occurred_at"].includes(key))) unavailable();
   value.operations.forEach(parseAdminOperation); return structuredClone(value) as unknown as AdminSnapshot;
  },
  async reserve(intent) { const op = parseAdminOperation(await call("admin_reserve", { p_intent: intent, p_execution: executionId })); if (op.command !== intent.command || op.client_id !== intent.client_id || op.actor_user_id !== actor.userId || (intent.target_user_id && op.target_user_id !== intent.target_user_id)) unavailable(); return op; },
  async claim(operationId) { const op = parseAdminOperation(await call("admin_claim", { p_operation: operationId, p_execution: executionId })); if (op.operation_id !== operationId) unavailable(); return op; },
  async guard(operationId) { const op = parseAdminOperation(await call("admin_operation_guard", { p_operation: operationId, p_execution: executionId })); if (op.operation_id !== operationId) unavailable(); return op; },
  async transition(operationId, phase, releaseExecution = false) { const op = parseAdminOperation(await call("admin_transition", { p_operation: operationId, p_phase: phase, p_execution: executionId, p_release: releaseExecution })); if (op.operation_id !== operationId || (op.phase !== phase && op.phase !== "complete")) unavailable(); return op; },
  async complete(operationId) { const op = parseAdminOperation(await call("admin_complete", { p_operation: operationId, p_execution: executionId })); if (op.operation_id !== operationId || op.phase !== "complete") unavailable(); return op; },
 };
}
export function createAdminAuthPort(port: AdminPort, client: Pick<ReturnType<typeof createPrivilegedClient>, "auth">): AdminAuthPort {
 function mutationFailure(error: { status?: number } | null): never {
  if (error && typeof error.status === "number" && error.status >= 400 && error.status < 500) unavailable();
  throw new AdminAuthUncertainError();
 }
 async function trusted(operation: AdminOperation) {
  const current = await port.guard(operation.operation_id);
  if (current.target_user_id !== operation.target_user_id || current.command !== operation.command || current.phase === "complete") throw new ErroDeDominio("CONFLICT", "O alvo não pertence a uma operação pendente.");
  return current;
 }
 async function read(operation: AdminOperation) {
  const current = await trusted(operation);
  const { data, error } = await client.auth.admin.getUserById(current.target_user_id);
  if (error) { if (error.status === 404 || error.code === "user_not_found") return null; return unavailable(); }
  return data.user;
 }
 async function verify(operation: AdminOperation) { const user = await read(operation); if (!user) return false; if (user.id !== operation.target_user_id || user.app_metadata?.sc_admin_operation !== operation.operation_id) throw new ErroDeDominio("CONFLICT", "A conta encontrada não pertence a esta criação. A operação permanece protegida."); return true; }
 return {
  verifyCreated: verify,
  async create(operation, email, temporaryPassword) {
   if (operation.command !== "admin.user.create") throw new ErroDeDominio("VALIDATION", "Reserva de criação exigida.");
   if (await verify(operation)) return;
   const current = await trusted(operation);
   let response; try { response = await client.auth.admin.createUser({ id: current.target_user_id, email, password: temporaryPassword, email_confirm: true, ban_duration: "876000h", app_metadata: { sc_admin_operation: current.operation_id } }); } catch { throw new AdminAuthUncertainError(); }
   const { data, error } = response;
   if (error || data.user?.id !== operation.target_user_id || data.user.app_metadata?.sc_admin_operation !== operation.operation_id) mutationFailure(error);
  },
  async ban(operation, blocked) {
   if (!["admin.user.create", "admin.user.block", "admin.user.unblock", "admin.user.force_password"].includes(operation.command)) throw new ErroDeDominio("VALIDATION", "Reserva de Auth exigida.");
   let current = await trusted(operation);
   if (operation.command === "admin.user.create") await verify(operation);
   current = await trusted(current);
   let response; try { response = await client.auth.admin.updateUserById(current.target_user_id, { ban_duration: blocked ? "876000h" : "none" }); } catch { throw new AdminAuthUncertainError(); }
   const { data, error } = response;
   if (error || data.user?.id !== operation.target_user_id) mutationFailure(error);
  },
 };
}
export function adminServicesForRequest(config: SupabaseAuthConfig, actor: AuthenticatedIdentity) {
 if (config.supabaseUrl !== "https://rishenjoikgmfubmnfiu.supabase.co") unavailable();
 const client = createClient<Database>(config.supabaseUrl, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, options) => fetch(input, { ...options, cache: "no-store" }) } });
 const rpc: AdminRpc = async (name, args) => {
  const { p_actor, p_session } = args;
  if (name === "admin_snapshot") return client.rpc(name, { p_actor, p_session } satisfies Database["public"]["Functions"]["admin_snapshot"]["Args"]);
  const p_execution = args.p_execution;
  if (typeof p_execution !== "string") unavailable();
  if (name === "admin_reserve") {
   if (args.p_intent === undefined) unavailable();
   return client.rpc(name, { p_actor, p_session, p_execution, p_intent: args.p_intent as Json } satisfies Database["public"]["Functions"]["admin_reserve"]["Args"]);
  }
  const p_operation = args.p_operation;
  if (typeof p_operation !== "string") unavailable();
  switch (name) {
   case "admin_claim": return client.rpc(name, { p_actor, p_session, p_execution, p_operation } satisfies Database["public"]["Functions"]["admin_claim"]["Args"]);
   case "admin_operation_guard": return client.rpc(name, { p_actor, p_session, p_execution, p_operation } satisfies Database["public"]["Functions"]["admin_operation_guard"]["Args"]);
   case "admin_complete": return client.rpc(name, { p_actor, p_session, p_execution, p_operation } satisfies Database["public"]["Functions"]["admin_complete"]["Args"]);
   case "admin_transition": {
    const p_phase = args.p_phase;
    if (typeof p_phase !== "string") unavailable();
    return client.rpc(name, { p_actor, p_session, p_execution, p_operation, p_phase, ...(args.p_release === undefined ? {} : { p_release: args.p_release }) } satisfies Database["public"]["Functions"]["admin_transition"]["Args"]);
   }
  }
 };
 const port = createAdminPort(actor, rpc), auth = createAdminAuthPort(port, client);
 return { port, auth, commitment: adminCommitment(config) };
}
