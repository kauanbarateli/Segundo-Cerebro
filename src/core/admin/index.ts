import { exigir } from "../contracts/base";
import { FEATURE_KEYS, type FeatureKey } from "../access/resolve-access";
export type AdminAction = "admin.user.create" | "admin.user.block" | "admin.user.unblock" | "admin.user.force_password" | "admin.user.role" | "admin.user.entitlement";
export type AdminPhase = "reserved" | "auth_applied" | "revoked" | "complete" | "needs_reconciliation";
export interface AdminUserMetadata { user_id: string; email: string | null; created_at: string; last_sign_in_at: string | null; role: "user" | "master"; status: "active" | "blocked"; must_change_password: boolean; admin_allowed: boolean; active_sessions: number; pending_operation: string | null }
export interface AdminAuditEntry { id: string; actor_user_id: string; target_user_id: string; operation_id: string; action: AdminAction; phase: AdminPhase; occurred_at: string }
export interface AdminOperation { operation_id: string; client_id: string; actor_user_id: string; target_user_id: string; command: AdminAction; phase: AdminPhase; role: "user" | "master" | null; feature_key: FeatureKey | null; allowed: boolean | null; created_at: string; updated_at: string }
export interface AdminSnapshot { users: AdminUserMetadata[]; audit: AdminAuditEntry[]; operations: AdminOperation[] }
export type AdminCommand =
 | { command: "admin.user.create"; input: { client_id: string; email: string; temporary_password: string } }
 | { command: "admin.user.block" | "admin.user.unblock" | "admin.user.force_password"; input: { client_id: string; target_user_id: string } }
 | { command: "admin.user.role"; input: { client_id: string; target_user_id: string; role: "user" | "master" } }
 | { command: "admin.user.entitlement"; input: { client_id: string; target_user_id: string; feature_key: FeatureKey; allowed: boolean } }
 | { command: "admin.operation.reconcile"; input: { client_id: string; operation_id: string } };
