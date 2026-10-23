-- INERT. A single exact command/receipt, no callback/write retry.
do $draft_only$ begin raise exception 'DRAFT_ONLY: Goals commit requires SQL, Auth, shared-lock races and recovery gates.';end $draft_only$;
begin;
create function app_private.fg_record(p_user uuid,kind text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$ declare row_value jsonb;begin
 if kind='finance_goal' then select payload into row_value from app_private.finance_goals where user_id=p_user and id=p_id;
 elsif kind='finance_goal_reservation' then select payload into row_value from app_private.finance_goal_reservations where user_id=p_user and id=p_id;
 elsif kind='finance_goal_release' then select payload into row_value from app_private.finance_goal_releases where user_id=p_user and id=p_id;
 elsif kind='finance_goal_highlight' then select payload into row_value from app_private.finance_goal_highlights where user_id=p_user and id=p_id;
 else raise exception 'Unknown goal effect type.' using errcode='23514';end if;return row_value;
end $$;
create function app_private.fg_identity_used(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app_private.finance_goals where id=p_id) or exists(select 1 from app_private.finance_goal_reservations where id=p_id)
  or exists(select 1 from app_private.finance_goal_releases where id=p_id) or exists(select 1 from app_private.finance_goal_highlights where id=p_id)
  or exists(select 1 from public.fin_accounts where id=p_id) or exists(select 1 from public.fin_categories where id=p_id)
  or exists(select 1 from public.fin_tags where id=p_id) or exists(select 1 from public.fin_transactions where id=p_id)
  or exists(select 1 from public.fin_budgets where id=p_id) or exists(select 1 from public.domain_events where id=p_id);
$$;
create function app_private.fg_action(kind text,b jsonb,a jsonb) returns text language sql immutable set search_path='' as $$
 select case when b is null then 'created' when kind='finance_goal' and b->'archived_at' is distinct from a->'archived_at' then 'status_changed' else 'updated' end;
$$;
create function app_private.fg_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<goal_commit>>
declare input jsonb;context jsonb;receipt jsonb;stored jsonb;change_value jsonb;event_value jsonb;a jsonb;b jsonb;kind text;row_id uuid;n integer;matched integer;at_text text;at_time timestamptz;today date;expected jsonb;ordered_expected jsonb;ordered_submitted jsonb;begin
 -- Parent/session locks -> same financial advisory -> actor/feature. Even a
 -- genuine old receipt never bypasses current Auth/session/Entitlement.
 perform app_private.fg_guard(p_user,p_session);if octet_length(p_request::text)>1048576 then raise exception 'Goal commit exceeds quota.' using errcode='54000';end if;
 perform app_private.fg_object(p_request,array['request','expected_finance_revision','context','changes','events','receipt']);
 input:=app_private.fg_command(p_request->'request');context:=p_request->'context';receipt:=p_request->'receipt';
 perform app_private.fg_object(context,array['user_id','canal']);perform app_private.fg_object(receipt,array['user_id','command','client_id','fingerprint','result']);
 if p_operation is distinct from p_request#>>'{request,command}' or p_request->'expected_finance_revision' is distinct from input->'expected_finance_revision' or context->>'user_id' is distinct from p_user::text or context->>'canal' is distinct from 'web'
  or receipt->>'user_id' is distinct from p_user::text or receipt->>'command' is distinct from p_operation or receipt->'client_id' is distinct from input->'client_id' or jsonb_typeof(receipt->'fingerprint') is distinct from 'string' then raise exception 'Goal envelope outside authenticated intent.' using errcode='42501';end if;
 if (receipt->>'fingerprint')::jsonb is distinct from input then raise exception 'Goal fingerprint differs from exact intent.' using errcode='23505';end if;
 stored:=app_private.fg_saved_receipt(p_user,p_operation,input);
 if stored is not null then
  if stored->'fingerprint' is distinct from receipt->'fingerprint' then raise exception 'Goal fingerprint changed.' using errcode='23505';end if;
  return jsonb_build_object('status','replayed','result',stored->'result');
 end if;
 if app_private.fg_finance_revision(p_user) is distinct from p_request->>'expected_finance_revision' then return jsonb_build_object('status','stale');end if;
 perform app_private.fg_result(p_user,p_operation,input,receipt->'result');
 if jsonb_typeof(p_request->'changes') is distinct from 'array' or jsonb_typeof(p_request->'events') is distinct from 'array' then raise exception 'Goal effect arrays required.' using errcode='23514';end if;
 n:=jsonb_array_length(p_request->'changes');if n>2 or n<>jsonb_array_length(p_request->'events') then raise exception 'Goal effect count differs.' using errcode='23514';end if;
 if exists(select 1 from jsonb_array_elements(p_request->'changes') c(value) group by c.value#>>'{after,id}' having count(*)>1)
  or exists(select 1 from jsonb_array_elements(p_request->'events') e(value) group by e.value->>'id' having count(*)>1)
  or exists(select 1 from jsonb_array_elements(p_request->'changes') c(value) join jsonb_array_elements(p_request->'events') e(value) on c.value#>'{after,id}'=e.value->'id') then raise exception 'Goal effect/event identity reused.' using errcode='23514';end if;
 for change_value in select value from jsonb_array_elements(p_request->'changes') loop
  perform app_private.fg_object(change_value,array['type','before','after']);kind:=change_value->>'type';a:=change_value->'after';b:=nullif(change_value->'before','null'::jsonb);perform app_private.fg_row(kind,a);row_id:=app_private.fg_uuid(a->'id');
  if a->>'user_id' is distinct from p_user::text or b is not null and (b->'id' is distinct from a->'id' or b->>'user_id' is distinct from p_user::text or b->'created_at' is distinct from a->'created_at') then raise exception 'Goal owner/id/creation changed.' using errcode='42501';end if;
  if app_private.fg_record(p_user,kind,row_id) is distinct from b then raise exception 'Goal BEFORE changed.' using errcode='40001';end if;
  if b is null and app_private.fg_identity_used(row_id) then raise exception 'New goal identity already used.' using errcode='23505';end if;
 end loop;
 today:=(clock_timestamp() at time zone 'America/Sao_Paulo')::date;
 if n>0 then at_text:=p_request#>>'{events,0,occurred_at}';at_time:=app_private.capture_task_timestamp(to_jsonb(at_text));
  if abs(extract(epoch from(clock_timestamp()-at_time)))>=300 or (at_time at time zone 'America/Sao_Paulo')::date<>today then raise exception 'Goal server clock requires review.' using errcode='40001';end if;
 else at_text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');end if;
 expected:=app_private.fg_expected(p_user,p_operation,input,receipt->'result',at_text,today);
 select coalesce(jsonb_agg(c.value order by c.value->>'type',c.value#>>'{after,id}'),'[]') into ordered_expected from jsonb_array_elements(expected->'changes') c(value);
 select coalesce(jsonb_agg(c.value order by c.value->>'type',c.value#>>'{after,id}'),'[]') into ordered_submitted from jsonb_array_elements(p_request->'changes') c(value);
 if ordered_expected is distinct from ordered_submitted then raise exception 'Goal changes omit/add/alter exact effects.' using errcode='23514';end if;
 for change_value in select value from jsonb_array_elements(expected->'changes') loop
  select count(*) into matched from jsonb_array_elements(p_request->'events') e(value) where e.value->>'entity_type'=change_value->>'type' and e.value->'entity_id'=change_value#>'{after,id}' and e.value->'before' is not distinct from change_value->'before' and e.value->'after'=change_value->'after';
  if matched<>1 then raise exception 'Exact goal event required for each effect.' using errcode='23514';end if;
 end loop;
 for event_value in select value from jsonb_array_elements(p_request->'events') loop
  perform app_private.fg_object(event_value,array['id','user_id','entity_type','entity_id','action','canal','occurred_at','before','after']);perform app_private.fg_uuid(event_value->'id');perform app_private.fg_uuid(event_value->'entity_id');
  if app_private.fg_identity_used((event_value->>'id')::uuid) then raise exception 'Goal event id already used.' using errcode='23505';end if;
  if event_value->>'user_id' is distinct from p_user::text or event_value->'canal' is distinct from context->'canal' or event_value->>'occurred_at' is distinct from at_text or event_value->>'action' is distinct from app_private.fg_action(event_value->>'entity_type',nullif(event_value->'before','null'::jsonb),event_value->'after') then raise exception 'Goal event metadata differs.' using errcode='23514';end if;
 end loop;
 if not (app_private.consume_rate_limit_at('capture_task_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null)->>'allowed')::boolean then raise exception 'Goal write rate reached.' using errcode='PT429';end if;
 for change_value in select value from jsonb_array_elements(expected->'changes') loop
  kind:=change_value->>'type';a:=change_value->'after';b:=nullif(change_value->'before','null'::jsonb);row_id:=app_private.fg_uuid(a->'id');
  if kind='finance_goal' then
   if b is null then insert into app_private.finance_goals(payload) values(a);else update app_private.finance_goals set payload=a where user_id=p_user and id=goal_commit.row_id;end if;
  elsif kind='finance_goal_highlight' then
   if b is null then insert into app_private.finance_goal_highlights(payload) values(a);else update app_private.finance_goal_highlights set payload=a where user_id=p_user and id=goal_commit.row_id;end if;
  elsif kind='finance_goal_reservation' then
   if b is not null then raise exception 'Reservation update refused.' using errcode='42501';end if;insert into app_private.finance_goal_reservations(payload) values(a);
  elsif kind='finance_goal_release' then
   if b is not null then raise exception 'Release update refused.' using errcode='42501';end if;insert into app_private.finance_goal_releases(payload) values(a);
  end if;
  if app_private.fg_record(p_user,kind,row_id) is distinct from a then raise exception 'Goal projection differs from effect.' using errcode='23514';end if;
 end loop;
 set constraints all immediate;
 for event_value in select value from jsonb_array_elements(p_request->'events') loop
  insert into public.domain_events(id,user_id,entity_type,entity_id,action,canal,occurred_at,before,after) values((event_value->>'id')::uuid,p_user,event_value->>'entity_type',(event_value->>'entity_id')::uuid,event_value->>'action',event_value->>'canal',app_private.capture_task_timestamp(event_value->'occurred_at'),nullif(event_value->'before','null'::jsonb),event_value->'after');
 end loop;
 insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,p_operation,input->>'client_id',receipt->'fingerprint',expected->'result');
 return jsonb_build_object('status','committed','result',expected->'result');
end $$;
create function public.finance_goals_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language sql security definer set search_path='' as $$ select app_private.fg_commit(p_user,p_session,p_operation,p_request); $$;
revoke all on function public.finance_goals_commit(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.finance_goals_commit(uuid,uuid,text,jsonb) to service_role;
do $permissions$ declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='app_private'::regnamespace and proname like 'fg\_%' escape '\' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;end $permissions$;
rollback;
