# T-018 — massa financeira sobre o esquema instalado

Checkpoint local de 10/10/2026 (Fortaleza), anterior à 017. A [asserção financeira](../../supabase/tests/finance-regression-installed.sql) executou os 20 lançamentos da [massa autorada](../../tests/fixtures/finance-regression.ts) sobre as 16 migrations canônicas, em PostgreSQL PGlite descartável. O resultado foi aprovado e a transação terminou com `ROLLBACK`. Esta asserção não é migration e não foi executada no Supabase hospedado; 001–016 não foram reaplicadas. A nova 017 preparada posteriormente tem estado próprio abaixo.

Os identificadores simbólicos da fixture foram mapeados para UUIDs exclusivos do ensaio; os demais campos, valores e estados foram preservados. A massa continua sendo uma autoria nova: no checkpoint anterior, o arquivo histórico de regressão da v2 não havia sido localizado nos snapshots locais consultados; isso nunca afirmou ausência em todo o histórico Git. A referência foi recuperada posteriormente e seu porte de 18 lançamentos é separado desta massa de 20. O mapeamento de regras usa o [D-006](../planejamento/06-arquitetura-de-dados.md) e o [T-018](../planejamento/13-tickets.md).

| Regra do modelo fundido | Casos e evidência local |
| --- | --- |
| Main: pagamento parcial e saldo realizado | `partial-cash` conserva `paid_cents=2000` para valor de 5000; a view instalada `fin_account_balances`, sob `authenticated`, retorna os saldos calculados à mão abaixo. |
| Main: `is_paid` gerado e exceção única do cartão | As 20 linhas produzem 16 flags verdadeiras e quatro falsas; escrita direta da coluna falha com `428C9`, e inseri-la no payload falha com `22023`. Um controle separado, desfeito por savepoint antes dos totais, comprova que o gatilho força pagamento integral da compra no cartão sem trocar seu estado `planned`. |
| Main: competência, séries e horizonte | A compra em 30/06 com fatura de julho entra em julho; a parcela de agosto conserva grupo, número e total; a recorrência de setembro conserva seus metadados e fica fora dos totais realizados por estar planejada. Julho, agosto e o trimestre civil têm expectativas fixas independentes. |
| V2: ciclo de vida | `planned`, `pending`, `cancelled` e linhas excluídas não entram no realizado; `reconciled` entra. Pagamento integral não promove estado: compra pendente e recorrência planejada no cartão podem ter `is_paid=true` e continuar fora do realizado. |
| V2: estorno e orçamento por categoria | Receitas na categoria de despesa abatem o orçamento; os estornos de caixa e cartão preservam essa categoria. O orçamento alimentar de julho resulta em 31000 centavos. Este recorte não comprova o plano total nem amplia a cobertura das faixas de alerta 80/100, já tratadas no Core. |
| Main/v2: transferência, pagamento da fatura e legado sem competência | Duas pernas da transferência somam zero e não criam receita/despesa; o pagamento reduz a fatura. O lançamento órfão é sinalizado/excluído dos totais por competência, mas participa do fallback histórico da fatura. |

Todos os valores estão em centavos, sem arredondamento:

| Medida | Expectativa manual |
| --- | --- |
| Julho: receitas / despesas / resultado / quantidade | 104000 / 38000 / 66000 / 7 |
| Conta corrente | `100000+100000+2000−10000−2000−7000−5000−3000 = 175000` |
| Reserva | `200000+7000 = 207000` |
| Cartão: saldo / dívida | `−20000+2000+5000−10001−4000 = −27001` / 27001 |
| Patrimônio em contas sem cartão | `175000+207000 = 382000` |
| Fatura de julho: total / pago / aberto | `20000−2000+4000 = 22000` / 5000 / 17000 |
| Alimentação em julho | `10000−2000+5000+20000−2000 = 31000` |
| Órfão de competência | 1 lançamento / 4000 |
| Agosto: parcela realizada | 1 lançamento / 10001 |
| Setembro: recorrência planejada no realizado | 0 lançamentos |
| Trimestre civil julho–setembro: despesas | `38000+10001 = 48001` |

A fixture atravessa os gatilhos instalados e a RPC `finance_snapshot`, com ator e sessão exatos. O snapshot conserva os 20 payloads e os metadados de conta, categoria e orçamento; `is_paid` permanece uma coluna gerada, sem ser acrescentado ao DTO. A sessão de outro usuário não pode obter o snapshot, e a view com `security_invoker` não expõe os saldos do primeiro usuário à segunda sessão local.

Os agregados de competência, orçamento e fatura são consultas de referência sobre as colunas instaladas, comparadas às constantes manuais. Não existe alegação de que esses cálculos sejam uma RPC de agregação, nem de que este ensaio tenha chamado comandos de produção: as inserções sintéticas diretas não geram evidência de receipts, Activity, atomicidade dos comandos ou concorrência. Os stubs locais de Auth não comprovam Auth hospedado; juros, calendários extremos, recorrências completas, navegador, desempenho e jornadas HTTP continuam sujeitos às validações próprias.

Reprodução exclusivamente local: `node scripts/test-local-sql.mjs supabase/tests/finance-regression-installed.sql`. O runner cria o banco descartável e descobre a asserção na suíte local; o gerador também a inclui como validação separada no [manifest do SQL Editor](../../supabase/sql-editor/manifest.json). Não executar este arquivo como migration, seed ou orientação de aplicação em produção. Ele exige Auth local vazio e encerra com `ROLLBACK`.

## Continuidade: fonte v2 recuperada e 017 manual pendente

A [fonte primária histórica](https://github.com/kauanbarateli/segundo_cerebro/blob/a9422bcb90dc8965de4695570c9d338881e78975/src/lib/regressao-financeira.test.ts) foi recuperada no commit `a9422bcb90dc8965de4695570c9d338881e78975`, arquivo de 29460 bytes/SHA-256 `a188e2b48b315bcb59e3e69c5556452c585c8f5df008d765f6b08502b8e1f868`. O [porte literal](t018-legacy-v2-port-20261010.md) preserva os 18 lançamentos, declara a mudança de realizado D-006 e distingue os saldos independentes da referência dos saldos derivados. A [asserção instalada dos 18 históricos](../../supabase/tests/finance-legacy-v2-installed.sql) é uma validação local distinta, também com rollback; nenhuma das massas foi aplicada como seed.

O plano total previsto no ERD/T-018 revelou uma lacuna real. Core/gateway e a [migration 017](../../supabase/migrations/20261010044217_finance_monthly_plan.sql) permitem categoria nula explícita para esse plano, com isolamento e unicidade por dono/mês. A raiz aprovou a cadeia local completa de **17 migrations/35 asserções**, catálogo local **1.243/zero desvios**, pacote **17/37** e check integral **1.556 testes por fuso/146 Node**, além de TypeScript/lint/build. **Novo CI/deploy e aplicação manual/conferência hosted da 017 permanecem pendentes**. Preservar o export oficial pós-016 e obter outro após aplicar 017; conferir nomes/Args localmente não prova nullable ou freshness hosted. Não reaplicar 001–016 nem bootstrap. A UI do plano total continua na fase 2; #25 conserva os critérios operacionais ainda não demonstrados.
