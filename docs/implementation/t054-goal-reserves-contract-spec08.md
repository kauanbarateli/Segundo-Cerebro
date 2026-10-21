# T-054 / #79 — apuração pura de reservas virtuais

Refs #79. Part of #71. Base `ffc47c40629560ade9b39dfdfa91cf37641b9ae6`; branch independente preserva as fontes anteriores. Contrato técnico congelado pela Root após confronto do doc03, ADR0011, ticket, protótipo e financeiro real. A decisão humana de reserva virtual permanece; esta fatia não porta a dedução de caixa da demonstração.

## Implementado

`apurarReservasParaMetas(input:unknown):ApuracaoDeReservasV1` recebe exatamente `{version:1,user_id,reservations,releases}`. Aporte de cálculo: `{id,user_id,goal_id,account_id,amount_cents}`. Liberação de cálculo: `{id,user_id,reservation_id,amount_cents}`. Os tipos são projeções de cálculo, sem estabelecer tabelas ou contratos persistidos. IDs são ASCII opacos `[A-Za-z0-9_-]{1,128}`, preservados sem trim/coerção. Cada linha declara o mesmo dono do envelope e centavos inteiros seguros positivos.

Cada coleção aceita até 10.000 elementos, teto técnico sem truncamento. Vazios são válidos. Arrays densos de protótipo padrão/nulo exigem índices próprios, sem extras, símbolos ou accessors; registros comuns/nulos têm somente descriptors de dados próprios e campos exatos, inclusive quando não enumeráveis. As leituras usam snapshots, sem get do original. Traps de introspecção de Proxy podem executar; falhas viram `VALIDATION` com mensagem estática, sem inspecionar nem propagar o valor lançado.

IDs duplicados são recusados dentro de cada coleção, inclusive linhas iguais. Namespaces de aporte e liberação são independentes. Liberação exige aporte fornecido; somas liberadas não ultrapassam o valor daquele aporte, sem compensação com outro. Aportes permanecem imutáveis; não se usa reversed_at para representar liberação parcial.

Saída fechada: `{version:1,user_id,reservations:[{reservation_id,goal_id,account_id,remaining_cents}],by_account:[{account_id,reserved_cents}],by_goal:[{goal_id,reserved_cents}]}`. Um resultado por aporte, inclusive restante zero; grupos presentes integralmente liberados também ficam em zero. Contas/metas ausentes não são inventadas. Ordenação ASCII por identificador em cada coleção, sem localeCompare; entradas reordenadas produzem o mesmo resultado em cópias novas e serializáveis.

Acumula liberações e restantes em bigint; `centavosSeguros`/`totalExato` existentes conferem números públicos. Subtotais são líquidos, sem impor soma bruta histórica ou total global redundante. Grupos independentes podem ser seguros mesmo quando sua soma global excederia o intervalo numérico público. Helpers compartilhados, ledger e cálculo de saldo/patrimônio permanecem.

## Limites e executor futuro

Igualdade declarada não autentica o dono, prova propriedade/existência de Conta ou Meta, nem garante que todas as linhas foram fornecidas. Sem catálogo não se determina arquivo, cartão, alvo, imagem ou elegibilidade. A saída nunca autoriza aporte, liberação, fechamento de conta ou disponibilidade. Não recebe saldo, lançamentos, datas ou snapshot comercial; disponível para uso será outra fatia. `available_cents` atual de cartão e `reservaCents` do plano conservam seus significados.

O futuro comando precisa obter o conjunto pertinente completo na mesma transação/lock do dono, autorizar acesso e validar conta ativa não cartão, data não futura e disponibilidade para novo aporte. A liberação exige restante confirmado e acesso de recuperação à conta legada arquivada. Recibo repetido retorna o resultado persistido antes de criar outra linha; outra intenção com a mesma identidade conflita. Duplicatas de linhas nesta função são inválidas, não um mecanismo de replay. Conta com reserva ativa não pode ser arquivada por exclusão silenciosa; arquivar Meta também conserva reservas. Dados, eventos e recibos exigem atomicidade real.

Sem comandos, adapter, store, consumidor, UI, saldo, patrimônio, despesa, fatura, imagem, target, IDs gerados, relógio, CAS, evento, recibo, SQL ou migration. Nenhum timestamp reservado. Dependências completas #72/#77, acesso #53, retenção/export/backup/restore e jornadas J9/J11 seguem para integração própria. ADR0011 e migrations históricas não foram alterados.

## Validação e entrega

Testes preparados: parcial/integral e zeros, várias contas/metas, namespaces compartilhados, ordenação ASCII/reordenação, histórico bruto enorme com líquido seguro, ausência de teto global, estouros líquidos por conta/meta, duplicatas/órfãos/dono/excesso por aporte, centavos/IDs/versão/chaves, fronteiras 10.000/10.001 de cada coleção, arrays/getters/protótipos/descriptors/Proxy, imutabilidade e cópias. Revisão encontrou uma leitura de descriptor de índice sem guarda own; corrigida com verificação explícita e negativos de descriptor herdado, incluindo getter, com restauração síncrona antes das asserções.

Revisão estática independente e diff-check constarão do manifesto com SHA e quatro hashes de blobs Git. Nenhum Node/npm, teste, compilador, lint, build, navegador ou banco local foi executado; teste preparado não é PASS. Root conserva revisão/integração/publicação e CI do SHA próprio no GitHub, reconciliando inventários finitos e guard de branch. Resultado de outra PR não certifica esta fonte. #79/#71/#81 permanecem abertas. Sem push, PR, merge, SQL remoto ou deploy desta frente.
