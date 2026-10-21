# T-052 / #77 — primeira fatia: análise temporal por competência

Refs #77. Part of #71. Base `ffc47c40629560ade9b39dfdfa91cf37641b9ae6`; branch `codex/spec08-finance-timeline-20261021`. Início autorizado pelo mantenedor e reserva de quatro paths coordenada com a Root após devolver o slot de correção CI. Corpo/comentários de #77 reconferidos no GitHub pessoal em 21/10/2026: aberta, sem comentários e contrato do pacote fixado preservado.

## Implementado

`linhaTemporalDaCompetencia` é uma projeção pura sobre as contas e lançamentos existentes. Reutiliza ciclo de vida, normalização de pagamento, regra de competência histórica e totais do Núcleo, sem importar o index do próprio módulo. Saída contém ponto inicial “Anteriores desta competência”, todos os dias civis do mês, valores acumulados em centavos seguros e linhas com data original/competência. Registros reais sem competência são explicitamente devolvidos para correção; não se atribuem ao mês da compra. Datas fora do mês civil entram no ponto inicial mesmo quando posteriores, conforme doc03.

Pagamentos de fatura/transferências não viram segunda despesa ou receita, contas arquivadas conservam histórico e os estados existentes permanecem autoridades. O último ponto é conferido contra `totaisFinanceiros` no mesmo recorte. A entrada recusa mistura de usuários, identidades duplicadas, conta ausente, calendários inválidos, estado desconhecido e centavos inválidos; não retorna gráfico parcial para esses casos. BigInt é interno à acumulação, a saída é JSON serializável. A projeção não altera os snapshots recebidos.

## Validação

Testes preparados em `tests/core/finance-monthly-timeline.test.ts`: compra29/set e data posterior atribuídas a out, pagamento parcial/total/excedente, estados/lixeira, conta arquivada, órfãos, meses de28/29/30/31 dias, calendário inválido, dados de outro usuário, IDs duplicados, ordem de entrada e overflow. Comando focal previsto:

```sh
npx vitest run tests/core/finance-monthly-timeline.test.ts tests/core/finance-fused.test.ts --maxWorkers=1
```

Nenhum teste dinâmico foi executado localmente: última RAM0,537 GiB, abaixo do limite de1 GiB. `git diff --check` é a verificação estática desta autoria; CI precisará confirmar TypeScript/lint, regras de camada e os testes no SHA publicado. Os testes #52/#53 já passaram a rodar no Actions antes de exigir fechamento #80/#81; nenhum resultado de outro commit valida esta fatia.

Revisão estática independente conferiu competência, isolamento/IDs, estados, centavos, órfãos, calendário e imutabilidade sem encontrar bloqueador concreto. A recusa de linhas inválidas também fora do realizado é intencional: o chamador não deve obter um gráfico parcial aparentemente correto a partir de snapshot corrompido. Essa revisão não conta como teste executado.

## Pendente e limite

Esta entrega não fecha #77. Painel/coluna lateral, tabela/gráfico acessível com máscara completa, layout do protótipo, URLs/filtros, lançamento rápido, cartões/default account/last_four e provas J7/J11 permanecem em fatias seguintes. Nenhum consumidor é ativado neste commit; não há UI, adapter, mutation de ledger, evento, receipt, migration ou conexão externa novos. Consultas não criam escrita e a autoridade de acesso continua no canal existente; a função pura não é um substituto de Entitlements.

Prova de integração futura: a UI deverá consumir o mesmo recorte para linha e tabela, rotular competência com clareza, conservar data original e órfãos acessíveis para correção, mascarar números/geometria/percentuais e tratar vazio/erro/teclado. As regras visuais, navegador e contraste não foram testadas neste lote de domínio. Migrations, integrações, publicação/CI, merge e deploy continuam coordenados pela Root. Não houve processo pesado local.
