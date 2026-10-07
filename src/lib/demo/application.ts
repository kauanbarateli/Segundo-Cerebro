import { criarAdapterMemoria, type EstadoInicialMemoria, type PontoDeFalha } from "../../adapters/memory";
import type { ContextoDeEscrita, DependenciasDeDominio, UnitOfWork } from "../../core/contracts";
import { criarTarefa, editarTarefa, alterarStatusTarefa, excluirTarefa, restaurarTarefa } from "../../core/tarefas";
import { criarCaptura, editarCaptura, converterCapturaEmTarefa, arquivarCaptura, excluirCaptura, restaurarCaptura, organizarCaptura, desarquivarCaptura } from "../../core/capturas";
import { marcarHabito, registrarPausaHabito } from "../../core/habitos";
import { criarContaFinanceira, editarContaFinanceira, criarCategoriaFinanceira, editarCategoriaFinanceira, criarLancamentoFinanceiro, editarLancamentoFinanceiro, excluirLancamentoFinanceiro, restaurarLancamentoFinanceiro, salvarOrcamentoFinanceiro } from "../../core/financeiro";
import { diaCivilDe } from "../../core/tempo";
import { createDemoFixture, DEMO_NOW, DEMO_USER_ID } from "./fixtures";
import type { AgendaEvent, DemoQueries, DemoQueryKey, DemoReadOnlyData, QueryState } from "./types";
import type { DemoCaptureImage } from "./capture-extras";
import { additionalAgendaFixture, createModuleFixture, emptyModuleFixture } from "./module-fixtures";

export interface DemoApplicationOptions {
  userId?: string;
  clock?: DependenciasDeDominio["clock"];
  ids?: DependenciasDeDominio["ids"];
  initial?: EstadoInicialMemoria;
  agenda?: AgendaEvent[];
  modules?: DemoReadOnlyData;
  /** Infrastructure seams, used by tests and the explicit demonstration scenarios. */
  beforeOperation?: (point: PontoDeFalha, query: DemoQueryKey | null) => void;
  onQuery?: (key: DemoQueryKey) => void;
}
const keys: DemoQueryKey[] = ["tasks", "captures", "habits", "finance", "agenda", "knowledge", "projects", "drive", "vault", "settings"];
const idle = <T>(): QueryState<T> => ({ status: "idle", data: null, error: null });
function freezeSnapshot<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeSnapshot(child);
  }
  return value;
}

