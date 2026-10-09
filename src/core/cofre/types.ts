export interface VaultEnvelope { iv: string; ciphertext: string }
export interface VaultKdf { algorithm: "argon2id"; memory_kib: 65536; iterations: 3; parallelism: 1; salt: string }
export interface VaultMasterWrap { kdf: VaultKdf; envelope: VaultEnvelope }
export interface VaultHeader { user_id: string; schema_version: 1; master: VaultMasterWrap; recovery: VaultEnvelope; consent_at: string; created_at: string; updated_at: string }
export interface VaultCipherItem { id: string; user_id: string; version: number; envelope: VaultEnvelope; deleted_at: string | null; created_at: string; updated_at: string }
export interface VaultSnapshot { revision: string; header: VaultHeader | null; items: VaultCipherItem[] }
export type VaultOperation = "created" | "master_rewrapped" | "item_created" | "item_updated" | "item_deleted" | "item_restored" | "unlocked" | "unlock_failed" | "locked" | "copied";
export interface VaultMetadata { id: string; user_id: string; operation: VaultOperation; version: number; occurred_at: string }
export interface VaultResult { id: string; revision: string }
export type VaultInput =
 | { command: "vault.create"; input: { client_id: string; expected_revision: string; master: VaultMasterWrap; recovery: VaultEnvelope; consent: true } }
 | { command: "vault.master.rewrap"; input: { client_id: string; expected_revision: string; master: VaultMasterWrap } }
 | { command: "vault.item.create" | "vault.item.update"; input: { client_id: string; expected_revision: string; id: string; version: number; envelope: VaultEnvelope } }
 | { command: "vault.item.delete" | "vault.item.restore"; input: { client_id: string; expected_revision: string; id: string } }
 | { command: "vault.audit"; input: { client_id: string; expected_revision: string; operation: "unlocked" | "unlock_failed" | "locked" | "copied"; item_id?: string } };
export interface VaultPlainItem { title: string; kind: "login" | "note"; username: string; password: string; url: string; note: string }
export interface VaultPort { snapshot(): Promise<VaultSnapshot>; execute(request: VaultInput): Promise<VaultResult> }
