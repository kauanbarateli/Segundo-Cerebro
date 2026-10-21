# T-052 / #77 — seletor de competência (F77-A)

Refs #77. Part of #71. Planejamento fixado em `ffc47c40629560ade9b39dfdfa91cf37641b9ae6`. Início autorizado pelo mantenedor; base e arquivos da vertical liberados pela Root em 21/10/2026. Branch local `codex/spec08-finance-period-20261021`, base exata `b5e7e8547abb0f81db9f99b53bb043cec4a85dc9` da PR #92. O manifesto de entrega identifica a árvore/commit efetivamente entregue e os limites da validação.

## Reconciliação dos deltas anteriores

Esta fatia parte da base atual de hábitos/imagens, preservando somente os deltas financeiros de `58de215931944245ca08d2e01cdbc2c2f87edcc5` (projeção temporal), `90e2bd150f78d9262c578c628f64a43a5d493009` (análise mensal) e `bdf8afa0bdc1e84d7815157fead4622d32064633` (composição CSS da fixture financeira). Não se transplantou a base antiga da PR #86.

Antes de F77-A, a árvore Git `888469c8f8bfff8ae4d312d64e63d86d6d870122` registra os 12 paths preservados. Leitura independente encontrou 11 blobs exatos e somente a composição intencional da fixture SQL: lista completa de b5, incluindo `data-display.css` e `private-image.css`, com `finance-competence-chart.css` imediatamente após `finance.css` e os dois nomes de região da análise mensal. O documento histórico ausente na base permanece ausente.

