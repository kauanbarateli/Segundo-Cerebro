-- PROPOSAL ONLY / T-053 #78-A. Not a numbered migration or SQL Editor install.
-- Root must review/promote the exact body and assign an ID after onboarding026.
-- No build, deploy or CI may apply this file to a hosted database.
do $draft$ begin raise exception 'DRAFT_NOT_AUTHORIZED_FOR_APPLICATION' using errcode='P0001'; end $draft$;
-- BEGIN PROPOSED MIGRATION BODY.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Preserve the reviewed effective financial commit, rather than transplanting an
-- older full definition. Any source drift aborts before replacement. CRLF/LF is
-- the sole normalization; the pin includes every existing guard and body byte.
do $patch$
declare body text; patched text; anchor text; replacement text;
begin
 if current_user<>'postgres' then raise exception 'T053_POSTGRES_REQUIRED'; end if;
 select replace(p.prosrc,E'\r\n',E'\n') into body from pg_proc p
 where p.oid=to_regprocedure('app_private.finance_commit(uuid,uuid,text,jsonb)')
 and p.prosecdef and p.provolatile='v' and p.proconfig @> array['search_path=""']
 and p.proowner=(select oid from pg_roles where rolname='postgres');
 if body is null or encode(sha256(convert_to(body,'UTF8')),'hex')<>'eac90c8853a494ff7c9ccfb5d7ac4663dfdede42733d0c5d3715019573cc245c' then
  raise exception 'T053_FINANCE_COMMIT_SOURCE_DIVERGED';
 end if;
 anchor:=$old$(p_operation not in ('finance.transfer.create','finance.statement.pay','finance.series.create','finance.series.stop') and n>1)$old$;
 if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'T053_BATCH_ANCHOR_DIVERGED'; end if;
 patched:=replace(body,anchor,$new$(p_operation not in ('finance.transfer.create','finance.statement.pay','finance.series.create','finance.series.stop','finance.budget.save') and n>1)$new$);
 anchor:=$old$ n:=jsonb_array_length(p_request->'changes');$old$;
 if (length(patched)-length(replace(patched,anchor,'')))/length(anchor)<>1 then raise exception 'T053_INSERT_ANCHOR_DIVERGED'; end if;
 replacement:=anchor||$guard$
 -- A budget batch is a closed repetition of one explicit intent, never a
 -- generic batch or twelve independent requests. Legacy omission still means1.
 if p_operation='finance.budget.save' then
  if jsonb_typeof(input) is distinct from 'object'
   or not input ?& array['client_id','category_id','month','limit_cents']
   or input-array['client_id','category_id','month','limit_cents','repeat_months']<>'{}'::jsonb
   or (input ? 'repeat_months' and (jsonb_typeof(input->'repeat_months') is distinct from 'number' or input->'repeat_months' not in ('1'::jsonb,'12'::jsonb)))
   or jsonb_typeof(input->'month') is distinct from 'string' or input->>'month' !~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$'
   or app_private.finance_date(input->>'month')<'0001-01-01'::date
   or extract(year from (app_private.finance_date(input->>'month')+make_interval(months=>coalesce((input->>'repeat_months')::integer,1)-1)))>9999
   or app_private.finance_cents(input->'limit_cents')<1
   or n<>coalesce((input->>'repeat_months')::integer,1)
   or (input->'category_id'<>'null'::jsonb and (jsonb_typeof(input->'category_id') is distinct from 'string'
    or not exists(select 1 from public.fin_categories fc where fc.user_id=p_user and fc.id=(input->>'category_id')::uuid and fc.kind='expense')))
   or r#>>'{result,month}' is distinct from input->>'month'
   or r#>'{result,category_id}' is distinct from input->'category_id'
   or r#>'{result,limit_cents}' is distinct from input->'limit_cents' then
   raise exception 'T053_INVALID_BUDGET_REPEAT' using errcode='23514';
  end if;
  if exists(select 1 from jsonb_array_elements(p_request->'changes') bc
   where bc->>'type' is distinct from 'finance_budget'
   or bc#>'{after,category_id}' is distinct from input->'category_id'
   or bc#>'{after,limit_cents}' is distinct from input->'limit_cents'
   or (bc->'before' is distinct from 'null'::jsonb and (bc#>'{before,category_id}' is distinct from input->'category_id'
    or bc#>'{before,month}' is distinct from bc#>'{after,month}'))
   or jsonb_typeof(bc#>'{after,month}') is distinct from 'string'
   or bc#>>'{after,month}' !~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$'
   or app_private.finance_date(bc#>>'{after,month}')<app_private.finance_date(input->>'month')
   or app_private.finance_date(bc#>>'{after,month}')>(app_private.finance_date(input->>'month')+make_interval(months=>coalesce((input->>'repeat_months')::integer,1)-1))::date)
   or exists(select 1 from jsonb_array_elements(p_request->'changes') bc group by bc#>>'{after,month}' having count(*)<>1) then
   raise exception 'T053_BUDGET_REPEAT_NOT_CONTIGUOUS' using errcode='23514';
  end if;
 end if;
$guard$;
 patched:=replace(patched,anchor,replacement);
 if patched=body then raise exception 'T053_PATCH_NO_EFFECT'; end if;
 execute format('create or replace function app_private.finance_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language plpgsql security definer set search_path=%L as %L','',patched);
end $patch$;
-- CREATE OR REPLACE preserves owner/ACL/signature. Do not grant new callers.
do $acl$
begin
 if has_function_privilege('anon','public.finance_commit(uuid,uuid,text,jsonb)','EXECUTE')
  or has_function_privilege('authenticated','public.finance_commit(uuid,uuid,text,jsonb)','EXECUTE')
  or not has_function_privilege('service_role','public.finance_commit(uuid,uuid,text,jsonb)','EXECUTE') then
  raise exception 'T053_FINANCE_COMMIT_ACL_DIVERGED';
 end if;
end $acl$;
commit;
