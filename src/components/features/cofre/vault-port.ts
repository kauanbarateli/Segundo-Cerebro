"use client";
import type { ClientApplication } from "@/lib/demo/connected-application";
import type { VaultPort, VaultResult } from "@/core/cofre/types";
import { assertVaultSnapshot } from "@/core/cofre/validation";
import { createMemoryVaultPort } from "@/adapters/crypto/memory-vault";
const demoPorts = new WeakMap<object, VaultPort>();
export class VaultClientError extends Error { constructor(readonly code: string, message: string) { super(message); } }
export function vaultPortForApp(app: ClientApplication): VaultPort {
 const key = app.getSnapshot, cached = demoPorts.get(key); if (cached) return cached;
 const port: VaultPort = app.mode === "demo" ? createMemoryVaultPort(app.userId, app.clock.now) : { async snapshot() { const reply = await fetch("/api/vault", { credentials: "same-origin", redirect: "error", cache: "no-store", headers: { Accept: "application/json", "X-Expected-User-ID": app.userId } }); const value: unknown = await reply.json().catch(() => null); if (!reply.ok) throw new VaultClientError(reply.status === 401 ? "UNAUTHENTICATED" : reply.status === 403 ? "FORBIDDEN" : reply.status === 409 ? "SESSION_CHANGED" : "UNAVAILABLE", "Não foi possível abrir o Cofre. Confira sua sessão e tente novamente."); assertVaultSnapshot(value, app.userId); return structuredClone(value); }, async execute(request) { const value = await app.executeDomainCommand(request.command, request.input); if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string" || !("revision" in value) || typeof value.revision !== "string") throw new Error("Não foi possível confirmar a operação do Cofre."); return { id: value.id, revision: value.revision } satisfies VaultResult; } };
 demoPorts.set(key, port); return port;
}
