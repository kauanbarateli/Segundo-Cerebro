import { assinatura, ErroDeDominio, exigir, naoEncontrado, type ContextoDeEscrita, type DependenciasDeDominio } from "../../contracts/base";
import { diaCivilDe } from "../../tempo";
import { totalExato } from "../arithmetic";
import type { GoalTransaction, GoalUnitOfWork } from "./goal-ports";
import { activeReservationAmount, projectAccountAvailability } from "./goal-projections";
import { decodeFinancialGoal, decodeGoalCommand, decodeGoalHighlight, decodeGoalRelease, decodeGoalReservation, goalCents, goalDay, goalRecord, goalRevision, goalTimestamp, goalUuid } from "./goal-validation";
import type { FinancialGoal, GoalCommand, GoalCommandResult, GoalEvent, GoalFields, GoalHighlight, GoalRow } from "./goal-types";

const clone = <T>(value: T): T => structuredClone(value);
function id(deps: DependenciasDeDominio) { const value = deps.ids.next(); goalUuid(value); return value; }
function revision(value: string) { const next = String(BigInt(value) + 1n); goalRevision(next); return next; }
function same(a: unknown, b: unknown) { return assinatura(a) === assinatura(b); }
function owner(row: { user_id: string }, userId: string) { exigir(row.user_id === userId, "Registro de meta fora do Usuário."); }
function totals(value: unknown, userId: string, rowKey: string, rowId: string, financeRevision: string, fields: readonly string[]) {
  const row = goalRecord(value, ["user_id", rowKey, "finance_revision", ...fields]);
  exigir(row.user_id === userId && row[rowKey] === rowId && row.finance_revision === financeRevision, "Apuração fora do Usuário ou da revisão financeira.");
  goalRevision(row.finance_revision); return row;
}
async function goal(tx: GoalTransaction, userId: string, goalId: string, expected?: string) {
  const raw = await tx.goals.get(goalId); if (raw === null) naoEncontrado(); const value = decodeFinancialGoal(raw);
  if (value.user_id !== userId || value.id !== goalId) naoEncontrado();
  if (expected !== undefined && expected !== value.revision) throw new ErroDeDominio("CONFLICT", "A meta mudou. Confira a versão atual antes de reenviar."); return value;
}
async function highlight(tx: GoalTransaction, userId: string) {
  const raw = await tx.highlights.get(); if (raw === null) return null; const value = decodeGoalHighlight(raw); owner(value, userId); return value;
}
async function image(tx: GoalTransaction, userId: string, fileId: string | null) {
  if (fileId === null) return; const raw = await tx.images.getFinalized(fileId); if (raw === null) naoEncontrado();
  const file = goalRecord(raw, ["id", "user_id", "purpose", "status", "deleted_at"]);
  exigir(file.id === fileId && file.user_id === userId && file.purpose === "finance_goal_image" && file.status === "finalized" && file.deleted_at === null, "A imagem precisa estar finalizada e pertencer ao Usuário.");
}
async function emit(tx: GoalTransaction, deps: DependenciasDeDominio, context: ContextoDeEscrita, kind: GoalEvent["entity_type"], before: GoalRow | null, after: GoalRow, at: string) {
  const action: GoalEvent["action"] = before === null ? "created" : kind === "finance_goal" && (before as FinancialGoal).archived_at !== (after as FinancialGoal).archived_at ? "status_changed" : "updated";
  await tx.events.append({ id: id(deps), user_id: context.user_id, entity_type: kind, entity_id: after.id, action, canal: context.canal, occurred_at: at, before: clone(before), after: clone(after) });
}
async function saveGoal(tx: GoalTransaction, deps: DependenciasDeDominio, context: ContextoDeEscrita, before: FinancialGoal | null, after: FinancialGoal, at: string) {
  if (before !== null && same(before, after)) return; const checked = decodeFinancialGoal(after); owner(checked, context.user_id);
  if (before === null) await tx.goals.insert(clone(checked)); else await tx.goals.replace(clone(checked)); await emit(tx, deps, context, "finance_goal", before, checked, at);
}
async function saveHighlight(tx: GoalTransaction, deps: DependenciasDeDominio, context: ContextoDeEscrita, before: GoalHighlight | null, desired: string | null, at: string) {
  if ((before?.goal_id ?? null) === desired) return clone(before);
  const after = decodeGoalHighlight({ version: 1, id: context.user_id, user_id: context.user_id, goal_id: desired, revision: revision(before?.revision ?? "0"), created_at: before?.created_at ?? at, updated_at: at });
  await tx.highlights.put(clone(after)); await emit(tx, deps, context, "finance_goal_highlight", before, after, at); return after;
}
/** Receipt decoder is also useful to a future server-only gateway. It needs no
 * current account/image/goal data and never turns an unconfirmed intent into a
 * different request just because the visible metadata has changed. */
