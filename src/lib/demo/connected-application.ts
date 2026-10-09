import { createDemoApplication, type DemoApplication } from "./application";
import { diaCivilDe } from "../../core/tempo";
import { validCaptureAttachments } from "../../core/capturas";
import { validAccountSettings } from "../../core/configuracoes";
import { assinatura } from "../../core/contracts/base";
import { browserCommandJournal, JournalError, journalInput, type CommandJournal, type JournalEntry, type JournalSettlement, type JournalSnapshot } from "./command-journal";
import type { DemoQueries, DemoQueryKey, QueryState } from "./types";

type ConnectedQuery = DemoQueryKey;
const connectedKeys: ConnectedQuery[] = ["captures", "tasks", "finance", "projects", "habits", "knowledge", "drive", "agenda", "settings", "vault"];
const isConnectedQuery = (key: DemoQueryKey): key is ConnectedQuery => connectedKeys.includes(key as ConnectedQuery);
const idle = <T>(): QueryState<T> => ({ status: "idle", data: null, error: null });
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const textOrNull = (value: unknown) => value === null || typeof value === "string";

export class ConnectedApplicationError extends Error {
  constructor(public readonly code: string, message: string, public readonly outcomeUnknown = false) { super(message); this.name = "ConnectedApplicationError"; }
}
export const isCommandOutcomeUnknown = (error: unknown) => error instanceof ConnectedApplicationError && error.outcomeUnknown;
export type CommandFeedback = { status: "idle" } | { status: "pending"; retrying: boolean; message: string }
  | { status: "confirmed"; clientId: string; href: string; label: string }
  | { status: "rejected"; clientId: string; message: string } | { status: "session-changed"; message: string }
  | { status: "journal-error"; message: string };
export const IDLE_COMMAND: CommandFeedback = Object.freeze({ status: "idle" });
export interface CommandSession {
  getCommandSnapshot(): CommandFeedback;
  subscribeCommands(listener: () => void): () => void;
  retryPendingCommand(): Promise<unknown>;
  clearCommandFeedback(): void;
  initializeJournal(): Promise<void>;
  clearSessionJournal(): Promise<void>;
}
export const DEMO_COMMAND_SESSION: CommandSession = {
  getCommandSnapshot: () => IDLE_COMMAND, subscribeCommands: () => () => undefined,
  retryPendingCommand: async () => undefined, clearCommandFeedback: () => undefined,
  initializeJournal: async () => undefined, clearSessionJournal: async () => undefined,
};
export type ClientApplication = DemoApplication & CommandSession & { mode: "demo" | "connected"; refreshActive(): Promise<void>; executeDomainCommand(command: string, input: unknown): Promise<unknown>; subscribeInvalidations?(listener: (keys: readonly DemoQueryKey[]) => void): () => void };
export interface ConnectedApplicationOptions { fetch?: typeof fetch; now?: () => string; journal?: (userId: string) => CommandJournal }

