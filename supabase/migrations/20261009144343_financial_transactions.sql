-- T018/T019/T020. Versioned preparation only; manual application is deferred.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create table public.fin_accounts (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, payload jsonb not null,
 name text not null, kind text not null check(kind in ('checking','savings','credit_card','cash','investment','other')),
 institution text generated always as (payload->>'institution') stored,
 color_key text generated always as (payload->>'color_key') stored,
 credit_limit_cents bigint generated always as ((payload->>'credit_limit_cents')::bigint) stored,
 statement_closing_day integer generated always as ((payload->>'statement_closing_day')::integer) stored,
 payment_due_day integer generated always as ((payload->>'payment_due_day')::integer) stored,
 currency text not null check(currency='BRL'), opening_balance_cents bigint not null, archived_at timestamptz,
 created_at timestamptz not null, updated_at timestamptz not null, unique(user_id,id)
);
create table public.fin_categories (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, payload jsonb not null,
 name text not null, normalized_name text not null, kind text not null check(kind in ('income','expense')), parent_id uuid,
 color_key text generated always as (payload->>'color_key') stored,
 created_at timestamptz not null, updated_at timestamptz not null, unique(user_id,id), unique(user_id,kind,normalized_name),
 foreign key(user_id,parent_id) references public.fin_categories(user_id,id) deferrable initially deferred
);
create table public.fin_tags (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, payload jsonb not null,
 name text not null, normalized_name text not null, created_at timestamptz not null, updated_at timestamptz not null,
 color_key text generated always as (payload->>'color_key') stored,
 unique(user_id,id), unique(user_id,normalized_name)
);
create table public.fin_transactions (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, payload jsonb not null,
 account_id uuid not null, category_id uuid, kind text not null check(kind in ('income','expense')),
 amount_cents bigint not null check(amount_cents between 1 and 9007199254740991),
 paid_cents bigint not null check(paid_cents between 0 and amount_cents),
 is_paid boolean generated always as (paid_cents>=amount_cents) stored,
 occurred_on date not null, statement_month date, due_date date, description text not null,
 payee text generated always as (payload->>'payee') stored, notes text generated always as (payload->>'notes') stored,
 status text not null check(status in ('planned','pending','confirmed','reconciled','cancelled')),
 source text not null check(source in ('manual','recurring','import')), deleted_at timestamptz,
 transfer_group_id uuid, installment_group_id uuid, installment_no integer, installment_total integer,
 serie_tipo text check(serie_tipo in ('parcelamento','recorrencia')),
 created_at timestamptz not null, updated_at timestamptz not null, unique(user_id,id),
 foreign key(user_id,account_id) references public.fin_accounts(user_id,id) deferrable initially deferred,
 foreign key(user_id,category_id) references public.fin_categories(user_id,id) deferrable initially deferred,
 check(statement_month is null or extract(day from statement_month)=1),
 check((installment_group_id is null and installment_no is null and installment_total is null and serie_tipo is null)
  or (installment_group_id is not null and installment_no is not null and installment_total is not null and installment_no between 1 and installment_total and installment_total between 2 and 120 and serie_tipo is not null)),
 unique(user_id,installment_group_id,installment_no)
);
create table public.fin_transaction_tags (
 user_id uuid not null references auth.users(id) on delete cascade, transaction_id uuid not null, tag_id uuid not null,
 primary key(user_id,transaction_id,tag_id),
 foreign key(user_id,transaction_id) references public.fin_transactions(user_id,id) on delete cascade deferrable initially deferred,
 foreign key(user_id,tag_id) references public.fin_tags(user_id,id) deferrable initially deferred
);
create table public.fin_budgets (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, payload jsonb not null,
 category_id uuid not null, month date not null check(extract(day from month)=1), limit_cents bigint not null check(limit_cents between 1 and 9007199254740991),
 created_at timestamptz not null, updated_at timestamptz not null, unique(user_id,id), unique(user_id,category_id,month),
 foreign key(user_id,category_id) references public.fin_categories(user_id,id) deferrable initially deferred
);
create table app_private.finance_revisions (user_id uuid primary key references auth.users(id) on delete cascade, revision bigint not null default 0 check(revision>=0));
create index fin_transactions_user_competence_idx on public.fin_transactions(user_id,statement_month,occurred_on,id) where deleted_at is null;
create index fin_transactions_user_account_idx on public.fin_transactions(user_id,account_id,occurred_on,id);
create index fin_transactions_transfer_idx on public.fin_transactions(user_id,transfer_group_id) where transfer_group_id is not null;
create index fin_transactions_series_idx on public.fin_transactions(user_id,installment_group_id,occurred_on) where installment_group_id is not null;

