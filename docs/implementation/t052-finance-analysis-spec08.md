# T-052 / #77 — análise mensal na interface

Refs #77. Part of #71. Fatia filha de `58de215931944245ca08d2e01cdbc2c2f87edcc5` (projeção pura de competência); o planejamento fixado continua `ffc47c40629560ade9b39dfdfa91cf37641b9ae6`. Início autorizado pelo mantenedor e reserva da interface confirmada pela Root em 21/10/2026. A mudança é local; commit e hashes exatos constam do manifesto de entrega.

## Implementado nesta fatia

- A faixa mensal foi substituída pelo painel **Entradas e despesas do mês**, conforme o contrato do doc03 e as capturas financeiro 1440/claro e 390/escuro. Essas capturas são referências do protótipo, não evidência de renderização deste produto.
- `FinanceWorkspace` passa o mesmo `matching` completo usado na tabela, antes da paginação; filtros, busca, competência e estado da URL permanecem autoridades existentes. `FinanceDashboard` consome a projeção pura `linhaTemporalDaCompetencia`, sem refazer regra financeira.
- Totais mensais em um único `dl`; duas séries acumuladas com estilos distintos; ponto inicial antes do dia 1; todos os dias civis; nenhuma data de corte demonstrativa. A altura do gráfico é estável em 240 px e a largura é medida no próprio painel, sem novas dependências.
- “Ver dados e cálculo” oferece tabela de acumulados e tabela dos lançamentos realizados, com data original e competência. Datas antes ou depois do mês atribuídas à competência ficam em “Anteriores desta competência”. O texto distingue competência de saldo/caixa, estado realizado de planejamento e pagamento parcial de valor integral.
- Ocultar valores desmonta gráfico, legenda, detalhes e tabelas; os três totais usam a mesma máscara neutra, inclusive quando o recorte é vazio ou o sinal do resultado muda. Exibir é uma ação explícita que reutiliza a preferência de privacidade existente e transfere o foco para o título estável do painel ao remover o botão.
- Erro de cálculo exibe alerta e chama o retry real da consulta. Recorte sem movimentos, resultado zero e erro têm apresentações distintas. O erro de atualização com dados anteriores e o mecanismo global de correção de órfãos continuam no workspace. A projeção sobre `matching` não afirma ausência de órfãos no inventário completo.
- O histórico de seis meses, contas, patrimônio, orçamento, lançamentos recentes e cinco abas/URLs existentes foram preservados.
- `tests/e2e/issue26-27-finance-sql.spec.ts` muda exclusivamente os dois nomes do region. `exact:true`, `locator("dl")`, valores 7021 e 20300/34621/−14321, consultas SQL, filtros, paginação, Home, ledger e demais oráculos permanecem iguais. Reserva nominal adicional autorizada pela Root.

## Contratos, reservas e persistência

Não há DTO financeiro novo, migration, escrita de ledger, comando, evento, adapter, rota, entitlement ou operação remota nesta fatia. O DTO da projeção é o de `58de215`. O novo componente é uma superfície de leitura do financeiro existente, dentro de sua autorização. Imagens/comandos novos de outras fatias continuam exigindo a ampliação de negativas de #53; este painel não concede acesso.

Arquivos: `finance-competence-chart.tsx/.css`, consumidores `finance-panels.tsx` e `finance-workspace.tsx`, teste estático da superfície, `finance.spec.ts`, os dois seletores nominais do spec SQL e este documento. A Root mantém workflows, inventários finitos/fingerprints, pacotes, tokens globais e integração. A inclusão de módulos alcançáveis deve ser reconciliada nesses portões pela Root, sem relaxar o conjunto fechado ou as negativas.

## Validação e limites

Implementado e revisado por leitura de fonte. `git diff --check` executado no delta; resultado e commit final ficam no manifesto. A leitura independente A orientou ponto inicial, máscara, tabelas/foco, altura e estados. A avaliação B isolada apontou um P2 de perda de foco ao desmontar o botão local de revelar; foi corrigido com transferência ao título estável e asserção E2E. O avaliador confirmou o ajuste por fonte, sem achado concreto aberto. O resultado está no pacote de entrega. Nenhuma dessas leituras equivale a renderização, contraste medido, transporte conectado ou PASS de CI.

Testes preparados:

- `tests/features/finance-competence-chart.test.tsx`: totais manuais da fixture financeira, competência externa anterior e posterior, privacidade com sinal/valores diferentes, máscara de vazio, owner divergente, duplicidade, data inválida, zero versus ausência, órfão e pares de transferência/pagamento.
- `tests/e2e/finance.spec.ts`: teclado/expansão, 30 dias mais ponto inicial em setembro, último ponto igual ao total, largura 320/390/768/1280, foco em região rolável, ausência de overflow global, máscara integral, exibição explícita, preservação do histórico e continuação da URL. Os testes existentes mantêm coerência com busca e filtros.
- Asserções econômicas SQL existentes foram preservadas, ainda sem nova execução.

Não foram executados Vitest, lint, TypeScript, build, detector Impeccable, PGlite, Playwright ou navegador local nesta fatia. RAM livre medida após o delta: **0,595 GiB** de 7,73 GiB; permanece abaixo do limite humano de 1 GiB. Consulta CIM indisponível; a medida válida veio de `os.freemem()`. Não há processo pesado próprio em execução. Nenhum PASS foi transferido dos testes de #52/#53 ou de outro SHA.

## Lote solicitado à Root

Após revisão do diff exato e reconciliação dos inventários, publicar pelo canal coordenado de CI e executar sequencialmente no SHA integrado, sem SQL remoto:

1. Node 24; Vitest de `tests/core/finance-monthly-timeline.test.ts` e `tests/features/finance-competence-chart.test.tsx`, um worker.
2. ESLint dos arquivos TS/TSX alterados; TypeScript, camadas e DS afetados; detector Impeccable sem supressões de achados.
3. Build isolado sem credenciais de produção; client-auth sobre o artefato correto.
4. Playwright `tests/e2e/finance.spec.ts` e `tests/e2e/issue26-27-finance-sql.spec.ts`, um worker e dados sintéticos locais ao runner. Não usar contas pessoais ou banco remoto.
5. Inspeção batelada 320/390/768/1280, claro/escuro/sistema, zoom 200%, teclado/foco, movimento reduzido; medir contraste real dos textos/eixos/séries e capturar apenas dados sintéticos. Confirmar datas fora do mês, erro/retry da consulta, retorno e persistência em ambiente autorizado.

Registrar implementado, validado, pendente e bloqueado por SHA. A publicação pelo GitHub não comprova comportamento da Vercel; deploy e migrações continuam separados. Vercel Pro removeu o impedimento histórico de Hobby, preservando destino correto, checks e gates #44/#68.

## Pendente do ticket completo

Esta fatia não encerra #77 nem #81. Visão financeira mais ampla, cartões/conta padrão/entrada rápida e demais deltas do planejamento precisam de suas revisões e dependências. #78/#79, reservas virtuais, hábitos, integração comercial e onboarding não foram antecipados. #52/#53 têm evidência própria no GitHub Actions; falhas de infraestrutura e aceites conectados permanecem discriminados pela Root.
