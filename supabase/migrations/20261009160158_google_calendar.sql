-- T025 read-only Google Calendar. Prepared for later manual application only.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin if current_user<>'postgres' or to_regclass('auth.sessions') is null or to_regclass('public.user_preferences') is null then raise exception 'Review dedicated Auth/identity schema before applying Google Calendar.'; end if; end $$;
create table public.calendar_accounts (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 google_sub text not null check(char_length(google_sub) between 1 and 255),email text not null check(char_length(email) between 1 and 254),scopes text[] not null check(cardinality(scopes) between 1 and 32),
 status text not null default 'connected' check(status in ('connected','reauthorize','revocation_pending')),revision bigint not null default 0 check(revision>=0),credential_version integer not null default 1 check(credential_version>0),
 last_synced_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,id),unique(user_id,google_sub)
);
create table public.calendar_sources (
 id uuid primary key default gen_random_uuid(),user_id uuid not null,account_id uuid not null,google_id text not null check(char_length(google_id) between 1 and 1024),name text not null check(char_length(name)<=255),color_key text not null default 'calendar' check(color_key='calendar'),selected boolean not null default false,
 foreign key(user_id,account_id) references public.calendar_accounts(user_id,id) on delete cascade,unique(user_id,id),unique(user_id,account_id,id),unique(user_id,account_id,google_id)
);
create table public.calendar_events (
 id uuid primary key default gen_random_uuid(),user_id uuid not null,account_id uuid not null,calendar_id uuid not null,google_id text not null check(char_length(google_id) between 1 and 1024),title text not null check(char_length(title)<=1000),starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),all_day boolean not null,
 location text check(char_length(location)<=2000),html_link text check(char_length(html_link)<=4096),reminder_minutes integer check(reminder_minutes between 0 and 40320),linked_capture_id uuid,updated_at timestamptz not null default now(),
 foreign key(user_id,account_id) references public.calendar_accounts(user_id,id) on delete cascade,foreign key(user_id,account_id,calendar_id) references public.calendar_sources(user_id,account_id,id) on delete cascade,
 foreign key(user_id,linked_capture_id) references public.captures(user_id,id) on delete set null (linked_capture_id),unique(user_id,id),unique(user_id,calendar_id,google_id)
);
create index calendar_events_time_idx on public.calendar_events(user_id,starts_at,ends_at);
create table app_private.google_credentials (user_id uuid not null,account_id uuid primary key,envelope jsonb not null,foreign key(user_id,account_id) references public.calendar_accounts(user_id,id) on delete cascade);
create table app_private.google_event_links (user_id uuid not null,calendar_id uuid not null,google_id text not null,linked_capture_id uuid not null,primary key(user_id,calendar_id,google_id),foreign key(user_id,calendar_id) references public.calendar_sources(user_id,id) on delete cascade,foreign key(user_id,linked_capture_id) references public.captures(user_id,id) on delete cascade);
create table app_private.google_calendar_cursors (user_id uuid not null,calendar_id uuid primary key,sync_token text check(char_length(sync_token)<=4096),start_day date,end_day date,check(end_day>start_day),foreign key(user_id,calendar_id) references public.calendar_sources(user_id,id) on delete cascade);
create table app_private.google_oauth_flows (id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,session_id uuid not null,account_id uuid not null,reconnect boolean not null,digest text not null check(digest~'^[a-f0-9]{64}$'),expires_at timestamptz not null,state text not null default 'pending' check(state in ('pending','consumed','complete','failed')),created_at timestamptz not null default now(),unique(user_id,id));
create table app_private.google_calendar_limits (user_id uuid not null references auth.users(id) on delete cascade,scope text not null check(scope in ('api','io','oauth','sync')),hits timestamptz[] not null default '{}',primary key(user_id,scope));
create table public.calendar_sync_runs (id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,account_id uuid,channel text not null check(channel in ('web','cron')),status text not null check(status in ('running','complete','failed')),calendar_count integer not null default 0 check(calendar_count>=0),event_count integer not null default 0 check(event_count>=0),started_at timestamptz not null default now(),finished_at timestamptz,unique(user_id,id));
create table app_private.google_sync_executions (user_id uuid not null,run_id uuid primary key,client_id text not null check(char_length(btrim(client_id)) between 1 and 200),request jsonb not null,execution uuid,foreign key(user_id,run_id) references public.calendar_sync_runs(user_id,id) on delete cascade,unique(user_id,client_id));
do $$ declare t text; begin
 foreach t in array array['calendar_accounts','calendar_sources','calendar_events','calendar_sync_runs'] loop
  execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from public,anon,authenticated,service_role',t); execute format('grant select on public.%I to authenticated',t);
  execute format('create policy own_read on public.%I for select to authenticated using(user_id=auth.uid() and app_private.has_feature(''calendario''))',t);
 end loop;
 foreach t in array array['google_credentials','google_event_links','google_calendar_cursors','google_oauth_flows','google_calendar_limits','google_sync_executions'] loop execute format('alter table app_private.%I enable row level security',t); execute format('revoke all on app_private.%I from public,anon,authenticated,service_role',t); end loop;