As fontes históricas são o [delta imutável bdf8afa](https://github.com/kauanbarateli/Segundo-Cerebro/commit/bdf8afa0bdc1e84d7815157fead4622d32064633), [run push 39560081575](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39560081575) e [run PR 39560087046](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39560087046). Registram a falha/reconciliação anterior, sem transferir PASS para esta árvore ou para o novo delta. Os documentos das duas fatias preservadas descrevem seus próprios ambientes históricos; seus valores de RAM não são medidas desta rodada.

## Contrato e referência da vertical

Substituir o input de competência por seletor de mês/ano conforme `prototipo/finance.js`, `prototipo/finance.css` e `capturas/financeiro-periodo.png` do pacote 17. As três colunas de meses, ano temporário, ação Mês atual, gatilho entre setas e composição sem sombra preservam a referência. Alvos do produto têm pelo menos 44 × 44 px, inclusive onde o protótipo usa dimensões menores. A captura aberta disponível é desktop/claro; não representa uma prova móvel/escura deste produto.

- A seleção confirmada vem da URL existente; internamente conserva `YYYY-MM-01`. Percorrer o ano aberto é temporário, sem navegação ou alteração de filtro.
- Confirmar mês, usar as setas ou Mês atual preserva aba, busca, tipo, conta, categoria, status, ordenação e direção; reinicia somente a página em 1. Mês atual usa a data civil de `app.today()`, sem trocar a autoridade pelo relógio do navegador.
- Escape/cancelamento não muda a URL. Abertura foca o mês selecionado; confirmação/fechamento devolve foco ao gatilho. Navegação externa, reload, voltar e avançar precisam refletir o mês correto sem callback antigo desfazer a escolha mais recente.
- Limites são anos 0001–9999. Não produzir ano zero/10000 nem converter anos 1–99 para 1901–1999. Setas indisponíveis ficam desabilitadas nos extremos.
- Cinco abas, filtros, máscara de valores, análise mensal, estados de erro/retry e oráculos econômicos existentes permanecem autoridades. Inputs de mês de fatura e orçamento têm contratos próprios e não fazem parte da substituição.

Não há comando financeiro, DTO de domínio, evento, recibo, migration, adapter ou escrita de ledger novos. A autorização existente do Financeiro continua necessária; o seletor não concede acesso. A composição CSS da fixture SQL continua explícita, com igualdade do conjunto de imports e inclusão nominal do novo CSS. Workflows, inventários globais, tokens, pacote/lock e artefatos oficiais permanecem com a Root.

## Implementado nesta vertical

`finance-period.ts` contém aritmética civil limitada e a mudança de estado que preserva filtros. `finance-period-picker.tsx/.css` implementa o grupo de setas/gatilho, ano temporário, grade de meses, Mês atual e Cancelar, com alinhamento à direita e contenção pela viewport. O popup nativo tem fallback local; mede suas dimensões após a renderização, acompanha resize/scroll/visualViewport e limpa listeners/observer. A seleção transitória é invalidada quando muda a chave de navegação, incluindo navegadores sem `showPopover`, para impedir reabertura ao voltar à URL anterior.

O encaixe em `finance-workspace.tsx` usa a guarda de navegação existente antes de aplicar mês/página. Os dois E2Es financeiros usam `tests/e2e/helpers/finance-period.ts` para escolher ano e mês pelos controles reais, sem input oculto ou mudança dos oráculos financeiros. Os testes route/race cobrem aritmética/limites, cinco abas/filtros e callbacks pendentes. O novo CSS está nominalmente na composição estrita da fixture SQL, preservando sua igualdade de conjuntos.

## Estado da entrega e validação

Implementado e conferido por leitura focal; sem PASS dinâmico desta vertical. A leitura técnica cobriu datas/URL/estado/cleanup, e a leitura visual comparou os trechos com a referência aprovada. Foram corrigidos os achados de alinhamento, largura de Mês atual e seleção antiga no fallback; a confirmação fica registrada no manifesto final. Essa leitura não substitui execução, inspeção renderizada ou medição de contraste.

A Root informou os 18 runs da base b5 concluídos com success, incluindo [CI push 39640311159](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39640311159) e [CI PR 39640320310](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39640320310), e liberou a consolidação local depois da revisão. Essa prova pertence à base, sem o delta F77-A. A evidência do novo commit permanece pendente.

Testes exclusivamente no GitHub, conforme orientação humana. Não foram executados Node, npm, lint, TypeScript, Vitest, build, Playwright, navegador, banco ou detector Impeccable localmente. A leitura Impeccable usa o fallback já aprovado da superfície financeira, sem novo launcher/runtime. Git diff/check, comparação de blobs e hashes nativos compõem a verificação estática; o manifesto vincula o resultado à entrega exata. Não há processo pesado próprio.

Lote previsto no runner Node 24, um processo/worker por vez, depois da reconciliação dos gates pela Root:

1. Testes focais do seletor/helper e de `tests/features/finance-route.test.ts`, `tests/features/finance-navigation-race.test.ts`; projeção preservada em `tests/core/finance-monthly-timeline.test.ts` e `tests/features/finance-competence-chart.test.tsx`.
2. ESLint do delta; TypeScript, camadas e DS; check de secrets e `git diff --check`. Usar os inventários fechados atuais, sem relaxá-los para acomodar módulos novos.
3. Build sintético e check de client-auth sobre o artefato correspondente. O build não aplica SQL.
4. Playwright `tests/e2e/finance.spec.ts` e `tests/e2e/issue26-27-finance-sql.spec.ts`, `--workers=1`, sem sessões pessoais ou banco remoto. Preservar valores, faturas, parcelas, recorrências, histórico e verificações SQL existentes.
5. Inspeção renderizada 320/390/768/1280, claro/escuro/sistema, zoom 200%, teclado/foco, popup sem clipping, contraste e movimento reduzido. Capturas apenas com dados sintéticos; referência do protótipo não equivale a captura do resultado.

Negativos: percorrer ano e cancelar sem mudar URL; limites 0001/9999 e anos 0099/0100; filtro/página/ordenação completos; seleção depois de restore/clamp pendente; voltar/avançar/reload; máscara preservada; falha/retry sem perda de período; foco inicial e retorno, Escape e fechamento externo; composição CSS completa da fixture.

## Limites e sequência

Esta vertical parcial não encerra #77, #71 ou #81. Cartões, conta padrão, lançamento rápido, limites/recorrências e metas continuam em suas fatias e contratos próprios. Não há operação remota, merge ou deploy desta frente. A Root publica um bloco consolidado, verifica CI no SHA executado e cuida dos gates #44/#68. Vercel Pro substituiu o impedimento histórico Hobby, sem transformar validação local/CI sintético em aceite conectado.
