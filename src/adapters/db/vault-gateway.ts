import "server-only";
import { ErroDeDominio } from "../../core/contracts/base";
import { assertVaultSnapshot } from "../../core/cofre/validation";
import type { VaultInput, VaultResult } from "../../core/cofre/types";
import type { VaultGateway } from "../../core/cofre/use-cases";
import { AuthGuardError } from "../../lib/auth/types";
import { CommitOutcomeUnknown } from "./capture-task-store";
export type VaultRpcName = "vault_snapshot" | "vault_commit" | "vault_receipt";
export type VaultOperationName = VaultInput["command"] | "read.vault";
export type VaultRpc = (name: VaultRpcName, args: { p_user: string; p_session: string; p_operation: VaultOperationName; p_request?: unknown }) => Promise<{ data: unknown; error: { code?: string } | null }>;
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
export class VaultRateLimitError extends Error { constructor() { super("Aguarde antes de repetir a operação do Cofre."); } }
function result(v: unknown): VaultResult { if (!record(v) || Object.keys(v).length !== 2 || typeof v.id !== "string" || !/^[0-9a-f-]{36}$/i.test(v.id) || typeof v.revision !== "string" || !/^(0|[1-9][0-9]*)$/.test(v.revision)) throw new AuthGuardError("unavailable"); return { id: v.id, revision: v.revision }; }
export function createVaultGateway(user: string, session: string, operation: VaultOperationName, rpc: VaultRpc): VaultGateway {
 if (!/^[0-9a-f-]{36}$/i.test(user) || !/^[0-9a-f-]{36}$/i.test(session)) throw new AuthGuardError("unavailable");
 async function call(name: VaultRpcName, request?: unknown, writing = false) { let response; try { response = await rpc(name, { p_user: user, p_session: session, p_operation: operation, ...(request ? { p_request: request } : {}) }); } catch { if (writing) throw new CommitOutcomeUnknown(); throw new AuthGuardError("unavailable"); }
  if (response.error) { const code = response.error.code; if (code === "42501") throw new AuthGuardError("forbidden"); if (code === "PT429") throw new VaultRateLimitError(); if (["23505", "40001", "40P01"].includes(code ?? "")) throw new ErroDeDominio("CONFLICT", "O Cofre mudou. Reabra os dados antes de tentar novamente."); if (["22023", "23514", "23503", "22P02"].includes(code ?? "")) throw new ErroDeDominio("VALIDATION", "A operação cifrada não atende aos limites do Cofre."); if (writing && !code) throw new CommitOutcomeUnknown(); throw new AuthGuardError("unavailable"); } return response.data;
 }
 return { actorId: user, async snapshot() { const value = await call("vault_snapshot"); assertVaultSnapshot(value, user); return structuredClone(value); }, async receipt(request) { if (request.command !== operation) throw new AuthGuardError("forbidden"); const value = await call("vault_receipt", request); return value === null ? null : result(value); }, async commit(commit) { if (commit.request.command !== operation) throw new AuthGuardError("forbidden"); try { const value = await call("vault_commit", commit, true); try { return result(value); } catch { throw new CommitOutcomeUnknown(); } } catch (error) { if (!(error instanceof CommitOutcomeUnknown)) throw error; const receipt = await call("vault_receipt", commit.request); if (receipt === null) throw error; return result(receipt); } } };
}