-- Read projection; SQL behavior is asserted manually against the same hand-calculated mass.
create view public.fin_account_balances with(security_invoker=true) as
 select a.id account_id,a.user_id,a.name,a.kind,a.currency,a.opening_balance_cents,
  a.opening_balance_cents+coalesce(sum(case when t.kind='income' then 1 else -1 end * case when a.kind='credit_card' then t.amount_cents else t.paid_cents end),0) balance_cents
 from public.fin_accounts a left join public.fin_transactions t on t.user_id=a.user_id and t.account_id=a.id and t.deleted_at is null and t.status in ('confirmed','reconciled')
 group by a.id,a.user_id,a.name,a.kind,a.currency,a.opening_balance_cents;
revoke all on public.fin_account_balances from public,anon,authenticated,service_role;
grant select on public.fin_account_balances to authenticated;

alter table public.domain_events drop constraint domain_events_entity_type_check;
alter table public.domain_events add constraint domain_events_entity_type_check check(entity_type in (
 'profile','preference','module_preference','role','moderation','entitlement','authentication','capture','task',
 'finance_account','finance_category','finance_tag','finance_transaction','finance_budget'));

create function app_private.finance_command(p text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p=any(array['finance.account.create','finance.account.update','finance.account.close','finance.category.create','finance.category.update',
 'finance.transaction.create','finance.transaction.update','finance.transaction.delete','finance.transaction.restore','finance.transaction.duplicate',
 'finance.transfer.create','finance.statement.pay','finance.series.create','finance.series.stop','finance.budget.save','finance.tag.create','finance.tag.update']),false);
$$;
create function app_private.finance_guard(p_user uuid,p_session uuid,p_operation text) returns void
language plpgsql security definer set search_path='' as $$ begin
 perform 1 from auth.users where id=p_user for share;
 perform 1 from auth.sessions where id=p_session and user_id=p_user for share;
 perform app_private.capture_task_lock(p_user);
 perform app_private.require_actor(p_user,p_session);
 if p_operation is null or p_operation<>'read.finance' and not app_private.finance_command(p_operation) then raise exception 'Unknown finance operation.' using errcode='22023'; end if;
 if exists(select 1 from public.user_entitlements where user_id=p_user and feature_key='financeiro' and not allowed) then raise exception 'Finance unavailable.' using errcode='42501'; end if;
end $$;
create function app_private.finance_date(p text) returns date language plpgsql immutable set search_path='' as $$
declare d date; begin
 if p is null then return null; end if;
 if p !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid civil date.' using errcode='22023'; end if;
 d:=p::date; if to_char(d,'YYYY-MM-DD')<>p then raise exception 'Invalid civil date.' using errcode='22023'; end if; return d;
exception when datetime_field_overflow or invalid_datetime_format then raise exception 'Invalid civil date.' using errcode='22023'; end $$;
create function app_private.finance_cents(p jsonb) returns bigint language plpgsql immutable set search_path='' as $$
declare n numeric; begin
 if jsonb_typeof(p) is distinct from 'number' or p::text !~ '^-?(0|[1-9][0-9]*)$' then raise exception 'Integer cents required.' using errcode='22023'; end if;
 n:=(p::text)::numeric; if abs(n)>9007199254740991 then raise exception 'Unsafe cents.' using errcode='22023'; end if; return n::bigint;
