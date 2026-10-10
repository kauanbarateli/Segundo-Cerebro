# Progresso dos lotes de limpeza de arquivos

Revisão de 09/10/2026, T022 / issue #29. A migration **015**, `20261009231338_file_cleanup_fairness.sql`, foi preparada e validada localmente. Na retomada, o mantenedor informou sua aplicação manual; não houve reaplicação por esta revisão. A conferência readonly posterior no painel pessoal confirmou o fingerprint do corpo completo da função. O relato de aplicação de 001–015 não comprova sozinho os demais hashes e contratos do banco atual; BlackSheep/VOE permanecem fora do escopo.

## Defeito reproduzido

`app_private.file_cleanup_candidates()` limita cada chamada a 100 reservas. A versão de 011 ordena por `expires_at, id`; reservas `expired` já limpas voltam a ser elegíveis após um dia. O ACK atualiza `cleaned_at`, mas não `expires_at`.

Com 150 reservas antigas já reconciliadas e um órfão recente, uma chamada diária retorna sempre as primeiras 100 antigas: seus vencimentos continuam anteriores ao do órfão mesmo depois do ACK. Uma segunda chamada imediata poderia avançar, mas a execução diária de um lote não garante essa segunda chamada. A reprodução em PGlite com 001–014 confirmou o problema.

## Regra de ordenação

015 substitui somente a definição da função privada, com esta chave de ordenação:

```sql
order by coalesce(r.cleaned_at + interval '1 day', r.expires_at),
         r.expires_at, r.id
limit 100
```

A primeira limpeza usa o vencimento da reserva. Uma revisita usa a última confirmação acrescida da janela diária. Depois de um ACK bem-sucedido, a reserva volta atrás do trabalho cujo instante de reconciliação ainda está vencido. Uma revisita antiga também permanece à frente de primeiras limpezas mais recentes; não existe prioridade absoluta para `cleaned_at IS NULL`.

Essa chave ordena as candidatas já elegíveis; não acrescenta uma espera de um dia para anexos finalizados que se tornaram órfãos. Elegibilidade, limite, assinatura, flags, `search_path=''`, locks de usuário/reserva/arquivo, rechecagem de lease, mudança de status, proteção de vínculos, eventos e formato do resultado permanecem iguais. O ACK e o guard de snapshot não são alterados. A quota continua contabilizada até a confirmação da remoção.

