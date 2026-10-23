import type { ContextoDeEscrita } from "../../contracts/base";
import type { ReciboIdempotente } from "../../contracts/unit-of-work";
import type { FinancialGoal, GoalAccount, GoalAccountTotals, GoalEvent, GoalHighlight, GoalImage, GoalRelease, GoalReleaseTotals, GoalReservation, GoalTotals } from "./goal-types";

export interface GoalTransaction {
  readonly financeRevision: string;
  goals: { get(id: string): Promise<FinancialGoal | null>; insert(row: FinancialGoal): Promise<void>; replace(row: FinancialGoal): Promise<void> };
  reservations: { get(id: string): Promise<GoalReservation | null>; insert(row: GoalReservation): Promise<void> };
  releases: { insert(row: GoalRelease): Promise<void> };
  highlights: { get(): Promise<GoalHighlight | null>; put(row: GoalHighlight): Promise<void> };
  accounts: { get(id: string): Promise<GoalAccount | null> };
  /** Complete same-revision aggregates, NEVER a sum of a paginated history. */
  accountTotals: { get(id: string): Promise<GoalAccountTotals | null> };
  goalTotals: { get(id: string): Promise<GoalTotals> };
  releaseTotals: { get(id: string): Promise<GoalReleaseTotals> };
  images: { getFinalized(id: string): Promise<GoalImage | null> };
  events: { append(event: GoalEvent): Promise<void> };
  receipts: { get(command: string, clientId: string): Promise<ReciboIdempotente | null>; insert(row: ReciboIdempotente): Promise<void> };
}
/** Adapter authenticates actor/session/Entitlement and locks the SAME owner
 * financial aggregate before every callback/receipt. Global CAS, effects,
 * events and receipt are atomic. Ports expire after callback completion.
 * Never rerun an intent automatically after a CAS/unknown outcome. */
export interface GoalUnitOfWork {
  transaction<T>(context: ContextoDeEscrita, work: (tx: GoalTransaction) => Promise<T>): Promise<T>;
}
