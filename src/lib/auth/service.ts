import { subjectHash } from "./flow-state";
import type { AuthServices } from "./ports";
import { LOGIN_FAILURE, RECOVERY_MESSAGE, safeReturnTo, validEmail, validNewPassword } from "./policy";
import type { AuthActionOutcome, AuthActionState, AuthenticatedIdentity } from "./types";

const failure = (message: string, fieldErrors?: AuthActionState["fieldErrors"]): AuthActionOutcome => ({ state: { status: "error", message, ...(fieldErrors ? { fieldErrors } : {}) } });
const limited = (seconds: number): AuthActionOutcome => ({ state: { status: "error", message: "Aguarde um pouco antes de tentar novamente.", retryAfterSeconds: seconds } });
function bound(flow: ReturnType<AuthServices["flows"]["get"]>, identity: AuthenticatedIdentity, kind: string): boolean {
  return !!flow && flow.kind === kind && "userId" in flow && flow.userId === identity.userId && flow.sessionId === identity.sessionId;
}
export async function signIn(services: AuthServices, input: { email: string; password: string; returnTo?: string }): Promise<AuthActionOutcome> {
  const email = input.email.trim().toLowerCase();
  if (!validEmail(email)) return failure("Confira os campos.", { email: "Informe um e-mail válido." });
  if (!input.password || input.password.length > 4096) return failure("Confira os campos.", { password: "Informe sua senha." });
  const limit = await services.limit("login", email);
  if (!limit.allowed) return limited(limit.retryAfterSeconds);
  services.flows.clear("recovery-session"); services.flows.clear("password-updated");
  if (!await services.gateway.signIn(email, input.password)) return failure(LOGIN_FAILURE);
  let identity: AuthenticatedIdentity | null;
  try { identity = await services.gateway.readIdentity(); } catch { identity = null; }
  if (!identity) {
    try { await services.gateway.signOut("local"); } finally { services.flows.clearSessionCookies(); }
    return failure(LOGIN_FAILURE);
  }
  return { redirectTo: identity.mustChangePassword ? "/trocar-senha" : safeReturnTo(input.returnTo) };
}
export async function recoverPassword(services: AuthServices, input: { email: string }): Promise<AuthActionOutcome> {
  const email = input.email.trim().toLowerCase();
  if (!validEmail(email)) return failure("Confira os campos.", { email: "Informe um e-mail válido." });
  const limit = await services.limit("recovery", email);
  if (!limit.allowed) return limited(limit.retryAfterSeconds);
  const nonce = services.randomId();
  services.flows.put({ kind: "recovery-request", nonce, subject: subjectHash(services.stateSecret, "recovery-email", email), expiresAt: services.now() + 3_600_000 });
  const target = new URL("/auth/callback", services.appOrigin); target.searchParams.set("state", nonce);
  // Provider failure/nonexistent account produce the same public result.
  try { await services.gateway.requestRecovery(email, target.href); } catch { /* Never expose provider/account diagnostics. */ }
  return { state: { status: "success", message: RECOVERY_MESSAGE } };
}
export async function exchangeRecovery(services: AuthServices, input: { code: string | null; state: string | null; flowId?: string }): Promise<string> {
  const pending = services.flows.get("recovery-request");
  const invalid = "/recuperar-senha?notice=recovery-invalid";
  if (!pending || pending.kind !== "recovery-request" || !input.code || input.code.length > 4096 || input.state !== pending.nonce || (input.flowId && !/^[A-Za-z0-9_-]{1,200}$/.test(input.flowId))) return invalid;
  services.flows.clear("recovery-request"); services.flows.clear("recovery-session");
  if (!await services.gateway.exchangeCode(input.code, input.flowId)) return invalid;
  let identity: AuthenticatedIdentity | null;
  try { identity = await services.gateway.readIdentity(); } catch { identity = null; }
  if (!identity || !identity.email || subjectHash(services.stateSecret, "recovery-email", identity.email.toLowerCase()) !== pending.subject) {
    try { await services.gateway.signOut("local"); } finally { services.flows.clearSessionCookies(); } return invalid;
  }
  services.flows.put({ kind: "recovery-session", userId: identity.userId, sessionId: identity.sessionId, expiresAt: services.now() + 600_000 });
  return "/redefinir-senha";
}
export async function updatePassword(services: AuthServices, input: { password: string; confirmPassword: string; currentPassword: string }): Promise<AuthActionOutcome> {
  const passwordFailure = (message: string, fieldErrors?: AuthActionState["fieldErrors"]): AuthActionOutcome => ({ state: { status: "error", completionPending: false, message, ...(fieldErrors ? { fieldErrors } : {}) } });
  let identity = await services.gateway.readIdentity();
  if (!identity) return { redirectTo: "/entrar?notice=session-required" };
  let checkpoint = services.flows.get("password-updated");
  const pending = bound(checkpoint, identity, "password-updated");
  let limit: Awaited<ReturnType<AuthServices["limit"]>>;
  try { limit = await services.limit("password", identity.userId, identity); }
  catch { return { state: { status: "error", completionPending: pending, message: "Não foi possível confirmar o limite de tentativas. Tente novamente mais tarde." } }; }
  if (!limit.allowed) return { state: { status: "error", completionPending: pending, message: "Aguarde um pouco antes de tentar novamente.", retryAfterSeconds: limit.retryAfterSeconds } };
  if (!bound(checkpoint, identity, "password-updated")) {
    checkpoint = null;
    if (!validNewPassword(input.password)) return passwordFailure("Confira os campos.", { password: "Use pelo menos 12 caracteres e até 72 bytes UTF-8, sem caracteres de controle." });
    if (input.confirmPassword !== input.password) return passwordFailure("Confira os campos.", { confirmPassword: "As senhas precisam ser iguais." });
    const recovery = bound(services.flows.get("recovery-session"), identity, "recovery-session");
    if (!recovery) {
      if (!identity.email || !input.currentPassword || input.currentPassword.length > 4096) return passwordFailure("Confira sua senha atual e tente novamente.", { currentPassword: "Não foi possível confirmar a senha atual." });
      // Password verification is still a login attempt, even inside a mutation.
      const credentialLimit = await services.limit("login", identity.email.trim().toLowerCase());
      if (!credentialLimit.allowed) return { state: { status: "error", completionPending: false, message: "Aguarde um pouco antes de tentar novamente.", retryAfterSeconds: credentialLimit.retryAfterSeconds } };
      if (!await services.gateway.signIn(identity.email, input.currentPassword)) return passwordFailure("Confira sua senha atual e tente novamente.", { currentPassword: "Não foi possível confirmar a senha atual." });
      const reauthenticated = await services.gateway.readIdentity();
      if (!reauthenticated || reauthenticated.userId !== identity.userId) return passwordFailure(LOGIN_FAILURE);
      identity = reauthenticated;
    }
    if (!await services.gateway.updatePassword(input.password, recovery ? undefined : input.currentPassword)) return passwordFailure("Não foi possível alterar a senha. Tente novamente.");
    // updateUser can refresh session tokens. Bind the checkpoint to the verified current session.
    let updated: AuthenticatedIdentity | null;
    try { updated = await services.gateway.readIdentity(); } catch { updated = null; }
    if (!updated || updated.userId !== identity.userId) {
      services.flows.clearSessionCookies();
      return { redirectTo: "/entrar?notice=password-recheck" };
    }
    identity = updated;
    checkpoint = { kind: "password-updated", userId: identity.userId, sessionId: identity.sessionId, clientId: services.randomId(), expiresAt: services.now() + 900_000 };
    services.flows.put(checkpoint);
    services.flows.clear("recovery-session");
  }
  if (!checkpoint || checkpoint.kind !== "password-updated") return passwordFailure("Não foi possível concluir a alteração.");
  try {
    if (!await services.gateway.signOut("others")) throw new Error("revocation");
    await services.gateway.completePasswordChange(identity, checkpoint.clientId);
  } catch {
    return { state: { status: "error", completionPending: true, message: "A senha foi alterada, mas falta concluir a proteção da conta. Tente novamente para concluir, sem alterar a senha outra vez." } };
  }
  // auth-js may remove local cookies even when global revocation returns an error.
  // At this point password + other sessions + completion are already confirmed.
  let signedOut = false;
  try { signedOut = await services.gateway.signOut("global"); } catch { /* Local cleanup still runs. */ }
  services.flows.clear("password-updated"); services.flows.clearSessionCookies();
  return { redirectTo: signedOut ? "/entrar?notice=password-updated" : "/entrar?notice=password-updated-logout-incomplete" };
}
