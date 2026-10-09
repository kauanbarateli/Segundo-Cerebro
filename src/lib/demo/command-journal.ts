import { assinatura } from "../../core/contracts/base";
import { validCaptureAttachments } from "../../core/capturas";
import { DOMAIN_COMMAND_FIELDS, validDomainCommandInput } from "./client-command-specs";

const PREFIX = "segundo-cerebro:commands:v1:";
const VERSION = 1;
const BODY_LIMIT = 256 * 1024;
const KNOWLEDGE_BODY_LIMIT = 600 * 1024;
const RECORD_LIMIT = KNOWLEDGE_BODY_LIMIT * 2 + 2048;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));
const id = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 200;
const commands = ["capture.create", "capture.update", "capture.archive", "capture.unarchive", "capture.delete", "capture.restore", "capture.convert", "capture.organize", "task.create", "task.update", "task.status", "task.delete", "task.restore", ...Object.keys(DOMAIN_COMMAND_FIELDS)];
const captureFields = ["type", "title", "content", "category_id", "project_id", "linked_capture_ids", "attachments"];
const taskFields = ["title", "description", "category_id", "project_id", "status", "priority", "due_at", "scheduled_start_at", "scheduled_end_at", "all_day", "estimated_minutes", "board_position"];

export class JournalError extends Error {
  constructor(public readonly code: "UNAVAILABLE" | "CORRUPT" | "SESSION_CHANGED" | "PENDING" | "INVALID") {
    super(code === "SESSION_CHANGED" ? "A sessão local mudou. Recarregue a página para continuar."
      : code === "CORRUPT" ? "O registro local de envio não pôde ser lido com segurança. Nenhuma nova alteração será enviada. Verifique o armazenamento ou saia da conta para limpar este registro."
      : code === "PENDING" ? "Confirme o envio pendente antes de salvar outra alteração."
      : code === "INVALID" ? "O envio contém dados não permitidos ou excede o tamanho disponível."
      : "Não foi possível proteger o envio neste navegador. Permita o armazenamento local e use um navegador atualizado antes de tentar novamente. Nenhuma nova alteração será enviada sem essa proteção.");
    this.name = "JournalError";
  }
}
export interface JournalEnvironment {
  storage: Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;
  lock<T>(name: string, signal: AbortSignal, operation: () => Promise<T>): Promise<T>;
  subscribe(listener: () => void): () => void;
  randomId(): string;
}
export interface JournalEntry { version: 1; userId: string; epoch: string; command: string; clientId: string; body: string }
export interface JournalSettlement { version: 1; userId: string; epoch: string; command: string; clientId: string; status: "confirmed" | "rejected"; entityId: string | null }
export interface JournalSnapshot { entries: JournalEntry[]; settlement: JournalSettlement | null; settlements: JournalSettlement[] }

/** Storage carries only the domain DTO, never headers, cookies, credentials or upload URLs. */
function validInput(command: string, input: unknown): input is Record<string, unknown> {
  if (Object.hasOwn(DOMAIN_COMMAND_FIELDS, command)) return validDomainCommandInput(command, input);
  if (!commands.includes(command) || !object(input) || !id(input.client_id)) return false;
  const fields = command.startsWith("capture.") ? captureFields : taskFields;
  let body = input;
  if (command.endsWith(".create")) { if (!exact(input, [...fields, "client_id", "status"])) return false; }
  else if (command.endsWith(".update")) {
    if (!exact(input, ["id", "client_id", "patch"]) || !id(input.id) || !object(input.patch) || !exact(input.patch, fields)) return false;
    body = input.patch;
  } else {
    const identity = command === "capture.convert" ? "capture_id" : "id";
    if (!id(input[identity]) || !exact(input, [identity, "client_id", ...(command === "task.status" ? ["status"] : command === "capture.organize" ? ["destination"] : [])])) return false;
    if (command === "task.status" && !["todo", "in_progress", "done", "archived"].includes(String(input.status))) return false;
    if (command === "capture.organize" && input.destination !== "inbox") return false;
  }
  for (const [key, value] of Object.entries(body)) {
    if (key === "patch") continue;
    if (key === "attachments") { if (!validCaptureAttachments(value)) return false; }
    else if (key === "linked_capture_ids") { if (!Array.isArray(value) || value.length > 1000 || !value.every(id)) return false; }
    else if (value !== null && !["string", "number", "boolean"].includes(typeof value)) return false;
    else if (typeof value === "number" && !Number.isFinite(value)) return false;
    else if (typeof value === "string" && value.length > 30000) return false;
  }
  return true;
}
export function journalBody(command: string, input: unknown): string {
  if (!validInput(command, input)) throw new JournalError("INVALID");
  const body = JSON.stringify({ command, input });
  if (new TextEncoder().encode(body).byteLength > (command.startsWith("knowledge.") ? KNOWLEDGE_BODY_LIMIT : BODY_LIMIT)) throw new JournalError("INVALID");
  return body;
}
export function journalInput(entry: JournalEntry): Record<string, unknown> { return (JSON.parse(entry.body) as { input: Record<string, unknown> }).input; }

