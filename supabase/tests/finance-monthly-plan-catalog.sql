-- Read-only DDL/ACL verification after manual migration 017.
-- No Auth fixtures, domain writes, functions, grants or migration application.
begin read only;
set local statement_timeout='30s';set local lock_timeout='3s';
do $$ begin
 if not exists(select 1 from pg_attribute where attrelid='public.fin_budgets'::regclass and attname='category_id' and not attisdropped and not attnotnull and atttypid='uuid'::regtype)
  or not exists(select 1 from pg_attribute where attrelid='public.fin_budgets'::regclass and attname='user_id' and not attisdropped and attnotnull and atttypid='uuid'::regtype) then
  raise exception '017: category must be nullable UUID; owner must remain required UUID.';
 end if;
 if not exists(select 1 from pg_index i where i.indexrelid=to_regclass('public.fin_budgets_owner_month_plan_uidx') and i.indrelid='public.fin_budgets'::regclass
  and i.indisunique and i.indisvalid and i.indisready and i.indnkeyatts=2 and i.indnatts=2 and i.indexprs is null
  and (select array_agg(a.attname::text order by k.position) from unnest(i.indkey::smallint[]) with ordinality k(number,position)
   join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.number)=array['user_id','month']::text[]
  and pg_get_expr(i.indpred,i.indrelid)='(category_id IS NULL)') then
  raise exception '017: exact unique owner/month partial index for NULL total plans required.';
 end if;
 if not exists(select 1 from pg_constraint c where c.conrelid='public.fin_budgets'::regclass and c.contype='u'
  and (select array_agg(a.attname::text order by k.position) from unnest(c.conkey) with ordinality k(number,position)
   join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.number)=array['user_id','category_id','month']::text[]) then
  raise exception '017: original per-category uniqueness must remain.';
 end if;
 if not exists(select 1 from pg_constraint c where c.conrelid='public.fin_budgets'::regclass and c.conname='fin_budgets_category_payload_type'
  and c.contype='c' and c.convalidated and pg_get_expr(c.conbin,c.conrelid)=
  '(jsonb_typeof((payload -> ''category_id''::text)) = ANY (ARRAY[''string''::text, ''null''::text]))') then
  raise exception '017: validated exact category payload string/JSON-null check required.';
 end if;
 if not exists(select 1 from pg_constraint c where c.conrelid='public.fin_budgets'::regclass and c.contype='f'
  and c.confrelid='auth.users'::regclass and c.confdeltype='c' and c.convalidated
  and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='user_id')]::smallint[]
  and c.confkey=array[(select attnum from pg_attribute where attrelid=c.confrelid and attname='id')]::smallint[])
  or not exists(select 1 from pg_constraint c where c.conrelid='public.fin_budgets'::regclass and c.contype='f'
   and c.confrelid='public.fin_categories'::regclass and c.confmatchtype='s' and c.condeferrable and c.condeferred and c.convalidated
   and (select array_agg(a.attname::text order by k.position) from unnest(c.conkey) with ordinality k(number,position)
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.number)=array['user_id','category_id']::text[]
   and (select array_agg(a.attname::text order by k.position) from unnest(c.confkey) with ordinality k(number,position)
    join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.number)=array['user_id','id']::text[]) then
  raise exception '017: independent Auth owner FK and same-owner MATCH SIMPLE category FK must remain.';
 end if;
 if not (select relrowsecurity from pg_class where oid='public.fin_budgets'::regclass)
  or (select count(*) from pg_policy where polrelid='public.fin_budgets'::regclass)<>1
  or not exists(select 1 from pg_policy b join pg_policy c on c.polrelid='public.fin_categories'::regclass and c.polname='finance_owner_read'
   where b.polrelid='public.fin_budgets'::regclass and b.polname='finance_owner_read' and b.polcmd='r' and b.polpermissive
    and b.polroles=array['authenticated'::regrole::oid] and b.polwithcheck is null
    and md5(pg_get_expr(b.polqual,b.polrelid))='27122a48dc7e42f44c3450782cab9ae0'
    and pg_get_expr(b.polqual,b.polrelid)=pg_get_expr(c.polqual,c.polrelid)) then
  raise exception '017: unchanged owner/active/entitlement SELECT RLS policy required.';
 end if;
 if not has_table_privilege('authenticated','public.fin_budgets','select')
  or has_table_privilege('authenticated','public.fin_budgets','insert,update,delete,truncate,references,trigger')
  or has_table_privilege('anon','public.fin_budgets','select,insert,update,delete,truncate,references,trigger')
  or has_table_privilege('service_role','public.fin_budgets','select,insert,update,delete,truncate,references,trigger')
  or exists(select 1 from pg_class t cross join lateral aclexplode(t.relacl) acl where t.oid='public.fin_budgets'::regclass and acl.grantee=0)
  or not has_function_privilege('service_role','public.finance_commit(uuid,uuid,text,jsonb)','execute')
  or has_function_privilege('authenticated','public.finance_commit(uuid,uuid,text,jsonb)','execute')
  or has_function_privilege('anon','public.finance_commit(uuid,uuid,text,jsonb)','execute') then
  raise exception '017: table read-only authenticated ACL and server-only commit ACL must remain closed.';
 end if;
end $$;
rollback;