end $$;
-- Preserve the existing closed domain union, adding only these four entity types.
do $$ declare c record; begin select conname,pg_get_expr(conbin,conrelid) expression into strict c from pg_constraint where conrelid='public.domain_events'::regclass and contype='c' and conname='domain_events_entity_type_check'; execute format('alter table public.domain_events drop constraint %I',c.conname); execute format('alter table public.domain_events add constraint %I check ((%s) or entity_type in (''calendar_account'',''calendar_source'',''calendar_event'',''calendar_sync''))',c.conname,c.expression); end $$;
create function app_private.calendar_metadata_safe(p jsonb,p_type text,p_id uuid) returns boolean language plpgsql immutable security definer set search_path='' as $$
declare fields text[];id_key text;k text;v jsonb;begin
 if p is null then return true;end if;
 fields:=case p_type when 'calendar_account' then array['account_id','status','operation','calendar_count','credential_version','cache_deleted','revoked'] when 'calendar_source' then array['calendar_id','selected','operation','received_count'] when 'calendar_event' then array['event_id','linked_capture_id'] when 'calendar_sync' then array['run_id','status','calendar_count','event_count'] end;
 id_key:=case p_type when 'calendar_account' then 'account_id' when 'calendar_source' then 'calendar_id' when 'calendar_event' then 'event_id' when 'calendar_sync' then 'run_id' end;
 if fields is null or jsonb_typeof(p) is distinct from 'object' or p-fields<>'{}'::jsonb or p->>id_key is distinct from p_id::text then return false;end if;
 for k,v in select key,value from jsonb_each(p) loop
  if k in ('calendar_count','credential_version','received_count','event_count') and (jsonb_typeof(v) is distinct from 'number' or v#>>'{}' !~ '^[0-9]{1,9}$') then return false;end if;
  if k in ('cache_deleted','revoked','selected') and jsonb_typeof(v) is distinct from 'boolean' then return false;end if;
  if k='linked_capture_id' and v<>'null'::jsonb and (jsonb_typeof(v) is distinct from 'string' or v#>>'{}' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') then return false;end if;
  if k='status' and (jsonb_typeof(v) is distinct from 'string' or v#>>'{}' not in ('connected','reauthorize','revocation_pending','running','complete','failed')) then return false;end if;
  if k='operation' and (jsonb_typeof(v) is distinct from 'string' or v#>>'{}' not in ('oauth_started','oauth_failed','cursor_reset','synced')) then return false;end if;
 end loop;return true;
end $$;
alter table public.domain_events add constraint calendar_metadata_only check(entity_type not in ('calendar_account','calendar_source','calendar_event','calendar_sync') or (app_private.calendar_metadata_safe(before,entity_type,entity_id) and app_private.calendar_metadata_safe(after,entity_type,entity_id)));
-- The owner read policy also applies selection and disconnect/reauthorization fences.
alter policy own_read on public.calendar_events using(user_id=auth.uid() and app_private.has_feature('calendario') and exists(select 1 from public.calendar_sources s join public.calendar_accounts a on a.user_id=s.user_id and a.id=s.account_id where s.user_id=calendar_events.user_id and s.id=calendar_events.calendar_id and s.selected and a.status='connected'));
create function app_private.calendar_actor(p_user uuid,p_session uuid,p_cron boolean) returns void language plpgsql security definer set search_path='' as $$ begin
 perform 1 from auth.users where id=p_user for share;
 if not p_cron then perform 1 from auth.sessions where id=p_session and user_id=p_user for share; end if;
 perform app_private.capture_task_lock(p_user);
 if p_cron then
  if p_session is not null or not exists(select 1 from auth.users u join public.user_moderation m on m.user_id=u.id where u.id=p_user and m.status='active' and not m.must_change_password and not u.is_anonymous and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())) then raise exception 'Cron owner unavailable.' using errcode='42501'; end if;
 else perform app_private.require_actor(p_user,p_session); end if;
 if exists(select 1 from public.user_entitlements where user_id=p_user and feature_key='calendario' and not allowed) then raise exception 'Calendar veto.' using errcode='42501'; end if;
end $$;
create function app_private.calendar_quota(p_user uuid,p_scope text) returns void language plpgsql security definer set search_path='' as $$
declare maximum integer; span interval; kept timestamptz[]; begin
 if p_scope not in ('api','io','oauth','sync') or p_scope is null then raise exception 'Invalid calendar quota.' using errcode='22023'; end if;
 maximum:=case p_scope when 'oauth' then 5 when 'sync' then 6 else 60 end;span:=case when p_scope in ('oauth','sync') then interval '10 minutes' else interval '1 minute' end;
 insert into app_private.google_calendar_limits(user_id,scope) values(p_user,p_scope) on conflict do nothing;
 select coalesce(array_agg(hit order by hit),'{}'::timestamptz[]) into kept from unnest((select hits from app_private.google_calendar_limits where user_id=p_user and scope=p_scope for update)) hit where hit>now()-span;
 if cardinality(kept)>=maximum then raise exception 'Calendar quota reached.' using errcode='PT429'; end if;
 update app_private.google_calendar_limits set hits=array_append(kept,now()) where user_id=p_user and scope=p_scope;
end $$;
create function app_private.calendar_envelope_valid(p jsonb) returns boolean language sql immutable security definer set search_path='' as $$ select coalesce(jsonb_typeof(p)='object' and p ?& array['version','key_id','iv','ciphertext','tag'] and p-array['version','key_id','iv','ciphertext','tag']='{}'::jsonb and p->'version'='1'::jsonb and jsonb_typeof(p->'key_id')='string' and p->>'key_id'~'^[A-Za-z0-9_-]{1,32}$' and jsonb_typeof(p->'iv')='string' and char_length(p->>'iv')=16 and p->>'iv'~'^[A-Za-z0-9+/]+$' and jsonb_typeof(p->'tag')='string' and p->>'tag'~'^[A-Za-z0-9+/]{22}==$' and jsonb_typeof(p->'ciphertext')='string' and char_length(p->>'ciphertext') between 4 and 44000 and p->>'ciphertext'~'^[A-Za-z0-9+/]+={0,2}$',false) $$;
create function app_private.calendar_private_account(p_user uuid,p_account uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.calendar_accounts;c app_private.google_credentials;begin
 select * into a from public.calendar_accounts where user_id=p_user and id=p_account; if a.id is null then raise exception 'Calendar account unavailable.' using errcode='23503'; end if;
 select * into strict c from app_private.google_credentials where user_id=p_user and account_id=p_account;
 return jsonb_build_object('id',a.id,'user_id',a.user_id,'google_sub',a.google_sub,'revision',a.revision::text,'credential_version',a.credential_version,'status',a.status,'tokens',c.envelope,'calendars',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'google_id',s.google_id,'selected',s.selected,'sync_token',cur.sync_token,'window',case when cur.start_day is null then null else jsonb_build_object('start_day',cur.start_day,'end_day',cur.end_day) end) order by s.id) from public.calendar_sources s left join app_private.google_calendar_cursors cur on cur.user_id=s.user_id and cur.calendar_id=s.id where s.user_id=p_user and s.account_id=p_account),'[]'::jsonb));
