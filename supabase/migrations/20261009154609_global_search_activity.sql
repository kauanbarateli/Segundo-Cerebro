-- T026. Seven owner-scoped types, no financial values or Vault content.
-- Manual application only after the domain migrations. No seed or remote action.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create extension if not exists pg_trgm with schema extensions;
do $$ begin
  if (select e.extnamespace <> 'extensions'::regnamespace from pg_extension e where e.extname='pg_trgm') then
    raise exception 'pg_trgm must be available in extensions; review existing installation manually.';
  end if;
end $$;
do $$ declare row record; expression text; begin
  for row in select * from (values
    ('tasks','coalesce(payload->>''title'','''') || '' '' || coalesce(payload->>''description'','''')'),
    ('captures','coalesce(payload->>''title'','''') || '' '' || coalesce(payload->>''content'','''')'),
    ('knowledge_pages','title || '' '' || content_text'),
    ('fin_transactions','description || '' '' || coalesce(payload->>''payee'','''') || '' '' || coalesce(payload->>''notes'','''')'),
    ('drive_files','name'),('projects','coalesce(payload->>''name'','''') || '' '' || coalesce(payload->>''description'','''')'),('habits','name')
  ) as entries(table_name,source) loop
    expression:=format('app_private.knowledge_normalize(%s)',row.source);
    execute format('alter table public.%I add column search_document text generated always as (%s) stored',row.table_name,expression);
    execute format('alter table public.%I add column search_terms tsvector generated always as (to_tsvector(''simple'',%s)) stored',row.table_name,expression);
    execute format('create index %I on public.%I using gin(search_terms)',row.table_name||'_global_search_idx',row.table_name);
    execute format('create index %I on public.%I using gin(search_document extensions.gin_trgm_ops)',row.table_name||'_global_substring_idx',row.table_name);
  end loop;
