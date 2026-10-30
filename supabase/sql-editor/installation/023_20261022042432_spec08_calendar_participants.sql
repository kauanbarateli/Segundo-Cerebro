-- SPEC08 / T049 / #74. Additive Calendar participants and List preference.
-- Prepared from the peer-reviewed E3 proposal; not proof of hosted application.
-- Apply only under OP-009 in the personal project after backup/cutover gates.
-- A cache schema marker is distinct from completeness of Google's guest roster.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $preflight$ begin
 if current_user<>'postgres' or to_regprocedure('app_private.google_calendar_call(uuid,uuid,text,jsonb,boolean,uuid)') is null
  or to_regclass('public.calendar_events') is null then
  raise exception 'Reviewed Calendar foundation and postgres owner required.';
 end if;
end $preflight$;

create function app_private.calendar_attendee_pair_valid(p jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare a jsonb; k text; begin
 if jsonb_typeof(p) is distinct from 'object' then return false;end if;
 if not (p ? 'attendees') and not (p ? 'attendees_omitted') then return true;end if;
 if not p ?& array['attendees','attendees_omitted'] then return false;end if;
 if p->'attendees'='null'::jsonb and p->'attendees_omitted'='null'::jsonb then return true;end if;
 if jsonb_typeof(p->'attendees') is distinct from 'array' or jsonb_typeof(p->'attendees_omitted') is distinct from 'boolean' then return false;end if;
 if jsonb_array_length(p->'attendees')>200 then return false;end if;
 for a in select value from jsonb_array_elements(p->'attendees') loop
  if jsonb_typeof(a) is distinct from 'object' then return false;end if;
  if not a ?& array['name','email','response_status','self','organizer','optional','resource'] or a-array['name','email','response_status','self','organizer','optional','resource']<>'{}'::jsonb then return false;end if;
  foreach k in array array['name','email'] loop
   if a->k<>'null'::jsonb and (jsonb_typeof(a->k) is distinct from 'string' or char_length(a->>k)>(case when k='name' then 255 else 254 end) or a->>k ~ '[[:cntrl:]]') then return false;end if;
  end loop;
  if jsonb_typeof(a->'response_status') is distinct from 'string' or a->>'response_status' not in ('needsAction','declined','tentative','accepted','unknown') then return false;end if;
  foreach k in array array['self','organizer','optional','resource'] loop
   if jsonb_typeof(a->k) is distinct from 'boolean' then return false;end if;
  end loop;
 end loop;
 return true;
end $$;
revoke all on function app_private.calendar_attendee_pair_valid(jsonb) from public,anon,authenticated,service_role;

alter table public.calendar_events add column attendees jsonb, add column attendees_omitted boolean;
alter table public.calendar_events add constraint calendar_events_attendees_check check (
 app_private.calendar_attendee_pair_valid(jsonb_build_object('attendees',attendees,'attendees_omitted',attendees_omitted))
);
-- Version means response schema observed, NOT a complete guest roster.
-- attendeesOmitted=true remains partial even when version=1.
alter table app_private.google_calendar_cursors add column attendees_version smallint not null default 0 check(attendees_version in (0,1));
alter table public.user_preferences drop constraint user_preferences_default_calendar_view_check;
alter table public.user_preferences add constraint user_preferences_default_calendar_view_check check(default_calendar_view in ('day','week','month','list'));






create or replace function app_private.calendar_private_account(p_user uuid,p_account uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.calendar_accounts;c app_private.google_credentials;begin
 select * into a from public.calendar_accounts where user_id=p_user and id=p_account; if a.id is null then raise exception 'Calendar account unavailable.' using errcode='23503'; end if;
 select * into strict c from app_private.google_credentials where user_id=p_user and account_id=p_account;
 return jsonb_build_object('id',a.id,'user_id',a.user_id,'google_sub',a.google_sub,'revision',a.revision::text,'credential_version',a.credential_version,'status',a.status,'tokens',c.envelope,'calendars',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'google_id',s.google_id,'selected',s.selected,'sync_token',case when cur.attendees_version=1 then cur.sync_token else null end,'window',case when cur.start_day is null then null else jsonb_build_object('start_day',cur.start_day,'end_day',cur.end_day) end) order by s.id) from public.calendar_sources s left join app_private.google_calendar_cursors cur on cur.user_id=s.user_id and cur.calendar_id=s.id where s.user_id=p_user and s.account_id=p_account),'[]'::jsonb));
