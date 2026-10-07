import { criarAdapterMemoria, type EstadoInicialMemoria, type PontoDeFalha } from "../../adapters/memory";
import type { ContextoDeEscrita, DependenciasDeDominio, UnitOfWork } from "../../core/contracts";
import { criarTarefa, editarTarefa, alterarStatusTarefa, excluirTarefa, restaurarTarefa } from "../../core/tarefas";
import { criarCaptura, editarCaptura, converterCapturaEmTarefa, arquivarCaptura, excluirCaptura, restaurarCaptura, organizarCaptura, desarquivarCaptura } from "../../core/capturas";
import { marcarHabito, registrarPausaHabito } from "../../core/habitos";
import { diaCivilDe } from "../../core/tempo";
import { createDemoFixture, DEMO_NOW, DEMO_USER_ID } from "./fixtures";
import type { AgendaEvent, DemoQueries, DemoQueryKey, QueryState } from "./types";
import type { DemoCaptureImage } from "./capture-extras";

export interface DemoApplicationOptions {
  userId?: string;
  clock?: DependenciasDeDominio["clock"];
  ids?: DependenciasDeDominio["ids"];
  initial?: EstadoInicialMemoria;
  agenda?: AgendaEvent[];
  /** Infrastructure seams, used by tests and the explicit demonstration scenarios. */
  beforeOperation?: (point: PontoDeFalha, query: DemoQueryKey | null) => void;
  onQuery?: (key: DemoQueryKey) => void;
}
const keys: DemoQueryKey[] = ["tasks", "captures", "habits", "finance", "agenda"];
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
  const agenda = structuredClone(options.agenda ?? (options.initial ? [] : fixture.agenda));
  const context: ContextoDeEscrita = { user_id: userId, canal: "web" };
  const states: { [K in DemoQueryKey]: QueryState<DemoQueries[K]> } = { tasks: idle(), captures: idle(), habits: idle(), finance: idle(), agenda: idle() };
  const listeners = new Map(keys.map((key) => [key, new Set<() => void>()]));
  const pending = new Map<DemoQueryKey, Promise<void>>();
  const stale = new Set<DemoQueryKey>(keys);
  const images = new Map<string, DemoCaptureImage>();

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
      const all = { includeArchived: true, includeDeleted: true };
      const projects = () => projectsVisible ? ports.projetos.list() : Promise.resolve([]);
      let result: Promise<DemoQueries[DemoQueryKey]>;
      switch (key) {
        case "tasks": result = Promise.all([ports.tarefas.list(all), ports.categorias.list(), projects()]).then(([items, categories, projects]) => ({ items, categories, projects })); break;
        case "captures": result = Promise.all([ports.capturas.list(all), ports.categorias.list(), projects()]).then(([items, categories, projects]) => ({ items, categories, projects })); break;
        case "habits": result = Promise.all([ports.habitos.list(all), ports.marcacoes.list(), ports.pausas.list()]).then(([items, entries, pauses]) => ({ items, entries, pauses })); break;
        case "finance": result = Promise.all([ports.financeiro.contas.list(all), ports.financeiro.categorias.list(), ports.financeiro.lancamentos.list(all), ports.financeiro.orcamentos.list()]).then(([accounts, categories, transactions, budgets]) => ({ accounts, categories, transactions, budgets })); break;
        case "agenda": options.beforeOperation?.("read", key); result = Promise.resolve({ items: structuredClone(agenda) }); break;
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
    async setProjectVisibility(visible: boolean) {
      if (visible === projectsVisible || closed) return;
      projectsVisible = visible;
      await invalidate(["tasks", "captures"]);
    },
    commands: {
      tasks: { create: command(criarTarefa, ["tasks"]), update: command(editarTarefa, ["tasks"]), status: command(alterarStatusTarefa, ["tasks"]), remove: command(excluirTarefa, ["tasks"]), restore: command(restaurarTarefa, ["tasks"]) },
      captures: { create: command(criarCaptura, ["captures"]), update: command(editarCaptura, ["captures"]), convert: command(converterCapturaEmTarefa, ["captures", "tasks"]), archive: command(arquivarCaptura, ["captures"]), remove: command(excluirCaptura, ["captures"]), restore: command(restaurarCaptura, ["captures"]), organize: command(organizarCaptura, ["captures"]), unarchive: command(desarquivarCaptura, ["captures"]) },
      habits: { mark: command(marcarHabito, ["habits"]), pause: command(registrarPausaHabito, ["habits"]) },
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
      closed = true; images.clear(); pending.clear();
      for (const key of keys) { states[key] = idle(); listeners.get(key)!.clear(); }
    },
  };
}
export type DemoApplication = ReturnType<typeof createDemoApplication>;