end $$;
create function public.global_search(p_user uuid,p_session uuid,p_term text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row record; v_sql text:=''; v_term text; v_title text; v_rank_title text; v_filter text; v_result jsonb;
begin
  perform 1 from auth.users u where u.id=p_user for share;
  perform 1 from auth.sessions s where s.id=p_session and s.user_id=p_user for share;
  perform app_private.capture_task_lock(p_user);
  perform app_private.require_actor(p_user,p_session);
  if exists(select 1 from public.user_entitlements e where e.user_id=p_user and e.feature_key='inicio' and not e.allowed) then raise exception 'Feature unavailable.' using errcode='42501'; end if;
  if p_term is null or char_length(btrim(p_term))>120 or p_term ~ '[[:cntrl:]]' then raise exception 'Invalid search.' using errcode='22023'; end if;
  v_term:=app_private.knowledge_normalize(p_term);
  if v_term='' then return '[]'::jsonb; end if;
  -- Build only permitted branches. Each statement sees one MVCC snapshot and
  -- never queries a source whose current entitlement is denied.
  for row in select * from (values
    ('task','tasks','tarefas',0),('capture','captures','capturar',1),('page','knowledge_pages','conhecimento',2),
    ('transaction','fin_transactions','financeiro',3),('file','drive_files','drive',4),('project','projects','projetos',5),('habit','habits','habitos',6)
  ) as entries(kind,table_name,feature_key,kind_order) loop
    if exists(select 1 from public.user_entitlements e where e.user_id=p_user and e.feature_key=row.feature_key and not e.allowed) then continue; end if;
    v_title:=case row.kind when 'file' then 't.name' when 'transaction' then 't.description' when 'habit' then 't.name' when 'project' then 'coalesce(t.payload->>''name'',''Projeto'')' when 'page' then 't.title' else 'coalesce(t.payload->>''title'',''Sem título'')' end;
    -- File/Habit document is exactly the normalized title. Reuse the stored
    -- value instead of normalizing every matching row up to three times.
    v_rank_title:=case when row.kind in ('file','habit') then 't.search_document' else format('app_private.knowledge_normalize(%s)',v_title) end;
    v_filter:=case row.kind when 'habit' then 't.archived_at is null' when 'file' then 't.deleted_at is null and t.purged_at is null and t.kind=''drive''' when 'transaction' then 't.deleted_at is null and t.status<>''cancelled''' when 'page' then 't.deleted_at is null and t.archived_at is null' when 'task' then 't.deleted_at is null and t.archived_at is null and t.status<>''archived''' when 'capture' then 't.deleted_at is null and t.archived_at is null and t.status not in (''draft'',''archived'')' else 't.deleted_at is null' end;
    if v_sql<>'' then v_sql:=v_sql||' union all '; end if;
    v_sql:=v_sql||format('(select t.id,t.user_id,%L::text as type,left(%s,200) as title,%s as kind_order,
      case when %s=$2 then 0 when starts_with(%s,$2) then 1
        when position($2 in %s)>0 then 2 when position($2 in t.search_document)>0 then 3 else 4 end as rank
      from public.%I t where t.user_id=$1 and %s and (t.search_terms @@ plainto_tsquery(''simple'',$2) or t.search_document like (''%%'' || replace(replace(replace($2,chr(92),chr(92)||chr(92)),''%%'',chr(92)||''%%''),''_'',chr(92)||''_'') || ''%%'') escape chr(92))
      order by rank,title,t.id limit 10)',row.kind,v_title,row.kind_order,v_rank_title,v_rank_title,v_rank_title,row.table_name,v_filter);
  end loop;
  if v_sql='' then return '[]'::jsonb; end if;
  execute 'select coalesce(jsonb_agg(jsonb_build_object(''id'',r.id,''user_id'',r.user_id,''type'',r.type,''title'',r.title,''rank'',r.rank) order by r.rank,r.kind_order,r.title,r.id),''[]''::jsonb) from ('||v_sql||') r' into v_result using p_user,v_term;
  return v_result;
end $$;
revoke all on function public.global_search(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.global_search(uuid,uuid,text) to service_role;
-- T016 expanded projection. Financial and Vault titles are always omitted.
create function app_private.activity_projection_fields(p_type text) returns text[]
language sql immutable set search_path='' as $$ select array(select jsonb_array_elements_text(('{"capture":["title","content","type","status","category_id","project_id","converted_task_id","organized_at","archived_at","deleted_at","linked_capture_ids","attachments"],"task":["title","description","status","priority","category_id","project_id","due_at","scheduled_start_at","scheduled_end_at","all_day","estimated_minutes","board_position","origin_capture_id","completed_at","archived_at","deleted_at"],"finance_account":["name","kind","institution","opening_balance_cents","archived_at"],"finance_category":["name","kind","color_key"],"finance_tag":["name","color_key"],"finance_transaction":["description","amount_cents","paid_cents","status","account_id","category_id","occurred_on","due_date","statement_month","deleted_at","tag_ids"],"finance_budget":["category_id","month","limit_cents"],"knowledge_notebook":["name","project_id","deleted_at"],"knowledge_page":["title","document","notebook_id","parent_id","archived_at","deleted_at","version"],"knowledge_link":["from_type","from_id","to_type","to_id","deleted_at"],"project":["name","description","color_key","position","deleted_at"],"project_container":["name","project_id","parent_id","deleted_at"],"habit":["name","schedule_kind","weekdays","weekly_target","started_on","archived_at"],"habit_entry":["habit_id","done_on"],"habit_pause":["habit_id","starts_on","ends_on","reason"],"drive_folder":["name","parent_id","project_id","deleted_at"],"drive_file":["name","folder_id","starred","deleted_at"],"profile":["display_name","avatar_file_id"],"preference":["theme","default_calendar_view","values_hidden","meeting_reminders_enabled","meeting_reminder_minutes"],"module_preference":["module_key","visible","sort_order"],"moderation":["status","must_change_password"],"role":["role"],"entitlement":["feature_key","allowed"],"vault_metadata":["operation","version"],"calendar_account":["status","operation"],"calendar_source":["selected"],"calendar_event":["title","starts_at","ends_at","all_day","linked_capture_id","deleted_at"],"calendar_sync":["status","calendar_count","event_count"]}'::jsonb)->p_type)); $$;
create function app_private.activity_projection_feature(p_type text) returns text
language sql immutable set search_path='' as $$ select '{"capture":"capturar","task":"tarefas","finance_account":"financeiro","finance_category":"financeiro","finance_tag":"financeiro","finance_transaction":"financeiro","finance_budget":"financeiro","knowledge_notebook":"conhecimento","knowledge_page":"conhecimento","knowledge_link":"conhecimento","project":"projetos","project_container":"projetos","habit":"habitos","habit_entry":"habitos","habit_pause":"habitos","drive_folder":"drive","drive_file":"drive","profile":"configuracoes","preference":"configuracoes","module_preference":"configuracoes","moderation":"configuracoes","role":"configuracoes","entitlement":"configuracoes","vault_metadata":"cofre","calendar_account":"calendario","calendar_source":"calendario","calendar_event":"calendario","calendar_sync":"calendario"}'::jsonb->>p_type; $$;
revoke all on function app_private.activity_projection_fields(text),app_private.activity_projection_feature(text) from public,anon,authenticated;
grant execute on function app_private.activity_projection_fields(text),app_private.activity_projection_feature(text) to service_role;
create or replace function app_private.activity_page(p_user uuid,p_session uuid,p_limit integer default 20,p_before_time timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 perform 1 from auth.users where id=p_user for share;
 perform 1 from auth.sessions where id=p_session and user_id=p_user for share;
 perform app_private.capture_task_lock(p_user); perform app_private.require_actor(p_user,p_session);
 if exists(select 1 from public.user_entitlements where user_id=p_user and feature_key='inicio' and not allowed) then raise exception 'Feature unavailable.' using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 50 or (p_before_time is null)<>(p_before_id is null)
   or p_before_time is not null and (not isfinite(p_before_time) or p_before_time<'0001-01-01T00:00:00Z'::timestamptz or p_before_time>='10000-01-01T00:00:00Z'::timestamptz) then raise exception 'Invalid activity cursor.' using errcode='22023';end if;
 with candidates as materialized (
   select e.* from public.domain_events e where e.user_id=p_user
   and app_private.activity_projection_feature(e.entity_type) is not null
   and not exists(select 1 from public.user_entitlements where user_id=p_user and feature_key=app_private.activity_projection_feature(e.entity_type) and not allowed)
   and (e.entity_type<>'drive_file' or coalesce(e.after->>'kind',e.before->>'kind')='drive')
   and (e.entity_type<>'project_container' or not exists(select 1 from public.user_entitlements where user_id=p_user and not allowed and feature_key=case coalesce(e.after->>'kind',e.before->>'kind') when 'capture' then 'capturar' when 'notebook' then 'conhecimento' when 'folder' then 'drive' end))
   and (p_before_time is null or (e.occurred_at,e.id)<(p_before_time,p_before_id))
   order by e.occurred_at desc,e.id desc limit p_limit+1
 ), page as materialized (select * from candidates order by occurred_at desc,id desc limit p_limit)
 select jsonb_build_object(
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'user_id',e.user_id,'entity_type',e.entity_type,'entity_id',e.entity_id,'action',e.action,'canal',e.canal,
    'occurred_at',to_char(e.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'title',case when e.entity_type='vault_metadata' or starts_with(e.entity_type,'finance_') then null else left(coalesce(e.after->>'title',e.after->>'name',e.before->>'title',e.before->>'name'),200) end,
    'changed_fields',coalesce((select jsonb_agg(f.name order by f.position) from unnest(app_private.activity_projection_fields(e.entity_type)) with ordinality f(name,position)
      where coalesce(e.before->f.name,'null'::jsonb) is distinct from coalesce(e.after->f.name,'null'::jsonb)),'[]'::jsonb)
  ) order by e.occurred_at desc,e.id desc) from page e),'[]'::jsonb),
  'next_cursor',case when (select count(*) from candidates)>p_limit then (select jsonb_build_object('id',id,'occurred_at',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) from page order by occurred_at,id limit 1) else null end
 ) into v_result;
 return v_result;
end $$;
-- Direct JWT reads expose only metadata and apply the same source entitlements.
-- before/after and capture_task_payload remain available to internal service RPCs.
grant execute on function app_private.activity_projection_feature(text) to authenticated;
drop policy own_read on public.domain_events;
create policy own_read on public.domain_events for select to authenticated using (
  user_id=(select auth.uid()) and (select app_private.current_user_active())
  and app_private.has_feature(app_private.activity_projection_feature(entity_type))
  and (entity_type<>'drive_file' or coalesce(after->>'kind',before->>'kind')='drive')
  and (entity_type<>'project_container' or app_private.has_feature(case coalesce(after->>'kind',before->>'kind') when 'capture' then 'capturar' when 'notebook' then 'conhecimento' when 'folder' then 'drive' end))
);
revoke select on public.domain_events from authenticated;
grant select(id,user_id,entity_type,entity_id,action,canal,occurred_at) on public.domain_events to authenticated;
commit;
