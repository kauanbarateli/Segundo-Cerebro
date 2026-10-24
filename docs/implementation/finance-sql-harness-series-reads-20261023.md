# Fronteira de leitura de séries no ensaio SQL financeiro

O candidato `ba38991f2208ae9481e306da8f1d803f2005d063` corrigiu o receptor do `fetch` e a lista fechada de CSS. No original PUSH `40022221331`, os quinze cenários de `finance-series-workspace` passaram, mas dois cenários SQL pararam na fronteira antiga: o diálogo de encerramento não abriu e quatro chamadas foram registradas como `UNEXPECTED_REQUEST`. O ensaio não atendia os novos GETs de disponibilidade/classificação. Esses resultados permanecem falhas; a proposta abaixo ainda precisa de revisão e CI próprio.

## Delta restrito ao harness

- O entry Node exporta o classificador, a disponibilidade e o wrapper `withLegacySeriesStopGuard` reais, mantendo a lista exata de exports e os imports estáticos sem SDK adicional.
- A disponibilidade usa explicitamente `legacy_only` e `false`. A cadeia canônica continua 001–025; esta proposta não instala B2 nem consulta seu esquema.
- A classificação vem de `classifyFinanceSeriesGroup`, com a apresentação real de `finance_snapshot` pelo gateway SQL e a identidade/sessão da fixture. O port gerenciado conta a chamada e lança: ele precisa permanecer em zero. Uma falha nunca vira classificação legada.
- A fronteira HTTP atende somente os dois paths exatos, GET, dono esperado e consultas fechadas. `classification` aceita exatamente um `group_id` UUID. Origem diferente, rotas extras e os demais casos inesperados continuam recusados.
- `finance.series.stop` passa pelo wrapper real. A repetição do recibo original precisa conservar o ledger e dispensar uma nova classificação. Os writes, eventos, recibos, isolamento alheio e demais critérios já existentes permanecem.

O novo cenário negativo sem React cria grupos reais próprios/alheios pelo Core e SQL e verifica métodos, ausência/troca do dono esperado, UUID inválido, parâmetro duplicado/extra, grupo inexistente/alheio e sessão SQL alheia. Somente os dois GETs válidos produzem sucesso; o ledger inteiro precisa ficar idêntico ao baseline após todas as leituras e recusas. Disponibilidade, classificação e recusas têm traces separados; `unexpected[]` e `errors[]` continuam vazios nos cenários aceitos.

## Limites e validação pendente

Esta é uma fronteira HTTP/Auth declarada do teste, não uma execução dos handlers Next, GoTrue/PostgREST ou produção. Nenhuma variável, flag de produção, migration, regra do produto ou deadline foi alterada. O autor não executou Node, PGlite ou navegador nesta entrega.

Antes de publicar: revisão independente dos três paths, lint/typecheck, os cenários SQL originais e o novo negativo em CI Linux. Exigir classificação positiva do grupo próprio, recusa do grupo alheio, port gerenciado em zero e preservação de todos os writes/recibos. O encerramento dos originais de `ba38991` e `aae2c01` deve permanecer separado do próximo candidato. Não executar `audit fix --force`, ignorar o novo advisory ou herdar PASS de outro SHA.