end $$;
create function app_private.finance_validate(p_kind text,p jsonb) returns void language plpgsql set search_path='' as $$
declare required text[]; allowed text[]; k text; n bigint; d date; begin
 required:=array['id','user_id','created_at','updated_at'];
 if p_kind='finance_account' then required:=required||array['name','kind','institution','currency','opening_balance_cents','color_key','archived_at','credit_limit_cents','statement_closing_day','payment_due_day'];
 elsif p_kind='finance_category' then required:=required||array['name','normalized_name','kind','parent_id','color_key'];
 elsif p_kind='finance_tag' then required:=required||array['name','normalized_name','color_key'];
 elsif p_kind='finance_budget' then required:=required||array['category_id','month','limit_cents'];
 elsif p_kind='finance_transaction' then required:=required||array['account_id','category_id','kind','amount_cents','paid_cents','description','payee','occurred_on','transfer_group_id','notes','installment_group_id','installment_no','installment_total','statement_month','serie_tipo','status','source','due_date','deleted_at'];
 else raise exception 'Unknown finance record.' using errcode='22023'; end if;
 allowed:=required||case when p_kind='finance_transaction' then array['tag_ids'] else '{}'::text[] end;
 if jsonb_typeof(p) is distinct from 'object' or not p ?& required or p-allowed<>'{}'::jsonb then raise exception 'Invalid finance payload.' using errcode='22023'; end if;
 perform (p->>'id')::uuid; perform (p->>'user_id')::uuid;
 perform app_private.capture_task_timestamp(p->'created_at'); perform app_private.capture_task_timestamp(p->'updated_at');
 if p_kind not in ('finance_budget','finance_transaction') and (jsonb_typeof(p->'color_key') is distinct from 'string' or p->>'color_key' !~ '^fin-[1-6]$') then raise exception 'Invalid finance color.' using errcode='22023'; end if;
 if p_kind in ('finance_account','finance_category','finance_tag') and (jsonb_typeof(p->'name') is distinct from 'string' or char_length(btrim(p->>'name')) not between 1 and 120) then raise exception 'Invalid finance name.' using errcode='22023'; end if;
 if p_kind='finance_account' then
  perform app_private.finance_cents(p->'opening_balance_cents');
  if p->>'currency'<>'BRL' or p->>'kind' not in ('checking','savings','credit_card','cash','investment','other') then raise exception 'Invalid account.' using errcode='22023'; end if;
  perform app_private.capture_task_timestamp(p->'archived_at',true);
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

-- One BEFORE trigger implementation for the card purchase exception. is_paid is NEVER written.
create function app_private.finance_project() returns trigger language plpgsql security definer set search_path='' as $$
declare kind text; account_kind text; begin
 kind:=case tg_table_name when 'fin_accounts' then 'finance_account' when 'fin_categories' then 'finance_category' when 'fin_tags' then 'finance_tag' when 'fin_transactions' then 'finance_transaction' when 'fin_budgets' then 'finance_budget' end;
 perform app_private.finance_validate(kind,new.payload);
 new.id:=(new.payload->>'id')::uuid; new.user_id:=(new.payload->>'user_id')::uuid;
 new.created_at:=app_private.capture_task_timestamp(new.payload->'created_at'); new.updated_at:=app_private.capture_task_timestamp(new.payload->'updated_at');
 if tg_op='UPDATE' and (new.id<>old.id or new.user_id<>old.user_id or new.created_at<>old.created_at) then raise exception 'Owner/id/creation immutable.' using errcode='23514'; end if;
 if kind='finance_account' then
  new.name:=new.payload->>'name'; new.kind:=new.payload->>'kind'; new.currency:=new.payload->>'currency'; new.opening_balance_cents:=app_private.finance_cents(new.payload->'opening_balance_cents'); new.archived_at:=app_private.capture_task_timestamp(new.payload->'archived_at',true);
  if tg_op='UPDATE' and new.kind<>old.kind then raise exception 'Account kind immutable.' using errcode='23514'; end if;
 elsif kind in ('finance_category','finance_tag') then
  new.name:=new.payload->>'name'; new.normalized_name:=new.payload->>'normalized_name';
  if kind='finance_category' then new.kind:=new.payload->>'kind'; new.parent_id:=(new.payload->>'parent_id')::uuid; if tg_op='UPDATE' and new.kind<>old.kind then raise exception 'Category kind immutable.' using errcode='23514'; end if; end if;
 elsif kind='finance_budget' then new.category_id:=(new.payload->>'category_id')::uuid; new.month:=app_private.finance_date(new.payload->>'month'); new.limit_cents:=app_private.finance_cents(new.payload->'limit_cents');
 else
  new.account_id:=(new.payload->>'account_id')::uuid; new.category_id:=(new.payload->>'category_id')::uuid; new.kind:=new.payload->>'kind'; new.amount_cents:=app_private.finance_cents(new.payload->'amount_cents'); new.paid_cents:=app_private.finance_cents(new.payload->'paid_cents');
  select a.kind into account_kind from public.fin_accounts a where a.user_id=new.user_id and a.id=new.account_id;
  if account_kind='credit_card' and new.kind='expense' then new.paid_cents:=new.amount_cents; new.payload:=jsonb_set(new.payload,'{paid_cents}',to_jsonb(new.amount_cents)); end if;
  if account_kind<>'credit_card' and new.payload->'statement_month'<>'null'::jsonb then raise exception 'Statement on common account.' using errcode='23514'; end if;
  new.occurred_on:=app_private.finance_date(new.payload->>'occurred_on'); new.statement_month:=app_private.finance_date(new.payload->>'statement_month'); new.due_date:=app_private.finance_date(new.payload->>'due_date');
  new.description:=new.payload->>'description'; new.status:=new.payload->>'status'; new.source:=new.payload->>'source'; new.deleted_at:=app_private.capture_task_timestamp(new.payload->'deleted_at',true);
  new.transfer_group_id:=(new.payload->>'transfer_group_id')::uuid; new.installment_group_id:=(new.payload->>'installment_group_id')::uuid; new.installment_no:=(new.payload->>'installment_no')::integer; new.installment_total:=(new.payload->>'installment_total')::integer; new.serie_tipo:=new.payload->>'serie_tipo';
  if tg_op='UPDATE' and (new.transfer_group_id is distinct from old.transfer_group_id or new.installment_group_id is distinct from old.installment_group_id or new.installment_no is distinct from old.installment_no or new.installment_total is distinct from old.installment_total or new.serie_tipo is distinct from old.serie_tipo or new.source<>old.source) then raise exception 'Group metadata immutable.' using errcode='23514'; end if;
 end if;
 return new;
