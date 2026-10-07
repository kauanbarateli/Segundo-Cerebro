import { exigir, instanteValido, naoEncontrado, type ContextoDeEscrita, type DependenciasDeDominio } from "../contracts/base";
import { emitirEvento, executarComando } from "../contracts/operations";
import type { MarcacaoHabito, PausaDoUsuario } from "../contracts/modules";
import type { UnitOfWork } from "../contracts/unit-of-work";
import { diaCivilDe, SO_DATA } from "../tempo/tempo";
import { eraEsperado, estaPausado } from "./habits";

export interface MarcacaoDeHabito {
  habit_id: string;
  done_on: string;
  done: boolean;
  client_id: string;
}

export interface NovaPausaHabito {
  /** null pausa todos os hábitos deste usuário. */
  habit_id: string | null;
  starts_on: string;
  ends_on: string | null;
  reason: string | null;
  client_id: string;
}

function conferirDia(value: unknown): asserts value is string {
  exigir(typeof value === "string" && SO_DATA.test(value) && instanteValido(`${value}T00:00:00Z`), "Informe um dia válido no formato AAAA-MM-DD.");
}

/**
 * Estado desejado explícito, em vez do toggle não idempotente do legado.
 * O teto é hoje no fuso do produto; a antiga folga UTC+2 não é necessária.
 */
export function marcarHabito(
  store: UnitOfWork,
  deps: DependenciasDeDominio,
  context: ContextoDeEscrita,
  input: MarcacaoDeHabito,
): Promise<MarcacaoHabito | null> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "habit.mark", input.client_id, input, async (tx) => {
    exigir(typeof input.habit_id === "string" && input.habit_id.trim().length > 0, "Informe o hábito.");
    exigir(typeof input.done === "boolean", "Informe se o hábito foi cumprido.");
    conferirDia(input.done_on);
    const habit = await tx.habitos.get(input.habit_id);
    if (!habit || habit.user_id !== context.user_id) naoEncontrado();
    exigir(habit.archived_at === null, "Restaure o hábito antes de alterar suas marcações.");
    exigir(input.done_on >= habit.started_on, "O dia não pode ser anterior ao início do hábito.");
    const now = deps.clock.now();
    exigir(instanteValido(now), "Relógio do aplicativo inválido.");
    exigir(input.done_on <= diaCivilDe(now), "Não dá para marcar um dia no futuro.");
    const existing = (await tx.marcacoes.list()).find((entry) => entry.habit_id === habit.id && entry.done_on === input.done_on);

    if (!input.done) {
      // Uma pausa/cadência alterada depois da marcação não impede desfazer.
      if (existing) {
        await tx.marcacoes.remove(existing.id);
        await emitirEvento(tx, deps, context, "habit_entry", existing, null, "deleted");
      }
      return null;
    }
    if (existing) return existing;

    const pauses = await tx.pausas.list();
    exigir(!estaPausado(habit.id, input.done_on, pauses), "O hábito estava pausado neste dia.");
    exigir(habit.schedule_kind === "weekly_target" || eraEsperado(habit, input.done_on, pauses), "Este dia não pertence à cadência do hábito.");
    const entry: MarcacaoHabito = { id: deps.ids.next(), user_id: context.user_id, habit_id: habit.id, done_on: input.done_on, note: null, created_at: now };
    await tx.marcacoes.insert(entry);
    await emitirEvento(tx, deps, context, "habit_entry", null, entry, "created");
    return entry;
  });
}

/** Pausas podem ser passadas, futuras ou abertas, como no contrato legado. */
export function registrarPausaHabito(
  store: UnitOfWork,
  deps: DependenciasDeDominio,
  context: ContextoDeEscrita,
  input: NovaPausaHabito,
): Promise<PausaDoUsuario> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "habit.pause.create", input.client_id, input, async (tx) => {
    exigir(input.habit_id === null || typeof input.habit_id === "string" && input.habit_id.trim().length > 0, "Informe o hábito ou uma pausa geral.");
    conferirDia(input.starts_on);
    if (input.ends_on !== null) conferirDia(input.ends_on);
    exigir(input.ends_on === null || input.ends_on >= input.starts_on, "O fim não pode ser antes do começo.");
    exigir(input.reason === null || typeof input.reason === "string" && input.reason.trim().length <= 200, "O motivo deve ter até 200 caracteres.");
    if (input.habit_id !== null) {
      const habit = await tx.habitos.get(input.habit_id);
      if (!habit || habit.user_id !== context.user_id) naoEncontrado();
      exigir(habit.archived_at === null, "Restaure o hábito antes de registrar uma pausa.");
      exigir(input.starts_on >= habit.started_on, "A pausa não pode começar antes do hábito.");
    }
    const now = deps.clock.now();
    exigir(instanteValido(now), "Relógio do aplicativo inválido.");
    const pause: PausaDoUsuario = { id: deps.ids.next(), user_id: context.user_id, habit_id: input.habit_id,
      starts_on: input.starts_on, ends_on: input.ends_on, reason: input.reason?.trim() || null, created_at: now };
    await tx.pausas.insert(pause);
    await emitirEvento(tx, deps, context, "habit_pause", null, pause, "created");
    return pause;
  });
}