end $$;
create function app_private.calendar_snapshot(p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_window jsonb;p public.user_preferences;begin
 select * into strict p from public.user_preferences where user_id=p_user;
 if exists(select 1 from public.calendar_sources s join public.calendar_accounts a on a.user_id=s.user_id and a.id=s.account_id left join app_private.google_calendar_cursors c on c.user_id=s.user_id and c.calendar_id=s.id where s.user_id=p_user and s.selected and a.status='connected' and (c.start_day is null or c.sync_token is null)) then v_window:=null;
 else select case when max(c.start_day)<min(c.end_day) then jsonb_build_object('start_day',max(c.start_day),'end_day',min(c.end_day)) else null end into v_window from app_private.google_calendar_cursors c join public.calendar_sources s on s.user_id=c.user_id and s.id=c.calendar_id join public.calendar_accounts a on a.user_id=s.user_id and a.id=s.account_id where s.user_id=p_user and s.selected and a.status='connected'; end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'user_id',e.user_id,'account_id',e.account_id,'calendar_id',e.calendar_id,'title',e.title,'starts_at',e.starts_at,'ends_at',e.ends_at,'location',e.location,'linked_capture_id',case when exists(select 1 from public.captures where user_id=p_user and id=e.linked_capture_id and deleted_at is null) and not exists(select 1 from public.user_entitlements where user_id=p_user and feature_key='capturar' and not allowed) then e.linked_capture_id else null end,'habit_id',null,'all_day',e.all_day,'html_link',e.html_link,'reminder_minutes',e.reminder_minutes) order by e.starts_at,e.id) from public.calendar_events e join public.calendar_sources s on s.user_id=e.user_id and s.id=e.calendar_id join public.calendar_accounts a on a.user_id=e.user_id and a.id=e.account_id where e.user_id=p_user and s.selected and a.status='connected'),'[]'::jsonb),
 'calendars',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'user_id',s.user_id,'account_id',s.account_id,'name',s.name,'color_key',s.color_key,'selected',s.selected) order by s.name,s.id) from public.calendar_sources s join public.calendar_accounts a on a.user_id=s.user_id and a.id=s.account_id where s.user_id=p_user and a.status<>'revocation_pending'),'[]'::jsonb),
 'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'email',email,'scopes',scopes,'status',status,'last_synced_at',last_synced_at) order by created_at,id) from public.calendar_accounts where user_id=p_user),'[]'::jsonb),
 'sync_runs',coalesce((select jsonb_agg(to_jsonb(r) order by r.started_at desc,r.id desc) from (select id,user_id,account_id,channel,status,calendar_count,event_count,started_at,finished_at from public.calendar_sync_runs where user_id=p_user order by started_at desc,id desc limit 30) r),'[]'::jsonb),
 'window',v_window,'preferences',jsonb_build_object('default_calendar_view',p.default_calendar_view,'meeting_reminders_enabled',p.meeting_reminders_enabled,'meeting_reminder_minutes',p.meeting_reminder_minutes));
