-- INERT. Independent SQL oracle for all SEVEN closed Core commands.
do $draft_only$ begin raise exception 'DRAFT_ONLY: Goals oracle requires Core-to-SQL equivalence assertions.';end $draft_only$;
begin;
create function app_private.fg_result(p_user uuid,op text,input jsonb,result jsonb) returns void language plpgsql immutable set search_path='' as $$ declare r jsonb;g jsonb;h jsonb;k text;v jsonb;begin
 if op='finance.goal.contribute' then
  perform app_private.fg_object(result,array['version','reservation']);r:=result->'reservation';perform app_private.fg_row('finance_goal_reservation',r);
  if r->'goal_id' is distinct from input->'goal_id' or r->'account_id' is distinct from input->'account_id' then raise exception 'Reservation outside intent.' using errcode='23514';end if;
 elsif op='finance.goal.release' then
  perform app_private.fg_object(result,array['version','release']);r:=result->'release';perform app_private.fg_row('finance_goal_release',r);
  if r->'reservation_id' is distinct from input->'reservation_id' then raise exception 'Release outside intent.' using errcode='23514';end if;
 elsif op='finance.goal.highlight' then
  perform app_private.fg_object(result,array['version','highlight']);h:=nullif(result->'highlight','null'::jsonb);
  if h is not null then perform app_private.fg_row('finance_goal_highlight',h);if h->>'user_id' is distinct from p_user::text then raise exception 'Foreign highlight result.' using errcode='42501';end if;end if;
  if coalesce(h->'goal_id','null'::jsonb) is distinct from input->'goal_id' then raise exception 'Highlight outside intent.' using errcode='23514';end if;
 else
  perform app_private.fg_object(result,array['version','goal'],case when op in ('finance.goal.archive','finance.goal.restore') then array['highlight'] else '{}'::text[] end);
  if op in ('finance.goal.archive','finance.goal.restore') and not result ? 'highlight' then raise exception 'Highlight result required.' using errcode='23514';end if;
  g:=result->'goal';perform app_private.fg_row('finance_goal',g);if g->>'user_id' is distinct from p_user::text then raise exception 'Foreign goal result.' using errcode='42501';end if;
  if op<>'finance.goal.create' and g->'id' is distinct from input->'goal_id' then raise exception 'Result of another goal.' using errcode='23514';end if;
  if op in ('finance.goal.create','finance.goal.update') then
   for k,v in select key,value from jsonb_each(case when op='finance.goal.create' then input-array['client_id','expected_finance_revision'] else input->'patch' end) loop
    if g->k is distinct from (case when k='name' then to_jsonb(app_private.fg_name(v)) else v end) then raise exception 'Goal result differs from requested field.' using errcode='23514';end if;
   end loop;
   if op='finance.goal.create' and (g->'revision'<>'"0"'::jsonb or g->'archived_at'<>'null'::jsonb) then raise exception 'Invalid new goal state.' using errcode='23514';end if;
  elsif op in ('finance.goal.archive','finance.goal.restore') then
   h:=nullif(result->'highlight','null'::jsonb);if h is not null then perform app_private.fg_row('finance_goal_highlight',h);if h->>'user_id' is distinct from p_user::text then raise exception 'Foreign highlight result.' using errcode='42501';end if;end if;
   if op='finance.goal.archive' and (g->'archived_at'='null'::jsonb or h->'goal_id'=g->'id') or op='finance.goal.restore' and g->'archived_at'<>'null'::jsonb then raise exception 'Goal archive result differs.' using errcode='23514';end if;
  else raise exception 'Unknown goal result command.' using errcode='22023';end if;
 end if;
 if result->'version' is distinct from '1'::jsonb then raise exception 'Invalid goal result version.' using errcode='23514';end if;
 if r is not null and (r->>'user_id' is distinct from p_user::text or r->'client_id' is distinct from input->'client_id' or r->'amount_cents' is distinct from input->'amount_cents' or r->'occurred_on' is distinct from input->'occurred_on') then raise exception 'Allocation result differs from intent/owner.' using errcode='23514';end if;
