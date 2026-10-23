-- DRAFT, INERT. Root must review/promote through the migration workflow.
-- Not a migration. Never run from CI/build/deploy. No seeds/backfill/reset.
begin;
do $draft_only$ begin raise exception 'DRAFT_ONLY: onboarding foundation requires review and migration promotion.'; end $draft_only$;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Private extensions preserve the exact, already consumed v1 profile/project DTOs.
create table app_private.profile_focus (
 user_id uuid primary key references public.profiles(user_id) on delete cascade,
 focus text check(focus in ('work','study','personal','mixed')), revision bigint not null default 0 check(revision>=0)
);
create table app_private.project_contexts (
 user_id uuid not null,project_id uuid primary key,context text check(context in ('personal','work','study')),
 revision bigint not null default 0 check(revision>=0),
 foreign key(user_id,project_id) references public.projects(user_id,id) on delete cascade
);
create table app_private.onboarding_entries (
 user_id uuid primary key references auth.users(id) on delete cascade,
 source_operation uuid not null unique references app_private.admin_operations(operation_id),
 offer_pending boolean not null default true,created_at timestamptz not null default now()
);
create table app_private.onboarding_rounds (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 revision bigint not null default 0 check(revision>=0),generation uuid not null default gen_random_uuid(),
 schema_version integer not null default 1 check(schema_version=1),
 status text not null check(status in ('active','paused','executing','partial','complete','expired')),
 step text not null check(step in ('welcome','profile','calendar','habits','projects','tasks','notes','spaces','summary')),
 draft jsonb,profile_revision text not null,created_at timestamptz not null default now(),
 edited_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '720 hours',
 unique(user_id,id),check(draft is null or jsonb_typeof(draft)='object' and octet_length(draft::text)<=98304),
 check(status not in ('active','paused') or draft is not null)
);
create unique index onboarding_one_open on app_private.onboarding_rounds(user_id) where status in ('active','paused','executing','partial');
create index onboarding_latest on app_private.onboarding_rounds(user_id,created_at desc,id desc);
create index onboarding_expiry on app_private.onboarding_rounds(expires_at) where status<>'expired';
create table app_private.onboarding_intents (
 id uuid primary key default gen_random_uuid(),user_id uuid not null,round_id uuid not null,
 slot text not null,item_key uuid not null,kind text not null check(kind in ('profile','habit','project','task','notebook','page','link')),
 command text not null check(command in ('settings.profile.v2.update','habit.create','project.create','task.create','knowledge.notebook.create','knowledge.page.create','knowledge.link.create')),
 input jsonb,bound_input jsonb,bindings jsonb not null,extras jsonb not null default '{}',ordinal smallint not null check(ordinal between 0 and 20),
 expected_fingerprint text,choice jsonb,intent_version integer not null default 1 check(intent_version between 1 and 2147483647),active boolean not null default true,dependency_slots text[] not null default '{}',
 status text not null default 'ready' check(status in ('ready','pending','confirmed','blocked','failed','unknown','omitted','not_committed')),
 entity_id uuid,reason text check(reason in ('validation','dependency','forbidden','conflict','commit_unknown','unavailable')),
 foreign key(user_id,round_id) references app_private.onboarding_rounds(user_id,id) on delete cascade,
 unique(user_id,round_id,slot,intent_version),
 check((status='confirmed')=(entity_id is not null)),check(status<>'not_committed' or not active),check(status<>'omitted' or reason is null),check(slot=kind||':'||item_key::text),
 check(jsonb_typeof(bindings)='array' and jsonb_array_length(bindings)<=2),
 check(jsonb_typeof(extras)='object' and extras-array['context']='{}'::jsonb)
);
create unique index onboarding_active_slot on app_private.onboarding_intents(user_id,round_id,slot) where active;
create unique index onboarding_active_ordinal on app_private.onboarding_intents(user_id,round_id,ordinal) where active;
create index onboarding_pending on app_private.onboarding_intents(user_id,round_id,ordinal) where active and status not in ('confirmed','omitted');
-- Minimal operation receipts contain only a commitment and round/revision, not drafts.
create table app_private.onboarding_commands (
 user_id uuid not null references auth.users(id) on delete cascade,command text not null,client_id text not null,
 commitment text not null check(commitment~'^[a-f0-9]{64}$'),round_id uuid not null,created_at timestamptz not null default now(),
 primary key(user_id,command,client_id),foreign key(user_id,round_id) references app_private.onboarding_rounds(user_id,id) on delete cascade
);
create table app_private.onboarding_oauth (
 flow_id uuid primary key references app_private.google_oauth_flows(id) on delete cascade,
 user_id uuid not null,session_id uuid not null,round_id uuid not null,generation uuid not null,expires_at timestamptz not null,
 consumed_at timestamptz,connect_fingerprint text check(connect_fingerprint is null or connect_fingerprint~'^[a-f0-9]{64}$'),connected_at timestamptz,permit_backend_pid integer,permit_xact_id xid8,check((permit_backend_pid is null)=(permit_xact_id is null)),foreign key(user_id,round_id) references app_private.onboarding_rounds(user_id,id) on delete cascade
);
-- Uncommitted, transaction-bound permits are never a client credential.
create table app_private.onboarding_write_permits (
 user_id uuid not null,session_id uuid not null,round_id uuid not null,generation uuid not null,
 intent_id uuid primary key,intent_version integer not null,command text not null,client_id text not null,
 fingerprint text not null check(fingerprint~'^[a-f0-9]{64}$'),backend_pid integer not null,xact_id xid8 not null,
 foreign key(user_id,round_id) references app_private.onboarding_rounds(user_id,id) on delete cascade,
 foreign key(intent_id) references app_private.onboarding_intents(id) on delete cascade
);
create function app_private.onboarding_permit_must_be_gone() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if exists(select 1 from app_private.onboarding_write_permits where intent_id=new.intent_id) then
  raise exception 'Residual onboarding permit.' using errcode='23514';end if;return null;
end $$;
create constraint trigger onboarding_permit_zero after insert or update on app_private.onboarding_write_permits
 deferrable initially deferred for each row execute function app_private.onboarding_permit_must_be_gone();
do $$ declare t text; begin
 foreach t in array array['profile_focus','project_contexts','onboarding_entries','onboarding_rounds','onboarding_intents','onboarding_commands','onboarding_oauth','onboarding_write_permits'] loop
  execute format('alter table app_private.%I enable row level security',t);
  execute format('revoke all on app_private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;
-- Preserve all existing event kinds, including extensions 020-025.
do $$ declare expression text; begin
 select pg_get_expr(conbin,conrelid) into strict expression from pg_constraint
 where conrelid='public.domain_events'::regclass and conname='domain_events_entity_type_check';
 alter table public.domain_events drop constraint domain_events_entity_type_check;
 execute format('alter table public.domain_events add constraint domain_events_entity_type_check check ((%s) or entity_type in (''onboarding_round'',''onboarding_entry'',''profile_focus'',''project_context''))',expression);
end $$;

create function app_private.onboarding_require(p_user uuid,p_session uuid,p_feature text default 'configuracoes') returns void
language plpgsql security definer set search_path='' as $$ begin
 perform 1 from auth.users where id=p_user for share;
 perform 1 from auth.sessions where id=p_session and user_id=p_user for share;
 perform app_private.capture_task_lock(p_user);
 perform app_private.require_actor(p_user,p_session);
 if exists(select 1 from public.user_entitlements where user_id=p_user and feature_key=p_feature and not allowed) then
  raise exception 'Feature unavailable.' using errcode='42501';
 end if;
end $$;
create function app_private.onboarding_profile(p_user uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('displayName',p.display_name,'focus',f.focus,'revision',
  encode(sha256(convert_to(jsonb_build_array(p.display_name,p.updated_at,coalesce(f.revision,0),f.focus)::text,'UTF8')),'hex'))
 from public.profiles p left join app_private.profile_focus f using(user_id) where p.user_id=p_user;
$$;
create function app_private.onboarding_event(p_user uuid,p_round uuid) returns void language sql security definer set search_path='' as $$
 select app_private.append_event(p_user,'onboarding_round',p_round,'updated','web',null,
  jsonb_build_object('id',r.id,'user_id',p_user,'status',r.status,'step',r.step,'revision',r.revision::text,
   'counts',coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from app_private.onboarding_intents where user_id=p_user and round_id=p_round and active group by status) counts),'{}')))
 from app_private.onboarding_rounds r where r.user_id=p_user and r.id=p_round;
