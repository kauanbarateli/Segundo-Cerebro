/** Disposable #78-A V2 candidate only. No hosted client, URL, credentials,
 * numbered migration, Cron, or alteration of the canonical001–025 loader. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = "docs/implementation/drafts";
const patchGuard = "do $draft$ begin raise exception 'DRAFT_NOT_AUTHORIZED_FOR_APPLICATION' using errcode='P0001'; end $draft$;";
const assertionGuard = "do $draft$ begin raise exception 'DRAFT_NOT_AUTHORIZED_FOR_APPLICATION';end $draft$;";
export const FINANCE_BUDGET_REVIEW = Object.freeze({
  patchFile: "finance-budget-repeat.sql",
  patchSha256: "12cc86b74e8aaf43e0b52cb86711b1c8933d55ba819ead2aab7bd5c6280235b5",
  assertionFile: "finance-budget-repeat-assertions.sql",
  assertionSha256: "960be2a9490fd8b22d2978c545e5191260e8a6bae0c74462dd2d902808bb34c1",
});
const normalize = (value: string) => value.replaceAll("\r\n", "\n");
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export interface FinanceBudgetCandidateSql { patch: string; assertions: string }

function removeReviewedGuard(source: string, expectedHash: string, guard: string): string {
  source = normalize(source);
  if (digest(source) !== expectedHash) throw new Error("Finance candidate differs from the independently reviewed V2 bytes.");
  const boundary = guard + "\n", index = source.indexOf(boundary);
  if (index < 0 || source.indexOf(boundary, index + boundary.length) >= 0) throw new Error("Finance candidate draft boundary changed.");
  const result = source.slice(0, index) + source.slice(index + boundary.length);
  if (result.includes("DRAFT_NOT_AUTHORIZED_FOR_APPLICATION")) throw new Error("Finance candidate contains an unreviewed draft guard.");
  return result;
}

/** Only the two exact reviewed abort statements are removed. SQL bodies,
 * source pin, BEGIN/COMMIT and assertion BEGIN/ROLLBACK remain unchanged.
 * CRLF→LF is the sole file normalization; there is no observed-pin fallback. */
export function compileReviewedFinanceBudgetSql(patchSource: string, assertionSource: string): FinanceBudgetCandidateSql {
  const patch = removeReviewedGuard(patchSource, FINANCE_BUDGET_REVIEW.patchSha256, patchGuard);
  const assertions = removeReviewedGuard(assertionSource, FINANCE_BUDGET_REVIEW.assertionSha256, assertionGuard);
  const count = (source: string, statement: string) => source.split("\n").filter(line => line === statement).length;
  if (count(patch, "begin;") !== 1 || count(patch, "commit;") !== 1 || count(patch, "rollback;") !== 0 ||
      count(assertions, "begin;") !== 1 || count(assertions, "rollback;") !== 1 || count(assertions, "commit;") !== 0) {
    throw new Error("Finance candidate transaction boundaries changed.");
  }
  return { patch, assertions };
}

export async function readReviewedFinanceBudgetSources(): Promise<{ patch: string; assertions: string }> {
  const [patch, assertions] = await Promise.all([
    readFile(resolve(root, directory, FINANCE_BUDGET_REVIEW.patchFile), "utf8"),
    readFile(resolve(root, directory, FINANCE_BUDGET_REVIEW.assertionFile), "utf8"),
  ]);
  return { patch, assertions };
}