end $$;
create function app_private.fg_effect(kind text,b jsonb,a jsonb) returns jsonb language sql immutable set search_path='' as $$
 select case when b is not distinct from a then '[]'::jsonb else jsonb_build_array(jsonb_build_object('type',kind,'before',b,'after',a)) end;
$$;
create function app_private.fg_next_revision(p jsonb) returns text language plpgsql immutable set search_path='' as $$ declare n bigint;begin n:=app_private.fg_revision(p);if n=9223372036854775807 then raise exception 'Goal revision exhausted.' using errcode='22023';end if;return (n+1)::text;end $$;
create function app_private.fg_highlight_plan(p_user uuid,b jsonb,desired jsonb,at_text text) returns jsonb language plpgsql immutable set search_path='' as $$ declare a jsonb;begin
 if coalesce(b->'goal_id','null'::jsonb)=desired then return b;end if;
 a:=jsonb_build_object('version',1,'id',p_user,'user_id',p_user,'goal_id',desired,'revision',app_private.fg_next_revision(coalesce(b->'revision','"0"'::jsonb)),'created_at',coalesce(b->'created_at',to_jsonb(at_text)),'updated_at',at_text);return a;
end $$;
create function app_private.fg_expected(p_user uuid,op text,input jsonb,result jsonb,at_text text,today date) returns jsonb language plpgsql security definer set search_path='' as $$
declare b jsonb;a jsonb;h jsonb;next_h jsonb;r jsonb;image jsonb;account public.fin_accounts;totals jsonb;amount bigint;leftover numeric;patch jsonb;expected_result jsonb;effects jsonb:='[]';begin
 perform app_private.fg_result(p_user,op,input,result);
 if op='finance.goal.create' then
  if input->'image_file_id'<>'null'::jsonb then image:=app_private.fg_image(p_user,(input->>'image_file_id')::uuid);if image is null then raise exception 'New goal image is not finalized for this purpose.' using errcode='22023';end if;end if;
  a:=jsonb_build_object('version',1,'id',result#>'{goal,id}','user_id',p_user,'name',app_private.fg_name(input->'name'),'target_cents',input->'target_cents','deadline',input->'deadline','image_file_id',input->'image_file_id','archived_at',null,'revision','0','created_at',at_text,'updated_at',at_text);
  effects:=app_private.fg_effect('finance_goal',null,a);expected_result:=jsonb_build_object('version',1,'goal',a);
 elsif op='finance.goal.release' then
  select payload into r from app_private.finance_goal_reservations where user_id=p_user and id=(input->>'reservation_id')::uuid;if r is null then raise exception 'Owned reservation missing.' using errcode='22023';end if;
  amount:=app_private.fg_number(input->'amount_cents',1);leftover:=(r->>'amount_cents')::numeric-app_private.fg_released(p_user,(r->>'id')::uuid);
  if app_private.fg_day(input->'occurred_on')>today or amount>leftover then raise exception 'Release exceeds current remainder or is future.' using errcode='23514';end if;
  a:=jsonb_build_object('version',1,'id',result#>'{release,id}','user_id',p_user,'reservation_id',input->'reservation_id','amount_cents',amount,'occurred_on',input->'occurred_on','client_id',input->'client_id','created_at',at_text);
  effects:=app_private.fg_effect('finance_goal_release',null,a);expected_result:=jsonb_build_object('version',1,'release',a);
 elsif op='finance.goal.highlight' then
  select payload into h from app_private.finance_goal_highlights where user_id=p_user;
  if coalesce(h->'revision','"0"'::jsonb) is distinct from input->'expected_highlight_revision' then raise exception 'Highlight revision changed.' using errcode='40001';end if;
  if input->'goal_id'<>'null'::jsonb then select payload into b from app_private.finance_goals where user_id=p_user and id=(input->>'goal_id')::uuid;if b is null or b->'archived_at'<>'null'::jsonb then raise exception 'Active owned goal required for highlight.' using errcode='22023';end if;end if;
  next_h:=app_private.fg_highlight_plan(p_user,h,input->'goal_id',at_text);effects:=app_private.fg_effect('finance_goal_highlight',h,next_h);expected_result:=jsonb_build_object('version',1,'highlight',next_h);
 else
  select payload into b from app_private.finance_goals where user_id=p_user and id=(input->>'goal_id')::uuid;if b is null then raise exception 'Owned goal missing.' using errcode='22023';end if;
  if b->'revision' is distinct from input->'expected_revision' then raise exception 'Goal revision changed.' using errcode='40001';end if;
  if op='finance.goal.contribute' then
   select * into account from public.fin_accounts where user_id=p_user and id=(input->>'account_id')::uuid;
   if not found or account.kind='credit_card' or account.currency<>'BRL' or account.archived_at is not null or b->'archived_at'<>'null'::jsonb or app_private.fg_day(input->'occurred_on')>today then raise exception 'Contribution requires active goal and own non-card account.' using errcode='22023';end if;
   amount:=app_private.fg_number(input->'amount_cents',1);totals:=app_private.fg_account_totals(p_user,account.id);
   if (totals->>'real_balance_cents')::numeric-(totals->>'reserved_cents')::numeric<amount then raise exception 'Insufficient unreserved balance.' using errcode='23514';end if;
   perform app_private.fg_cents(app_private.fg_reserved(p_user,null,(b->>'id')::uuid)::numeric+amount);
   a:=jsonb_build_object('version',1,'id',result#>'{reservation,id}','user_id',p_user,'goal_id',input->'goal_id','account_id',input->'account_id','amount_cents',amount,'occurred_on',input->'occurred_on','client_id',input->'client_id','created_at',at_text);
   effects:=app_private.fg_effect('finance_goal_reservation',null,a);expected_result:=jsonb_build_object('version',1,'reservation',a);
  elsif op='finance.goal.update' then
   patch:=input->'patch';if patch ? 'name' then patch:=jsonb_set(patch,'{name}',to_jsonb(app_private.fg_name(patch->'name')));end if;
   if patch ? 'image_file_id' and patch->'image_file_id' is distinct from b->'image_file_id' and patch->'image_file_id'<>'null'::jsonb then image:=app_private.fg_image(p_user,(patch->>'image_file_id')::uuid);if image is null then raise exception 'New goal image proof unavailable.' using errcode='22023';end if;end if;
   a:=b||patch;if a is distinct from b then a:=a||jsonb_build_object('revision',app_private.fg_next_revision(b->'revision'),'updated_at',at_text);end if;
   effects:=app_private.fg_effect('finance_goal',b,a);expected_result:=jsonb_build_object('version',1,'goal',a);
  elsif op in ('finance.goal.archive','finance.goal.restore') then
   select payload into h from app_private.finance_goal_highlights where user_id=p_user;
   a:=jsonb_set(b,'{archived_at}',case when op='finance.goal.restore' then 'null'::jsonb else coalesce(nullif(b->'archived_at','null'::jsonb),to_jsonb(at_text)) end);
   if a is distinct from b then a:=a||jsonb_build_object('revision',app_private.fg_next_revision(b->'revision'),'updated_at',at_text);end if;
   next_h:=case when op='finance.goal.archive' and h->'goal_id'=b->'id' then app_private.fg_highlight_plan(p_user,h,'null'::jsonb,at_text) else h end;
   effects:=app_private.fg_effect('finance_goal',b,a)||app_private.fg_effect('finance_goal_highlight',h,next_h);expected_result:=jsonb_build_object('version',1,'goal',a,'highlight',next_h);
  else raise exception 'Unknown goal plan.' using errcode='22023';end if;
 end if;
 if expected_result is distinct from result then raise exception 'Submitted goal result differs from exact plan.' using errcode='23514';end if;
 return jsonb_build_object('changes',effects,'result',expected_result);
end $$;
do $permissions$ declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='app_private'::regnamespace and proname like 'fg\_%' escape '\' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;end $permissions$;
rollback;
