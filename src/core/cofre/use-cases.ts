import { ErroDeDominio, exigir, naoEncontrado, type ContextoDeEscrita, type DependenciasDeDominio } from "../contracts/base";
import type { VaultHeader, VaultInput, VaultMetadata, VaultResult, VaultSnapshot } from "./types";
import { assertVaultSnapshot, decodeVaultInput } from "./validation";
export interface VaultCommit { request: VaultInput; metadata: VaultMetadata; event_id: string; occurred_at: string; canal: ContextoDeEscrita["canal"] }
export interface VaultGateway { readonly actorId: string; snapshot(): Promise<VaultSnapshot>; receipt(request: VaultInput): Promise<VaultResult | null>; commit(request: VaultCommit): Promise<VaultResult> }
export function prepareVaultMutation(snapshot: VaultSnapshot, user: string, request: VaultInput, stamp: string): { state: VaultSnapshot; metadata: VaultMetadata } {
 assertVaultSnapshot(snapshot, user); const state = structuredClone(snapshot), input = request.input;
 if (state.revision !== input.expected_revision) throw new ErroDeDominio("CONFLICT", "O Cofre mudou em outra sessão. Reabra os dados antes de tentar novamente.");
 let id = user, version = 1, operation: VaultMetadata["operation"];
 switch (request.command) {
  case "vault.create": exigir(state.header === null, "Este Cofre já foi criado."); state.header = { user_id: user, schema_version: 1, master: request.input.master, recovery: request.input.recovery, consent_at: stamp, created_at: stamp, updated_at: stamp }; operation = "created"; break;
  case "vault.master.rewrap": exigir(state.header, "Crie o Cofre primeiro."); state.header.master = structuredClone(request.input.master); state.header.updated_at = stamp; operation = "master_rewrapped"; break;
  case "vault.item.create": exigir(state.header && state.items.length < 500, "Crie o Cofre e mantenha até 500 itens."); exigir(request.input.version === 1 && !state.items.some(row => row.id === request.input.id), "Item ou versão inicial inválidos."); id = request.input.id; version = 1; state.items.push({ id, user_id: user, version, envelope: structuredClone(request.input.envelope), created_at: stamp, updated_at: stamp, deleted_at: null }); operation = "item_created"; break;
  case "vault.item.update": { const row = state.items.find(item => item.id === request.input.id); if (!row || row.deleted_at !== null) naoEncontrado(); exigir(request.input.version === row.version + 1, "A versão do item mudou. Reabra o item."); id = row.id; version = request.input.version; row.version = version; row.envelope = structuredClone(request.input.envelope); row.updated_at = stamp; operation = "item_updated"; break; }
  case "vault.item.delete": case "vault.item.restore": { const row = state.items.find(item => item.id === request.input.id); if (!row) naoEncontrado(); const restoring = request.command === "vault.item.restore"; exigir(restoring ? row.deleted_at !== null : row.deleted_at === null, "O estado do item mudou. Reabra a lista."); id = row.id; version = row.version; row.deleted_at = restoring ? null : stamp; row.updated_at = stamp; operation = restoring ? "item_restored" : "item_deleted"; break; }
  case "vault.audit": exigir(state.header, "Crie o Cofre primeiro."); operation = request.input.operation; if (request.input.item_id) { const item = state.items.find(row => row.id === request.input.item_id && row.deleted_at === null); if (!item) naoEncontrado(); id = item.id; version = item.version; } break;
 }
 state.revision = String(BigInt(state.revision) + 1n); assertVaultSnapshot(state, user); return { state, metadata: { id, user_id: user, operation, version, occurred_at: stamp } };
}
export async function executeVaultCommand(gateway: VaultGateway, deps: DependenciasDeDominio, context: ContextoDeEscrita, request: VaultInput): Promise<VaultResult> {
 request = decodeVaultInput(request); exigir(context.user_id === gateway.actorId && ["web", "api", "cron"].includes(context.canal), "Operação fora da conta.");
 // Receipt lookup is itself authenticated; it never bypasses a fresh actor/entitlement check.
 const receipt = await gateway.receipt(request); if (receipt) return receipt;
 const snapshot = await gateway.snapshot(), occurred_at = deps.clock.now(); const { metadata } = prepareVaultMutation(snapshot, context.user_id, request, occurred_at);
 return gateway.commit({ request, metadata, event_id: deps.ids.next(), occurred_at, canal: context.canal });
}
export function vaultHeaderForClient(value: VaultHeader | null) { return value === null ? null : structuredClone(value); }