`CREATE OR REPLACE` conserva a identidade da função, o dono e as permissões existentes; isso é o comportamento documentado pelo [PostgreSQL](https://www.postgresql.org/docs/current/sql-createfunction.html). O preflight exige a função instalada e execução como `postgres`, evitando criar acidentalmente uma função com permissões padrão em uma base sem a fundação. Nenhuma tabela, índice, policy, grant ou wrapper público é acrescentado. Os 14 arquivos anteriores foram comparados byte a byte com `HEAD` e permanecem intactos.

## Evidência local

Comando executado em base PGlite descartável, com fixtures Auth/Storage de catálogo e sem conexão externa. A asserção é somente para base dedicada vazia; não executar sobre contas reais:

```text
node scripts/test-local-sql.mjs supabase/tests/drive-cleanup-fairness.sql supabase/tests/drive-attachments-cleanup.sql supabase/tests/drive-storage-behavior.sql supabase/tests/drive-storage-catalog.sql supabase/tests/release-catalog.sql
```

No checkpoint original de 015, as cinco asserções passaram; o catálogo conservou **1.242 checks, zero desvios**. A regressão demonstra:

- 150 revisitas vencidas: após ACK das primeiras 100 e avanço sintético de 25 horas nos relógios das reservas, o segundo lote diário contém o upload abandonado recente e a imagem órfã. Todas as 150 revisitas estão elegíveis outra vez, de modo que o ensaio realmente cobre o ciclo diário.
- 50 revisitas vencidas e 150 primeiras limpezas recentes: o lote contém as 50 revisitas e 50 primeiras limpezas. Tentativa sem ACK não avança o relógio de ordenação.
- Quota de 40 bytes antes da confirmação, inclusive após agendar a exclusão da imagem; 30 bytes depois do ACK, correspondentes aos três arquivos protegidos. Drive, avatar referenciado e imagem vinculada à Captura continuam íntegros e com seus vínculos.
- Lease de finalização ativo e reserva com vencimento futuro continuam excluídos; o ACK desses casos é recusado com `40001` sem alterar o claim.
- Cada cenário volta ao baseline de usuários, reservas, arquivos e eventos após `ROLLBACK TO SAVEPOINT`; o arquivo termina com `ROLLBACK`. O runner também confirma zero usuários sintéticos ao final.

Controles negativos foram executados separadamente na mesma infraestrutura descartável: sem 015, a regressão falha no avanço do upload recente no segundo dia; com a alternativa `cleaned_at NULLS FIRST`, o cenário inverso falha nas 50 revisitas. Após os rollbacks dos controles, usuários, reservas, arquivos e eventos estavam todos em zero.

## Conferência readonly da definição aplicada

A auditoria de retomada encontrou uma lacuna no catálogo: 001–014 e 001–015 retornavam igualmente `ok=true`, 1.242 checks e nenhum desvio. Assinatura, permissões e policies permanecem iguais nessa migration; os checks anteriores não distinguiam o corpo antigo do corrigido. Essa prova usou somente PGlite descartável vazio e terminou sem usuários, reservas, arquivos ou eventos.

`supabase/tests/release-catalog.sql` agora acrescenta `reviewed_cleanup_definition` para `app_private.file_cleanup_candidates()`. A consulta permanece em `BEGIN TRANSACTION READ ONLY`, com timeouts e `ROLLBACK`; não executa o RPC nem lê conteúdo pessoal. Compara o SHA-256 do **`pg_proc.prosrc` inteiro** da definição revisada de 015, convertido para UTF-8:

```text
57c5cd0cf62b5992b186850cef9690cb3fb10ef3e29180e8c1e0933a59a71d50
```

Este digest é do corpo PL/pgSQL, não o SHA-256 do arquivo de migration. A única normalização é `CRLF` → `LF`, necessária porque a fonte Windows e o transporte pelo SQL Editor podem mudar finais de linha. Não se remove whitespace, não se ignora comentário, não se altera literal e não se usa deparse da função; os demais bytes devem ser idênticos, inclusive os espaços e quebras nas extremidades. A função `pg_catalog.sha256(bytea)` é builtin: o ensaio confirmou seu namespace e ausência de dependência de extensão, além da igualdade com SHA-256 calculado em Node.

Com 001–014, o relatório agora retorna `ok=false`, **1.243 checks** e exatamente este desvio fechado:

```json
{"check":"reviewed_cleanup_definition","object":"app_private.file_cleanup_candidates()"}
```

Com 001–015, retorna `ok=true`, **1.243 checks, zero desvios**. A regressão versionada em `tests/scripts/release-catalog.test.mjs` também aprova versões LF/CRLF e recusa enfraquecimento da rechecagem de lease mesmo mantendo o ORDER BY aprovado, alteração de comentário e espaço adicional no corpo. A definição original é restaurada apenas na base descartável, e os quatro contadores de resíduos permanecem em zero. O DTO e a saída fechada de `release-checks.mjs` não precisaram mudar.

```text
node --test tests/scripts/release-catalog.test.mjs tests/scripts/operations.test.mjs
```

Os nove testes focados passaram. A nova checagem estreita não verifica todos os corpos das demais funções, não comprova execução de cron e não substitui os ensaios de comportamento, concorrência, Auth ou Storage hospedados. Divergência de corpo bloqueia a conferência e exige revisão da aplicação e da fonte canônica; nunca calcular um novo digest a partir do banco de produção para aceitar automaticamente o desvio.

## Limites e operação pendente

Somente ACK bem-sucedido avança a reconciliação. Se a remoção de objetos de uma candidata falhar permanentemente, seu relógio não avança: esta alteração **não garante progresso da fila diante de falhas permanentes sem ACK**. Também não promete um prazo fixo para uma fila que cresce acima da capacidade de processamento. Não confirmar uma remoção malsucedida para contornar esses casos; investigar as falhas operacionais e conferir o resultado no Storage antes do ACK.

Este ensaio testa metadados e ACK simulado. Não houve upload/remoção de bytes reais, execução de cron, ensaio de concorrência, consulta a dados pessoais nem conferência de RLS/Storage hospedados. O lote continua em 100 e o índice existente continua disponível para a seleção; não há evidência de carga hospedada que justifique acrescentar índice nesta correção funcional.

Após a aplicação manual informada, o catálogo readonly foi executado no SQL Editor do projeto pessoal autorizado `rishenjoikgmfubmnfiu`, com rollback. O check `reviewed_cleanup_definition` passou; o resultado completo teve 1.246 verificações e um desvio separado de default ACL de sequências, `public.S`. A [016 preparada](sequence-defaults.md) trata esse default futuro e permanece pendente de aplicação manual. A definição da 015 está confirmada; o catálogo hospedado ainda exige zero desvios antes do aceite. Não reaplicar 001–015 ou bootstrap, nem usar BlackSheep/VOE como alternativas. O pacote SQL Editor e seu manifest foram regenerados e conferidos na integração, com os bytes da 015 preservados.
