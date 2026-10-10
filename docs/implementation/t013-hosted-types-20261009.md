# Tipos do catálogo pessoal — T-013 / issue #20

Em 09/10/2026, depois de informar a aplicação da 016, o mantenedor forneceu `supabase.ts`, baixado pelo fluxo oficial do Dashboard pessoal solicitado nesta conversa. A origem é **informada pelo mantenedor**, não uma coleta autenticada pelo comparador. O arquivo local regular foi lido com limite de bytes, UTF-8 estrito e parser AST; não foi importado, executado ou usado para obter credenciais. O catálogo hosted separado passou às 22:51:10.820 em Fortaleza em **1.246 checks, zero desvios**.

## Origem e projeção revisada

| Registro | Valor |
| --- | --- |
| Projeto declarado | `rishenjoikgmfubmnfiu`, organização pessoal |
| Metadata do gerador | `PostgrestVersion: "14.18"`; versão da CLI não informada, export pelo Dashboard |
| Arquivo original | 57.755 bytes; mtime observado `2026-10-10T02:02:04.039Z` (09/10 às 23:02:04.039 em Fortaleza), não assumido como horário de geração |
| SHA-256 original | `fe3311020ce96df057a0eef03965b681ed14777a64284ba34496ba28cc80c098` |
| Revisão local | `2026-10-10T02:05:12.161Z` (09/10 às 23:05:12.161 em Fortaleza) |
| Schemas presentes | `public` e `graphql_public`, além de `__InternalSupabase` |
| Projeção pública versionada | [database.generated.ts](../../src/lib/supabase/database.generated.ts), 57.292 bytes |
| SHA-256 da projeção | `b276785f3cc9698b868a264635991f256a2c2477c3be1266e814fe8bbc8e14f0` |

O arquivo original fica fora do Git. O comparador corretamente recusou o export completo com `SCOPE_NOT_PUBLIC`; seu escopo não foi ampliado. A revisão removeu **somente** as propriedades `Database.graphql_public` e `Constants.graphql_public`, por seus intervalos AST. Declarações, metadata, helpers e bytes de todo o contrato público foram preservados. O arquivo versionado é uma **projeção pública derivada do export**, não uma cópia byte a byte do arquivo original. A evidência privada ignorada registra ambos os hashes e a derivação.

O baseline anterior tinha 12 tabelas e 11 RPCs. A comparação encontrou **23 tabelas adicionadas, cinco tabelas alteradas, uma view adicionada e 43 RPCs adicionadas**: o recorte inicial ainda não descrevia todo o MVP instalado. A projeção atual contém **35 tabelas, uma view e 54 RPCs**. A atualização não altera banco, grants ou permissões e não requer migration nova. Não reaplicar 001–016 ou bootstrap.

## Integração e detecção de divergências

Os adapters de Administração, Financeiro, Cofre, Calendário, Conhecimento, Projetos/Hábitos, Drive, Busca e Configurações passam a usar `Database` e argumentos por RPC conferidos com `satisfies`. Foram retiradas as seis extensões `Planned*` e os casts globais de `client.rpc`. Os validadores JSON em runtime, isolamento, pins e erros continuam necessários: a tipagem de `Json` não prova um DTO correto.

O gerador representa argumentos UUID como `string`, sem expressar a nulabilidade que o corpo SQL permite. As exceções são limitadas aos campos `google_calendar_call.p_session` (cron), `file_upload_reserve.p_folder` (raiz) e `file_avatar_set.p_file` (remoção). A adaptação preserva `null` explícito no transporte e não alarga todas as funções. As RPCs com `Args: never` são chamadas sem um segundo argumento. Testes com SDK real e fetch falso verificam serialização, guards e respostas inválidas; não acessam o Supabase.

O [portão de contratos locais](../../scripts/operations/database-contracts.mjs), chamado pelo [runner PostgreSQL descartável](../../scripts/test-local-sql.mjs), confronta o arquivo versionado com a cadeia de migrations **realmente executada no banco local em memória**. Compara inventário de tabelas/views/RPCs, nomes exatos de colunas `Row`, nomes e obrigatoriedade por defaults dos argumentos de entrada. O recorte atual passou com **35 tabelas, uma view, 54 RPCs, 326 colunas e 194 argumentos**. Controles negativos alteram o catálogo de forma independente do snapshot e comprovam recusa. Overloads não revisados são recusados. O CI existente executa esse portão sem credenciais, rede de banco ou schema remoto.

Assinaturas com `proargmodes` diferente de `null` (OUT/INOUT/VARIADIC/TABLE ou metadata ausente) exigem revisão e são recusadas antes da comparação de Args. O PostgreSQL conta entradas em `pronargs`, mas inclui saídas em `proargnames`, conforme o [catálogo oficial `pg_proc`](https://www.postgresql.org/docs/17/catalog-pg-proc.html): um controle com OUT antes de IN reproduz a projeção posicional incorreta que poderia aceitar um argumento de saída como entrada. A regressão usa PostgreSQL descartável real e confirma a recusa pelo portão, sem alterar as 54 assinaturas comuns do recorte vigente.

Esse portão não é geração oficial, não compara a semântica completa dos tipos SQL/TypeScript, Insert/Update/relacionamentos, retornos JSON, enums ou composites, não prova RLS e **não detecta mudanças feitas somente no projeto hosted depois da coleta**. Divergência hospedada exige novo export e catálogo readonly pelo canal pessoal autorizado; não habilitar geração, migrations ou seeds remotos no CI. Igualdade do baseline com a projeção fornecida é uma verificação de integração, não uma segunda coleta independente. As flags `provenance_verified` e `freshness_verified` do comparador permanecem `false`.

## Aceites restantes

A obtenção manual informada, revisão da projeção e integração substituem a pendência de obter os tipos deste recorte. A origem continua registrada como relato do mantenedor; coleta periódica hospedada não foi configurada. Concorrência/conexões realmente sobrepostas conservam seus próprios aceites na issue #20. Jornadas autenticadas, SMTP/Google, jobs, Storage, backup/restore e dispositivos seguem o [relatório de pendências](entrega-mvp-pendencias.md); não são comprovados pelos tipos. A [issue #35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) registra CI e deployment por revisão, depois de concluídos.
