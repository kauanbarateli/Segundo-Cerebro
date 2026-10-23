-- INERT companion. No hosted execution or activation from CI/build/deploy.
do $draft_only$ begin raise exception 'DRAFT_ONLY: review Finance series readmodels and exact owner unions.';end $draft_only$;
begin;
create function app_private.fsv2_guard(p_user uuid,p_session uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 -- Existing order: Auth parent -> session -> SAME common advisory -> actor/feature.
 perform app_private.finance_guard(p_user,p_session,'read.finance');
end $$;
create function app_private.fsv2_finance_revision(p_user uuid) returns text language sql stable security definer set search_path='' as $$
 select coalesce((select revision::text from app_private.finance_revisions where user_id=p_user),'0');
$$;
create function app_private.fsv2_aggregate(p_user uuid,p_series uuid,p_requested_template jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb;maps jsonb;rows jsonb;accounts jsonb;categories jsonb;tags jsonb;result jsonb;account_ids uuid[];category_ids uuid[];tag_ids uuid[];begin
 select payload into s from app_private.finance_series where user_id=p_user and id=p_series;
 select coalesce(jsonb_agg(payload order by ordinal),'[]') into maps from app_private.finance_series_occurrences where user_id=p_user and series_id=p_series;
 if jsonb_array_length(maps)>120 or s is null and maps<>'[]'::jsonb then raise exception 'Invalid finite series map.' using errcode='23514';end if;
 select coalesce(jsonb_agg(t.payload order by m.ordinal),'[]') into rows from app_private.finance_series_occurrences m
 join public.fin_transactions t on t.user_id=m.user_id and t.id=m.transaction_id where m.user_id=p_user and m.series_id=p_series;
 if jsonb_array_length(rows)<>jsonb_array_length(maps) then raise exception 'Mapped ledger missing.' using errcode='23514';end if;
 -- EXACT union of historical row references + current and requested templates.
 select coalesce(array_agg(distinct id order by id),'{}') into account_ids from (
  select (r->>'account_id')::uuid id from jsonb_array_elements(rows) r
  union select (s#>>'{template,account_id}')::uuid where s is not null
  union select (p_requested_template->>'account_id')::uuid where p_requested_template is not null
 ) wanted where id is not null;
 select coalesce(array_agg(distinct id order by id),'{}') into category_ids from (
  select (r->>'category_id')::uuid id from jsonb_array_elements(rows) r
  union select (s#>>'{template,category_id}')::uuid where s is not null
  union select (p_requested_template->>'category_id')::uuid where p_requested_template is not null
 ) wanted where id is not null;
 select coalesce(array_agg(distinct id order by id),'{}') into tag_ids from (
  select (tag#>>'{}')::uuid id from jsonb_array_elements(rows) r cross join lateral jsonb_array_elements(coalesce(r->'tag_ids','[]')) tag
  union select (tag#>>'{}')::uuid from jsonb_array_elements(coalesce(s#>'{template,tag_ids}','[]')) tag
  union select (tag#>>'{}')::uuid from jsonb_array_elements(coalesce(p_requested_template->'tag_ids','[]')) tag
 ) wanted where id is not null;
 if cardinality(account_ids)>122 or cardinality(category_ids)>122 or cardinality(tag_ids)>3660 then raise exception 'Series references exceed finite bound.' using errcode='54000';end if;
 select coalesce(jsonb_agg(payload order by id),'[]') into accounts from public.fin_accounts where user_id=p_user and id=any(account_ids);
 select coalesce(jsonb_agg(payload order by id),'[]') into categories from public.fin_categories where user_id=p_user and id=any(category_ids);
 select coalesce(jsonb_agg(payload order by id),'[]') into tags from public.fin_tags where user_id=p_user and id=any(tag_ids);
 result:=jsonb_build_object('version',2,'finance_revision',app_private.fsv2_finance_revision(p_user),'series',case when s is null then '[]'::jsonb else jsonb_build_array(s) end,
  'occurrences',maps,'transactions',rows,'accounts',accounts,'categories',categories,'tags',tags);
 if octet_length(result::text)>4194304 then raise exception 'Complete series aggregate exceeds byte quota.' using errcode='54000';end if;return result;
end $$;
create function app_private.fsv2_saved_receipt(p_user uuid,p_command text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$ declare stored app_private.command_receipts;fp text;counts jsonb;v jsonb;begin
 select * into stored from app_private.command_receipts where user_id=p_user and command=p_command and client_id=p_input->>'client_id';
 if not found then return null;end if;
 fp:=stored.request#>>'{}';
 if fp is null or jsonb_typeof(stored.request)<>'string' then raise exception 'Corrupt series receipt.' using errcode='23514';end if;
 if fp::jsonb is distinct from p_input then raise exception 'Series client_id reused.' using errcode='23505';end if;
 perform app_private.fsv2_object(stored.result,array['version','series','affected']);
 if stored.result->'version' is distinct from '2'::jsonb then raise exception 'Corrupt result version.' using errcode='23514';end if;
 perform app_private.fsv2_series(stored.result->'series');
 if stored.result#>>'{series,user_id}' is distinct from p_user::text then raise exception 'Foreign series receipt.' using errcode='42501';end if;
 counts:=stored.result->'affected';perform app_private.fsv2_object(counts,array['created','updated','suppressed','restored','skipped']);
 for v in select value from jsonb_each(counts) loop perform app_private.fsv2_int(v,0,120);end loop;
 return jsonb_build_object('user_id',p_user,'command',p_command,'client_id',p_input->>'client_id','fingerprint',fp,'result',stored.result);
exception when invalid_text_representation then raise exception 'Invalid stored series receipt.' using errcode='23514';end $$;
create function app_private.fsv2_snapshot(p_user uuid,p_session uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$ declare input jsonb;receipt jsonb;result jsonb;wanted jsonb;series_id uuid;begin
 perform app_private.fsv2_guard(p_user,p_session);
 if octet_length(p_request::text)>65536 then raise exception 'Series intent exceeds quota.' using errcode='54000';end if;
 input:=app_private.fsv2_command(p_request);receipt:=app_private.fsv2_saved_receipt(p_user,p_request->>'command',input);
 -- Receipt-first is AFTER authorization, BEFORE current refs/CAS. Never make a
 -- valid replay depend on a now-archived account/category/template.
 if receipt is not null then return jsonb_build_object('version',2,'finance_revision',app_private.fsv2_finance_revision(p_user),
  'series','[]'::jsonb,'occurrences','[]'::jsonb,'transactions','[]'::jsonb,'accounts','[]'::jsonb,'categories','[]'::jsonb,'tags','[]'::jsonb,'receipt',receipt);end if;
 if p_request->>'command'='finance.recurring.create' then wanted:=input#>'{definition,template}';series_id:=null;
 else series_id:=app_private.fsv2_uuid(input->'series_id');wanted:=case when p_request->>'command'='finance.recurring.update_future' then input#>'{patch,template}' else null end;end if;
 result:=app_private.fsv2_aggregate(p_user,series_id,wanted)||jsonb_build_object('receipt',null);
 if octet_length(result::text)>4194304 then raise exception 'Series snapshot exceeds quota.' using errcode='54000';end if;return result;
end $$;
create function app_private.fsv2_detail(p_user uuid,p_session uuid,p_series_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare result jsonb;begin
 perform app_private.fsv2_guard(p_user,p_session);if p_series_id is null then raise exception 'Series identifier required.' using errcode='22023';end if;
 result:=app_private.fsv2_aggregate(p_user,p_series_id,null);if result->'series'='[]'::jsonb then return null;end if;
 if jsonb_array_length(result->'accounts')>121 or jsonb_array_length(result->'categories')>121 or jsonb_array_length(result->'tags')>3630 then raise exception 'Detail references exceed finite bound.' using errcode='54000';end if;
 return jsonb_set(result,'{series}',result->'series'->0);
end $$;
create function app_private.fsv2_page(p_user uuid,p_session uuid,p_cursor uuid,p_limit integer) returns jsonb
language plpgsql security definer set search_path='' as $$ declare items jsonb;begin
 perform app_private.fsv2_guard(p_user,p_session);if p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid series page limit.' using errcode='22023';end if;
 select coalesce(jsonb_agg(payload order by id),'[]') into items from (select id,payload from app_private.finance_series where user_id=p_user and (p_cursor is null or id>p_cursor) order by id limit p_limit+1) page;
 return jsonb_build_object('version',2,'finance_revision',app_private.fsv2_finance_revision(p_user),
  'items',case when jsonb_array_length(items)>p_limit then items-p_limit else items end,'next_cursor',case when jsonb_array_length(items)>p_limit then items->(p_limit-1)->>'id' else null end);
end $$;
create function public.finance_series_snapshot(p_user uuid,p_session uuid,p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$select app_private.fsv2_snapshot(p_user,p_session,p_request);$$;
create function public.finance_series_detail(p_user uuid,p_session uuid,p_series_id uuid) returns jsonb language sql security invoker set search_path='' as $$select app_private.fsv2_detail(p_user,p_session,p_series_id);$$;
create function public.finance_series_page(p_user uuid,p_session uuid,p_cursor uuid,p_limit integer) returns jsonb language sql security invoker set search_path='' as $$select app_private.fsv2_page(p_user,p_session,p_cursor,p_limit);$$;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname like 'fsv2_%' or n.nspname='public' and p.proname in ('finance_series_snapshot','finance_series_detail','finance_series_page') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.proname in ('fsv2_snapshot','fsv2_detail','fsv2_page','finance_series_snapshot','finance_series_detail','finance_series_page') then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end $$;
rollback;
