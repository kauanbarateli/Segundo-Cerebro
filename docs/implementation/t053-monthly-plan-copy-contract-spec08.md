# T-053 / #78 — planejador puro da cópia do plano mensal

Refs #78. Part of #71. Contrato mínimo congelado pela Root após leitura do doc03, protótipo `finance.js` e comando real `salvarOrcamentoFinanceiro`. Base `ffc47c40629560ade9b39dfdfa91cf37641b9ae6`; branch própria reutiliza clone limpa, preservando fontes de Captura, vigências, imagens, calendário e análise financeira. O pedido atual autoriza a construção desta fatia, com testes somente no GitHub e um trabalho de código por vez.

## Implementado

`planejarCopiaDoPlanoMensal(input:unknown):PlanoDeCopiaMensalV1` recebe envelope fechado com `batch_id` ASCII opaco `[A-Za-z0-9_-]{1,128}`, `month` canônico `AAAA-MM-01`, `category_id:null` explícito e `limit_cents` inteiro seguro positivo. Não normaliza uma identidade inválida nem aceita mês abreviado, dias diferentes de 01, owner, budgets, categorias, opções ou campos extras. Ausência não vira zero; plano total não é soma das categorias.

A saída serializável declara `version:1`, os mesmos quatro campos e 12 intenções em ordem: mês escolhido mais onze, conforme o texto do protótipo. Cada item contém exclusivamente `{ordinal,month,category_id:null,limit_cents,intent_key}`; ordinal 1–12. A chave é exatamente `JSON.stringify([batch_id,ordinal,month,null,limit_cents])`. Trata-se de identidade determinística da intenção, sem UUID, client_id, recibo, geração de IDs ou prova de idempotência.

Repetir a entrada produz o mesmo manifesto em objetos/listas novos. Reutilizar um lote com intenção diferente produz outro manifesto; uma função sem histórico não pode detectar esse conflito. O executor futuro terá de comparar com a intenção original durável. Não há geração aleatória, relógio ou fuso do host.

Reutiliza `somaMeses` e `centavosSeguros` existentes, sem alterar aritmética compartilhada. O helper de meses usa aritmética civil, inclusive anos 0001/0099; todos os 12 resultados são conferidos antes de construir/devolver o plano. O intervalo permitido é 0001..9999; um horizonte que chega a 10000 é recusado integralmente, sem retorno parcial. Centavos seguros são por intenção, não uma soma fictícia dos 12 meses.

O envelope aceita somente propriedades próprias de dados em objeto comum ou de protótipo nulo. Símbolos, getters, protótipo customizado e dados fora do contrato são recusados; leitura não usa get do original. Reflexão de Proxy pode executar traps de introspecção; qualquer falha gera `VALIDATION` e mensagem estática, sem inspecionar ou repropagar a exceção. Só entram primitivas, sem referências mutáveis compartilhadas na saída.

## Fronteira preservada e precondição futura

Este planejador não lê budgets, proprietário, Entitlements, estado de destinos ou recibos. Não autoriza sobrescrever nada e não concede acesso. Antes de qualquer escrita, um consumidor/executor precisa conferir o proprietário e o estado confirmado dos 12 destinos, recusando divergência, reuso do lote com intenção diferente e resultado incerto até reconciliação. A política de precondição/CAS e a escolha entre transação única e execução parcial durável continuam para revisão separada.

Doze chamadas independentes a `finance.budget.save` não constituem lote atômico. Não há executor, comando, consumidor, UI, adapter, evento, recibo, CAS, SQL, migration ou aplicação. Também não implementa recorrência semanal/mensal/anual, lifecycle ou automação; ADR0006 e lançamentos existentes permanecem. A dependência completa #77 continua necessária para integração de UI de #78.

Quatro paths reservados: `core/financeiro/monthly-plan-copy.ts`, export em `financeiro/index.ts`, teste focal e este documento. Não modifica `credit.ts`, `arithmetic.ts`, use-cases, Settings, workflows, package/lock, schema ou migrations históricas. Nenhum timestamp de migration reservado.

## Validação e entrega

Testes preparados para os 12 meses/chaves, virada de ano, anos 0001/0099 e limite 9999/estouro, mês não canônico, centavos extremos/inválidos, categoria null explícita, campos ausentes/extra, ASCII/limites do lote, determinismo e ausência de falsa detecção de conflito, entradas congeladas, propriedades próprias/herdadas, símbolo e Proxy. Revisão estática independente e diff-check serão registrados no manifesto com SHA e quatro hashes de blobs Git.

Nenhum Node/npm, Vitest, lint, TypeScript, build, banco ou browser local executado. Teste preparado não é PASS. Root conserva revisão, integração e publicação com guarda própria de branch, reconciliação de inventários finitos e CI no SHA exato, sem transferir resultados das PRs anteriores. Lote remoto proposto: teste focal em UTC/São Paulo, TypeScript/lint/camadas e contratos dos coletores afetados, um worker por processo. Nenhum comando placeholder foi executado.

Prova de gravação/concorrência/recibo/retry exige o executor futuro; não pode ser alegada por esta projeção. #78/#77/#71/#81 permanecem abertas. Sem push, PR, merge, SQL remoto, serviço hospedado ou deploy desta frente.
