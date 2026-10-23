-- INERT. Complete indexed aggregates and finite pages; no historical seed.
do $draft_only$ begin raise exception 'DRAFT_ONLY: Goals reads require independent review and supervised promotion.';end $draft_only$;
begin;
create function app_private.fg_guard(p_user uuid,p_session uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform app_private.finance_guard(p_user,p_session,'read.finance');
end $$;
create function app_private.fg_finance_revision(p_user uuid) returns text language sql stable security definer set search_path='' as $$
 select coalesce((select revision::text from app_private.finance_revisions where user_id=p_user),'0');
$$;
create function app_private.fg_bound(p jsonb) returns jsonb language plpgsql immutable set search_path='' as $$ begin if octet_length(p::text)>524288 then raise exception 'Goal read exceeds finite transport quota.' using errcode='54000';end if;return p;end $$;
create function app_private.fg_released(p_user uuid,p_reservation uuid) returns bigint language sql stable security definer set search_path='' as $$
 select app_private.fg_cents(coalesce(sum(amount_cents::numeric),0)) from app_private.finance_goal_releases where user_id=p_user and reservation_id=p_reservation;
$$;
create function app_private.fg_reserved(p_user uuid,p_account uuid default null,p_goal uuid default null) returns bigint language sql stable security definer set search_path='' as $$
 select app_private.fg_cents(coalesce(sum(r.amount_cents::numeric-coalesce(released.amount,0)),0))
 from app_private.finance_goal_reservations r left join lateral (
  select sum(l.amount_cents::numeric) amount from app_private.finance_goal_releases l where l.user_id=r.user_id and l.reservation_id=r.id
 ) released on true where r.user_id=p_user and (p_account is null or r.account_id=p_account) and (p_goal is null or r.goal_id=p_goal);
$$;
create function app_private.fg_goal_totals(p_user uuid,p_goal uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('user_id',p_user,'goal_id',p_goal,'finance_revision',app_private.fg_finance_revision(p_user),'saved_cents',app_private.fg_reserved(p_user,null,p_goal));
$$;
create function app_private.fg_release_totals(p_user uuid,p_reservation uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('user_id',p_user,'reservation_id',p_reservation,'finance_revision',app_private.fg_finance_revision(p_user),'released_cents',app_private.fg_released(p_user,p_reservation));
$$;
create function app_private.fg_account_totals(p_user uuid,p_account uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$ declare a public.fin_accounts;real_value numeric;begin
 select * into a from public.fin_accounts where user_id=p_user and id=p_account;if not found then return null;end if;
 -- Exact equivalent of saldosFinanceiros/fin_account_balances. No reserve or
 -- invoice is deducted from the real balance. Partial paid values are preserved.
 select a.opening_balance_cents::numeric+coalesce(sum((case when t.kind='income' then 1 else -1 end)::numeric*(case when a.kind='credit_card' then t.amount_cents else t.paid_cents end)::numeric),0)
 into real_value from public.fin_transactions t where t.user_id=p_user and t.account_id=p_account and t.deleted_at is null and t.status in ('confirmed','reconciled');
 return jsonb_build_object('user_id',p_user,'account_id',p_account,'finance_revision',app_private.fg_finance_revision(p_user),'real_balance_cents',app_private.fg_cents(real_value,-9007199254740991),'reserved_cents',app_private.fg_reserved(p_user,p_account,null));
end $$;
-- Explicit fail-closed media boundary. Existing file kinds are drive,
-- capture_image/avatar; none proves finance_goal_image. No fabricated metadata.
-- A later reviewed media package must replace this lookup with its exact,
-- owner/finalization/deletion-aware source before non-null new images can pass.
create function app_private.fg_image(p_user uuid,p_file uuid) returns jsonb language sql stable security definer set search_path='' as $$ select null::jsonb; $$;
create function app_private.fg_saved_receipt(p_user uuid,p_command text,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare saved app_private.command_receipts;fp text;begin
 select * into saved from app_private.command_receipts where user_id=p_user and command=p_command and client_id=p_input->>'client_id';if not found then return null;end if;
 if jsonb_typeof(saved.request) is distinct from 'string' then raise exception 'Malformed goal receipt.' using errcode='23514';end if;fp:=saved.request#>>'{}';
 if fp::jsonb is distinct from p_input then raise exception 'Goal client_id reused with different input.' using errcode='23505';end if;
 -- Full command/result binding is checked by fg_result (03), independent of
 -- current Meta/Conta/image/CAS. This is safe even after references change.
 perform app_private.fg_result(p_user,p_command,p_input,saved.result);
 return jsonb_build_object('user_id',p_user,'command',p_command,'client_id',p_input->>'client_id','fingerprint',fp,'result',saved.result);
end $$;
create function app_private.fg_snapshot(p_user uuid,p_session uuid,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare input jsonb;op text;receipt jsonb;g jsonb;r jsonb;h jsonb;a jsonb;image jsonb;result jsonb;goal_id uuid;image_id uuid;begin
 perform app_private.fg_guard(p_user,p_session);if octet_length(p_request::text)>65536 then raise exception 'Goal intent exceeds quota.' using errcode='54000';end if;
 input:=app_private.fg_command(p_request);op:=p_request->>'command';receipt:=app_private.fg_saved_receipt(p_user,op,input);
 result:=jsonb_build_object('version',1,'finance_revision',app_private.fg_finance_revision(p_user),'goals','[]'::jsonb,'reservations','[]'::jsonb,'highlights','[]'::jsonb,'accounts','[]'::jsonb,'images','[]'::jsonb,'account_totals','[]'::jsonb,'goal_totals','[]'::jsonb,'release_totals','[]'::jsonb,'receipt',receipt);
 if receipt is not null then return app_private.fg_bound(result);end if;
 if op='finance.goal.release' then
  select payload into r from app_private.finance_goal_reservations where user_id=p_user and id=(input->>'reservation_id')::uuid;
  if r is not null then result:=result||jsonb_build_object('reservations',jsonb_build_array(r),'release_totals',jsonb_build_array(app_private.fg_release_totals(p_user,(r->>'id')::uuid)));end if;
  return app_private.fg_bound(result);
 end if;
 goal_id:=(input->>'goal_id')::uuid;if goal_id is not null then select payload into g from app_private.finance_goals where user_id=p_user and id=goal_id;end if;
 if g is not null then result:=jsonb_set(result,'{goals}',jsonb_build_array(g));end if;
 if op in ('finance.goal.archive','finance.goal.restore','finance.goal.highlight') then
  select payload into h from app_private.finance_goal_highlights where user_id=p_user;if h is not null then result:=jsonb_set(result,'{highlights}',jsonb_build_array(h));end if;
 end if;
 if op='finance.goal.contribute' then
  select jsonb_build_object('id',id,'user_id',user_id,'kind',kind,'currency',currency,'archived_at',payload->'archived_at') into a from public.fin_accounts where user_id=p_user and id=(input->>'account_id')::uuid;
  if a is not null then result:=result||jsonb_build_object('accounts',jsonb_build_array(a),'account_totals',jsonb_build_array(app_private.fg_account_totals(p_user,(a->>'id')::uuid)));end if;
  if g is not null then result:=jsonb_set(result,'{goal_totals}',jsonb_build_array(app_private.fg_goal_totals(p_user,goal_id)));end if;
 end if;
 if op='finance.goal.create' then image_id:=(input->>'image_file_id')::uuid;
 elsif op='finance.goal.update' and input->'patch' ? 'image_file_id' and input#>'{patch,image_file_id}' is distinct from g->'image_file_id' then image_id:=(input#>>'{patch,image_file_id}')::uuid;end if;
 if image_id is not null then image:=app_private.fg_image(p_user,image_id);if image is not null then result:=jsonb_set(result,'{images}',jsonb_build_array(image));end if;end if;
 return app_private.fg_bound(result);
end $$;
create function app_private.fg_page(p_user uuid,p_session uuid,p_cursor uuid,p_limit integer,p_archived text) returns jsonb language plpgsql security definer set search_path='' as $$ declare rows jsonb;items jsonb;h jsonb;next_id uuid;begin
 perform app_private.fg_guard(p_user,p_session);if p_limit not between 1 and 50 or p_limit is null or p_archived is null or p_archived not in ('active','archived','all') then raise exception 'Invalid goal page.' using errcode='22023';end if;
 select coalesce(jsonb_agg(q.payload order by q.id),'[]') into rows from (select id,payload from app_private.finance_goals where user_id=p_user and (p_cursor is null or id>p_cursor) and (p_archived='all' or (archived_at is null)=(p_archived='active')) order by id limit p_limit+1) q;
 if jsonb_array_length(rows)>p_limit then rows:=rows-(jsonb_array_length(rows)-1);next_id:=(rows#>>array[(p_limit-1)::text,'id'])::uuid;end if;
 select coalesce(jsonb_agg(jsonb_build_object('goal',g.value,'totals',app_private.fg_goal_totals(p_user,(g.value->>'id')::uuid)) order by g.value->>'id'),'[]') into items from jsonb_array_elements(rows) g(value);
 select payload into h from app_private.finance_goal_highlights where user_id=p_user;
 return app_private.fg_bound(jsonb_build_object('version',1,'finance_revision',app_private.fg_finance_revision(p_user),'items',items,'highlight',h,'next_cursor',next_id));
end $$;
create function app_private.fg_detail(p_user uuid,p_session uuid,p_goal uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare g jsonb;h jsonb;begin
 perform app_private.fg_guard(p_user,p_session);select payload into g from app_private.finance_goals where user_id=p_user and id=p_goal;if g is null then return null;end if;
 select payload into h from app_private.finance_goal_highlights where user_id=p_user;return app_private.fg_bound(jsonb_build_object('version',1,'finance_revision',app_private.fg_finance_revision(p_user),'goal',g,'totals',app_private.fg_goal_totals(p_user,p_goal),'highlight',h));
end $$;
create function app_private.fg_history(p_user uuid,p_session uuid,p_id uuid,p_cursor jsonb,p_limit integer,p_release boolean) returns jsonb language plpgsql security definer set search_path='' as $$ declare since timestamptz;since_id uuid;rows jsonb;items jsonb;next_cursor jsonb;begin
 perform app_private.fg_guard(p_user,p_session);if p_limit not between 1 and 50 or p_limit is null or p_id is null or p_release is null then raise exception 'Invalid goal history page.' using errcode='22023';end if;
 if p_cursor is not null and p_cursor<>'null'::jsonb then perform app_private.fg_object(p_cursor,array['created_at','id']);since:=app_private.capture_task_timestamp(p_cursor->'created_at');since_id:=app_private.fg_uuid(p_cursor->'id');end if;
 if p_release then
  select coalesce(jsonb_agg(q.payload order by q.created_at,q.id),'[]') into rows from (select id,created_at,payload from app_private.finance_goal_releases where user_id=p_user and reservation_id=p_id and (since is null or (created_at,id)>(since,since_id)) order by created_at,id limit p_limit+1) q;
 else
  select coalesce(jsonb_agg(q.payload order by q.created_at,q.id),'[]') into rows from (select id,created_at,payload from app_private.finance_goal_reservations where user_id=p_user and goal_id=p_id and (since is null or (created_at,id)>(since,since_id)) order by created_at,id limit p_limit+1) q;
 end if;
 if jsonb_array_length(rows)>p_limit then rows:=rows-(jsonb_array_length(rows)-1);next_cursor:=jsonb_build_object('created_at',rows#>array[(p_limit-1)::text,'created_at'],'id',rows#>array[(p_limit-1)::text,'id']);end if;
 if p_release then items:=rows;else
  select coalesce(jsonb_agg(jsonb_build_object('reservation',r.value,'totals',app_private.fg_release_totals(p_user,(r.value->>'id')::uuid)) order by app_private.capture_task_timestamp(r.value->'created_at'),r.value->>'id'),'[]') into items from jsonb_array_elements(rows) r(value);
 end if;
 return app_private.fg_bound(jsonb_build_object('version',1,'finance_revision',app_private.fg_finance_revision(p_user),'items',items,'next_cursor',next_cursor));
end $$;
create function public.finance_goals_snapshot(p_user uuid,p_session uuid,p_request jsonb) returns jsonb language sql security definer set search_path='' as $$ select app_private.fg_snapshot(p_user,p_session,p_request); $$;
create function public.finance_goals_page(p_user uuid,p_session uuid,p_cursor uuid,p_limit integer,p_archived text) returns jsonb language sql security definer set search_path='' as $$ select app_private.fg_page(p_user,p_session,p_cursor,p_limit,p_archived); $$;
create function public.finance_goal_detail(p_user uuid,p_session uuid,p_goal uuid) returns jsonb language sql security definer set search_path='' as $$ select app_private.fg_detail(p_user,p_session,p_goal); $$;
create function public.finance_goal_reservations_page(p_user uuid,p_session uuid,p_goal uuid,p_cursor jsonb,p_limit integer) returns jsonb language sql security definer set search_path='' as $$ select app_private.fg_history(p_user,p_session,p_goal,p_cursor,p_limit,false); $$;
create function public.finance_goal_releases_page(p_user uuid,p_session uuid,p_reservation uuid,p_cursor jsonb,p_limit integer) returns jsonb language sql security definer set search_path='' as $$ select app_private.fg_history(p_user,p_session,p_reservation,p_cursor,p_limit,true); $$;
revoke all on function public.finance_goals_snapshot(uuid,uuid,jsonb),public.finance_goals_page(uuid,uuid,uuid,integer,text),public.finance_goal_detail(uuid,uuid,uuid),public.finance_goal_reservations_page(uuid,uuid,uuid,jsonb,integer),public.finance_goal_releases_page(uuid,uuid,uuid,jsonb,integer) from public,anon,authenticated,service_role;
grant execute on function public.finance_goals_snapshot(uuid,uuid,jsonb),public.finance_goals_page(uuid,uuid,uuid,integer,text),public.finance_goal_detail(uuid,uuid,uuid),public.finance_goal_reservations_page(uuid,uuid,uuid,jsonb,integer),public.finance_goal_releases_page(uuid,uuid,uuid,jsonb,integer) to service_role;
do $permissions$ declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='app_private'::regnamespace and proname like 'fg\_%' escape '\' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;end $permissions$;
rollback;
