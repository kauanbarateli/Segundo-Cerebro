-- INERT. Does not activate v1 guards or authorize a hosted operation.
do $draft_only$ begin raise exception 'DRAFT_ONLY: Finance series commit requires peer, full SQL assertions and B3 consumer gates.';end $draft_only$;
begin;
create function app_private.fsv2_record(p_user uuid,kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare p jsonb;begin
 if kind='finance_series' then select payload into p from app_private.finance_series where user_id=p_user and id=p_id;
 elsif kind='finance_series_occurrence' then select payload into p from app_private.finance_series_occurrences where user_id=p_user and id=p_id;
 elsif kind='finance_transaction' then select payload into p from public.fin_transactions where user_id=p_user and id=p_id;
 else raise exception 'Unknown series effect type.' using errcode='22023';end if;return p;
end $$;
create function app_private.fsv2_identity_used(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app_private.finance_series where id=p_id)
  or exists(select 1 from app_private.finance_series_occurrences where id=p_id)
  or exists(select 1 from public.fin_transactions where id=p_id)
  or exists(select 1 from public.fin_accounts where id=p_id)
  or exists(select 1 from public.fin_categories where id=p_id)
  or exists(select 1 from public.fin_tags where id=p_id)
  or exists(select 1 from public.fin_budgets where id=p_id)
  or exists(select 1 from public.domain_events where id=p_id);
$$;
create function app_private.fsv2_effect_action(kind text,b jsonb,a jsonb) returns text language sql immutable set search_path='' as $$
 select case when b is null then 'created'
  when kind='finance_series' then (case when b->'state'=a->'state' then 'updated' else 'status_changed' end)
  when kind='finance_series_occurrence' then (case when b->'suppression'=a->'suppression' then 'updated' else 'status_changed' end)
  when b->'deleted_at'='null'::jsonb and a->'deleted_at'<>'null'::jsonb then 'deleted'
  when b->'deleted_at'<>'null'::jsonb and a->'deleted_at'='null'::jsonb then 'restored'
  when b->'status'=a->'status' then 'updated' else 'status_changed' end;
$$;
create function app_private.fsv2_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
<<series_commit>>
declare input jsonb;r jsonb;stored jsonb;expected jsonb;ordered_expected jsonb;ordered_submitted jsonb;c jsonb;b jsonb;a jsonb;e jsonb;
 context jsonb;kind text;id uuid;series_id uuid;at_text text;at_time timestamptz;today date;n integer;found_n integer;table_name text;result jsonb;
begin
 perform app_private.fsv2_guard(p_user,p_session);
 perform app_private.fsv2_object(p_request,array['request','expected_finance_revision','context','changes','events','receipt']);
 if octet_length(p_request::text)>8388608 or octet_length((p_request->'request')::text)>65536 then raise exception 'Series request exceeds quota.' using errcode='54000';end if;
 input:=app_private.fsv2_command(p_request->'request');
 if p_operation is distinct from p_request#>>'{request,command}' or p_request->'expected_finance_revision' is distinct from input->'expected_finance_revision' then raise exception 'Series command/revision envelope changed.' using errcode='22023';end if;
 context:=p_request->'context';perform app_private.fsv2_object(context,array['user_id','canal']);
 if context->>'user_id' is distinct from p_user::text or jsonb_typeof(context->'canal') is distinct from 'string' or context->>'canal' not in ('web','api','cron') then raise exception 'Series context outside actor.' using errcode='42501';end if;
 r:=p_request->'receipt';perform app_private.fsv2_object(r,array['user_id','command','client_id','fingerprint','result']);
 if r->>'user_id' is distinct from p_user::text or r->>'command' is distinct from p_operation or r->'client_id' is distinct from input->'client_id' or jsonb_typeof(r->'fingerprint') is distinct from 'string'
  or (r->>'fingerprint')::jsonb is distinct from input then raise exception 'Series receipt outside exact intent.' using errcode='23514';end if;
 -- Access precedes every replay. Replaying after a race can legitimately return
 -- the winner's UUIDs, not this loser's freshly planned IDs. No batch/CAS/ref
 -- revalidation is allowed to replace or invalidate that authentic receipt.
 stored:=app_private.fsv2_saved_receipt(p_user,p_operation,input);
 if stored is not null then
  if stored->'fingerprint' is distinct from r->'fingerprint' then raise exception 'Series fingerprint changed.' using errcode='23505';end if;
  return jsonb_build_object('status','replayed','result',stored->'result');
 end if;
 if app_private.fsv2_finance_revision(p_user) is distinct from p_request->>'expected_finance_revision' then return jsonb_build_object('status','stale');end if;
 if jsonb_typeof(p_request->'changes') is distinct from 'array' or jsonb_typeof(p_request->'events') is distinct from 'array' then raise exception 'Series effects arrays required.' using errcode='22023';end if;
 n:=jsonb_array_length(p_request->'changes');if n>241 or n<>jsonb_array_length(p_request->'events') then raise exception 'Series effects exceed finite bound.' using errcode='23514';end if;
 if exists(select 1 from jsonb_array_elements(p_request->'changes') as effect(value) group by effect.value->>'type',effect.value#>>'{after,id}' having count(*)>1)
  or exists(select 1 from jsonb_array_elements(p_request->'changes') as effect(value) group by effect.value#>>'{after,id}' having count(*)>1)
  or exists(select 1 from jsonb_array_elements(p_request->'events') as event(value) group by event.value->>'id' having count(*)>1)
  or exists(select 1 from jsonb_array_elements(p_request->'events') as event(value) join jsonb_array_elements(p_request->'changes') as effect(value) on event.value->'id'=effect.value#>'{after,id}') then raise exception 'Repeated/colliding series effect/event.' using errcode='23514';end if;
 for c in select value from jsonb_array_elements(p_request->'changes') loop
  perform app_private.fsv2_object(c,array['type','before','after']);a:=c->'after';b:=nullif(c->'before','null'::jsonb);kind:=c->>'type';
  if kind='finance_series' then perform app_private.fsv2_series(a);
  elsif kind='finance_series_occurrence' then perform app_private.fsv2_occurrence(a);
  elsif kind='finance_transaction' then perform app_private.finance_validate(kind,a);
  else raise exception 'Effect type outside series.' using errcode='23514';end if;
  id:=app_private.fsv2_uuid(a->'id');
  if a->>'user_id' is distinct from p_user::text or b is not null and (b->>'id' is distinct from a->>'id' or b->>'user_id' is distinct from p_user::text or b->'created_at' is distinct from a->'created_at') then raise exception 'Effect owner/identity changed.' using errcode='42501';end if;
  if app_private.fsv2_record(p_user,kind,id) is distinct from b then raise exception 'Series BEFORE changed.' using errcode='40001';end if;
  if b is null and app_private.fsv2_identity_used(id) then raise exception 'New series identity already used.' using errcode='23505';end if;
 end loop;
 today:=(clock_timestamp() at time zone 'America/Sao_Paulo')::date;
 if n>0 then
  at_text:=p_request#>>'{events,0,occurred_at}';at_time:=app_private.capture_task_timestamp(to_jsonb(at_text));
  if abs(extract(epoch from(clock_timestamp()-at_time)))>=300 or (at_time at time zone 'America/Sao_Paulo')::date<>today then raise exception 'Series server clock requires a fresh review.' using errcode='40001';end if;
 else at_text:=r#>>'{result,series,updated_at}';end if;
 expected:=app_private.fsv2_expected(p_user,p_operation,input,p_request->'changes',r->'result',at_text,today);
 select coalesce(jsonb_agg(value order by value->>'type',value#>>'{after,id}'),'[]') into ordered_expected from jsonb_array_elements(expected->'changes');
 select coalesce(jsonb_agg(value order by value->>'type',value#>>'{after,id}'),'[]') into ordered_submitted from jsonb_array_elements(p_request->'changes');
 if ordered_expected is distinct from ordered_submitted then raise exception 'Submitted effects omit/add/change the exact series plan.' using errcode='23514';end if;
 for c in select value from jsonb_array_elements(expected->'changes') loop
  a:=c->'after';b:=nullif(c->'before','null'::jsonb);kind:=c->>'type';
  select count(*) into found_n from jsonb_array_elements(p_request->'events') ev where ev->>'entity_type'=kind and ev->'entity_id'=a->'id' and ev->'before' is not distinct from coalesce(b,'null'::jsonb) and ev->'after'=a;
  if found_n<>1 then raise exception 'Exact series event required.' using errcode='23514';end if;
 end loop;
 for e in select value from jsonb_array_elements(p_request->'events') loop
  perform app_private.fsv2_object(e,array['id','user_id','entity_type','entity_id','action','canal','occurred_at','before','after']);perform app_private.fsv2_uuid(e->'id');perform app_private.fsv2_uuid(e->'entity_id');
  if app_private.fsv2_identity_used((e->>'id')::uuid) then raise exception 'New event identity already used.' using errcode='23505';end if;
  if e->>'user_id' is distinct from p_user::text or e->'canal' is distinct from context->'canal' or e->>'occurred_at' is distinct from at_text
   or e->>'action' is distinct from app_private.fsv2_effect_action(e->>'entity_type',nullif(e->'before','null'::jsonb),e->'after') then raise exception 'Series event metadata differs.' using errcode='23514';end if;
 end loop;
 if not (app_private.consume_rate_limit_at('capture_task_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null)->>'allowed')::boolean then raise exception 'Series write limit reached.' using errcode='PT429';end if;
 -- Create/update the selected metadata first, ledger second and map third.
 -- FKs stay deferred; guards consume each exact ledger permit before integrity.
 -- A preceding command in this SAME transaction may have made all constraints
 -- immediate. Re-defer only our residual check; never relax a legacy FK/check.
 set constraints app_private.finance_series_permit_zero deferred;
 for c in select value from jsonb_array_elements(expected->'changes') order by (case value->>'type' when 'finance_series' then 0 when 'finance_transaction' then 1 else 2 end),value#>>'{after,id}' loop
  a:=c->'after';b:=nullif(c->'before','null'::jsonb);kind:=c->>'type';id:=app_private.fsv2_uuid(a->'id');
  if kind='finance_transaction' then
   series_id:=app_private.fsv2_uuid(a->'installment_group_id');
   insert into app_private.finance_series_permits(row_id,user_id,series_id,command,client_id,before_hash,after_hash,backend_pid,xact_id)
    values(id,p_user,series_id,p_operation,(input->>'client_id')::uuid,encode(sha256(convert_to(coalesce(b,'null'::jsonb)::text,'UTF8')),'hex'),encode(sha256(convert_to(a::text,'UTF8')),'hex'),pg_backend_pid(),pg_current_xact_id());
   if b is null then insert into public.fin_transactions(payload) values(a);else update public.fin_transactions set payload=a where user_id=p_user and public.fin_transactions.id=series_commit.id;end if;
   if exists(select 1 from app_private.finance_series_permits p where p.row_id=series_commit.id) then raise exception 'Series permit was not consumed.' using errcode='23514';end if;
  elsif kind='finance_series' then
   if b is null then insert into app_private.finance_series(payload) values(a);else update app_private.finance_series set payload=a where user_id=p_user and app_private.finance_series.id=series_commit.id;end if;
  else
   if b is null then insert into app_private.finance_series_occurrences(payload) values(a);else update app_private.finance_series_occurrences set payload=a where user_id=p_user and app_private.finance_series_occurrences.id=series_commit.id;end if;
  end if;
  if app_private.fsv2_record(p_user,kind,id) is distinct from a then raise exception 'Series projection differs from effect.' using errcode='23514';end if;
 end loop;
 if exists(select 1 from app_private.finance_series_permits where user_id=p_user and backend_pid=pg_backend_pid() and xact_id=pg_current_xact_id()) then raise exception 'Residual series permit.' using errcode='23514';end if;
 perform app_private.finance_integrity(p_user);
 set constraints all immediate;
 for e in select value from jsonb_array_elements(p_request->'events') loop
  insert into public.domain_events(id,user_id,entity_type,entity_id,action,canal,occurred_at,before,after)
   values((e->>'id')::uuid,p_user,e->>'entity_type',(e->>'entity_id')::uuid,e->>'action',e->>'canal',app_private.capture_task_timestamp(e->'occurred_at'),nullif(e->'before','null'::jsonb),e->'after');
 end loop;
 result:=r->'result';series_id:=app_private.fsv2_uuid(result#>'{series,id}');
 if app_private.fsv2_record(p_user,'finance_series',series_id) is distinct from result->'series' then raise exception 'Series result differs from stored metadata.' using errcode='23514';end if;
 perform app_private.fsv2_bound_map(result->'series');
 insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,p_operation,r->>'client_id',to_jsonb(r->>'fingerprint'),result);
 return jsonb_build_object('status','committed','result',result);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Invalid series commit value.' using errcode='22023';end $$;
create function public.finance_series_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$select app_private.fsv2_commit(p_user,p_session,p_operation,p_request);$$;
revoke all on function app_private.fsv2_record(uuid,text,uuid),app_private.fsv2_identity_used(uuid),app_private.fsv2_effect_action(text,jsonb,jsonb),app_private.fsv2_commit(uuid,uuid,text,jsonb),public.finance_series_commit(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function app_private.fsv2_commit(uuid,uuid,text,jsonb),public.finance_series_commit(uuid,uuid,text,jsonb) to service_role;
rollback;
