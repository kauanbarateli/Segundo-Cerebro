-- Expanded T016 contract; transaction-only catalogue checks, no remote action.
begin;
set local statement_timeout='30s';
create function pg_temp.activity_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Expanded activity catalogue: %',message;end if;end $$;
do $$declare row record;signature regprocedure;begin
 for row in select * from (values
 ('capture','capturar','content'),('task','tarefas','description'),
 ('finance_account','financeiro','archived_at'),('finance_category','financeiro','color_key'),('finance_tag','financeiro','name'),('finance_transaction','financeiro','amount_cents'),('finance_budget','financeiro','limit_cents'),
 ('knowledge_notebook','conhecimento','project_id'),('knowledge_page','conhecimento','document'),('knowledge_link','conhecimento','to_id'),
 ('project','projetos','description'),('project_container','projetos','project_id'),
 ('habit','habitos','weekdays'),('habit_entry','habitos','done_on'),('habit_pause','habitos','starts_on'),
 ('drive_folder','drive','parent_id'),('drive_file','drive','starred'),
 ('profile','configuracoes','avatar_file_id'),('preference','configuracoes','meeting_reminder_minutes'),('module_preference','configuracoes','module_key'),('moderation','configuracoes','must_change_password'),('role','configuracoes','role'),('entitlement','configuracoes','allowed'),
 ('vault_metadata','cofre','operation'),('calendar_account','calendario','operation'),('calendar_source','calendario','selected'),('calendar_event','calendario','linked_capture_id'),('calendar_sync','calendario','event_count')
 ) x(kind,feature,field) loop
  perform pg_temp.activity_assert(app_private.activity_projection_feature(row.kind)=row.feature,'actual event type feature: '||row.kind);
  perform pg_temp.activity_assert(row.field=any(app_private.activity_projection_fields(row.kind)),'actual persisted field: '||row.kind||'.'||row.field);
 end loop;
 perform pg_temp.activity_assert(app_private.activity_projection_feature('authentication') is null and app_private.activity_projection_feature('unknown') is null,'sensitive/unknown event types excluded');
 foreach signature in array array['app_private.activity_projection_fields(text)'::regprocedure,'app_private.activity_projection_feature(text)'::regprocedure] loop
  perform pg_temp.activity_assert((select not prosecdef and provolatile='i' and ('search_path=""'=any(proconfig) or 'search_path='=any(proconfig)) from pg_proc where oid=signature),'pure immutable helper with empty search_path');
  perform pg_temp.activity_assert(has_function_privilege('service_role',signature,'EXECUTE') and not has_function_privilege('anon',signature,'EXECUTE') and has_function_privilege('authenticated',signature,'EXECUTE')=(signature='app_private.activity_projection_feature(text)'::regprocedure),'only pure feature helper available to authenticated RLS');
 end loop;
 perform pg_temp.activity_assert((select pg_get_expr(polqual,polrelid) like '%activity_projection_feature%' from pg_policy where polrelid='public.domain_events'::regclass and polname='own_read'),'direct event reads cover expanded Entitlements');
 perform pg_temp.activity_assert(exists(select 1 from pg_index where indexrelid='public.domain_events_user_time_idx'::regclass and indisvalid),'all-domain keyset index valid');
 perform pg_temp.activity_assert(not has_table_privilege('authenticated','public.domain_events','SELECT') and has_column_privilege('authenticated','public.domain_events','id','SELECT') and has_column_privilege('authenticated','public.domain_events','occurred_at','SELECT'),'direct read narrowed to metadata columns');
 perform pg_temp.activity_assert(not has_column_privilege('authenticated','public.domain_events','before','SELECT') and not has_column_privilege('authenticated','public.domain_events','after','SELECT') and not has_column_privilege('authenticated','public.domain_events','capture_task_payload','SELECT'),'no direct content payload columns');
end $$;
rollback;
