import { assinatura } from "@/core/contracts/base";
import { formatBRL, formatCentsPlain, parseBRLToCents } from "@/core/dinheiro";
import { decodeGoalCommand, decodeFinancialGoal, decodeGoalHighlight, decodeGoalRelease, decodeGoalReservation, goalCents, goalDay, goalRevision, goalTimestamp, goalUuid } from "@/core/financeiro/goals/goal-validation";
import { decodeGoalCommandResult } from "@/core/financeiro/goals/goal-use-cases";
import { projectGoalProgress } from "@/core/financeiro/goals/goal-projections";
import type { FinancialGoal, GoalCommand, GoalCommandResult, GoalProgress } from "@/core/financeiro/goals/goal-types";
import type { FinanceGoalsClient, GoalAccountChoice, GoalDetailView, GoalFailure, GoalHistoryQuery, GoalJournalView, GoalPageQuery, GoalPageView, GoalPrepared, GoalReply, GoalReview } from "@/lib/finance-goals-client-contract";
import { inspectGoalTerminalProof, type GoalTerminalClientOutcome } from "@/lib/finance-goals-terminal-browser";
import { decodeGoalTerminalOutcome, type GoalTerminalReply } from "@/lib/finance-goals-terminal-contract";

export const GOAL_LABELS: Record<GoalCommand["command"], string> = {
  "finance.goal.create": "Criar meta", "finance.goal.update": "Salvar meta", "finance.goal.archive": "Arquivar meta",
  "finance.goal.restore": "Restaurar meta", "finance.goal.highlight": "Alterar destaque", "finance.goal.contribute": "Registrar aporte", "finance.goal.release": "Liberar valor",
};
export function goalMoney(cents: number, hidden: boolean) { return formatBRL(cents, { hidden }); }
export function goalDate(day: string) { return `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`; }
export function goalDeadline(day: string) {
  goalDay(day);
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00.000Z`));
}
export interface GoalEditorDraft { name: string; target: string; deadline: string }
export function goalEditorDraft(goal: FinancialGoal | null): GoalEditorDraft { return { name: goal?.name ?? "", target: goal ? formatCentsPlain(goal.target_cents) : "", deadline: goal?.deadline ?? "" }; }
export function parseGoalMoney(value: string) { return /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(value.trim()) ? parseBRLToCents(value) : null; }
export function goalFields(draft: GoalEditorDraft) {
  const target = parseGoalMoney(draft.target); if (target === null || target < 1) throw new Error("Informe um valor maior que zero, com até duas casas decimais.");
  if (!draft.name.trim() || draft.name.trim().length > 160) throw new Error("Dê um nome à meta com até 160 caracteres.");
  if (draft.deadline) goalDay(draft.deadline);
  return { name: draft.name.trim(), target_cents: target, deadline: draft.deadline || null };
}
export function goalAmount(value: string, day: string, today: string) {
  const cents = parseGoalMoney(value); if (cents === null || cents < 1) throw new Error("Informe um valor maior que zero, com até duas casas decimais.");
  goalDay(day); goalDay(today); if (day > today) throw new Error("Escolha uma data até hoje."); return cents;
}
export function eligibleGoalAccounts(accounts: readonly GoalAccountChoice[]) { return accounts.filter(account => !account.archived && account.currency === "BRL" && account.kind !== "credit_card"); }
export function goalIntent(command: GoalCommand["command"], input: Record<string, unknown>): GoalCommand { return decodeGoalCommand({ command, input }); }
export const sameGoalIntent = (a: GoalCommand, b: GoalCommand) => assinatura(a) === assinatura(b);
/** A UI projection from ONE detail revision, never an authorization or sum of pages. */
export function goalContributionPreview(detail: GoalDetailView, review: GoalReview | null): GoalProgress | null {
  if (!review || review.intent.command !== "finance.goal.contribute" || review.intent.input.goal_id !== detail.goal.id || review.financeRevision !== detail.finance_revision || review.intent.input.expected_finance_revision !== detail.finance_revision || review.goalRevision !== detail.goal.revision || review.intent.input.expected_revision !== detail.goal.revision) return null;
  try { goalCents(detail.totals.saved_cents, true); goalCents(review.intent.input.amount_cents); if (detail.totals.finance_revision !== detail.finance_revision || detail.totals.goal_id !== detail.goal.id || detail.totals.user_id !== detail.goal.user_id) return null;
    const saved = BigInt(detail.totals.saved_cents) + BigInt(review.intent.input.amount_cents); if (saved > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return projectGoalProgress(detail.goal, Number(saved));
  } catch { return null; }
}
function failure(code: GoalFailure["code"], message: string): GoalFailure { return { ok: false, code, message }; }
const changed = () => failure("session-changed", "A sessão mudou. Reabra Metas para continuar.");
const uncertain = () => failure("uncertain", "O resultado ainda não foi confirmado. Consulte a mesma tentativa antes de iniciar outra.");
function checkJournal(value: GoalJournalView, owner: string, epoch: string) {
  if (value.ownerId !== owner || value.epoch !== epoch || typeof value.reconfirmRequired !== "boolean") throw new Error("journal");
  if (value.pending) { decodeGoalCommand(value.pending.intent); if (!["staged", "uncertain"].includes(value.pending.phase)) throw new Error("journal"); }
  return structuredClone(value);
}
function checkItem(item: GoalDetailView | GoalPageView["items"][number], owner: string, revision: string) {
  const goal = decodeFinancialGoal(item.goal); goalCents(item.totals.saved_cents, true);
  if (goal.user_id !== owner || item.totals.user_id !== owner || item.totals.goal_id !== goal.id || item.totals.finance_revision !== revision) throw new Error("owner");
}
function checkPage(value: GoalPageView, owner: string, query: GoalPageQuery): GoalPageView {
  goalRevision(value.finance_revision); if (value.version !== 1 || value.items.length > query.limit || query.limit < 1 || query.limit > 50) throw new Error("page");
  let previous = query.cursor;
  for (const item of value.items) { checkItem(item, owner, value.finance_revision); if (previous && item.goal.id <= previous || query.archived !== "all" && (item.goal.archived_at === null ? "active" : "archived") !== query.archived) throw new Error("page"); previous = item.goal.id; }
  if (value.next_cursor !== null && (value.items.length !== query.limit || value.next_cursor !== previous)) throw new Error("cursor");
  if (value.highlight && decodeGoalHighlight(value.highlight).user_id !== owner) throw new Error("highlight"); return structuredClone(value);
}
function historyQuery(value: GoalHistoryQuery) { const copy = structuredClone(value); goalUuid(copy.id); if (!Number.isInteger(copy.limit) || copy.limit < 1 || copy.limit > 50) throw new Error("limit"); if (copy.cursor) { goalUuid(copy.cursor.id); goalTimestamp(copy.cursor.created_at); } return copy; }
function checkReview(value: GoalPrepared, intent: GoalCommand, owner: string): GoalPrepared {
  if (!sameGoalIntent(value.intent, intent)) throw new Error("intent");
  if (value.kind === "confirmed") return { ...value, result: decodeGoalCommandResult(value.result, intent, owner) };
  if (value.kind !== "review" || value.financeRevision !== intent.input.expected_finance_revision) throw new Error("revision");
  if ("expected_revision" in intent.input && value.goalRevision !== intent.input.expected_revision) throw new Error("revision");
  if ("expected_highlight_revision" in intent.input && value.highlightRevision !== intent.input.expected_highlight_revision) throw new Error("revision");
  if (intent.command === "finance.goal.contribute") {
    const account = value.account; if (!account || account.id !== intent.input.account_id) throw new Error("account");
    goalCents(account.realBalance, true, true); goalCents(account.reserved, true); goalCents(account.available, true, true);
    if (BigInt(account.realBalance) - BigInt(account.reserved) !== BigInt(account.available) || intent.input.amount_cents > account.available) throw new Error("available");
  }
  return structuredClone(value);
}

/** Finite session controller. Durable persistence/locks are requirements of the injected port, not implemented in this UI. */
export function createGoalsController(ownerId: string, service: FinanceGoalsClient) {
  const epoch = service.epoch; let alive = true, opened = false, busy = false, available = false;
  let terminalReviewRequired = false, terminalReadReady = false;
  let journal: GoalJournalView | null = null, review: GoalReview | null = null, heldIntent: GoalCommand | null = null;
  function hold(intent: GoalCommand): GoalJournalView {
    heldIntent = structuredClone(intent);
    journal = { ownerId, epoch, reconfirmRequired: journal?.reconfirmRequired ?? false, pending: { intent: structuredClone(intent), phase: "uncertain" } };
    return journal;
  }
  const current = () => { try { goalUuid(ownerId); return alive && service.ownerId === ownerId && service.epoch === epoch && Boolean(epoch) && service.isCurrent(); } catch { return false; } };
  async function invoke<T>(operation: () => Promise<GoalReply<T>>, writing = false): Promise<GoalReply<T>> {
    if (!current()) return changed(); if (busy) return failure("busy", "Aguarde a operação em andamento."); busy = true;
    try { const reply = await operation(); if (!current()) return changed(); return reply; }
    catch { return current() ? writing ? uncertain() : failure("unavailable", "Não foi possível conferir Metas. Seus dados digitados foram preservados.") : changed(); }
    finally { busy = false; }
  }
  const ready = () => current() && opened;
  async function read<T>(operation: () => Promise<GoalReply<T>>): Promise<GoalReply<T>> { return ready() ? invoke(operation) : changed(); }
  async function refreshJournal(confirmedIntent?: GoalCommand) {
    const reply = await service.loadPending(); if (!current()) return changed();
    if (!reply.ok) return reply; const candidate = checkJournal(reply.result, ownerId, epoch);
    if (heldIntent) {
      // Neither a missing body nor an altered readback proves that an in-flight command was absent.
      if (confirmedIntent && sameGoalIntent(confirmedIntent, heldIntent) && candidate.pending === null) { heldIntent = null; journal = candidate; }
      else { const original = heldIntent; journal = { ...hold(original), reconfirmRequired: candidate.reconfirmRequired }; }
    } else {
      journal = candidate;
      // A recovered staged/uncertain body may already have reached the server.
      // Pin it before availability or any later read can replace the journal view.
      if (candidate.pending) hold(candidate.pending.intent);
    }
    if (!journal) throw new Error("journal");
    if (journal.reconfirmRequired && service.terminal && !terminalReviewRequired) { terminalReviewRequired = true; terminalReadReady = false; }
    return { ok: true as const, result: journal };
  }
  async function terminal(method: "status" | "settle"): Promise<GoalReply<GoalTerminalReply>> {
    if (!ready()) return changed();
    const capability = service.terminal; if (!capability || typeof capability.status !== "function" || typeof capability.settle !== "function") return failure("unavailable", "A consulta terminal não está disponível nesta versão.");
    const original = heldIntent ?? journal?.pending?.intent; if (!original) return failure("validation", "Não há uma tentativa original para conferir.");
    const intent = decodeGoalCommand(original);
    return invoke<GoalTerminalReply>(async () => {
      hold(intent); const reply = await capability[method](structuredClone(intent)); if (!current()) return changed();
      if (!reply.ok) return reply.code === "session-changed" ? reply : uncertain();
      const outcome: GoalTerminalClientOutcome = reply.result;
      if (outcome.proof === null) return uncertain();
      const positive = inspectGoalTerminalProof(outcome.proof, ownerId, epoch, intent);
      const checked = decodeGoalTerminalOutcome(positive.binding, intent, outcome.reply);
      if (assinatura(checked) !== assinatura(positive)) return uncertain();
      review = null;
      const loaded = await service.loadPending(); if (!current()) return changed();
      if (!loaded.ok) return uncertain(); const final = checkJournal(loaded.result, ownerId, epoch);
      if (final.pending !== null || !final.reconfirmRequired) return uncertain();
      heldIntent = null; journal = final; terminalReviewRequired = true; terminalReadReady = false; return { ok: true, result: checked };
    }, true);
  }
  return {
    matches(owner: string, candidate: FinanceGoalsClient) { return owner === ownerId && candidate === service; },
    attemptStatus() { return terminal("status"); },
    attemptSettle() { return terminal("settle"); },
    current, close() { alive = false; review = null; journal = null; heldIntent = null; },
    state() { return { journal: journal ? structuredClone(journal) : null, review: review ? structuredClone(review) : null, available }; },
    async open(): Promise<GoalReply<GoalJournalView>> {
      return invoke(async () => { const loaded = await refreshJournal(); if (!current()) return changed(); if (!loaded.ok) return loaded;
        opened = true; const reply = await service.availability(); if (!current()) return changed();
        if (!reply.ok) return reply; available = reply.result.available === true; return loaded; });
    },
    page(query: GoalPageQuery) { const copy = structuredClone(query); return read(async () => { if (!Number.isInteger(copy.limit) || copy.limit < 1 || copy.limit > 50 || !["active", "archived", "all"].includes(copy.archived)) throw new Error("query"); if (copy.cursor) goalUuid(copy.cursor); const reply = await service.page(structuredClone(copy)); if (!current() || !reply.ok) return reply; const result = checkPage(reply.result, ownerId, copy); if (terminalReviewRequired && copy.cursor === null) terminalReadReady = true; return { ok: true as const, result }; }); },
    detail(id: string) { return read(async () => { goalUuid(id); const reply = await service.detail(id); if (!current() || !reply.ok || reply.result === null) return reply;
      goalRevision(reply.result.finance_revision); checkItem(reply.result, ownerId, reply.result.finance_revision); if (reply.result.version !== 1 || reply.result.goal.id !== id || reply.result.highlight && decodeGoalHighlight(reply.result.highlight).user_id !== ownerId) throw new Error("id"); return { ok: true as const, result: structuredClone(reply.result) }; }); },
    reservations(query: GoalHistoryQuery) { const copy = structuredClone(query); return read(async () => { const checked = historyQuery(copy), reply = await service.reservations(structuredClone(checked)); if (!current() || !reply.ok) return reply;
      goalRevision(reply.result.finance_revision);
      if (reply.result.version !== 1 || reply.result.items.length > checked.limit || new Set(reply.result.items.map(item => item.reservation.id)).size !== reply.result.items.length || reply.result.items.some(item => { const reservation = decodeGoalReservation(item.reservation); goalCents(item.totals.released_cents, true); return reservation.user_id !== ownerId || reservation.goal_id !== checked.id || item.totals.user_id !== ownerId || item.totals.reservation_id !== reservation.id || item.totals.finance_revision !== reply.result.finance_revision || item.totals.released_cents > reservation.amount_cents; })) throw new Error("history");
      return { ok: true as const, result: structuredClone(reply.result) }; }); },
    releases(query: GoalHistoryQuery) { const copy = structuredClone(query); return read(async () => { const checked = historyQuery(copy), reply = await service.releases(structuredClone(checked)); if (!current() || !reply.ok) return reply;
      goalRevision(reply.result.finance_revision); if (reply.result.version !== 1 || reply.result.items.length > checked.limit || new Set(reply.result.items.map(item => item.id)).size !== reply.result.items.length || reply.result.items.some(item => { const release = decodeGoalRelease(item); return release.user_id !== ownerId || release.reservation_id !== checked.id; })) throw new Error("history"); return { ok: true as const, result: structuredClone(reply.result) }; }); },
    async prepare(input: GoalCommand): Promise<GoalReply<GoalPrepared>> {
      if (!ready() || !available) return failure("unavailable", "Metas não está disponível nesta sessão.");
      let intent: GoalCommand; try { intent = decodeGoalCommand(input); } catch { return failure("validation", "Confira os campos da operação antes de continuar."); }
      return invoke<GoalPrepared>(async () => { const loaded = await refreshJournal(); if (!current()) return changed(); if (!loaded.ok) return loaded;
        if (heldIntent || journal?.pending || journal?.reconfirmRequired) return uncertain();
        const reply = await service.prepare(structuredClone(intent)); if (!current() || !reply.ok) return reply;
        if (reply.result.kind === "review" && (reply.result.financeRevision !== intent.input.expected_finance_revision || "expected_revision" in intent.input && reply.result.goalRevision !== intent.input.expected_revision || "expected_highlight_revision" in intent.input && reply.result.highlightRevision !== intent.input.expected_highlight_revision)) return failure("conflict", "Os dados mudaram. Atualize a meta e reveja a operação antes de confirmar.");
        const prepared = checkReview(reply.result, intent, ownerId); review = prepared.kind === "review" ? prepared : null; return { ok: true, result: prepared }; });
    },
    discardReview() { if (current() && !busy && !journal?.pending) review = null; },
    async confirm(): Promise<GoalReply<GoalCommandResult>> {
      if (!ready() || !available || !review) return failure("validation", "Prepare e confira a operação antes de confirmar."); const intent = structuredClone(review.intent);
      if (heldIntent || journal?.pending) return uncertain();
      return invoke<GoalCommandResult>(async () => { const staged = await service.stage(structuredClone(intent)); if (!current()) return changed(); if (!staged.ok) return staged;
        hold(intent); const candidate = checkJournal(staged.result, ownerId, epoch);
        if (!candidate.pending || candidate.pending.phase !== "staged" || !sameGoalIntent(candidate.pending.intent, intent) || candidate.reconfirmRequired) return uncertain();
        journal = candidate;
        const reply = await service.execute(structuredClone(intent)); if (!current()) return changed();
        if (!reply.ok) { hold(intent); return reply.code === "session-changed" ? reply : uncertain(); }
        const result = decodeGoalCommandResult(reply.result, intent, ownerId); review = null;
        const loaded = await refreshJournal(intent); if (!current()) return changed(); if (!loaded.ok || journal?.pending) return uncertain(); return { ok: true, result }; }, true);
    },
    async reconcile(): Promise<GoalReply<GoalCommandResult>> {
      if (!ready()) return changed();
      return invoke<GoalCommandResult>(async () => { const loaded = await refreshJournal(); if (!current()) return changed(); if (!loaded.ok) return loaded; if (!journal?.pending) return failure("validation", "Não há uma tentativa registrada para consultar.");
        const intent = structuredClone(journal.pending.intent); hold(intent); const reply = await service.reconcile(structuredClone(intent)); if (!current()) return changed();
        if (!reply.ok) return reply.code === "session-changed" ? reply : uncertain(); const result = decodeGoalCommandResult(reply.result, intent, ownerId);
        const final = await refreshJournal(intent); if (!current()) return changed(); if (!final.ok || journal?.pending) return uncertain(); review = null; return { ok: true, result }; }, true);
    },
    async acknowledgeReview(): Promise<GoalReply<GoalJournalView>> {
      return read(async () => { if (terminalReviewRequired && !terminalReadReady) return uncertain(); const loaded = await refreshJournal(); if (!current() || !loaded.ok) return loaded; if (journal?.pending || terminalReviewRequired && !terminalReadReady) return uncertain();
        const reply = await service.acknowledgeReview(); if (!current() || !reply.ok) return reply; journal = checkJournal(reply.result, ownerId, epoch); if (journal.pending !== null || journal.reconfirmRequired) return uncertain(); terminalReviewRequired = false; terminalReadReady = false; return { ok: true as const, result: journal }; });
    },
  };
}
