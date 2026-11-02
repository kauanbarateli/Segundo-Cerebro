/** DRAFT ONLY: qualify an explicitly staged 30-file chain; never connects or executes SQL.
 * The existing CURRENT27/HIST026 readers remain unchanged. The three new pins
 * identify reviewed draft bytes, not an installed schema or an approved release.
 */
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { CanonicalReleaseSourceError, CURRENT27_CANONICAL_REVIEW, readCurrent27CanonicalMigrations } from "./canonical-release-source.mjs";

const refuse = code => { throw new CanonicalReleaseSourceError(code); };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const sameNames = (actual, expected) => actual.length === expected.length && actual.every((name, i) => name === expected[i]);

export const FRONT_B_30_DRAFT_REVIEW = Object.freeze([
  ...CURRENT27_CANONICAL_REVIEW,
  Object.freeze({file:"20261101044418_front_b_admissao_origem.sql",sha256:"e125759742d7fa1513f7d42ad04ee13c1a6c8894b98478261d1217381f93f519",bytes:31936}),
  Object.freeze({file:"20261101044423_front_b_metricas_cadastro.sql",sha256:"55b72a3a566af68e4795b367707cda5745c70321e0186b1536fe6f63bdc3dd5f",bytes:3675}),
  Object.freeze({file:"20261101044428_front_b_feedback_privado.sql",sha256:"736a9113322317e63e676a4554f6f57231becc9d67065c7f95c97572ad0cc9d6",bytes:4581}),
]);

async function source(root, path) {
  const absolute = resolve(root, path), within = relative(root, absolute);
  if (!within || within === ".." || within.startsWith(`..${sep}`) || isAbsolute(within)) refuse("SOURCE_FILE_REFUSED");
  try {
    const stat = await lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink() || await realpath(absolute) !== absolute) refuse("SOURCE_FILE_REFUSED");
    return await readFile(absolute);
  } catch (error) {
    if (error instanceof CanonicalReleaseSourceError) throw error;
    refuse("SOURCE_FILE_REFUSED");
  }
}
async function sqlNames(directory) {
  try { return (await readdir(directory)).filter(name => name.endsWith(".sql")).sort(); }
  catch { refuse("MIGRATION_MANIFEST_REFUSED"); }
}

/** Root is mandatory: callers must explicitly provide the prepared local tree. */
export async function readStagedFrontB30(root) {
  if (typeof root !== "string" || !isAbsolute(root)) refuse("SOURCE_FILE_REFUSED");
  root = resolve(root);
  let manifest, manifestBytes;
  try { manifestBytes = await source(root,"supabase/sql-editor/manifest.json"); manifest = JSON.parse(manifestBytes); }
  catch { refuse("MIGRATION_MANIFEST_REFUSED"); }
  if (!object(manifest) || manifest.formatVersion !== 1 || manifest.hashAlgorithm !== "sha256" || !Array.isArray(manifest.installation) || manifest.installation.length !== 30) refuse("MIGRATION_MANIFEST_REFUSED");
  const names = FRONT_B_30_DRAFT_REVIEW.map(row => row.file);
  const copies = names.map((name,i) => `${String(i+1).padStart(3,"0")}_${name}`);
  const migrations = resolve(root,"supabase/migrations"), installation = resolve(root,"supabase/sql-editor/installation");
  if (!sameNames(await sqlNames(migrations),names) || !sameNames(await sqlNames(installation),copies)) refuse("MIGRATION_MANIFEST_REFUSED");
  const plan = [];
  for (const [i,row] of manifest.installation.entries()) {
    const expected = FRONT_B_30_DRAFT_REVIEW[i], version = expected.file.slice(0,14);
    if (!object(row) || Object.keys(row).sort().join(",") !== "bytes,file,order,sha256,source,version" || row.order !== i+1 || row.version !== version || row.source !== `supabase/migrations/${expected.file}` || row.file !== `installation/${copies[i]}` || row.bytes !== expected.bytes || row.sha256 !== expected.sha256) refuse("MIGRATION_MANIFEST_REFUSED");
    const input = await source(root,row.source), copy = await source(root,`supabase/sql-editor/${row.file}`);
    if (input.length !== expected.bytes || hash(input) !== expected.sha256 || !input.equals(copy)) refuse("MIGRATION_INTEGRITY_FAILED");
    plan.push(Object.freeze({file:expected.file,source:input}));
  }
  if (!(await source(root,"supabase/sql-editor/manifest.json")).equals(manifestBytes) || !sameNames(await sqlNames(migrations),names) || !sameNames(await sqlNames(installation),copies)) refuse("MIGRATION_MANIFEST_REFUSED");
  for (const [i,row] of plan.entries()) {
    if (!(await source(root,`supabase/migrations/${row.file}`)).equals(row.source) || !(await source(root,`supabase/sql-editor/installation/${copies[i]}`)).equals(row.source)) refuse("MIGRATION_INTEGRITY_FAILED");
  }
  return Object.freeze(plan);
}

/** Historical projections are available only after qualifying all 30 files. */
export async function readHistorical027FromStagedFrontB30(root) {
  return Object.freeze((await readStagedFrontB30(root)).slice(0,27));
}
export async function readHistorical026FromStagedFrontB30(root) {
  return Object.freeze((await readStagedFrontB30(root)).slice(0,26));
}

/** Explicitly dispatch only the two pinned states; never retry a failed state as another. */
export async function readReviewedFrontBChain(root) {
  if (typeof root !== "string" || !isAbsolute(root)) refuse("SOURCE_FILE_REFUSED");
  root = resolve(root);
  let manifest, manifestBytes;
  try { manifestBytes=await source(root,"supabase/sql-editor/manifest.json");manifest=JSON.parse(manifestBytes); }
  catch { refuse("MIGRATION_MANIFEST_REFUSED"); }
  if (!object(manifest) || manifest.formatVersion !== 1 || manifest.hashAlgorithm !== "sha256" || !Array.isArray(manifest.installation) || manifest.installation.some(row=>!object(row)||Object.keys(row).sort().join(",")!=="bytes,file,order,sha256,source,version")) refuse("MIGRATION_MANIFEST_REFUSED");
  let state, sources;
  if (manifest.installation.length === 27) { state="reviewed_27"; sources=await readCurrent27CanonicalMigrations(root); }
  else if (manifest.installation.length === 30) { state="draft_30"; sources=await readStagedFrontB30(root); }
  else refuse("MIGRATION_MANIFEST_REFUSED");
  if (!(await source(root,"supabase/sql-editor/manifest.json")).equals(manifestBytes)) refuse("MIGRATION_MANIFEST_REFUSED");
  return Object.freeze({state,sources});
}

/** Historical prefix only after verifying whichever complete reviewed chain is present. */
export async function readHistorical027FromReviewedFrontB(root) {
  return Object.freeze((await readReviewedFrontBChain(root)).sources.slice(0,27));
}
export async function readHistorical026FromReviewedFrontB(root) {
  return Object.freeze((await readReviewedFrontBChain(root)).sources.slice(0,26));
}