end $$;
alter table app_private.google_credentials add constraint google_credentials_envelope_check check(app_private.calendar_envelope_valid(envelope));
create function app_private.google_calendar_jobs() returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if (select count(*) from public.calendar_accounts where status='connected')>200 then raise exception 'Review bounded daily sync capacity.' using errcode='PT429';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',a.user_id,'account_id',a.id) order by a.user_id,a.id) from public.calendar_accounts a join auth.users u on u.id=a.user_id join public.user_moderation m on m.user_id=u.id where a.status='connected' and m.status='active' and not m.must_change_password and not u.is_anonymous and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()) and not exists(select 1 from public.user_entitlements where user_id=a.user_id and feature_key='calendario' and not allowed)),'[]'::jsonb);
end $$;
create function app_private.google_calendar_admin_runs(p_actor uuid,p_session uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 perform app_private.admin_require_master(p_actor,p_session);
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.started_at desc,r.id desc) from (select id,user_id,account_id,channel,status,calendar_count,event_count,started_at,finished_at from public.calendar_sync_runs order by started_at desc,id desc limit 100) r),'[]'::jsonb);
end $$;
create function app_private.google_calendar_call(p_user uuid,p_session uuid,p_command text,p_input jsonb,p_cron boolean,p_execution uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
   if jsonb_typeof(item) is distinct from 'object' or item-array['google_id','cancelled','title','starts_at','ends_at','all_day','location','html_link','reminder_minutes']<>'{}'::jsonb or not item ?& array['google_id','cancelled','title','starts_at','ends_at','all_day','location','html_link','reminder_minutes'] or jsonb_typeof(item->'google_id') is distinct from 'string' or char_length(item->>'google_id') not between 1 and 1024 or jsonb_typeof(item->'cancelled') is distinct from 'boolean' then raise exception 'Invalid Google event.' using errcode='22023';end if;
   if item->'cancelled'='true'::jsonb then delete from public.calendar_events where user_id=p_user and calendar_id=s.id and google_id=item->>'google_id';delete from app_private.google_event_links where user_id=p_user and calendar_id=s.id and google_id=item->>'google_id';continue;end if;
   if jsonb_typeof(item->'title') is distinct from 'string' or char_length(item->>'title')>1000 or jsonb_typeof(item->'starts_at') is distinct from 'string' or jsonb_typeof(item->'ends_at') is distinct from 'string' or (item->>'ends_at')::timestamptz<=(item->>'starts_at')::timestamptz or jsonb_typeof(item->'all_day') is distinct from 'boolean' or (item->'location'<>'null'::jsonb and (jsonb_typeof(item->'location') is distinct from 'string' or char_length(item->>'location')>2000)) or (item->'html_link'<>'null'::jsonb and (jsonb_typeof(item->'html_link') is distinct from 'string' or char_length(item->>'html_link')>4096 or item->>'html_link' !~ '^https://(www\.google\.com|calendar\.google\.com)/calendar/event/?(\?|$)')) or (item->'reminder_minutes'<>'null'::jsonb and (jsonb_typeof(item->'reminder_minutes') is distinct from 'number' or item->>'reminder_minutes' !~ '^[0-9]{1,5}$' or (item->>'reminder_minutes')::integer>40320)) then raise exception 'Invalid Google event fields.' using errcode='22023';end if;
   if (item->>'starts_at')::timestamptz>=v_end::timestamp at time zone 'America/Sao_Paulo' or (item->>'ends_at')::timestamptz<=v_start::timestamp at time zone 'America/Sao_Paulo' then delete from public.calendar_events where user_id=p_user and calendar_id=s.id and google_id=item->>'google_id';continue;end if;
   insert into public.calendar_events(id,user_id,account_id,calendar_id,google_id,title,starts_at,ends_at,all_day,location,html_link,reminder_minutes,linked_capture_id) values(substr(encode(sha256(convert_to(p_user::text||':'||s.id::text||':'||(item->>'google_id'),'UTF8')),'hex'),1,32)::uuid,p_user,a.id,s.id,item->>'google_id',item->>'title',(item->>'starts_at')::timestamptz,(item->>'ends_at')::timestamptz,(item->>'all_day')::boolean,item->>'location',item->>'html_link',(item->>'reminder_minutes')::integer,(select linked_capture_id from app_private.google_event_links where user_id=p_user and calendar_id=s.id and google_id=item->>'google_id')) on conflict(user_id,calendar_id,google_id) do update set title=excluded.title,starts_at=excluded.starts_at,ends_at=excluded.ends_at,all_day=excluded.all_day,location=excluded.location,html_link=excluded.html_link,reminder_minutes=excluded.reminder_minutes,updated_at=now();
  end loop;
  insert into app_private.google_calendar_cursors(user_id,calendar_id,sync_token,start_day,end_day) values(p_user,s.id,p_input->>'sync_token',v_start,v_end) on conflict(calendar_id) do update set sync_token=excluded.sync_token,start_day=excluded.start_day,end_day=excluded.end_day;
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
create function public.google_calendar_call(p_user uuid,p_session uuid,p_command text,p_input jsonb,p_cron boolean,p_execution uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.google_calendar_call(p_user,p_session,p_command,p_input,p_cron,p_execution) $$;
create function public.google_calendar_jobs() returns jsonb language sql security invoker set search_path='' as $$ select app_private.google_calendar_jobs() $$;
create function public.google_calendar_admin_runs(p_actor uuid,p_session uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.google_calendar_admin_runs(p_actor,p_session) $$;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and (p.proname like 'calendar_%' or p.proname like 'google_calendar_%') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.proname in ('google_calendar_call','google_calendar_jobs','google_calendar_admin_runs') then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end $$;
comment on table app_private.google_credentials is 'AES-256-GCM envelope bound by AAD to owner/account/credential-version/key-id; no direct reads/grants.';
comment on table app_private.google_oauth_flows is 'Ten-minute session-bound single-consume OAuth state digests; no code, verifier or tokens.';
comment on table public.calendar_sync_runs is 'Metadata only: ids, source channel, status, counts and timings; never event content, e-mail or tokens.';
commit;
