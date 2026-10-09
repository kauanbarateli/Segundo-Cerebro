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
