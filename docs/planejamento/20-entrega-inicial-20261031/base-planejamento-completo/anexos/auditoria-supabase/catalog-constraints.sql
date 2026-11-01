BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='3s';

SELECT n.nspname AS schema,c.relname AS relation,k.conname,k.contype,k.convalidated,
k.condeferrable,k.condeferred,pg_get_constraintdef(k.oid,false) AS definition
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','app_private') ORDER BY n.nspname,c.relname,k.conname;

ROLLBACK;