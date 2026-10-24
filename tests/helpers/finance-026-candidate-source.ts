/** Explicit disposable 001–026 review. No URL, secret, service or hosted runner.
 * Historical 001–025 helpers and proposal bytes are deliberately unchanged. */
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
/** Derived from immutable d16e1dd; not a pin observed from a running database. */
export const FINANCE_026_CANONICAL_REVIEW = Object.freeze([
  Object.freeze({"file":"20261007151834_identity_foundation.sql","bytes":30586,"sha256":"7a5bc2b2b7f1fc953159ab31820ec734a5e0d9554ce92ca952465ddfc0fdddfc"}),
  Object.freeze({"file":"20261007151850_auth_password_completion.sql","bytes":3206,"sha256":"18bdc83e45aa2169ba8404feebeb77c236d9cadc6792470de3b8f5745b091d30"}),
  Object.freeze({"file":"20261007151904_restrict_rls_event_trigger_execution.sql","bytes":1942,"sha256":"64a2838cd0ee18a422e28d889e8d9bc5c045204e913aec050628620083baca07"}),
  Object.freeze({"file":"20261007210519_capture_task_transactions.sql","bytes":47922,"sha256":"0645892ba82c4e13a391020aea4abfaeaa05a81283056adbc9954747b066b859"}),
  Object.freeze({"file":"20261007223710_activity_page.sql","bytes":6089,"sha256":"565d2912e36142b1694e8728ce665d8bf92321466193bdab6621dd2256940a2c"}),
  Object.freeze({"file":"20261009144343_financial_transactions.sql","bytes":40343,"sha256":"af3f102412f78e83f5f612666761c8b65b07239ee72bbf3ea81c56f9dd1c3557"}),
  Object.freeze({"file":"20261009144350_knowledge_pages_links.sql","bytes":44911,"sha256":"a9da2bb78314f2eb2b0f773fa5b200496b8a963e5103a25ebe13198e0fa37b2c"}),
  Object.freeze({"file":"20261009150122_identity_admin_settings.sql","bytes":26458,"sha256":"461708ac47abb50465bd71bd5a70f76fadba7dee599d6f114a82f8c22aee7862"}),
  Object.freeze({"file":"20261009151557_account_preferences.sql","bytes":8757,"sha256":"d183f660303227d21ceb11dd84a676d3ebeefb233d3a76802b2d0b380c58806c"}),
  Object.freeze({"file":"20261009152200_projects_habits.sql","bytes":40073,"sha256":"c57c54245926c66b5cbe87baaceee101d8d0d9cc0b0537c22040d6d423d3abe6"}),
  Object.freeze({"file":"20261009152822_private_storage_drive.sql","bytes":41845,"sha256":"a1a66fcd601d46e905f6db5a890a4799d9b3409b3331bb832e6e74301184f8b9"}),
  Object.freeze({"file":"20261009154609_global_search_activity.sql","bytes":13627,"sha256":"b91f2acbf62794811bd906e2592fb86b48205d5366e1446e6de7c9bfbd3a58e7"}),
  Object.freeze({"file":"20261009160151_encrypted_vault.sql","bytes":22103,"sha256":"3f1af61dbe5954e2e5354441e47e411463eb6314f0ae7471edfbc8cae7aa35ff"}),
  Object.freeze({"file":"20261009160158_google_calendar.sql","bytes":50471,"sha256":"621bc732a818da2627e245a1614264b5e3a70b8f330510d1fae06bef524ed0e3"}),
  Object.freeze({"file":"20261009231338_file_cleanup_fairness.sql","bytes":3522,"sha256":"f71c6bb9debb24f032bb64824420693c9be6b4ab566f54d51dac6cdb658f897a"}),
  Object.freeze({"file":"20261010010955_close_public_sequence_defaults.sql","bytes":1842,"sha256":"add5b17ee8af3162ed893d1ac955c4fe5229707b7807d43a58b8c9124dc8e381"}),
  Object.freeze({"file":"20261010044217_finance_monthly_plan.sql","bytes":1533,"sha256":"a45052833425a647a193e8d3588257fa6cb392aa12ef39b34f89b57e06d882bf"}),
  Object.freeze({"file":"20261011071500_admin_auth_creation_order.sql","bytes":4717,"sha256":"91d91aa94883f803139f30c250fc92322de31cc6c29df293462eac8e459c4a99"}),
  Object.freeze({"file":"20261011113751_own_sessions.sql","bytes":4115,"sha256":"0cab745bbb315ca700921db9addc13e113fb450eb08095fc37ec1e8ada1aae57"}),
  Object.freeze({"file":"20261021045700_spec08_private_entity_images.sql","bytes":17601,"sha256":"385dff57a2d81fe8b7ba92f6bc95d16d25ee09f7c85106fa5f40711a03dedde2"}),
  Object.freeze({"file":"20261021144650_spec08_habit_frequency_history.sql","bytes":23511,"sha256":"90156cf1069e2934b38160099156086ac4d60d0e349932d96565b35d3312083e"}),
  Object.freeze({"file":"20261021171416_spec08_capture_document_write.sql","bytes":32167,"sha256":"431e7521306951d403aba861541805b350cf30523d0e52b7634825852f961b38"}),
  Object.freeze({"file":"20261022042432_spec08_calendar_participants.sql","bytes":46113,"sha256":"b7a0a3f893e1cf5ac5f95c3fe36d46a234fa372c24104df9af9535f350326b8c"}),
  Object.freeze({"file":"20261022042500_spec08_finance_card_metadata.sql","bytes":8565,"sha256":"8406c90596d1b5679827f3aa61b3fd229f7c17bee5d4f9ae46753bfd3fddd51c"}),
  Object.freeze({"file":"20261022042501_spec08_capture_knowledge_promotion.sql","bytes":44266,"sha256":"40b1366a110de7ac614387af3930a2332f2603f7d50af7a7a0037d7da9115b07"}),
  Object.freeze({"file":"20261023061901_onboarding_foundation.sql","bytes":77585,"sha256":"e62727f4aa3a2f56948bf3a3c2f4ec24b1a8278ac3bef07591424b1ba422e697"}),
]);
type SourceRow = { file: string; source: string };
/** Public fixture check; preserves order and refuses extra/missing/altered SQL before a database exists. */
export function assertFinance026Sources(rows: readonly SourceRow[]) {
  if (rows.length !== FINANCE_026_CANONICAL_REVIEW.length) throw new Error("Finance026 canonical chain differs from reviewed 001–026.");
  for (const [index, row] of rows.entries()) {
    const expected = FINANCE_026_CANONICAL_REVIEW[index]!, source = row.source.replaceAll("\r\n", "\n");
    if (row.file !== expected.file || Buffer.byteLength(source, "utf8") !== expected.bytes || createHash("sha256").update(source).digest("hex") !== expected.sha256) throw new Error("Finance026 canonical source differs from reviewed bytes.");
  }
}
export async function readFinance026Sources(): Promise<SourceRow[]> {
  const names = (await readdir(resolve(root, "supabase/migrations"))).filter(name => name.endsWith(".sql")).sort();
  if (names.length !== FINANCE_026_CANONICAL_REVIEW.length || names.some((name, index) => name !== FINANCE_026_CANONICAL_REVIEW[index]!.file)) throw new Error("Finance026 canonical filenames differ from reviewed 001–026.");
  const sources = await Promise.all(names.map(async file => ({ file, source: await readFile(resolve(root, "supabase/migrations", file), "utf8") })));
  assertFinance026Sources(sources); return sources;
}
