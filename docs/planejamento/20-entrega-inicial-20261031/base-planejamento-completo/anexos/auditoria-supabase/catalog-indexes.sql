BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='3s';

SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes
WHERE schemaname IN ('public','app_private') ORDER BY schemaname,tablename,indexname;

ROLLBACK;