-- Independent, SELECT-only post-candidate catalogue verifier. No migrations or data writes.
-- Run as a privileged read-only transaction AFTER separately classifying PT409.
-- Hashes are pinned to the reviewed candidate composition, not the current DB.
-- This checks catalogue shape, not hosted Auth/SMTP, runtime isolation or backups.
-- pg_get_constraintdef / pg_get_indexdef formatting can vary by PostgreSQL version;
-- classify a mismatch on the target version before considering any release.
WITH expected_proc(signature,result,argnames,definer,volatility,language,body_hash,service_execute) AS (VALUES
  ('app_private.admission_admin_completed()', 'trigger', null, true, 'v', 'plpgsql', '2a9914c03e5a8479776365453e18e2b4e9c55f4a538142ce0ee0791da4f8b9c8', false),
  ('app_private.admission_new_identity()', 'trigger', null, true, 'v', 'plpgsql', '8f8dad6cf3e16f242c83ed2ad05e7df7974ea47b9155fa97e8b77c356c7b1bcd', false),
  ('app_private.feedback_list(uuid,uuid,timestamp with time zone,uuid)', 'jsonb', array['p_user','p_session','p_before','p_before_id']::text[], true, 'v', 'plpgsql', 'e0871013c05543658156515ab3a6178feab793deeebe777346e57a5a099f2ac1', true),
  ('app_private.feedback_submit(uuid,uuid,uuid,text,text)', 'jsonb', array['p_user','p_session','p_client','p_category','p_message']::text[], true, 'v', 'plpgsql', 'a8224aee521795aefce22a22267ac501e41d833a889e5cb269f7af5b9b0e263e', true),
  ('app_private.session_active(uuid,uuid)', 'boolean', array['p_user','p_session']::text[], true, 's', 'sql', 'b68dc52d4437258e1105d481ba840aa9e023f33998b8a3c7562b4f4dc49de3d1', false),
  ('app_private.signup_attest_password_reset(uuid,uuid,uuid,text)', 'void', array['p_user','p_session','p_intent','p_subject_hash']::text[], true, 'v', 'plpgsql', '4b3911cc961f3c87b9be36f8c13b40ef22a80ecb72a954a3a9e719092903475a', true),
  ('app_private.signup_complete(uuid,uuid,uuid,text,text,text,boolean,text)', 'jsonb', array['p_user','p_session','p_intent','p_subject_hash','p_terms','p_privacy','p_accept_origin','p_origin_version']::text[], true, 'v', 'plpgsql', 'c668ea451bb1cccd088f33ddd962b40cbe85d020917f3a636e1e37af7e133963', true),
  ('app_private.signup_discard_pending_origin(uuid,uuid,uuid,text)', 'jsonb', array['p_user','p_session','p_intent','p_subject_hash']::text[], true, 'v', 'plpgsql', '1bf40ae95160a223d1c52710dc0d4e4e63b80b10a2565341fb2903bcedfc553f', true),
  ('app_private.signup_find_bound_intent(uuid,uuid,text)', 'jsonb', array['p_user','p_session','p_subject_hash']::text[], true, 'v', 'plpgsql', '1c4f65e74b3fda1889787f78833c1a80d95708ca7a6f3af8c81dd710c41cef06', true),
  ('app_private.signup_intent_create(text,text,text,text,timestamp with time zone,jsonb,text)', 'uuid', array['p_binding_hash','p_subject_hash','p_terms','p_privacy','p_expires','p_origin','p_origin_version']::text[], true, 'v', 'plpgsql', '226ff226025a72f3ecc6dedf898edf8dc899f6ce9e8ba58bd62064d7977904b5', true),
  ('app_private.signup_origin_status(uuid,uuid)', 'jsonb', array['p_user','p_session']::text[], true, 'v', 'plpgsql', 'cd300f1e81dd9ffd3b082de607556bd760c9c17b45fae5acd17fbe3173c2d541', true),
  ('app_private.signup_origin_withdraw(uuid,uuid)', 'jsonb', array['p_user','p_session']::text[], true, 'v', 'plpgsql', '2a844e3e9e4563692029e6b4f062ee414c3e87469f7cc2c662bbab321f7fd847', true),
  ('app_private.signup_pending_identity(uuid,uuid)', 'boolean', array['p_user','p_session']::text[], true, 's', 'sql', 'e9970d79b437025da130a2a63e2b63d95baf0dd3d2b7c388f6c1c7f4169baa89', false),
  ('app_private.signup_prune()', 'jsonb', null, true, 'v', 'plpgsql', '8a0c0c2b6871d750d83596649b59f424204b1bcac0d6192a998c7bfff04ef641', true),
  ('app_private.signup_recover_verified_intent(uuid,uuid,text,text,text)', 'jsonb', array['p_user','p_session','p_subject_hash','p_terms','p_privacy']::text[], true, 'v', 'plpgsql', '446650bd5627610bea4809d777318e7134739847c89e2b1da313ef1819f8426f', true),
  ('app_private.valid_signup_origin(jsonb)', 'boolean', array['p_origin']::text[], false, 'i', 'sql', '2d82275f0dcbc930580fa9ff87fe72300ff80065980c5580a0a7759719a90a6d', false),
  ('public.feedback_list(uuid,uuid,timestamp with time zone,uuid)', 'jsonb', array['p_user','p_session','p_before','p_before_id']::text[], false, 'v', 'sql', '1bd2a930c2509dabcaab1a1c489a20d77167c9901e1e5568f9f815cef63c1c16', true),
  ('public.feedback_submit(uuid,uuid,uuid,text,text)', 'jsonb', array['p_user','p_session','p_client','p_category','p_message']::text[], false, 'v', 'sql', '56573561522d7eb3e569f0b4ec61d6dfcaf9ab2599becabc7a1c67a65052ba11', true),
  ('public.signup_attest_password_reset(uuid,uuid,uuid,text)', 'void', array['p_user','p_session','p_intent','p_subject_hash']::text[], false, 'v', 'sql', 'f06c692a894856c43bfb6dddb7e12b2a8dc22493aa4543763d7dde842c4531a0', true),
  ('public.signup_complete(uuid,uuid,uuid,text,text,text,boolean,text)', 'jsonb', array['p_user','p_session','p_intent','p_subject_hash','p_terms','p_privacy','p_accept_origin','p_origin_version']::text[], false, 'v', 'sql', 'b784f969eb0d60f14b1d44da50e905acf7a5dca3f217db48fe603a29b78fdca2', true),
  ('public.signup_discard_pending_origin(uuid,uuid,uuid,text)', 'jsonb', array['p_user','p_session','p_intent','p_subject_hash']::text[], false, 'v', 'sql', '6c5ebe7787a94b9e62048401589319edfb52d18579fb2d06771f055e22f642d3', true),
  ('public.signup_find_bound_intent(uuid,uuid,text)', 'jsonb', array['p_user','p_session','p_subject_hash']::text[], false, 'v', 'sql', '9df7bd2b22b1690eff1309e89f793bbf278d27438e9dfa3988f365b7f8e8e8dc', true),
  ('public.signup_intent_create(text,text,text,text,timestamp with time zone,jsonb,text)', 'uuid', array['p_binding_hash','p_subject_hash','p_terms','p_privacy','p_expires','p_origin','p_origin_version']::text[], false, 'v', 'sql', '470bf9a2c7d504ca70ecd1fdb541189f2ba27a861091157f7d355c9eba996cf5', true),
  ('public.signup_metrics(uuid,uuid,date,date,text,text)', 'jsonb', array['p_actor','p_session','p_start','p_end','p_zone','p_bucket']::text[], true, 'v', 'plpgsql', '83621116cdcf34305f1bf12f80fcaf2644e46f305766dab256e78daa036818e6', true),
  ('public.signup_origin_status(uuid,uuid)', 'jsonb', array['p_user','p_session']::text[], false, 'v', 'sql', 'ed4833b5dac75a468d2df6b0be2ac1d98f304b239f76ca1915c133125a5e5612', true),
  ('public.signup_origin_withdraw(uuid,uuid)', 'jsonb', array['p_user','p_session']::text[], false, 'v', 'sql', '17c3b5544199569cffc72602858e5bb2bad6a0888e76c47895a4f9a616fb6263', true),
  ('public.signup_prune()', 'jsonb', null, false, 'v', 'sql', '83a63ed59363fc48cf51dc9265cac25106f0df60eec2a262963cdec1d1843f92', true),
  ('public.signup_recover_verified_intent(uuid,uuid,text,text,text)', 'jsonb', array['p_user','p_session','p_subject_hash','p_terms','p_privacy']::text[], false, 'v', 'sql', '1c44bc50a684573383162d126641c9afac6e1abf3b5e3507d7400b16ddd8895e', true)
), proc_fail AS (
 SELECT e.signature AS object FROM expected_proc e
 LEFT JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(e.signature)
 LEFT JOIN pg_catalog.pg_language l ON l.oid=p.prolang
 WHERE p.oid IS NULL OR pg_catalog.pg_get_userbyid(p.proowner)<>'postgres'
 OR pg_catalog.pg_get_function_result(p.oid) IS DISTINCT FROM e.result
 OR p.proargnames IS DISTINCT FROM e.argnames OR p.prosecdef IS DISTINCT FROM e.definer
 OR p.proisstrict IS DISTINCT FROM false
 OR p.provolatile::text IS DISTINCT FROM e.volatility OR l.lanname IS DISTINCT FROM e.language
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
 OR pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex') IS DISTINCT FROM e.body_hash
 OR pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') IS DISTINCT FROM false
 OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') IS DISTINCT FROM false
 OR pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') IS DISTINCT FROM e.service_execute
 OR EXISTS (SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
   WHERE a.privilege_type<>'EXECUTE' OR a.is_grantable OR a.grantor<>p.proowner OR
   (a.grantee<>p.proowner AND (NOT e.service_execute OR a.grantee<>(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='service_role'))))
), expected_table(name,columns_hash) AS (VALUES
  ('app_private.feedback_requests', '7953da2c385bd4cea77a9f259b89e81eb3f7b1f88a91ba4b4828ede3ae50e15c'),
  ('app_private.signup_intents', '55fd97ea5c8b11c3646003f207d26b6723320358a3dda74f961dfea93dc4bfc6'),
  ('app_private.signup_origins', '0b4d9c1ae2141c00624153c20f94cbe50121e776cc3eefd3256ef70d27cee1f0'),
  ('app_private.signup_password_proofs', 'e973a85c080f096097ec99319b1e66a409361a85dc2854a83489a538f943bbfc'),
  ('app_private.signup_settings', '1440c5628a08663ceef82c67e76d857316b916370acabe891cc388731d56cfce'),
  ('app_private.user_admission', '4613850b224ec54a641578299c654369875b5fa0d64c1b5dbf79f6b4cce506b3')
), table_fail AS (
 SELECT e.name AS object FROM expected_table e LEFT JOIN pg_catalog.pg_class c ON c.oid=pg_catalog.to_regclass(e.name)
 WHERE c.oid IS NULL OR c.relkind<>'r' OR NOT c.relrowsecurity OR pg_catalog.pg_get_userbyid(c.relowner)<>'postgres'
 OR EXISTS (SELECT 1 FROM pg_catalog.pg_policy pol WHERE pol.polrelid=c.oid)
 OR EXISTS (SELECT 1 FROM pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a WHERE a.grantee<>c.relowner)
 OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL)
 OR (SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(string_agg(a.attname||'|'||pg_catalog.format_type(a.atttypid,a.atttypmod)||'|'||a.attnotnull::text||'|'||coalesce(pg_catalog.pg_get_expr(d.adbin,d.adrelid),''),E'\n' ORDER BY a.attnum),'UTF8')),'hex') FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) IS DISTINCT FROM e.columns_hash
), expected_onboarding_column(name,type_name,not_null,default_value) AS (VALUES
 ('source_operation','uuid',false,NULL),
 ('source_kind','text',true,'''admin''::text'),
 ('source_intent','uuid',false,NULL)
), onboarding_column_fail AS (
 SELECT 'app_private.onboarding_entries.'||e.name AS object FROM expected_onboarding_column e
 LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=pg_catalog.to_regclass('app_private.onboarding_entries') AND a.attname=e.name AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attnum IS NULL OR pg_catalog.format_type(a.atttypid,a.atttypmod) IS DISTINCT FROM e.type_name
 OR a.attnotnull IS DISTINCT FROM e.not_null OR pg_catalog.pg_get_expr(d.adbin,d.adrelid) IS DISTINCT FROM e.default_value
), expected_constraint(tab,name,kind,definition_hash) AS (VALUES
  ('app_private.feedback_requests', 'feedback_requests_category_check', 'c', 'ac08e29ab726f6119c61613d84ba2c1f492a69726c035a992671860f2a35bf30'),
  ('app_private.feedback_requests', 'feedback_requests_message_check', 'c', 'c8d8dfd3c0f8b3d4be799a8ebbf456c384a0d3cedf577acfea055a342c65282b'),
  ('app_private.feedback_requests', 'feedback_requests_pkey', 'p', '8c8464f42472e42ee190fc91ca8db79b5351d3a4609040516578d229c56f6fa5'),
  ('app_private.feedback_requests', 'feedback_requests_user_id_client_id_key', 'u', '879612feec494fa45bed29faa9c7e9281da89a3f0c7773b7e4d988de79eb8989'),
  ('app_private.feedback_requests', 'feedback_requests_user_id_fkey', 'f', '7dffc1fe5c72443147ef9227e966626cdc6e5997f36e90bcc553577512766d2a'),
  ('app_private.onboarding_entries', 'onboarding_entries_pkey', 'p', '44756d887704fc88d8d0adc5c0c431103c555b4f8e6a4ddef6f7a7f6b4110606'),
  ('app_private.onboarding_entries', 'onboarding_entries_source_intent_fkey', 'f', '1f2416013526510cba22dd19db0a77133830e1a01eea50b1e9db32a931d1cd7e'),
  ('app_private.onboarding_entries', 'onboarding_entries_source_intent_key', 'u', '33ae35b7fb6dcd8e7034589cc00a376178cc04cce1955081b10bc447e5d857eb'),
  ('app_private.onboarding_entries', 'onboarding_entries_source_operation_fkey', 'f', '33bcbf47f249e18c31dedaf7dedfc6aa8ea8210596b04807bb23f7f8b9c8b12b'),
  ('app_private.onboarding_entries', 'onboarding_entries_source_operation_key', 'u', '045c7289070ebace55f491c1129da96a23b0a33fbe1e2f00e1af862d95f804a7'),
  ('app_private.onboarding_entries', 'onboarding_entries_user_id_fkey', 'f', '7dffc1fe5c72443147ef9227e966626cdc6e5997f36e90bcc553577512766d2a'),
  ('app_private.onboarding_entries', 'onboarding_entry_source_check', 'c', '3bc7e2e6293dc41032d1da38174cd9a407efe0bb4496e1ce9f58554b19e0d3ae'),
  ('app_private.signup_intents', 'signup_intents_binding_hash_check', 'c', '8df280428322d534a5d0ef970f7f26873e75f29273eea86150ee6be8933ae205'),
  ('app_private.signup_intents', 'signup_intents_binding_hash_key', 'u', 'aee2045076c32a4a8e677f204e4d62c8f940fa34e930ba82a2d2c3d74de6cffa'),
  ('app_private.signup_intents', 'signup_intents_check', 'c', '0e14edd9476676b867f66f21dbeb36a31bfb2ee1379441ef10965f48268f63d9'),
  ('app_private.signup_intents', 'signup_intents_check1', 'c', 'eda19f4582650f1bd51d3cef4e7156240f0d1acb6bf36ec3d15acfcd51c0a585'),
  ('app_private.signup_intents', 'signup_intents_check2', 'c', '5132193ede1b0917da588828f90a0b54104b6dd78cce414997cc1fa450cc56a1'),
  ('app_private.signup_intents', 'signup_intents_pkey', 'p', '8c8464f42472e42ee190fc91ca8db79b5351d3a4609040516578d229c56f6fa5'),
  ('app_private.signup_intents', 'signup_intents_privacy_version_check', 'c', '82dcd24f3f864871879fe4e3c26de490c7d8ed7c64062da0aad9bffe783c6785'),
  ('app_private.signup_intents', 'signup_intents_state_check', 'c', '291be1dd180d6e7de7bbde0fe81757e9bf26cb56d026169c45e3ebeee39d3a94'),
  ('app_private.signup_intents', 'signup_intents_subject_hash_check', 'c', 'd07c422f7e868df163923fcfe18f658e720aec6d3cca89d82bb80df079412b60'),
  ('app_private.signup_intents', 'signup_intents_terms_version_check', 'c', '47a6bd9ba28ed6328c75c36969a27148aa967658330be95c083ea9e3fa507237'),
  ('app_private.signup_intents', 'signup_intents_user_id_fkey', 'f', '7dffc1fe5c72443147ef9227e966626cdc6e5997f36e90bcc553577512766d2a'),
  ('app_private.signup_intents', 'signup_intents_user_id_key', 'u', '7b57a91ef8796675f24340b9ddd1ef66347ca8cd012feee53430b5c149dfbfea'),
  ('app_private.signup_origins', 'signup_origins_consent_version_check', 'c', '21097b528cfd1024f4a05939a80903a6adb1c722de6c56cba9cd660179a84258'),
  ('app_private.signup_origins', 'signup_origins_origin_check', 'c', '45fd01e8487ebff218bd29ee295c596039235895e46a24c1a9621b01d66858cf'),
  ('app_private.signup_origins', 'signup_origins_pkey', 'p', '44756d887704fc88d8d0adc5c0c431103c555b4f8e6a4ddef6f7a7f6b4110606'),
  ('app_private.signup_origins', 'signup_origins_user_id_fkey', 'f', '7dffc1fe5c72443147ef9227e966626cdc6e5997f36e90bcc553577512766d2a'),
  ('app_private.signup_password_proofs', 'signup_password_proofs_intent_id_fkey', 'f', 'b0c81a1c088ac9efa5eb0e8b7abca3f0632a577af773449e8773de6c426a2129'),
  ('app_private.signup_password_proofs', 'signup_password_proofs_pkey', 'p', '0463a80cc0953237a4318d0f398e7a0c3e1d280c40f333602c5baede477e0de1'),
  ('app_private.signup_password_proofs', 'signup_password_proofs_session_id_fkey', 'f', '4910017cf883a78fb9c87bd9b8a13f84fe30efd68d08a7f8cbd6ff944821ec80'),
  ('app_private.signup_password_proofs', 'signup_password_proofs_user_id_fkey', 'f', '7dffc1fe5c72443147ef9227e966626cdc6e5997f36e90bcc553577512766d2a'),
  ('app_private.signup_settings', 'signup_settings_pkey', 'p', 'd004b3efcdc4a0108ecbe83c93408f63eebecc563529a3941a4c59667835f25b'),
  ('app_private.signup_settings', 'signup_settings_singleton_check', 'c', '0a780c77dfabbc15def3d17957997d352de196c1233a0d25fccc97a40d2d6f41'),
  ('app_private.user_admission', 'user_admission_check', 'c', '4a0ae192b97f6c927621c0dc0256faf7ec1f9b4348432cd21521ade0b027e49e'),
  ('app_private.user_admission', 'user_admission_check1', 'c', '4a9a46b730331a51007e4acedfab6b42a8a9d45df52f4bb85efe045f0cd513ee'),
  ('app_private.user_admission', 'user_admission_origin_check', 'c', '155755577bb5d51f6d1a669304cd89314da447b293f427a455a05258996eb050'),
  ('app_private.user_admission', 'user_admission_pkey', 'p', '44756d887704fc88d8d0adc5c0c431103c555b4f8e6a4ddef6f7a7f6b4110606'),
  ('app_private.user_admission', 'user_admission_state_check', 'c', '53464237956bf16d26f4a7949bfa025bba93e0335434a4608fa5ff6370ca338c'),
  ('app_private.user_admission', 'user_admission_user_id_fkey', 'f', '7dffc1fe5c72443147ef9227e966626cdc6e5997f36e90bcc553577512766d2a'),
  ('public.domain_events', 'calendar_metadata_only', 'c', 'ec332a8f5ac067e7787bfed50e681c3960de763a9cf1d85355f756e952978c2f'),
  ('public.domain_events', 'domain_events_action_check', 'c', '23d74f1371849431005a78083ead5018d0a0bca382cff5932ef0249472c1ba18'),
  ('public.domain_events', 'domain_events_after_check', 'c', '2d2afc89a59ef895956362da9a4a920a9304a9fef6f15d71d68e9a5940e8e3a3'),
  ('public.domain_events', 'domain_events_before_check', 'c', '4bc1a0de65673a35c522d293af145b71aec5906495a7273e1cd50e16a6244846'),
  ('public.domain_events', 'domain_events_canal_check', 'c', '86eec093f59cbcbdbee4430455a6140055483849ae6c2652a3eba63285a74f59'),
  ('public.domain_events', 'domain_events_capture_task_payload_check', 'c', '375cbcf4e2e116e86ca8f3b359dd90ea3c612c8f3979020ab5d5d6be8c0fc680'),
  ('public.domain_events', 'domain_events_check', 'c', 'a5dfd926800633c03c1817e6b09d22ec527f1184663aae50910c4f64390db568'),
  ('public.domain_events', 'domain_events_check1', 'c', 'cbc9a137a4e3aa3d5faae895aef6c692aea3a5232f0a7da06cc6834939d7a788'),
  ('public.domain_events', 'domain_events_entity_type_check', 'c', 'e0dd19f398b8fb1c6b96776f682ebcf5c119f42229cb9136d614c31ad29163e7'),
  ('public.domain_events', 'domain_events_pkey', 'p', '8c8464f42472e42ee190fc91ca8db79b5351d3a4609040516578d229c56f6fa5'),
  ('public.domain_events', 'domain_events_user_id_fkey', 'f', '7dffc1fe5c72443147ef9227e966626cdc6e5997f36e90bcc553577512766d2a'),
  ('public.domain_events', 'vault_metadata_only', 'c', '6da74a0c91be2f21a416eabe9eeb18e798246ab4d5b88b31f0bcabb8a06d3512')
), constraint_fail AS (
 SELECT e.tab||'.'||e.name AS object FROM expected_constraint e LEFT JOIN pg_catalog.pg_constraint c ON c.conrelid=pg_catalog.to_regclass(e.tab) AND c.conname=e.name
 WHERE c.oid IS NULL OR c.contype::text IS DISTINCT FROM e.kind OR NOT c.convalidated OR pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_constraintdef(c.oid),'UTF8')),'hex') IS DISTINCT FROM e.definition_hash
), constraint_set_fail AS (
 SELECT DISTINCT e.tab AS object FROM expected_constraint e
 WHERE EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass(e.tab) AND c.contype<>'n'
   AND NOT EXISTS (SELECT 1 FROM expected_constraint expected WHERE expected.tab=e.tab AND expected.name=c.conname AND expected.kind=c.contype::text))
), fk_trigger_fail AS (
 SELECT e.tab||'.'||e.name AS object FROM expected_constraint e
 JOIN pg_catalog.pg_constraint c ON c.conrelid=pg_catalog.to_regclass(e.tab) AND c.conname=e.name AND c.contype='f'
 WHERE c.condeferrable OR c.condeferred OR (SELECT count(*) FROM pg_catalog.pg_trigger t WHERE t.tgconstraint=c.oid)<>4
 OR EXISTS (SELECT 1 FROM (VALUES
  (c.conrelid,5,'RI_FKey_check_ins'),(c.conrelid,17,'RI_FKey_check_upd'),
  (c.confrelid,9,CASE c.confdeltype WHEN 'a' THEN 'RI_FKey_noaction_del' WHEN 'r' THEN 'RI_FKey_restrict_del' WHEN 'c' THEN 'RI_FKey_cascade_del' WHEN 'n' THEN 'RI_FKey_setnull_del' WHEN 'd' THEN 'RI_FKey_setdefault_del' END),
  (c.confrelid,17,CASE c.confupdtype WHEN 'a' THEN 'RI_FKey_noaction_upd' WHEN 'r' THEN 'RI_FKey_restrict_upd' WHEN 'c' THEN 'RI_FKey_cascade_upd' WHEN 'n' THEN 'RI_FKey_setnull_upd' WHEN 'd' THEN 'RI_FKey_setdefault_upd' END)
 ) AS expected(relid,kind,fn) WHERE (SELECT count(*) FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE t.tgconstraint=c.oid AND t.tgrelid=expected.relid AND t.tgtype=expected.kind AND t.tgisinternal AND t.tgenabled='O'
   AND NOT t.tgdeferrable AND NOT t.tginitdeferred AND t.tgnargs=0 AND t.tgqual IS NULL AND p.proname=expected.fn AND n.nspname='pg_catalog')<>1)
), expected_index(name,definition_hash) AS (VALUES
  ('app_private.feedback_requests_owner_created', 'e63a1d174b10a20c9fecb753f035efac799767f596707e431faab79bbcd6a08d'),
  ('app_private.signup_intents_expiry', '91ac55af1c2ecbd98207e33545963cf6c344b0007fa8197e49dd27658f641352'),
  ('app_private.signup_intents_retention', '0086b1fe5dd670da2d5b1eaa25fcc05d7d7795f563668a7ffda236bdf9204a49'),
  ('app_private.signup_origins_expiry', '7323a2ea600b3c35fabce9c1396b8538cc41dba1c5367f79afb4973d605b4a0c')
), index_fail AS (
 SELECT e.name AS object FROM expected_index e LEFT JOIN pg_catalog.pg_class c ON c.oid=pg_catalog.to_regclass(e.name) LEFT JOIN pg_catalog.pg_index i ON i.indexrelid=c.oid
 WHERE c.oid IS NULL OR NOT coalesce(i.indisvalid,false) OR NOT coalesce(i.indisready,false) OR pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_indexdef(c.oid),'UTF8')),'hex') IS DISTINCT FROM e.definition_hash
), expected_trigger(tab,name,definition) AS (VALUES
 ('auth.users','second_brain_admission_created','CREATE TRIGGER second_brain_admission_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION app_private.admission_new_identity()'),
 ('auth.users','second_brain_admin_creation_final','CREATE CONSTRAINT TRIGGER second_brain_admin_creation_final AFTER INSERT ON auth.users DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.check_admin_auth_creation_final()'),
 ('auth.users','second_brain_identity_created','CREATE TRIGGER second_brain_identity_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION app_private.on_auth_user_created()'),
 ('app_private.admin_operations','admission_verified_admin_completion','CREATE TRIGGER admission_verified_admin_completion AFTER UPDATE OF phase ON app_private.admin_operations FOR EACH ROW EXECUTE FUNCTION app_private.admission_admin_completed()'),
 ('app_private.admin_operations','onboarding_verified_admin_completion','CREATE TRIGGER onboarding_verified_admin_completion AFTER UPDATE OF phase ON app_private.admin_operations FOR EACH ROW EXECUTE FUNCTION app_private.onboarding_enroll_admin()'),
 ('public.domain_events','capture_task_event','CREATE TRIGGER capture_task_event BEFORE INSERT OR UPDATE ON public.domain_events FOR EACH ROW EXECUTE FUNCTION app_private.capture_task_event()'),
 ('public.domain_events','capture_task_revision','CREATE TRIGGER capture_task_revision AFTER INSERT OR DELETE OR UPDATE ON public.domain_events FOR EACH ROW EXECUTE FUNCTION app_private.capture_task_bump()'),
 ('public.domain_events','finance_revision','CREATE TRIGGER finance_revision AFTER INSERT OR DELETE OR UPDATE ON public.domain_events FOR EACH ROW EXECUTE FUNCTION app_private.finance_bump()'),
 ('public.domain_events','projects_habits_revision','CREATE TRIGGER projects_habits_revision AFTER INSERT OR DELETE OR UPDATE ON public.domain_events FOR EACH ROW EXECUTE FUNCTION app_private.projects_habits_bump()'),
 ('public.domain_events','vault_revision','CREATE TRIGGER vault_revision AFTER INSERT OR DELETE OR UPDATE ON public.domain_events FOR EACH ROW EXECUTE FUNCTION app_private.vault_bump()')
), trigger_fail AS (
 SELECT e.tab||'.'||e.name AS object FROM expected_trigger e LEFT JOIN pg_catalog.pg_trigger t ON t.tgrelid=pg_catalog.to_regclass(e.tab) AND t.tgname=e.name AND NOT t.tgisinternal
 WHERE t.oid IS NULL OR t.tgenabled<>'O' OR pg_catalog.pg_get_triggerdef(t.oid) IS DISTINCT FROM e.definition
), trigger_set_fail AS (
 SELECT n.nspname||'.'||c.relname||'.'||t.tgname AS object FROM pg_catalog.pg_trigger t
 JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT t.tgisinternal AND (n.nspname||'.'||c.relname IN (SELECT name FROM expected_table)
   OR n.nspname||'.'||c.relname IN ('app_private.onboarding_entries','app_private.admin_operations','auth.users','public.domain_events'))
 AND NOT EXISTS (SELECT 1 FROM expected_trigger e WHERE e.tab=n.nspname||'.'||c.relname AND e.name=t.tgname)
), internal_trigger_set_fail AS (
 SELECT n.nspname||'.'||r.relname AS object FROM pg_catalog.pg_trigger t
 JOIN pg_catalog.pg_class r ON r.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=r.relnamespace
 WHERE t.tgisinternal AND (n.nspname||'.'||r.relname IN (SELECT name FROM expected_table)
   OR n.nspname||'.'||r.relname IN ('app_private.onboarding_entries','public.domain_events'))
 AND NOT EXISTS (SELECT 1 FROM expected_constraint e JOIN pg_catalog.pg_constraint c
   ON c.conrelid=pg_catalog.to_regclass(e.tab) AND c.conname=e.name AND c.contype='f'
   WHERE t.tgconstraint=c.oid)
), failures AS (SELECT 'function' kind,object FROM proc_fail UNION ALL SELECT 'table',object FROM table_fail UNION ALL SELECT 'column',object FROM onboarding_column_fail UNION ALL SELECT 'constraint',object FROM constraint_fail UNION ALL SELECT 'constraint_set',object FROM constraint_set_fail UNION ALL SELECT 'fk_trigger',object FROM fk_trigger_fail UNION ALL SELECT 'index',object FROM index_fail UNION ALL SELECT 'trigger',object FROM trigger_fail UNION ALL SELECT 'trigger_set',object FROM trigger_set_fail UNION ALL SELECT 'internal_trigger_set',object FROM internal_trigger_set_fail)
SELECT jsonb_build_object('check','front_b_additive_catalogue','ok',NOT EXISTS(SELECT 1 FROM failures),'failures',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',kind,'object',object) ORDER BY kind,object) FROM failures),'[]'::jsonb)) AS result;
