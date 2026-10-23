-- DRAFT ONLY — T-052 / #77. Root assigns the migration ID and reconciles catalogue,
-- SQL Editor, official types, backup/restore and native CI before any activation.
-- Do not run in build/deploy/CI or on a hosted project from this file.
-- Additive payload metadata. Missing legacy keys continue to mean unconfigured.
-- No PAN/CVV, accounting calculation, ledger, payment, event or receipt change.
do $draft$ begin raise exception 'DRAFT_NOT_AUTHORIZED_FOR_APPLICATION' using errcode='P0001'; end $draft$;
-- BEGIN PROPOSED MIGRATION BODY (transaction owned by supervised migration).
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
 if current_user<>'postgres' or to_regclass('public.fin_accounts') is null
  or to_regprocedure('app_private.finance_validate(text,jsonb)') is null then
  raise exception 'Reviewed financial foundation and postgres owner required.';
 end if;
end $$;

alter table public.fin_accounts
 add column last_four text generated always as (payload->>'last_four') stored,
 add column default_payment_account_id uuid generated always as ((payload->>'default_payment_account_id')::uuid) stored,
 add constraint fin_accounts_default_payment_owner_fk foreign key(user_id,default_payment_account_id)
 references public.fin_accounts(user_id,id) deferrable initially deferred;
create or replace function app_private.finance_validate(p_kind text,p jsonb) returns void language plpgsql set search_path='' as $$
declare required text[]; allowed text[]; k text; n bigint; d date; begin
 required:=array['id','user_id','created_at','updated_at'];
 if p_kind='finance_account' then required:=required||array['name','kind','institution','currency','opening_balance_cents','color_key','archived_at','credit_limit_cents','statement_closing_day','payment_due_day'];
 elsif p_kind='finance_category' then required:=required||array['name','normalized_name','kind','parent_id','color_key'];
 elsif p_kind='finance_tag' then required:=required||array['name','normalized_name','color_key'];
 elsif p_kind='finance_budget' then required:=required||array['category_id','month','limit_cents'];
 elsif p_kind='finance_transaction' then required:=required||array['account_id','category_id','kind','amount_cents','paid_cents','description','payee','occurred_on','transfer_group_id','notes','installment_group_id','installment_no','installment_total','statement_month','serie_tipo','status','source','due_date','deleted_at'];
 else raise exception 'Unknown finance record.' using errcode='22023'; end if;
 allowed:=required||case when p_kind='finance_transaction' then array['tag_ids'] when p_kind='finance_account' then array['last_four','default_payment_account_id'] else '{}'::text[] end;
 if jsonb_typeof(p) is distinct from 'object' or not p ?& required or p-allowed<>'{}'::jsonb then raise exception 'Invalid finance payload.' using errcode='22023'; end if;
 perform (p->>'id')::uuid; perform (p->>'user_id')::uuid;
 perform app_private.capture_task_timestamp(p->'created_at'); perform app_private.capture_task_timestamp(p->'updated_at');
 if p_kind not in ('finance_budget','finance_transaction') and (jsonb_typeof(p->'color_key') is distinct from 'string' or p->>'color_key' !~ '^fin-[1-6]$') then raise exception 'Invalid finance color.' using errcode='22023'; end if;
 if p_kind in ('finance_account','finance_category','finance_tag') and (jsonb_typeof(p->'name') is distinct from 'string' or char_length(btrim(p->>'name')) not between 1 and 120) then raise exception 'Invalid finance name.' using errcode='22023'; end if;
 if p_kind='finance_account' then
  perform app_private.finance_cents(p->'opening_balance_cents');
  if p->>'currency'<>'BRL' or p->>'kind' not in ('checking','savings','credit_card','cash','investment','other') then raise exception 'Invalid account.' using errcode='22023'; end if;
  perform app_private.capture_task_timestamp(p->'archived_at',true);
  if p ? 'last_four' and p->'last_four'<>'null'::jsonb and (p->>'kind'<>'credit_card' or jsonb_typeof(p->'last_four') is distinct from 'string' or p->>'last_four' !~ '^[0-9]{4}$') then
   raise exception 'Invalid card last four.' using errcode='22023';
  end if;
  if p ? 'default_payment_account_id' and p->'default_payment_account_id'<>'null'::jsonb then
   if p->>'kind'<>'credit_card' or jsonb_typeof(p->'default_payment_account_id') is distinct from 'string' then raise exception 'Invalid suggested payment account.' using errcode='22023'; end if;
   perform (p->>'default_payment_account_id')::uuid;
  end if;
  if p->>'kind'='credit_card' then
   if app_private.finance_cents(p->'credit_limit_cents')<0 or app_private.finance_cents(p->'statement_closing_day') not between 1 and 31 or app_private.finance_cents(p->'payment_due_day') not between 1 and 31 then raise exception 'Invalid card cycle.' using errcode='22023'; end if;
  elsif p->'credit_limit_cents'<>'null'::jsonb or p->'statement_closing_day'<>'null'::jsonb or p->'payment_due_day'<>'null'::jsonb then raise exception 'Card fields on common account.' using errcode='23514'; end if;
 elsif p_kind in ('finance_category','finance_tag') then
  if jsonb_typeof(p->'normalized_name') is distinct from 'string' or char_length(p->>'normalized_name') not between 1 and 80 then raise exception 'Invalid normalized name.' using errcode='22023'; end if;
  if p_kind='finance_category' and p->>'kind' not in ('income','expense') then raise exception 'Invalid category.' using errcode='22023'; end if;
 elsif p_kind='finance_budget' then
  if app_private.finance_cents(p->'limit_cents')<1 or extract(day from app_private.finance_date(p->>'month'))<>1 then raise exception 'Invalid budget.' using errcode='22023'; end if;
 elsif p_kind='finance_transaction' then
  n:=app_private.finance_cents(p->'amount_cents'); if n<1 or app_private.finance_cents(p->'paid_cents') not between 0 and n then raise exception 'Invalid transaction amount.' using errcode='23514'; end if;
  if p->>'kind' not in ('income','expense') or p->>'status' not in ('planned','pending','confirmed','reconciled','cancelled') or p->>'source' not in ('manual','recurring','import') then raise exception 'Invalid transaction state.' using errcode='22023'; end if;
  if jsonb_typeof(p->'description') is distinct from 'string' or char_length(btrim(p->>'description')) not between 1 and 200 then raise exception 'Invalid description.' using errcode='22023'; end if;
  perform app_private.finance_date(p->>'occurred_on'); perform app_private.finance_date(p->>'due_date'); d:=app_private.finance_date(p->>'statement_month');
  if d is not null and extract(day from d)<>1 then raise exception 'Statement must be canonical month.' using errcode='23514'; end if;
  perform app_private.capture_task_timestamp(p->'deleted_at',true);
  if p ? 'tag_ids' and (jsonb_typeof(p->'tag_ids') is distinct from 'array' or jsonb_array_length(p->'tag_ids')>30) then raise exception 'Invalid tags.' using errcode='22023'; end if;
  for k in select value from jsonb_array_elements_text(coalesce(p->'tag_ids','[]'::jsonb)) loop perform k::uuid; end loop;
 end if;