/** Per-command keys + a per-user Web Lock make admission and deletion atomic across tabs. */
export class CommandJournal {
  private epoch: string | null = null;
  private readonly base: string;
  constructor(readonly userId: string, private readonly environment: JournalEnvironment) {
    if (!UUID.test(userId)) throw new JournalError("INVALID");
    this.base = `${PREFIX}${userId}:`;
  }
  private storage<T>(operation: () => T): T {
    try { return operation(); } catch (error) { if (error instanceof JournalError) throw error; throw new JournalError("UNAVAILABLE"); }
  }
  private get(key: string) { return this.storage(() => this.environment.storage.getItem(key)); }
  private put(key: string, value: string) {
    this.storage(() => this.environment.storage.setItem(key, value));
    if (this.get(key) !== value) throw new JournalError("UNAVAILABLE");
  }
  private remove(key: string) {
    this.storage(() => this.environment.storage.removeItem(key));
    if (this.get(key) !== null) throw new JournalError("UNAVAILABLE");
  }
  private parse(raw: string, limit = RECORD_LIMIT): Record<string, unknown> {
    try { if (raw.length > limit) throw new Error(); const value: unknown = JSON.parse(raw); if (!object(value)) throw new Error(); return value; }
    catch { throw new JournalError("CORRUPT"); }
  }
  private gate() {
    const raw = this.get(`${this.base}epoch`);
    if (raw === null) return null;
    const gate = this.parse(raw, 1024);
    if (!exact(gate, ["version", "userId", "epoch"]) || gate.version !== VERSION || gate.userId !== this.userId || !id(gate.epoch)) throw new JournalError("CORRUPT");
    return gate.epoch;
  }
  private check() { if (!this.epoch || this.gate() !== this.epoch) throw new JournalError("SESSION_CHANGED"); }
  assertSession() { this.check(); }
  private keys(bounded = true) {
    return this.storage(() => {
      const keys: string[] = [];
      for (let index = 0; index < this.environment.storage.length; index++) {
        const key = this.environment.storage.key(index);
        if (key?.startsWith(`${this.base}entry:`)) keys.push(key);
      }
      if (bounded && keys.length > 16) throw new JournalError("CORRUPT");
      return keys.sort();
    });
  }
  private entry(raw: string, key: string): JournalEntry {
    const value = this.parse(raw);
    if (!exact(value, ["version", "userId", "epoch", "command", "clientId", "body"]) || value.version !== VERSION || value.userId !== this.userId || !id(value.epoch) || !id(value.clientId) || typeof value.command !== "string" || typeof value.body !== "string" || key !== this.entryKey(value.clientId)) throw new JournalError("CORRUPT");
    try {
      const body: unknown = JSON.parse(value.body);
      if (!object(body) || !exact(body, ["command", "input"]) || body.command !== value.command || !validInput(value.command, body.input) || body.input.client_id !== value.clientId || journalBody(value.command, body.input) !== value.body) throw new Error();
    } catch { throw new JournalError("CORRUPT"); }
    return value as unknown as JournalEntry;
  }
  private entryKey(clientId: string) { return `${this.base}entry:${encodeURIComponent(clientId)}`; }
  private settlements(): JournalSettlement[] {
    const raw = this.get(`${this.base}settled`);
    if (raw === null) return [];
    const envelope = this.parse(raw, 32 * 2048);
    if (!exact(envelope, ["version", "userId", "epoch", "items"]) || envelope.version !== VERSION || envelope.userId !== this.userId || !id(envelope.epoch) || !Array.isArray(envelope.items) || envelope.items.length > 32) throw new JournalError("CORRUPT");
    if (envelope.epoch !== this.epoch) { this.remove(`${this.base}settled`); return []; }
    for (const value of envelope.items) {
      if (!object(value) || !exact(value, ["version", "userId", "epoch", "command", "clientId", "status", "entityId"]) || value.version !== VERSION || value.userId !== this.userId || value.epoch !== this.epoch || !id(value.clientId) || !commands.includes(String(value.command)) || !["confirmed", "rejected"].includes(String(value.status)) || !(value.entityId === null || id(value.entityId))) throw new JournalError("CORRUPT");
    }
    return envelope.items as unknown as JournalSettlement[];
  }
  async exclusive<T>(operation: () => Promise<T>, timeoutMs = 25_000): Promise<T> {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    let entered = false;
    try { return await this.environment.lock(`${this.base}lock`, controller.signal, () => { entered = true; return operation(); }); }
    catch (error) { if (error instanceof JournalError) throw error; if (!entered || controller.signal.aborted) throw new JournalError("UNAVAILABLE"); throw error; }
    finally { clearTimeout(timer); }
  }
  async open(): Promise<JournalSnapshot> {
    return this.exclusive(async () => {
      const gate = this.gate();
      if (this.epoch && gate !== this.epoch) throw new JournalError("SESSION_CHANGED");
      if (!gate) {
        // A missing epoch with existing data is corruption, not an empty installation.
        if (this.keys().length || this.get(`${this.base}settled`)) throw new JournalError("CORRUPT");
        const nextEpoch = this.environment.randomId();
        this.put(`${this.base}epoch`, JSON.stringify({ version: VERSION, userId: this.userId, epoch: nextEpoch }));
        this.epoch = nextEpoch;
      } else this.epoch = gate;
      return this.snapshot();
    });
  }
  snapshot(): JournalSnapshot {
    this.check();
    const entries: JournalEntry[] = [];
    for (const key of this.keys()) {
      const raw = this.get(key); if (raw === null) continue;
      const entry = this.entry(raw, key);
      if (entry.epoch !== this.epoch) { this.remove(key); continue; }
      entries.push(entry);
    }
    if (entries.length > 1) throw new JournalError("CORRUPT");
    const settlements = this.settlements();
    return { entries, settlements, settlement: settlements.at(-1) ?? null };
  }
  stage(command: string, input: unknown): { entry: JournalEntry; restored: boolean } {
    const body = journalBody(command, input), clientId = (input as { client_id: string }).client_id;
    const snapshot = this.snapshot(), existing = snapshot.entries[0];
    if (existing) {
      if (snapshot.entries.length !== 1 || existing.command !== command || existing.clientId !== clientId || assinatura(journalInput(existing)) !== assinatura(input)) throw new JournalError("PENDING");
      return { entry: existing, restored: true };
    }
    const entry: JournalEntry = { version: VERSION, userId: this.userId, epoch: this.epoch!, command, clientId, body };
    this.put(this.entryKey(clientId), JSON.stringify(entry));
    this.check();
    return { entry, restored: false };
  }
  finish(entry: JournalEntry, status: "confirmed" | "rejected", entityId: string | null) {
    this.check();
    if (this.get(this.entryKey(entry.clientId)) !== JSON.stringify(entry)) throw new JournalError("CORRUPT");
    const settlement: JournalSettlement = { version: VERSION, userId: this.userId, epoch: this.epoch!, command: entry.command, clientId: entry.clientId, status, entityId };
    // One bounded metadata key (32 resolutions); no domain text, including for sleeping tabs.
    const items = [...this.settlements().filter(item => item.clientId !== entry.clientId), settlement].slice(-32);
    this.put(`${this.base}settled`, JSON.stringify({ version: VERSION, userId: this.userId, epoch: this.epoch, items }));
    this.remove(this.entryKey(entry.clientId));
  }
  subscribe(listener: () => void) { return this.environment.subscribe(listener); }
  async revoke(): Promise<void> {
    // An old tab cannot revoke a newer login of the same user.
    let revokedEpoch: string | null = null;
    try { revokedEpoch = this.gate(); if (this.epoch && revokedEpoch !== this.epoch) return; }
    catch (error) { if (!(error instanceof JournalError) || error.code !== "CORRUPT") throw error; }
    // Rotate first so other tabs abort their request and cannot restore old payloads.
    const nextEpoch = this.environment.randomId();
    this.put(`${this.base}epoch`, JSON.stringify({ version: VERSION, userId: this.userId, epoch: nextEpoch }));
    const cleanup = () => {
      // A suspended cleanup may resume after another logout/login. It owns only
      // the retired generation, never data admitted under the newer gate.
      if (this.gate() !== nextEpoch) return;
      for (const key of [...this.keys(false), `${this.base}settled`]) {
        const raw = this.get(key); if (!raw) continue;
        let epoch: unknown;
        try { epoch = this.parse(raw).epoch; } catch { /* Logout also clears corrupt data owned by this user. */ }
        const retired = revokedEpoch === null ? epoch !== nextEpoch : epoch === revokedEpoch || epoch === undefined;
        if (retired && this.get(key) === raw) this.remove(key);
      }
    };
    // Logout is never indefinitely gated by a lock held by a suspended tab.
    // Every deletion holds the same lock as stage/finish, including the first pass.
    await this.exclusive(async () => { cleanup(); }, 1500);
  }
}

/** Called only after mount (or a user action), never during SSR/render. No memory fallback. */
export function browserCommandJournal(userId: string): CommandJournal {
  try {
    if (typeof window === "undefined" || !navigator.locks?.request) throw new Error();
    const storage = window.localStorage;
    return new CommandJournal(userId, {
      storage, randomId: () => crypto.randomUUID(),
      lock: async (name, signal, operation) => await navigator.locks.request(name, { mode: "exclusive", signal }, operation),
      subscribe(listener) {
        const sync = (event: StorageEvent) => { if (event.storageArea === storage && (event.key === null || event.key.startsWith(`${PREFIX}${userId}:`))) listener(); };
        window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
      },
    });
  } catch { throw new JournalError("UNAVAILABLE"); }
}
