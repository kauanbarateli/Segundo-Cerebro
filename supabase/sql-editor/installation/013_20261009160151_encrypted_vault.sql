-- T024 versioned preparation. Application and real-user assertions remain manual.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table public.vault_master_keys(user_id uuid primary key references auth.users(id) on delete cascade,payload jsonb not null);
create table public.vault_items(id uuid primary key,user_id uuid not null references public.vault_master_keys(user_id) on delete cascade,payload jsonb not null,unique(user_id,id));
create table app_private.vault_revisions(user_id uuid primary key references auth.users(id) on delete cascade,revision bigint not null default 0 check(revision>=0));
create index vault_items_owner_idx on public.vault_items(user_id,id);
do $$ declare expression text;begin
 select pg_get_expr(conbin,conrelid) into strict expression from pg_constraint where conrelid='public.domain_events'::regclass and conname='domain_events_entity_type_check';
 alter table public.domain_events drop constraint domain_events_entity_type_check;
 execute format('alter table public.domain_events add constraint domain_events_entity_type_check check ((%s) or entity_type=''vault_metadata'')',expression);
end $$;
-- Neither keys nor items have JWT policies or grants. Cipher reads go through authenticated RPCs.
alter table public.vault_master_keys enable row level security;
alter table public.vault_items enable row level security;
alter table app_private.vault_revisions enable row level security;
revoke all on public.vault_master_keys,public.vault_items,app_private.vault_revisions from public,anon,authenticated,service_role;
create function app_private.vault_command(p text) returns boolean language sql immutable set search_path='' as $$ select coalesce(p=any(array['vault.create','vault.master.rewrap','vault.item.create','vault.item.update','vault.item.delete','vault.item.restore','vault.audit']),false) $$;
create function app_private.vault_guard(p_user uuid,p_session uuid,p_operation text) returns void language plpgsql security definer set search_path='' as $$ begin
 perform 1 from auth.users where id=p_user for share;perform 1 from auth.sessions where id=p_session and user_id=p_user for share;
 perform app_private.capture_task_lock(p_user);perform app_private.require_actor(p_user,p_session);
 if p_operation is null or (p_operation<>'read.vault' and not app_private.vault_command(p_operation)) then raise exception 'Unknown vault operation.' using errcode='22023';end if;
 if exists(select 1 from public.user_entitlements where user_id=p_user and feature_key='cofre' and not allowed) then raise exception 'Vault unavailable.' using errcode='42501';end if;
end $$;
create function app_private.vault_base64(p jsonb,p_min integer,p_max integer) returns void language plpgsql immutable set search_path='' as $$
declare value text;bytes bytea;begin
 if jsonb_typeof(p) is distinct from 'string' then raise exception 'Invalid ciphertext encoding.' using errcode='22023';end if;value:=p#>>'{}';
 if char_length(value)>65536 or value!~'^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$' then raise exception 'Invalid ciphertext encoding.' using errcode='22023';end if;
 bytes:=decode(value,'base64');if octet_length(bytes) not between p_min and p_max or replace(encode(bytes,'base64'),chr(10),'')<>value then raise exception 'Invalid ciphertext length.' using errcode='22023';end if;
end $$;
create function app_private.vault_envelope(p jsonb,p_wrapped boolean default false) returns void language plpgsql immutable set search_path='' as $$ begin
 if jsonb_typeof(p) is distinct from 'object' or not p ?& array['iv','ciphertext'] or p-array['iv','ciphertext']<>'{}'::jsonb then raise exception 'Invalid ciphertext envelope.' using errcode='22023';end if;
 perform app_private.vault_base64(p->'iv',12,12);perform app_private.vault_base64(p->'ciphertext',case when p_wrapped then 48 else 16 end,case when p_wrapped then 48 else 49152 end);
