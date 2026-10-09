import "server-only";
import { assinatura, ErroDeDominio, exigir, instanteValido, naoEncontrado, type ContextoDeEscrita } from "../../core/contracts/base";
import type { EventoDominio, HabitoDoUsuario, MarcacaoHabito, PausaDoUsuario, Projeto, ConsultaLista, Repositorio } from "../../core/contracts/modules";
import type { ReciboIdempotente, UnitOfWork } from "../../core/contracts/unit-of-work";
import type { ProjectContainer, ProjectRead, ProjectTransaction } from "../../core/projetos";
import type { HabitRead, HabitTransaction } from "../../core/habitos";
import { CommitOutcomeUnknown } from "./capture-task-store";

export interface RoutineSnapshot { revision: string; projects: Projeto[]; habits: HabitoDoUsuario[]; entries: MarcacaoHabito[]; pauses: PausaDoUsuario[]; containers: ProjectContainer[]; events: EventoDominio[]; receipts: ReciboIdempotente[] }
export type RoutineKind = "project" | "habit" | "habit_entry" | "habit_pause" | "project_container";
type Row = Projeto | HabitoDoUsuario | MarcacaoHabito | PausaDoUsuario | ProjectContainer;
export interface RoutineChange { type: RoutineKind; before: Row | null; after: Row | null }
export interface RoutineCommit { expectedRevision: string; context: ContextoDeEscrita; changes: RoutineChange[]; events: EventoDominio[]; receipt: ReciboIdempotente }
export interface RoutineGateway { readonly actorId: string; snapshot(): Promise<RoutineSnapshot>; commit(request: RoutineCommit): Promise<{ status: "stale" } | { status: "committed" | "replayed"; result: unknown }>; receipt(command: string, clientId: string): Promise<ReciboIdempotente | null> }
export type RoutineRead = ProjectRead & HabitRead;
export type RoutineTransaction = ProjectTransaction & HabitTransaction;
export type RoutineUnitOfWork = UnitOfWork<RoutineRead, RoutineTransaction>;
const copy = <T>(value: T): T => structuredClone(value);
const same = (a: unknown, b: unknown) => assinatura(a) === assinatura(b);
const key = (r: ReciboIdempotente) => JSON.stringify([r.command, r.client_id]);
const sets = (s: RoutineSnapshot): Record<RoutineKind, Row[]> => ({ project: s.projects, habit: s.habits, habit_entry: s.entries, habit_pause: s.pauses, project_container: s.containers });
export function validateRoutineSnapshot(s: RoutineSnapshot, actor: string) {
  const day = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && instanteValido(`${v}T00:00:00Z`);
  const stamp = (v: unknown) => typeof v === "string" && instanteValido(v);
  exigir(typeof s.revision === "string" && /^(0|[1-9][0-9]*)$/.test(s.revision), "Revisão inválida.");
  for (const rows of Object.values(sets(s))) { exigir(Array.isArray(rows), "Snapshot incompleto."); const ids = new Set<string>(); for (const row of rows) { exigir(row && typeof row === "object" && row.user_id === actor && typeof row.id === "string" && !ids.has(row.id) && stamp(row.created_at), "Registro fora do usuário ou repetido."); ids.add(row.id); } }
  for (const row of s.projects) exigir(typeof row.name === "string" && row.name.trim().length > 0 && (row.description === null || typeof row.description === "string") && typeof row.color_key === "string" && Number.isSafeInteger(row.position) && row.position >= 0 && stamp(row.updated_at) && (row.deleted_at === null || stamp(row.deleted_at)), "Projeto inválido.");
  for (const row of s.habits) exigir(typeof row.name === "string" && row.name.trim().length > 0 && ["daily", "weekdays", "weekly_target"].includes(row.schedule_kind) && Array.isArray(row.weekdays) && row.weekdays.every(value => Number.isInteger(value) && value >= 0 && value <= 6) && new Set(row.weekdays).size === row.weekdays.length && (row.schedule_kind === "weekdays" ? row.weekdays.length > 0 && row.weekly_target === null : row.weekdays.length === 0) && (row.schedule_kind === "weekly_target" ? Number.isInteger(row.weekly_target) && Number(row.weekly_target) >= 1 && Number(row.weekly_target) <= 7 : row.weekly_target === null) && day(row.started_on) && (row.archived_at === null || stamp(row.archived_at)) && stamp(row.updated_at) && typeof row.color_key === "string" && (row.icon_key === null || typeof row.icon_key === "string") && Number.isSafeInteger(row.position) && row.position >= 0, "Hábito inválido.");
  const entries = new Set<string>();
  for (const row of s.entries) { exigir(day(row.done_on) && (row.note === null || typeof row.note === "string") && s.habits.some(habit => habit.id === row.habit_id && row.done_on >= habit.started_on), "Marcação sem hábito do usuário."); const pair = JSON.stringify([row.habit_id, row.done_on]); exigir(!entries.has(pair), "Marcação repetida."); entries.add(pair); }
  for (const row of s.pauses) exigir(day(row.starts_on) && (row.ends_on === null || day(row.ends_on) && row.ends_on >= row.starts_on) && (row.reason === null || typeof row.reason === "string") && (row.habit_id === null || s.habits.some(habit => habit.id === row.habit_id)), "Pausa fora do usuário.");
  for (const row of s.containers) exigir(["capture", "notebook", "folder"].includes(row.kind) && typeof row.name === "string" && (row.parent_id === null || typeof row.parent_id === "string") && (row.deleted_at === null || stamp(row.deleted_at)) && stamp(row.updated_at) && (row.project_id === null || s.projects.some(project => project.id === row.project_id)), "Contêiner fora do projeto do usuário.");
  exigir(Array.isArray(s.events) && Array.isArray(s.receipts), "Snapshot incompleto.");
  const receipts = new Set<string>(); for (const receipt of s.receipts) { exigir(receipt.user_id === actor && /^(project|habit)\./.test(receipt.command) && typeof receipt.client_id === "string" && receipt.client_id.trim().length > 0 && typeof receipt.fingerprint === "string" && !receipts.has(key(receipt)), "Recibo fora do domínio."); receipts.add(key(receipt)); }
  const eventIds = new Set<string>(); for (const event of s.events) { exigir(typeof event.id === "string" && !eventIds.has(event.id) && typeof event.entity_id === "string" && event.user_id === actor && Object.hasOwn(sets(s), event.entity_type) && stamp(event.occurred_at) && ["web", "api", "cron"].includes(event.canal) && ["created", "updated", "deleted", "restored", "status_changed"].includes(event.action), "Evento fora do domínio."); eventIds.add(event.id); for (const row of [event.before, event.after]) exigir(row === null || row && typeof row === "object" && row.id === event.entity_id && row.user_id === actor, "Estado do evento fora do registro."); }
}
function ports(s: RoutineSnapshot, actor: string, guard: () => void, changes?: RoutineChange[]): RoutineTransaction {
  function repo<T extends Row>(type: RoutineKind, rows: T[]): Repositorio<T> {
    return { async get(id) { guard(); return copy(rows.find(row => row.id === id) ?? null); }, async list(query: ConsultaLista = {}) { guard(); return rows.filter(row => (query.includeDeleted || !("deleted_at" in row && row.deleted_at)) && (query.includeArchived || !("archived_at" in row && row.archived_at))).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).map(copy); },
      async insert(row) { guard(); exigir(changes && row.user_id === actor && !rows.some(value => value.id === row.id), "Escrita inválida."); rows.push(copy(row)); changes.push({ type, before: null, after: copy(row) }); },
      async replace(row) { guard(); exigir(changes, "Leitura somente."); const index = rows.findIndex(value => value.id === row.id); if (index < 0) naoEncontrado(); const before = rows[index]!; exigir(before.user_id === row.user_id && row.user_id === actor && before.created_at === row.created_at, "Dono e criação são imutáveis."); rows[index] = copy(row); changes.push({ type, before: copy(before), after: copy(row) }); },
      async remove(id) { guard(); exigir(changes && (type === "habit_entry" || type === "habit_pause"), "Use exclusão lógica."); const index = rows.findIndex(value => value.id === id); if (index < 0) naoEncontrado(); const before = rows.splice(index, 1)[0]!; changes.push({ type, before: copy(before), after: null }); } };
  }
  return { projetos: repo("project", s.projects), habitos: repo("habit", s.habits), marcacoes: repo("habit_entry", s.entries), pausas: repo("habit_pause", s.pauses), containers: repo("project_container", s.containers),
    eventos: { async list() { guard(); return copy(s.events); }, async append() { throw new ErroDeDominio("TRANSACTION_CLOSED", "Evento fora de transação."); } },
    recibos: { async get() { throw new ErroDeDominio("TRANSACTION_CLOSED", "Recibo fora de transação."); }, async insert() { throw new ErroDeDominio("TRANSACTION_CLOSED", "Recibo fora de transação."); } } };
}
export function createRoutineStore(gateway: RoutineGateway): RoutineUnitOfWork {
  const actor = gateway.actorId;
  const snapshot = async () => { const s = copy(await gateway.snapshot()); validateRoutineSnapshot(s, actor); return s; };
  return { read(userId) {
    exigir(userId === actor, "Leitura fora do usuário autenticado.");
    function port<T extends Row>(select: (tx: RoutineTransaction) => Repositorio<T>) {
      return { async get(id: string) { return select(ports(await snapshot(), actor, () => undefined)).get(id); }, async list(query?: ConsultaLista) { return select(ports(await snapshot(), actor, () => undefined)).list(query); } };
    }
    return { projetos: port(tx => tx.projetos), habitos: port(tx => tx.habitos), marcacoes: port(tx => tx.marcacoes), pausas: port(tx => tx.pausas), containers: port(tx => tx.containers!), eventos: { async list() { return copy((await snapshot()).events); } } };
  }, async transaction<T>(context: ContextoDeEscrita, work: (tx: RoutineTransaction) => Promise<T>): Promise<T> {
    context = copy(context); exigir(context.user_id === actor && ["web", "api", "cron"].includes(context.canal), "Escrita fora do usuário.");
    for (let attempt = 0; attempt < 3; attempt++) {
      const initial = await snapshot(), draft = copy(initial), changes: RoutineChange[] = [], events: EventoDominio[] = [], fresh: ReciboIdempotente[] = [];
      let active = true; const guard = () => { if (!active) throw new ErroDeDominio("TRANSACTION_CLOSED", "Transação encerrada."); };
      const tx = ports(draft, actor, guard, changes);
      tx.eventos.append = async event => { guard(); exigir(event.user_id === actor && event.canal === context.canal && Object.hasOwn(sets(draft), event.entity_type) && ![...initial.events, ...events].some(old => old.id === event.id), "Evento fora do contexto."); events.push(copy(event)); };
      tx.recibos.get = async (command, clientId) => { guard(); return copy(initial.receipts.find(r => r.command === command && r.client_id === clientId) ?? null); };
      tx.recibos.insert = async receipt => { guard(); exigir(receipt.user_id === actor && /^(project|habit)\./.test(receipt.command) && ![...initial.receipts, ...fresh].some(old => key(old) === key(receipt)), "Recibo inválido."); fresh.push(copy(receipt)); };
      let result: T; try { result = copy(await work(tx)); } finally { active = false; }
      if (!fresh.length) { exigir(!changes.length && !events.length, "Escrita sem recibo."); return result; }
      exigir(fresh.length === 1 && same(fresh[0]!.result, result), "Comando exige um recibo correspondente."); validateRoutineSnapshot({ ...draft, events: [...draft.events, ...events], receipts: [...draft.receipts, ...fresh] }, actor);
      const remaining = [...events]; for (const change of changes) { const row = change.after ?? change.before; const index = remaining.findIndex(event => event.entity_type === change.type && event.entity_id === row?.id && same(event.before, change.before) && same(event.after, change.after)); if (index < 0) throw new ErroDeDominio("EVENT_REQUIRED", "Escrita sem evento correspondente."); remaining.splice(index, 1); } exigir(!remaining.length, "Evento sem alteração.");
      const receipt = fresh[0]!;
      try { const response = await gateway.commit({ expectedRevision: initial.revision, context, changes, events, receipt }); if (response.status === "stale") continue; if (response.status === "committed" && !same(response.result, result)) throw new CommitOutcomeUnknown(); return copy(response.result) as T; }
      catch (error) { if (!(error instanceof CommitOutcomeUnknown)) throw error; const saved = await gateway.receipt(receipt.command, receipt.client_id); if (!saved) throw error; exigir(saved.user_id === actor && saved.command === receipt.command && saved.client_id === receipt.client_id && saved.fingerprint === receipt.fingerprint, "Recibo de reconciliação inválido."); return copy(saved.result) as T; }
    }
    throw new ErroDeDominio("CONFLICT", "Os dados mudaram. Repita o mesmo envio.");
  } };
}