function frozen<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) frozen(child); }
  return value;
}
function invalidResponse(write = false): never {
  throw new ConnectedApplicationError(write ? "UNKNOWN" : "INVALID_RESPONSE", write ? "Não foi possível confirmar a operação. Tente novamente para confirmar o mesmo envio." : "A resposta recebida é inválida. Tente carregar novamente.", write);
}
function assertOwned(value: unknown, userId: string): asserts value is Record<string, unknown> {
  if (record(value) && typeof value.user_id === "string" && value.user_id !== userId) throw new ConnectedApplicationError("SESSION_CHANGED", "A resposta pertence a outra conta. Recarregue a página para continuar.");
  if (!record(value) || typeof value.id !== "string" || !value.id || value.user_id !== userId) invalidResponse();
}
function assertItem(value: unknown, key: "captures" | "tasks", userId: string) {
  assertOwned(value, userId);
  if (typeof value.client_id !== "string" || !textOrNull(value.title) || !textOrNull(value.category_id) || !textOrNull(value.project_id) ||
    !["created_at", "updated_at"].every(field => typeof value[field] === "string") || !textOrNull(value.deleted_at)) invalidResponse();
  if (key === "captures") {
    if (!["idea", "task", "note", "reminder"].includes(String(value.type)) || !["draft", "inbox", "organized", "archived"].includes(String(value.status)) ||
      !textOrNull(value.content) || typeof value.captured_at !== "string" || !textOrNull(value.converted_task_id) ||
      (value.linked_capture_ids !== undefined && (!Array.isArray(value.linked_capture_ids) || !value.linked_capture_ids.every(id => typeof id === "string"))) ||
      (value.attachments !== undefined && !validCaptureAttachments(value.attachments))) invalidResponse();
  } else if (typeof value.title !== "string" || !textOrNull(value.description) || !["todo", "in_progress", "done", "archived"].includes(String(value.status)) ||
    !["low", "medium", "high", "urgent"].includes(String(value.priority)) || typeof value.all_day !== "boolean" ||
    !["due_at", "scheduled_start_at", "scheduled_end_at", "origin_capture_id", "completed_at", "archived_at"].every(field => textOrNull(value[field])) ||
    ![value.estimated_minutes, value.board_position].every(entry => entry === null || typeof entry === "number" && Number.isFinite(entry))) invalidResponse();
}
function queryData<K extends ConnectedQuery>(value: unknown, key: K, userId: string): DemoQueries[K] {
  if (key === "settings") {
    if (!validAccountSettings(value, userId)) invalidResponse();
    return { profile: { display_name: value.profile.display_name ?? "Sua conta", email_label: value.profile.email ?? "" } } as DemoQueries[K];
  }
  if (key === "vault") {
    if (!record(value) || !(value.header === null || record(value.header) && value.header.user_id === userId) || !Array.isArray(value.items)) invalidResponse();
    // The feature loads ciphertext itself; the shared presentation never has titles.
    return { configured: value.header !== null, items: [] } as unknown as DemoQueries[K];
  }
  if (key === "knowledge") {
    if (!record(value) || !Array.isArray(value.notebooks) || !Array.isArray(value.pages)) invalidResponse();
    for (const row of [...value.notebooks, ...value.pages]) assertOwned(row, userId);
    return { items: [], memberships: [], notebooks: value.notebooks.filter(row => !row.deleted_at).map(row => ({ ...row, parent_id: null })), pages: value.pages } as unknown as DemoQueries[K];
  }
  if (key === "drive") {
    if (!record(value) || !Array.isArray(value.folders) || !Array.isArray(value.files) || !Number.isSafeInteger(value.capacity_bytes)) invalidResponse();
    for (const row of [...value.folders, ...value.files]) assertOwned(row, userId);
    return value as unknown as DemoQueries[K];
  }
  if (key === "agenda") {
    if (!record(value) || !Array.isArray(value.items) || !Array.isArray(value.calendars) || !Array.isArray(value.accounts) || !Array.isArray(value.sync_runs)) invalidResponse();
    for (const row of [...value.items, ...value.calendars, ...value.accounts, ...value.sync_runs]) assertOwned(row, userId);
    for (const row of value.items) if (typeof row.title !== "string" || typeof row.starts_at !== "string" || typeof row.ends_at !== "string" || !textOrNull(row.linked_capture_id) || !textOrNull(row.location) || typeof row.all_day !== "boolean") invalidResponse();
    return value as unknown as DemoQueries[K];
  }
  if (key === "projects" || key === "habits") {
    const fields = key === "projects" ? ["items", "containers"] : ["items", "entries", "pauses"];
    if (!record(value) || !fields.every(field => Array.isArray(value[field]))) invalidResponse();
    for (const field of fields) for (const item of value[field] as unknown[]) assertOwned(item, userId);
    return value as unknown as DemoQueries[K];
  }
  if (key === "finance") {
    if (!record(value) || !["accounts", "categories", "transactions", "budgets", "tags"].every(field => Array.isArray(value[field]))) invalidResponse();
    for (const field of ["accounts", "categories", "transactions", "budgets", "tags"]) for (const item of value[field] as unknown[]) assertOwned(item, userId);
    for (const item of value.transactions as Record<string, unknown>[]) if (!Number.isSafeInteger(item.amount_cents) || !Number.isSafeInteger(item.paid_cents)) invalidResponse();
    return value as unknown as DemoQueries[K];
  }
  if (!record(value) || !Array.isArray(value.items) || !Array.isArray(value.categories) || !Array.isArray(value.projects)) invalidResponse();
  for (const item of value.items) assertItem(item, key, userId);
  for (const item of [...value.categories, ...value.projects]) { assertOwned(item, userId); if (typeof item.name !== "string") invalidResponse(); }
  return value as unknown as DemoQueries[K];
}
function httpError(status: number, body: unknown, write: boolean): ConnectedApplicationError {
  const code = record(body) && typeof body.code === "string" ? body.code : "";
  if (status === 409 && code === "SESSION_CHANGED") return new ConnectedApplicationError("SESSION_CHANGED", "A conta deste navegador mudou. Recarregue a página para continuar na conta atual.");
  if (status === 401) return new ConnectedApplicationError("UNAUTHENTICATED", "Sua sessão terminou. Entre novamente para continuar.");
  if (status === 403) return new ConnectedApplicationError("FORBIDDEN", "Você não tem acesso a esta operação. Recarregue a página para atualizar suas permissões.");
  if (status === 404) return new ConnectedApplicationError("NOT_FOUND", "Este registro não está mais disponível. Recarregue os dados.");
  if (status === 429) return new ConnectedApplicationError("RATE_LIMITED", "Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.");
  if (status === 409) return new ConnectedApplicationError("CONFLICT", "Esta operação está em conflito. Tente novamente sem alterar o envio ou recarregue os dados.");
  if (status === 400) return new ConnectedApplicationError("VALIDATION", "Não foi possível salvar estes campos. Revise os dados e tente novamente.");
  if (write) return new ConnectedApplicationError(code === "COMMIT_UNKNOWN" ? "COMMIT_UNKNOWN" : "UNKNOWN", "Não foi possível confirmar a operação. Tente novamente para confirmar o mesmo envio.", true);
  return new ConnectedApplicationError("UNAVAILABLE", "Não foi possível carregar estes dados. Tente novamente.");
}

