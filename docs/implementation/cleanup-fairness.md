# Progresso dos lotes de limpeza de arquivos

Revisão de 09/10/2026, T022 / issue #29. A migration **015**, `20261009231338_file_cleanup_fairness.sql`, está versionada para **aplicação manual posterior**. Não foi aplicada remotamente. OP-012 permanece vigente; o relato de aplicação de 001–014 não é uma conferência do banco atual.

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

As cinco asserções passaram; o catálogo conservou **1.242 checks, zero desvios**. A nova regressão demonstra:

- 150 revisitas vencidas: após ACK das primeiras 100 e avanço sintético de 25 horas nos relógios das reservas, o segundo lote diário contém o upload abandonado recente e a imagem órfã. Todas as 150 revisitas estão elegíveis outra vez, de modo que o ensaio realmente cobre o ciclo diário.
- 50 revisitas vencidas e 150 primeiras limpezas recentes: o lote contém as 50 revisitas e 50 primeiras limpezas. Tentativa sem ACK não avança o relógio de ordenação.
- Quota de 40 bytes antes da confirmação, inclusive após agendar a exclusão da imagem; 30 bytes depois do ACK, correspondentes aos três arquivos protegidos. Drive, avatar referenciado e imagem vinculada à Captura continuam íntegros e com seus vínculos.
- Lease de finalização ativo e reserva com vencimento futuro continuam excluídos; o ACK desses casos é recusado com `40001` sem alterar o claim.
- Cada cenário volta ao baseline de usuários, reservas, arquivos e eventos após `ROLLBACK TO SAVEPOINT`; o arquivo termina com `ROLLBACK`. O runner também confirma zero usuários sintéticos ao final.

Controles negativos foram executados separadamente na mesma infraestrutura descartável: sem 015, a regressão falha no avanço do upload recente no segundo dia; com a alternativa `cleaned_at NULLS FIRST`, o cenário inverso falha nas 50 revisitas. Após os rollbacks dos controles, usuários, reservas, arquivos e eventos estavam todos em zero.

## Limites e operação pendente

Somente ACK bem-sucedido avança a reconciliação. Se a remoção de objetos de uma candidata falhar permanentemente, seu relógio não avança: esta alteração **não garante progresso da fila diante de falhas permanentes sem ACK**. Também não promete um prazo fixo para uma fila que cresce acima da capacidade de processamento. Não confirmar uma remoção malsucedida para contornar esses casos; investigar as falhas operacionais e conferir o resultado no Storage antes do ACK.

Este ensaio testa metadados e ACK simulado. Não houve upload/remoção de bytes reais, execução de cron, ensaio de concorrência, consulta a dados pessoais nem conferência de RLS/Storage hospedados. O lote continua em 100 e o índice existente continua disponível para a seleção; não há evidência de carga hospedada que justifique acrescentar índice nesta correção funcional.

A aplicação manual de 015 deve ocorrer somente no projeto pessoal autorizado `rishenjoikgmfubmnfiu`, após revisão e conferência do destino, em sequência depois de 014, sem reaplicar as anteriores. BlackSheep/VOE nunca são alternativas. A atualização do pacote SQL Editor, de seu manifest e do relatório final pertence à integração da entrega; este registro não os regenera nem atesta a aplicação de 015.
