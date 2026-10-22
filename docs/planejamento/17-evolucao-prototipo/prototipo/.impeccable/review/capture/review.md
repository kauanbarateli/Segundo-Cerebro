# Revisão independente — Capturar

## disposition

**fix** — a composição está pronta, mas dois problemas materiais devem ser corrigidos antes do aceite: cancelar um link inválido pode bloquear o salvamento, e o foco do título usa contraste insuficiente. As correções são locais; a direção visual não precisa ser reconstruída.

Revisão de 20/10/2026 sobre os 12 PNG fornecidos e o código de `capture.js`, `capture.css`, `richtext.js`, `richtext.css`, `app.js` e `index.html`. Leitura independente do produto, do contrato da superfície, de `DESIGN.md` e do craft floor. O produto permaneceu sem alterações durante esta revisão.

## material findings

1. **P2 — Cancelar um link inválido deixa uma restrição invisível no formulário.** Em `richtext.js:103`, `data-rt-url` é um `input type="url"`. `closeLink()` (`richtext.js:173–177`) esconde o painel e remove `aria-invalid`, mas conserva o valor e mantém o campo habilitado. Esconder o ancestral não retira o campo da validação nativa. Assim, digitar `exemplo`, cancelar e salvar deixa o formulário inválido, embora o campo que precisa de correção esteja escondido. `capture.js:90` e `app.js:175` chamam `reportValidity()`, impedindo o salvamento e as ações que dependem dele. Corrigir o ciclo do campo: limpar e desabilitar ao fechar, reabilitando ao abrir; iniciar desabilitado enquanto o painel está fechado. Validar cancelar por botão e por Escape depois de uma URL inválida, salvar a captura e salvar uma nota no diálogo compartilhado.

2. **P2 — O contorno de foco do título perde contraste nos dois temas.** `capture.css:39` substitui o foco global por `outline: 2px solid var(--line-strong)`. Com os valores atuais do DS, o contorno tem **1,53:1** no claro (`#d3d1c8` sobre `#ffffff`) e **1,57:1** no escuro (`#3a3935` sobre `#161615`). O título é um campo de edição sem borda no repouso e depende desse contorno para indicar o foco por teclado. Usar `--ink` ou `--ink-subtle`, como os outros controles do editor. Conferir o foco do título por teclado nos dois temas.

Nenhum outro problema material foi encontrado nas evidências visuais. Os achados acima vêm do código e, no caso do foco, de cálculo dos pares de cores; não são apresentados como testes de navegador executados por este revisor.

## fidelity

**A composição solicitada está atendida.** `references/capture-editor.jpg` organiza navegação, lista de notas e documento em três faixas. A implementação preserva essa relação: navegação existente à esquerda, capturas em uma faixa própria e um documento maior à direita. Em 1440 px, o editor tem aproximadamente três vezes a largura da lista, tanto com a navegação expandida quanto recolhida. A separação é discreta e a seleção na lista é perceptível.

A barra de ferramentas amplia o trabalho de escrita com parágrafo/título/subtítulo/citação, negrito, itálico, sublinhado, tachado, listas, alinhamentos, links, limpar formatação, desfazer e refazer. A captura formatada demonstra hierarquia real de texto, lista e citação. A ausência de fotos e tags decorativas da referência respeita o escopo definido.

Geist, marca geométrica e neutros do DS 2.1 permanecem. Claro e escuro têm hierarquia e semântica equivalentes. A ação de salvar é explícita, o estado de edição é visível, e os caminhos para tarefa e Conhecimento continuam presentes no documento.

**Tablets alternam lista/editor até 1000 px.** `capture.css:75` aplica a composição de painel único em `max-width:1000px`; `.is-editing` escolhe o painel e o botão “Capturas” oferece retorno. `capture.js:118` usa o mesmo limite. A evidência de 768 px mostra o editor sozinho, com largura útil e retorno. A de 1024 px, acima desse limite, mostra as duas colunas sem corte. Em 390 e 360 px, lista e editor ocupam a largura disponível. O título longo quebra integralmente e a barra se distribui em linhas com os controles preservados.

