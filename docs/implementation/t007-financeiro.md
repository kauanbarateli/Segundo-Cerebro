# T-007 — núcleo financeiro e modelo fundido

## Origem e separação

`src/core/financeiro/finance.ts` e `credit.ts` portam as funções puras de `kauanbarateli/segundo_cerebro@ffdf06435a5b8dcd047574172cddf1cc772dfd09`, `src/lib/finance.ts` e `src/lib/credit.ts`. As regras econômicas foram preservadas; os imports passam a usar tipos próprios. A revisão acrescentou validação monetária e aritmética exata nas fronteiras descritas abaixo. Os comentários sobre servidores, telas e gatilhos antigos foram removidos para não atribuir infraestrutura histórica ao aplicativo novo.

`types.ts` contém projeções de cálculo independentes de schema/SDK. Os nomes históricos tornam a massa original comparável. Essas projeções toleram o `kind=transfer` antigo e recebem `is_paid`; não são contrato de escrita do produto novo.

`fused.ts`, exposto por `index.ts`, define o contrato público de D-006/doc 06 §2. `LancamentoFinanceiro` tem `kind=income|expense`, os cinco status de ciclo de vida, `source`, `due_date`, `deleted_at`, pagamento e série. O chamador não escreve `is_paid`: `normalizarPagamento` o deriva. Transferências têm duas pernas vinculadas por `transfer_group_id`.

## Regras portadas

- Competência de cartão pelo `statement_month` histórico; competência de conta comum pela data civil. `mesDeCompetencia` é a implementação única que as agregações mensais usam. Cartão sem fatura atribuída aparece em `foraDeCompetenciaFinanceira`.
- Compra no dia do fechamento pertence ao próximo ciclo; datas inexistentes são limitadas ao último dia válido. Fatura derivada mantém total lançado, total pago e saldo separados, inclusive crédito por pagamento a maior. `statusDaFatura` deriva aberta/fechada/parcial/paga/vencida a partir do dia informado.
- Parcelamento divide o total em centavos e atribui o resto à última parcela. Recorrência repete o mesmo valor, sem transformar todos os compromissos futuros em dívida. Uma parcela por ciclo preserva o mês gravado mesmo quando o dia é limitado em fevereiro.
- Dívida de cartão fica separada de patrimônio em contas comuns; juros, IOF, vencimentos e horizontes de dívida mantêm seus testes originais.

## Ponte do modelo fundido

| API | Regra |
| --- | --- |
| `participaDoReal` | Só confirmed/reconciled com `deleted_at=null`. Todas as agregações reais passam pelo mesmo predicado. |
| `normalizarPagamento` | Valida centavos inteiros seguros e pagamento entre zero e valor. Compra/saída em cartão recebe `paid_cents=amount_cents`; o status continua intacto. Essa exceção tem um único ponto. |
| `totaisFinanceiros` | Reutiliza competência e exclui transferências das receitas/despesas. Os totais expressam competência; saldo de caixa usa a parcela efetivamente paga. |
| `faturaFinanceira` | Aplica elegibilidade de ciclo de vida também às compras, estornos e pagamentos da fatura; depois deriva a fatura pela matemática portada. |
| `progressoOrcamentosFinanceiros` | Seleciona orçamento do mês; estorno income em categoria expense reduz consumo. Transferências ficam fora. Faixas: abaixo de 80% normal, de 80% a menos de 100% atenção, a partir de 100% limite. `over` continua distinguindo igualdade de excesso. |
| `saldosFinanceiros` | Conta comum soma `paid_cents` com o sinal da perna. Cartão soma valor lançado para representar dívida. As duas pernas de uma transferência permanecem em suas próprias contas. |
| `patrimonioFinanceiro` | Agrega contas ativas, separando cartões. Uma transferência entre contas comuns cancela no patrimônio; pagar cartão reduz caixa e dívida, sem nova despesa. Arquivar uma conta não apaga a perna preservada na outra. |

O limite de orçamento deve ser positivo, seguindo `financeBudgetSchema` da fonte (`src/lib/validation.ts:579`). Referências a contas e categorias precisam pertencer ao mesmo usuário; o adapter ainda deve entregar o recorte autorizado do usuário. Estes cálculos não substituem autenticação nem isolamento no adapter. Passe todas as contas referenciadas, incluindo arquivadas; a seleção de contas ativas no patrimônio acontece após preservar seus movimentos.

