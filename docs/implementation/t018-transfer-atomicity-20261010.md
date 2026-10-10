# T-018 — atomicidade da transferência no esquema instalado

Checkpoint local de 10/10/2026. A raiz e a revisão independente aprovaram a ampliação de [finance-behavior.sql](../../supabase/tests/finance-behavior.sql), SHA-256 `ab09270a4761407e2e515b00c81ca18785b23ee2a1483c5db20d862e8ba9bc2f`. A cadeia local completa passou com **17 migrations/35 asserções**, catálogo **1.243 checks/zero desvios**. O log privado ignorado é `work/finance-transfer-local-sql-20261010.log`. Esse ensaio usa **PGlite/PG18 com fixtures Auth/Storage**, termina em `ROLLBACK` e não executa Supabase hospedado, GoTrue, Postgres 17 nativo ou concorrência real. O CI deste delta ainda aguarda evidência vinculada ao SHA; a aprovação das revisões anteriores permanece histórica.

## Falha entre as duas pernas

O controle chama a RPC instalada `public.transfer` para mover 5000 centavos entre duas contas correntes sintéticas, com grupo próprio e separado do pagamento de fatura. O gatilho de teste falha na entrada da segunda perna somente depois de conferir dono, conta de destino, grupo e **payload exato da primeira perna já visível**. Exige o SQLSTATE `23514` e o marcador fixo `T018_TRANSFER_SECOND_LEG_OBSERVED`; outro CHECK não satisfaz esse controle.

Depois da falha, a igualdade do snapshot inteiro e da revisão comprova que não persistiram perna órfã, Evento ou recibo. Desligada a falha, o mesmo comando confirma duas pernas exatas, dois Eventos e um recibo; a revisão cresce cinco unidades pelos registros correspondentes. O replay retorna o resultado anterior antes da validação de CAS e conserva snapshot/revisão integralmente. As somas independentes da view são 455000 centavos na origem e 505000 no destino, após o pagamento parcial anterior.

`pay_statement` conserva seu controle separado de falha da segunda perna, ausência de resíduos e revisão inalterada, seguido de sucesso/replay. `close_account` arquiva a origem e preserva o histórico completo, as duas pernas dos dois grupos e o payload exato da contraparte; a conta de destino continua ativa. Os [testes do Core](../../tests/core/finance-transactions.test.ts) já cobriam falha entre pernas, falha de Evento/commit, replay e arquivamento. A ampliação SQL fecha a lacuna de chamar `public.transfer` nesse controle instalado; não declara execução HTTP ou falha hospedada.

## Cinco critérios originais de T-018

Todos estão implementados e testados **localmente** sobre o modelo fundido, com canais e limites separados:

| Critério do planejamento | Evidência local |
| --- | --- |
| Main: `paid_cents`/horizontes; v2: plano/estorno/status | [Equivalências main e massa autorada de 20](t018-finance-regression-installed-20261010.md), [porte literal v2 de 18 e plano total](t018-legacy-v2-port-20261010.md). A massa nova não é apresentada como cópia literal histórica. |
| `is_paid` gerada e escrita direta recusada | Asserções instaladas recusam a escrita com `428C9`; a flag é derivada, sem campo adicional no DTO. |
| Exceção única do cartão e dívida desde a compra | Gatilho instalado, [massa de 20](../../supabase/tests/finance-regression-installed.sql) e [18 históricos](../../supabase/tests/finance-legacy-v2-installed.sql), com oráculos monetários independentes. |
| `transfer`/`pay_statement` sem perna órfã na falha | Controle instalado descrito acima e regressões do Core; sucesso/replay não geram duplicação. |
| `close_account` conserva a perna da outra conta | Snapshot/histórico/payload da contraparte e conta sobrevivente conferidos pelo SQL e pelo Core. |

A [migration 017](../../supabase/migrations/20261010044217_finance_monthly_plan.sql) do plano total continua **pendente de aplicação manual/conferência hospedada**, seguida de **novo export oficial**. O export pós-016 não é alterado para simular nullable. Não reaplicar 001–016, bootstrap ou asserções com fixtures no ambiente pessoal. Este delta muda somente validação, sem nova migration; a UI do plano total pertence à fase 2. A #25 não é encerrada por este relatório, e os aceites de interface/transações simultâneas dos filhos conservam suas provas próprias.