$$;
-- No age/created_at/absence heuristic. The verified Admin saga supplies the cohort.
create function app_private.onboarding_enroll_admin() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.command='admin.user.create' and new.phase='complete' and old.phase<>'complete' then
  if not exists(select 1 from auth.users where id=new.target_user_id and raw_app_meta_data->>'sc_admin_operation'=new.operation_id::text)
   then raise exception 'Unverified onboarding enrollment.' using errcode='23514'; end if;
  insert into app_private.onboarding_entries(user_id,source_operation) values(new.target_user_id,new.operation_id) on conflict(user_id) do nothing;
  if found then perform app_private.append_event(new.target_user_id,'onboarding_entry',new.target_user_id,'created','api',null,
   jsonb_build_object('user_id',new.target_user_id,'eligibility','new_explicit','schema_version',1)); end if;
 end if;return new;
end $$;
create trigger onboarding_verified_admin_completion after update of phase on app_private.admin_operations
for each row execute function app_private.onboarding_enroll_admin();

-- One receipt lookup; caller already holds common advisory -> round -> intent.
create function app_private.onboarding_reconcile(p_user uuid,p_intent uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare i app_private.onboarding_intents;rec app_private.command_receipts;expected text;begin
 select * into strict i from app_private.onboarding_intents where user_id=p_user and id=p_intent for update;
 if i.status='confirmed' then return true;end if;
 select * into rec from app_private.command_receipts where user_id=p_user and command=i.command
  and client_id='onb:'||i.round_id::text||':'||i.slot||':v'||i.intent_version::text for update;
 if not found then return false;end if;
 expected:=case when i.command like 'knowledge.%' then rec.request->'receipt'->>'fingerprint'
  when i.kind='profile' then rec.request#>>'{}' else encode(sha256(convert_to(rec.request#>>'{}','UTF8')),'hex') end;
 if i.expected_fingerprint is null or expected is distinct from i.expected_fingerprint or rec.result->>'user_id' is distinct from p_user::text
  or rec.result->>'id' is null then raise exception 'Unbound onboarding receipt.' using errcode='23514';end if;
 update app_private.onboarding_intents set status='confirmed',entity_id=(rec.result->>'id')::uuid,reason=null,
  input=null,bound_input=null,bindings='[]',extras='{}',choice=null where id=i.id;
 return true;
end $$;
create function app_private.onboarding_dependents(p_user uuid,p_round uuid,p_slot text) returns uuid[]
language sql stable security definer set search_path='' as $$
 with recursive descendants as (
  select i.id,i.slot from app_private.onboarding_intents i where i.user_id=p_user and i.round_id=p_round and i.active and p_slot=any(i.dependency_slots)
  union select i.id,i.slot from app_private.onboarding_intents i join descendants d on d.slot=any(i.dependency_slots)
   where i.user_id=p_user and i.round_id=p_round and i.active
 ) select coalesce(array_agg(id order by id),'{}') from descendants;
$$;
create function app_private.onboarding_recovery(p_user uuid,p_round uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('intentId',i.id,'itemKey',i.item_key,'kind',i.kind,'status',i.status,'choice',i.choice,
  'canReplace',i.choice is not null and not exists(select 1 from app_private.onboarding_intents d where d.id=any(app_private.onboarding_dependents(p_user,p_round,i.slot)) and d.status='confirmed'),'canOmit',not exists(select 1 from app_private.onboarding_intents d
   where d.id=any(app_private.onboarding_dependents(p_user,p_round,i.slot)) and d.status='confirmed'),
  'dependentIntentIds',coalesce((select jsonb_agg(d.id order by d.id) from app_private.onboarding_intents d
   where d.id=any(app_private.onboarding_dependents(p_user,p_round,i.slot)) and d.status not in ('confirmed','omitted')),'[]')) order by i.ordinal),'[]')
 from app_private.onboarding_intents i join app_private.onboarding_rounds r on r.id=i.round_id and r.user_id=i.user_id
 where i.user_id=p_user and i.round_id=p_round and i.active and i.status not in ('confirmed','omitted') and r.status in ('executing','partial');
$$;
create function app_private.onboarding_oauth_permit_zero() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if exists(select 1 from app_private.onboarding_oauth where flow_id=new.flow_id and (permit_backend_pid is not null or permit_xact_id is not null))
  then raise exception 'Residual onboarding OAuth permit.' using errcode='23514';end if;return null;
end $$;
create constraint trigger onboarding_oauth_permit_zero after update on app_private.onboarding_oauth
 deferrable initially deferred for each row execute function app_private.onboarding_oauth_permit_zero();
create function app_private.onboarding_oauth_reserved_guard(p_user uuid,p_session uuid,p_command text,p_input jsonb) returns void
language plpgsql security definer set search_path='' as $$ begin
 if p_command<>'connect' then return;end if;
 if not exists(select 1 from app_private.onboarding_oauth where flow_id=(p_input->>'flow_id')::uuid) then return;end if;
 if not exists(select 1 from app_private.onboarding_oauth o join app_private.onboarding_rounds r on r.id=o.round_id and r.user_id=o.user_id
  where o.flow_id=(p_input->>'flow_id')::uuid and o.user_id=p_user and o.session_id=p_session and o.generation=r.generation
   and o.permit_backend_pid=pg_backend_pid() and o.permit_xact_id=pg_current_xact_id()
   and o.consumed_at is not null and o.expires_at>clock_timestamp() and r.expires_at>clock_timestamp() and r.status in ('active','paused'))
  then raise exception 'Onboarding OAuth version revoked.' using errcode='42501';end if;