end $$;
create or replace function app_private.calendar_snapshot(p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_window jsonb;p public.user_preferences;begin
 select * into strict p from public.user_preferences where user_id=p_user;
 if exists(select 1 from public.calendar_sources s join public.calendar_accounts a on a.user_id=s.user_id and a.id=s.account_id left join app_private.google_calendar_cursors c on c.user_id=s.user_id and c.calendar_id=s.id where s.user_id=p_user and s.selected and a.status='connected' and (c.start_day is null or c.sync_token is null)) then v_window:=null;
 else select case when max(c.start_day)<min(c.end_day) then jsonb_build_object('start_day',max(c.start_day),'end_day',min(c.end_day)) else null end into v_window from app_private.google_calendar_cursors c join public.calendar_sources s on s.user_id=c.user_id and s.id=c.calendar_id join public.calendar_accounts a on a.user_id=s.user_id and a.id=s.account_id where s.user_id=p_user and s.selected and a.status='connected'; end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'user_id',e.user_id,'account_id',e.account_id,'calendar_id',e.calendar_id,'title',e.title,'starts_at',e.starts_at,'ends_at',e.ends_at,'location',e.location,'linked_capture_id',case when exists(select 1 from public.captures where user_id=p_user and id=e.linked_capture_id and deleted_at is null) and not exists(select 1 from public.user_entitlements where user_id=p_user and feature_key='capturar' and not allowed) then e.linked_capture_id else null end,'habit_id',null,'all_day',e.all_day,'html_link',e.html_link,'reminder_minutes',e.reminder_minutes,'attendees',e.attendees,'attendees_omitted',e.attendees_omitted) order by e.starts_at,e.id) from public.calendar_events e join public.calendar_sources s on s.user_id=e.user_id and s.id=e.calendar_id join public.calendar_accounts a on a.user_id=e.user_id and a.id=e.account_id where e.user_id=p_user and s.selected and a.status='connected'),'[]'::jsonb),
 'calendars',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'user_id',s.user_id,'account_id',s.account_id,'name',s.name,'color_key',s.color_key,'selected',s.selected) order by s.name,s.id) from public.calendar_sources s join public.calendar_accounts a on a.user_id=s.user_id and a.id=s.account_id where s.user_id=p_user and a.status<>'revocation_pending'),'[]'::jsonb),
 'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'email',email,'scopes',scopes,'status',status,'last_synced_at',last_synced_at) order by created_at,id) from public.calendar_accounts where user_id=p_user),'[]'::jsonb),
 'sync_runs',coalesce((select jsonb_agg(to_jsonb(r) order by r.started_at desc,r.id desc) from (select id,user_id,account_id,channel,status,calendar_count,event_count,started_at,finished_at from public.calendar_sync_runs where user_id=p_user order by started_at desc,id desc limit 30) r),'[]'::jsonb),
 'window',v_window,'preferences',jsonb_build_object('default_calendar_view',p.default_calendar_view,'meeting_reminders_enabled',p.meeting_reminders_enabled,'meeting_reminder_minutes',p.meeting_reminder_minutes));
