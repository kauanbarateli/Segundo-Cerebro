/** Presentation-only: turns a failed Cofre action into a message that names the real cause. */
export type VaultFailureContext = "unlock" | "create" | "change" | "recover";

/** The local decryption refused the typed secret; never raised for network or server failures. */
export class VaultPasswordError extends Error {
  constructor(readonly context: "unlock" | "change" | "recover") { super("vault-password"); }
}

// Messages written by this module's own validations; they already say what to fix.
const OWN_MESSAGE = /Cofre mudou|confirmação|kit|Kit|metade|Metade|Use ao menos|Preencha|limite|byte a byte/;
// Chrome/Edge, Safari and Firefox wording for a fetch that never reached the server.
const FETCH_FAILURE = /failed to fetch|load failed|networkerror|network request failed/i;

function isConnectionFailure(failure: unknown) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (failure instanceof DOMException && (failure.name === "AbortError" || failure.name === "TimeoutError")) return true;
  return failure instanceof TypeError && FETCH_FAILURE.test(failure.message);
}

export function vaultFailureMessage(failure: unknown, context: VaultFailureContext): string {
  if (failure instanceof VaultPasswordError) {
    if (failure.context === "recover") return "Não foi possível recuperar o Cofre. Confira as duas metades do kit e a nova senha.";
    if (failure.context === "change") return "A senha mestra atual está incorreta. Confira e tente de novo.";
    return "A senha mestra está incorreta. Confira e tente de novo.";
  }
  if (isConnectionFailure(failure)) return "Sem conexão com o servidor. Verifique a internet e tente de novo. O Cofre não foi alterado.";
  if (failure instanceof Error && OWN_MESSAGE.test(failure.message)) return failure.message;
  const code = failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";
  if (["UNAVAILABLE", "COMMIT_UNKNOWN"].includes(code)) return "O servidor não respondeu agora. Aguarde um instante e tente de novo.";
  return context === "recover" ? "Não foi possível recuperar o Cofre. Confira as duas metades do kit." : "Não foi possível concluir. Tente de novo.";
}
