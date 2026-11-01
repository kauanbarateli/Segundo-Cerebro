BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='3s';

SELECT n.nspname AS schema,c.relname AS relation,t.tgname,t.tgenabled,
t.tgdeferrable,t.tginitdeferred,pg_get_triggerdef(t.oid,false) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal AND (n.nspname IN ('public','app_private') OR (n.nspname='auth' AND c.relname='users'))
ORDER BY n.nspname,c.relname,t.tgname;

ROLLBACK;