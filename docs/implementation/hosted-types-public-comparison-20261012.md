# Comparação do export hospedado — 12/10/2026

O mantenedor forneceu um novo download do painel pessoal após a migration 019. O arquivo original tem 57.827 bytes, SHA-256 `287b963cfacedf252abe1f8c8e215e4eeb257eb84a5cbdf7357380637d4d1b17` e mtime de 12/10 às 11:12:01 UTC. A origem foi declarada pelo operador; nem mtime, ref informado ou igualdade de tipos autenticam a procedência ou a atualidade. O arquivo contém `public` e `graphql_public`; permanece privado e intacto.

O comparador padrão recusou `SCOPE_NOT_PUBLIC`. A nova opção explícita `--allow-graphql-public` valida o AST inteiro, incluindo os cinco grupos do schema adicional e `Constants`, antes de comparar apenas `public`. O relatório declara a projeção e o schema excluído. Outros schemas continuam recusados. Imports, expressões executáveis, limites, aliases, `Json`, `Constants.public`, argumentos, ordem dos overloads e `ComputedFields` conservam as verificações originais. A opção não modifica o snapshot nem gera um overlay.

A execução pela raiz retornou **`SNAPSHOT_DIFFER`, exit 1**: ambos contêm 35 tabelas, uma view e 55 RPCs, mas 41 objetos diferem. A inspeção AST independente confirmou 151 ocorrências de campos:

| Diferença do baseline local para o download | Ocorrências | Alcance |
| --- | --- | --- |
| `ComputedFields: never` ausente | 36 | 35 tabelas e uma view |
| `NonNullable<Json>` para `Json` | 60 | 20 colunas em 19 tabelas, em Row/Insert/Update |
| `never` para tipos mais amplos em Insert/Update | 50 | 25 colunas em dez tabelas |
| `Args: Record<PropertyKey, never>` para `Args: never` | 5 | `file_cleanup_candidates`, `google_calendar_jobs`, `my_access_state`, `my_sessions`, `prune_operational_data` |

Os 55 retornos RPC, relacionamentos, nomes, flags de propriedades, aliases, `Json` e `Constants.public` permaneceram iguais. Os argumentos sem parâmetros têm branches próprios no SDK instalado; isso não torna os arquivos equivalentes. Nullabilidade e tipos de escrita continuam diferenças materiais para o comparador. Não foram descartados para obter MATCH, e o baseline oficial local pós-019 foi preservado.

Os 29 controles do comparador passaram pela raiz e por revisão independente. A [evidência pública](evidence/hosted-types-public-comparison-20261012.json) contém apenas hashes, contagens, nomes estruturais e limites. A comparação não prova que houve drift no SQL, nem exige uma migration nova. O catálogo hospedado pós-019 tem [prova própria de 1.269 verificações/zero desvios](evidence/hosted-catalogue-post019-20261011.json).

## Origem verificável das regras de geração