end $$;
create function app_private.finance_bump() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid; begin
 u:=case when tg_op='DELETE' then old.user_id else new.user_id end;
 if tg_table_name='domain_events' then
  if (case when tg_op='DELETE' then old.entity_type else new.entity_type end) not like 'finance_%' then return null; end if;
 elsif tg_table_name='command_receipts' then
  if not app_private.finance_command(case when tg_op='DELETE' then old.command else new.command end) then return null; end if;
 end if;
 perform app_private.capture_task_lock(u);
 if exists(select 1 from auth.users where id=u) then insert into app_private.finance_revisions(user_id,revision) values(u,1) on conflict(user_id) do update set revision=finance_revisions.revision+1; end if; return null;
end $$;
create function app_private.finance_sync_tags() returns trigger language plpgsql security definer set search_path='' as $$ begin
 delete from public.fin_transaction_tags where user_id=new.user_id and transaction_id=new.id;
 insert into public.fin_transaction_tags(user_id,transaction_id,tag_id) select new.user_id,new.id,value::uuid from jsonb_array_elements_text(coalesce(new.payload->'tag_ids','[]'::jsonb)); return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['fin_accounts','fin_categories','fin_tags','fin_transactions','fin_budgets'] loop
  execute format('create trigger finance_project before insert or update on public.%I for each row execute function app_private.finance_project()',t);
  execute format('create trigger finance_revision after insert or update or delete on public.%I for each row execute function app_private.finance_bump()',t);
 end loop;
end $$;
create trigger finance_tags after insert or update on public.fin_transactions for each row execute function app_private.finance_sync_tags();
create trigger finance_revision after insert or update or delete on public.domain_events for each row execute function app_private.finance_bump();
create trigger finance_revision after insert or update or delete on app_private.command_receipts for each row execute function app_private.finance_bump();

