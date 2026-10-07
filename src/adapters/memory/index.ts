import { assinatura, ErroDeDominio, exigir, instanteValido, naoEncontrado, type ContextoDeEscrita, type DependenciasDeDominio } from "../../core/contracts/base";
import type { ConsultaLista, Entidades, EventoDominio, Leitor, LeituraDosModulos, Repositorio, TipoEntidade } from "../../core/contracts/modules";
import type { ReciboIdempotente, Transacao, UnitOfWork } from "../../core/contracts/unit-of-work";

const entityTypes: readonly TipoEntidade[] = ["capture", "task", "category", "project", "habit", "habit_entry", "habit_pause", "finance_account", "finance_category", "finance_transaction", "finance_budget"];
type AnyEntity = Entidades[TipoEntidade];
export type EstadoInicialMemoria = Partial<{ [K in TipoEntidade]: readonly Entidades[K][] }>;
export type PontoDeFalha = "read" | "write" | "event" | "commit";
export interface OpcoesMemoria extends DependenciasDeDominio {
  initial?: EstadoInicialMemoria;
  /** Optional infrastructure fault seam for a reusable contract harness. */
  beforeOperation?: (point: PontoDeFalha) => void;
}
interface State {
  records: Map<TipoEntidade, Map<string, AnyEntity>>;
  events: EventoDominio[];
  receipts: Map<string, ReciboIdempotente>;
  usedIds: Set<string>;
}
interface Change { type: TipoEntidade; id: string; before: AnyEntity | null; after: AnyEntity | null }
function records<K extends TipoEntidade>(state: State, type: K): Map<string, Entidades[K]> {
  return state.records.get(type)! as Map<string, Entidades[K]>;
}
const copy = <T>(value: T): T => structuredClone(value);
const receiptKey = (userId: string, command: string, clientId: string) => JSON.stringify([userId, command, clientId]);
function takeId(state: State, id: string) {
  exigir(typeof id === "string" && id.trim().length > 0, "Identificador inválido.");
  if (state.usedIds.has(id)) throw new ErroDeDominio("CONFLICT", "Identificador já utilizado.");
  state.usedIds.add(id);
}
function checkReferences(state: State) {
  const own = (type: TipoEntidade, id: string | null, userId: string) => {
    if (id === null) return;
    if (records(state, type).get(id)?.user_id !== userId) naoEncontrado();
  };
  for (const row of records(state, "capture").values()) {
    own("category", row.category_id, row.user_id); own("project", row.project_id, row.user_id); own("task", row.converted_task_id, row.user_id);
    for (const id of row.linked_capture_ids ?? []) { own("capture", id, row.user_id); exigir(id !== row.id, "Uma captura não pode vincular a si mesma."); }
    if (row.converted_task_id && records(state, "task").get(row.converted_task_id)?.origin_capture_id !== row.id) throw new ErroDeDominio("CONFLICT", "Origem da conversão inconsistente.");
  }
  for (const row of records(state, "task").values()) {
    own("category", row.category_id, row.user_id); own("project", row.project_id, row.user_id); own("capture", row.origin_capture_id, row.user_id);
    if (row.origin_capture_id && records(state, "capture").get(row.origin_capture_id)?.converted_task_id !== row.id) throw new ErroDeDominio("CONFLICT", "Origem da conversão inconsistente.");
  }
  const marks = new Set<string>();
  for (const row of records(state, "habit_entry").values()) {
    own("habit", row.habit_id, row.user_id);
    const key = JSON.stringify([row.user_id, row.habit_id, row.done_on]);
    if (marks.has(key)) throw new ErroDeDominio("CONFLICT", "O hábito já está marcado neste dia.");
    marks.add(key);
  }
  for (const row of records(state, "habit_pause").values()) own("habit", row.habit_id, row.user_id);
  for (const row of records(state, "finance_category").values()) own("finance_category", row.parent_id, row.user_id);
  for (const row of records(state, "finance_transaction").values()) { own("finance_account", row.account_id, row.user_id); own("finance_category", row.category_id, row.user_id); }
  for (const row of records(state, "finance_budget").values()) own("finance_category", row.category_id, row.user_id);
}