end $$;
-- The original BEFORE projector still calls finance_validate. No copy of its
-- purchase/payment normalization is introduced by this additive trigger.
create function app_private.finance_card_metadata_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare target public.fin_accounts%rowtype; owner_id uuid; payment_id uuid; changed boolean;
begin
 if new.payload->>'default_payment_account_id' is null then return new; end if;
 owner_id:=(new.payload->>'user_id')::uuid;
 payment_id:=(new.payload->>'default_payment_account_id')::uuid;
 select a.* into target from public.fin_accounts a where a.user_id=owner_id and a.id=payment_id for key share;
 if not found or target.kind='credit_card' or target.currency is distinct from new.payload->>'currency' then
  raise exception 'Suggested account must belong to owner and have compatible kind/currency.' using errcode='23503';
 end if;
 -- An account archived later remains a historical reference. A new/changed
 -- suggestion must be active; the payment form rechecks eligibility every time.
 changed:=true;
 if tg_op='UPDATE' then changed:=new.payload->'default_payment_account_id' is distinct from old.payload->'default_payment_account_id'; end if;
 if changed and target.archived_at is not null then raise exception 'Suggested account is archived.' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function app_private.finance_card_metadata_guard() from public,anon,authenticated,service_role;
create trigger zz_fin_accounts_card_metadata_guard before insert or update on public.fin_accounts
 for each row execute function app_private.finance_card_metadata_guard();
comment on column public.fin_accounts.last_four is 'Optional four-digit card identifier, never PAN or CVV.';
comment on column public.fin_accounts.default_payment_account_id is 'Editable payment suggestion only; never automatic payment.';
commit;
