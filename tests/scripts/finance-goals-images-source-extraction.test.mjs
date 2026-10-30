/** Mechanical extraction controls only; no WASM, native process or SQL execution. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { FINANCE_GOALS_IMAGES_REVIEW, compileFinanceGoalsImagesCandidate, readFinanceGoalsImagesCandidateSource } from "../helpers/finance-goals-images-candidate-source.ts";

const require = createRequire(import.meta.url), ts = require("typescript");
const source = path => readFile(new URL("../../" + path, import.meta.url), "utf8");
const hash = text => createHash("sha256").update(text, "utf8").digest("hex");
const api = ["FINANCE_GOALS_IMAGES_REVIEW", "compileFinanceGoalsImagesCandidate", "readFinanceGoalsImagesCandidateSource"];
function ast(name, text) {
  const file = ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  assert.equal(file.parseDiagnostics.length, 0, name); return file;
}

test("image source has only three Node imports and preserves all original definitions byte for byte", async () => {
  const text = (await source("tests/helpers/finance-goals-images-candidate-source.ts")).replaceAll("\r\n", "\n"), file = ast("image-source", text);
  assert.deepEqual(file.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text), ["node:crypto", "node:fs/promises", "node:url"]);
  assert.doesNotMatch(text, /(?:candidate-sql|pglite|local-canonical-sql|import\s*\()/i);
  const marker = "export const FINANCE_GOALS_IMAGES_REVIEW", begin = text.indexOf(marker);
  assert.ok(begin >= 0); assert.equal(text.indexOf(marker, begin + 1), -1);
  // Pin captured from the original 0d933d9 module before moving these definitions.
  assert.equal(hash(text.slice(begin)), "40eba32678b259317048b586601f12bb89167902cec67a454da59c22ccc2d202");
});

test("the original WASM factory and its public reexports keep their implementation and dependency", async () => {
  const text = (await source("tests/helpers/finance-goals-images-candidate-sql.ts")).replaceAll("\r\n", "\n"), file = ast("image-factory", text);
  const declarations = file.statements.filter(ts.isExportDeclaration);
  assert.equal(declarations.length, 1); assert.equal(declarations[0].moduleSpecifier.text, "./finance-goals-images-candidate-source");
  assert.deepEqual([...declarations[0].exportClause.elements].map(node => node.name.text), api);
  assert.deepEqual(file.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text), ["./finance-026-candidate-sql", "./finance-goals-images-candidate-source"]);
  const marker = "export async function createFinanceGoalsImagesCandidateSql()", begin = text.indexOf(marker);
  assert.ok(begin >= 0); assert.equal(text.indexOf(marker, begin + 1), -1);
  assert.equal(hash(text.slice(begin)), "2753b81771879fb116ce866b4a6925aa1ae48b5363b99bba479f42b2a298c4ac");
});

test("the pure reader and compiler retain the reviewed source, output bytes and CRLF normalization", async () => {
  const raw = await readFinanceGoalsImagesCandidateSource(), normalized = raw.replaceAll("\r\n", "\n");
  assert.equal(Object.isFrozen(FINANCE_GOALS_IMAGES_REVIEW), true);
  assert.deepEqual(FINANCE_GOALS_IMAGES_REVIEW, { file: "01-binding-and-lifecycle.sql", sha256: "0d6ca0db3711d4c4899e794ba52ba34c6ed15e10ae834170ea9a5965efeadec9" });
  assert.equal(hash(normalized), FINANCE_GOALS_IMAGES_REVIEW.sha256);
  const compiled = compileFinanceGoalsImagesCandidate(raw);
  assert.equal(hash(compiled), "48fd99fbd4e27a38938f93da3f73cd756a759a73836889355ad9135e986dc5b2");
  assert.equal(Buffer.byteLength(compiled), 9257);
  assert.equal(compileFinanceGoalsImagesCandidate(normalized.replaceAll("\n", "\r\n")), compiled);
});

test("the direct source API rejects changed SQL and changed inert boundaries before any factory can open", async () => {
  const raw = await readFinanceGoalsImagesCandidateSource();
  for (const changed of [raw + "\n--different source", raw.replace("rollback;", "commit;"), raw.replace("DRAFT_ONLY:", "ACTIVE:")]) {
    assert.throws(() => compileFinanceGoalsImagesCandidate(changed), { message: "Goal image companion differs from reviewed bytes." });
  }
});