## craft-floor

- **Hierarquia e espaço:** a tarefa de escrever domina; busca, filtros e prévias são apoio. A superfície é contínua e os grupos da barra são reconhecíveis. Não há decoração competindo com o conteúdo.
- **Tipografia:** texto de escrita em 16 px/1,75, conteúdo limitado a 70ch e títulos com escala e peso claros. As evidências de 360, 768 e 1024 px não mostram truncamento indevido do título ou vazamento horizontal. As prévias da lista têm corte intencional.
- **Contraste:** corpo e texto secundário usam os papéis vigentes do DS. Por cálculo dos tokens, o texto secundário sobre a superfície alcança cerca de 6,50:1 no claro e 8,43:1 no escuro. O foco do título é a exceção material registrada acima.
- **Interação e estados:** controles de formatação têm alvos de 44 × 44 px, nomes acessíveis e grupos nomeados. O código conserva a seleção e o corpo sanitizado. `results.json` relata sucesso para busca/vazio, rascunhos, descarte, falha de armazenamento, promoção, origem, recarga, teclado e movimento reduzido. O caso de cancelamento de URL inválida precisa ser acrescentado.
- **Superfícies do navegador:** seleção, cursor, rolagem e foco têm tratamento do DS; sublinhados de links e texto usam afastamento explícito. O editor respeita movimento reduzido.
- **Detector:** os 15 avisos de escala de tipo/raio são consultivos e não correspondem, nas imagens, a quebras materiais de hierarquia ou composição. O aviso de Geist não justifica alteração: a família é autoridade explícita do projeto e deve ser preservada.
- **Limite da evidência:** os PNG mostram os estados visuais indicados abaixo. A execução dos fluxos é atestada pelo relatório fornecido, não repetida por este revisor. Esta revisão não equivale a uma certificação completa de acessibilidade.

## evidence

Todas as 12 imagens obrigatórias foram abertas com `view_image` e inspecionadas:

| Evidência | Inspeção |
|---|---|
| `captura-desktop-light.png` — 1440 px | Lista à esquerda, documento dominante, barra completa e ações de promoção visíveis. |
| `captura-desktop-dark.png` — 1440 px | Mesma estrutura e leitura no tema escuro, com seleção e ações preservadas. |
| `captura-recolhida-light.png` — 1440 px | Espaço adicional entregue ao documento; lista permanece controlada. |
| `captura-recolhida-dark.png` — 1440 px | Hierarquia equivalente com navegação recolhida. |
| `captura-mobile-lista-light.png` — 390 px | Lista única, busca, filtros e nova captura alcançáveis. |
| `captura-mobile-lista-dark.png` — 390 px | Mesma composição, contraste e estados no tema escuro. |
| `captura-mobile-editor-light.png` — 390 px | Retorno explícito, título em duas linhas, ferramentas distribuídas e ações largas. |
| `captura-mobile-editor-dark.png` — 390 px | Paridade visual do editor escuro. |
| `captura-formatada.png` — 1440 px | Título interno, ênfase, lista e citação bem hierarquizados. |
| `captura-texto-longo-360.png` | Título e corpo completos, ferramentas sem corte e ações preservadas. |
| `captura-texto-longo-768.png` | Editor único no tablet, retorno para capturas e texto longo legível. |
| `captura-texto-longo-1024.png` | Duas colunas acima do limite de 1000 px, sem vazamento do texto. |

O menu fixo móvel aparece na altura do viewport dentro das imagens fullpage; isso é compatível com a captura real descrita e não foi classificado como sobreposição permanente do documento.

Também foram lidos `results.json` (`passed: true`, oito grupos de verificações e nenhum erro de console) e `detector.json` (15 avisos consultivos e um aviso de fonte). A referência original foi inspecionada visualmente. Não houve geração de composição intermediária, uso de navegador ou alteração de PNG por este revisor.

Após o lote: repetir a regressão de cancelamento de link inválido e registrar os focos claro/escuro; então atualizar o verdict com as evidências resultantes.