export function decodeGoalCommandResult(value: unknown, request: GoalCommand, userId: string): GoalCommandResult {
  if (request.command === "finance.goal.release") {
    const row = goalRecord(value, ["version", "release"]); exigir(row.version === 1, "Versão do resultado inválida."); const released = decodeGoalRelease(row.release); owner(released, userId);
    exigir(released.reservation_id === request.input.reservation_id && released.amount_cents === request.input.amount_cents && released.occurred_on === request.input.occurred_on && released.client_id === request.input.client_id, "Liberação fora da intenção."); return { version: 1, release: released };
  }
  if (request.command === "finance.goal.contribute") {
    const row = goalRecord(value, ["version", "reservation"]); exigir(row.version === 1, "Versão do resultado inválida."); const reserved = decodeGoalReservation(row.reservation); owner(reserved, userId);
    exigir(reserved.goal_id === request.input.goal_id && reserved.account_id === request.input.account_id && reserved.amount_cents === request.input.amount_cents && reserved.occurred_on === request.input.occurred_on && reserved.client_id === request.input.client_id, "Aporte fora da intenção."); return { version: 1, reservation: reserved };
  }
  if (request.command === "finance.goal.highlight") {
    const row = goalRecord(value, ["version", "highlight"]); exigir(row.version === 1, "Versão do resultado inválida."); const featured = row.highlight === null ? null : decodeGoalHighlight(row.highlight);
    if (featured) owner(featured, userId); exigir((featured?.goal_id ?? null) === request.input.goal_id, "Destaque fora da intenção."); return { version: 1, highlight: featured };
  }
  const status = request.command === "finance.goal.archive" || request.command === "finance.goal.restore";
  const row = goalRecord(value, status ? ["version", "goal", "highlight"] : ["version", "goal"]); exigir(row.version === 1, "Versão do resultado inválida.");
  const saved = decodeFinancialGoal(row.goal); owner(saved, userId);
  if (request.command !== "finance.goal.create") exigir(saved.id === request.input.goal_id, "Resultado de outra meta.");
  if (request.command === "finance.goal.create" || request.command === "finance.goal.update") {
    const fields: Partial<GoalFields> = request.command === "finance.goal.create" ? request.input : request.input.patch;
    for (const key of ["name", "target_cents", "deadline", "image_file_id"] as const) if (Object.hasOwn(fields, key)) {
      const field = fields[key]; exigir(saved[key] === (key === "name" ? String(field).trim() : field), "Resultado diverge da alteração solicitada.");
    }
    if (request.command === "finance.goal.create") exigir(saved.archived_at === null && saved.revision === "0", "Estado inicial de meta inválido.");
    return { version: 1, goal: saved };
  }
  exigir(request.command === "finance.goal.archive" ? saved.archived_at !== null : saved.archived_at === null, "Estado da meta diverge da intenção.");
  const featured = row.highlight === null ? null : decodeGoalHighlight(row.highlight); if (featured) owner(featured, userId);
  exigir(request.command !== "finance.goal.archive" || featured?.goal_id !== saved.id, "Meta arquivada não mantém destaque."); return { version: 1, goal: saved, highlight: featured };
}