end $$;
-- Reserved namespace guard injected into the existing module commits BEFORE replay.
-- No round/receipt locks here: caller's wrapper already holds the common order.
create function app_private.onboarding_reserved_guard(p_user uuid,p_session uuid,p_command text,p_request jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare cid text;fp text;consumed uuid;begin
 cid:=p_request->'receipt'->>'client_id';if left(cid,4) is distinct from 'onb:' then return;end if;
 fp:=case when p_command like 'knowledge.%' then p_request->'receipt'->>'fingerprint'
  else encode(sha256(convert_to(p_request->'receipt'->>'fingerprint','UTF8')),'hex') end;
 delete from app_private.onboarding_write_permits p using app_private.onboarding_intents i,app_private.onboarding_rounds r
 where i.id=p.intent_id and r.id=i.round_id and r.user_id=i.user_id
  and p.user_id=p_user and p.session_id=p_session and p.command=p_command and p.client_id=cid and p.fingerprint=fp
   and p.backend_pid=pg_backend_pid() and p.xact_id=pg_current_xact_id() and p.intent_version=i.intent_version
   and p.generation=r.generation and i.active and i.status not in ('confirmed','omitted','not_committed')
   and r.status in ('executing','partial') and r.expires_at>clock_timestamp() returning p.intent_id into consumed;
 if not found or consumed is null then raise exception 'Reserved onboarding command denied.' using errcode='42501';end if;
end $$;
create function app_private.onboarding_settings_reserved_guard(p_request jsonb) returns void
language plpgsql security definer set search_path='' as $$ begin
 if left(p_request->'input'->>'client_id',4)='onb:' then raise exception 'Reserved onboarding command denied.' using errcode='42501';end if;
end $$;
-- This seals all versions before scrubbing. A formerly pending/unknown version
-- cannot acquire a permit later; minimal proof/IDs remain, never the content.
create function app_private.onboarding_expire_round(p_user uuid,p_round uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare r app_private.onboarding_rounds;i app_private.onboarding_intents;begin
 select * into r from app_private.onboarding_rounds where user_id=p_user and id=p_round for update;
 if not found or r.status='expired' or r.expires_at>clock_timestamp() then return false;end if;
 for i in select * from app_private.onboarding_intents where user_id=p_user and round_id=r.id order by ordinal,intent_version,id for update loop
  if i.status not in ('confirmed','omitted','not_committed') then perform app_private.onboarding_reconcile(p_user,i.id);end if;
 end loop;
 if exists(select 1 from app_private.onboarding_write_permits where user_id=p_user and round_id=r.id) then
  raise exception 'Residual onboarding permit.' using errcode='23514';end if;
 update app_private.onboarding_rounds set status='expired',draft=null,generation=gen_random_uuid(),revision=revision+1 where id=r.id;
 update app_private.onboarding_intents set status=case when status in ('confirmed','omitted','not_committed') then status else 'blocked' end,
  reason=case when status in ('confirmed','omitted','not_committed') then reason else 'unavailable' end,
  input=null,bound_input=null,bindings='[]',extras='{}',choice=null where user_id=p_user and round_id=r.id;
 -- Invalidating continuation never disconnects an already connected account.
 update app_private.onboarding_oauth set consumed_at=coalesce(consumed_at,clock_timestamp()) where user_id=p_user and round_id=r.id;
 perform app_private.onboarding_event(p_user,r.id);return true;
end $$;
create function app_private.onboarding_expire(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare r record;begin
 for r in select id from app_private.onboarding_rounds where user_id=p_user and expires_at<=clock_timestamp() and status<>'expired' order by id loop
  perform app_private.onboarding_expire_round(p_user,r.id);
 end loop;
end $$;
create function app_private.onboarding_snapshot(p_user uuid,p_session uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;cap jsonb;cal boolean;begin
 perform app_private.onboarding_require(p_user,p_session);perform app_private.onboarding_expire(p_user);
 select jsonb_object_agg(k,not exists(select 1 from public.user_entitlements where user_id=p_user and feature_key=k and not allowed)) into cap
 from unnest(array['configuracoes','calendario','habitos','projetos','tarefas','conhecimento','financeiro','cofre']) k;
 cal:=(cap->>'calendario')::boolean;
 select jsonb_build_object('id',x.id,'revision',x.revision::text,'status',x.status,'step',x.step,'draft',x.draft,
  'editedAt',x.edited_at,'expiresAt',x.expires_at,'receipts',coalesce((select jsonb_agg(jsonb_build_object(
   'intentId',i.id,'itemKey',i.item_key,'kind',i.kind,'status',i.status,'entityId',i.entity_id,'reason',i.reason) order by i.ordinal)
   from app_private.onboarding_intents i where i.user_id=p_user and i.round_id=x.id and i.active),'[]')) into r
 from app_private.onboarding_rounds x where x.user_id=p_user order by x.created_at desc,x.id desc limit 1;
 return jsonb_build_object('schemaVersion',1,'ownerId',p_user,'today',(clock_timestamp() at time zone 'America/Sao_Paulo')::date::text,'timeZone','America/Sao_Paulo',
 'eligibility',jsonb_build_object('kind',case when exists(select 1 from app_private.onboarding_entries where user_id=p_user) then 'new_explicit' else 'existing_opt_in' end,
  'canStart',true,'offerPending',exists(select 1 from app_private.onboarding_entries where user_id=p_user and offer_pending),'reason',null),
 'capabilities',cap,'profile',app_private.onboarding_profile(p_user),'round',r,'recovery',app_private.onboarding_recovery(p_user,(r->>'id')::uuid),
 'calendar',jsonb_build_object('status',case when cal then 'ready' else 'forbidden' end,'canConnect',cal and
   (select count(*) from public.calendar_accounts where user_id=p_user)+
   (select count(*) from app_private.google_oauth_flows where user_id=p_user and not reconnect and state in ('pending','consumed') and expires_at>clock_timestamp())<2,
 'accounts',case when cal then coalesce((select jsonb_agg(jsonb_build_object('id',id,'email',email,'status',status) order by id) from public.calendar_accounts where user_id=p_user),'[]') else '[]' end,
 'sources',case when cal then coalesce((select jsonb_agg(jsonb_build_object('id',id,'accountId',account_id,'name',name,'selected',selected) order by id) from public.calendar_sources where user_id=p_user),'[]') else '[]' end));
end $$;

create function app_private.onboarding_project_attributes(p_user uuid,p_project uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('projectId',p.id,'context',c.context,'revision',
  encode(sha256(convert_to(jsonb_build_array(p.updated_at,coalesce(c.revision,0),c.context)::text,'UTF8')),'hex'))
 from public.projects p left join app_private.project_contexts c on c.user_id=p.user_id and c.project_id=p.id
 where p.user_id=p_user and p.id=p_project and p.deleted_at is null;
$$;
-- Separate v2 attributes API. Does not change the v1 module snapshots/commands.
create function app_private.onboarding_attributes(p_user uuid,p_session uuid,p_write boolean,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare k text;cmd text;target uuid;before_state jsonb;after_state jsonb;patch jsonb;result jsonb;begin
 perform app_private.onboarding_require(p_user,p_session);k:=p_request->>'kind';
 if k='project' then perform app_private.onboarding_require(p_user,p_session,'projetos');target:=(p_request->>'projectId')::uuid;
 elsif k='profile' then target:=p_user;else raise exception 'Invalid attribute kind.' using errcode='22023';end if;
 result:=case k when 'profile' then app_private.onboarding_profile(p_user) else app_private.onboarding_project_attributes(p_user,target) end;
 if result is null then raise exception 'Attribute target unavailable.' using errcode='42501';end if;
 if not p_write then
  if p_request-case k when 'profile' then array['kind'] else array['kind','projectId'] end<>'{}' then raise exception 'Invalid attribute read.' using errcode='22023';end if;return result;
 end if;
 if p_request-case k when 'profile' then array['kind','clientId','expectedRevision','patch'] else array['kind','projectId','clientId','expectedRevision','context'] end<>'{}'
  or jsonb_typeof(p_request->'clientId') is distinct from 'string' or char_length(btrim(p_request->>'clientId')) not between 1 and 200
  or left(p_request->>'clientId',4)='onb:' or jsonb_typeof(p_request->'expectedRevision') is distinct from 'string' then raise exception 'Invalid attributes.' using errcode='22023';end if;
 cmd:=case k when 'profile' then 'settings.attributes.v2.update' else 'project.context.v2.update' end;
 after_state:=app_private.command_replay(p_user,cmd,p_request->>'clientId',p_request);if after_state is not null then return after_state;end if;
 if result->>'revision' is distinct from p_request->>'expectedRevision' then raise exception 'Attributes changed.' using errcode='40001';end if;
 if not (app_private.consume_rate_limit_at('identity_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null)->>'allowed')::boolean then raise exception 'Write limit reached.' using errcode='PT429';end if;
 if k='profile' then
  patch:=p_request->'patch';
  if jsonb_typeof(patch) is distinct from 'object' or patch='{}' or patch-array['displayName','focus']<>'{}'
   or patch ? 'displayName' and (jsonb_typeof(patch->'displayName') is distinct from 'string' or char_length(btrim(patch->>'displayName')) not between 1 and 120)
   or patch ? 'focus' and (patch->'focus'<>'null' and (jsonb_typeof(patch->'focus') is distinct from 'string' or patch->>'focus' not in ('work','study','personal','mixed')))
   then raise exception 'Invalid profile attributes.' using errcode='22023';end if;
  if patch ? 'displayName' then
   select to_jsonb(p.*) into before_state from public.profiles p where user_id=p_user;
   update public.profiles set display_name=btrim(patch->>'displayName'),updated_at=now() where user_id=p_user returning to_jsonb(profiles.*) into after_state;
   perform app_private.append_event(p_user,'profile',p_user,'updated','web',before_state,after_state);
  end if;
  if patch ? 'focus' then
   select jsonb_build_object('id',user_id,'user_id',user_id,'focus',focus) into before_state from app_private.profile_focus where user_id=p_user;
   insert into app_private.profile_focus(user_id,focus) values(p_user,patch->>'focus') on conflict(user_id) do update set focus=excluded.focus,revision=profile_focus.revision+1;
   perform app_private.append_event(p_user,'profile_focus',p_user,case when before_state is null then 'created' else 'updated' end,'web',before_state,jsonb_build_object('id',p_user,'user_id',p_user,'focus',patch->>'focus'));
  end if;
  result:=app_private.onboarding_profile(p_user);
 else
  if not p_request ? 'context' or p_request->'context'<>'null' and (jsonb_typeof(p_request->'context') is distinct from 'string' or p_request->>'context' not in ('personal','work','study')) then raise exception 'Invalid project context.' using errcode='22023';end if;
  select jsonb_build_object('id',project_id,'user_id',user_id,'context',context) into before_state from app_private.project_contexts where user_id=p_user and project_id=target;
  insert into app_private.project_contexts(user_id,project_id,context) values(p_user,target,p_request->>'context') on conflict(project_id) do update set context=excluded.context,revision=project_contexts.revision+1;
  perform app_private.append_event(p_user,'project_context',target,case when before_state is null then 'created' else 'updated' end,'web',before_state,jsonb_build_object('id',target,'user_id',p_user,'context',p_request->'context'));
  result:=app_private.onboarding_project_attributes(p_user,target);
 end if;
 insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,cmd,p_request->>'clientId',p_request,result);
 return result;
end $$;

create function app_private.onboarding_fence(p_user uuid,p_round uuid,p_intent uuid,p_request jsonb) returns void
language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from app_private.onboarding_rounds r join app_private.onboarding_intents i on i.round_id=r.id and i.user_id=r.user_id
  where r.user_id=p_user and r.id=p_round and i.id=p_intent and i.active and i.status not in ('confirmed','omitted','not_committed')
   and r.status in ('executing','partial') and r.expires_at>clock_timestamp()
   and r.generation::text is not distinct from p_request->>'roundGeneration'
   and i.intent_version::text is not distinct from p_request->>'intentVersion')
  then raise exception 'Onboarding version revoked.' using errcode='40001';end if;
end $$;
create function app_private.onboarding_progress(p_user uuid,p_round uuid) returns void
language plpgsql security definer set search_path='' as $$
declare next_status text;begin
 if exists(select 1 from app_private.onboarding_rounds where user_id=p_user and id=p_round and status='expired') then return;end if;
 next_status:=case when not exists(select 1 from app_private.onboarding_intents where user_id=p_user and round_id=p_round and active and status not in ('confirmed','omitted')) then 'complete'
  when exists(select 1 from app_private.onboarding_intents where user_id=p_user and round_id=p_round and active and status in ('failed','blocked','unknown')) then 'partial' else 'executing' end;
 update app_private.onboarding_rounds set status=next_status,revision=revision+1,step='summary',
  draft=case when next_status='complete' then null else draft end,
  generation=case when next_status='complete' then gen_random_uuid() else generation end where user_id=p_user and id=p_round;
 perform app_private.onboarding_event(p_user,p_round);
end $$;
-- Caller holds authorization/session/common advisory before any row below.
create function app_private.onboarding_amend_call(p_user uuid,p_context boolean,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r app_private.onboarding_rounds;i app_private.onboarding_intents;d app_private.onboarding_intents;
 oldcmd app_private.onboarding_commands;commitment text;deps uuid[];selected uuid[];requested uuid[];v jsonb;kind text;new_version integer;changed boolean:=false;begin
 select * into strict r from app_private.onboarding_rounds where user_id=p_user and id=(p_request->>'roundId')::uuid for update;
 commitment:=encode(sha256(convert_to((p_request-'plan')::text,'UTF8')),'hex');
 select * into oldcmd from app_private.onboarding_commands where user_id=p_user and command='amend' and client_id=p_request->>'clientId';
 if found then
  if oldcmd.round_id<>r.id or oldcmd.commitment<>commitment then raise exception 'Amendment changed.' using errcode='23505';end if;
  return jsonb_build_object('roundId',r.id,'prepared',true);
 end if;
 if p_request-array['roundId','expectedRevision','clientId','intentId','change','plan']<>'{}' or char_length(p_request->>'clientId') not between 1 and 200
  or r.revision::text is distinct from p_request->>'expectedRevision' or r.status not in ('executing','partial') or r.expires_at<=clock_timestamp()
  then raise exception 'Round changed.' using errcode='40001';end if;
 -- All potential dependency locks have the same order as expiry; no receipt first.
 perform 1 from app_private.onboarding_intents where user_id=p_user and round_id=r.id order by ordinal,intent_version,id for update;
 select * into strict i from app_private.onboarding_intents where user_id=p_user and round_id=r.id and id=(p_request->>'intentId')::uuid and active;
 if i.status in ('confirmed','omitted') then return jsonb_build_object('roundId',r.id,'prepared',true);end if;
 if p_context then return jsonb_build_object('roundId',r.id,'itemKey',i.item_key,'nextVersion',i.intent_version+1);end if;
 if not (app_private.consume_rate_limit_at('identity_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null)->>'allowed')::boolean then raise exception 'Write limit reached.' using errcode='PT429';end if;
 -- A compatible real receipt always wins. Never "undo" a completed effect.
 if app_private.onboarding_reconcile(p_user,i.id) then changed:=true;
 else
  deps:=app_private.onboarding_dependents(p_user,r.id,i.slot);
  for d in select * from app_private.onboarding_intents where id=any(deps) order by ordinal,intent_version,id loop
   if d.status not in ('confirmed','omitted') and app_private.onboarding_reconcile(p_user,d.id) then changed:=true;end if;
  end loop;
  if exists(select 1 from app_private.onboarding_intents where id=any(deps) and status='confirmed') then
   -- A dependent completed while the caller was reviewing; report that reality.
   changed:=true;
  else
   deps:=array(select id from app_private.onboarding_intents where id=any(deps) and status not in ('confirmed','omitted') order by id);
   kind:=p_request->'change'->>'kind';
   if kind='omit' then
    if p_request->'change'-array['kind','dependents','dependentIntentIds']<>'{}' or jsonb_typeof(p_request->'change'->'dependentIntentIds') is distinct from 'array'
     or jsonb_array_length(p_request->'change'->'dependentIntentIds')>63 then raise exception 'Invalid dependency selection.' using errcode='22023';end if;
    requested:=array(select (x#>>'{}')::uuid from jsonb_array_elements(p_request->'change'->'dependentIntentIds') x order by (x#>>'{}')::uuid);
    if cardinality(requested)<>cardinality(array(select distinct x from unnest(requested) x)) or requested is distinct from deps
     or p_request->'change'->>'dependents' not in ('deny','omit_selected') or p_request->'change'->>'dependents'='deny' and cardinality(deps)>0
     then raise exception 'Dependent choices changed.' using errcode='40001';end if;
    selected:=array_append(deps,i.id);
    update app_private.onboarding_intents set status='omitted',entity_id=null,reason=null,input=null,bound_input=null,bindings='[]',extras='{}',choice=null
     where user_id=p_user and round_id=r.id and active and id=any(selected);
   elsif kind='replace' then
    v:=p_request->'plan';
    if p_request->'change'-array['kind','value']<>'{}' or jsonb_typeof(v) is distinct from 'object'
     or v-array['slot','itemKey','kind','command','input','choice','bindings','extras','ordinal']<>'{}'
     or v->>'slot' is distinct from i.slot or v->>'kind' is distinct from i.kind or v->>'itemKey' is distinct from i.item_key::text
     or v->>'command' is distinct from i.command or v->'choice' is distinct from p_request->'change'->'value'
     or v->'input'->>'client_id' is distinct from 'onb:'||r.id::text||':'||i.slot||':v'||(i.intent_version+1)::text
     or jsonb_typeof(v->'bindings') is distinct from 'array' or jsonb_array_length(v->'bindings')>2
     then raise exception 'Invalid replacement.' using errcode='22023';end if;
    -- Prepared references must name already selected slots; nothing implicit.
    if exists(select 1 from jsonb_array_elements(v->'bindings') b where b-array['field','slot']<>'{}'
     or b->>'field' not in ('project_id','notebook_id','from_id','to_id')
     or not exists(select 1 from app_private.onboarding_intents ref where ref.user_id=p_user and ref.round_id=r.id and ref.active and ref.slot=b->>'slot' and ref.status<>'omitted')
     or b->>'slot'=i.slot) then raise exception 'Replacement reference unavailable.' using errcode='22023';end if;
    -- Dependencies may only point backward in the frozen slot order: no cycle.
    if exists(select 1 from jsonb_array_elements(v->'bindings') b join app_private.onboarding_intents ref on ref.user_id=p_user and ref.round_id=r.id and ref.active and ref.slot=b->>'slot' where ref.ordinal>=i.ordinal)
     then raise exception 'Replacement dependency cycle.' using errcode='22023';end if;
    -- Revoke the entire nonconfirmed dependent closure before admitting new IDs.
    selected:=array_append(deps,i.id);
    for d in select * from app_private.onboarding_intents where id=any(selected) order by ordinal,intent_version,id loop
     if d.intent_version=2147483647 then raise exception 'Version limit reached.' using errcode='23514';end if;
     new_version:=d.intent_version+1;
     update app_private.onboarding_intents set active=false,status='not_committed',reason=null,input=null,bound_input=null,choice=null,bindings='[]',extras='{}' where id=d.id;
     insert into app_private.onboarding_intents(user_id,round_id,slot,item_key,kind,command,input,choice,bindings,extras,ordinal,intent_version,dependency_slots)
      values(p_user,r.id,d.slot,d.item_key,d.kind,d.command,
       jsonb_set(case when d.id=i.id then v->'input' else d.input end,'{client_id}',to_jsonb('onb:'||r.id::text||':'||d.slot||':v'||new_version::text)),
       case when d.id=i.id then v->'choice' else d.choice end,
       case when d.id=i.id then v->'bindings' else d.bindings end,
       case when d.id=i.id then v->'extras' else d.extras end,d.ordinal,new_version,
       case when d.id=i.id then array(select b->>'slot' from jsonb_array_elements(v->'bindings') b) else d.dependency_slots end);
    end loop;
   else raise exception 'Invalid amendment.' using errcode='22023';end if;
   if r.expires_at<=clock_timestamp() then raise exception 'Round expired during amendment.' using errcode='40001';end if;
   update app_private.onboarding_rounds set generation=gen_random_uuid(),edited_at=clock_timestamp(),expires_at=clock_timestamp()+interval '720 hours' where id=r.id;
   update app_private.onboarding_oauth set consumed_at=coalesce(consumed_at,clock_timestamp()) where user_id=p_user and round_id=r.id;
  end if;
 end if;
 insert into app_private.onboarding_commands(user_id,command,client_id,commitment,round_id) values(p_user,'amend',p_request->>'clientId',commitment,r.id);
 perform app_private.onboarding_progress(p_user,r.id);return '{}'::jsonb;
end $$;
-- Trusted server RPC only. The caller is revalidated before every replay/read/write.
create function app_private.onboarding_call(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r app_private.onboarding_rounds;i app_private.onboarding_intents;dep app_private.onboarding_intents;
 rec app_private.command_receipts;oldcmd app_private.onboarding_commands;
 v jsonb;b jsonb;patch jsonb;profile jsonb;result jsonb;items jsonb;last_id uuid;feature text;cid text;digest text;canonical text;
 expected text;new_id uuid;changed boolean;outcome text;kind text;flow app_private.google_oauth_flows;continuation app_private.onboarding_oauth;v_now timestamptz;
begin
 if jsonb_typeof(p_request) is distinct from 'object' or octet_length(p_request::text)>196608 then raise exception 'Invalid request.' using errcode='22023';end if;
 if p_operation='oauth_classify' then
  perform app_private.calendar_actor(p_user,p_session,false);
  if p_request-array['flowId']<>'{}' or not exists(select 1 from app_private.google_oauth_flows where id=(p_request->>'flowId')::uuid and user_id=p_user and session_id=p_session)
   then raise exception 'Flow unavailable.' using errcode='42501';end if;
  return jsonb_build_object('kind',case when exists(select 1 from app_private.onboarding_oauth where flow_id=(p_request->>'flowId')::uuid) then 'onboarding' else 'direct' end);
 end if;
 perform app_private.onboarding_require(p_user,p_session);
 v_now:=clock_timestamp();
 if p_operation='snapshot' then return app_private.onboarding_snapshot(p_user,p_session);end if;
 if p_operation='profile_read' then return app_private.onboarding_profile(p_user);end if;
 if p_operation in ('attributes_read','attributes_update') then return app_private.onboarding_attributes(p_user,p_session,p_operation='attributes_update',p_request);end if;
 if p_operation='choices' then
  kind:=p_request->>'kind';feature:=case kind when 'projects' then 'projetos' when 'notebooks' then 'conhecimento' end;
  if feature is null or p_request-array['kind','query','cursor']<>'{}' or jsonb_typeof(p_request->'query') is distinct from 'string' or char_length(p_request->>'query')>120 then raise exception 'Invalid choices.' using errcode='22023';end if;
  perform app_private.onboarding_require(p_user,p_session,feature);last_id:=(p_request->>'cursor')::uuid;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by id),'[]') into items from (
   select id,name from (
    select p.id,p.payload->>'name' name from public.projects p where kind='projects' and p.user_id=p_user and p.deleted_at is null
    union all select n.id,n.payload->>'name' from public.knowledge_notebooks n where kind='notebooks' and n.user_id=p_user and n.deleted_at is null
   ) candidates where (last_id is null or id>last_id) and position(lower(p_request->>'query') in lower(name))>0 order by id limit 51
  ) page;
  return jsonb_build_object('kind',kind,'items',case when jsonb_array_length(items)>50 then items-50 else items end,
   'nextCursor',case when jsonb_array_length(items)>50 then items->49->>'id' else null end);
 end if;
 perform app_private.onboarding_expire(p_user);
 if p_operation='start' then
  if p_request-array['clientId']<>'{}' or char_length(btrim(p_request->>'clientId')) not between 1 and 200 then raise exception 'Invalid start.' using errcode='22023';end if;
  cid:=p_request->>'clientId';digest:=encode(sha256(convert_to(p_request::text,'UTF8')),'hex');
  select * into oldcmd from app_private.onboarding_commands where user_id=p_user and command='start' and client_id=cid;
  if found then if oldcmd.commitment<>digest then raise exception 'Command changed.' using errcode='23505';end if;return '{}'::jsonb;end if;
  if not (app_private.consume_rate_limit_at('identity_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null)->>'allowed')::boolean then raise exception 'Onboarding write limit reached.' using errcode='PT429';end if;
  select * into r from app_private.onboarding_rounds where user_id=p_user and status in ('active','paused','executing','partial') for update;
  if not found then
   profile:=app_private.onboarding_profile(p_user);v_now:=clock_timestamp();
   insert into app_private.onboarding_rounds(user_id,status,step,draft,profile_revision,edited_at,expires_at) values(p_user,'active','welcome',
    '{"profile":{},"habits":[],"projects":[],"tasks":[],"notes":null}',profile->>'revision',v_now,v_now+interval '720 hours') returning * into r;
   perform app_private.onboarding_event(p_user,r.id);
  end if;
  insert into app_private.onboarding_commands(user_id,command,client_id,commitment,round_id) values(p_user,'start',cid,digest,r.id);
  update app_private.onboarding_entries set offer_pending=false where user_id=p_user and offer_pending;
  if found then perform app_private.append_event(p_user,'onboarding_entry',p_user,'updated','web',null,jsonb_build_object('user_id',p_user,'offer_pending',false));end if;
  return '{}'::jsonb;
 end if;
 if p_operation='oauth_take' then
  select * into r from app_private.onboarding_rounds where user_id=p_user and id=(p_request->>'roundId')::uuid for update;
  if not found or r.generation::text is distinct from p_request->>'generation' or r.status not in ('active','paused') or r.expires_at<=clock_timestamp() then return null;end if;
  select * into continuation from app_private.onboarding_oauth where flow_id=(p_request->>'flowId')::uuid and user_id=p_user and session_id=p_session for update;
  if not found or continuation.round_id<>r.id or continuation.generation<>r.generation or continuation.consumed_at is not null
   or continuation.expires_at<=clock_timestamp() or continuation.expires_at is distinct from (p_request->>'expiresAt')::timestamptz then return null;end if;
  update app_private.onboarding_oauth set consumed_at=clock_timestamp() where flow_id=continuation.flow_id;
  return jsonb_build_object('roundId',r.id,'generation',r.generation,'expiresAt',continuation.expires_at);
 end if;
 select * into r from app_private.onboarding_rounds where user_id=p_user and id=(p_request->>'roundId')::uuid for update;
 if not found then raise exception 'Round unavailable.' using errcode='42501';end if;
 if p_operation in ('amend_context','amend') then return app_private.onboarding_amend_call(p_user,p_operation='amend_context',p_request);end if;
 if p_operation='prepare_context' then
  select * into oldcmd from app_private.onboarding_commands where user_id=p_user and command='prepare' and client_id=p_request->>'clientId';
  if found then
   if oldcmd.round_id<>r.id or oldcmd.commitment<>encode(sha256(convert_to(p_request::text,'UTF8')),'hex') then raise exception 'Command changed.' using errcode='23505';end if;
   return jsonb_build_object('roundId',r.id,'prepared',true);
  end if;
  if r.status not in ('active','paused') or r.draft is null or r.revision::text is distinct from p_request->>'expectedRevision' then raise exception 'Round unavailable.' using errcode='40001';end if;
  return jsonb_build_object('roundId',r.id,'revision',r.revision::text,'draft',r.draft,'profileRevision',r.profile_revision);
 end if;
 if p_operation='oauth_connect' then
  perform app_private.onboarding_require(p_user,p_session,'calendario');
  select * into continuation from app_private.onboarding_oauth where flow_id=(p_request->>'flowId')::uuid and user_id=p_user and session_id=p_session for update;
  select * into flow from app_private.google_oauth_flows where id=continuation.flow_id and user_id=p_user and session_id=p_session for update;
  v:=p_request->'calendarConnect';digest:=encode(sha256(convert_to(v::text,'UTF8')),'hex');
  if continuation.flow_id is null or flow.id is null or continuation.round_id<>r.id or v->>'flow_id' is distinct from continuation.flow_id::text
   or v->>'account_id' is distinct from flow.account_id::text then raise exception 'OAuth binding unavailable.' using errcode='42501';end if;
  -- A committed connection wins even after the deadline; replay is read-only.
  if continuation.connected_at is not null then
   if continuation.connect_fingerprint is distinct from digest or flow.state<>'complete' then raise exception 'OAuth connection changed.' using errcode='23505';end if;
   return '{}'::jsonb;
  end if;
  if p_request-array['flowId','roundId','generation','calendarConnect']<>'{}' or continuation.consumed_at is null or flow.state<>'consumed'
   or continuation.generation<>r.generation or r.generation::text is distinct from p_request->>'generation'
   or r.status not in ('active','paused') or r.expires_at<=clock_timestamp() or continuation.expires_at<=clock_timestamp()
   then raise exception 'OAuth continuation expired.' using errcode='40001';end if;
  update app_private.onboarding_oauth set permit_backend_pid=pg_backend_pid(),permit_xact_id=pg_current_xact_id() where flow_id=continuation.flow_id;
  result:=app_private.google_calendar_call(p_user,p_session,'connect',v,false,gen_random_uuid());
  if r.expires_at<=clock_timestamp() or continuation.expires_at<=clock_timestamp() then raise exception 'OAuth continuation expired.' using errcode='40001';end if;
  update app_private.onboarding_oauth set connect_fingerprint=digest,connected_at=clock_timestamp(),permit_backend_pid=null,permit_xact_id=null where flow_id=continuation.flow_id;
  return result;
 end if;
 if p_operation='oauth_bind' then
  perform app_private.onboarding_require(p_user,p_session,'calendario');
  if r.status not in ('active','paused') or r.expires_at<=clock_timestamp() then raise exception 'Round unavailable.' using errcode='40001';end if;
  select * into flow from app_private.google_oauth_flows where id=(p_request->>'flowId')::uuid and user_id=p_user and session_id=p_session and state='pending';
  if not found or flow.expires_at<=clock_timestamp() or flow.expires_at>clock_timestamp()+interval '600 seconds' then raise exception 'Flow unavailable.' using errcode='42501';end if;
  insert into app_private.onboarding_oauth(flow_id,user_id,session_id,round_id,generation,expires_at) values(flow.id,p_user,p_session,r.id,r.generation,least(flow.expires_at,r.expires_at));
  return jsonb_build_object('roundId',r.id,'generation',r.generation,'expiresAt',least(flow.expires_at,r.expires_at));
 end if;
 if p_operation in ('save','pause','prepare') then
  cid:=p_request->>'clientId';
  if char_length(btrim(cid)) not between 1 and 200 or p_request->>'expectedRevision' !~ '^(0|[1-9][0-9]*)$' then raise exception 'Invalid command.' using errcode='22023';end if;
  digest:=encode(sha256(convert_to((p_request-'plan')::text,'UTF8')),'hex');
  select * into oldcmd from app_private.onboarding_commands where user_id=p_user and command=p_operation and client_id=cid;
  if found then if oldcmd.round_id<>r.id or oldcmd.commitment<>digest then raise exception 'Command changed.' using errcode='23505';end if;return '{}'::jsonb;end if;
  if r.revision::text<>p_request->>'expectedRevision' or r.status not in ('active','paused') or r.expires_at<=clock_timestamp() then raise exception 'Round changed.' using errcode='40001';end if;
  if not (app_private.consume_rate_limit_at('identity_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null)->>'allowed')::boolean then raise exception 'Onboarding write limit reached.' using errcode='PT429';end if;
  if p_operation='save' then
   v:=p_request->'draft';
   if jsonb_typeof(v) is distinct from 'object' or not v ?& array['profile','habits','projects','tasks','notes'] or v-array['profile','habits','projects','tasks','notes']<>'{}' or octet_length(v::text)>98304
    or jsonb_typeof(v->'profile')<>'object' or jsonb_typeof(v->'habits')<>'array' or jsonb_typeof(v->'projects')<>'array' or jsonb_typeof(v->'tasks')<>'array' then raise exception 'Invalid draft.' using errcode='22023';end if;
   changed:=r.draft is distinct from v;v_now:=clock_timestamp();
   if r.expires_at<=v_now then raise exception 'Round expired.' using errcode='40001';end if;
   -- Only a content edit extends retention; navigation/pause/read/retry does not.
   update app_private.onboarding_rounds set draft=v,step=p_request->>'step',status='active',revision=revision+1,
    profile_revision=case when (r.draft->'profile')='{}' and v->'profile'<>'{}' then app_private.onboarding_profile(p_user)->>'revision' else profile_revision end,
    edited_at=case when changed then v_now else edited_at end,expires_at=case when changed then v_now+interval '720 hours' else expires_at end where id=r.id;
  elsif p_operation='pause' then update app_private.onboarding_rounds set status='paused',revision=revision+1 where id=r.id;
  else
   if r.draft->'profile'<>'{}' and r.profile_revision is distinct from app_private.onboarding_profile(p_user)->>'revision' then raise exception 'Profile changed.' using errcode='40001';end if;
   -- Saved partial names/titles survive pause/reload, but no incomplete choice
   -- can cross the confirmation boundary, even through the internal RPC.
   if r.draft->'profile' ? 'displayName' and (jsonb_typeof(r.draft->'profile'->'displayName') is distinct from 'string' or char_length(btrim(r.draft->'profile'->>'displayName')) not between 1 and 120)
    or exists(select 1 from jsonb_array_elements(r.draft->'habits') x where jsonb_typeof(x->'name') is distinct from 'string' or char_length(btrim(x->>'name')) not between 1 and 120)
    or exists(select 1 from jsonb_array_elements(r.draft->'projects') x where jsonb_typeof(x->'name') is distinct from 'string' or char_length(btrim(x->>'name')) not between 1 and 120)
    or exists(select 1 from jsonb_array_elements(r.draft->'tasks') x where jsonb_typeof(x->'title') is distinct from 'string' or char_length(btrim(x->>'title')) not between 1 and 200)
    or r.draft->'notes'<>'null' and (
     r.draft->'notes'->'notebook'->>'kind'='new' and (jsonb_typeof(r.draft->'notes'->'notebook'->'name') is distinct from 'string' or char_length(btrim(r.draft->'notes'->'notebook'->>'name')) not between 1 and 120)
     or r.draft->'notes' ? 'page' and (jsonb_typeof(r.draft->'notes'->'page'->'title') is distinct from 'string' or char_length(btrim(r.draft->'notes'->'page'->>'title')) not between 1 and 200))
    then raise exception 'Incomplete onboarding choices.' using errcode='22023';end if;
   if jsonb_typeof(p_request->'plan') is distinct from 'array' or jsonb_array_length(p_request->'plan')>21 then raise exception 'Invalid plan.' using errcode='22023';end if;
   for v in select value from jsonb_array_elements(p_request->'plan') loop
    if v-array['slot','itemKey','kind','command','input','choice','bindings','extras','ordinal']<>'{}' or not v ?& array['slot','itemKey','kind','command','input','choice','bindings','extras','ordinal']
     or v->>'slot' is distinct from (v->>'kind')||':'||(v->>'itemKey') or v->'input'->>'client_id' is distinct from 'onb:'||r.id::text||':'||(v->>'slot')||':v1'
     or v->>'command' is distinct from case v->>'kind' when 'profile' then 'settings.profile.v2.update' when 'habit' then 'habit.create' when 'project' then 'project.create' when 'task' then 'task.create' when 'notebook' then 'knowledge.notebook.create' when 'page' then 'knowledge.page.create' when 'link' then 'knowledge.link.create' end
     then raise exception 'Invalid plan identity.' using errcode='22023';end if;
    insert into app_private.onboarding_intents(user_id,round_id,slot,item_key,kind,command,input,choice,bindings,extras,ordinal,dependency_slots)
    values(p_user,r.id,v->>'slot',(v->>'itemKey')::uuid,v->>'kind',v->>'command',v->'input',v->'choice',v->'bindings',v->'extras',(v->>'ordinal')::smallint,array(select x->>'slot' from jsonb_array_elements(v->'bindings') x));
   end loop;
   if r.expires_at<=clock_timestamp() then raise exception 'Round expired.' using errcode='40001';end if;
   update app_private.onboarding_rounds set status='executing',step='summary',revision=revision+1,generation=gen_random_uuid() where id=r.id;
  end if;
  insert into app_private.onboarding_commands(user_id,command,client_id,commitment,round_id) values(p_user,p_operation,cid,digest,r.id);
  perform app_private.onboarding_event(p_user,r.id);return '{}'::jsonb;
 end if;
 if p_operation='peek_intent' then
  if r.status not in ('executing','partial') or r.expires_at<=clock_timestamp() then return null;end if;
  select * into i from app_private.onboarding_intents where user_id=p_user and round_id=r.id and active and status not in ('confirmed','omitted') and not exists(select 1 from unnest(dependency_slots) ds where not exists(select 1 from app_private.onboarding_intents parent where parent.user_id=p_user and parent.round_id=r.id and parent.active and parent.slot=ds and parent.status='confirmed')) order by case status when 'ready' then 0 when 'pending' then 1 when 'unknown' then 2 when 'blocked' then 3 else 4 end,ordinal limit 1 for update;
  if not found then return null;end if;
  feature:=case i.kind when 'profile' then 'configuracoes' when 'project' then 'projetos' when 'habit' then 'habitos' when 'task' then 'tarefas' else 'conhecimento' end;
  perform app_private.onboarding_require(p_user,p_session,feature);
  if i.bound_input is null then
   v:=i.input;
   for b in select value from jsonb_array_elements(i.bindings) loop
    select * into dep from app_private.onboarding_intents where user_id=p_user and round_id=r.id and slot=b->>'slot' and active;
    if not found or dep.status<>'confirmed' or dep.entity_id is null or b->>'field' not in ('project_id','notebook_id','from_id','to_id') then
     update app_private.onboarding_intents set status='blocked',reason='dependency' where id=i.id;
     update app_private.onboarding_rounds set status='partial',revision=revision+1 where id=r.id;perform app_private.onboarding_event(p_user,r.id);return null;end if;
    v:=jsonb_set(v,array[b->>'field'],to_jsonb(dep.entity_id));
   end loop;
   update app_private.onboarding_intents set bound_input=v,status='pending',reason=null where id=i.id returning * into i;
   update app_private.onboarding_rounds set revision=revision+1 where id=r.id;perform app_private.onboarding_event(p_user,r.id);
  end if;
  return jsonb_build_object('intentId',i.id,'roundId',r.id,'roundGeneration',r.generation,'intentVersion',i.intent_version,'choice',i.choice,'slot',i.slot,'itemKey',i.item_key,'kind',i.kind,'command',i.command,
   'input',i.bound_input,'bindings',i.bindings,'extras',i.extras,'ordinal',i.ordinal);
 end if;
 select * into i from app_private.onboarding_intents where user_id=p_user and round_id=r.id and id=(p_request->>'intentId')::uuid for update;
 if p_operation in ('bind_intent','record','profile_update','module_commit') and not found then raise exception 'Intent unavailable.' using errcode='42501';end if;
 if p_operation in ('bind_intent','record','profile_update','module_commit') then
  feature:=case i.kind when 'profile' then 'configuracoes' when 'project' then 'projetos' when 'habit' then 'habitos' when 'task' then 'tarefas' else 'conhecimento' end;
  perform app_private.onboarding_require(p_user,p_session,feature);
 end if;
 if p_operation='bind_intent' then
  perform app_private.onboarding_fence(p_user,r.id,i.id,p_request);
  canonical:=p_request->>'canonicalInput';
  if r.status not in ('executing','partial') or r.expires_at<=clock_timestamp() or i.bound_input is null or canonical is null or octet_length(canonical)>98304 or canonical::jsonb is distinct from i.bound_input then raise exception 'Body changed.' using errcode='40001';end if;
  -- Persist only a digest, never the canonical routine body, past draft expiry.
  expected:=encode(sha256(convert_to(canonical,'UTF8')),'hex');
  if i.expected_fingerprint is not null and i.expected_fingerprint<>expected then raise exception 'Body changed.' using errcode='40001';end if;
  update app_private.onboarding_intents set expected_fingerprint=expected where id=i.id;return '{}'::jsonb;
 end if;
 if p_operation='profile_update' then
  if app_private.onboarding_reconcile(p_user,i.id) then select cr.result into result from app_private.command_receipts cr where cr.user_id=p_user and cr.command=i.command and client_id='onb:'||r.id::text||':'||i.slot||':v'||i.intent_version::text;return result;end if;
  perform app_private.onboarding_fence(p_user,r.id,i.id,p_request);
  if i.kind<>'profile' or i.expected_fingerprint is null or i.bound_input is null or r.expires_at<=clock_timestamp() then raise exception 'Profile intent unavailable.' using errcode='40001';end if;
  select * into rec from app_private.command_receipts where user_id=p_user and command=i.command and client_id=i.bound_input->>'client_id';
  if found then if rec.request is distinct from to_jsonb(i.expected_fingerprint) then raise exception 'Receipt changed.' using errcode='23505';end if;return rec.result;end if;
  profile:=app_private.onboarding_profile(p_user);patch:=i.bound_input->'patch';
  if profile->>'revision' is distinct from i.bound_input->>'expectedRevision' or jsonb_typeof(patch) is distinct from 'object' or patch='{}' or patch-array['displayName','focus']<>'{}' then raise exception 'Profile changed.' using errcode='40001';end if;
  if patch ? 'displayName' then
   if jsonb_typeof(patch->'displayName') is distinct from 'string' or char_length(btrim(patch->>'displayName')) not between 1 and 120 then raise exception 'Invalid name.' using errcode='22023';end if;
   select to_jsonb(p.*) into b from public.profiles p where user_id=p_user;
   update public.profiles set display_name=btrim(patch->>'displayName'),updated_at=now() where user_id=p_user returning to_jsonb(profiles.*) into v;
   perform app_private.append_event(p_user,'profile',p_user,'updated','web',b,v);
  end if;
  if patch ? 'focus' then
   if patch->>'focus' not in ('work','study','personal','mixed') then raise exception 'Invalid focus.' using errcode='22023';end if;
   select jsonb_build_object('id',user_id,'user_id',user_id,'focus',focus) into b from app_private.profile_focus where user_id=p_user;
   insert into app_private.profile_focus(user_id,focus) values(p_user,patch->>'focus') on conflict(user_id) do update set focus=excluded.focus,revision=profile_focus.revision+1;
   perform app_private.append_event(p_user,'profile_focus',p_user,case when b is null then 'created' else 'updated' end,'web',b,jsonb_build_object('id',p_user,'user_id',p_user,'focus',patch->>'focus'));
  end if;
  result:=jsonb_build_object('id',p_user,'user_id',p_user);
  insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,i.command,i.bound_input->>'client_id',to_jsonb(i.expected_fingerprint),result);
  if r.expires_at<=clock_timestamp() then raise exception 'Round expired.' using errcode='40001';end if;
  perform app_private.onboarding_reconcile(p_user,i.id);perform app_private.onboarding_progress(p_user,r.id);
  if r.expires_at<=clock_timestamp() then raise exception 'Round expired.' using errcode='40001';end if;return result;
 end if;
 if p_operation='module_commit' then
  if i.kind='profile' then raise exception 'Invalid module.' using errcode='22023';end if;
  v:=p_request->'moduleCommit';
  expected:=case when i.command like 'knowledge.%' then v->'receipt'->>'fingerprint'
   else encode(sha256(convert_to(v->'receipt'->>'fingerprint','UTF8')),'hex') end;
  if i.expected_fingerprint is null or expected is distinct from i.expected_fingerprint
   or v->'receipt'->>'client_id' is distinct from 'onb:'||r.id::text||':'||i.slot||':v'||i.intent_version::text
   or v->'receipt'->>'command' is distinct from i.command then raise exception 'Module body changed.' using errcode='40001';end if;
  if app_private.onboarding_reconcile(p_user,i.id) then
   select cr.result into result from app_private.command_receipts cr where cr.user_id=p_user and cr.command=i.command and cr.client_id=v->'receipt'->>'client_id';
   return jsonb_build_object('status','replayed','result',result);
  end if;
  perform app_private.onboarding_fence(p_user,r.id,i.id,p_request);
  if i.bound_input is null then raise exception 'Unbound module.' using errcode='40001';end if;
  insert into app_private.onboarding_write_permits(user_id,session_id,round_id,generation,intent_id,intent_version,command,client_id,fingerprint,backend_pid,xact_id)
   values(p_user,p_session,r.id,r.generation,i.id,i.intent_version,i.command,i.bound_input->>'client_id',i.expected_fingerprint,pg_backend_pid(),pg_current_xact_id());
  if i.command in ('habit.create','project.create') then result:=app_private.projects_habits_commit(p_user,p_session,i.command,v);
  elsif i.command='task.create' then result:=app_private.capture_task_commit(p_user,p_session,i.command,v);
  else result:=app_private.knowledge_commit(p_user,p_session,i.command,v);end if;
  if exists(select 1 from app_private.onboarding_write_permits where intent_id=i.id) then raise exception 'Onboarding permit not consumed.' using errcode='23514';end if;
  if result->>'status'<>'stale' then
   if not app_private.onboarding_reconcile(p_user,i.id) then raise exception 'Module receipt missing.' using errcode='23514';end if;
   if i.kind='project' and i.extras ? 'context' then
    new_id:=(result->'result'->>'id')::uuid;
    insert into app_private.project_contexts(user_id,project_id,context) values(p_user,new_id,i.extras->>'context') on conflict(project_id) do nothing;
    if found then perform app_private.append_event(p_user,'project_context',new_id,'created','web',null,jsonb_build_object('id',new_id,'user_id',p_user,'context',i.extras->>'context'));
    elsif not exists(select 1 from app_private.project_contexts where user_id=p_user and project_id=new_id and context=i.extras->>'context') then raise exception 'Project context changed.' using errcode='40001';end if;
   end if;
   if r.expires_at<=clock_timestamp() then raise exception 'Round expired.' using errcode='40001';end if;
   perform app_private.onboarding_progress(p_user,r.id);
  end if;
  if r.expires_at<=clock_timestamp() then raise exception 'Round expired.' using errcode='40001';end if;
  delete from app_private.onboarding_write_permits where intent_id=i.id;return result;
 end if;
 if p_operation='record' then
  if i.intent_version::text is distinct from p_request->>'intentVersion' or not i.active then return '{}'::jsonb;end if;
  if i.status in ('confirmed','omitted') or r.status='expired' then return '{}'::jsonb;end if;
  -- Authenticity is the existing module transaction receipt, not an HTTP result.
  select * into rec from app_private.command_receipts where user_id=p_user and command=i.command and client_id='onb:'||r.id::text||':'||i.slot||':v'||i.intent_version::text;
  if found then
   expected:=case when i.command like 'knowledge.%' then rec.request->'receipt'->>'fingerprint'
    when i.kind='profile' then rec.request#>>'{}' else encode(sha256(convert_to(rec.request#>>'{}','UTF8')),'hex') end;
   if i.expected_fingerprint is null or expected is distinct from i.expected_fingerprint or rec.result->>'user_id' is distinct from p_user::text or rec.result->>'id' is null then raise exception 'Unbound receipt.' using errcode='23514';end if;
   new_id:=(rec.result->>'id')::uuid;
   update app_private.onboarding_intents set status='confirmed',entity_id=new_id,reason=null,input=null,bound_input=null,bindings='[]',extras='{}',choice=null where id=i.id;
  elsif i.status<>'confirmed' then
   if r.generation::text is distinct from p_request->>'roundGeneration' then return '{}'::jsonb;end if;
   outcome:=p_request->>'outcome';
   if outcome not in ('failed','unknown','reconcile') or p_request->>'reason' not in ('validation','forbidden','conflict','commit_unknown') and p_request->'reason'<>'null' then raise exception 'Invalid outcome.' using errcode='22023';end if;
   update app_private.onboarding_intents set status=case when outcome='failed' then 'failed' else 'unknown' end,
    reason=case when outcome='failed' then coalesce(p_request->>'reason','validation') else 'commit_unknown' end where id=i.id;
  end if;
  update app_private.onboarding_rounds set status=case when status='expired' then status
   when exists(select 1 from app_private.onboarding_intents where user_id=p_user and round_id=r.id and active and status in ('failed','blocked','unknown')) then 'partial'
   else 'executing' end,revision=revision+1 where id=r.id;
  perform app_private.onboarding_event(p_user,r.id);return '{}'::jsonb;
 end if;
 if p_operation='complete' then
  if r.status='expired' then return '{}'::jsonb;end if;
  if r.status in ('executing','partial') and not exists(select 1 from app_private.onboarding_intents where user_id=p_user and round_id=r.id and active and status not in ('confirmed','omitted')) then
   update app_private.onboarding_rounds set status='complete',draft=null,step='summary',revision=revision+1,generation=gen_random_uuid() where id=r.id;
   perform app_private.onboarding_event(p_user,r.id);
  end if;return '{}'::jsonb;
 end if;
 raise exception 'Unsupported onboarding operation.' using errcode='22023';
end $$;
create function public.onboarding_call(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select app_private.onboarding_call(p_user,p_session,p_operation,p_request);$$;
revoke all on function public.onboarding_call(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.onboarding_call(uuid,uuid,text,jsonb) to service_role;
-- Private routines must not inherit PUBLIC EXECUTE. No direct table grants.
revoke all on function app_private.onboarding_require(uuid,uuid,text),app_private.onboarding_profile(uuid),app_private.onboarding_event(uuid,uuid),
 app_private.onboarding_enroll_admin(),app_private.onboarding_expire(uuid),app_private.onboarding_snapshot(uuid,uuid),app_private.onboarding_call(uuid,uuid,text,jsonb)
 ,app_private.onboarding_project_attributes(uuid,uuid),app_private.onboarding_attributes(uuid,uuid,boolean,jsonb)
 from public,anon,authenticated,service_role;
-- Close EVERY helper's default PUBLIC EXECUTE, including trigger/retention fences.
-- This exact-name set belongs to the new proposal only; no historical grants change.
do $$ declare fn record;begin
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname=any(array[
   'onboarding_permit_must_be_gone','onboarding_require','onboarding_profile','onboarding_event','onboarding_enroll_admin',
   'onboarding_reconcile','onboarding_dependents','onboarding_recovery','onboarding_reserved_guard','onboarding_settings_reserved_guard',
   'onboarding_oauth_permit_zero','onboarding_oauth_reserved_guard','onboarding_expire_round','onboarding_expire','onboarding_snapshot',
   'onboarding_project_attributes','onboarding_attributes','onboarding_fence','onboarding_progress','onboarding_amend_call','onboarding_call']) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',fn.signature);
 end loop;
end $$;
grant usage on schema app_private to service_role;
grant execute on function app_private.onboarding_call(uuid,uuid,text,jsonb) to service_role;
comment on table app_private.onboarding_rounds is 'Draft schema1, optional explicit opt-in; no heuristic enrollment. Logical expiry is exactly720 hours after last confirmed content edit; physical removal requires active measured native retention sweep. No billing.';
comment on table app_private.onboarding_intents is 'Stable module receipt binding, one effect per advance. Confirmed content is scrubbed. A version is reconciled or transactionally revoked before explicit amendment admits a new version. Payload is scrubbed; minimal proof remains.';
rollback;
