-- ARQUIVO DE APOIO, NAO EXECUTADO COM SUCESSO NESTE PLANEJAMENTO.
-- Conferir manualmente projeto pessoal e ambiente antes de executar.
-- Consulta somente nomes/definicoes de catalogo, nunca dados de visitantes/usuarios.
-- Resultado vazio nao prova ausencia de tracking com nomes diferentes.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';

SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema IN ('public', 'app_private')
  AND (
    table_name ~* '(utm|attribution|acquisition|touchpoint|journey|consent)'
    OR column_name ~* '(utm_|attribution|touchpoint|referrer|campaign)'
  )
ORDER BY table_schema, table_name, ordinal_position
LIMIT 200;

SELECT n.nspname AS schema_name, p.proname AS routine_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'app_private')
  AND (
    p.proname ~* '(utm|attribution|acquisition|touchpoint|journey|consent)'
    OR p.prosrc ~* '(utm_source|utm_medium|utm_campaign|utm_term|utm_content)'
  )
ORDER BY n.nspname, p.proname
LIMIT 100;

ROLLBACK;
