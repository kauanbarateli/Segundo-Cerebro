BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='3s';

WITH term AS (SELECT '(utm_|attribution|touchpoint|acquisition|clickup|feedback_request|roadmap|admin_session_grant|feature_release|trial_started|beta_access|purge_after)'::text AS pattern)
SELECT 'column' AS kind,c.table_schema AS schema,c.table_name AS object,c.column_name AS member
FROM information_schema.columns c,term t
WHERE c.table_schema NOT IN ('pg_catalog','information_schema') AND (c.table_name~*t.pattern OR c.column_name~*t.pattern)
UNION ALL
SELECT 'routine',n.nspname,p.proname,p.oid::regprocedure::text
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,term t
WHERE n.nspname IN ('public','app_private') AND (p.proname~*t.pattern OR p.prosrc~*t.pattern)
ORDER BY kind,schema,object,member;

ROLLBACK;