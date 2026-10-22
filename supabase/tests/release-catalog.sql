-- T028 production review. Read-only catalogue/constant bucket checks; no fixtures or DDL.
-- Full current chain includes SPEC08 Calendar, card metadata and Capture promotion. One metadata JSON row, then ROLLBACK.
begin transaction read only;
set local statement_timeout='30s';
set local lock_timeout='5s';
-- Pin deparse resolution for the reviewed policy predicates; builtins come first.
set local search_path=pg_catalog,public;
with expected_tables(name) as (select unnest(array[
 'public.profiles','public.user_preferences','public.user_modules','public.user_roles','public.user_moderation','public.user_entitlements','public.domain_events',
 'public.categories','public.projects','public.captures','public.tasks','public.capture_links',
 'public.fin_accounts','public.fin_categories','public.fin_tags','public.fin_transactions','public.fin_transaction_tags','public.fin_budgets',
 'public.knowledge_notebooks','public.knowledge_pages','public.page_refs','public.links',
 'public.habits','public.habit_entries','public.habit_pauses','public.drive_folders','public.drive_files','public.capture_file_links','public.admin_audit_events',
 'public.vault_master_keys','public.vault_items','public.calendar_accounts','public.calendar_sources','public.calendar_events','public.calendar_sync_runs',
 'app_private.command_receipts','app_private.rate_limits','app_private.capture_task_revisions','app_private.finance_revisions','app_private.projects_habits_revisions','app_private.admin_operations','app_private.upload_reservations','app_private.file_cleanup_runs','app_private.vault_revisions',
 'app_private.google_credentials','app_private.google_event_links','app_private.google_calendar_cursors','app_private.google_oauth_flows','app_private.google_calendar_limits','app_private.google_sync_executions'
])), expected_rpc(signature,definer,browser) as (values
 ('public.my_sessions()',false,true),('public.my_access_state()',false,true),('public.update_identity(text,jsonb,text,text)',false,true),
 ('public.bootstrap_master(uuid)',false,false),('public.consume_rate_limit(text,text,uuid,uuid)',false,false),('public.prune_operational_data()',false,false),('public.complete_password_change(uuid,uuid,text)',false,false),
 ('public.capture_task_snapshot(uuid,uuid,text)',false,false),('public.capture_task_revision(uuid,uuid,text)',false,false),('public.capture_task_receipt(uuid,uuid,text,text,text)',false,false),('public.capture_task_commit(uuid,uuid,text,jsonb)',false,false),
 ('public.activity_page(uuid,uuid,integer,timestamp with time zone,uuid)',false,false),
 ('public.finance_snapshot(uuid,uuid,text)',false,false),('public.finance_revision(uuid,uuid,text)',false,false),('public.finance_receipt(uuid,uuid,text,text,text)',false,false),('public.finance_commit(uuid,uuid,text,jsonb)',false,false),
 ('public.transfer(uuid,uuid,text,jsonb)',false,false),('public.pay_statement(uuid,uuid,text,jsonb)',false,false),('public.create_series(uuid,uuid,text,jsonb)',false,false),('public.close_account(uuid,uuid,text,jsonb)',false,false),
 ('public.knowledge_snapshot(uuid,uuid,text)',false,false),('public.knowledge_commit(uuid,uuid,text,jsonb)',false,false),('public.knowledge_receipt(uuid,uuid,text,text,text)',false,false),('public.knowledge_capture_origins(uuid,uuid,text)',false,false),
 ('public.projects_habits_snapshot(uuid,uuid,text)',false,false),('public.projects_habits_commit(uuid,uuid,text,jsonb)',false,false),('public.projects_habits_receipt(uuid,uuid,text,text,text)',false,false),
 ('public.admin_snapshot(uuid,uuid)',false,false),('public.admin_reserve(uuid,uuid,jsonb,uuid)',false,false),('public.admin_claim(uuid,uuid,uuid,uuid)',false,false),('public.admin_operation_guard(uuid,uuid,uuid,uuid)',false,false),('public.admin_transition(uuid,uuid,uuid,text,uuid,boolean)',false,false),('public.admin_complete(uuid,uuid,uuid,uuid)',false,false),
 ('public.settings_snapshot(uuid,uuid)',true,false),('public.settings_commit(uuid,uuid,jsonb)',true,false),('public.global_search(uuid,uuid,text)',true,false),
 ('public.drive_snapshot(uuid,uuid,text,bigint,bigint)',false,false),('public.drive_commit(uuid,uuid,text,jsonb)',false,false),('public.drive_receipt(uuid,uuid,text,text,text)',false,false),
 ('public.file_upload_reserve(uuid,uuid,text,text,uuid,text,uuid,bigint,bigint,timestamp with time zone)',false,false),('public.file_upload_claim(uuid,uuid,uuid,uuid,text)',false,false),('public.file_upload_release(uuid,uuid,uuid,uuid)',false,false),('public.file_upload_complete(uuid,uuid,uuid,uuid,text,jsonb,bigint)',false,false),('public.file_upload_status(uuid,uuid,uuid)',false,false),('public.file_read_metadata(uuid,uuid,uuid)',false,false),('public.file_avatar_set(uuid,uuid,uuid,text)',false,false),('public.file_cleanup_candidates()',false,false),('public.file_cleanup_ack(uuid)',false,false),('public.file_cleanup_log(integer,integer)',false,false),
 ('public.file_entity_image_get(uuid,uuid,text,uuid)',false,false),('public.file_entity_image_set(uuid,uuid,jsonb)',false,false),('public.file_entity_image_upload_observe(uuid,uuid,uuid,text,text)',false,false),
 ('public.vault_snapshot(uuid,uuid,text)',false,false),('public.vault_commit(uuid,uuid,text,jsonb)',false,false),('public.vault_receipt(uuid,uuid,text,jsonb)',false,false),
 ('public.google_calendar_call(uuid,uuid,text,jsonb,boolean,uuid)',false,false),('public.google_calendar_jobs()',false,false),('public.google_calendar_admin_runs(uuid,uuid)',false,false),
 ('public.knowledge_image_read_metadata(uuid,uuid,uuid,uuid)',false,false)
), expected_policy(relation,policy_name,qual_digest,check_digest) as (values
 ('public.calendar_accounts','own_read','9cb52c67578ee1a3a962af0abaf69e6f','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.calendar_events','own_read','34e07898643f14ee5a2645e685ba1399','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.calendar_sources','own_read','9cb52c67578ee1a3a962af0abaf69e6f','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.calendar_sync_runs','own_read','9cb52c67578ee1a3a962af0abaf69e6f','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.capture_file_links','capture_files_owner_read','cc3415bef6223ccd0d7282ff49ae560a','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.capture_links','own_read','ac3c3c517c0daf71902e83ebea7fbb23','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.captures','own_read','ac3c3c517c0daf71902e83ebea7fbb23','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.categories','own_read','d0e037661b5bec29b0e395f8d0344cea','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.domain_events','own_read','ab997bc78f04f603f6dfdf6c098146ad','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.drive_files','files_owner_read','fa9dbbed34c096dfe1f6c75e0605d164','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.drive_folders','routine_owner_read','f48c4156b0086dc92cffed5ea6d0e8af','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.fin_accounts','finance_owner_read','27122a48dc7e42f44c3450782cab9ae0','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.fin_budgets','finance_owner_read','27122a48dc7e42f44c3450782cab9ae0','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.fin_categories','finance_owner_read','27122a48dc7e42f44c3450782cab9ae0','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.fin_tags','finance_owner_read','27122a48dc7e42f44c3450782cab9ae0','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.fin_transaction_tags','finance_owner_read','27122a48dc7e42f44c3450782cab9ae0','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.fin_transactions','finance_owner_read','27122a48dc7e42f44c3450782cab9ae0','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.habit_entries','routine_owner_read','0c0dd62717823bc4d232401f8da8ae27','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.habit_pauses','routine_owner_read','0c0dd62717823bc4d232401f8da8ae27','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.habits','routine_owner_read','0c0dd62717823bc4d232401f8da8ae27','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.knowledge_notebooks','knowledge_owner_read','e954877bd5eb0b8f95da1eee5b31376d','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.knowledge_pages','knowledge_owner_read','e954877bd5eb0b8f95da1eee5b31376d','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.links','knowledge_owner_read','e954877bd5eb0b8f95da1eee5b31376d','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.page_refs','knowledge_owner_read','e954877bd5eb0b8f95da1eee5b31376d','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.profiles','own_read','0360431cf656af2c1fe88f4c694f6da0','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.projects','own_read','c5551cb9022c4b352776cbfa8051ca3c','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.tasks','own_read','187292f0a8da8b9d9d59ada259be149f','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.user_entitlements','own_read','0360431cf656af2c1fe88f4c694f6da0','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.user_modules','own_read','0360431cf656af2c1fe88f4c694f6da0','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.user_preferences','own_read','0360431cf656af2c1fe88f4c694f6da0','d41d8cd98f00b204e9800998ecf8427e'),
 ('public.user_roles','own_read','0360431cf656af2c1fe88f4c694f6da0','d41d8cd98f00b204e9800998ecf8427e'),
 ('storage.buckets','second_brain_private_buckets','0449b9b75ccf4d1cf0b0f7e0cab28cbc','0449b9b75ccf4d1cf0b0f7e0cab28cbc'),
 ('storage.objects','second_brain_private_objects','46413c3a0409d4e71d4d0049e59fbfc5','46413c3a0409d4e71d4d0049e59fbfc5')
-- These are normalized catalogue predicate digests from the reviewed full local
-- chain, not user/content fingerprints and not cryptographic authentication.
-- Recompute only after a reviewed migration; a runtime drift must remain visible.
), expected_capture_document(signature,result_type,language_name,volatility,definer,body_digest) as (values
 ('app_private.capture_task_timestamp(jsonb,boolean)','timestamp with time zone','plpgsql','i',false,'8b4810b07526b899c045835354ad4cbe3a3b2f537231285e7c0d365b9b842e8c'),
 ('app_private.capture_task_validate_payload_v1(text,jsonb)','void','plpgsql','i',false,'cd0a5f8e222e571193a840c07eb888994e7558ae652e41452d0c00ff53fb4f0e'),
 ('app_private.capture_document_utf16_length(text)','bigint','sql','i',false,'5b56fcec803b3cd1793197c78f13002ecaee7151eaaf008d9b16c4bdd26aa511'),
 ('app_private.capture_document_trim(text)','text','sql','i',false,'4add58acfd636c46478eb71bd65d443b2308367a4b7794d234c8fd0971ccf7d1'),
 ('app_private.capture_document_compact_bytes(jsonb)','bigint','plpgsql','i',false,'4dad34f1b4faaa4c123769aa3c3074f8054f693772bb093d407bdcf984016068'),
 ('app_private.capture_document_validate_schema(jsonb)','void','plpgsql','i',false,'ad683e4b4cba5856b9a10294af541c6c8e36dc5652ffef06e6f27eebce2fd773'),
 ('app_private.capture_document_validate(jsonb)','void','plpgsql','i',false,'724d91b908ac2d7a823494ddc188fe4bf64b778240f0724c0263d1a9a6949596'),
 ('app_private.capture_task_validate_payload_capture_document_previous(text,jsonb)','void','plpgsql','s',false,'46ade3cb248cdb7fed9a3cd4667f2425a28c0ecb9fe5116d0e8c08c58ef82b88'),
 ('app_private.capture_task_validate_payload(text,jsonb)','void','plpgsql','s',false,'5f43d3ab282ea2a6d7c04637ac9dc96500af8c5133bcc064c7f5c693c3d0a482'),
 ('app_private.capture_document_row()','trigger','plpgsql','v',false,'ce9bacd6649f9dcb06f62f9be437fb4dc6c396b48da7e3c2a78b1482ce91d99b'),
 ('app_private.knowledge_promoted_capture()','trigger','plpgsql','v',true,'3890e5efab7a01ce2666c444890e6335b368db94f395fb61e50d99238bae5487'),
 ('app_private.capture_document_intent(text,jsonb)','boolean','plpgsql','i',false,'17d6269203372795f57870da48db6f13190103c0400379dab9954ba4cf90bc56'),
 ('app_private.capture_document_fingerprint_limit(text,jsonb)','integer','plpgsql','i',false,'d5d7b82924acd93c542e8fd6c80307e1e9784f0cbdc22590317c4c7d7fc239bc'),
 ('app_private.capture_document_receipt_request_allowed(text,text,jsonb)','boolean','plpgsql','i',false,'29c11097a85f701795f63617e046f4d17a8f2412bbb0c331c00547d1f6f0d026'),
 ('app_private.capture_document_event_state(jsonb)','void','plpgsql','i',false,'fab1784bffd64db9e2c7d289e849911ac49fbfd5c19ea6811313fdadcf9fcb0b'),
 ('app_private.capture_document_event_pair_allowed(uuid,uuid,text,uuid,text,text,timestamp with time zone,jsonb,jsonb,jsonb)','boolean','plpgsql','i',false,'74258a5163504efe4553e39d332eb62925ab0ec274644d99fb2577676b692f35'),
 ('app_private.capture_document_commit_transition(text,jsonb,jsonb)','void','plpgsql','i',false,'8e073434eff04639e140c4199c17ad1caf132ebc2e11516dd26af45234c3f4f0')
-- Full reviewed prosrc bodies, including the literal clones and pure v1 base. Normalize only
-- CRLF/LF transport; these source fingerprints are not content authentication.
-- Only the reviewed023–025 functions below are selected from the PUBLIC
-- disposable-runner metadata: source113545f2cd44573a99cb822d5489bfa1647c0e0a,
-- artifact12403074275 (ZIP SHA256 b352d8246f42f20137e2ca600549153b01c1dba1557979f3fcffe691695ffe64).
-- The seven Capture bodies already pinned above keep a single body oracle;
-- these rows additionally bind their names/defaults/ACL. Null body pins below
-- never replace the existing timestamp/v1/physical-capacity checks.
), expected_spec08_function(signature,result_type,language_name,volatility,definer,arg_names,default_count,default_digest,service,body_bytes,body_digest) as (values
 ('app_private.calendar_attendee_pair_valid(jsonb)','boolean','plpgsql','i',false,array['p']::text[],0,null::text,false,1579,'743b9adbf38d519bd3a57a40f4b7abedfb4c4625b1ec5ab23597371671dce558'),
 ('app_private.calendar_private_account(uuid,uuid)','jsonb','plpgsql','v',true,array['p_user','p_account']::text[],0,null::text,false,1099,'5191add749778a35bee926d00f3e334d313f79ce948b22a1e8e24149ce83468c'),
 ('app_private.calendar_snapshot(uuid)','jsonb','plpgsql','v',true,array['p_user']::text[],0,null::text,false,3066,'f56cb61cc271dd64f1600a5ccee66aa100e24630cce081a139f8ab45f28de60f'),
 ('app_private.capture_document_commit_transition(text,jsonb,jsonb)','void','plpgsql','i',false,array['p_operation','p_input','p_changes']::text[],0,null::text,false,null::integer,null::text),
 ('app_private.capture_document_event_pair_allowed(uuid,uuid,text,uuid,text,text,timestamp with time zone,jsonb,jsonb,jsonb)','boolean','plpgsql','i',false,array['p_id','p_user','p_kind','p_entity','p_action','p_canal','p_at','p_before','p_after','p_payload']::text[],0,null::text,false,null::integer,null::text),
 ('app_private.capture_document_intent(text,jsonb)','boolean','plpgsql','i',false,array['p_operation','p_input']::text[],0,null::text,false,null::integer,null::text),
 ('app_private.capture_document_receipt_request_allowed(text,text,jsonb)','boolean','plpgsql','i',false,array['p_command','p_client_id','p_request']::text[],0,null::text,false,null::integer,null::text),
 ('app_private.capture_document_row()','trigger','plpgsql','v',false,null::text[],0,null::text,false,null::integer,null::text),
 ('app_private.capture_document_validate_schema(jsonb)','void','plpgsql','i',false,array['p_doc']::text[],0,null::text,false,null::integer,null::text),
 ('app_private.capture_e4_image_holder(uuid,uuid,uuid,boolean)','boolean','sql','s',true,array['p_user','p_file','p_page','p_live']::text[],2,'4372d9476ffb38f584561186dae57ef7f1e84a29fc29c17f7d7959638992b17d',false,577,'cd9f71f3253b0b3786dd8b0a69043ec94ffe16483a8c6accc39d97e1f578c223'),
 ('app_private.capture_e4_knowledge_transition(uuid,text,jsonb)','void','plpgsql','v',true,array['p_user','p_operation','p_request']::text[],0,null::text,false,8157,'04c2f18a03526497f11553944af95425d4145b21a477e1f2b3dcda57158147e9'),
 ('app_private.capture_e4_metadata(jsonb)','void','plpgsql','i',false,array['p']::text[],0,null::text,false,3228,'5a49d0e85bd45643aedf7c32d8f43611697e7410c819862b3530997b293ed16e'),
 ('app_private.capture_e4_previous_entity(uuid,text,uuid,boolean)','jsonb','plpgsql','s',true,array['p_user','p_type','p_id','p_live']::text[],1,'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',false,1704,'89432b314be3178b31c95ad7f63799cf94e535b41dc9b7780ade5d069d2b2ed9'),
 ('app_private.capture_e4_previous_image_referenced(uuid,uuid)','boolean','sql','s',true,array['p_user','p_file']::text[],0,null::text,false,492,'014330cc104eebbf3e9814380dac140a2b3d5f057caee8b5e8565a886365da65'),
 ('app_private.capture_e4_previous_intent(text,jsonb)','boolean','plpgsql','i',false,array['p_operation','p_input']::text[],0,null::text,false,1922,'9f746429816755c4f44d81ca3217a92eb436a7f2b28306b64b5ece09dd519d0c'),
 ('app_private.capture_e4_previous_targets(uuid)','jsonb','plpgsql','s',true,array['p_user']::text[],0,null::text,false,2263,'6c21859e88ca1e710a118da44e1f9cc3f9efce78fc1c2bff05cc58e6a28760a2'),
 ('app_private.capture_e4_promoted_document(jsonb,jsonb,jsonb)','jsonb','plpgsql','i',false,array['p_capture','p_captures','p_pages']::text[],0,null::text,false,885,'c68db5164af8e2f03b1e994cce832ae1d508400d29ae6fdba06cc83f4fdc410e'),
 ('app_private.capture_e4_promoted_node(jsonb,jsonb,jsonb,jsonb,integer)','jsonb','plpgsql','i',false,array['p_node','p_captures','p_pages','p_linked','p_depth']::text[],1,'5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9',false,2993,'93e3650371ecdf01d9008498ea9a8780bb49477a1829ae8737180b6a884e6713'),
 ('app_private.capture_e4_resolve_node(jsonb,uuid,uuid,integer)','jsonb','plpgsql','i',false,array['p_node','p_capture','p_page','p_depth']::text[],1,'5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9',false,677,'6d5b6c7f03fad0873e32c6f5407dee50ab686c249351732272060cf5f48b1e83'),
 ('app_private.capture_e4_validate_document(jsonb)','void','plpgsql','i',false,array['p_doc']::text[],0,null::text,false,5825,'94837a756eceda9afc9e4ad94023f2f0f4651b369f6809cd11fa7505685ae6e8'),
 ('app_private.entity_image_referenced(uuid,uuid)','boolean','sql','s',true,array['p_user','p_file']::text[],0,null::text,false,128,'6ebe4715384343de1aabe797db1abe89faa5de3600a72bdf4473be68dd871ac4'),
 ('app_private.file_cleanup_ack(uuid)','void','plpgsql','v',true,array['p_upload']::text[],0,null::text,true,985,'8385e248aaf48e230618881e6ec3818bf57936db344cd706a9c50a3f2b8f4eaf'),
 ('app_private.finance_card_metadata_guard()','trigger','plpgsql','v',true,null::text[],0,null::text,false,1100,'f48506bc9f7de4af8b9ed115f9be59bcb9eaf9dee53d8dfb7d08b66cf08bd439'),
 ('app_private.finance_validate(text,jsonb)','void','plpgsql','v',false,array['p_kind','p']::text[],0,null::text,false,5620,'182a540f638993016d59de0c88f49c30bcbaa0ee011ddcc15a47854f8d3499b9'),
 ('app_private.google_calendar_call(uuid,uuid,text,jsonb,boolean,uuid)','jsonb','plpgsql','v',true,array['p_user','p_session','p_command','p_input','p_cron','p_execution']::text[],0,null::text,true,31225,'b5d8de161448b3914168c5c76c201480092dc51713ca35295b037178ce0d38d7'),
 ('app_private.knowledge_commit(uuid,uuid,text,jsonb)','jsonb','plpgsql','v',true,array['p_user','p_session','p_operation','p_request']::text[],0,null::text,true,11763,'22089a9ee10bb2855e69f3a6e5780aa78beb299775ed7a3525f6025ee0e4f10e'),
 ('app_private.knowledge_document_text(jsonb,integer)','text','plpgsql','i',false,array['p_node','p_depth']::text[],1,'5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9',false,902,'2244460144197f90203f7c22d27686c763f6a0e3ff237cc76a1a6243d74a3de5'),
 ('app_private.knowledge_entity(uuid,text,uuid,boolean)','jsonb','plpgsql','s',true,array['p_user','p_type','p_id','p_live']::text[],1,'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',false,879,'181b6f2d412e3bf0c42eff950c883e63483ee3ce2de2038922aded94575a003a'),
 ('app_private.knowledge_image_read_metadata(uuid,uuid,uuid,uuid)','jsonb','plpgsql','v',true,array['p_user','p_session','p_page','p_file']::text[],0,null::text,true,795,'34ea688e3389a148b58ba60e5e5f1afe775a4a2b38fd8c00a0848f51defd2517'),
 ('app_private.knowledge_promoted_capture()','trigger','plpgsql','v',true,null::text[],0,null::text,false,null::integer,null::text),
 ('app_private.knowledge_targets(uuid)','jsonb','plpgsql','s',true,array['p_user']::text[],0,null::text,false,1299,'7bdfbee171b9addc82f776a7bac8069c3ad4b1e9d7231a697d904c821eca0744'),
 ('app_private.knowledge_validate_document(jsonb)','void','plpgsql','i',false,array['p_doc']::text[],0,null::text,false,66,'ad683e4b4cba5856b9a10294af541c6c8e36dc5652ffef06e6f27eebce2fd773'),
 ('public.knowledge_image_read_metadata(uuid,uuid,uuid,uuid)','jsonb','sql','v',false,array['p_user','p_session','p_page','p_file']::text[],0,null::text,true,81,'a2e59cd016698eaa3734f5185e385104ab298e44ef02ae029118cb093a8d8aa1'),
 ('public.settings_commit(uuid,uuid,jsonb)','jsonb','plpgsql','v',true,array['p_user','p_session','p_request']::text[],0,null::text,true,6604,'e2a755cd835cb8bd8ffcc6ed8e3b9d2511442d1dfb407f4ddb7535acd4db8905')
), relations as (
 select c.*,n.nspname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind in ('r','p')
 and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')
), functions as (
 select p.*,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private')
 and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
), checks(check_name,object_name,ok) as (
 select 'expected_table',name,to_regclass(name) is not null from expected_tables
 union all select 'habit_image_column','public.habits.image_file_id',exists(select 1 from pg_attribute where attrelid='public.habits'::regclass and attname='image_file_id' and atttypid='uuid'::regtype and not attnotnull and attnum>0 and not attisdropped)
 union all select 'habit_image_owner_fk','public.habits.habits_image_owner_fk',exists(select 1 from pg_constraint c where c.conrelid='public.habits'::regclass and c.conname='habits_image_owner_fk' and c.contype='f' and c.confrelid='public.drive_files'::regclass and c.condeferrable and c.condeferred and c.convalidated
  and (select array_agg(a.attname::text order by k.ordinality) from unnest(c.conkey) with ordinality k(attnum,ordinality) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum)=array['user_id','image_file_id']
  and (select array_agg(a.attname::text order by k.ordinality) from unnest(c.confkey) with ordinality k(attnum,ordinality) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.attnum)=array['user_id','id'])
 union all select 'habit_history_helpers','app_private.habit_frequency',not exists(select 1 from (values('app_private.habit_frequency_tuple(jsonb)'),('app_private.habit_frequency_state(jsonb)'),('app_private.habit_frequency_expected(jsonb,jsonb,date)'),('app_private.habit_frequency_at(jsonb,date)'),('app_private.habit_check_attempt_clock(jsonb,timestamp with time zone)')) required(signature)
  where not exists(select 1 from functions p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure(required.signature) and not p.prosecdef and p.provolatile='i' and l.lanname='plpgsql' and pg_get_userbyid(p.proowner)='postgres'))
 -- SPEC08 Capture document contracts: nominal existence, complete reviewed body,
 -- owner, exact configuration, pure/trigger volatility and no private client ACL.
 --023–025: complete reviewed function metadata. Pure DTO functions must not gain
 --stateful/definer authority; stateful readers keep their exact private gates.
 union all select 'spec08_function',e.signature,exists(select 1 from functions p join pg_language l on l.oid=p.prolang
  where p.oid=to_regprocedure(e.signature) and p.prokind='f' and not p.proretset and p.prorettype=to_regtype(e.result_type)
   and p.provolatile=e.volatility::"char" and p.prosecdef=e.definer and not p.proisstrict and not p.proleakproof and p.proparallel='u' and p.provariadic=0
   and p.proconfig=array['search_path=""'] and l.lanname=e.language_name and pg_get_userbyid(p.proowner)='postgres'
   and p.proargnames is not distinct from e.arg_names and p.proargmodes is null and p.pronargdefaults=e.default_count
   and encode(sha256(convert_to(pg_get_expr(p.proargdefaults,0),'UTF8')),'hex') is not distinct from e.default_digest
   and (select count(*) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))))=case when e.service then 2 else 1 end
   and exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=p.proowner and a.grantor=p.proowner and a.privilege_type='EXECUTE' and not a.is_grantable)
   and (not e.service or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee='service_role'::regrole and a.grantor=p.proowner and a.privilege_type='EXECUTE' and not a.is_grantable))
   and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantor<>p.proowner or a.is_grantable or a.privilege_type<>'EXECUTE' or (a.grantee<>p.proowner and (not e.service or a.grantee<>'service_role'::regrole)))
   and (e.body_digest is null or octet_length(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8'))=e.body_bytes
    and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')=e.body_digest)) from expected_spec08_function e
 union all select 'calendar_attendee_columns','public.calendar_events',2=(select count(*) from pg_attribute a
  where a.attrelid='public.calendar_events'::regclass and a.attnum>0 and not a.attisdropped and not a.attnotnull and not a.atthasdef and a.attgenerated=''
   and (a.attname='attendees' and a.atttypid='jsonb'::regtype or a.attname='attendees_omitted' and a.atttypid='boolean'::regtype))
 union all select 'calendar_attendee_check','public.calendar_events.calendar_events_attendees_check',exists(select 1 from pg_constraint c
  where c.conrelid='public.calendar_events'::regclass and c.conname='calendar_events_attendees_check' and c.contype='c' and c.convalidated and c.conislocal and not c.connoinherit
   and regexp_replace(lower(pg_get_expr(c.conbin,c.conrelid)),'[[:space:]()"]|::text','','g')='app_private.calendar_attendee_pair_validjsonb_build_object''attendees'',attendees,''attendees_omitted'',attendees_omitted')
 union all select 'calendar_attendee_cursor','app_private.google_calendar_cursors.attendees_version',exists(select 1 from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid='app_private.google_calendar_cursors'::regclass and a.attname='attendees_version' and a.attnum>0 and not a.attisdropped and a.atttypid='smallint'::regtype and a.attnotnull and a.attgenerated=''
   and regexp_replace(pg_get_expr(d.adbin,d.adrelid),'[[:space:]()]|::smallint','','g')='0')
 union all select 'calendar_attendee_cursor_check','app_private.google_calendar_cursors.google_calendar_cursors_attendees_version_check',exists(select 1 from pg_constraint c
  where c.conrelid='app_private.google_calendar_cursors'::regclass and c.conname='google_calendar_cursors_attendees_version_check' and c.contype='c' and c.convalidated and c.conislocal and not c.connoinherit
   and regexp_replace(lower(pg_get_expr(c.conbin,c.conrelid)),'[[:space:]()"]|::smallint','','g')='attendees_version=anyarray[0,1]')
 union all select 'calendar_list_preference','public.user_preferences.user_preferences_default_calendar_view_check',exists(select 1 from pg_constraint c
  where c.conrelid='public.user_preferences'::regclass and c.conname='user_preferences_default_calendar_view_check' and c.contype='c' and c.convalidated and c.conislocal and not c.connoinherit
   and regexp_replace(lower(pg_get_expr(c.conbin,c.conrelid)),'[[:space:]()"]|::text','','g')='default_calendar_view=anyarray[''day'',''week'',''month'',''list'']')
 union all select 'finance_card_generated_columns','public.fin_accounts',2=(select count(*) from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid='public.fin_accounts'::regclass and a.attnum>0 and not a.attisdropped and not a.attnotnull and a.attgenerated='s'
   and (a.attname='last_four' and a.atttypid='text'::regtype and regexp_replace(pg_get_expr(d.adbin,d.adrelid),'[[:space:]()"]|::text','','g')='payload->>''last_four'''
    or a.attname='default_payment_account_id' and a.atttypid='uuid'::regtype and regexp_replace(pg_get_expr(d.adbin,d.adrelid),'[[:space:]()"]|::text','','g')='payload->>''default_payment_account_id''::uuid'))
 union all select 'finance_card_owner_fk','public.fin_accounts.fin_accounts_default_payment_owner_fk',exists(select 1 from pg_constraint c
  where c.conrelid='public.fin_accounts'::regclass and c.conname='fin_accounts_default_payment_owner_fk' and c.contype='f' and c.confrelid='public.fin_accounts'::regclass and c.condeferrable and c.condeferred and c.convalidated and c.conislocal and c.confmatchtype='s' and c.confupdtype='a' and c.confdeltype='a'
   and (select array_agg(a.attname::text order by k.ordinality) from unnest(c.conkey) with ordinality k(attnum,ordinality) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum)=array['user_id','default_payment_account_id']
   and (select array_agg(a.attname::text order by k.ordinality) from unnest(c.confkey) with ordinality k(attnum,ordinality) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.attnum)=array['user_id','id'])
 union all select 'finance_card_guard_trigger','public.fin_accounts.zz_fin_accounts_card_metadata_guard',exists(select 1 from pg_trigger t
  where t.tgrelid='public.fin_accounts'::regclass and t.tgname='zz_fin_accounts_card_metadata_guard' and not t.tgisinternal and t.tgtype=23 and t.tgenabled='O'
   and not t.tgdeferrable and not t.tginitdeferred and t.tgconstraint=0 and t.tgnargs=0 and t.tgattr=''::int2vector and t.tgqual is null and t.tgfoid=to_regprocedure('app_private.finance_card_metadata_guard()'))
 union all select 'finance_card_projector_trigger','public.fin_accounts.finance_project',exists(select 1 from pg_trigger t
  where t.tgrelid='public.fin_accounts'::regclass and t.tgname='finance_project' and not t.tgisinternal and t.tgtype=23 and t.tgenabled='O'
   and not t.tgdeferrable and not t.tginitdeferred and t.tgconstraint=0 and t.tgnargs=0 and t.tgattr=''::int2vector and t.tgqual is null and t.tgfoid=to_regprocedure('app_private.finance_project()'))
 union all select 'capture_document_function',e.signature,exists(select 1 from functions p join pg_language l on l.oid=p.prolang
  where p.oid=to_regprocedure(e.signature) and p.prokind='f' and p.prorettype=to_regtype(e.result_type)
   and p.provolatile=e.volatility::"char" and p.prosecdef=e.definer and not p.proisstrict and not p.proleakproof and p.proparallel='u'
   and p.proconfig=array['search_path=""'] and l.lanname=e.language_name and pg_get_userbyid(p.proowner)='postgres'
   -- The body hash does not cover defaults: v1's one-argument timestamp calls
   -- must NEVER silently become nullable after DEFAULT FALSE -> TRUE drift.
   and (e.signature<>'app_private.capture_task_timestamp(jsonb,boolean)' or
     p.pronargdefaults=1 and pg_get_expr(p.proargdefaults,0)='false'
     and p.proargnames=array['p_value','p_nullable'] and p.proargmodes is null)
   and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE')
   and not has_function_privilege('service_role',p.oid,'EXECUTE')
   and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')
   and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')=e.body_digest) from expected_capture_document e
 union all select 'capture_document_trigger','public.captures.capture_document_row',exists(select 1 from pg_trigger
  where tgrelid='public.captures'::regclass and tgname='capture_document_row' and not tgisinternal and tgtype=23 and tgenabled='O'
   and not tgdeferrable and not tginitdeferred and tgconstraint=0 and tgnargs=0 and tgqual is null
   and tgfoid=to_regprocedure('app_private.capture_document_row()'))
 union all select 'capture_document_origin_trigger','public.captures.knowledge_promoted_capture',exists(select 1 from pg_trigger
  where tgrelid='public.captures'::regclass and tgname='knowledge_promoted_capture' and not tgisinternal and tgtype=19 and tgenabled='O'
   and not tgdeferrable and not tginitdeferred and tgconstraint=0 and tgnargs=0 and tgqual is null
   and tgfoid=to_regprocedure('app_private.knowledge_promoted_capture()'))
 union all select 'capture_document_event_trigger','public.domain_events.capture_task_event',exists(select 1 from pg_trigger
  where tgrelid='public.domain_events'::regclass and tgname='capture_task_event' and not tgisinternal and tgtype=23 and tgenabled='O'
   and not tgdeferrable and not tginitdeferred and tgconstraint=0 and tgnargs=0 and tgqual is null
   and tgfoid=to_regprocedure('app_private.capture_task_event()'))
 union all select 'capture_document_receipt_capacity','app_private.command_receipts.command_receipts_check',exists(select 1 from pg_constraint c
  where c.conrelid='app_private.command_receipts'::regclass and c.conname='command_receipts_check' and c.contype='c'
   and c.convalidated and c.conislocal and not c.connoinherit
   and regexp_replace(lower(pg_get_expr(c.conbin,c.conrelid)),'[[:space:]()"]','','g')='octet_lengthresult::text<=1048576andcasewhenoctet_lengthrequest::text<=1048576thentrueelseapp_private.capture_document_receipt_request_allowedcommand,client_id,requestistrueend')
 union all select 'capture_document_receipt_columns','app_private.command_receipts',2=(select count(*) from pg_attribute a
  where a.attrelid='app_private.command_receipts'::regclass and a.attname in ('request','result') and not a.attisdropped and a.attnum>0
   and a.attnotnull and a.atttypid='jsonb'::regtype)
 union all select 'capture_document_event_capacity','public.domain_events',1=(select count(*) from pg_constraint c
  where c.conrelid='public.domain_events'::regclass and c.contype='c' and c.convalidated and c.conislocal and not c.connoinherit
   and regexp_replace(lower(pg_get_expr(c.conbin,c.conrelid)),'[[:space:]()"]','','g')='casewhencoalesceoctet_lengthbefore::text,0+coalesceoctet_lengthafter::text,0<=1048576thentrueelsecoalesceoctet_lengthbefore::text,0+coalesceoctet_lengthafter::text,0<=2097152andapp_private.capture_document_event_pair_allowedid,user_id,entity_type,entity_id,action,canal,occurred_at,before,after,capture_task_payloadistrueend')
 union all select 'rls',nspname||'.'||relname,relrowsecurity from relations
 union all select 'anonymous_table_closed',nspname||'.'||relname,not has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not exists(select 1 from pg_attribute a where a.attrelid=relations.oid and a.attnum>0 and not a.attisdropped and has_column_privilege('anon',relations.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES')) from relations
 union all select 'browser_mutation_closed',nspname||'.'||relname,not has_table_privilege('authenticated',oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not exists(select 1 from pg_attribute a where a.attrelid=relations.oid and a.attnum>0 and not a.attisdropped and has_column_privilege('authenticated',relations.oid,a.attnum,'INSERT,UPDATE,REFERENCES')) from relations
 union all select 'service_table_closed',nspname||'.'||relname,not has_table_privilege('service_role',oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and (nspname='public' and relname in ('profiles','user_roles','user_moderation','user_entitlements') or not has_table_privilege('service_role',oid,'SELECT') and not exists(select 1 from pg_attribute a where a.attrelid=relations.oid and a.attnum>0 and not a.attisdropped and has_column_privilege('service_role',relations.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES'))) from relations
 union all select 'private_table_closed',nspname||'.'||relname,not has_table_privilege('authenticated',oid,'SELECT') and not exists(select 1 from pg_attribute a where a.attrelid=relations.oid and a.attnum>0 and not a.attisdropped and has_column_privilege('authenticated',relations.oid,a.attnum,'SELECT')) and not exists(select 1 from pg_policy where polrelid=relations.oid) from relations where nspname='app_private' or relname in ('user_moderation','admin_audit_events','vault_master_keys','vault_items')
 union all select 'owner_read_policy',nspname||'.'||relname,(select count(*)=1 and bool_and(polcmd='r' and polroles=array['authenticated'::regrole::oid] and pg_get_expr(polqual,polrelid) like '%user_id%' and pg_get_expr(polqual,polrelid) like '%auth.uid()%') from pg_policy where polrelid=relations.oid) from relations where nspname='public' and relname not in ('user_moderation','admin_audit_events','vault_master_keys','vault_items')
 union all select 'reviewed_policy_predicate',e.relation||'.'||e.policy_name,exists(select 1 from pg_policy p where p.polrelid=to_regclass(e.relation) and p.polname=e.policy_name and md5(pg_get_expr(p.polqual,p.polrelid))=e.qual_digest and md5(coalesce(pg_get_expr(p.polwithcheck,p.polrelid),''))=e.check_digest) from expected_policy e
 union all select 'browser_role_safety',rolname,not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not pg_has_role(oid,'postgres','MEMBER') and not pg_has_role(oid,'service_role','MEMBER') from pg_roles where rolname in ('anon','authenticated')
 union all select 'expected_rpc',signature,to_regprocedure(signature) is not null from expected_rpc
 union all select 'expected_private_rpc',replace(signature,'public.','app_private.'),exists(select 1 from pg_proc where oid=to_regprocedure(replace(signature,'public.','app_private.')) and prosecdef) from expected_rpc where not definer and signature not in ('public.transfer(uuid,uuid,text,jsonb)','public.pay_statement(uuid,uuid,text,jsonb)','public.create_series(uuid,uuid,text,jsonb)','public.close_account(uuid,uuid,text,jsonb)')
 union all select 'rpc_boundary',e.signature,p.prosecdef=e.definer and has_function_privilege('authenticated',p.oid,'EXECUTE')=e.browser and has_function_privilege('service_role',p.oid,'EXECUTE')=not e.browser from expected_rpc e join pg_proc p on p.oid=to_regprocedure(e.signature)
 union all select 'function_anonymous_closed',nspname||'.'||oid::regprocedure::text,not has_function_privilege('anon',oid,'EXECUTE') and not exists(select 1 from aclexplode(coalesce(proacl,acldefault('f',proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') from functions
 union all select 'function_search_path',nspname||'.'||oid::regprocedure::text,exists(select 1 from unnest(proconfig) c where c in ('search_path=""','search_path=')) or nspname='public' and proname='rls_auto_enable' and proconfig @> array['search_path=pg_catalog'] from functions
 union all select 'browser_function_allowlist',nspname||'.'||oid::regprocedure::text,not has_function_privilege('authenticated',oid,'EXECUTE') or nspname='public' and proname in ('my_access_state','update_identity') or nspname='app_private' and proname in ('current_user_active','has_feature','my_access_state','update_identity','activity_projection_feature') or functions.oid in (to_regprocedure('public.my_sessions()'),to_regprocedure('app_private.my_sessions()')) from functions
 union all select 'service_function_allowlist',nspname||'.'||oid::regprocedure::text,not has_function_privilege('service_role',oid,'EXECUTE') or exists(select 1 from expected_rpc e where not e.browser and to_regprocedure(case when functions.nspname='app_private' then replace(e.signature,'public.','app_private.') else e.signature end)=functions.oid) or nspname='app_private' and proname in ('activity_projection_feature','activity_projection_fields') from functions
 union all select 'default_acl_closed',coalesce(n.nspname,'global')||'.'||d.defaclobjtype::text,not exists(select 1 from aclexplode(d.defaclacl) a where a.grantee=0 or a.grantee in ('anon'::regrole,'authenticated'::regrole,'service_role'::regrole)) from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where d.defaclrole='postgres'::regrole and (d.defaclnamespace=0 or n.nspname in ('public','app_private'))
 union all select 'default_functions_public_closed','postgres.global',exists(select 1 from pg_default_acl d where d.defaclrole='postgres'::regrole and d.defaclnamespace=0 and d.defaclobjtype='f' and not exists(select 1 from aclexplode(d.defaclacl) a where a.grantee=0 and a.privilege_type='EXECUTE'))
 union all select 'event_metadata_only','public.domain_events',not has_table_privilege('authenticated','public.domain_events','SELECT') and (select count(*)=7 and bool_and(attname in ('id','user_id','entity_type','entity_id','action','canal','occurred_at')) from pg_attribute where attrelid='public.domain_events'::regclass and attnum>0 and not attisdropped and has_column_privilege('authenticated',attrelid,attnum,'SELECT'))
 union all select 'balances_invoker','public.fin_account_balances',coalesce((select reloptions @> array['security_invoker=true'] from pg_class where oid=to_regclass('public.fin_account_balances')),false)
 union all select 'vault_metadata_guard','public.domain_events',exists(select 1 from pg_constraint where conrelid='public.domain_events'::regclass and conname='vault_metadata_only')
 union all select 'vault_receipt_guard','app_private.command_receipts',exists(select 1 from pg_constraint where conrelid='app_private.command_receipts'::regclass and conname='vault_receipt_digest_only')
 union all select 'calendar_metadata_guard','public.domain_events',exists(select 1 from pg_constraint where conrelid='public.domain_events'::regclass and conname='calendar_metadata_only')
 union all select 'storage_private_buckets','storage.buckets',(select count(*)=2 and bool_and(not public) from storage.buckets where id in ('second-brain-staging','second-brain-files'))
 union all select 'storage_direct_api_veto',name,exists(select 1 from pg_policy p where p.polrelid=to_regclass(relation) and p.polname=name and not p.polpermissive and p.polcmd='*' and ('anon'::regrole=any(p.polroles)) and ('authenticated'::regrole=any(p.polroles))) from (values ('storage.objects','second_brain_private_objects'),('storage.buckets','second_brain_private_buckets')) p(relation,name)
 union all select 'auth_shared_access_lock',name,exists(select 1 from pg_trigger where tgrelid=to_regclass(name) and tgname='capture_task_access_lock' and tgenabled='O') from (values ('public.user_moderation'),('public.user_entitlements')) t(name)
 -- Reviewed full PL/pgSQL body from 015 plus020's live-image references.
 -- Normalize only CRLF -> LF because the
 -- Windows source/SQL Editor transport can change line endings. Every other
 -- byte (including comments, literals and surrounding whitespace) must match.
 -- sha256(bytea) is a pg_catalog builtin, not an extension or remote operation.
 union all select 'reviewed_cleanup_definition','app_private.file_cleanup_candidates()',exists(select 1 from functions
  where nspname='app_private' and proname='file_cleanup_candidates' and pronargs=0
  and encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='90ab173a9f3c18b63370d4cab5589ec8dc7a11784286a0a30d001b8ff952faee')
 --018 fingerprints cover both the immediate fence and final-row guard. Only
 -- CRLF/LF transport differences are normalized; unchanged signatures alone
 -- cannot certify the reserved creation's moderation/metadata/ban checks.
 union all select 'reviewed_admin_creation_fence','app_private.on_auth_user_created()',exists(select 1 from functions
  where oid=to_regprocedure('app_private.on_auth_user_created()') and prosecdef and pg_get_userbyid(proowner)='postgres'
   and encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='d296b7944896c4f27f27f5a9186bfaa59d7319fe9c30314c247d2152b26b7713')
 union all select 'reviewed_admin_creation_final','app_private.check_admin_auth_creation_final()',exists(select 1 from functions
  where oid=to_regprocedure('app_private.check_admin_auth_creation_final()') and prosecdef and pg_get_userbyid(proowner)='postgres'
   and encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='8615b0af2f7db95bec0ec9c46e122e1fa355ece45b24d71c4d0fe1116519c3d1')
 union all select 'admin_creation_fence_trigger','auth.second_brain_identity_created',exists(select 1 from pg_trigger
  where tgrelid=to_regclass('auth.users') and tgname='second_brain_identity_created' and not tgisinternal
   and tgtype=5 and tgenabled='O' and tgfoid=to_regprocedure('app_private.on_auth_user_created()'))
 union all select 'admin_creation_final_trigger','auth.second_brain_admin_creation_final',exists(select 1 from pg_trigger
  where tgrelid=to_regclass('auth.users') and tgname='second_brain_admin_creation_final' and not tgisinternal
   and tgtype=5 and tgenabled='O' and tgdeferrable and tginitdeferred and tgconstraint<>0
   and tgfoid=to_regprocedure('app_private.check_admin_auth_creation_final()'))
 --019 binds both reviewed zero-argument JSONB bodies and official GoTrue types.
 --Only CRLF/LF transport is normalized; no owner, ACL, configuration or body drift.
 union all select 'reviewed_own_sessions_helper','app_private.my_sessions()',exists(select 1 from functions p join pg_language l on l.oid=p.prolang
  where p.oid=to_regprocedure('app_private.my_sessions()') and p.prokind='f' and p.pronargs=0 and p.proargnames is null
   and p.prorettype='jsonb'::regtype and p.prosecdef and p.provolatile='s' and not p.proleakproof and p.proparallel='u'
   and p.proconfig=array['search_path=""'] and l.lanname='plpgsql' and pg_get_userbyid(p.proowner)='postgres'
   and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='ce3ed7d75a8698bed7256f462b442aefe6b62ec6afa44db24cb54a3f77199733')
 union all select 'reviewed_own_sessions_wrapper','public.my_sessions()',exists(select 1 from functions p join pg_language l on l.oid=p.prolang
  where p.oid=to_regprocedure('public.my_sessions()') and p.prokind='f' and p.pronargs=0 and p.proargnames is null
   and p.prorettype='jsonb'::regtype and not p.prosecdef and p.provolatile='s' and not p.proleakproof and p.proparallel='u'
   and p.proconfig=array['search_path=""'] and l.lanname='plpgsql' and pg_get_userbyid(p.proowner)='postgres'
   and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='7435cde29bb517f844d76cbb3cc21c1456ce66a6d469ea25d79f3b110c4816f2')
 union all select 'own_sessions_auth_types','auth.sessions',not exists(select 1 from (values
  ('id','uuid'::regtype,true),('user_id','uuid'::regtype,true),
  ('created_at','timestamp with time zone'::regtype,false),('refreshed_at','timestamp without time zone'::regtype,false),
  ('not_after','timestamp with time zone'::regtype,false)) required(name,type,not_null)
  where not exists(select 1 from pg_attribute a where a.attrelid=to_regclass('auth.sessions') and a.attname=required.name
   and a.atttypid=required.type and a.attnotnull=required.not_null and a.attnum>0 and not a.attisdropped))
 union all select 'own_sessions_direct_closed','auth.sessions',exists(select 1 from pg_class where oid=to_regclass('auth.sessions') and relrowsecurity)
  and not exists(select 1 from pg_roles r where r.rolname in('anon','authenticated') and
   (has_table_privilege(r.oid,'auth.sessions','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or exists(select 1 from pg_attribute a where a.attrelid=to_regclass('auth.sessions') and a.attnum>0 and not a.attisdropped
     and has_column_privilege(r.oid,a.attrelid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES'))))
)
select jsonb_build_object('version',1,'ok',bool_and(ok is true),'checks',count(*),'deviations',coalesce(jsonb_agg(jsonb_build_object('check',check_name,'object',object_name) order by check_name,object_name) filter(where ok is distinct from true),'[]'::jsonb)) from checks;
rollback;
