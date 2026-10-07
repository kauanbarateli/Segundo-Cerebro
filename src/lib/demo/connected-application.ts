import { createDemoApplication, type DemoApplication } from "./application";
import { diaCivilDe } from "../../core/tempo";
import { assinatura } from "../../core/contracts/base";
import type { DemoQueries, DemoQueryKey, QueryState } from "./types";

type ConnectedQuery = "captures" | "tasks";
const connectedKeys: ConnectedQuery[] = ["captures", "tasks"];
const isConnectedQuery = (key: DemoQueryKey): key is ConnectedQuery => key === "captures" || key === "tasks";
const idle = <T>(): QueryState<T> => ({ status: "idle", data: null, error: null });
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const textOrNull = (value: unknown) => value === null || typeof value === "string";

export class ConnectedApplicationError extends Error {
  constructor(public readonly code: string, message: string, public readonly outcomeUnknown = false) { super(message); this.name = "ConnectedApplicationError"; }
}
export const isCommandOutcomeUnknown = (error: unknown) => error instanceof ConnectedApplicationError && error.outcomeUnknown;
export type CommandFeedback = { status: "idle" } | { status: "pending"; retrying: boolean; message: string }
  | { status: "confirmed"; clientId: string; href: string; label: string }
  | { status: "rejected"; clientId: string; message: string } | { status: "session-changed"; message: string };
