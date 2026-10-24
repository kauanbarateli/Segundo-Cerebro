/** DRAFT ONLY: exact CURRENT27 bytes versus an explicitly selected HIST026.
 * No database/SDK/CLI/target/environment or Git process is imported or executed.
 * Existing native collectors must separately bind the ENTIRE current chain to
 * their checkout before executing a historical plan. This reader claims only
 * file/manifest integrity. The proposed 027 filename awaits Root promotion.
 */
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
/** Expected 001–026 literals originate in FINANCE_026_CANONICAL_REVIEW
 * (723e51c3...) and the matching inert historical manifest (88f036a9...).
 * Git f309 equality is supporting evidence, never the expected-pin authority.
 * Root reserved the proposed 027 filename; promotion remains a separate gate.
 */
export const CURRENT27_CANONICAL_REVIEW = Object.freeze([
  Object.freeze({"file":"20261007151834_identity_foundation.sql","sha256":"7a5bc2b2b7f1fc953159ab31820ec734a5e0d9554ce92ca952465ddfc0fdddfc","bytes":30586}),
  Object.freeze({"file":"20261007151850_auth_password_completion.sql","sha256":"18bdc83e45aa2169ba8404feebeb77c236d9cadc6792470de3b8f5745b091d30","bytes":3206}),
  Object.freeze({"file":"20261007151904_restrict_rls_event_trigger_execution.sql","sha256":"64a2838cd0ee18a422e28d889e8d9bc5c045204e913aec050628620083baca07","bytes":1942}),
  Object.freeze({"file":"20261007210519_capture_task_transactions.sql","sha256":"0645892ba82c4e13a391020aea4abfaeaa05a81283056adbc9954747b066b859","bytes":47922}),
  Object.freeze({"file":"20261007223710_activity_page.sql","sha256":"565d2912e36142b1694e8728ce665d8bf92321466193bdab6621dd2256940a2c","bytes":6089}),
  Object.freeze({"file":"20261009144343_financial_transactions.sql","sha256":"af3f102412f78e83f5f612666761c8b65b07239ee72bbf3ea81c56f9dd1c3557","bytes":40343}),
  Object.freeze({"file":"20261009144350_knowledge_pages_links.sql","sha256":"a9da2bb78314f2eb2b0f773fa5b200496b8a963e5103a25ebe13198e0fa37b2c","bytes":44911}),
  Object.freeze({"file":"20261009150122_identity_admin_settings.sql","sha256":"461708ac47abb50465bd71bd5a70f76fadba7dee599d6f114a82f8c22aee7862","bytes":26458}),
  Object.freeze({"file":"20261009151557_account_preferences.sql","sha256":"d183f660303227d21ceb11dd84a676d3ebeefb233d3a76802b2d0b380c58806c","bytes":8757}),
  Object.freeze({"file":"20261009152200_projects_habits.sql","sha256":"c57c54245926c66b5cbe87baaceee101d8d0d9cc0b0537c22040d6d423d3abe6","bytes":40073}),
  Object.freeze({"file":"20261009152822_private_storage_drive.sql","sha256":"a1a66fcd601d46e905f6db5a890a4799d9b3409b3331bb832e6e74301184f8b9","bytes":41845}),
  Object.freeze({"file":"20261009154609_global_search_activity.sql","sha256":"b91f2acbf62794811bd906e2592fb86b48205d5366e1446e6de7c9bfbd3a58e7","bytes":13627}),
  Object.freeze({"file":"20261009160151_encrypted_vault.sql","sha256":"3f1af61dbe5954e2e5354441e47e411463eb6314f0ae7471edfbc8cae7aa35ff","bytes":22103}),
  Object.freeze({"file":"20261009160158_google_calendar.sql","sha256":"621bc732a818da2627e245a1614264b5e3a70b8f330510d1fae06bef524ed0e3","bytes":50471}),
  Object.freeze({"file":"20261009231338_file_cleanup_fairness.sql","sha256":"f71c6bb9debb24f032bb64824420693c9be6b4ab566f54d51dac6cdb658f897a","bytes":3522}),
  Object.freeze({"file":"20261010010955_close_public_sequence_defaults.sql","sha256":"add5b17ee8af3162ed893d1ac955c4fe5229707b7807d43a58b8c9124dc8e381","bytes":1842}),
  Object.freeze({"file":"20261010044217_finance_monthly_plan.sql","sha256":"a45052833425a647a193e8d3588257fa6cb392aa12ef39b34f89b57e06d882bf","bytes":1533}),
  Object.freeze({"file":"20261011071500_admin_auth_creation_order.sql","sha256":"91d91aa94883f803139f30c250fc92322de31cc6c29df293462eac8e459c4a99","bytes":4717}),
  Object.freeze({"file":"20261011113751_own_sessions.sql","sha256":"0cab745bbb315ca700921db9addc13e113fb450eb08095fc37ec1e8ada1aae57","bytes":4115}),
  Object.freeze({"file":"20261021045700_spec08_private_entity_images.sql","sha256":"385dff57a2d81fe8b7ba92f6bc95d16d25ee09f7c85106fa5f40711a03dedde2","bytes":17601}),
  Object.freeze({"file":"20261021144650_spec08_habit_frequency_history.sql","sha256":"90156cf1069e2934b38160099156086ac4d60d0e349932d96565b35d3312083e","bytes":23511}),
  Object.freeze({"file":"20261021171416_spec08_capture_document_write.sql","sha256":"431e7521306951d403aba861541805b350cf30523d0e52b7634825852f961b38","bytes":32167}),
  Object.freeze({"file":"20261022042432_spec08_calendar_participants.sql","sha256":"b7a0a3f893e1cf5ac5f95c3fe36d46a234fa372c24104df9af9535f350326b8c","bytes":46113}),
  Object.freeze({"file":"20261022042500_spec08_finance_card_metadata.sql","sha256":"8406c90596d1b5679827f3aa61b3fd229f7c17bee5d4f9ae46753bfd3fddd51c","bytes":8565}),
  Object.freeze({"file":"20261022042501_spec08_capture_knowledge_promotion.sql","sha256":"40b1366a110de7ac614387af3930a2332f2603f7d50af7a7a0037d7da9115b07","bytes":44266}),
  Object.freeze({"file":"20261023061901_onboarding_foundation.sql","sha256":"e62727f4aa3a2f56948bf3a3c2f4ec24b1a8278ac3bef07591424b1ba422e697","bytes":77585}),
  Object.freeze({"file":"20261024130000_finance_mvp_vertical.sql","sha256":"f96d7a62b9337b9688c34ac471dd9fd326318e12d859817c263bb1ccf46d072a","bytes":158010}),
]);
export class CanonicalReleaseSourceError extends Error {
  constructor(code) { super(code); this.name = "CanonicalReleaseSourceError"; this.code = code; }
}
const refuse = code => { throw new CanonicalReleaseSourceError(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);

async function canonicalFile(root, path) {
  const absolute = resolve(root, path), within = relative(root, absolute);
  if (!within || within === ".." || within.startsWith(".." + sep) || isAbsolute(within)) refuse("SOURCE_FILE_REFUSED");
  const stat = await lstat(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || await realpath(absolute) !== absolute) refuse("SOURCE_FILE_REFUSED");
  return readFile(absolute);
}
async function sqlNames(directory) {
  return (await readdir(directory)).filter(name => name.endsWith(".sql")).sort();
}
function sameNames(actual, expected) {
  return actual.length === expected.length && actual.every((name, index) => name === expected[index]);
}

/** Reuses the current manifest/bytes/copy/extras gate, with fixed reviewed pins.
 * This function does not qualify Git, a database catalogue, types or installation.
 */
export async function readCurrent27CanonicalMigrations(root = ROOT) {
  if (typeof root !== "string" || !isAbsolute(root)) refuse("SOURCE_FILE_REFUSED");
  root = resolve(root);
  let manifest, manifestBytes;
  try { manifestBytes = await canonicalFile(root, "supabase/sql-editor/manifest.json"); manifest = JSON.parse(manifestBytes); }
  catch { refuse("MIGRATION_MANIFEST_REFUSED"); }
  if (manifest.formatVersion !== 1 || manifest.hashAlgorithm !== "sha256" || !Array.isArray(manifest.installation) || manifest.installation.length !== 27) refuse("MIGRATION_MANIFEST_REFUSED");
  const expectedNames = CURRENT27_CANONICAL_REVIEW.map(row => row.file);
  const expectedCopies = CURRENT27_CANONICAL_REVIEW.map((row, index) => `${String(index + 1).padStart(3, "0")}_${row.file}`);
  const migrationDirectory = resolve(root, "supabase/migrations"), copyDirectory = resolve(root, "supabase/sql-editor/installation");
  if (!sameNames(await sqlNames(migrationDirectory), expectedNames) || !sameNames(await sqlNames(copyDirectory), expectedCopies)) refuse("MIGRATION_MANIFEST_REFUSED");
  const plan = [];
  for (const [index, row] of manifest.installation.entries()) {
    const expected = CURRENT27_CANONICAL_REVIEW[index], version = expected.file.slice(0, 14);
    if (!object(row) || row.order !== index + 1 || row.version !== version || !/^\d{14}$/.test(row.version) || typeof row.source !== "string" || !new RegExp(`^supabase/migrations/${row.version}_[a-z0-9_]+\\.sql$`).test(row.source) || !/^[a-f0-9]{64}$/.test(row.sha256) || !Number.isSafeInteger(row.bytes) || row.bytes < 1 || typeof row.file !== "string" || !new RegExp(`^installation/${String(row.order).padStart(3, "0")}_${row.version}_[a-z0-9_]+\\.sql$`).test(row.file) || basename(row.source) !== expected.file || row.source !== `supabase/migrations/${expected.file}` || row.file !== `installation/${expectedCopies[index]}` || row.bytes !== expected.bytes || row.sha256 !== expected.sha256) refuse("MIGRATION_MANIFEST_REFUSED");
    const source = await canonicalFile(root, row.source), copy = await canonicalFile(root, `supabase/sql-editor/${row.file}`);
    if (source.length !== expected.bytes || hash(source) !== expected.sha256 || !source.equals(copy)) refuse("MIGRATION_INTEGRITY_FAILED");
    plan.push(Object.freeze({ file: expected.file, source }));
  }
  // Recheck the same finite inputs; no database is opened by this module.
  if (!(await canonicalFile(root, "supabase/sql-editor/manifest.json")).equals(manifestBytes) || !sameNames(await sqlNames(migrationDirectory), expectedNames) || !sameNames(await sqlNames(copyDirectory), expectedCopies)) refuse("MIGRATION_MANIFEST_REFUSED");
  for (const [index, row] of plan.entries()) {
    if (!(await canonicalFile(root, `supabase/migrations/${row.file}`)).equals(row.source) || !(await canonicalFile(root, `supabase/sql-editor/installation/${expectedCopies[index]}`)).equals(row.source)) refuse("MIGRATION_INTEGRITY_FAILED");
  }
  return Object.freeze(plan);
}

/** Always validates all 27 first. No caller-provided array/count/fallback exists. */
export async function readHistorical026CanonicalMigrations(root = ROOT) {
  const current = await readCurrent27CanonicalMigrations(root);
  return Object.freeze(current.slice(0, 26));
}
