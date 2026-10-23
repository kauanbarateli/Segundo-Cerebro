// Fixed public release source. Explicit selection never infers archive/schema identity.
// No IO, SQL execution, authorization, CLI, fallback or caller-supplied path.
const freeze = value => { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };
export const RESTORE_RELEASE_PACK_019 = freeze({
  "schemaVersion": 1,
  "id": "019",
  "sourceSha": "c46acea0c2cc81f82c083e2ae67a3c6480a2df1e",
  "sourceTree": "5319afc5bab91727ae9d869cbfc456904a71e733",
  "catalogue": {
    "path": "supabase/release-packs/019/release-catalog.sql",
    "bytes": 23271,
    "sha256": "06b61763ec27661000b01f9a34add2a1e1634d8cbd861d16c5c670894ba5d73c"
  },
  "migrations": [
    {
      "path": "supabase/migrations/20261007151834_identity_foundation.sql",
      "bytes": 30586,
      "sha256": "7a5bc2b2b7f1fc953159ab31820ec734a5e0d9554ce92ca952465ddfc0fdddfc",
      "gitBlob": "29242f198121fdcc1f79cfbc8450500c571d03ea"
    },
    {
      "path": "supabase/migrations/20261007151850_auth_password_completion.sql",
      "bytes": 3206,
      "sha256": "18bdc83e45aa2169ba8404feebeb77c236d9cadc6792470de3b8f5745b091d30",
      "gitBlob": "1a45d2a04d36da932c4afcb3db9c60f0b9961205"
    },
    {
      "path": "supabase/migrations/20261007151904_restrict_rls_event_trigger_execution.sql",
      "bytes": 1942,
      "sha256": "64a2838cd0ee18a422e28d889e8d9bc5c045204e913aec050628620083baca07",
      "gitBlob": "be0e8698a9b0e60b9a10c153c2110c649a86a312"
    },
    {
      "path": "supabase/migrations/20261007210519_capture_task_transactions.sql",
      "bytes": 47922,
      "sha256": "0645892ba82c4e13a391020aea4abfaeaa05a81283056adbc9954747b066b859",
      "gitBlob": "f6468b90f16bdb7429e11da76e237cd2b37ddf86"
    },
    {
      "path": "supabase/migrations/20261007223710_activity_page.sql",
      "bytes": 6089,
      "sha256": "565d2912e36142b1694e8728ce665d8bf92321466193bdab6621dd2256940a2c",
      "gitBlob": "2a87d04de95fd64e9c26c6e13e268f55c614387f"
    },
    {
      "path": "supabase/migrations/20261009144343_financial_transactions.sql",
      "bytes": 40343,
      "sha256": "af3f102412f78e83f5f612666761c8b65b07239ee72bbf3ea81c56f9dd1c3557",
      "gitBlob": "994e0664c57e0e8811535af20e6234566333009f"
    },
    {
      "path": "supabase/migrations/20261009144350_knowledge_pages_links.sql",
      "bytes": 44911,
      "sha256": "a9da2bb78314f2eb2b0f773fa5b200496b8a963e5103a25ebe13198e0fa37b2c",
      "gitBlob": "ba186448f5b3460443204dfd6af76b8f67d4e59e"
    },
    {
      "path": "supabase/migrations/20261009150122_identity_admin_settings.sql",
      "bytes": 26458,
      "sha256": "461708ac47abb50465bd71bd5a70f76fadba7dee599d6f114a82f8c22aee7862",
      "gitBlob": "1b993ce5adfeb4f3342d9c7593bdc47dbef8011f"
    },
    {
      "path": "supabase/migrations/20261009151557_account_preferences.sql",
      "bytes": 8757,
      "sha256": "d183f660303227d21ceb11dd84a676d3ebeefb233d3a76802b2d0b380c58806c",
      "gitBlob": "e0dd5b11bdc40ee1d0b50568badc9e5a2cab6dbc"
    },
    {
      "path": "supabase/migrations/20261009152200_projects_habits.sql",
      "bytes": 40073,
      "sha256": "c57c54245926c66b5cbe87baaceee101d8d0d9cc0b0537c22040d6d423d3abe6",
      "gitBlob": "666717a597c2ee4581a7306a3b47133612f7135b"
    },
    {
      "path": "supabase/migrations/20261009152822_private_storage_drive.sql",
      "bytes": 41845,
      "sha256": "a1a66fcd601d46e905f6db5a890a4799d9b3409b3331bb832e6e74301184f8b9",
      "gitBlob": "e93ff8362e74ef6c6a9b98b212b7864810855c65"
    },
    {
      "path": "supabase/migrations/20261009154609_global_search_activity.sql",
      "bytes": 13627,
      "sha256": "b91f2acbf62794811bd906e2592fb86b48205d5366e1446e6de7c9bfbd3a58e7",
      "gitBlob": "8a2ceb72076b472e7c0ed1e9ef64bb13d9e6480b"
    },
    {
      "path": "supabase/migrations/20261009160151_encrypted_vault.sql",
      "bytes": 22103,
      "sha256": "3f1af61dbe5954e2e5354441e47e411463eb6314f0ae7471edfbc8cae7aa35ff",
      "gitBlob": "0c631586924d356fbac51890f94335fc2b3c0c21"
    },
    {
      "path": "supabase/migrations/20261009160158_google_calendar.sql",
      "bytes": 50471,
      "sha256": "621bc732a818da2627e245a1614264b5e3a70b8f330510d1fae06bef524ed0e3",
      "gitBlob": "ac06579063a71c9f9dc0fd397d65350f64cebb8b"
    },
    {
      "path": "supabase/migrations/20261009231338_file_cleanup_fairness.sql",
      "bytes": 3522,
      "sha256": "f71c6bb9debb24f032bb64824420693c9be6b4ab566f54d51dac6cdb658f897a",
      "gitBlob": "9689e1bd666128f6fc1e3b3a467227624c1987a8"
    },
    {
      "path": "supabase/migrations/20261010010955_close_public_sequence_defaults.sql",
      "bytes": 1842,
      "sha256": "add5b17ee8af3162ed893d1ac955c4fe5229707b7807d43a58b8c9124dc8e381",
      "gitBlob": "00156f69d2ad8e572f9a738aeac6f9baf65fb2ff"
    },
    {
      "path": "supabase/migrations/20261010044217_finance_monthly_plan.sql",
      "bytes": 1533,
      "sha256": "a45052833425a647a193e8d3588257fa6cb392aa12ef39b34f89b57e06d882bf",
      "gitBlob": "66d3bacdef03221d82fcf4cfcc3832566726d1b0"
    },
    {
      "path": "supabase/migrations/20261011071500_admin_auth_creation_order.sql",
      "bytes": 4717,
      "sha256": "91d91aa94883f803139f30c250fc92322de31cc6c29df293462eac8e459c4a99",
      "gitBlob": "3068df2a9c7dc63363f90c96bcef8f6f1ff0f412"
    },
    {
      "path": "supabase/migrations/20261011113751_own_sessions.sql",
      "bytes": 4115,
      "sha256": "0cab745bbb315ca700921db9addc13e113fb450eb08095fc37ec1e8ada1aae57",
      "gitBlob": "44f81fb7caa332c5b84cb11f1e4f84f9fff1f363"
    }
  ],
  "provenance": "reviewed_public_source_only_not_archive_or_authority"
});
