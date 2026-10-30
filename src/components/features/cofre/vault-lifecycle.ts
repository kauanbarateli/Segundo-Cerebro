"use client";
export function watchVaultActivity(lock: () => void, timeoutMs = 300000, blurLock: () => void = lock) {
 let timer: ReturnType<typeof setTimeout>; const reset = () => { clearTimeout(timer); timer = setTimeout(lock, timeoutMs); }, hidden = () => { if (document.visibilityState === "hidden") lock(); };
 const events = ["pointerdown", "keydown", "input", "scroll", "touchstart"];
 for (const event of events) window.addEventListener(event, reset, { passive: true }); document.addEventListener("visibilitychange", hidden); window.addEventListener("blur", blurLock); reset();
 return () => { clearTimeout(timer); for (const event of events) window.removeEventListener(event, reset); document.removeEventListener("visibilitychange", hidden); window.removeEventListener("blur", blurLock); };
}
/** Logout is synchronous, before journal cleanup or navigation can settle. */
export function watchVaultLogout(eventName: string, userId: string, lock: () => void) {
 const logout = (event: Event) => { const detail: unknown = (event as CustomEvent<unknown>).detail; if (detail && typeof detail === "object" && "userId" in detail && detail.userId === userId) lock(); };
 window.addEventListener(eventName, logout);
 return () => window.removeEventListener(eventName, logout);
}
export function createVaultClipboard(clipboard: Pick<Clipboard, "writeText">, failed: () => void) {
 let timer: ReturnType<typeof setTimeout> | undefined, generation = 0, pendingCopies = 0, ownsClipboard = false, chain = Promise.resolve();
 const invalidate = () => { clearTimeout(timer); timer = undefined; return ++generation; };
 const enqueue = (operation: () => Promise<void>) => { const result = chain.then(operation); chain = result.catch(() => undefined); return result; };
 const erase = async () => { try { await clipboard.writeText(""); ownsClipboard = false; } catch { failed(); } };
 const clear = () => { invalidate(); return enqueue(erase); };
 return {
  copy(value: string) {
   const current = invalidate(); pendingCopies++;
   // Ordered writes prevent a delayed older copy/clear from overwriting a newer
   // copy. Cancellation also expires copies that have not started writing yet.
   return enqueue(async () => { try {
    if (current !== generation) return;
    try { await clipboard.writeText(value); ownsClipboard = true; } catch (error) { if (ownsClipboard) await erase(); throw error; }
    if (current !== generation) { await erase(); return; }
    timer = setTimeout(() => { if (current === generation) void clear(); }, 30000);
   } finally { pendingCopies--; } });
  },
  clear,
  dispose() { if (pendingCopies || ownsClipboard || timer) void clear(); else invalidate(); },
 };
}

// --- Failure presentation: names the real cause of a failed Cofre action (no secrets, no I/O). ---
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