end $$;
create function app_private.vault_master(p jsonb) returns void language plpgsql immutable set search_path='' as $$
declare k jsonb;begin
 if jsonb_typeof(p) is distinct from 'object' or not p ?& array['kdf','envelope'] or p-array['kdf','envelope']<>'{}'::jsonb then raise exception 'Invalid vault protection.' using errcode='22023';end if;k:=p->'kdf';
 if jsonb_typeof(k) is distinct from 'object' or not k ?& array['algorithm','memory_kib','iterations','parallelism','salt'] or k-array['algorithm','memory_kib','iterations','parallelism','salt']<>'{}'::jsonb or k->'algorithm' is distinct from '"argon2id"'::jsonb or k->'memory_kib' is distinct from '65536'::jsonb or k->'iterations' is distinct from '3'::jsonb or k->'parallelism' is distinct from '1'::jsonb then raise exception 'Invalid Argon2id parameters.' using errcode='22023';end if;
 perform app_private.vault_base64(k->'salt',16,16);perform app_private.vault_envelope(p->'envelope',true);
end $$;
create function app_private.vault_row() returns trigger language plpgsql security definer set search_path='' as $$
declare p jsonb;required text[];begin
 p:=new.payload;required:=case when tg_table_name='vault_master_keys' then array['user_id','schema_version','master','recovery','consent_at','created_at','updated_at'] else array['id','user_id','version','envelope','deleted_at','created_at','updated_at'] end;
 if jsonb_typeof(p) is distinct from 'object' or not p ?& required or p-required<>'{}'::jsonb then raise exception 'Invalid vault record.' using errcode='22023';end if;
 new.user_id:=(p->>'user_id')::uuid;perform app_private.capture_task_lock(new.user_id);perform app_private.capture_task_timestamp(p->'created_at');perform app_private.capture_task_timestamp(p->'updated_at');
 if tg_op='UPDATE' and (new.user_id is distinct from old.user_id or p->'created_at' is distinct from old.payload->'created_at') then raise exception 'Vault identity immutable.' using errcode='23514';end if;
 if tg_table_name='vault_master_keys' then
  if p->'schema_version' is distinct from '1'::jsonb then raise exception 'Unknown vault schema.' using errcode='22023';end if;perform app_private.vault_master(p->'master');perform app_private.vault_envelope(p->'recovery',true);perform app_private.capture_task_timestamp(p->'consent_at');
  if tg_op='UPDATE' and (p-array['master','updated_at']) is distinct from (old.payload-array['master','updated_at']) then raise exception 'Rewrapping preserves recovery.' using errcode='23514';end if;
 else
  new.id:=(p->>'id')::uuid;if jsonb_typeof(p->'version') is distinct from 'number' or p->>'version' !~ '^[1-9][0-9]*$' or (p->>'version')::numeric>2147483647 then raise exception 'Invalid cipher version.' using errcode='22023';end if;
  perform app_private.vault_envelope(p->'envelope');perform app_private.capture_task_timestamp(p->'deleted_at',true);
  if tg_op='UPDATE' and new.id is distinct from old.id then raise exception 'Vault identity immutable.' using errcode='23514';end if;
 end if;return new;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Invalid vault value.' using errcode='22023';end $$;
create trigger vault_row before insert or update on public.vault_master_keys for each row execute function app_private.vault_row();
create trigger vault_row before insert or update on public.vault_items for each row execute function app_private.vault_row();
create function app_private.vault_bump() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid;begin
 if tg_table_name='domain_events' then if (case when tg_op='DELETE' then old.entity_type else new.entity_type end)<>'vault_metadata' then return null;end if;end if;
 if tg_table_name='command_receipts' then if not app_private.vault_command(case when tg_op='DELETE' then old.command else new.command end) then return null;end if;end if;
 u:=case when tg_op='DELETE' then old.user_id else new.user_id end;perform app_private.capture_task_lock(u);
 if exists(select 1 from auth.users where id=u) then insert into app_private.vault_revisions(user_id,revision) values(u,1) on conflict(user_id) do update set revision=vault_revisions.revision+1;end if;return null;