A [PR oficial SDK #125](https://github.com/supabase/sdk/pull/125), incorporada em 31/08/2026 pelo [merge `67650c6`](https://github.com/supabase/sdk/commit/67650c6a8bed428ea3e11c90e1a6dd533851c70a) e incluída na [release `postgrest-typegen` 0.2.1 de 02/09/2026](https://github.com/supabase/sdk/commit/146e9cc44b2f8efdbff982346980fe4ed8d01cd3), mudou a emissão de colunas geradas para `?: never`, JSON não anulável para `NonNullable<Json>` e RPCs sem argumentos para `Record<PropertyKey, never>`. São as regras correspondentes às três categorias materiais encontradas; isso não identifica o gerador efetivamente usado pelo Dashboard.

O baseline foi gerado pela CLI 2.120.0. Seu [manifest fixado](https://raw.githubusercontent.com/supabase/cli/v2.120.0/apps/cli/package.json) usa `@supabase/typegen` 0.2.2, cujo [manifest](https://raw.githubusercontent.com/supabase/sdk/typegen/v0.2.2/packages/typegen/package.json) fixa `@supabase/postgrest-typegen` 0.4.0. A [PR CLI #6919](https://github.com/supabase/cli/pull/6919) registra também a emissão de `ComputedFields` em tabelas e views. O [gerador TypeScript 0.4.0](https://raw.githubusercontent.com/supabase/sdk/postgrest-typegen/v0.4.0/packages/postgrest-typegen/src/generation/typescript.ts) contém essas regras; suas opções de geração não oferecem um modo para reverter as diferenças materiais observadas. O [template histórico `postgres-meta` 0.98.0](https://raw.githubusercontent.com/supabase/postgres-meta/v0.98.0/src/server/templates/typescript.ts) apresenta regras correspondentes ao padrão do download. **A versão do gerador do Dashboard permanece desconhecida.** Essa correspondência de código não prova paridade dos metadados SQL hospedados nem equivalência dos contratos TypeScript.

## Mapa canônico dos campos materiais

A leitura estática das migrations versionadas, sem executar SQL, identificou exatamente os campos da inspeção AST. As 25 colunas abaixo são `GENERATED ALWAYS AS ... STORED`; cada uma responde por duas diferenças, em Insert e Update:

| Fonte canônica | Tabelas e colunas | Colunas |
| --- | --- | --- |
| [Busca global](../../supabase/migrations/20261009154609_global_search_activity.sql), lista literal de sete tabelas nas linhas 14–18 e declarações nas linhas 21–22 | `tasks`, `captures`, `knowledge_pages`, `fin_transactions`, `drive_files`, `projects`, `habits`: `search_document`, `search_terms` em cada tabela | 14 |
| [Financeiro](../../supabase/migrations/20261009144343_financial_transactions.sql), linhas 9–13/20/27/35/37 | `fin_accounts`: `institution`, `color_key`, `credit_limit_cents`, `statement_closing_day`, `payment_due_day`; `fin_categories.color_key`; `fin_tags.color_key`; `fin_transactions`: `is_paid`, `payee`, `notes` | 10 |
| [Conhecimento](../../supabase/migrations/20261009144350_knowledge_pages_links.sql), linha 42 | `knowledge_pages.search_vector` | 1 |

Os 20 campos abaixo são `jsonb NOT NULL` nas migrations. São 19 colunas `payload` e `knowledge_pages.document`; cada campo responde por três diferenças, em Row, Insert e Update:

| Fonte canônica | Tabelas/colunas e linhas | Colunas |
| --- | --- | --- |
| [Captura e tarefas](../../supabase/migrations/20261007210519_capture_task_transactions.sql) | `categories.payload` 27; `projects.payload` 32; `captures.payload` 37; `tasks.payload` 46 | 4 |
| [Financeiro](../../supabase/migrations/20261009144343_financial_transactions.sql) | `fin_accounts.payload` 7; `fin_categories.payload` 18; `fin_tags.payload` 25; `fin_transactions.payload` 31; `fin_budgets.payload` 57 | 5 |
| [Conhecimento](../../supabase/migrations/20261009144350_knowledge_pages_links.sql) | `knowledge_notebooks.payload` 32; `knowledge_pages.payload` 38; `knowledge_pages.document` 40; `links.payload` 64 | 4 |
| [Projetos e hábitos](../../supabase/migrations/20261009152200_projects_habits.sql) | `habits.payload` 6; `habit_entries.payload` 15; `habit_pauses.payload` 20; `drive_folders.payload` 25 | 4 |
| [Storage histórico](../../supabase/migrations/20261009152822_private_storage_drive.sql) | `drive_files.payload` 17 | 1 |
| [Cofre](../../supabase/migrations/20261009160151_encrypted_vault.sql) | `vault_master_keys.payload` 5; `vault_items.payload` 6 | 2 |

O inventário inclui estruturas históricas do Drive que continuam no schema; isso não retoma sua entrega no MVP. O JSON de evidência conserva cada campo, linha e hash das sete fontes. `NOT NULL` é uma declaração SQL: a própria PR #125 documenta o caso de JSON literal `null` serializado como JavaScript `null`; não foi feita alegação sobre valores armazenados.

## Limite da prova hospedada e conclusão da revisão

O [catálogo pós-019](evidence/hosted-catalogue-post019-20261011.json) executou a versão exata de [release-catalog.sql](../../supabase/tests/release-catalog.sql), SHA-256 `06b61763ec27661000b01f9a34add2a1e1634d8cbd861d16c5c670894ba5d73c`, em leitura com rollback. Seus 1.269 checks confirmam o inventário, RLS/ACL, limites de funções, políticas e definições revisadas, incluindo tipos/nullabilidade de `auth.sessions`. Esse catálogo **não verifica `attgenerated` das 25 colunas públicas nem a nulabilidade dos 20 campos JSON públicos**. Logo, sua aprovação não estabelece paridade hospedada desses campos.

Na [implementação da CLI 2.120.0](https://raw.githubusercontent.com/supabase/cli/v2.120.0/apps/cli/src/commands/gen/types/types.handler.ts), TypeScript com `--project-id`/`--linked` usa a Management API; `--local`/`--db-url` usa o [gerador embarcado com introspecção](https://raw.githubusercontent.com/supabase/cli/v2.120.0/apps/cli/src/commands/gen/types/types.generator.layer.ts). Fixar a CLI e repetir `--project-id` não fixa o gerador remoto. O caminho direto seria uma coleta separada com credenciais autorizadas, que não estão disponíveis nesta revisão; ele não foi executado nem se tornou um aceite adicional.

**Comparação e revisão concluídas:** o export foi obtido e comparado; as 41 diferenças/151 ocorrências foram revisadas com o schema canônico e fontes oficiais. Os formatos continuam distintos, `SNAPSHOT_DIFFER` permanece e o baseline local foi mantido. Nenhum MATCH, equivalência ou paridade de colunas hospedadas foi declarado. A operação histórica de conferir catálogo/export da #35 está documentada; seus cinco aceites literais — ausência de leaks, backup/restore, asserções em produção, seis jornadas desktop/iPhone e auditoria Impeccable — continuam sujeitos às respectivas provas. Este registro não fecha issues, não acrescenta gate à #37 e não exige outro arquivo para declarar esta revisão concluída. O [runbook](../operations/database-types.md) mantém as salvaguardas para qualquer coleta futura.
