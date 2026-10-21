-- T028 production review. Read-only catalogue/constant bucket checks; no fixtures or DDL.
-- Full current chain includes SPEC08 Habit history after020. One metadata JSON row, then ROLLBACK.
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
 ('public.google_calendar_call(uuid,uuid,text,jsonb,boolean,uuid)',false,false),('public.google_calendar_jobs()',false,false),('public.google_calendar_admin_runs(uuid,uuid)',false,false)
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
