-- Read-only metadata for diagnose-type-generators.mjs. No user rows are read.
begin transaction read only;
select c.relname as relation, a.attname as column_name, a.attnotnull as sql_not_null,
       a.attgenerated as generated, format_type(a.atttypid,a.atttypmod) as sql_type
from pg_attribute a
join pg_class c on c.oid=a.attrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped
  and ((a.attname in ('payload','document') and format_type(a.atttypid,a.atttypmod)='jsonb') or a.attgenerated<>'')
order by c.relname,a.attname;
rollback;
