/** INERT candidate composition only. Compilers bind all reviewed source bytes;
 * this module never constructs a database, reads env or accepts a SQL target. */
import { compileReviewedFinanceBudgetSql, readReviewedFinanceBudgetSources, FINANCE_BUDGET_REVIEW } from "./finance-budget-candidate-source";
import { compileFinanceSeriesCandidate, readFinanceSeriesCandidateSources, FINANCE_SERIES_REVIEW } from "./finance-series-candidate-source";
import { compileFinanceGoalsCandidate, readFinanceGoalsCandidateSources, FINANCE_GOALS_REVIEW } from "./finance-goals-candidate-source";
import { compileFinanceGoalsImagesCandidate, readFinanceGoalsImagesCandidateSource, FINANCE_GOALS_IMAGES_REVIEW } from "./finance-goals-images-candidate-source";
import { compileFinanceGoalsTerminalCandidate, readFinanceGoalsTerminalCandidateSource, FINANCE_GOALS_TERMINAL_REVIEW } from "./finance-goals-terminal-candidate-source";
import { assertFinance026Sources, readFinance026Sources } from "./finance-026-candidate-source";

export const FINANCE_MVP_PROMOTION_ORDER = Object.freeze(["budget", "series", "goals", "images", "terminal"] as const);
export type FinanceMvpPromotionStageKind = typeof FINANCE_MVP_PROMOTION_ORDER[number];
export interface FinanceMvpPromotionSources {
  canonical: Awaited<ReturnType<typeof readFinance026Sources>>;
  budget: Awaited<ReturnType<typeof readReviewedFinanceBudgetSources>>;
  series: readonly string[];
  goals: readonly string[];
  images: string;
  terminal: string;
}
export interface FinanceMvpPromotionStage {
  readonly kind: FinanceMvpPromotionStageKind;
  readonly reviews: readonly Readonly<{ file: string; sha256: string }>[];
  readonly body: string;
}
export interface FinanceMvpPromotionCandidate {
  readonly version: 1;
  readonly canonicalCount: 26;
  readonly companionCount: 13;
  readonly stages: readonly FinanceMvpPromotionStage[];
  readonly sql: string;
  /** Separate original BEGIN/ROLLBACK assertions, never part of installation. */
  readonly budgetAssertions: string;
}

const open = "begin;\n", close = "\ncommit;\n";
/** These are the complete outer strings emitted by four existing compilers.
 * Never search for SQL statements, rewrite bodies or remove internal blocks. */
function compiledBody(sql: string): string {
  if (!sql.startsWith(open) || !sql.endsWith(close)) throw new Error("MVP compiled outer boundary differs from review.");
  return sql.slice(open.length, -close.length);
}
function budgetBody(sql: string): string {
  // Budget retains its reviewed header. This marker is not a generic BEGIN scan.
  const marker = "-- BEGIN PROPOSED MIGRATION BODY.\nbegin;\n", tail = "commit;\n";
  const index = sql.indexOf(marker);
  if (index < 0 || sql.indexOf(marker, index + marker.length) !== -1 || !sql.endsWith(tail)) throw new Error("MVP Budget outer boundary differs from review.");
  return sql.slice(0, index) + "-- BEGIN PROPOSED MIGRATION BODY.\n" + sql.slice(index + marker.length, -tail.length);
}
function stage(kind: FinanceMvpPromotionStageKind, reviews: readonly Readonly<{ file: string; sha256: string }>[], body: string): FinanceMvpPromotionStage {
  return Object.freeze({ kind, reviews: Object.freeze(reviews.map(review => Object.freeze({ ...review }))), body });
}
/** Canonical26 and all13 companions plus the separate assertions are verified
 * before any candidate SQL can be returned. Hashes remain owned by Sources. */
export function compileFinanceMvpPromotionCandidate(sources: FinanceMvpPromotionSources): FinanceMvpPromotionCandidate {
  assertFinance026Sources(sources.canonical);
  const budget = compileReviewedFinanceBudgetSql(sources.budget.patch, sources.budget.assertions);
  const series = compileFinanceSeriesCandidate(sources.series);
  const goals = compileFinanceGoalsCandidate(sources.goals);
  const images = compileFinanceGoalsImagesCandidate(sources.images);
  const terminal = compileFinanceGoalsTerminalCandidate(sources.terminal);
  const stages = Object.freeze([
    stage("budget", [{ file: FINANCE_BUDGET_REVIEW.patchFile, sha256: FINANCE_BUDGET_REVIEW.patchSha256 }], budgetBody(budget.patch)),
    stage("series", FINANCE_SERIES_REVIEW, compiledBody(series)),
    stage("goals", FINANCE_GOALS_REVIEW, compiledBody(goals)),
    stage("images", [FINANCE_GOALS_IMAGES_REVIEW], compiledBody(images)),
    stage("terminal", [FINANCE_GOALS_TERMINAL_REVIEW], compiledBody(terminal)),
  ]);
  return Object.freeze({ version: 1, canonicalCount: 26, companionCount: 13, stages, sql: open + stages.map(value => value.body).join("\n\n") + close, budgetAssertions: budget.assertions });
}
export async function readFinanceMvpPromotionSources(): Promise<FinanceMvpPromotionSources> {
  const [canonical, budget, series, goals, images, terminal] = await Promise.all([
    readFinance026Sources(), readReviewedFinanceBudgetSources(), readFinanceSeriesCandidateSources(),
    readFinanceGoalsCandidateSources(), readFinanceGoalsImagesCandidateSource(), readFinanceGoalsTerminalCandidateSource(),
  ]);
  return { canonical, budget, series, goals, images, terminal };
}