## Fronteiras monetárias após revisão

As assinaturas e os tipos públicos de `index.ts` e `fused.ts` permanecem estáveis: dinheiro entra e sai como `number` inteiro seguro em centavos. `arithmetic.ts` centraliza as verificações internas; nenhum `bigint` atravessa o contrato público. Entradas monetárias fracionárias, não finitas ou fora de `Number.MAX_SAFE_INTEGER`, assim como resultados finais fora desse intervalo, lançam `RangeError` nas APIs públicas de cálculo monetário. Resumos recebidos por `statusDaFatura` e `totalAPagarEm` também precisam conter centavos seguros.

- `calcularEncargos` interpreta a representação decimal da taxa recebida, inclusive notação científica, como uma fração exata. Multiplica e arredonda uma única vez ao centavo, com meio centavo para cima. Por exemplo, 375 centavos a 9,2% resultam em 35 centavos de juros; a multiplicação binária anterior retornava 34. A taxa permanece finita e não negativa, o IOF permanece inteiro não negativo e um saldo remanescente negativo continua gerando juros zero. Juros e juros mais IOF têm validação de estouro separada.
- `planoDeParcelas` exige total positivo e quantidade de parcelas menor ou igual ao total em centavos. Recupera a fronteira histórica de `financeInstallmentSchema` (`src/lib/validation.ts:432–449`) para impedir lançamentos de valor zero ou negativo. O distribuidor genérico `parcelas` continua aceitando negativos e zero: pode ratear estornos e valores menores que a quantidade; a restrição pertence ao plano que cria lançamentos.
- Saldos de contas e consumo de orçamentos acumulam sinais em `BigInt`, incluindo o saldo inicial, e só validam o resultado ao final. Assim, `MAX_SAFE_INTEGER + 2 - 2` não perde centavos nem falha conforme a ordem dos lançamentos. Faturas, valores sem competência, patrimônio e limite disponível usam a mesma estratégia de soma exata. Um resultado final inseguro continua sendo rejeitado.
- `totalAPagarEm` acumula exatamente somente saldos positivos; crédito a favor de um cartão continua sem abater a dívida de outro. Nenhuma regra de competência, ciclo de vida, transferência ou estorno mudou.

## Validação executada

- **147/147 testes originais portados:** 36 de `finance.test.ts` e 111 de `credit.test.ts`, com imports adaptados; o teste de dinheiro consome `core/dinheiro`.
- **22/22 casos da massa fundida** em `finance-fused.test.ts`: cinco status, exclusão/restauração, pagamento parcial, exceção do cartão, competência histórica, precisão/validação de centavos, estornos e limites 79,9%/80%/99,9%/100%/100,1%, transferência bilateral e conta arquivada. Fatura, órfãos e patrimônio usam BigInt internamente nas somas com sinais para não perder centavos quando um subtotal alto volta ao intervalo seguro após estorno.
- **23 regressões adicionais**, sem alterar os 147 casos originais: 16 em `credit.test.ts` cobrem empates decimais, notação científica, entradas inválidas, estouro de saída, planos positivos e distribuidor genérico; 7 em `finance-fused.test.ts` cobrem as seis ordens dos mesmos movimentos e a compensação pelo saldo inicial. Antes da correção, 16 desses 23 casos falharam reproduzindo os achados; depois, todos passaram.
- **192/192 no ambiente padrão e em `TZ=UTC`**. Typecheck completo com `--incremental false`, lint dos arquivos financeiros e portão de dependências do módulo passaram. Não foi executado build, servidor, banco ou migration por esta frente.

## Limites explícitos

A regra histórica de `faturaDoCartao` ainda consegue classificar uma linha sem `statement_month` pelo fechamento atual; a agregação de competência, por sua vez, sinaliza essa linha como sem competência. Esse fallback está preservado e testado para comparar com a origem. Novas escritas de cartão devem atribuir o mês no momento da criação; mudar fechamento não reescreve atribuições históricas.

As funções portadas não fazem I/O, não usam relógio implícito e não importam React, Next.js, SDK ou tipos gerados. Contratos de adapter, transação escrita+evento e idempotência pertencem à integração de T-007; aplicação persistente e migrations permanecem posteriores e exclusivamente manuais. O plano mensal de interface não é implementado aqui: esta entrega oferece cálculos puros de competência, períodos e orçamento para sua composição.
