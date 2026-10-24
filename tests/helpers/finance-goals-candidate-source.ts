/** Disposable SQL-in-WASM ONLY. No env, credentials, HTTP or hosted migration. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
export const FINANCE_GOALS_REVIEW = Object.freeze([
  { file: "01-foundation.sql", sha256: "74d2cca9c73df7f39bcf988bd5453b6e4b925f97b7424579fccb501a8f4c224e" },
  { file: "02-read-models.sql", sha256: "8abcf8eee5cba3a13f87fa1ef56d43b1b384838808fb95ff5dcf21784d3fc00b" },
  { file: "03-expected-effects.sql", sha256: "9013a038b06c733e04dbf8e679047b5dc08c28fab065558bc1f1cb2bf3c30a5b" },
  { file: "04-commit.sql", sha256: "7e2642d435c87ffc81d844f2609064afac7904be0ef2530065328d424ba7d61a" },
  { file: "05-guards-and-v1-compat.sql", sha256: "a4f8573e4e8e3449cdd62cecde769079216a9933affe63b5f6ee8c0e818989cc" },
]);
export function compileFinanceGoalsCandidate(sources: readonly string[]) {
  if (sources.length !== FINANCE_GOALS_REVIEW.length) throw new Error("Missing reviewed Goals companion.");
  const bodies = sources.map((raw, index) => {
    const source = raw.replaceAll("\r\n", "\n"), review = FINANCE_GOALS_REVIEW[index]!;
    if (createHash("sha256").update(source).digest("hex") !== review.sha256) throw new Error("Goals candidate differs from reviewed bytes: " + review.file);
    const lines = source.split("\n"), draft = lines.filter(line => line.startsWith("do $draft_only$ begin raise exception 'DRAFT_ONLY:"));
    if (draft.length !== 1 || !draft[0]!.endsWith(";end $draft_only$;") || lines.filter(line => line === "begin;").length !== 1 || lines.filter(line => line === "rollback;").length !== 1 || lines.some(line => line === "commit;")) throw new Error("Goals inert boundaries changed.");
    const body = lines.filter(line => line !== draft[0] && line !== "begin;" && line !== "rollback;").join("\n");
    if (body.includes("$draft_only$") || body.includes("DRAFT_ONLY:")) throw new Error("Unreviewed Goals boundary."); return body;
  });
  return "begin;\n" + bodies.join("\n\n") + "\ncommit;\n";
}
export async function readFinanceGoalsCandidateSources() { return Promise.all(FINANCE_GOALS_REVIEW.map(file => readFile(resolve(root, "proposals/finance-goals", file.file), "utf8"))); }
