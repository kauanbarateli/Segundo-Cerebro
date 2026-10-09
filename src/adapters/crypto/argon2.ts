import type { VaultKdfPort } from "../../core/cofre/crypto";
const cancellations = new Set<() => void>();
export function cancelVaultDerivations() { for (const cancel of [...cancellations]) cancel(); }
/** Each derivation uses a disposable worker: neither its WASM memory nor password survives reuse. */
export const deriveVaultKey: VaultKdfPort = async (password, salt, parameters) => {
 if (typeof Worker === "undefined") throw new Error("Seu navegador precisa oferecer Web Workers para proteger o Cofre.");
 return new Promise((resolve, reject) => {
  const worker = new Worker(new URL("./argon2.worker.ts", import.meta.url), { type: "module" });
  const cancel = () => { finish(); reject(new Error("O Cofre foi bloqueado durante a derivação.")); };
  const timeout = setTimeout(() => { finish(); reject(new Error("A derivação demorou demais. Tente novamente neste dispositivo.")); }, 120000);
  const finish = () => { clearTimeout(timeout); cancellations.delete(cancel); worker.terminate(); };
  cancellations.add(cancel);
  worker.onmessage = event => { finish(); if (event.data instanceof ArrayBuffer && event.data.byteLength === 32) resolve(new Uint8Array(event.data)); else reject(new Error("Não foi possível derivar a chave do Cofre.")); };
  worker.onerror = () => { finish(); reject(new Error("Não foi possível iniciar Argon2id neste navegador.")); };
  worker.postMessage({ password, salt, parameters });
 });
};