/** Per-instance, serializable, disposable reference adapter. No global state or I/O. */
export function criarAdapterMemoria(options: OpcoesMemoria): UnitOfWork {
  let state: State = { records: new Map(entityTypes.map((type) => [type, new Map()])), events: [], receipts: new Map(), usedIds: new Set() };
  for (const type of entityTypes) for (const row of options.initial?.[type] ?? []) {
    exigir(typeof row.user_id === "string" && row.user_id.length > 0, "Usuário obrigatório.");
    takeId(state, row.id);
    records(state, type).set(row.id, copy(row));
  }
  checkReferences(state);
  let queue: Promise<void> = Promise.resolve();
  const checkpoint = (point: PontoDeFalha) => options.beforeOperation?.(point);

  function reader<K extends TipoEntidade>(current: () => State, userId: string, type: K, guard: () => void): Leitor<Entidades[K]> {
    return {
      async get(id) { guard(); checkpoint("read"); const row = records(current(), type).get(id); return row?.user_id === userId ? copy(row) : null; },
      async list(query: ConsultaLista = {}) {
        guard(); checkpoint("read");
        return [...records(current(), type).values()].filter((row) => row.user_id === userId &&
          (query.includeDeleted || !("deleted_at" in row && row.deleted_at)) &&
          (query.includeArchived || !("archived_at" in row && row.archived_at) && !("status" in row && row.status === "archived")))
          .sort((a, b) => ("created_at" in a ? a.created_at : "").localeCompare("created_at" in b ? b.created_at : "") || a.id.localeCompare(b.id)).map(copy);
      },
    };
  }
  function makePorts(current: () => State, userId: string, guard: () => void, changes?: Change[]): LeituraDosModulos {
    function repo<K extends TipoEntidade>(type: K): Leitor<Entidades[K]> | Repositorio<Entidades[K]> {
      const reads = reader(current, userId, type, guard);
      if (!changes) return reads;
      function checkOwner(value: Entidades[K]) { exigir(value.user_id === userId, "A escrita deve pertencer ao usuário da transação."); }
      return { ...reads,
        async insert(value) {
          guard(); checkpoint("write"); checkOwner(value); const snapshot = copy(value);
          takeId(current(), snapshot.id); records(current(), type).set(snapshot.id, snapshot);
          changes!.push({ type, id: snapshot.id, before: null, after: copy(snapshot) });
        },
        async replace(value) {
          guard(); checkpoint("write"); const before = records(current(), type).get(value.id);
          if (!before || before.user_id !== userId) naoEncontrado();
          checkOwner(value); const snapshot = copy(value);
          if ("client_id" in before && "client_id" in snapshot) exigir(before.client_id === snapshot.client_id, "client_id de criação é imutável.");
          if ("created_at" in before && "created_at" in snapshot) exigir(before.created_at === snapshot.created_at, "Instante de criação é imutável.");
          if ("origin_capture_id" in before && "origin_capture_id" in snapshot) exigir(before.origin_capture_id === snapshot.origin_capture_id && before.source === snapshot.source, "Origem da tarefa é imutável.");
          if ("converted_task_id" in before && "converted_task_id" in snapshot) exigir((before.converted_task_id === null || before.converted_task_id === snapshot.converted_task_id) && before.captured_at === snapshot.captured_at, "Origem da captura é imutável.");
          records(current(), type).set(snapshot.id, snapshot);
          changes!.push({ type, id: snapshot.id, before: copy(before), after: copy(snapshot) });
        },
        async remove(id) {
          guard(); checkpoint("write");
          exigir(type === "habit_entry", "Use exclusão lógica ou arquivamento para este registro.");
          const before = records(current(), type).get(id);
          if (!before || before.user_id !== userId) naoEncontrado();
          records(current(), type).delete(id); changes!.push({ type, id, before: copy(before), after: null });
        },
      };
    }
    return {
      capturas: repo("capture"), tarefas: repo("task"), categorias: repo("category"), projetos: repo("project"),
      habitos: repo("habit"), marcacoes: repo("habit_entry"), pausas: repo("habit_pause"),
      financeiro: { contas: repo("finance_account"), categorias: repo("finance_category"), lancamentos: repo("finance_transaction"), orcamentos: repo("finance_budget") },
      eventos: { async list() { guard(); checkpoint("read"); return current().events.filter((event) => event.user_id === userId).map(copy); } },
    };
  }
  return {
    read(userId) {
      exigir(typeof userId === "string" && userId.trim().length > 0, "Usuário obrigatório.");
      return makePorts(() => state, userId, () => undefined);
    },
    async transaction<T>(supplied: ContextoDeEscrita, work: (tx: Transacao) => Promise<T>): Promise<T> {
      const context = copy(supplied);
      exigir(typeof context.user_id === "string" && context.user_id.trim().length > 0 && ["web", "api", "cron"].includes(context.canal), "Contexto da escrita inválido.");
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      let active = true;
      const guard = () => { if (!active) throw new ErroDeDominio("TRANSACTION_CLOSED", "Transação encerrada."); };
      try {
        const draft = copy(state);
        const changes: Change[] = [];
        const appended: EventoDominio[] = [];
        const ports = makePorts(() => draft, context.user_id, guard, changes);
        const tx = { ...ports,
          eventos: { ...ports.eventos, async append(event: EventoDominio) {
            guard(); checkpoint("event");
            exigir(event.user_id === context.user_id && event.canal === context.canal && entityTypes.includes(event.entity_type), "Evento fora do contexto da transação.");
            exigir(["created", "updated", "deleted", "restored", "status_changed"].includes(event.action), "Ação do evento inválida.");
            exigir(event.action === "created" ? event.before === null && event.after !== null : event.before !== null && (event.action === "deleted" || event.after !== null), "Ação incompatível com os estados do evento.");
            exigir(event.occurred_at !== null && instanteValido(event.occurred_at), "Instante do evento inválido.");
            for (const snapshot of [event.before, event.after]) if (snapshot) exigir(snapshot.id === event.entity_id && snapshot.user_id === context.user_id, "Estado do evento pertence a outro registro.");
            takeId(draft, event.id); const snapshot = copy(event); draft.events.push(snapshot); appended.push(snapshot);
          } },
          recibos: {
            async get(command: string, clientId: string) { guard(); checkpoint("read"); return copy(draft.receipts.get(receiptKey(context.user_id, command, clientId)) ?? null); },
            async insert(receipt: ReciboIdempotente) {
              guard(); checkpoint("write"); exigir(receipt.user_id === context.user_id, "Recibo fora do contexto da transação.");
              exigir(typeof receipt.command === "string" && receipt.command.length > 0 && typeof receipt.client_id === "string" && receipt.client_id.length > 0 && typeof receipt.fingerprint === "string" && receipt.fingerprint.length > 0, "Recibo inválido.");
              const key = receiptKey(context.user_id, receipt.command, receipt.client_id);
              if (draft.receipts.has(key)) throw new ErroDeDominio("CONFLICT", "Recibo já registrado.");
              draft.receipts.set(key, copy(receipt));
            },
          },
        } as Transacao;
        const result = await work(tx);
        const remaining = [...appended];
        for (const change of changes) {
          const index = remaining.findIndex((event) => event.entity_type === change.type && event.entity_id === change.id && assinatura(event.before) === assinatura(change.before) && assinatura(event.after) === assinatura(change.after));
          if (index < 0) throw new ErroDeDominio("EVENT_REQUIRED", "A escrita exige seu evento na mesma transação.");
          remaining.splice(index, 1);
        }
        if (remaining.length) throw new ErroDeDominio("EVENT_REQUIRED", "Evento sem escrita correspondente.");
        checkReferences(draft);
        const output = copy(result);
        checkpoint("commit"); state = draft;
        return output;
      } finally { active = false; release(); }
    },
  };
}