end $$;
create or replace function app_private.google_calendar_call(p_user uuid,p_session uuid,p_command text,p_input jsonb,p_cron boolean,p_execution uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.calendar_accounts;s public.calendar_sources;f app_private.google_oauth_flows;r public.calendar_sync_runs;x app_private.google_sync_executions;
 v_account uuid;v_source uuid;v_flow uuid;v_run uuid;v_event uuid;v_capture uuid;v_client text;v_before jsonb;v_after jsonb;v_revision bigint;v_version integer;v_start date;v_end date;v_scopes text[];item jsonb;v_count integer;v_result jsonb;
begin
 perform app_private.calendar_actor(p_user,p_session,p_cron);
 if p_execution is null or p_cron is null or jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Invalid calendar context.' using errcode='22023'; end if;
 if p_command in ('guard','snapshot') then
  if p_input<>'{}'::jsonb then raise exception 'Unexpected calendar fields.' using errcode='22023'; end if;
  if p_command='guard' then return '{}'::jsonb; end if;return app_private.calendar_snapshot(p_user);
 elsif p_command='quota' then
  if p_input-array['scope']<>'{}'::jsonb then raise exception 'Invalid quota fields.' using errcode='22023'; end if;perform app_private.calendar_quota(p_user,p_input->>'scope');return '{}'::jsonb;
 elsif p_command='flow_begin' then
  if p_cron or p_input-array['flow_id','digest','expires_at','reconnect_account']<>'{}'::jsonb or not p_input ?& array['flow_id','digest','expires_at','reconnect_account'] or jsonb_typeof(p_input->'flow_id') is distinct from 'string' or jsonb_typeof(p_input->'expires_at') is distinct from 'string' or jsonb_typeof(p_input->'reconnect_account') not in ('string','null') or jsonb_typeof(p_input->'digest') is distinct from 'string' or p_input->>'digest' !~ '^[a-f0-9]{64}$' or (p_input->>'expires_at')::timestamptz<=now() or (p_input->>'expires_at')::timestamptz>now()+interval '10 minutes' then raise exception 'Invalid OAuth reservation.' using errcode='22023'; end if;
  perform app_private.calendar_quota(p_user,'oauth');v_flow:=(p_input->>'flow_id')::uuid;v_account:=(p_input->>'reconnect_account')::uuid;
  if v_flow is null then raise exception 'OAuth flow required.' using errcode='22023'; end if;
  if v_account is not null then if not exists(select 1 from public.calendar_accounts where user_id=p_user and id=v_account and status<>'revocation_pending') then raise exception 'Reconnect target unavailable.' using errcode='23503'; end if;
  else if (select count(*) from public.calendar_accounts where user_id=p_user)+(select count(*) from app_private.google_oauth_flows where user_id=p_user and not reconnect and state in ('pending','consumed') and expires_at>now())>=2 then raise exception 'At most two Google accounts.' using errcode='23514'; end if;v_account:=gen_random_uuid();end if;
  insert into app_private.google_oauth_flows(id,user_id,session_id,account_id,reconnect,digest,expires_at) values(v_flow,p_user,p_session,v_account,p_input->>'reconnect_account' is not null,p_input->>'digest',(p_input->>'expires_at')::timestamptz);
  perform app_private.append_event(p_user,'calendar_account',v_account,'created','web',null,jsonb_build_object('account_id',v_account,'operation','oauth_started'));return jsonb_build_object('account_id',v_account);
 elsif p_command in ('flow_consume','flow_fail') then
  if p_cron or p_input-array['flow_id','digest']<>'{}'::jsonb then raise exception 'Invalid OAuth fields.' using errcode='22023'; end if;
  select * into f from app_private.google_oauth_flows where user_id=p_user and id=(p_input->>'flow_id')::uuid for update;
  if f.id is null or f.session_id is distinct from p_session then raise exception 'OAuth flow unavailable.' using errcode='23503'; end if;
  if p_command='flow_consume' then
   if f.state<>'pending' or f.expires_at<=now() or f.digest is distinct from p_input->>'digest' then raise exception 'OAuth flow already consumed or invalid.' using errcode='23505'; end if;
   update app_private.google_oauth_flows set state='consumed' where id=f.id;return jsonb_build_object('account_id',f.account_id,'reconnect',f.reconnect);
  end if;
  if f.state in ('pending','consumed') then update app_private.google_oauth_flows set state='failed' where id=f.id;perform app_private.append_event(p_user,'calendar_account',f.account_id,'status_changed','web',null,jsonb_build_object('account_id',f.account_id,'operation','oauth_failed'));end if;return '{}'::jsonb;
 elsif p_command='connect' then
  if p_cron or p_input-array['flow_id','account_id','google_sub','email','scopes','tokens','credential_version','calendars']<>'{}'::jsonb or not p_input ?& array['flow_id','account_id','google_sub','email','scopes','tokens','credential_version','calendars'] or jsonb_typeof(p_input->'google_sub') is distinct from 'string' or char_length(p_input->>'google_sub') not between 1 and 255 or jsonb_typeof(p_input->'email') is distinct from 'string' or char_length(p_input->>'email') not between 1 and 254 or not app_private.calendar_envelope_valid(p_input->'tokens') or jsonb_typeof(p_input->'scopes') is distinct from 'array' or jsonb_array_length(p_input->'scopes') not between 1 and 32 or exists(select 1 from jsonb_array_elements(p_input->'scopes') q where jsonb_typeof(q) is distinct from 'string' or char_length(q#>>'{}') not between 1 and 4096) or jsonb_typeof(p_input->'credential_version') is distinct from 'number' or p_input->>'credential_version' !~ '^[1-9][0-9]{0,9}$' or jsonb_typeof(p_input->'calendars') is distinct from 'array' or jsonb_array_length(p_input->'calendars')>1000 then raise exception 'Invalid Google connection.' using errcode='22023'; end if;
  v_account:=(p_input->>'account_id')::uuid;v_version:=(p_input->>'credential_version')::integer;
  select * into f from app_private.google_oauth_flows where user_id=p_user and id=(p_input->>'flow_id')::uuid for update;
  if f.id is null or f.session_id is distinct from p_session or f.state<>'consumed' or f.account_id is distinct from v_account then raise exception 'Consumed OAuth reservation required.' using errcode='23505'; end if;
  select array_agg(value) into v_scopes from jsonb_array_elements_text(p_input->'scopes');
  if not ('openid'=any(v_scopes)) or not ('email'=any(v_scopes) or 'https://www.googleapis.com/auth/userinfo.email'=any(v_scopes)) or not ('https://www.googleapis.com/auth/calendar.readonly'=any(v_scopes) or ('https://www.googleapis.com/auth/calendar.calendarlist.readonly'=any(v_scopes) and 'https://www.googleapis.com/auth/calendar.events.readonly'=any(v_scopes))) then raise exception 'Required readonly scopes not granted.' using errcode='23514';end if;
  if f.reconnect then
   select * into a from public.calendar_accounts where user_id=p_user and id=v_account for update;
   if a.id is null or a.google_sub is distinct from p_input->>'google_sub' or a.status='revocation_pending' or v_version<>a.credential_version+1 then raise exception 'Reconnect must preserve account identity.' using errcode='23514';end if;
   v_before:=jsonb_build_object('account_id',a.id,'status',a.status);
   update public.calendar_accounts set email=p_input->>'email',scopes=v_scopes,status='connected',revision=revision+1,credential_version=v_version,updated_at=now() where user_id=p_user and id=v_account;
  else
   if v_version<>1 or (select count(*) from public.calendar_accounts where user_id=p_user)>=2 then raise exception 'At most two Google accounts.' using errcode='23514';end if;
   insert into public.calendar_accounts(id,user_id,google_sub,email,scopes,credential_version) values(v_account,p_user,p_input->>'google_sub',p_input->>'email',v_scopes,v_version);
  end if;
  insert into app_private.google_credentials(user_id,account_id,envelope) values(p_user,v_account,p_input->'tokens') on conflict(account_id) do update set envelope=excluded.envelope;
  delete from public.calendar_sources where user_id=p_user and account_id=v_account and not exists(select 1 from jsonb_array_elements(p_input->'calendars') q where q->>'google_id'=google_id and q->'deleted'='false'::jsonb);
  v_count:=0;
  for item in select value from jsonb_array_elements(p_input->'calendars') loop
   if jsonb_typeof(item) is distinct from 'object' or item-array['google_id','name','color_key','deleted']<>'{}'::jsonb or not item ?& array['google_id','name','color_key','deleted'] or jsonb_typeof(item->'google_id') is distinct from 'string' or char_length(item->>'google_id') not between 1 and 1024 or jsonb_typeof(item->'name') is distinct from 'string' or char_length(item->>'name')>255 or item->>'color_key' is distinct from 'calendar' or jsonb_typeof(item->'deleted') is distinct from 'boolean' then raise exception 'Invalid calendar source.' using errcode='22023';end if;
   if item->'deleted'='true'::jsonb then continue;end if;
   insert into public.calendar_sources(user_id,account_id,google_id,name,color_key,selected) values(p_user,v_account,item->>'google_id',item->>'name','calendar',v_count=0) on conflict(user_id,account_id,google_id) do update set name=excluded.name;
   v_count:=v_count+1;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_input->'calendars') q group by q->>'google_id' having count(*)>1) then raise exception 'Duplicate Google calendar.' using errcode='22023';end if;
  update app_private.google_oauth_flows set state='complete' where id=f.id;
  perform app_private.append_event(p_user,'calendar_account',v_account,case when f.reconnect then 'updated' else 'created' end,'web',v_before,jsonb_build_object('account_id',v_account,'status','connected','calendar_count',v_count));return '{}'::jsonb;
 elsif p_command='private_account' then
  if p_input-array['account_id']<>'{}'::jsonb then raise exception 'Invalid account fields.' using errcode='22023';end if;return app_private.calendar_private_account(p_user,(p_input->>'account_id')::uuid);
 end if;
 -- Remaining commands always identify an owned account, source, run or event.
 if p_command in ('save_tokens','reset_cursor','commit_events','reauthorize','disconnect','finish_disconnect') then
  v_account:=(p_input->>'account_id')::uuid;select * into a from public.calendar_accounts where user_id=p_user and id=v_account for update;
  if a.id is null then
   if p_command='disconnect' and exists(select 1 from app_private.command_receipts where user_id=p_user and command='calendar.disconnect' and client_id=p_input->>'client_id' and request=jsonb_build_object('account_id',v_account)) then return null;end if;
   raise exception 'Owned account unavailable.' using errcode='23503';end if;
  if p_command in ('save_tokens','reset_cursor','commit_events','reauthorize','finish_disconnect') then
   if jsonb_typeof(p_input->'revision') is distinct from 'string' or p_input->>'revision' !~ '^(0|[1-9][0-9]{0,18})$' or (p_input->>'revision')::bigint is distinct from a.revision then raise exception 'Calendar revision conflict.' using errcode='40001';end if;
  end if;
  if p_command in ('save_tokens','reset_cursor','commit_events') and a.status<>'connected' then raise exception 'Account disconnected or needs reauthorization.' using errcode='23514';end if;
 end if;
 if p_command='save_tokens' then
  if p_input-array['account_id','revision','tokens','scopes','credential_version']<>'{}'::jsonb or not app_private.calendar_envelope_valid(p_input->'tokens') or jsonb_typeof(p_input->'credential_version') is distinct from 'number' or p_input->>'credential_version' !~ '^[1-9][0-9]{0,9}$' or (p_input->>'credential_version')::integer<>a.credential_version+1 or jsonb_typeof(p_input->'scopes') is distinct from 'array' or jsonb_array_length(p_input->'scopes') not between 1 and 32 or exists(select 1 from jsonb_array_elements(p_input->'scopes') q where jsonb_typeof(q) is distinct from 'string' or char_length(q#>>'{}') not between 1 and 4096) then raise exception 'Invalid encrypted refresh.' using errcode='22023';end if;
  select array_agg(value) into v_scopes from jsonb_array_elements_text(p_input->'scopes');
  update app_private.google_credentials set envelope=p_input->'tokens' where user_id=p_user and account_id=a.id;
  update public.calendar_accounts set scopes=v_scopes,credential_version=credential_version+1,revision=revision+1,updated_at=now() where user_id=p_user and id=a.id;
  perform app_private.append_event(p_user,'calendar_account',a.id,'updated',case when p_cron then 'cron' else 'web' end,jsonb_build_object('account_id',a.id,'credential_version',a.credential_version),jsonb_build_object('account_id',a.id,'credential_version',a.credential_version+1));return app_private.calendar_private_account(p_user,a.id);
 elsif p_command in ('reset_cursor','commit_events') then
  v_source:=(p_input->>'calendar_id')::uuid;select * into s from public.calendar_sources where user_id=p_user and account_id=a.id and id=v_source;
  if s.id is null or not s.selected then raise exception 'Selected owned calendar required.' using errcode='23503';end if;
  v_run:=(p_input->>'run_id')::uuid;
  if not exists(select 1 from app_private.google_sync_executions execution_row join public.calendar_sync_runs run_row on run_row.user_id=execution_row.user_id and run_row.id=execution_row.run_id where execution_row.user_id=p_user and execution_row.run_id=v_run and execution_row.execution=p_execution and run_row.status='running') then raise exception 'Exact sync execution required.' using errcode='40001';end if;
  if p_command='reset_cursor' then
   if p_input-array['account_id','revision','calendar_id','run_id']<>'{}'::jsonb then raise exception 'Invalid reset fields.' using errcode='22023';end if;
   delete from public.calendar_events where user_id=p_user and calendar_id=s.id;delete from app_private.google_calendar_cursors where user_id=p_user and calendar_id=s.id;
   update public.calendar_accounts set revision=revision+1,updated_at=now() where user_id=p_user and id=a.id;
   perform app_private.append_event(p_user,'calendar_source',s.id,'updated',case when p_cron then 'cron' else 'web' end,null,jsonb_build_object('calendar_id',s.id,'operation','cursor_reset'));return app_private.calendar_private_account(p_user,a.id);
  end if;
  if p_input-array['account_id','revision','calendar_id','run_id','window','reset','events','sync_token']<>'{}'::jsonb or jsonb_typeof(p_input->'window') is distinct from 'object' or (p_input->'window')-array['start_day','end_day']<>'{}'::jsonb or not (p_input->'window' ?& array['start_day','end_day']) or jsonb_typeof(p_input->'reset') is distinct from 'boolean' or jsonb_typeof(p_input->'events') is distinct from 'array' or jsonb_array_length(p_input->'events')>20000 or jsonb_typeof(p_input->'sync_token') is distinct from 'string' or char_length(p_input->>'sync_token') not between 1 and 4096 then raise exception 'Invalid event batch.' using errcode='22023';end if;
  v_start:=(p_input->'window'->>'start_day')::date;v_end:=(p_input->'window'->>'end_day')::date;if v_start is null or v_end is null or v_end<=v_start or v_end-v_start>730 then raise exception 'Invalid bounded calendar window.' using errcode='22023';end if;
  if p_input->'reset'='true'::jsonb then delete from public.calendar_events where user_id=p_user and calendar_id=s.id;end if;
  for item in select value from jsonb_array_elements(p_input->'events') loop
   if jsonb_typeof(item) is distinct from 'object' or item-array['google_id','cancelled','title','starts_at','ends_at','all_day','location','html_link','reminder_minutes','attendees','attendees_omitted']<>'{}'::jsonb or not item ?& array['google_id','cancelled','title','starts_at','ends_at','all_day','location','html_link','reminder_minutes'] or jsonb_typeof(item->'google_id') is distinct from 'string' or char_length(item->>'google_id') not between 1 and 1024 or jsonb_typeof(item->'cancelled') is distinct from 'boolean' then raise exception 'Invalid Google event.' using errcode='22023';end if;
   if not app_private.calendar_attendee_pair_valid(item) then raise exception 'Invalid attendee payload.' using errcode='22023';end if;
   if item->'cancelled'='true'::jsonb then delete from public.calendar_events where user_id=p_user and calendar_id=s.id and google_id=item->>'google_id';delete from app_private.google_event_links where user_id=p_user and calendar_id=s.id and google_id=item->>'google_id';continue;end if;
   if jsonb_typeof(item->'title') is distinct from 'string' or char_length(item->>'title')>1000 or jsonb_typeof(item->'starts_at') is distinct from 'string' or jsonb_typeof(item->'ends_at') is distinct from 'string' or (item->>'ends_at')::timestamptz<=(item->>'starts_at')::timestamptz or jsonb_typeof(item->'all_day') is distinct from 'boolean' or (item->'location'<>'null'::jsonb and (jsonb_typeof(item->'location') is distinct from 'string' or char_length(item->>'location')>2000)) or (item->'html_link'<>'null'::jsonb and (jsonb_typeof(item->'html_link') is distinct from 'string' or char_length(item->>'html_link')>4096 or item->>'html_link' !~ '^https://(www\.google\.com|calendar\.google\.com)/calendar/event/?(\?|$)')) or (item->'reminder_minutes'<>'null'::jsonb and (jsonb_typeof(item->'reminder_minutes') is distinct from 'number' or item->>'reminder_minutes' !~ '^[0-9]{1,5}$' or (item->>'reminder_minutes')::integer>40320)) then raise exception 'Invalid Google event fields.' using errcode='22023';end if;
   if (item->>'starts_at')::timestamptz>=v_end::timestamp at time zone 'America/Sao_Paulo' or (item->>'ends_at')::timestamptz<=v_start::timestamp at time zone 'America/Sao_Paulo' then delete from public.calendar_events where user_id=p_user and calendar_id=s.id and google_id=item->>'google_id';continue;end if;
   insert into public.calendar_events(id,user_id,account_id,calendar_id,google_id,title,starts_at,ends_at,all_day,location,html_link,reminder_minutes,linked_capture_id,attendees,attendees_omitted) values(substr(encode(sha256(convert_to(p_user::text||':'||s.id::text||':'||(item->>'google_id'),'UTF8')),'hex'),1,32)::uuid,p_user,a.id,s.id,item->>'google_id',item->>'title',(item->>'starts_at')::timestamptz,(item->>'ends_at')::timestamptz,(item->>'all_day')::boolean,item->>'location',item->>'html_link',(item->>'reminder_minutes')::integer,(select linked_capture_id from app_private.google_event_links where user_id=p_user and calendar_id=s.id and google_id=item->>'google_id'),nullif(item->'attendees','null'::jsonb),(item->>'attendees_omitted')::boolean) on conflict(user_id,calendar_id,google_id) do update set title=excluded.title,starts_at=excluded.starts_at,ends_at=excluded.ends_at,all_day=excluded.all_day,location=excluded.location,html_link=excluded.html_link,reminder_minutes=excluded.reminder_minutes,attendees=excluded.attendees,attendees_omitted=excluded.attendees_omitted,updated_at=now();
  end loop;
  insert into app_private.google_calendar_cursors(user_id,calendar_id,sync_token,start_day,end_day,attendees_version) values(p_user,s.id,p_input->>'sync_token',v_start,v_end,case when (p_input->'reset'='true'::jsonb or exists(select 1 from app_private.google_calendar_cursors old_cursor where old_cursor.user_id=p_user and old_cursor.calendar_id=s.id and old_cursor.attendees_version=1)) and not exists(select 1 from jsonb_array_elements(p_input->'events') event_payload where event_payload->'cancelled'='false'::jsonb and (not event_payload ?& array['attendees','attendees_omitted'] or event_payload->'attendees'='null'::jsonb)) then 1 else 0 end) on conflict(calendar_id) do update set sync_token=excluded.sync_token,start_day=excluded.start_day,end_day=excluded.end_day,attendees_version=excluded.attendees_version;
  update public.calendar_accounts set revision=revision+1,last_synced_at=now(),updated_at=now() where user_id=p_user and id=a.id;
  perform app_private.append_event(p_user,'calendar_source',s.id,'updated',case when p_cron then 'cron' else 'web' end,null,jsonb_build_object('calendar_id',s.id,'operation','synced','received_count',jsonb_array_length(p_input->'events')));return app_private.calendar_private_account(p_user,a.id);
 end if;
 if p_command in ('reauthorize','disconnect','finish_disconnect') then
  if p_command='reauthorize' then
   if p_input-array['account_id','revision']<>'{}'::jsonb or a.status='revocation_pending' then raise exception 'Invalid reauthorization fields.' using errcode='22023';end if;
   update public.calendar_accounts set status='reauthorize',revision=revision+1,updated_at=now() where user_id=p_user and id=a.id;
   perform app_private.append_event(p_user,'calendar_account',a.id,'status_changed',case when p_cron then 'cron' else 'web' end,jsonb_build_object('account_id',a.id,'status',a.status),jsonb_build_object('account_id',a.id,'status','reauthorize'));return '{}'::jsonb;
  elsif p_command='disconnect' then
   if p_cron or p_input-array['account_id','client_id']<>'{}'::jsonb or jsonb_typeof(p_input->'client_id') is distinct from 'string' or char_length(btrim(p_input->>'client_id')) not between 1 and 200 then raise exception 'Invalid disconnect fields.' using errcode='22023';end if;
   if exists(select 1 from app_private.command_receipts where user_id=p_user and command='calendar.disconnect' and client_id=p_input->>'client_id' and request is distinct from jsonb_build_object('account_id',a.id)) then raise exception 'client_id reused.' using errcode='23505';end if;
   if a.status<>'revocation_pending' then
    update public.calendar_accounts set status='revocation_pending',revision=revision+1,updated_at=now() where user_id=p_user and id=a.id;
    delete from public.calendar_sources where user_id=p_user and account_id=a.id;
    perform app_private.append_event(p_user,'calendar_account',a.id,'status_changed','web',jsonb_build_object('account_id',a.id,'status',a.status),jsonb_build_object('account_id',a.id,'status','revocation_pending','cache_deleted',true));
   end if;return app_private.calendar_private_account(p_user,a.id);
  else
   if p_cron or p_input-array['account_id','revision','client_id']<>'{}'::jsonb or a.status<>'revocation_pending' or jsonb_typeof(p_input->'client_id') is distinct from 'string' or char_length(btrim(p_input->>'client_id')) not between 1 and 200 then raise exception 'Invalid revocation completion.' using errcode='22023';end if;
   delete from public.calendar_accounts where user_id=p_user and id=a.id;
   perform app_private.append_event(p_user,'calendar_account',a.id,'deleted','web',jsonb_build_object('account_id',a.id,'status','revocation_pending'),jsonb_build_object('account_id',a.id,'revoked',true));
   insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,'calendar.disconnect',p_input->>'client_id',jsonb_build_object('account_id',a.id),jsonb_build_object('account_id',a.id,'revoked',true));return '{}'::jsonb;
  end if;
 elsif p_command in ('select','link') then
  if p_cron or jsonb_typeof(p_input->'client_id') is distinct from 'string' or char_length(btrim(p_input->>'client_id')) not between 1 and 200 then raise exception 'Invalid calendar command identity.' using errcode='22023';end if;v_client:=p_input->>'client_id';
  if exists(select 1 from app_private.command_receipts where user_id=p_user and command=case when p_command='select' then 'calendar.select' else 'calendar.event.link' end and client_id=v_client) then
   select request,result into v_before,v_result from app_private.command_receipts where user_id=p_user and command=case when p_command='select' then 'calendar.select' else 'calendar.event.link' end and client_id=v_client;
   if v_before is distinct from p_input then raise exception 'client_id reused.' using errcode='23505';end if;return v_result;
  end if;
  if p_command='select' then
   if p_input-array['client_id','calendar_id','selected']<>'{}'::jsonb or jsonb_typeof(p_input->'selected') is distinct from 'boolean' then raise exception 'Invalid selection.' using errcode='22023';end if;
   select * into s from public.calendar_sources where user_id=p_user and id=(p_input->>'calendar_id')::uuid;
   if s.id is null or not exists(select 1 from public.calendar_accounts where user_id=p_user and id=s.account_id and status='connected') then raise exception 'Owned connected source required.' using errcode='23503';end if;
   v_before:=jsonb_build_object('calendar_id',s.id,'selected',s.selected);update public.calendar_sources set selected=(p_input->>'selected')::boolean where user_id=p_user and id=s.id;
   update public.calendar_accounts set revision=revision+1,updated_at=now() where user_id=p_user and id=s.account_id;
   v_after:=jsonb_build_object('calendar_id',s.id,'selected',(p_input->>'selected')::boolean);perform app_private.append_event(p_user,'calendar_source',s.id,'updated','web',v_before,v_after);
  else
   if p_input-array['client_id','event_id','capture_id']<>'{}'::jsonb or not p_input ?& array['event_id','capture_id'] then raise exception 'Invalid event link.' using errcode='22023';end if;
   if exists(select 1 from public.user_entitlements where user_id=p_user and feature_key='capturar' and not allowed) then raise exception 'Capture veto.' using errcode='42501';end if;
   v_event:=(p_input->>'event_id')::uuid;v_capture:=(p_input->>'capture_id')::uuid;
   if not exists(select 1 from public.calendar_events event_row join public.calendar_sources source_row on source_row.user_id=event_row.user_id and source_row.id=event_row.calendar_id join public.calendar_accounts account_row on account_row.user_id=event_row.user_id and account_row.id=event_row.account_id where event_row.user_id=p_user and event_row.id=v_event and source_row.selected and account_row.status='connected') or (v_capture is not null and not exists(select 1 from public.captures where user_id=p_user and id=v_capture and deleted_at is null)) then raise exception 'Owned live link targets required.' using errcode='23503';end if;
   select jsonb_build_object('event_id',id,'linked_capture_id',linked_capture_id) into v_before from public.calendar_events where user_id=p_user and id=v_event;
   update public.calendar_events set linked_capture_id=v_capture,updated_at=now() where user_id=p_user and id=v_event;
   if v_capture is null then delete from app_private.google_event_links where user_id=p_user and (calendar_id,google_id)=(select calendar_id,google_id from public.calendar_events where user_id=p_user and id=v_event);
   else insert into app_private.google_event_links(user_id,calendar_id,google_id,linked_capture_id) select user_id,calendar_id,google_id,v_capture from public.calendar_events where user_id=p_user and id=v_event on conflict(user_id,calendar_id,google_id) do update set linked_capture_id=excluded.linked_capture_id;end if;
   v_after:=jsonb_build_object('event_id',v_event,'linked_capture_id',v_capture);perform app_private.append_event(p_user,'calendar_event',v_event,'updated','web',v_before,v_after);
  end if;
  insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,case when p_command='select' then 'calendar.select' else 'calendar.event.link' end,v_client,p_input,v_after);return v_after;
 elsif p_command='run' then
  if p_input-array['account_id','client_id','window']<>'{}'::jsonb or not p_input ?& array['account_id','client_id','window'] or jsonb_typeof(p_input->'client_id') is distinct from 'string' or char_length(btrim(p_input->>'client_id')) not between 1 and 200 or jsonb_typeof(p_input->'window') is distinct from 'object' or (p_input->'window')-array['start_day','end_day']<>'{}'::jsonb or not (p_input->'window' ?& array['start_day','end_day']) then raise exception 'Invalid sync run.' using errcode='22023';end if;
  v_start:=(p_input->'window'->>'start_day')::date;v_end:=(p_input->'window'->>'end_day')::date;if v_start is null or v_end is null or v_end<=v_start or v_end-v_start>730 then raise exception 'Invalid sync window.' using errcode='22023';end if;
  v_account:=(p_input->>'account_id')::uuid;if v_account is not null and not exists(select 1 from public.calendar_accounts where user_id=p_user and id=v_account and status='connected') then raise exception 'Owned sync account required.' using errcode='23503';end if;
  select * into x from app_private.google_sync_executions where user_id=p_user and client_id=p_input->>'client_id' for update;
  if x.run_id is not null then
   if x.request is distinct from p_input then raise exception 'client_id reused.' using errcode='23505';end if;select * into strict r from public.calendar_sync_runs where user_id=p_user and id=x.run_id;
   if r.status='complete' then return to_jsonb(r);end if;
   if x.execution is not null and x.execution<>p_execution then raise exception 'Sync is already in flight.' using errcode='40001';end if;
   update app_private.google_sync_executions set execution=p_execution where run_id=x.run_id;update public.calendar_sync_runs set status='running',started_at=now(),finished_at=null where user_id=p_user and id=r.id returning * into r;
  else
   perform app_private.calendar_quota(p_user,'sync');insert into public.calendar_sync_runs(user_id,account_id,channel,status) values(p_user,v_account,case when p_cron then 'cron' else 'web' end,'running') returning * into r;
   insert into app_private.google_sync_executions(user_id,run_id,client_id,request,execution) values(p_user,r.id,p_input->>'client_id',p_input,p_execution);
  end if;
  perform app_private.append_event(p_user,'calendar_sync',r.id,'created',r.channel,null,jsonb_build_object('run_id',r.id,'status','running'));return to_jsonb(r);
 elsif p_command='finish_run' then
  if p_input-array['run_id','status','calendar_count','event_count']<>'{}'::jsonb or p_input->>'status' not in ('complete','failed') or p_input->>'status' is null or jsonb_typeof(p_input->'calendar_count') is distinct from 'number' or p_input->>'calendar_count' !~ '^[0-9]{1,6}$' or jsonb_typeof(p_input->'event_count') is distinct from 'number' or p_input->>'event_count' !~ '^[0-9]{1,9}$' then raise exception 'Invalid sync result.' using errcode='22023';end if;
  select * into x from app_private.google_sync_executions where user_id=p_user and run_id=(p_input->>'run_id')::uuid for update;select * into r from public.calendar_sync_runs where user_id=p_user and id=x.run_id;
  if r.id is null or x.execution is distinct from p_execution or r.status<>'running' then raise exception 'Exact running sync execution required.' using errcode='40001';end if;
  update public.calendar_sync_runs set status=p_input->>'status',calendar_count=(p_input->>'calendar_count')::integer,event_count=(p_input->>'event_count')::integer,finished_at=now() where user_id=p_user and id=r.id;
  update app_private.google_sync_executions set execution=null where run_id=r.id;
  perform app_private.append_event(p_user,'calendar_sync',r.id,'status_changed',r.channel,jsonb_build_object('run_id',r.id,'status','running'),jsonb_build_object('run_id',r.id,'status',p_input->>'status','calendar_count',(p_input->>'calendar_count')::integer,'event_count',(p_input->>'event_count')::integer));
  if p_input->>'status'='complete' then insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,'calendar.sync',x.client_id,x.request,jsonb_build_object('run_id',r.id,'status','complete'));end if;return '{}'::jsonb;
 end if;
 raise exception 'Calendar command unavailable.' using errcode='22023';
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception 'Invalid calendar input.' using errcode='22023';
end $$;
create or replace function public.settings_commit(p_user uuid,p_session uuid,p_request jsonb) returns jsonb
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
      or (v_patch ? 'default_calendar_view' and (jsonb_typeof(v_patch->'default_calendar_view') is distinct from 'string' or v_patch->>'default_calendar_view' not in ('day','week','month','list')))
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
commit;