end $$;
create trigger vault_revision after insert or update or delete on public.vault_master_keys for each row execute function app_private.vault_bump();
create trigger vault_revision after insert or update or delete on public.vault_items for each row execute function app_private.vault_bump();
create trigger vault_revision after insert or update or delete on public.domain_events for each row execute function app_private.vault_bump();
create trigger vault_revision after insert or update or delete on app_private.command_receipts for each row execute function app_private.vault_bump();
-- Storage-level allowlist prevents accidental cipher/key/content copies into global audit and receipts.
create function app_private.vault_metadata_safe(p jsonb,p_user uuid,p_id uuid) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p)='object' and p ?& array['id','user_id','operation','version','occurred_at'] and p-array['id','user_id','operation','version','occurred_at']='{}'::jsonb and p->>'id'=p_id::text and p->>'user_id'=p_user::text and jsonb_typeof(p->'version')='number' and p->>'version'~'^[1-9][0-9]{0,9}$' and (char_length(p->>'version')<10 or p->>'version'<='2147483647') and jsonb_typeof(p->'occurred_at')='string' and p->>'occurred_at'~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' and p->>'operation' in ('created','master_rewrapped','item_created','item_updated','item_deleted','item_restored','unlocked','unlock_failed','locked','copied'),false);
$$;
alter table public.domain_events add constraint vault_metadata_only check(entity_type<>'vault_metadata' or (before is null and app_private.vault_metadata_safe(after,user_id,entity_id)));
alter table app_private.command_receipts add constraint vault_receipt_digest_only check(command not like 'vault.%' or (jsonb_typeof(request)='object' and request ? 'digest' and request-'digest'='{}'::jsonb and jsonb_typeof(request->'digest')='string' and request->>'digest'~'^[a-f0-9]{64}$' and jsonb_typeof(result)='object' and result ?& array['id','revision'] and result-array['id','revision']='{}'::jsonb and jsonb_typeof(result->'id')='string' and result->>'id'~'^[0-9a-f-]{36}$' and jsonb_typeof(result->'revision')='string' and result->>'revision'~'^(0|[1-9][0-9]{0,18})$'));
create function app_private.vault_snapshot(p_user uuid,p_session uuid,p_operation text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 perform app_private.vault_guard(p_user,p_session,p_operation);
 select jsonb_build_object('revision',coalesce((select revision::text from app_private.vault_revisions where user_id=p_user),'0'),'header',(select payload from public.vault_master_keys where user_id=p_user),'items',coalesce((select jsonb_agg(payload order by id) from public.vault_items where user_id=p_user),'[]'::jsonb)) into result;
 if jsonb_array_length(result->'items')>500 or octet_length(result::text)>8388608 then raise exception 'Complete vault exceeds limit.' using errcode='54000';end if;return result;
end $$;
create function app_private.vault_input(p_operation text,p_request jsonb) returns void language plpgsql immutable set search_path='' as $$
declare input jsonb;required text[];allowed text[];begin
 if jsonb_typeof(p_request) is distinct from 'object' or not p_request ?& array['command','input'] or p_request-array['command','input']<>'{}'::jsonb or p_request->>'command' is distinct from p_operation or not app_private.vault_command(p_operation) then raise exception 'Invalid vault operation.' using errcode='22023';end if;input:=p_request->'input';
 required:=array['client_id','expected_revision']||(case p_operation when 'vault.create' then array['master','recovery','consent'] when 'vault.master.rewrap' then array['master'] when 'vault.item.create' then array['id','version','envelope'] when 'vault.item.update' then array['id','version','envelope'] when 'vault.audit' then array['operation'] else array['id'] end);allowed:=required||(case when p_operation='vault.audit' then array['item_id'] else array[]::text[] end);
 if jsonb_typeof(input) is distinct from 'object' or not input ?& required or input-allowed<>'{}'::jsonb or jsonb_typeof(input->'client_id') is distinct from 'string' or input->>'client_id' !~ '^[A-Za-z0-9_-]{1,200}$' or jsonb_typeof(input->'expected_revision') is distinct from 'string' or input->>'expected_revision' !~ '^(0|[1-9][0-9]*)$' or octet_length(p_request::text)>131072 then raise exception 'Invalid vault input.' using errcode='22023';end if;
 if input ? 'master' then perform app_private.vault_master(input->'master');end if;if input ? 'recovery' then perform app_private.vault_envelope(input->'recovery',true);end if;
 if p_operation='vault.create' and input->'consent' is distinct from 'true'::jsonb then raise exception 'Consent required.' using errcode='22023';end if;
 if input ? 'id' then if jsonb_typeof(input->'id') is distinct from 'string' or input->>'id' !~ '^[0-9a-fA-F-]{36}$' then raise exception 'Invalid vault item.' using errcode='22023';end if;end if;
 if input ? 'version' then if jsonb_typeof(input->'version') is distinct from 'number' or input->>'version' !~ '^[1-9][0-9]*$' or (input->>'version')::numeric>2147483647 then raise exception 'Invalid cipher version.' using errcode='22023';end if;perform app_private.vault_envelope(input->'envelope');end if;
 if p_operation='vault.audit' and (jsonb_typeof(input->'operation') is distinct from 'string' or input->>'operation' not in ('unlocked','unlock_failed','locked','copied') or ((input->>'operation'='copied') is distinct from (input ? 'item_id'))) then raise exception 'Invalid audit operation.' using errcode='22023';end if;
end $$;
create function app_private.vault_receipt(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare stored app_private.command_receipts;digest text;begin
 perform app_private.vault_guard(p_user,p_session,p_operation);perform app_private.vault_input(p_operation,p_request);
 digest:=encode(sha256(convert_to(p_request::text,'UTF8')),'hex');select * into stored from app_private.command_receipts where user_id=p_user and command=p_operation and client_id=p_request#>>'{input,client_id}';
 if not found then return null;end if;if stored.request->>'digest' is distinct from digest then raise exception 'client_id reused.' using errcode='23505';end if;return stored.result;
end $$;
create function app_private.vault_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare request jsonb;input jsonb;meta jsonb;header jsonb;item jsonb;stamp timestamptz;stamp_json jsonb;result jsonb;replayed jsonb;operation text;v_id uuid;version integer;event_action text;begin
 perform app_private.vault_guard(p_user,p_session,p_operation);
 if jsonb_typeof(p_request) is distinct from 'object' or not p_request ?& array['request','metadata','event_id','occurred_at','canal'] or p_request-array['request','metadata','event_id','occurred_at','canal']<>'{}'::jsonb or coalesce(p_request->>'canal','') not in ('web','api','cron') then raise exception 'Invalid vault commit.' using errcode='22023';end if;
 request:=p_request->'request';perform app_private.vault_input(p_operation,request);input:=request->'input';replayed:=app_private.vault_receipt(p_user,p_session,p_operation,request);if replayed is not null then return replayed;end if;
 if coalesce((select revision::text from app_private.vault_revisions where user_id=p_user),'0') is distinct from input->>'expected_revision' then raise exception 'Vault revision changed.' using errcode='40001';end if;
 if not (app_private.consume_rate_limit_at('capture_task_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null)->>'allowed')::boolean then raise exception 'Vault rate limited.' using errcode='PT429';end if;
 stamp:=app_private.capture_task_timestamp(p_request->'occurred_at');stamp_json:=p_request->'occurred_at';select payload into header from public.vault_master_keys where user_id=p_user;v_id:=p_user;version:=1;event_action:='updated';
 if p_operation='vault.create' then
  if header is not null then raise exception 'Vault already configured.' using errcode='23514';end if;
  header:=jsonb_build_object('user_id',p_user,'schema_version',1,'master',input->'master','recovery',input->'recovery','consent_at',stamp_json,'created_at',stamp_json,'updated_at',stamp_json);insert into public.vault_master_keys(payload) values(header);operation:='created';event_action:='created';
 else
  if header is null then raise exception 'Vault not configured.' using errcode='23514';end if;
  if p_operation='vault.master.rewrap' then
   header:=jsonb_set(jsonb_set(header,'{master}',input->'master'),'{updated_at}',stamp_json);update public.vault_master_keys set payload=header where user_id=p_user;operation:='master_rewrapped';
  elsif p_operation='vault.audit' then
   operation:=input->>'operation';if input ? 'item_id' then v_id:=(input->>'item_id')::uuid;select payload into item from public.vault_items where user_id=p_user and vault_items.id=v_id and payload->'deleted_at'='null'::jsonb;if item is null then raise exception 'Audit outside active item.' using errcode='23514';end if;version:=(item->>'version')::integer;end if;
  else
   v_id:=(input->>'id')::uuid;select payload into item from public.vault_items where user_id=p_user and vault_items.id=v_id;
   if p_operation='vault.item.create' then
    if item is not null or input->'version' is distinct from '1'::jsonb or (select count(*) from public.vault_items where user_id=p_user)>=500 then raise exception 'Invalid initial vault item.' using errcode='23514';end if;
    item:=jsonb_build_object('id',v_id,'user_id',p_user,'version',1,'envelope',input->'envelope','deleted_at','null'::jsonb,'created_at',stamp_json,'updated_at',stamp_json);insert into public.vault_items(payload) values(item);operation:='item_created';event_action:='created';
   else
    if item is null then raise exception 'Vault item not found.' using errcode='23514';end if;version:=(item->>'version')::integer;
    if p_operation='vault.item.update' then
     if item->'deleted_at' is distinct from 'null'::jsonb or (input->>'version')::integer<>version+1 then raise exception 'Vault item version changed.' using errcode='23514';end if;version:=version+1;item:=item||jsonb_build_object('version',version,'envelope',input->'envelope');operation:='item_updated';
    elsif p_operation='vault.item.delete' then
     if item->'deleted_at' is distinct from 'null'::jsonb then raise exception 'Vault item already deleted.' using errcode='23514';end if;item:=jsonb_set(item,'{deleted_at}',stamp_json);operation:='item_deleted';event_action:='deleted';
    else
     if item->'deleted_at'='null'::jsonb then raise exception 'Vault item already active.' using errcode='23514';end if;item:=jsonb_set(item,'{deleted_at}','null'::jsonb);operation:='item_restored';event_action:='restored';
    end if;item:=jsonb_set(item,'{updated_at}',stamp_json);update public.vault_items set payload=item where user_id=p_user and vault_items.id=v_id;
   end if;
  end if;
 end if;
 meta:=jsonb_build_object('id',v_id,'user_id',p_user,'operation',operation,'version',version,'occurred_at',stamp_json);
 if p_request->'metadata' is distinct from meta then raise exception 'Vault metadata outside mutation.' using errcode='23514';end if;
 insert into public.domain_events(id,user_id,entity_type,entity_id,action,canal,occurred_at,before,after) values((p_request->>'event_id')::uuid,p_user,'vault_metadata',v_id,event_action,p_request->>'canal',stamp,null,meta);
 -- Receipt inserts also bump revision; predict its single bump before creating the metadata-only result.
 result:=jsonb_build_object('id',v_id,'revision',(coalesce((select revision from app_private.vault_revisions where user_id=p_user),0)+1)::text);
 insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,p_operation,input->>'client_id',jsonb_build_object('digest',encode(sha256(convert_to(request::text,'UTF8')),'hex')),result);
 perform app_private.vault_snapshot(p_user,p_session,p_operation);return result;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Invalid vault value.' using errcode='22023';end $$;
create function public.vault_snapshot(p_user uuid,p_session uuid,p_operation text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.vault_snapshot(p_user,p_session,p_operation) $$;
create function public.vault_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$ select app_private.vault_commit(p_user,p_session,p_operation,p_request) $$;
create function public.vault_receipt(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$ select app_private.vault_receipt(p_user,p_session,p_operation,p_request) $$;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname like 'vault_%' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.proname in ('vault_snapshot','vault_commit','vault_receipt') then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end $$;
comment on table public.vault_master_keys is 'Client-wrapped data key only; no JWT policies or direct grants. Password and recovery kit never reach the server.';
comment on constraint vault_metadata_only on public.domain_events is 'Closed metadata only: no ciphertext, title, plaintext, key, password or recovery kit.';
commit;
