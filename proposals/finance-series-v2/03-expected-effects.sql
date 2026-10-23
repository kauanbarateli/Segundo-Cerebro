-- INERT independent effects oracle; no arbitrary batch validation by AFTER alone.
do $draft_only$ begin raise exception 'DRAFT_ONLY: review finite Finance series effects against Core B2.';end $draft_only$;
begin;
create function app_private.fsv2_normal_template(t jsonb) returns jsonb language sql immutable set search_path='' as $$
 select t||jsonb_build_object('description',app_private.fsv2_trim(t->>'description'),'payee',nullif(app_private.fsv2_trim(t->>'payee'),''),'notes',nullif(app_private.fsv2_trim(t->>'notes'),''));
$$;
create function app_private.fsv2_template_refs(p_user uuid,t jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare account jsonb;begin
 select payload into account from public.fin_accounts where user_id=p_user and id=(t->>'account_id')::uuid;
 if account is null or account->'archived_at'<>'null'::jsonb or account->>'currency'<>'BRL' then raise exception 'Series account unavailable.' using errcode='23503';end if;
 if (account->>'kind'='credit_card') is distinct from (t->>'statement_mode'<>'none') then raise exception 'Statement mode outside account kind.' using errcode='23514';end if;
 if t->'category_id'<>'null'::jsonb and not exists(select 1 from public.fin_categories where user_id=p_user and id=(t->>'category_id')::uuid and kind=t->>'kind') then raise exception 'Series category unavailable.' using errcode='23503';end if;
 if exists(select 1 from jsonb_array_elements_text(t->'tag_ids') tag where not exists(select 1 from public.fin_tags where user_id=p_user and id=tag::uuid)) then raise exception 'Series tag unavailable.' using errcode='23503';end if;return account;
end $$;
create function app_private.fsv2_bound_map(s jsonb) returns void language plpgsql security definer set search_path='' as $$ declare m record;r jsonb;a jsonb;last_day date;seen integer:=0;begin
 for m in select * from app_private.finance_series_occurrences where user_id=(s->>'user_id')::uuid and series_id=(s->>'id')::uuid order by ordinal loop
  seen:=seen+1;if seen>120 then raise exception 'Series map exceeds bound.' using errcode='23514';end if;
  select payload into r from public.fin_transactions where user_id=m.user_id and id=m.transaction_id;select payload into a from public.fin_accounts where user_id=m.user_id and id=(r->>'account_id')::uuid;
  if r is null or a is null or r->>'user_id' is distinct from s->>'user_id' or r->>'installment_group_id' is distinct from s->>'id'
   or r->>'installment_no' is distinct from m.ordinal::text or r->'installment_total' is distinct from s->'total' or r->'serie_tipo' is distinct from s->'kind'
   or r->>'kind' is distinct from s#>>'{template,kind}' or r->'transfer_group_id'<>'null'::jsonb or r->>'occurred_on' is distinct from to_char(m.occurred_on,'YYYY-MM-DD')
   or m.occurred_on<>app_private.fsv2_day_at(s,m.ordinal) or (m.suppression='none') is distinct from (r->'deleted_at'='null'::jsonb)
   or m.ordinal>=(s->>'next_index')::integer or app_private.fsv2_revision(m.payload->'configuration_revision')>app_private.fsv2_revision(s->'revision') then raise exception 'Series/occurrence/ledger binding diverged.' using errcode='23514';end if;
  last_day:=greatest(last_day,m.occurred_on);
 end loop;
 if to_jsonb(to_char(last_day,'YYYY-MM-DD')) is distinct from nullif(s->'materialized_through','null'::jsonb) then raise exception 'Materialized cursor diverged.' using errcode='23514';end if;
end $$;
create function app_private.fsv2_eligible(s jsonb,m jsonb,r jsonb,a jsonb,action text,today date,boundary date) returns boolean language plpgsql immutable set search_path='' as $$ declare card_projection boolean;begin
 if boundary<today then raise exception 'Series boundary precedes today.' using errcode='23514';end if;
 if s->>'state'='ended' or action='pause' and s->>'state'<>'active' or action='resume' and s->>'state'<>'paused' or app_private.fsv2_day(r->>'occurred_on')<boundary
  or r->>'status' in ('confirmed','reconciled','cancelled') then return false;end if;
 card_projection:=a->>'kind'='credit_card' and r->>'kind'='expense' and r->>'status' in ('planned','pending') and r->'paid_cents'=r->'amount_cents';
 if (r->>'paid_cents')::bigint<>0 and not card_projection then return false;end if;
 if action='resume' then return m->>'suppression'='series_pause';end if;
 return m->>'suppression'='none' or m->>'suppression'='series_pause' and s->>'state'='paused' and action in ('update_future','end','cancel');
end $$;
create function app_private.fsv2_amount(s jsonb,idx integer) returns bigint language sql immutable set search_path='' as $$
 select case when s->>'kind'='parcelamento' then (case when idx=(s->>'total')::integer then (s#>>'{template,amount_cents}')::bigint-((s#>>'{template,amount_cents}')::bigint/(s->>'total')::integer)*((s->>'total')::integer-1) else (s#>>'{template,amount_cents}')::bigint/(s->>'total')::integer end) else (s#>>'{template,amount_cents}')::bigint end;
$$;
create function app_private.fsv2_statement(day date,closing_day integer) returns text language plpgsql immutable set search_path='' as $$ declare month date;last_n integer;begin
 if closing_day is null or closing_day not between 1 and 31 then raise exception 'Card closing day required.' using errcode='23514';end if;
 month:=make_date(extract(year from day)::integer,extract(month from day)::integer,1);
 last_n:=extract(day from (month+interval '1 month'-interval '1 day'))::integer;
 if extract(day from day)>=least(closing_day,last_n) then month:=app_private.fsv2_months(month,1);end if;return to_char(month,'YYYY-MM-DD');
end $$;
create function app_private.fsv2_change(changes jsonb,kind text,b jsonb,a jsonb) returns jsonb language sql immutable set search_path='' as $$
 select case when b is not distinct from a then changes else changes||jsonb_build_array(jsonb_build_object('type',kind,'before',b,'after',a)) end;
$$;

-- Builds the WHOLE expected effect set, including eligible rows a malicious
-- batch could omit. Only new UUID identities are borrowed from the submitted
-- map at an exact required ordinal; all other fields derive from intent/DB.
create function app_private.fsv2_expected(p_user uuid,operation text,input jsonb,submitted jsonb,submitted_result jsonb,at_text text,today date) returns jsonb
language plpgsql security definer set search_path='' as $$
<<effect_plan>>
declare before_s jsonb;s jsonb;t jsonb;current_t jsonb;account jsonb;old_account jsonb;row_b jsonb;row_a jsonb;map_b jsonb;map_a jsonb;
 expected jsonb:='[]';counts jsonb:=jsonb_build_object('created',0,'updated',0,'suppressed',0,'restored',0,'skipped',0);
 maps record;idx integer;next_idx integer;day date;boundary date;last_day date;end_day date;statement text;assignments jsonb;assignment jsonb;remaining jsonb:='[]';amount bigint;eligible boolean;
 series_id uuid;row_id uuid;map_id uuid;new_revision text;changed boolean:=false;will_touch boolean:=false;plan_new boolean:=false;restoring boolean:=false;template_changed boolean:=false;n integer;pick jsonb;
begin
 perform app_private.fsv2_object(submitted_result,array['version','series','affected']);if submitted_result->'version' is distinct from '2'::jsonb then raise exception 'Invalid series result version.' using errcode='23514';end if;
 perform app_private.fsv2_series(submitted_result->'series');series_id:=app_private.fsv2_uuid(submitted_result#>'{series,id}');
 if operation='finance.recurring.create' then
  if exists(select 1 from app_private.finance_series where id=series_id) or exists(select 1 from public.fin_transactions where installment_group_id=series_id) then raise exception 'New series identity already used.' using errcode='23505';end if;
  s:=input->'definition';s:=s||jsonb_build_object('template',app_private.fsv2_normal_template(s->'template'),'version',2,'id',series_id,'user_id',p_user,'state','active','revision','0','next_index',(s->>'first_index')::integer,'materialized_through',null,'created_at',at_text,'updated_at',at_text);
  before_s:=null;plan_new:=true;account:=app_private.fsv2_template_refs(p_user,s->'template');
 else
  if series_id<>app_private.fsv2_uuid(input->'series_id') then raise exception 'Result identifies another series.' using errcode='23514';end if;
  select payload into before_s from app_private.finance_series where user_id=p_user and id=series_id for update;
  if before_s is null then raise exception 'Series unavailable.' using errcode='23503';end if;
  if before_s->>'revision' is distinct from input->>'expected_revision' then raise exception 'Series revision changed.' using errcode='40001';end if;
  perform app_private.fsv2_bound_map(before_s);s:=before_s;
  if operation='finance.recurring.materialize' then
   if s->>'state'<>'active' then raise exception 'Series is not active.' using errcode='23514';end if;plan_new:=true;account:=app_private.fsv2_template_refs(p_user,s->'template');
  elsif operation='finance.recurring.resume' then
   if s->>'state'<>'paused' then raise exception 'Series is not paused.' using errcode='23514';end if;
   s:=s||jsonb_build_object('state','active');restoring:=true;plan_new:=true;account:=app_private.fsv2_template_refs(p_user,s->'template');
  elsif operation in ('finance.recurring.pause','finance.recurring.end') then
   if operation='finance.recurring.pause' and s->>'state'<>'active' or operation='finance.recurring.end' and s->>'state'='ended' then raise exception 'Series state refuses suppression.' using errcode='23514';end if;
   boundary:=app_private.fsv2_day(input->>'from_on');if boundary<today then raise exception 'Series boundary precedes today.' using errcode='23514';end if;
   s:=s||jsonb_build_object('state',case when operation='finance.recurring.pause' then 'paused' else 'ended' end);
  elsif operation='finance.recurring.update_future' then
   boundary:=app_private.fsv2_day(input->>'from_on');if s->>'state'='ended' or boundary<today then raise exception 'Future edit outside permitted state/day.' using errcode='23514';end if;
   t:=case when (input->'patch') ? 'template' then app_private.fsv2_normal_template(input#>'{patch,template}') else s->'template' end;
   if t->'kind' is distinct from s#>'{template,kind}' or s->>'kind'='parcelamento' and t->'amount_cents' is distinct from s#>'{template,amount_cents}' then raise exception 'Series kind/original installment total immutable.' using errcode='23514';end if;
   if (input->'patch') ? 'ends_on' then s:=jsonb_set(s,'{ends_on}',input#>'{patch,ends_on}');end if;
   if s->'ends_on'<>'null'::jsonb and app_private.fsv2_day(s->>'ends_on')<boundary then raise exception 'End precedes future-edit boundary.' using errcode='23514';end if;
   template_changed:=(input->'patch') ? 'template';s:=jsonb_set(s,'{template}',t);
   if template_changed then account:=app_private.fsv2_template_refs(p_user,t);end if;
   assignments:=input->'statement_assignments';
   if assignments<>'[]'::jsonb and (not template_changed or t->>'statement_mode'<>'explicit') then raise exception 'Assignments outside explicit template edit.' using errcode='23514';end if;
   remaining:=assignments;
  end if;
 end if;
 current_t:=s->'template';
 if restoring or operation in ('finance.recurring.pause','finance.recurring.end','finance.recurring.update_future','finance.recurring.occurrence.cancel','finance.recurring.occurrence.update') then
  if operation like 'finance.recurring.occurrence.%' and not exists(select 1 from app_private.finance_series_occurrences o where o.user_id=p_user and o.series_id=effect_plan.series_id and o.id=(input->>'occurrence_id')::uuid) then raise exception 'Occurrence unavailable.' using errcode='23503';end if;
  for maps in select o.payload from app_private.finance_series_occurrences o where o.user_id=p_user and o.series_id=effect_plan.series_id order by o.ordinal loop
   map_b:=maps.payload;select payload into row_b from public.fin_transactions where user_id=p_user and id=(map_b->>'transaction_id')::uuid;
   select payload into old_account from public.fin_accounts where user_id=p_user and id=(row_b->>'account_id')::uuid;
   row_a:=row_b;map_a:=map_b;
   if restoring then
    eligible:=app_private.fsv2_eligible(before_s,map_b,row_b,old_account,'resume',today,today);
    if eligible then
     if old_account->'archived_at'<>'null'::jsonb then raise exception 'Paused occurrence account archived.' using errcode='23503';end if;
     row_a:=row_b||jsonb_build_object('deleted_at',null,'updated_at',at_text);map_a:=map_b||jsonb_build_object('suppression','none','updated_at',at_text);
     counts:=jsonb_set(counts,'{restored}',to_jsonb((counts->>'restored')::integer+1));
    else counts:=jsonb_set(counts,'{skipped}',to_jsonb((counts->>'skipped')::integer+1));end if;
   elsif operation in ('finance.recurring.pause','finance.recurring.end') then
    eligible:=app_private.fsv2_eligible(before_s,map_b,row_b,old_account,case when operation='finance.recurring.pause' then 'pause' else 'end' end,today,boundary);
    if eligible then
     if row_b->'deleted_at'='null'::jsonb then row_a:=row_b||jsonb_build_object('deleted_at',at_text,'updated_at',at_text);counts:=jsonb_set(counts,'{suppressed}',to_jsonb((counts->>'suppressed')::integer+1));end if;
     map_a:=map_b||jsonb_build_object('suppression',case when operation='finance.recurring.pause' then 'series_pause' else 'ended' end,'updated_at',at_text);
    else counts:=jsonb_set(counts,'{skipped}',to_jsonb((counts->>'skipped')::integer+1));end if;
   elsif operation='finance.recurring.update_future' then
    eligible:=app_private.fsv2_eligible(before_s,map_b,row_b,old_account,'update_future',today,boundary);
    end_day:=case when s->'ends_on'<>'null'::jsonb then app_private.fsv2_day(s->>'ends_on') else null end;
    if end_day is not null and app_private.fsv2_day(row_b->>'occurred_on')>end_day and map_b->>'suppression'='none' and not eligible then raise exception 'End would remove protected history.' using errcode='23514';end if;
    if not eligible then counts:=jsonb_set(counts,'{skipped}',to_jsonb((counts->>'skipped')::integer+1));
    elsif end_day is not null and app_private.fsv2_day(row_b->>'occurred_on')>end_day then
     if row_b->'deleted_at'='null'::jsonb then row_a:=row_b||jsonb_build_object('deleted_at',at_text,'updated_at',at_text);counts:=jsonb_set(counts,'{suppressed}',to_jsonb((counts->>'suppressed')::integer+1));end if;
     map_a:=map_b||jsonb_build_object('suppression','ended','updated_at',at_text);
    elsif not template_changed then counts:=jsonb_set(counts,'{skipped}',to_jsonb((counts->>'skipped')::integer+1));
    else
     statement:=row_b->>'statement_month';assignment:=null;
     select value into assignment from jsonb_array_elements(remaining) a where a->'index'=map_b->'index';
     if account->>'kind'<>'credit_card' then statement:=null;
     elsif assignment is not null then statement:=assignment->>'statement_month';remaining:=coalesce((select jsonb_agg(value order by (value->>'index')::integer) from jsonb_array_elements(remaining) a where a->'index'<>map_b->'index'),'[]');
     elsif account->>'id' is distinct from row_b->>'account_id' then
      if current_t->>'statement_mode'<>'account_cycle' then raise exception 'Changed card requires explicit statement assignments.' using errcode='23514';end if;
      statement:=app_private.fsv2_statement(app_private.fsv2_day(row_b->>'occurred_on'),(account->>'statement_closing_day')::integer);
     end if;
     if account->>'kind'='credit_card' and statement is null then raise exception 'Card statement required.' using errcode='23514';end if;
     amount:=app_private.fsv2_amount(s,(map_b->>'index')::integer);
     row_a:=row_b||jsonb_build_object('account_id',current_t->'account_id','category_id',current_t->'category_id','description',current_t->'description','payee',current_t->'payee','notes',current_t->'notes','tag_ids',current_t->'tag_ids','amount_cents',amount,'paid_cents',case when account->>'kind'='credit_card' and current_t->>'kind'='expense' then amount else 0 end,'statement_month',statement);
     if row_a is distinct from row_b then
      row_a:=row_a||jsonb_build_object('updated_at',at_text);map_a:=map_b||jsonb_build_object('configuration_revision',(app_private.fsv2_revision(before_s->'revision')+1)::text,'updated_at',at_text);
      counts:=jsonb_set(counts,'{updated}',to_jsonb((counts->>'updated')::integer+1));
     end if;
    end if;
   elsif map_b->'id'=input->'occurrence_id' then
    if operation='finance.recurring.occurrence.cancel' then
     if map_b->>'suppression'='manual' then counts:=jsonb_set(counts,'{skipped}','1');
     else
      if not app_private.fsv2_eligible(before_s,map_b,row_b,old_account,'cancel',today,today) then raise exception 'Protected occurrence cannot be cancelled.' using errcode='23514';end if;
      if row_b->'deleted_at'='null'::jsonb then row_a:=row_b||jsonb_build_object('deleted_at',at_text,'updated_at',at_text);counts:=jsonb_set(counts,'{suppressed}','1');end if;
      map_a:=map_b||jsonb_build_object('suppression','manual','updated_at',at_text);
     end if;
    else
     if old_account->'archived_at'<>'null'::jsonb or map_b->>'suppression'<>'none' or row_b->'deleted_at'<>'null'::jsonb or row_b->>'status'='cancelled'
      or (input#>>'{patch,paid_cents}')::bigint<(row_b->>'paid_cents')::bigint or (input#>>'{patch,paid_cents}')::bigint>(row_b->>'amount_cents')::bigint
      or row_b->>'status'='reconciled' and input#>>'{patch,status}'<>'reconciled'
      or old_account->>'kind'='credit_card' and row_b->>'kind'='expense' and input#>'{patch,paid_cents}' is distinct from row_b->'amount_cents' then raise exception 'Realization changes protected payment.' using errcode='23514';end if;
     row_a:=row_b||(input->'patch');if row_a is distinct from row_b then row_a:=row_a||jsonb_build_object('updated_at',at_text);counts:=jsonb_set(counts,'{updated}','1');end if;
    end if;
   end if;
   expected:=app_private.fsv2_change(expected,'finance_transaction',row_b,row_a);expected:=app_private.fsv2_change(expected,'finance_series_occurrence',map_b,map_a);
  end loop;
  if operation='finance.recurring.update_future' and remaining<>'[]'::jsonb then raise exception 'Statement assignment targets protected/nonexistent occurrence.' using errcode='23514';end if;
 end if;
 if plan_new then
  if app_private.fsv2_day(input#>>'{horizon,from_on}')<today then raise exception 'Creation horizon precedes today.' using errcode='23514';end if;
  assignments:=input->'statement_assignments';remaining:=assignments;
  if current_t->>'statement_mode'<>'explicit' and remaining<>'[]'::jsonb then raise exception 'Assignments outside explicit statement mode.' using errcode='23514';end if;
  next_idx:=(s->>'next_index')::integer;last_day:=case when s->'materialized_through'<>'null'::jsonb then app_private.fsv2_day(s->>'materialized_through') else null end;
  while next_idx<=(s->>'total')::integer loop
   idx:=next_idx;day:=app_private.fsv2_day_at(s,idx);
   exit when s->'ends_on'<>'null'::jsonb and day>app_private.fsv2_day(s->>'ends_on');
   exit when day>=app_private.fsv2_day(input#>>'{horizon,until_exclusive}');
   next_idx:=idx+1;
   if day<app_private.fsv2_day(input#>>'{horizon,from_on}') then counts:=jsonb_set(counts,'{skipped}',to_jsonb((counts->>'skipped')::integer+1));continue;end if;
   select count(*),jsonb_agg(c->'after')->0 into n,pick from jsonb_array_elements(submitted) c where c->>'type'='finance_series_occurrence' and c#>'{after,index}'=to_jsonb(idx) and c#>>'{after,series_id}'=series_id::text;
   if n<>1 then raise exception 'Required finite occurrence omitted/repeated.' using errcode='23514';end if;
   map_id:=app_private.fsv2_uuid(pick->'id');row_id:=app_private.fsv2_uuid(pick->'transaction_id');statement:=null;
   if account->>'kind'='credit_card' then
    if current_t->>'statement_mode'='account_cycle' then statement:=app_private.fsv2_statement(day,(account->>'statement_closing_day')::integer);
    else
     select value into assignment from jsonb_array_elements(remaining) a where a->>'index'=idx::text;
     if assignment is null then raise exception 'Explicit card statement missing.' using errcode='23514';end if;statement:=assignment->>'statement_month';
     remaining:=coalesce((select jsonb_agg(value order by (value->>'index')::integer) from jsonb_array_elements(remaining) a where a->>'index'<>idx::text),'[]');
    end if;
   end if;
   amount:=app_private.fsv2_amount(s,idx);
   row_a:=jsonb_build_object('id',row_id,'user_id',p_user,'account_id',current_t->'account_id','category_id',current_t->'category_id','kind',current_t->'kind','amount_cents',amount,'paid_cents',case when account->>'kind'='credit_card' and current_t->>'kind'='expense' then amount else 0 end,
    'description',current_t->'description','payee',current_t->'payee','notes',current_t->'notes','tag_ids',current_t->'tag_ids','occurred_on',to_char(day,'YYYY-MM-DD'),'due_date',to_char(day,'YYYY-MM-DD'),'statement_month',statement,'status','planned','source',case when s->>'kind'='recorrencia' then 'recurring' else 'manual' end,
    'installment_group_id',series_id,'installment_no',idx,'installment_total',s->'total','serie_tipo',s->'kind','transfer_group_id',null,'deleted_at',null,'created_at',at_text,'updated_at',at_text);
   map_a:=jsonb_build_object('id',map_id,'user_id',p_user,'series_id',series_id,'index',idx,'transaction_id',row_id,'occurred_on',to_char(day,'YYYY-MM-DD'),'suppression','none','configuration_revision',case when before_s is null then '0' else (app_private.fsv2_revision(before_s->'revision')+1)::text end,'created_at',at_text,'updated_at',at_text);
   expected:=app_private.fsv2_change(expected,'finance_transaction',null,row_a);expected:=app_private.fsv2_change(expected,'finance_series_occurrence',null,map_a);
   last_day:=greatest(last_day,day);counts:=jsonb_set(counts,'{created}',to_jsonb((counts->>'created')::integer+1));
  end loop;
  if remaining<>'[]'::jsonb or (counts->>'created')::integer>53 then raise exception 'Unexpected statement assignment/materialization count.' using errcode='23514';end if;
  s:=s||jsonb_build_object('next_index',next_idx,'materialized_through',to_char(last_day,'YYYY-MM-DD'));
 end if;
 if before_s is not null and (s is distinct from before_s or expected<>'[]'::jsonb) then s:=s||jsonb_build_object('revision',(app_private.fsv2_revision(before_s->'revision')+1)::text,'updated_at',at_text);end if;
 -- New maps must carry the FINAL configuration revision. A materialization can
 -- advance the cursor without creating rows; history remains at its own revision.
 if plan_new then expected:=coalesce((select jsonb_agg(case when e->>'type'='finance_series_occurrence' and e->'before'='null'::jsonb then jsonb_set(e,'{after,configuration_revision}',s->'revision') else e end order by ord) from jsonb_array_elements(expected) with ordinality items(e,ord)),'[]');end if;
 expected:=app_private.fsv2_change(expected,'finance_series',before_s,s);
 if submitted_result is distinct from jsonb_build_object('version',2,'series',s,'affected',counts) then raise exception 'Series result/counts differ from exact effects.' using errcode='23514';end if;
 return jsonb_build_object('changes',expected,'result',submitted_result);
end $$;
do $$ declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname like 'fsv2_%' and p.proname not in ('fsv2_snapshot','fsv2_detail','fsv2_page') loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;end $$;
rollback;
