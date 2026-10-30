import type { FinanceGoalsClient, GoalJournalView } from "../finance-goals-client-contract";

/** Local liveness/locking only. It never certifies a file or changes finance. */
export interface GoalImageFinanceController {
  current(): boolean;
  matches(ownerId: string, client: FinanceGoalsClient): boolean;
  state(): { journal: GoalJournalView | null };
}
export interface GoalImageFinanceBarrier {
  readonly ownerId: string;
  readonly epoch: string;
  runLocalTransition(controller: GoalImageFinanceController, work: (assertCurrent: () => void) => undefined): Promise<void>;
}
export class GoalImageFinanceBarrierError extends Error {
  constructor(readonly code: "SESSION_CHANGED" | "PENDING" | "INVALID") { super(code); this.name = "GoalImageFinanceBarrierError"; }
}
interface BarrierEnvironment {
  client: FinanceGoalsClient;
  assertSession(): void;
  /** The concrete client supplies its SAME private journal's real lease. */
  exclusive(work: (read: () => GoalJournalView) => void): Promise<void>;
}
export function createGoalImageFinanceBarrier(environment: BarrierEnvironment): GoalImageFinanceBarrier {
  const client = environment.client, ownerId = client.ownerId, epoch = client.epoch;
  const assertSession = environment.assertSession, exclusive = environment.exclusive;
  function live(controller: GoalImageFinanceController) {
    assertSession();
    if (client.ownerId !== ownerId || client.epoch !== epoch || !client.isCurrent() || !controller.current() || !controller.matches(ownerId, client)) throw new GoalImageFinanceBarrierError("SESSION_CHANGED");
  }
  function free(view: GoalJournalView | null) {
    if (!view || view.ownerId !== ownerId || view.epoch !== epoch || view.pending !== null || view.reconfirmRequired !== false) throw new GoalImageFinanceBarrierError("PENDING");
  }
  return Object.freeze({ ownerId, epoch, async runLocalTransition(controller: GoalImageFinanceController, work: (assertCurrent: () => void) => undefined) {
    live(controller);
    await exclusive(read => {
      let active = true;
      const guard = () => { if (!active) throw new GoalImageFinanceBarrierError("INVALID"); live(controller); free(read()); free(controller.state().journal); };
      try {
        guard(); const result: unknown = work(guard);
        if (result !== undefined) { if (result instanceof Promise) void result.catch(() => undefined); throw new GoalImageFinanceBarrierError("INVALID"); }
        guard();
      }
      finally { active = false; }
    });
    live(controller);
  } });
}
