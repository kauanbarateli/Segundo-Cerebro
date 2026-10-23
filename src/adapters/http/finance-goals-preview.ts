import "server-only";
import { ErroDeDominio } from "../../core/contracts/base";
import { totalExato } from "../../core/financeiro/arithmetic";
import { activeReservationAmount, projectAccountAvailability } from "../../core/financeiro/goals/goal-projections";
import type { GoalCommand } from "../../core/financeiro/goals/goal-types";
import { decodeGoalCommand, goalDay } from "../../core/financeiro/goals/goal-validation";
import { diaCivilDe } from "../../core/tempo";
import type { GoalPrepared, GoalReview } from "../../lib/finance-goals-client-contract";
import { parseGoalReceipt, parseGoalSnapshot, type GoalGateway } from "../db/finance-goals-protocol";

function missing(): never { throw new ErroDeDominio("NOT_FOUND", "Referência de Metas indisponível."); }
function conflict(): never { throw new ErroDeDominio("CONFLICT", "Revisão de Metas alterada."); }
function invalid(): never { throw new ErroDeDominio("VALIDATION", "Confira os dados da revisão."); }
/** No dry-run or domain writes. Projection reuses one bounded, validated
 * snapshot; execution still owns every rule and atomic effect in the Core. */
export async function prepareFinanceGoal(gateway: GoalGateway, request: GoalCommand, ownerId: string): Promise<GoalPrepared> {
  const intent = decodeGoalCommand(request);
  if (gateway.actorId !== ownerId) invalid();
  const raw = await gateway.snapshot(structuredClone(intent));
  if (gateway.actorId !== ownerId) invalid();
  const snapshot = parseGoalSnapshot(raw, ownerId, intent);
  if (snapshot.receipt !== null) return { kind: "confirmed", intent, result: parseGoalReceipt(snapshot.receipt, ownerId, intent).result };
  if (snapshot.finance_revision !== intent.input.expected_finance_revision) conflict();
  const goal = snapshot.goals[0] ?? null, highlight = snapshot.highlights[0] ?? null;
  let goalRevision: string | null = null, highlightRevision: string | null = null, account: GoalReview["account"] = null;
  if ("expected_revision" in intent.input) {
    if (!goal) missing(); goalRevision = goal.revision;
    if (goalRevision !== intent.input.expected_revision) conflict();
  }
  if (intent.command === "finance.goal.highlight") {
    highlightRevision = highlight?.revision ?? "0";
    if (highlightRevision !== intent.input.expected_highlight_revision) conflict();
    if (intent.input.goal_id !== null && (!goal || goal.archived_at !== null)) invalid();
  }
  if ("occurred_on" in intent.input) { const today = diaCivilDe(new Date().toISOString()); goalDay(today); if (intent.input.occurred_on > today) invalid(); }
  if (intent.command === "finance.goal.contribute") {
    if (!goal || goal.archived_at !== null) invalid();
    const source = snapshot.accounts[0], totals = snapshot.account_totals[0], goalTotals = snapshot.goal_totals[0];
    if (!source || !totals || !goalTotals) missing();
    if (source.archived_at !== null || source.kind === "credit_card" || source.currency !== "BRL") invalid();
    const availability = projectAccountAvailability({ user_id: ownerId, account_id: source.id, real_balance_cents: totals.real_balance_cents, reserved_cents: totals.reserved_cents });
    if (intent.input.amount_cents > availability.available_cents) invalid();
    totalExato(BigInt(goalTotals.saved_cents) + BigInt(intent.input.amount_cents), "Reservado na meta");
    account = { id: source.id, realBalance: totals.real_balance_cents, reserved: totals.reserved_cents, available: availability.available_cents };
  }
  if (intent.command === "finance.goal.release") {
    const reservation = snapshot.reservations[0], totals = snapshot.release_totals[0];
    if (!reservation || !totals) missing();
    if (intent.input.amount_cents > activeReservationAmount(reservation, totals.released_cents)) invalid();
  }
  const imageId = intent.command === "finance.goal.create" ? intent.input.image_file_id : intent.command === "finance.goal.update" && Object.hasOwn(intent.input.patch, "image_file_id") && intent.input.patch.image_file_id !== goal?.image_file_id ? intent.input.patch.image_file_id : null;
  if (imageId && !snapshot.images.some(image => image.id === imageId)) invalid();
  return { kind: "review", intent, financeRevision: snapshot.finance_revision, goalRevision, highlightRevision, account };
}