create function app_private.finance_integrity(p_user uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if exists(select 1 from public.fin_transactions where user_id=p_user and transfer_group_id is not null group by transfer_group_id
  having count(*)<>2 or count(distinct account_id)<>2 or count(distinct kind)<>2 or min(amount_cents)<>max(amount_cents) or count(distinct coalesce(deleted_at::text,''))<>1) then raise exception 'Transfer requires two matching legs.' using errcode='23514'; end if;
 if exists(select 1 from public.fin_transactions t join public.fin_categories c on c.user_id=t.user_id and c.id=t.category_id where t.user_id=p_user and t.kind='expense' and c.kind<>'expense')
  or exists(select 1 from public.fin_budgets b join public.fin_categories c on c.user_id=b.user_id and c.id=b.category_id where b.user_id=p_user and c.kind<>'expense') then raise exception 'Expense category required.' using errcode='23514'; end if;
end $$;
create function app_private.finance_record(p_user uuid,p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t text; result jsonb; begin
 t:=case p_kind when 'finance_account' then 'fin_accounts' when 'finance_category' then 'fin_categories' when 'finance_tag' then 'fin_tags' when 'finance_transaction' then 'fin_transactions' when 'finance_budget' then 'fin_budgets' end;
 if t is null then raise exception 'Unknown financial record.' using errcode='22023'; end if;
 execute format('select payload from public.%I where user_id=$1 and id=$2',t) into result using p_user,p_id; return result;
end $$;
create function app_private.finance_snapshot(p_user uuid,p_session uuid,p_operation text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; begin
 perform app_private.finance_guard(p_user,p_session,p_operation);
 select jsonb_build_object('revision',coalesce((select revision::text from app_private.finance_revisions where user_id=p_user),'0'),
 'accounts',coalesce((select jsonb_agg(payload order by created_at,id) from public.fin_accounts where user_id=p_user),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(payload order by created_at,id) from public.fin_categories where user_id=p_user),'[]'::jsonb),
 'tags',coalesce((select jsonb_agg(payload order by created_at,id) from public.fin_tags where user_id=p_user),'[]'::jsonb),
 'transactions',coalesce((select jsonb_agg(payload order by created_at,id) from public.fin_transactions where user_id=p_user),'[]'::jsonb),
 'budgets',coalesce((select jsonb_agg(payload order by created_at,id) from public.fin_budgets where user_id=p_user),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'entity_type',entity_type,'entity_id',entity_id,'action',action,'canal',canal,'occurred_at',occurred_at,'before',before,'after',after) order by occurred_at,id) from public.domain_events where user_id=p_user and entity_type like 'finance_%'),'[]'::jsonb),
 'receipts',coalesce((select jsonb_agg(jsonb_build_object('user_id',user_id,'command',command,'client_id',client_id,'fingerprint',request#>>'{}','result',result)) from app_private.command_receipts where user_id=p_user and app_private.finance_command(command)),'[]'::jsonb)) into v_result;
 if octet_length(v_result::text)>8388608 or (select sum(jsonb_array_length(v_result->k)) from unnest(array['accounts','categories','tags','transactions','budgets','events','receipts']) k)>10000 then raise exception 'Complete financial snapshot exceeds limit.' using errcode='54000'; end if;
 return v_result;
end $$;
create function app_private.finance_revision(p_user uuid,p_session uuid,p_operation text) returns text language plpgsql security definer set search_path='' as $$ begin
 perform app_private.finance_guard(p_user,p_session,p_operation); return coalesce((select revision::text from app_private.finance_revisions where user_id=p_user),'0'); end $$;
create function app_private.finance_receipt(p_user uuid,p_session uuid,p_operation text,p_command text,p_client_id text) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 perform app_private.finance_guard(p_user,p_session,p_operation); if p_operation<>p_command or not app_private.finance_command(p_command) then raise exception 'Receipt outside operation.' using errcode='22023'; end if;
 return (select jsonb_build_object('user_id',user_id,'command',command,'client_id',client_id,'fingerprint',request#>>'{}','result',result) from app_private.command_receipts where user_id=p_user and command=p_command and client_id=p_client_id); end $$;

create function app_private.finance_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb; input jsonb; c jsonb; e jsonb; b jsonb; a jsonb; saved jsonb; result jsonb; item jsonb; kind text; table_name text; n integer; stored app_private.command_receipts; begin
 perform app_private.finance_guard(p_user,p_session,p_operation);
 if not app_private.finance_command(p_operation) or jsonb_typeof(p_request) is distinct from 'object' or not p_request ?& array['expectedRevision','context','changes','events','receipt'] or p_request-array['expectedRevision','context','changes','events','receipt']<>'{}'::jsonb or octet_length(p_request::text)>8388608 then raise exception 'Invalid financial envelope.' using errcode='22023'; end if;
 if p_request#>>'{context,user_id}' is distinct from p_user::text or coalesce(p_request#>>'{context,canal}','') not in ('web','api','cron') or jsonb_typeof(p_request->'expectedRevision') is distinct from 'string' or p_request->>'expectedRevision' !~ '^(0|[1-9][0-9]*)$' or jsonb_typeof(p_request->'changes') is distinct from 'array' or jsonb_typeof(p_request->'events') is distinct from 'array' then raise exception 'Invalid financial context.' using errcode='22023'; end if;
 r:=p_request->'receipt';
 if jsonb_typeof(r) is distinct from 'object' or not r ?& array['user_id','command','client_id','fingerprint','result'] or r-array['user_id','command','client_id','fingerprint','result']<>'{}'::jsonb or r->>'user_id' is distinct from p_user::text or r->>'command' is distinct from p_operation or jsonb_typeof(r->'client_id') is distinct from 'string' or char_length(btrim(r->>'client_id')) not between 1 and 200 or jsonb_typeof(r->'fingerprint') is distinct from 'string' then raise exception 'Invalid financial receipt.' using errcode='22023'; end if;
 input:=(r->>'fingerprint')::jsonb; if input->>'client_id' is distinct from r->>'client_id' then raise exception 'Fingerprint outside command.' using errcode='22023'; end if;
 select * into stored from app_private.command_receipts where user_id=p_user and command=p_operation and client_id=r->>'client_id';
 if found then if stored.request is distinct from to_jsonb(r->>'fingerprint') then raise exception 'client_id reused.' using errcode='23505'; end if; return jsonb_build_object('status','replayed','result',stored.result); end if;
 if coalesce((select revision::text from app_private.finance_revisions where user_id=p_user),'0')<>p_request->>'expectedRevision' then return jsonb_build_object('status','stale'); end if;
 n:=jsonb_array_length(p_request->'changes');
 if n>120 or n<>jsonb_array_length(p_request->'events') or (p_operation='finance.transfer.create' and n<>2) or (p_operation='finance.statement.pay' and n not in (2,3)) or (p_operation='finance.series.create' and n<>(input->>'count')::integer) or (p_operation not in ('finance.transfer.create','finance.statement.pay','finance.series.create','finance.series.stop') and n>1) then raise exception 'Invalid financial batch size.' using errcode='23514'; end if;
 if not (app_private.consume_rate_limit_at('capture_task_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null)->>'allowed')::boolean then raise exception 'Write limit reached.' using errcode='PT429'; end if;
 if exists(select 1 from jsonb_array_elements(p_request->'changes') x group by x->>'type',x#>>'{after,id}' having count(*)>1) or exists(select 1 from jsonb_array_elements(p_request->'events') x group by x->>'id' having count(*)>1) then raise exception 'Duplicate changes/events.' using errcode='23514'; end if;
 for c in select value from jsonb_array_elements(p_request->'changes') loop
  kind:=c->>'type'; a:=c->'after'; b:=nullif(c->'before','null'::jsonb); perform app_private.finance_validate(kind,a);
  if a->>'user_id' is distinct from p_user::text or (b is not null and (b->>'id' is distinct from a->>'id' or b->>'user_id' is distinct from p_user::text)) then raise exception 'Change outside owner.' using errcode='42501'; end if;
  if (p_operation like 'finance.account.%' and kind<>'finance_account') or (p_operation like 'finance.category.%' and kind<>'finance_category') or (p_operation like 'finance.tag.%' and kind<>'finance_tag') or (p_operation='finance.budget.save' and kind<>'finance_budget') or (p_operation like 'finance.transaction.%' or p_operation like 'finance.series.%' or p_operation in ('finance.transfer.create','finance.statement.pay')) and kind<>'finance_transaction' then raise exception 'Change outside command.' using errcode='42501'; end if;
  saved:=app_private.finance_record(p_user,kind,(a->>'id')::uuid); if saved is distinct from b then raise exception 'Before state changed.' using errcode='40001'; end if;
  if b is not null and (p_operation like '%.create' or p_operation='finance.statement.pay' or p_operation='finance.transaction.duplicate') then raise exception 'Create cannot update history.' using errcode='23514'; end if;
  if b is null and p_operation in ('finance.account.update','finance.account.close','finance.category.update','finance.tag.update','finance.transaction.update','finance.transaction.delete','finance.transaction.restore','finance.series.stop') then raise exception 'Update cannot insert.' using errcode='23514'; end if;
  if kind='finance_transaction' then
   if (b is null or a->'account_id' is distinct from b->'account_id') and not exists(select 1 from public.fin_accounts where user_id=p_user and id=(a->>'account_id')::uuid and archived_at is null) then raise exception 'Account unavailable.' using errcode='23503'; end if;
   if p_operation in ('finance.transfer.create','finance.statement.pay') then
    if a->'transfer_group_id'<>'null'::jsonb then
     if a->>'transfer_group_id' is distinct from p_request#>>'{receipt,result,group_id}' or a->>'occurred_on' is distinct from input->>'occurred_on' or a->'amount_cents' is distinct from input->'amount_cents' or a->'paid_cents' is distinct from input->'amount_cents' or a->>'status'<>'confirmed' or a->'deleted_at'<>'null'::jsonb or a->'category_id'<>'null'::jsonb
      or (a->>'kind'='expense' and a->>'account_id' is distinct from input->>'from_account_id')
      or (a->>'kind'='income' and a->>'account_id' is distinct from case when p_operation='finance.statement.pay' then input->>'card_account_id' else input->>'to_account_id' end)
      or (p_operation='finance.statement.pay' and a->>'kind'='income' and a->>'statement_month' is distinct from input->>'statement_month') then raise exception 'Transfer differs from command.' using errcode='23514'; end if;
    elsif p_operation<>'finance.statement.pay' or a is distinct from p_request#>'{receipt,result,charges}' or a->>'kind'<>'expense' or a->>'account_id' is distinct from input->>'card_account_id' or app_private.finance_date(a->>'statement_month')<(app_private.finance_date(input->>'statement_month')+interval '1 month')::date then raise exception 'Charge outside statement command.' using errcode='23514'; end if;
   end if;
   if p_operation='finance.series.create' and (a->>'account_id' is distinct from input#>>'{fields,account_id}' or a->>'kind' is distinct from input#>>'{fields,kind}' or a->>'installment_group_id' is distinct from p_request#>>'{receipt,result,group_id}' or a->>'serie_tipo' is distinct from input->>'serie_tipo' or a->'installment_total' is distinct from input->'count') then raise exception 'Series differs from command.' using errcode='23514'; end if;
   if p_operation='finance.series.stop' and (a->>'installment_group_id' is distinct from input->>'installment_group_id' or b->>'serie_tipo'<>'recorrencia' or b->'deleted_at'<>'null'::jsonb or b->>'occurred_on'<input->>'from_on' or app_private.finance_date(input->>'from_on')<timezone('America/Sao_Paulo',now())::date
    or not ((b->>'paid_cents')::bigint=0 or exists(select 1 from public.fin_accounts fa where fa.user_id=p_user and fa.id=(b->>'account_id')::uuid and fa.kind='credit_card') and b->>'status' in ('planned','pending'))
    or (a-'deleted_at'-'updated_at') is distinct from (b-'deleted_at'-'updated_at')) then raise exception 'Invalid recurrence ending.' using errcode='23514'; end if;
  end if;
  select count(*) into n from jsonb_array_elements(p_request->'events') ev where ev->>'entity_type'=kind and ev->>'entity_id'=a->>'id' and ev->'before' is not distinct from coalesce(b,'null'::jsonb) and ev->'after'=a;
  if n<>1 then raise exception 'Exact matching event required.' using errcode='23514'; end if;
  table_name:=case kind when 'finance_account' then 'fin_accounts' when 'finance_category' then 'fin_categories' when 'finance_tag' then 'fin_tags' when 'finance_budget' then 'fin_budgets' when 'finance_transaction' then 'fin_transactions' end;
  if b is null then execute format('insert into public.%I(payload) values($1)',table_name) using a; else execute format('update public.%I set payload=$1 where user_id=$2 and id=$3',table_name) using a,p_user,(a->>'id')::uuid; end if;
  if app_private.finance_record(p_user,kind,(a->>'id')::uuid) is distinct from a then raise exception 'Projection differs from staged state.' using errcode='23514'; end if;
 end loop;
 perform app_private.finance_integrity(p_user);
 set constraints all immediate;
 for e in select value from jsonb_array_elements(p_request->'events') loop
  if e->>'user_id' is distinct from p_user::text or e->>'canal' is distinct from p_request#>>'{context,canal}' or e->>'entity_type' not in ('finance_account','finance_category','finance_tag','finance_transaction','finance_budget') or e->>'action' not in ('created','updated','deleted','restored','status_changed') then raise exception 'Invalid financial event.' using errcode='23514'; end if;
  insert into public.domain_events(id,user_id,entity_type,entity_id,action,canal,occurred_at,before,after) values((e->>'id')::uuid,p_user,e->>'entity_type',(e->>'entity_id')::uuid,e->>'action',e->>'canal',app_private.capture_task_timestamp(e->'occurred_at'),nullif(e->'before','null'::jsonb),nullif(e->'after','null'::jsonb));
 end loop;
 result:=r->'result';
 if p_operation in ('finance.transfer.create','finance.statement.pay','finance.series.create','finance.series.stop') then
  if jsonb_typeof(result->'transactions') is distinct from 'array' then raise exception 'Invalid group result.' using errcode='23514'; end if;
  for item in select value from jsonb_array_elements(result->'transactions') loop if app_private.finance_record(p_user,'finance_transaction',(item->>'id')::uuid) is distinct from item then raise exception 'Result differs from persisted row.' using errcode='23514'; end if; end loop;
  if result ? 'charges' and result->'charges'<>'null'::jsonb and app_private.finance_record(p_user,'finance_transaction',(result#>>'{charges,id}')::uuid) is distinct from result->'charges' then raise exception 'Charges differ.' using errcode='23514'; end if;
 else
  kind:=case when p_operation like 'finance.account.%' then 'finance_account' when p_operation like 'finance.category.%' then 'finance_category' when p_operation like 'finance.tag.%' then 'finance_tag' when p_operation='finance.budget.save' then 'finance_budget' else 'finance_transaction' end;
  if app_private.finance_record(p_user,kind,(result->>'id')::uuid) is distinct from result then raise exception 'Result differs from persisted row.' using errcode='23514'; end if;
 end if;
 insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,p_operation,r->>'client_id',to_jsonb(r->>'fingerprint'),result);
 perform app_private.finance_snapshot(p_user,p_session,p_operation);
 return jsonb_build_object('status','committed','result',result);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Invalid finance value.' using errcode='22023'; end $$;

create function public.finance_snapshot(p_user uuid,p_session uuid,p_operation text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.finance_snapshot(p_user,p_session,p_operation) $$;
create function public.finance_revision(p_user uuid,p_session uuid,p_operation text) returns text language sql security invoker set search_path='' as $$ select app_private.finance_revision(p_user,p_session,p_operation) $$;
create function public.finance_receipt(p_user uuid,p_session uuid,p_operation text,p_command text,p_client_id text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.finance_receipt(p_user,p_session,p_operation,p_command,p_client_id) $$;
create function public.finance_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$ select app_private.finance_commit(p_user,p_session,p_operation,p_request) $$;
do $$ declare pair text[]; name text; command text; f record; t text; begin
 foreach pair slice 1 in array array[['transfer','finance.transfer.create'],['pay_statement','finance.statement.pay'],['create_series','finance.series.create'],['close_account','finance.account.close']] loop
  name:=pair[1]; command:=pair[2];
  execute format('create function public.%I(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language plpgsql security invoker set search_path='''' as $body$ begin if p_operation<>%L then raise exception ''Operation outside RPC.'' using errcode=''42501''; end if; return app_private.finance_commit(p_user,p_session,p_operation,p_request); end $body$',name,command);
 end loop;
 foreach t in array array['fin_accounts','fin_categories','fin_tags','fin_transactions','fin_transaction_tags','fin_budgets'] loop
  execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy finance_owner_read on public.%I for select to authenticated using(user_id=(select auth.uid()) and (select app_private.current_user_active()) and (select app_private.has_feature(''financeiro'')))',t);
 end loop;
 for f in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='app_private' and p.proname like 'finance_%') or (n.nspname='public' and p.proname in ('finance_snapshot','finance_revision','finance_receipt','finance_commit','transfer','pay_statement','create_series','close_account')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.proname in ('finance_snapshot','finance_revision','finance_receipt','finance_commit','transfer','pay_statement','create_series','close_account') then execute format('grant execute on function %s to service_role',f.signature); end if;
 end loop;
end $$;
alter table app_private.finance_revisions enable row level security;
revoke all on app_private.finance_revisions from public,anon,authenticated,service_role;
comment on function public.pay_statement(uuid,uuid,text,jsonb) is 'Server-only staged domain command; transfer legs, optional charges, events and receipt commit together.';
comment on column public.fin_transactions.is_paid is 'Generated from paid_cents. Never accepted in domain DTOs or client writes.';
commit;