export async function executeGoalCommand(store: GoalUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, command: GoalCommand): Promise<GoalCommandResult> {
  const request = decodeGoalCommand(command), fields = goalRecord(context, ["user_id", "canal"]); goalUuid(fields.user_id); exigir(fields.canal === "web" || fields.canal === "api" || fields.canal === "cron", "Canal de meta inválido.");
  const actor: ContextoDeEscrita = { user_id: fields.user_id, canal: fields.canal }, fingerprint = assinatura(request.input);
  // The adapter receives an independent value, never the actor captured by the
  // Core closure. Mutating its own context cannot switch this command's owner.
  return store.transaction(clone(actor), async tx => {
    const stored = await tx.receipts.get(request.command, request.input.client_id);
    if (stored !== null) {
      const receipt = goalRecord(stored, ["user_id", "command", "client_id", "fingerprint", "result"]);
      exigir(receipt.user_id === actor.user_id && receipt.command === request.command && receipt.client_id === request.input.client_id && typeof receipt.fingerprint === "string", "Recibo de meta fora da intenção.");
      if (receipt.fingerprint !== fingerprint) throw new ErroDeDominio("CONFLICT", "client_id já usado com outro conteúdo.");
      return decodeGoalCommandResult(receipt.result, request, actor.user_id);
    }
    // Bind all later aggregate reads to ONE immutable snapshot revision even
    // if a faulty port exposes a mutable property/getter across awaits.
    const financeRevision = tx.financeRevision;
    goalRevision(financeRevision); if (financeRevision !== request.input.expected_finance_revision) throw new ErroDeDominio("CONFLICT", "Os dados financeiros mudaram. Confira a prévia antes de reenviar.");
    const at = deps.clock.now(); goalTimestamp(at); const today = diaCivilDe(at); goalDay(today); let result: GoalCommandResult;
    if (request.command === "finance.goal.create") {
      await image(tx, actor.user_id, request.input.image_file_id);
      const after = decodeFinancialGoal({ version: 1, id: id(deps), user_id: actor.user_id, name: request.input.name.trim(), target_cents: request.input.target_cents, deadline: request.input.deadline, image_file_id: request.input.image_file_id, archived_at: null, revision: "0", created_at: at, updated_at: at });
      await saveGoal(tx, deps, actor, null, after, at); result = { version: 1, goal: after };
    } else if (request.command === "finance.goal.release") {
      const raw = await tx.reservations.get(request.input.reservation_id); if (raw === null) naoEncontrado(); const reservation = decodeGoalReservation(raw);
      if (reservation.user_id !== actor.user_id || reservation.id !== request.input.reservation_id) naoEncontrado();
      exigir(request.input.occurred_on <= today, "A liberação não pode ser futura.");
      const total = totals(await tx.releaseTotals.get(reservation.id), actor.user_id, "reservation_id", reservation.id, financeRevision, ["released_cents"]); goalCents(total.released_cents, true);
      exigir(request.input.amount_cents <= activeReservationAmount(reservation, total.released_cents), "A liberação ultrapassa a reserva restante.");
      const released = decodeGoalRelease({ version: 1, id: id(deps), user_id: actor.user_id, reservation_id: reservation.id, amount_cents: request.input.amount_cents, occurred_on: request.input.occurred_on, client_id: request.input.client_id, created_at: at });
      await tx.releases.insert(clone(released)); await emit(tx, deps, actor, "finance_goal_release", null, released, at); result = { version: 1, release: released };
    } else if (request.command === "finance.goal.highlight") {
      const before = await highlight(tx, actor.user_id);
      if ((before?.revision ?? "0") !== request.input.expected_highlight_revision) throw new ErroDeDominio("CONFLICT", "O destaque mudou. Confira a versão atual.");
      if (request.input.goal_id !== null) exigir((await goal(tx, actor.user_id, request.input.goal_id)).archived_at === null, "Restaure a meta antes de destacá-la.");
      result = { version: 1, highlight: await saveHighlight(tx, deps, actor, before, request.input.goal_id, at) };
    } else {
      const before = await goal(tx, actor.user_id, request.input.goal_id, request.input.expected_revision);
      if (request.command === "finance.goal.contribute") {
        exigir(before.archived_at === null && request.input.occurred_on <= today, "Aporte exige meta ativa e data não futura.");
        const raw = await tx.accounts.get(request.input.account_id); if (raw === null) naoEncontrado(); const account = goalRecord(raw, ["id", "user_id", "kind", "currency", "archived_at"]);
        exigir(account.id === request.input.account_id && account.user_id === actor.user_id && typeof account.kind === "string" && ["checking", "savings", "cash", "investment", "other"].includes(account.kind) && account.currency === "BRL" && account.archived_at === null, "Selecione uma conta ativa própria em reais, sem cartão.");
        const balanceRaw = await tx.accountTotals.get(request.input.account_id); if (balanceRaw === null) naoEncontrado();
        const balance = totals(balanceRaw, actor.user_id, "account_id", request.input.account_id, financeRevision, ["real_balance_cents", "reserved_cents"]); goalCents(balance.real_balance_cents, true, true); goalCents(balance.reserved_cents, true);
        const available = projectAccountAvailability({ user_id: actor.user_id, account_id: request.input.account_id, real_balance_cents: balance.real_balance_cents, reserved_cents: balance.reserved_cents });
        exigir(available.available_cents >= request.input.amount_cents, "A conta não possui disponível suficiente após as reservas.");
        const goalTotal = totals(await tx.goalTotals.get(before.id), actor.user_id, "goal_id", before.id, financeRevision, ["saved_cents"]); goalCents(goalTotal.saved_cents, true);
        totalExato(BigInt(goalTotal.saved_cents) + BigInt(request.input.amount_cents), "Reservado na meta");
        const reserved = decodeGoalReservation({ version: 1, id: id(deps), user_id: actor.user_id, goal_id: before.id, account_id: request.input.account_id, amount_cents: request.input.amount_cents, occurred_on: request.input.occurred_on, client_id: request.input.client_id, created_at: at });
        await tx.reservations.insert(clone(reserved)); await emit(tx, deps, actor, "finance_goal_reservation", null, reserved, at); result = { version: 1, reservation: reserved };
      } else if (request.command === "finance.goal.update") {
        const patch = clone(request.input.patch); if (patch.name !== undefined) patch.name = patch.name.trim();
        if (Object.hasOwn(patch, "image_file_id") && patch.image_file_id !== before.image_file_id) await image(tx, actor.user_id, patch.image_file_id ?? null);
        let after = { ...before, ...patch }; if (!same(before, after)) after = { ...after, revision: revision(before.revision), updated_at: at };
        await saveGoal(tx, deps, actor, before, after, at); result = { version: 1, goal: after };
      } else {
        const featured = await highlight(tx, actor.user_id), archived_at = request.command === "finance.goal.archive" ? before.archived_at ?? at : null;
        const after = before.archived_at === archived_at ? before : { ...before, archived_at, revision: revision(before.revision), updated_at: at };
        await saveGoal(tx, deps, actor, before, after, at);
        const nextHighlight = request.command === "finance.goal.archive" && featured?.goal_id === before.id ? await saveHighlight(tx, deps, actor, featured, null, at) : featured;
        result = { version: 1, goal: after, highlight: nextHighlight };
      }
    }
    const checked = decodeGoalCommandResult(result, request, actor.user_id);
    await tx.receipts.insert({ user_id: actor.user_id, command: request.command, client_id: request.input.client_id, fingerprint, result: clone(checked) }); return clone(checked);
  });
}