export const IDLE_COMMAND: CommandFeedback = Object.freeze({ status: "idle" });
export interface CommandSession {
  getCommandSnapshot(): CommandFeedback;
  subscribeCommands(listener: () => void): () => void;
  retryPendingCommand(): Promise<unknown>;
  clearCommandFeedback(): void;
}
export const DEMO_COMMAND_SESSION: CommandSession = {
  getCommandSnapshot: () => IDLE_COMMAND, subscribeCommands: () => () => undefined,
  retryPendingCommand: async () => undefined, clearCommandFeedback: () => undefined,
};
export type ClientApplication = DemoApplication & CommandSession & { mode: "demo" | "connected"; refreshActive(): Promise<void> };
export interface ConnectedApplicationOptions { fetch?: typeof fetch; now?: () => string }

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
function assertItem(value: unknown, key: ConnectedQuery, userId: string) {
  assertOwned(value, userId);
  if (typeof value.client_id !== "string" || !textOrNull(value.title) || !textOrNull(value.category_id) || !textOrNull(value.project_id) ||
    !["created_at", "updated_at"].every(field => typeof value[field] === "string") || !textOrNull(value.deleted_at)) invalidResponse();
  if (key === "captures") {
    if (!["idea", "task", "note", "reminder"].includes(String(value.type)) || !["draft", "inbox", "organized", "archived"].includes(String(value.status)) ||
      !textOrNull(value.content) || typeof value.captured_at !== "string" || !textOrNull(value.converted_task_id) ||
      (value.linked_capture_ids !== undefined && (!Array.isArray(value.linked_capture_ids) || !value.linked_capture_ids.every(id => typeof id === "string"))) ||
      (value.attachments !== undefined && (!Array.isArray(value.attachments) || value.attachments.length > 0))) invalidResponse();
  } else if (typeof value.title !== "string" || !textOrNull(value.description) || !["todo", "in_progress", "done", "archived"].includes(String(value.status)) ||
    !["low", "medium", "high", "urgent"].includes(String(value.priority)) || typeof value.all_day !== "boolean" ||
    !["due_at", "scheduled_start_at", "scheduled_end_at", "origin_capture_id", "completed_at", "archived_at"].every(field => textOrNull(value[field])) ||
    ![value.estimated_minutes, value.board_position].every(entry => entry === null || typeof entry === "number" && Number.isFinite(entry))) invalidResponse();
}
function queryData<K extends ConnectedQuery>(value: unknown, key: K, userId: string): DemoQueries[K] {
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

/** Cookie-only channel. The other modules retain a separate, explicitly illustrative store. */
export function createConnectedApplication(userId: string, options: ConnectedApplicationOptions = {}): ClientApplication {
  if (!userId) throw new Error("Uma identidade verificada é necessária.");
  const now = options.now ?? (() => new Date().toISOString());
  const demo = createDemoApplication({ userId, clock: { now } });
  const fetcher = options.fetch ?? ((...args) => fetch(...args));
  const states: { [K in ConnectedQuery]: QueryState<DemoQueries[K]> } = { captures: idle(), tasks: idle() };
  const listeners = { captures: new Set<() => void>(), tasks: new Set<() => void>() };
  const pending = new Map<ConnectedQuery, Promise<void>>();
  const revisions = { captures: 0, tasks: 0 };
  const stale = new Set<ConnectedQuery>(connectedKeys);
  const controllers = new Set<AbortController>();
  const subscribers = new Set<() => void>(), commandListeners = new Set<() => void>();
  let feedback: CommandFeedback = IDLE_COMMAND;
  type PendingRequest = { command: string; clientId: string; input: unknown; fingerprint: string; keys: ConnectedQuery[] };
  let pendingCommand: PendingRequest | null = null, writing = false;
  let closed = false, projectsVisible = true;
  let sessionChanged = false;
  function checkOpen() {
    if (sessionChanged) throw new ConnectedApplicationError("SESSION_CHANGED", "A conta deste navegador mudou. Recarregue a página para continuar na conta atual.");
    if (closed) throw new ConnectedApplicationError("CLOSED", "Esta sessão foi encerrada. Entre novamente.");
  }
  function commandFeedback(next: CommandFeedback) { feedback = frozen(next); for (const listener of commandListeners) listener(); }
  function close(changed = false) {
    closed = true; sessionChanged = changed; pendingCommand = null;
    for (const controller of controllers) controller.abort(); controllers.clear();
    for (const key of connectedKeys) { revisions[key]++; states[key] = idle(); listeners[key].clear(); }
    pending.clear(); demo.dispose();
    commandFeedback(changed ? { status: "session-changed", message: "A conta deste navegador mudou. Recarregue a página para continuar na conta atual." } : IDLE_COMMAND);
    for (const listener of subscribers) listener();
    subscribers.clear();
    if (!changed) commandListeners.clear();
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
      const response = await fetcher(url, { method: input ? "POST" : "GET", credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: { Accept: "application/json", "X-Expected-User-ID": userId, ...(input ? { "Content-Type": "application/json" } : {}) },
        ...(input ? { body: JSON.stringify(input) } : {}), signal: controller.signal });
      const body: unknown = await response.json().catch(() => null);
      checkOpen();
      if (!response.ok) {
        const error = httpError(response.status, body, !!input);
        if (error.code === "SESSION_CHANGED") close(true);
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
    const work = request(`/api/capture-tasks?query=${key}`).then(body => {
      const data = queryData(body, key, userId);
      if (revision === revisions[key]) publish(key, { status: "ready", data: { ...data, projects: projectsVisible ? data.projects : [] }, error: null });
    }).catch((error: unknown) => {
      if (error instanceof ConnectedApplicationError && error.code === "SESSION_CHANGED") { if (!closed) close(true); return; }
      if (revision === revisions[key]) publish(key, { status: "error", data: null, error: error instanceof ConnectedApplicationError ? error.message : "Não foi possível carregar estes dados. Tente novamente." });
    }).finally(() => { pending.delete(key); });
    pending.set(key, work); return work;
  }
  async function invalidate(keys: ConnectedQuery[]) {
    for (const key of keys) { revisions[key]++; stale.add(key); }
    await Promise.all(keys.map(async key => { await pending.get(key); if (!closed && listeners[key].size) await load(key, true); }));
  }
  async function sendCommand(entry: PendingRequest): Promise<unknown> {
    checkOpen();
    if (writing) throw new ConnectedApplicationError("BUSY", "Aguarde a confirmação do envio em andamento.");
    if (pendingCommand && (pendingCommand.command !== entry.command || pendingCommand.fingerprint !== entry.fingerprint)) {
      throw new ConnectedApplicationError("PENDING_COMMAND", "Confirme o envio pendente no aviso da sessão antes de salvar outra alteração.");
    }
    const retrying = pendingCommand !== null;
    const retained = pendingCommand ?? entry;
    writing = true;
    if (retrying) commandFeedback({ status: "pending", retrying: true, message: "Confirmando o envio anterior…" });
    else commandFeedback(IDLE_COMMAND);
    try {
      const body = await request("/api/capture-tasks", { command: retained.command, input: structuredClone(retained.input) });
      if (!record(body) || body.ok !== true || !Object.hasOwn(body, "result")) invalidResponse(true);
      try {
        if (retained.command === "capture.convert") {
          if (!record(body.result)) invalidResponse();
          assertItem(body.result.captura, "captures", userId); assertItem(body.result.tarefa, "tasks", userId);
        } else assertItem(body.result, retained.command.startsWith("capture.") ? "captures" : "tasks", userId);
      } catch (error) {
        if (error instanceof ConnectedApplicationError && error.code === "SESSION_CHANGED") { close(true); throw error; }
        invalidResponse(true);
      }
      pendingCommand = null;
      await invalidate(retained.keys);
      checkOpen();
      if (retrying) {
        const converted = retained.command === "capture.convert";
        const item = converted && record(body.result) ? body.result.tarefa : body.result;
        if (record(item) && typeof item.id === "string") commandFeedback({ status: "confirmed", clientId: retained.clientId,
          href: `${converted || retained.command.startsWith("task.") ? "/tarefas?task=" : "/capturar?capture="}${encodeURIComponent(item.id)}`,
          label: converted || retained.command.startsWith("task.") ? "Abrir tarefa" : "Abrir nota" });
      }
      return body.result;
    } catch (error) {
      // The channel checks the exact receipt before validating a new write. With
      // the same immutable input/actor, its VALIDATION response is definitive.
      if (!closed && retrying && error instanceof ConnectedApplicationError && error.code === "VALIDATION") {
        pendingCommand = null;
        commandFeedback({ status: "rejected", clientId: retained.clientId, message: error.message });
      } else if (!closed && (retrying || isCommandOutcomeUnknown(error))) {
        pendingCommand = retained;
        commandFeedback({ status: "pending", retrying: false, message: error instanceof ConnectedApplicationError ? error.message : "Não foi possível confirmar o envio. Tente novamente." });
      }
      throw error;
    } finally { writing = false; }
  }
  function command<I, O>(name: string, keys: ConnectedQuery[]) {
    return async (input: I): Promise<O> => {
      checkOpen();
      if (!record(input) || typeof input.client_id !== "string" || !input.client_id.trim()) throw new ConnectedApplicationError("VALIDATION", "Informe o identificador do envio.");
      if (record(input)) {
        const fields = record(input.patch) ? input.patch : input;
        if (Array.isArray(fields.attachments) && fields.attachments.length) throw new ConnectedApplicationError("UNAVAILABLE", "Anexos ainda não estão disponíveis na conta conectada.");
        if (name === "capture.organize" && input.destination === "knowledge") throw new ConnectedApplicationError("UNAVAILABLE", "Guardar em Conhecimento ainda não está disponível na conta conectada.");
      }
      return await sendCommand({ command: name, clientId: input.client_id, input: structuredClone(input), fingerprint: assinatura(input), keys: [...keys] }) as O;
    };
  }
  const tasks: DemoApplication["commands"]["tasks"] = {
    create: command("task.create", ["tasks"]), update: command("task.update", ["tasks"]), status: command("task.status", ["tasks"]),
    remove: command("task.delete", ["tasks"]), restore: command("task.restore", ["tasks"]),
  };
  const captures: DemoApplication["commands"]["captures"] = {
    create: command("capture.create", ["captures"]), update: command("capture.update", ["captures"]), archive: command("capture.archive", ["captures"]),
    unarchive: command("capture.unarchive", ["captures"]), remove: command("capture.delete", ["captures"]), restore: command("capture.restore", ["captures"]),
    organize: command("capture.organize", ["captures"]), convert: command("capture.convert", ["captures", "tasks"]),
  };
  return {
    ...demo, mode: "connected", clock: { now }, today: () => diaCivilDe(now()), commands: { ...demo.commands, tasks, captures },
    getSnapshot: <K extends DemoQueryKey>(key: K): QueryState<DemoQueries[K]> => isConnectedQuery(key) ? states[key] as QueryState<DemoQueries[K]> : demo.getSnapshot(key),
    subscribe(key, listener) {
      if (closed) return () => undefined;
      subscribers.add(listener);
      const stop = isConnectedQuery(key) ? (listeners[key].add(listener), () => { listeners[key].delete(listener); }) : demo.subscribe(key, listener);
      return () => { subscribers.delete(listener); stop(); };
    },
    getCommandSnapshot: () => feedback,
    subscribeCommands(listener) { commandListeners.add(listener); return () => { commandListeners.delete(listener); }; },
    retryPendingCommand: async () => { checkOpen(); return pendingCommand ? sendCommand(pendingCommand) : undefined; },
    clearCommandFeedback() { if (feedback.status === "confirmed" || feedback.status === "rejected") commandFeedback(IDLE_COMMAND); },
    load,
    refreshActive: async () => { await Promise.all(connectedKeys.filter(key => listeners[key].size).map(key => load(key, true))); },
    async setProjectVisibility(visible) { if (visible === projectsVisible || closed) return; projectsVisible = visible; await Promise.all([demo.setProjectVisibility(visible), invalidate(connectedKeys)]); },
    failNextRead(key) { if (isConnectedQuery(key)) throw new Error("Falhas simuladas não estão disponíveis para dados salvos."); demo.failNextRead(key); },
    stageImage() { throw new ConnectedApplicationError("UNAVAILABLE", "Anexos ainda não estão disponíveis na conta conectada."); },
    getImage: () => undefined, dropImage: () => undefined,
    dispose() { close(); },
  };
}