/** Credentials and e-mail never cross this persistence boundary. */
export interface AdminIntent { command: AdminAction; client_id: string; commitment: string; target_user_id?: string; role?: "user" | "master"; feature_key?: FeatureKey; allowed?: boolean }
export interface AdminPort {
 requireMaster(): Promise<void>; snapshot(): Promise<AdminSnapshot>; reserve(intent: AdminIntent): Promise<AdminOperation>;
 claim(operationId: string): Promise<AdminOperation>; guard(operationId: string): Promise<AdminOperation>; transition(operationId: string, phase: "auth_applied" | "revoked" | "needs_reconciliation", releaseExecution?: boolean): Promise<AdminOperation>;
 complete(operationId: string): Promise<AdminOperation>;
}
/** A rejected transport does not prove that the external Auth mutation has ended. */
export class AdminAuthUncertainError extends Error {
 constructor() { super("O Auth não confirmou o término da operação. A conta continua bloqueada até revisão operacional."); this.name = "AdminAuthUncertainError"; }
}
export interface AdminAuthPort {
 create(operation: AdminOperation, email: string, temporaryPassword: string): Promise<void>;
 verifyCreated(operation: AdminOperation): Promise<boolean>;
 ban(operation: AdminOperation, blocked: boolean): Promise<void>;
}
export interface AdminMasterEligibility {
 role: "user" | "master"; status: "active" | "blocked"; must_change_password: boolean;
 admin_allowed: boolean; auth_banned: boolean; deleted: boolean; anonymous: boolean;
}
/** SQL enforces the same predicate while holding the global master-set lock. */
export function usableMaster(user: AdminMasterEligibility): boolean {
 return user.role === "master" && user.status === "active" && !user.must_change_password && user.admin_allowed && !user.auth_banned && !user.deleted && !user.anonymous;
}
export function preserveUsableMaster(target: AdminMasterEligibility, others: readonly AdminMasterEligibility[]): void {
 exigir(!usableMaster(target) || others.some(usableMaster), "O último master com acesso utilizável precisa ser preservado.");
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function only(v: Record<string, unknown>, keys: string[]) { exigir(Object.keys(v).every(key => keys.includes(key)), "Campos administrativos não permitidos."); }
export function decodeAdminCommand(value: unknown): AdminCommand {
 exigir(object(value), "Comando inválido."); only(value, ["command", "input"]); exigir(object(value.input), "Informe a operação.");
 const input = value.input, command = value.command;
 exigir(typeof input.client_id === "string" && input.client_id.trim().length > 0 && input.client_id.length <= 200, "Informe client_id.");
 if (command === "admin.user.create") {
  only(input, ["client_id", "email", "temporary_password"]);
  exigir(typeof input.email === "string" && input.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email), "Informe um e-mail válido.");
  exigir(typeof input.temporary_password === "string" && [...input.temporary_password].length >= 12 && new TextEncoder().encode(input.temporary_password).length <= 72 && !/[\u0000-\u001f\u007f]/.test(input.temporary_password), "Use uma senha provisória entre 12 caracteres e 72 bytes.");
 } else if (command === "admin.operation.reconcile") { only(input, ["client_id", "operation_id"]); exigir(typeof input.operation_id === "string" && UUID.test(input.operation_id), "Operação inválida."); }
 else {
  exigir(["admin.user.block", "admin.user.unblock", "admin.user.force_password", "admin.user.role", "admin.user.entitlement"].includes(String(command)), "Comando administrativo inválido.");
  only(input, ["client_id", "target_user_id", ...(command === "admin.user.role" ? ["role"] : command === "admin.user.entitlement" ? ["feature_key", "allowed"] : [])]);
  exigir(typeof input.target_user_id === "string" && UUID.test(input.target_user_id), "Usuário alvo inválido.");
  if (command === "admin.user.role") exigir(["user", "master"].includes(String(input.role)), "Papel inválido.");
  if (command === "admin.user.entitlement") exigir(typeof input.allowed === "boolean" && FEATURE_KEYS.includes(input.feature_key as FeatureKey), "Funcionalidade inválida.");
 }
 return structuredClone(value) as AdminCommand;
}
export async function executeAdminCommand(port: AdminPort, auth: AdminAuthPort, commit: (value: unknown) => string, value: unknown): Promise<AdminOperation> {
 await port.requireMaster();
 const request = decodeAdminCommand(value);
 let operation: AdminOperation;
 if (request.command === "admin.operation.reconcile") operation = await port.claim(request.input.operation_id);
 else {
  const { client_id } = request.input;
  const intent: AdminIntent = { command: request.command, client_id, commitment: commit(request) };
  if ("target_user_id" in request.input) intent.target_user_id = request.input.target_user_id;
  if (request.command === "admin.user.role") intent.role = request.input.role;
  if (request.command === "admin.user.entitlement") { intent.feature_key = request.input.feature_key; intent.allowed = request.input.allowed; }
  operation = await port.reserve(intent);
 }
 if (operation.phase === "complete") return operation;
 try {
  operation = await port.guard(operation.operation_id);
  if (operation.command === "admin.user.create") {
   if (request.command === "admin.user.create") await auth.create(operation, request.input.email, request.input.temporary_password);
   else exigir(await auth.verifyCreated(operation), "A criação ainda precisa do envio original com a senha provisória. A conta continua protegida.");
  }
  if (operation.command === "admin.user.block" || operation.command === "admin.user.force_password") await auth.ban(operation, true);
  operation = await port.transition(operation.operation_id, "auth_applied");
  operation = await port.transition(operation.operation_id, "revoked");
  if (operation.command === "admin.user.create" || operation.command === "admin.user.unblock" || operation.command === "admin.user.force_password") {
   operation = await port.guard(operation.operation_id); await auth.ban(operation, false);
  }
  return await port.complete(operation.operation_id);
 } catch (error) {
  // Never compensate by releasing moderation. An ambiguous Auth effect needs reconciliation.
  try { await port.transition(operation.operation_id, "needs_reconciliation", !(error instanceof AdminAuthUncertainError)); } catch { /* Existing fence/claim remains; current permission may have been revoked. */ }
  throw error;
 }
}
