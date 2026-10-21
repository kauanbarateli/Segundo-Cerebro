## disposition

Revisão independente: aprovada. As correções locais P2 identificadas no primeiro lote estão presentes no código e foram confirmadas na recaptura final. A implementação atende à composição pedida e preserva o DS 2.1; não exige redesenho. Esta revisão usou código e capturas fornecidas, sem operar o navegador. O agente principal executou os testes funcionais e a recaptura final.

## material findings

Situação após releitura do código e recaptura: **nenhum achado material pendente**. O filtro agora tem `aria-label="Filtrar hábitos"`; entradas inválidas de período restauram `ui.anchor`, mantêm foco e explicam a recuperação. A escala do gráfico usa a posição `n/max`; a regra de datas evita proximidade do último dia. O campo de período ocupa a linha inteira abaixo de 350 px. As capturas finais de 320, 390 e 1440 px confirmam legibilidade do mês, eixo proporcional e rótulos sem colisão. Os achados originais abaixo estão resolvidos e ficam como histórico da revisão.

- **P2 — Período truncado em 320 px.** Em `habits-320-dark.png`, o campo mostra “outubro de 202…”: os controles de navegação consomem a largura necessária para o ano. Local: `habits.css:111`, regras de `.hb-period-tools`, `.hb-period-input` e `.hb-arrows`. Dar ao campo a largura inteira em telas estreitas e colocar as setas na linha do seletor Semana/Mês. Correção já comunicada ao agente principal.
- **P2 — Rótulo do filtro removido da árvore acessível no celular.** `habits.css:110` esconde o único texto do rótulo com `display:none`; o `select` em `habits.js:77` não possui outro nome explícito. Manter “Mostrar” visualmente oculto, mas acessível, ou fornecer `aria-label="Filtrar hábitos"` ao controle.
- **P2 — Período inválido permanece visível enquanto os dados são do período anterior.** `habits.js:130–132` rejeita entrada vazia, futura ou fora do intervalo somente com notificação. O campo conserva o valor rejeitado, mas `ui.anchor` e o gráfico permanecem anteriores. Restaurar o valor válido a partir de `ui.anchor` no caminho de erro, conservando feedback e foco.
- **P2 — Eixo e rótulos do gráfico no primeiro lote.** `habits.js`, função `graph`, e `.hb-chart-axis` em `habits.css`: os valores 3, 1 e 0 aparecem equidistantes, apesar dos intervalos numéricos diferentes; os dias 30 e 31 colidem no celular. O agente principal já identificou e está corrigindo os dois pontos; a recaptura final precisa confirmar escala proporcional e ausência de colisão.

## fidelity

A referência está reconhecível: desempenho acima da rotina, gráfico diário e consistência lado a lado no desktop, Semana/Mês, navegação de períodos, fotografias por hábito, sete dias e progresso semanal. No celular, cada hábito mantém os sete registros na própria linha expandida, sem rolagem horizontal. O filtro adicional permanece discreto e encontra-se imediatamente.

Marca, Geist, neutros quentes e contraste monocromático permanecem. O verde usa `--success-ink` existente, sem criar uma paleta paralela. As métricas seguem os registros locais; a diferença de 27% para os 78% ilustrativos da referência é coerente com a direção, sem histórico inventado. O onboarding expõe frequência e dias pertinentes, com rótulos claros.

## craft-floor

Os pares de texto secundário verificados pelos tokens superam 4,5:1: claro sobre superfície 6,50:1, claro sobre canvas 5,95:1, escuro sobre superfície 8,43:1 e escuro sobre canvas 9,05:1. Placeholders também mantêm contraste: 6,21:1 no claro e 6,74:1 no escuro.

Os controles usam elementos nativos, foco visível, nomes de ação, `aria-pressed` e desabilitação de datas futuras. O gráfico oferece tabela textual. Inputs dos dias têm nomes completos, e os grupos usam `fieldset`/`legend`. A seleção de texto, o caret, as barras de rolagem e os numerais tabulares já recebem tratamento do sistema. A revisão de código confirma restauração de estado após falha de gravação em hábitos, preservação do histórico, filtragem compartilhada entre desempenho e rotina e integração com Início. Os pontos de rótulo e período foram resolvidos no código. A escala tipográfica atual também usa títulos de 20 px, subtítulos de 16 px e metadados de 12 px.

## evidence

- Direção: `.impeccable/review/habits/direction.md`; referência: `references/habits-monthly.png`.
- Capturas examinadas: `habits-1440-light.png`, `habits-1440-dark.png`, `habits-768-light.png`, `habits-390-light.png`, `habits-320-dark.png`, `habit-editor-mobile.png`, `onboarding-mobile.png` e `onboarding-desktop.png`.
- Código examinado: `habits.js`, `habits.css`, `habits-model.js`, `onboarding.js`, `onboarding.css`, `index.html`, integração em `app.js`, `core.js`, `styles.css` e `design-system/colors.css`; contexto `PRODUCT.md` e `DESIGN.md`.
- `visual-checks.json` informa larguras do documento iguais às dos viewports em 320, 390, 768, 1024 e 1440 px nos dois temas, imagens carregadas e lista de erros vazia. Esses resultados são evidência recebida do agente principal, não uma execução independente desta revisão.
- `functional-results.json` contém `pass: true`; o agente principal informa 13 grupos funcionais, 9 testes do modelo e 5 do onboarding aprovados. `detector.json` é o único passe automático desta execução, informado com zero achados primários; não foi repetido por esta revisão.
- Recapturas finais reexaminadas: `habits-320-dark.png`, `habits-390-light.png`, `habits-1440-light.png` e `habits-1440-dark.png`. Veredito final em `verdict.md`.
