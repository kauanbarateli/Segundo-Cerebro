# Evidências da auditoria Supabase

Coleta de metadados do projeto pessoal `rishenjoikgmfubmnfiu` em 31/10/2026 no fuso America/Fortaleza, já 01/11 em UTC. Base Git `bd35288404c493d1b03f7a1a0208f808cc2079a2`.

Leia [o diagnóstico e as limitações](../../16-auditoria-supabase.md) antes de interpretar os arquivos. [audit-summary.json](audit-summary.json) resume o escopo. Os JSONs são resultados estruturais normalizados; as estimativas de quantidade de linhas de usuários foram retiradas do inventário de tabelas. Não há dados de contas individuais, conteúdo de módulos, objetos de Storage, tokens ou senhas neste pacote.

- [release-catalog-result.json](release-catalog-result.json): preserva `ok=false`, 2.512 checks e a divergência do wrapper.
- [onboarding-patch-comparison.json](onboarding-patch-comparison.json): compara hash/CRLF e privilégios com o patch operacional versionado; não altera o resultado anterior.
- [migration-comparison.csv](migration-comparison.csv): 27 arquivos, cinco registros e 22 casos para reconciliar, sem inferir que devem ser reaplicados.
- [new-features.json](new-features.json): lista vazia da busca por estruturas dedicadas; escopo e termos estão na [consulta](../../anexos/auditoria-supabase/catalog-new-features.sql).
- [cron.json](cron.json): configuração e contagens agregadas; corpo do comando preservado somente como hash para não expor eventuais segredos de agendamento.

Os demais arquivos registram catálogo, policies, permissões, constraints, índices, triggers, buckets, extensões e advisors. As [consultas de release](../../anexos/auditoria-supabase/release-catalog.sql) e de catálogo foram executadas em transação READ ONLY. Não houve alteração remota nem acesso a projetos de terceiros.