/** Cookie-only channel. No illustrative data are returned for a connected account. */
export function createConnectedApplication(userId: string, options: ConnectedApplicationOptions = {}): ClientApplication {
  if (!userId) throw new Error("Uma identidade verificada é necessária.");
  const now = options.now ?? (() => new Date().toISOString());
  const demo = createDemoApplication({ userId, clock: { now } });
  const fetcher = options.fetch ?? ((...args) => fetch(...args));
  const states: { [K in ConnectedQuery]: QueryState<DemoQueries[K]> } = { captures: idle(), tasks: idle(), finance: idle(), projects: idle(), habits: idle(), knowledge: idle(), drive: idle(), agenda: idle(), settings: idle(), vault: idle() };
  const listeners = Object.fromEntries(connectedKeys.map(key => [key, new Set<() => void>()])) as Record<ConnectedQuery, Set<() => void>>;
  const pending = new Map<ConnectedQuery, Promise<void>>();
  const revisions = Object.fromEntries(connectedKeys.map(key => [key, 0])) as Record<ConnectedQuery, number>;
  const stale = new Set<ConnectedQuery>(connectedKeys);
  const controllers = new Set<AbortController>();
  const subscribers = new Set<() => void>(), commandListeners = new Set<() => void>();
  const invalidationListeners = new Set<(keys: readonly DemoQueryKey[]) => void>();
  let feedback: CommandFeedback = IDLE_COMMAND;
  type PendingRequest = { command: string; clientId: string; input: unknown; fingerprint: string; keys: ConnectedQuery[] };
  let pendingCommand: PendingRequest | null = null, writing = false;
  let journal: CommandJournal | null = null, journalReady = false, journalOpening: Promise<void> | null = null;
  let stopJournal: (() => void) | null = null, lastSettlement = "", synchronizing = false, journalDirty = false;
  let ending: Promise<void> | null = null;
  let closed = false, projectsVisible = true;
  let sessionChanged = false;
  function checkOpen() {
    if (sessionChanged) throw new ConnectedApplicationError("SESSION_CHANGED", "A conta deste navegador mudou. Recarregue a página para continuar na conta atual.");
    if (closed) throw new ConnectedApplicationError("CLOSED", "Esta sessão foi encerrada. Entre novamente.");
  }
  function commandFeedback(next: CommandFeedback) { feedback = frozen(next); for (const listener of commandListeners) listener(); }
  function close(changed = false) {
    closed = true; sessionChanged = changed; pendingCommand = null;
    stopJournal?.(); stopJournal = null;
    for (const controller of controllers) controller.abort(); controllers.clear();
    for (const key of connectedKeys) { revisions[key]++; states[key] = idle(); listeners[key].clear(); }
    pending.clear(); demo.dispose();
    commandFeedback(changed ? { status: "session-changed", message: "A conta deste navegador mudou. Recarregue a página para continuar na conta atual." } : IDLE_COMMAND);
    for (const listener of subscribers) listener();
    subscribers.clear();
    invalidationListeners.clear();
    if (!changed) commandListeners.clear();
  }
  const isFileCommand = (name: string) => name.startsWith("drive.") || name.startsWith("file.") || name.startsWith("avatar.");
  const commandKeys = (name: string): ConnectedQuery[] => name.startsWith("calendar.") ? ["agenda", "knowledge"] : name.startsWith("vault.") ? [] : isFileCommand(name) ? ["captures", "drive", "settings", "projects", "knowledge"] : name.startsWith("project.") ? ["projects", "captures", "tasks", "knowledge", "drive"] : name.startsWith("habit.") ? ["habits", "knowledge"] : name.startsWith("finance.") ? ["finance", "knowledge"] : name.startsWith("settings.") ? name === "settings.preferences.update" ? ["settings", "agenda"] : ["settings"] : name.startsWith("knowledge.") ? ["captures", "knowledge", "projects"] : name.startsWith("capture.") ? ["captures", "projects", "knowledge", ...(name === "capture.convert" ? ["tasks" as const] : [])] : ["tasks", "projects", "knowledge"];
  const endpoint = (name: string) => name.startsWith("calendar.") ? "/api/calendar" : name.startsWith("vault.") ? "/api/vault" : isFileCommand(name) ? "/api/files" : name.startsWith("project.") || name.startsWith("habit.") ? "/api/projects-habits" : name.startsWith("finance.") ? "/api/finance" : name.startsWith("settings.") ? "/api/settings" : name.startsWith("knowledge.") ? "/api/knowledge" : "/api/capture-tasks";
  function restored(entry: JournalEntry): PendingRequest {
    const input = journalInput(entry);
    return { command: entry.command, clientId: entry.clientId, input, fingerprint: assinatura(input), keys: commandKeys(entry.command) };
  }
  function settledFeedback(settlement: JournalSettlement) {
    if (settlement.status === "rejected") commandFeedback({ status: "rejected", clientId: settlement.clientId, message: "O envio não foi aceito. Revise os dados antes de tentar novamente." });
    else if (settlement.command.startsWith("settings.") || settlement.command.startsWith("avatar.")) commandFeedback({ status: "confirmed", clientId: settlement.clientId, href: "/configuracoes", label: "Abrir Configurações" });
    else if (isFileCommand(settlement.command)) commandFeedback({ status: "confirmed", clientId: settlement.clientId, href: "/drive", label: "Abrir Drive" });
    else if (settlement.command.startsWith("calendar.")) commandFeedback({ status: "confirmed", clientId: settlement.clientId, href: "/calendario", label: "Abrir Calendário" });
    else if (settlement.command.startsWith("vault.")) commandFeedback({ status: "confirmed", clientId: settlement.clientId, href: "/cofre", label: "Abrir Cofre" });
    else if (settlement.command.startsWith("project.") || settlement.command.startsWith("habit.")) commandFeedback({ status: "confirmed", clientId: settlement.clientId,
      href: settlement.command.startsWith("project.") ? "/projetos" : "/habitos", label: settlement.command.startsWith("project.") ? "Abrir Projetos" : "Abrir Hábitos" });
    else if (settlement.command.startsWith("finance.") || settlement.command.startsWith("knowledge.")) commandFeedback({ status: "confirmed", clientId: settlement.clientId,
      href: settlement.command.startsWith("finance.") ? "/financeiro" : "/conhecimento", label: settlement.command.startsWith("finance.") ? "Abrir Financeiro" : "Abrir Conhecimento" });
    else if (settlement.entityId) commandFeedback({ status: "confirmed", clientId: settlement.clientId,
      href: `${settlement.command === "capture.convert" || settlement.command.startsWith("task.") ? "/tarefas?task=" : "/capturar?capture="}${encodeURIComponent(settlement.entityId)}`,
      label: settlement.command === "capture.convert" || settlement.command.startsWith("task.") ? "Abrir tarefa" : "Abrir nota" });
  }
  function adopt(snapshot: JournalSnapshot, boot = false) {
    if (closed) return;
    const ownResolution = pendingCommand ? snapshot.settlements.find(item => item.clientId === pendingCommand!.clientId) : null;
    const settlement = ownResolution ?? snapshot.settlement;
    const settlementKey = settlement ? JSON.stringify(settlement) : "";
    const resolved = settlement && !snapshot.entries.some(entry => entry.clientId === settlement.clientId);
    if (pendingCommand && !ownResolution && !snapshot.entries.some(entry => entry.clientId === pendingCommand!.clientId)) {
      // A sleeping tab can miss the bounded metadata history. Keep its exact
      // intention; an explicit retry journals it again before checking the receipt.
      commandFeedback({ status: "pending", retrying: false, message: snapshot.entries.length
        ? "Outra aba tem um envio pendente. Aguarde a confirmação nessa aba antes de confirmar este envio original."
        : "O envio original ainda precisa de confirmação nesta aba. Confirme para verificar o mesmo envio; nada será reenviado automaticamente." });
      return;
    }
    if (resolved && settlementKey !== lastSettlement && (!boot || ownResolution)) settledFeedback(settlement);
    lastSettlement = settlementKey;
    pendingCommand = snapshot.entries[0] ? restored(snapshot.entries[0]) : null;
    if (pendingCommand) commandFeedback({ status: "pending", retrying: false, message: "Há um envio protegido neste navegador. Confirme para reenviar o conteúdo original. Nada será reenviado automaticamente." });
    else if (feedback.status === "journal-error" || feedback.status === "pending") commandFeedback(IDLE_COMMAND);
  }
  function journalFailure(error: unknown, afterSend = false): ConnectedApplicationError {
    const failure = error instanceof JournalError ? error : new JournalError("UNAVAILABLE");
    if (failure.code === "SESSION_CHANGED") { close(true); return new ConnectedApplicationError("SESSION_CHANGED", failure.message); }
    if (failure.code === "INVALID") return new ConnectedApplicationError("VALIDATION", failure.message);
    if (failure.code === "PENDING") return new ConnectedApplicationError("PENDING_COMMAND", failure.message);
    journalReady = false;
    commandFeedback({ status: "journal-error", message: failure.message });
    return new ConnectedApplicationError("JOURNAL_UNAVAILABLE", failure.message, afterSend);
  }
  async function synchronizeJournal() {
    if (!journal || !journalReady || closed) return;
    if (synchronizing || writing) { journalDirty = true; return; }
    journalDirty = false;
    synchronizing = true;
    try {
      await journal.exclusive(async () => { if (!closed) adopt(journal!.snapshot()); });
      if (!closed) await invalidate(connectedKeys);
    } catch (error) { if (!closed) journalFailure(error); }
    finally { synchronizing = false; if (journalDirty && !closed && journalReady) void synchronizeJournal(); }
  }
  async function initializeJournal() {
    checkOpen();
    if (journalOpening) return journalOpening;
    journalOpening = (async () => {
      try {
        journal ??= (options.journal ?? browserCommandJournal)(userId);
        const snapshot = await journal.open(); checkOpen();
        adopt(snapshot, !journalReady); journalReady = true;
        stopJournal ??= journal.subscribe(() => {
          if (closed) return;
          // Revocation interrupts an in-flight request without waiting for its Web Lock.
          try { journal!.assertSession(); } catch (error) { journalFailure(error); return; }
          void synchronizeJournal();
        });
      } catch (error) { if (!closed) throw journalFailure(error); throw error; }
    })().finally(() => { journalOpening = null; });
    return journalOpening;
  }
  async function clearSessionJournal() {
    if (ending) return ending;
    close();
    ending = (async () => {
      const ownerJournal = journal ?? (options.journal ?? browserCommandJournal)(userId);
      await ownerJournal.revoke();
    })();
    return ending;
  }
  function accountChanged() {
    close(true);
    // Bound to the old verified user, never clears another account's journal.
    void (journal ?? (() => { try { return (options.journal ?? browserCommandJournal)(userId); } catch { return null; } })())?.revoke().catch(() => undefined);
  }
  function publish<K extends ConnectedQuery>(key: K, value: QueryState<DemoQueries[K]>) {
    if (closed) return;
    states[key] = frozen(value) as (typeof states)[K];
    for (const listener of listeners[key]) listener();
  }
  async function request(url: string, input?: { command: string; input: unknown }): Promise<unknown> {
    checkOpen();
    const controller = new AbortController(); controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
      const { response, body } = await Promise.race([aborted, (async () => {
        const response = await fetcher(url, { method: input ? "POST" : "GET", credentials: "same-origin", cache: "no-store", redirect: "error",
          headers: { Accept: "application/json", "X-Expected-User-ID": userId, ...(input ? { "Content-Type": "application/json" } : {}) },
          ...(input ? { body: JSON.stringify(input) } : {}), signal: controller.signal });
        const body: unknown = await response.json().catch(() => null); return { response, body };
      })()]);
      checkOpen();
      if (!response.ok) {
        const error = httpError(response.status, body, !!input);
        if (error.code === "SESSION_CHANGED") accountChanged();
        throw error;
      }
      if (body === null) invalidResponse(!!input);
      return body;
    } catch (error) {
      checkOpen();
      if (error instanceof ConnectedApplicationError) throw error;
      throw new ConnectedApplicationError(input ? "UNKNOWN" : "UNAVAILABLE", input ? "Não foi possível confirmar a operação. Tente novamente para confirmar o mesmo envio." : "Não foi possível carregar estes dados. Verifique a conexão e tente novamente.", !!input);
    } finally { clearTimeout(timeout); controllers.delete(controller); }
  }
  function load(key: DemoQueryKey, force = false): Promise<void> {
    if (closed) return Promise.resolve();
    if (!isConnectedQuery(key)) return demo.load(key, force);
    const current = pending.get(key);
    if (current) return force ? current.then(() => load(key, true)) : current;
    if (!force && !stale.has(key) && states[key].status === "ready") return Promise.resolve();
    const revision = revisions[key]; stale.delete(key);
    publish(key, { status: "loading", data: states[key].data, error: null });
    const urls = { finance: "/api/finance", knowledge: "/api/knowledge", drive: "/api/files", agenda: "/api/calendar", settings: "/api/settings", vault: "/api/vault" };
    const work = request(key === "projects" || key === "habits" ? `/api/projects-habits?domain=${key}` : key === "captures" || key === "tasks" ? `/api/capture-tasks?query=${key}` : urls[key]).then(body => {
      const data = queryData(body, key, userId);
      if (revision === revisions[key]) publish(key, { status: "ready", data: "projects" in data ? { ...data, projects: projectsVisible ? data.projects : [] } : data, error: null });
    }).catch((error: unknown) => {
      if (error instanceof ConnectedApplicationError && error.code === "SESSION_CHANGED") { if (!closed) accountChanged(); return; }
      if (revision === revisions[key]) publish(key, { status: "error", data: null, error: error instanceof ConnectedApplicationError ? error.message : "Não foi possível carregar estes dados. Tente novamente." });
    }).finally(() => { pending.delete(key); });
    pending.set(key, work); return work;
  }
  async function invalidate(keys: ConnectedQuery[]) {
    for (const key of keys) { revisions[key]++; stale.add(key); }
    for (const listener of invalidationListeners) { try { listener(Object.freeze([...keys])); } catch { /* Presentation observers cannot change a committed command's outcome. */ } }
    await Promise.all(keys.map(async key => { await pending.get(key); if (!closed && listeners[key].size) await load(key, true); }));
  }
  async function sendCommand(entry: PendingRequest): Promise<unknown> {
    checkOpen();
    if (writing) throw new ConnectedApplicationError("BUSY", "Aguarde a confirmação do envio em andamento.");
    writing = true;
    let afterSend = false;
    try {
      if (!journalReady) await initializeJournal();
      checkOpen();
      const result = await journal!.exclusive(async () => {
        checkOpen();
        const snapshot = journal!.snapshot();
        const retainedLocally = pendingCommand;
        if (!snapshot.entries.length && retainedLocally && (retainedLocally.command !== entry.command || retainedLocally.fingerprint !== entry.fingerprint)) throw new JournalError("PENDING");
        if (snapshot.entries.length && (snapshot.entries[0]!.command !== entry.command || snapshot.entries[0]!.clientId !== entry.clientId || assinatura(journalInput(snapshot.entries[0]!)) !== entry.fingerprint)) {
          adopt(snapshot); throw new JournalError("PENDING");
        }
        const sameLocal = retainedLocally?.command === entry.command && retainedLocally.fingerprint === entry.fingerprint;
        const staged = journal!.stage(entry.command, sameLocal ? retainedLocally.input : entry.input), retained = restored(staged.entry);
        const retrying = staged.restored || sameLocal;
        pendingCommand = retained;
        if (retrying) commandFeedback({ status: "pending", retrying: true, message: "Confirmando o envio original protegido neste navegador…" });
        else commandFeedback(IDLE_COMMAND);
        try {
          journal!.assertSession(); checkOpen(); afterSend = true;
          const body = await request(endpoint(retained.command), { command: retained.command, input: structuredClone(retained.input) });
          if (!record(body) || body.ok !== true || !Object.hasOwn(body, "result")) invalidResponse(true);
          try {
            if (retained.command === "capture.convert") {
              if (!record(body.result)) invalidResponse();
              assertItem(body.result.captura, "captures", userId); assertItem(body.result.tarefa, "tasks", userId);
            } else if (retained.command.startsWith("calendar.")) { queryData(body.result, "agenda", userId);
            } else if (retained.command.startsWith("vault.")) {
              if (!record(body.result) || Object.keys(body.result).length !== 2 || typeof body.result.id !== "string" || typeof body.result.revision !== "string") invalidResponse();
            } else if (retained.command.startsWith("avatar.")) {
              if (!record(body.result) || Object.keys(body.result).length !== 1 || !Object.hasOwn(body.result, "avatar_file_id") || !textOrNull(body.result.avatar_file_id)) invalidResponse();
            } else if (isFileCommand(retained.command)) {
              assertOwned(body.result, userId);
            } else if (retained.command.startsWith("project.") || retained.command.startsWith("habit.")) {
              const allowsNull = retained.command === "habit.pause.delete" || retained.command === "habit.mark" && record(retained.input) && retained.input.done === false;
              if (!(allowsNull && body.result === null)) assertOwned(body.result, userId);
            } else if (retained.command.startsWith("finance.")) {
              if (record(body.result) && Array.isArray(body.result.transactions)) {
                if (typeof body.result.group_id !== "string") invalidResponse();
                for (const item of body.result.transactions) assertOwned(item, userId);
                if (body.result.charges !== undefined && body.result.charges !== null) assertOwned(body.result.charges, userId);
              } else assertOwned(body.result, userId);
            } else if (retained.command.startsWith("settings.")) {
              if (!validAccountSettings(body.result, userId)) invalidResponse();
            } else if (retained.command.startsWith("knowledge.")) {
              if (retained.command === "knowledge.page.resolve-ref" || retained.command === "knowledge.page.promote-capture") {
                if (!record(body.result)) invalidResponse();
                assertOwned(body.result.page, userId);
                if (retained.command === "knowledge.page.resolve-ref") assertOwned(body.result.target, userId);
                else if (!record(retained.input) || body.result.capture_id !== retained.input.capture_id) invalidResponse();
              } else assertOwned(body.result, userId);
            } else assertItem(body.result, retained.command.startsWith("capture.") ? "captures" : "tasks", userId);
          } catch (error) {
            if (error instanceof ConnectedApplicationError && error.code === "SESSION_CHANGED") { accountChanged(); throw error; }
            invalidResponse(true);
          }
          const converted = retained.command === "capture.convert";
          const item = converted && record(body.result) ? body.result.tarefa : body.result;
          const entityId = record(item) && typeof item.id === "string" ? item.id : null;
          journal!.finish(staged.entry, "confirmed", entityId);
          pendingCommand = null;
          const settlement = journal!.snapshot().settlement!; lastSettlement = JSON.stringify(settlement);
          if (retrying) settledFeedback(settlement);
          return body.result;
        } catch (error) {
          // The channel resolves an exact receipt before returning VALIDATION.
          // A first known refusal also proves that this first attempt did not
          // commit. Once restored/unknown, a later refusal cannot prove that.
          const definitive = error instanceof ConnectedApplicationError && (error.code === "VALIDATION" ||
            !retrying && !error.outcomeUnknown && error.code !== "SESSION_CHANGED" && error.code !== "CLOSED");
          if (!closed && definitive) {
            journal!.finish(staged.entry, "rejected", null); pendingCommand = null;
            const settlement = journal!.snapshot().settlement!; lastSettlement = JSON.stringify(settlement);
            if (retrying) settledFeedback(settlement);
          } else if (!closed && !(error instanceof JournalError)) {
            pendingCommand = retained;
            commandFeedback({ status: "pending", retrying: false, message: error instanceof ConnectedApplicationError ? error.message : "Não foi possível confirmar o envio. O conteúdo original está protegido neste navegador." });
          }
          throw error;
        }
      });
      await invalidate(entry.keys); checkOpen();
      return result;
    } catch (error) {
      if (error instanceof JournalError) throw journalFailure(error, afterSend);
      throw error;
    } finally { writing = false; if (journalDirty && !closed && journalReady) void synchronizeJournal(); }
  }
  function command<I, O>(name: string, keys: ConnectedQuery[]) {
    return async (input: I): Promise<O> => {
      checkOpen();
      if (!record(input) || typeof input.client_id !== "string" || !input.client_id.trim()) throw new ConnectedApplicationError("VALIDATION", "Informe o identificador do envio.");
      if (record(input)) {
        if (name === "capture.organize" && input.destination === "knowledge") throw new ConnectedApplicationError("UNAVAILABLE", "Guardar em Conhecimento ainda não está disponível na conta conectada.");
      }
      return await sendCommand({ command: name, clientId: input.client_id, input: structuredClone(input), fingerprint: assinatura(input), keys: [...keys] }) as O;
    };
  }
  const tasks: DemoApplication["commands"]["tasks"] = {
    create: command("task.create", commandKeys("task.create")), update: command("task.update", commandKeys("task.update")), status: command("task.status", commandKeys("task.status")),
    remove: command("task.delete", commandKeys("task.delete")), restore: command("task.restore", commandKeys("task.restore")),
  };
  const captures: DemoApplication["commands"]["captures"] = {
    create: command("capture.create", commandKeys("capture.create")), update: command("capture.update", commandKeys("capture.update")), archive: command("capture.archive", commandKeys("capture.archive")),
    unarchive: command("capture.unarchive", commandKeys("capture.unarchive")), remove: command("capture.delete", commandKeys("capture.delete")), restore: command("capture.restore", commandKeys("capture.restore")),
    organize: command("capture.organize", commandKeys("capture.organize")), convert: command("capture.convert", commandKeys("capture.convert")),
  };
  const finance: DemoApplication["commands"]["finance"] = {
    accounts: { create: command("finance.account.create", ["finance"]), update: command("finance.account.update", ["finance"]), close: command("finance.account.close", ["finance"]) },
    categories: { create: command("finance.category.create", ["finance"]), update: command("finance.category.update", ["finance"]) },
    transactions: { create: command("finance.transaction.create", ["finance"]), update: command("finance.transaction.update", ["finance"]), remove: command("finance.transaction.delete", ["finance"]), restore: command("finance.transaction.restore", ["finance"]), duplicate: command("finance.transaction.duplicate", ["finance"]) },
    transfers: { create: command("finance.transfer.create", ["finance"]) }, statements: { pay: command("finance.statement.pay", ["finance"]) },
    series: { create: command("finance.series.create", ["finance"]), stop: command("finance.series.stop", ["finance"]) },
    tags: { create: command("finance.tag.create", ["finance"]), update: command("finance.tag.update", ["finance"]) },
    budgets: { save: command("finance.budget.save", ["finance"]) },
  };
  const projects: DemoApplication["commands"]["projects"] = {
    create: command("project.create", ["projects"]), update: command("project.update", ["projects"]), remove: command("project.delete", ["projects"]), restore: command("project.restore", ["projects"]),
    containers: { create: command("project.container.create", commandKeys("project.container.create")), link: command("project.container.link", commandKeys("project.container.link")), unlink: command("project.container.unlink", commandKeys("project.container.unlink")) },
  };
  const habits: DemoApplication["commands"]["habits"] = {
    create: command("habit.create", ["habits"]), update: command("habit.update", ["habits"]), archive: command("habit.archive", ["habits"]), restore: command("habit.restore", ["habits"]),
    mark: command("habit.mark", ["habits"]), pause: command("habit.pause.create", ["habits"]), removePause: command("habit.pause.delete", ["habits"]),
  };
  return {
    ...demo, mode: "connected", clock: { now }, today: () => diaCivilDe(now()), commands: { ...demo.commands, tasks, captures, finance, projects, habits },
    executeDomainCommand: (name, input) => command<unknown, unknown>(name, commandKeys(name))(input),
    getSnapshot: <K extends DemoQueryKey>(key: K): QueryState<DemoQueries[K]> => isConnectedQuery(key) ? states[key] as QueryState<DemoQueries[K]> : demo.getSnapshot(key),
    subscribe(key, listener) {
      if (closed) return () => undefined;
      subscribers.add(listener);
      const stop = isConnectedQuery(key) ? (listeners[key].add(listener), () => { listeners[key].delete(listener); }) : demo.subscribe(key, listener);
      return () => { subscribers.delete(listener); stop(); };
    },
    getCommandSnapshot: () => feedback,
    subscribeCommands(listener) { commandListeners.add(listener); return () => { commandListeners.delete(listener); }; },
    subscribeInvalidations(listener) { if (closed) return () => undefined; invalidationListeners.add(listener); return () => { invalidationListeners.delete(listener); }; },
    retryPendingCommand: async () => { checkOpen(); if (!journalReady) await initializeJournal(); return pendingCommand ? sendCommand(pendingCommand) : undefined; },
    clearCommandFeedback() { if (feedback.status === "confirmed" || feedback.status === "rejected") commandFeedback(IDLE_COMMAND); },
    initializeJournal, clearSessionJournal,
    load,
    refreshActive: async () => { await Promise.all(connectedKeys.filter(key => listeners[key].size).map(key => load(key, true))); },
    async setProjectVisibility(visible) { if (visible === projectsVisible || closed) return; projectsVisible = visible; await Promise.all([demo.setProjectVisibility(visible), invalidate(connectedKeys)]); },
    failNextRead(key) { if (isConnectedQuery(key)) throw new Error("Falhas simuladas não estão disponíveis para dados salvos."); demo.failNextRead(key); },
    stageImage() { throw new ConnectedApplicationError("UNAVAILABLE", "Anexos ainda não estão disponíveis na conta conectada."); },
    getImage: () => undefined, dropImage: () => undefined,
    dispose() { close(); },
  };
}
