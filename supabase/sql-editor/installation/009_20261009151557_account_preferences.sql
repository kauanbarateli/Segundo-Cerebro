-- T027. Aplicação manual no projeto pessoal; sem credenciais ou provisionamento.
begin;
alter table public.user_preferences add column meeting_reminders_enabled boolean not null default true;
alter table public.user_preferences add column meeting_reminder_minutes smallint not null default 10 check (meeting_reminder_minutes in (5,10,15,30));
alter table public.profiles add column avatar_file_id uuid;

create function public.settings_snapshot(p_user uuid,p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
  perform app_private.require_actor(p_user,p_session);
  if exists(select 1 from public.user_entitlements where user_id=p_user and feature_key='configuracoes' and not allowed) then raise exception 'Feature unavailable.' using errcode='42501'; end if;
  select jsonb_build_object('user_id',p_user,
    'profile',jsonb_build_object('display_name',p.display_name,'email',u.email,'avatar_file_id',p.avatar_file_id),
    'preferences',jsonb_build_object('theme',v.theme,'default_calendar_view',v.default_calendar_view,'values_hidden',v.values_hidden,'meeting_reminders_enabled',v.meeting_reminders_enabled,'meeting_reminder_minutes',v.meeting_reminder_minutes),
    'modules',coalesce((select jsonb_agg(jsonb_build_object('module_key',m.module_key,'visible',m.visible,'sort_order',m.sort_order) order by m.sort_order,m.module_key) from public.user_modules m where m.user_id=p_user),'[]'::jsonb))
    into v_result from public.profiles p join public.user_preferences v using(user_id) join auth.users u on u.id=p.user_id where p.user_id=p_user;
  if v_result is null then raise exception 'Identity unavailable.' using errcode='42501'; end if;
  return v_result;
end $$;

create function public.settings_commit(p_user uuid,p_session uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_command text; v_input jsonb; v_patch jsonb; v_client text; v_before jsonb; v_after jsonb; v_result jsonb; v_row jsonb;
begin
  -- Same parent/advisory order as other domains: Auth identity, session, then revision.
  perform 1 from auth.users where id=p_user for share;
  perform 1 from auth.sessions where id=p_session and user_id=p_user for share;
  perform app_private.capture_task_lock(p_user);
  perform app_private.require_actor(p_user,p_session);
  if exists(select 1 from public.user_entitlements where user_id=p_user and feature_key='configuracoes' and not allowed) then raise exception 'Feature unavailable.' using errcode='42501'; end if;
  if jsonb_typeof(p_request) is distinct from 'object' or p_request-array['command','input']<>'{}'::jsonb or not p_request ?& array['command','input'] or octet_length(p_request::text)>16384 then raise exception 'Invalid request.' using errcode='22023'; end if;
  v_command:=p_request->>'command'; v_input:=p_request->'input'; v_client:=v_input->>'client_id';
  if v_command not in ('settings.profile.update','settings.preferences.update','settings.modules.update') or jsonb_typeof(v_input) is distinct from 'object' or jsonb_typeof(v_input->'client_id') is distinct from 'string' then raise exception 'Invalid command.' using errcode='22023'; end if;
  v_result:=app_private.command_replay(p_user,v_command,v_client,p_request);
  if v_result is not null then return v_result; end if;
  if not (app_private.consume_rate_limit_at('identity_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null)->>'allowed')::boolean then raise exception 'Settings write limit reached.' using errcode='PT429'; end if;
  if v_command='settings.profile.update' then
    if v_input-array['client_id','display_name']<>'{}'::jsonb or jsonb_typeof(v_input->'display_name') is distinct from 'string' or char_length(btrim(v_input->>'display_name')) not between 1 and 120 then raise exception 'Invalid name.' using errcode='22023'; end if;
    select to_jsonb(p.*) into v_before from public.profiles p where user_id=p_user for update;
    update public.profiles set display_name=btrim(v_input->>'display_name'),updated_at=now() where user_id=p_user returning to_jsonb(profiles.*) into v_after;
    perform app_private.append_event(p_user,'profile',p_user,'updated','web',v_before,v_after);
  elsif v_command='settings.preferences.update' then
    v_patch:=v_input->'patch';
    if v_input-array['client_id','patch']<>'{}'::jsonb or jsonb_typeof(v_patch) is distinct from 'object' or v_patch='{}'::jsonb or v_patch-array['theme','default_calendar_view','values_hidden','meeting_reminders_enabled','meeting_reminder_minutes']<>'{}'::jsonb
      or (v_patch ? 'theme' and (jsonb_typeof(v_patch->'theme') is distinct from 'string' or v_patch->>'theme' not in ('system','light','dark')))
      or (v_patch ? 'default_calendar_view' and (jsonb_typeof(v_patch->'default_calendar_view') is distinct from 'string' or v_patch->>'default_calendar_view' not in ('day','week','month')))
      or (v_patch ? 'values_hidden' and jsonb_typeof(v_patch->'values_hidden') is distinct from 'boolean')
      or (v_patch ? 'meeting_reminders_enabled' and jsonb_typeof(v_patch->'meeting_reminders_enabled') is distinct from 'boolean')
      or (v_patch ? 'meeting_reminder_minutes' and (jsonb_typeof(v_patch->'meeting_reminder_minutes') is distinct from 'number' or v_patch->>'meeting_reminder_minutes' not in ('5','10','15','30'))) then raise exception 'Invalid preferences.' using errcode='22023'; end if;
    select to_jsonb(p.*) into v_before from public.user_preferences p where user_id=p_user for update;
    update public.user_preferences set theme=coalesce(v_patch->>'theme',theme),default_calendar_view=coalesce(v_patch->>'default_calendar_view',default_calendar_view),
      values_hidden=coalesce((v_patch->>'values_hidden')::boolean,values_hidden),meeting_reminders_enabled=coalesce((v_patch->>'meeting_reminders_enabled')::boolean,meeting_reminders_enabled),
      meeting_reminder_minutes=coalesce((v_patch->>'meeting_reminder_minutes')::smallint,meeting_reminder_minutes),updated_at=now() where user_id=p_user returning to_jsonb(user_preferences.*) into v_after;
    perform app_private.append_event(p_user,'preference',p_user,'updated','web',v_before,v_after);
  else
    if v_input-array['client_id','modules']<>'{}'::jsonb or jsonb_typeof(v_input->'modules') is distinct from 'array' or jsonb_array_length(v_input->'modules') not between 1 and 13 then raise exception 'Invalid modules.' using errcode='22023'; end if;
    if (select count(distinct x->>'module_key') from jsonb_array_elements(v_input->'modules') x) <> jsonb_array_length(v_input->'modules') then raise exception 'Repeated module.' using errcode='22023'; end if;
    for v_row in select value from jsonb_array_elements(v_input->'modules') loop
      if jsonb_typeof(v_row) is distinct from 'object' or v_row-array['module_key','visible','sort_order']<>'{}'::jsonb or not v_row ?& array['module_key','visible','sort_order']
        or jsonb_typeof(v_row->'visible') is distinct from 'boolean' or jsonb_typeof(v_row->'sort_order') is distinct from 'number' or (v_row->>'sort_order') !~ '^[0-9]{1,4}$'
        or (v_row->>'sort_order')::integer>1000 or (v_row->>'module_key' in ('inicio','capturar','configuracoes') and not (v_row->>'visible')::boolean)
        or exists(select 1 from public.user_entitlements where user_id=p_user and feature_key=v_row->>'module_key' and not allowed)
        or (v_row->>'module_key'='admin' and not exists(select 1 from public.user_roles where user_id=p_user and role='master')) then raise exception 'Unavailable module preference.' using errcode='22023'; end if;
      select to_jsonb(m.*) into v_before from public.user_modules m where user_id=p_user and module_key=v_row->>'module_key' for update;
      insert into public.user_modules(user_id,module_key,visible,sort_order) values(p_user,v_row->>'module_key',(v_row->>'visible')::boolean,(v_row->>'sort_order')::smallint)
        on conflict(user_id,module_key) do update set visible=excluded.visible,sort_order=excluded.sort_order,updated_at=now() returning to_jsonb(user_modules.*) into v_after;
      perform app_private.append_event(p_user,'module_preference',p_user,case when v_before is null then 'created' else 'updated' end,'web',v_before,v_after);
    end loop;
  end if;
  v_result:=public.settings_snapshot(p_user,p_session);
  insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,v_command,v_client,p_request,v_result);
  return v_result;
end $$;
revoke all on function public.settings_snapshot(uuid,uuid),public.settings_commit(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.settings_snapshot(uuid,uuid),public.settings_commit(uuid,uuid,jsonb) to service_role;
commit;