/** One domain instance per mounted user session. No browser globals during creation. */
export function createDemoApplication(options: DemoApplicationOptions = {}) {
  const userId = options.userId ?? DEMO_USER_ID;
  const deps: DependenciasDeDominio = {
    clock: options.clock ?? { now: () => DEMO_NOW }, ids: options.ids ?? { next: () => crypto.randomUUID() },
  };
  const fixture = createDemoFixture(deps.clock.now(), userId);
  let reading: DemoQueryKey | null = null;
  let closed = false;
  let projectsVisible = true;
  const store = criarAdapterMemoria({ ...deps, initial: options.initial ?? fixture.initial, beforeOperation: (point) => options.beforeOperation?.(point, reading) });
  const agenda = structuredClone(options.agenda ?? (options.initial ? [] : [...fixture.agenda.map((event) => ({ ...event, calendar_id: event.habit_id ? "calendar-personal" : "calendar-work", all_day: false })), ...additionalAgendaFixture(deps.clock.now())]));
  const modules = structuredClone(options.modules ?? (options.initial ? emptyModuleFixture() : createModuleFixture(deps.clock.now())));
  const context: ContextoDeEscrita = { user_id: userId, canal: "web" };
  const states: { [K in DemoQueryKey]: QueryState<DemoQueries[K]> } = { tasks: idle(), captures: idle(), habits: idle(), finance: idle(), agenda: idle(), knowledge: idle(), projects: idle(), drive: idle(), vault: idle(), settings: idle() };
  const listeners = new Map(keys.map((key) => [key, new Set<() => void>()]));
  const pending = new Map<DemoQueryKey, Promise<void>>();
  const stale = new Set<DemoQueryKey>(keys);
  const images = new Map<string, DemoCaptureImage>();
  const failingReads = new Set<DemoQueryKey>();

  function checkOpen() { if (closed) throw new Error("Esta sessão de demonstração foi encerrada."); }
  function publish<K extends DemoQueryKey>(key: K, state: QueryState<DemoQueries[K]>) {
    if (closed) return;
    // The key/data relationship is checked by this generic boundary.
    states[key] = freezeSnapshot(state) as (typeof states)[K];
    for (const listener of listeners.get(key)!) listener();
  }
  function readQuery<K extends DemoQueryKey>(key: K): Promise<DemoQueries[K]> {
    checkOpen();
    const ports = store.read(userId);
    reading = key;
    try {
      options.onQuery?.(key);
      if (failingReads.delete(key)) throw new Error("Falha de leitura de demonstração.");
      const all = { includeArchived: true, includeDeleted: true };
      const projects = () => projectsVisible ? ports.projetos.list() : Promise.resolve([]);
      let result: Promise<DemoQueries[DemoQueryKey]>;
      switch (key) {
        case "tasks": result = Promise.all([ports.tarefas.list(all), ports.categorias.list(), projects()]).then(([items, categories, projects]) => ({ items, categories, projects })); break;
        case "captures": result = Promise.all([ports.capturas.list(all), ports.categorias.list(), projects()]).then(([items, categories, projects]) => ({ items, categories, projects })); break;
        case "habits": result = Promise.all([ports.habitos.list(all), ports.marcacoes.list(), ports.pausas.list()]).then(([items, entries, pauses]) => ({ items, entries, pauses })); break;
        case "finance": result = Promise.all([ports.financeiro.contas.list(all), ports.financeiro.categorias.list(), ports.financeiro.lancamentos.list(all), ports.financeiro.orcamentos.list()]).then(([accounts, categories, transactions, budgets]) => ({ accounts, categories, transactions, budgets })); break;
        case "agenda": options.beforeOperation?.("read", key); result = Promise.resolve({ items: structuredClone(agenda), calendars: structuredClone(modules.calendars) }); break;
        case "knowledge": result = ports.capturas.list().then((items) => ({ items: items.filter((item) => item.status === "organized"), notebooks: structuredClone(modules.notebooks), memberships: structuredClone(modules.memberships) })); break;
        case "projects": result = ports.projetos.list().then((items) => ({ items })); break;
        case "drive": case "vault": case "settings": options.beforeOperation?.("read", key); result = Promise.resolve(structuredClone(modules[key as "drive" | "vault" | "settings"])); break;
        default: throw new Error("Consulta desconhecida.");
      }
      return result as Promise<DemoQueries[K]>;
    } finally { reading = null; }
  }
  function load<K extends DemoQueryKey>(key: K, force = false): Promise<void> {
    if (closed) return Promise.resolve();
    const current = pending.get(key);
    if (current) return current;
    if (!force && !stale.has(key) && states[key].status === "ready") return Promise.resolve();
    stale.delete(key);
    publish(key, { status: "loading", data: states[key].data, error: null });
    const work = Promise.resolve().then(() => readQuery(key)).then(
      (data) => publish(key, { status: "ready", data, error: null }),
      () => publish(key, { status: "error", data: null, error: "Não foi possível carregar estes dados. Tente de novo." }),
    ).finally(() => { pending.delete(key); });
    pending.set(key, work);
    return work;
  }
  async function invalidate(affected: readonly DemoQueryKey[]) {
    for (const key of affected) stale.add(key);
    await Promise.all(affected.map(async (key) => {
      await pending.get(key);
      // A module hidden/unmounted since the command started is not queried again.
      if (listeners.get(key)!.size > 0 && !closed) await load(key, true);
    }));
  }
  function command<I, O>(fn: (store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: I) => Promise<O>, affected: readonly DemoQueryKey[]) {
    return async (input: I): Promise<O> => {
      checkOpen();
      const result = await fn(store, deps, context, input);
      checkOpen();
      await invalidate(affected);
      return result;
    };
  }
  return {
    userId, clock: deps.clock, today: () => diaCivilDe(deps.clock.now()),
    getSnapshot: <K extends DemoQueryKey>(key: K): QueryState<DemoQueries[K]> => states[key],
    subscribe(key: DemoQueryKey, listener: () => void) {
      checkOpen(); listeners.get(key)!.add(listener);
      return () => { listeners.get(key)!.delete(listener); };
    },
    load,
    failNextRead(key: DemoQueryKey) {
      checkOpen();
      if (!keys.includes(key)) throw new Error("Consulta desconhecida.");
      failingReads.add(key); stale.add(key);
      // A hidden module is not queried just to plant its failure.
      if (listeners.get(key)!.size > 0) void invalidate([key]);
    },
    async setProjectVisibility(visible: boolean) {
      if (visible === projectsVisible || closed) return;
      projectsVisible = visible;
      await invalidate(["tasks", "captures"]);
    },
    commands: {
      tasks: { create: command(criarTarefa, ["tasks"]), update: command(editarTarefa, ["tasks"]), status: command(alterarStatusTarefa, ["tasks"]), remove: command(excluirTarefa, ["tasks"]), restore: command(restaurarTarefa, ["tasks"]) },
      captures: { create: command(criarCaptura, ["captures", "knowledge"]), update: command(editarCaptura, ["captures", "knowledge"]), convert: command(converterCapturaEmTarefa, ["captures", "knowledge", "tasks"]), archive: command(arquivarCaptura, ["captures", "knowledge"]), remove: command(excluirCaptura, ["captures", "knowledge"]), restore: command(restaurarCaptura, ["captures", "knowledge"]), organize: command(organizarCaptura, ["captures", "knowledge"]), unarchive: command(desarquivarCaptura, ["captures", "knowledge"]) },
      habits: { mark: command(marcarHabito, ["habits"]), pause: command(registrarPausaHabito, ["habits"]) },
      finance: {
        transactions: { create: command(criarLancamentoFinanceiro, ["finance"]), update: command(editarLancamentoFinanceiro, ["finance"]), remove: command(excluirLancamentoFinanceiro, ["finance"]), restore: command(restaurarLancamentoFinanceiro, ["finance"]) },
        accounts: { create: command(criarContaFinanceira, ["finance"]), update: command(editarContaFinanceira, ["finance"]) },
        categories: { create: command(criarCategoriaFinanceira, ["finance"]), update: command(editarCategoriaFinanceira, ["finance"]) },
        budgets: { save: command(salvarOrcamentoFinanceiro, ["finance"]) },
      },
    },
    stageImage(image: DemoCaptureImage) {
      checkOpen();
      if (!image.id || !image.name || !(image.blob instanceof Blob) || image.bytes !== image.blob.size || image.mime !== image.blob.type || !["image/png", "image/jpeg"].includes(image.mime) || image.bytes <= 0 || image.bytes > 8 * 1024 * 1024 || !Number.isSafeInteger(image.width) || image.width <= 0 || !Number.isSafeInteger(image.height) || image.height <= 0) throw new Error("Imagem preparada inválida.");
      if (images.has(image.id)) throw new Error("Identificador de imagem já utilizado.");
      images.set(image.id, { ...image });
    },
    getImage(id: string): DemoCaptureImage | undefined { const image = images.get(id); return image ? { ...image } : undefined; },
    dropImage(id: string) { images.delete(id); },
    dispose() {
      closed = true; images.clear(); pending.clear(); failingReads.clear();
      for (const key of keys) { states[key] = idle(); listeners.get(key)!.clear(); }
    },
  };
}
export type DemoApplication = ReturnType<typeof createDemoApplication>;
