import { assinatura, ErroDeDominio } from "../../core/contracts/base";
import { executeVaultCommand, prepareVaultMutation, type VaultCommit, type VaultGateway } from "../../core/cofre/use-cases";
import type { VaultInput, VaultPort, VaultResult, VaultSnapshot } from "../../core/cofre/types";
/** Demonstration uses the actual cryptographic client and keeps only ciphertext in this port. */
export function createMemoryVaultPort(userId: string, now: () => string): VaultPort {
 let state: VaultSnapshot = { revision: "0", header: null, items: [] }, chain = Promise.resolve(); const receipts = new Map<string, { digest: string; result: VaultResult }>();
 async function digest(request: VaultInput) { const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(assinatura(request)))); return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join(""); }
 const gateway: VaultGateway = { actorId: userId, async snapshot() { return structuredClone(state); }, async receipt(request) { const stored = receipts.get(request.command + ":" + request.input.client_id); if (!stored) return null; if (stored.digest !== await digest(request)) throw new ErroDeDominio("CONFLICT", "client_id usado com outra operação."); return structuredClone(stored.result); }, async commit(commit: VaultCommit) {
  const prior = chain; let release!: () => void; chain = new Promise<void>(resolve => { release = resolve; }); await prior;
  try { const stored = await gateway.receipt(commit.request); if (stored) return stored; const resultState = prepareVaultMutation(state, userId, commit.request, commit.occurred_at), result = { id: resultState.metadata.id, revision: resultState.state.revision }, hashed = await digest(commit.request); state = resultState.state; receipts.set(commit.request.command + ":" + commit.request.input.client_id, { digest: hashed, result }); return structuredClone(result); } finally { release(); }
 } };
 return { snapshot: gateway.snapshot, execute: request => executeVaultCommand(gateway, { clock: { now }, ids: { next: () => crypto.randomUUID() } }, { user_id: userId, canal: "web" }, request) };
}
