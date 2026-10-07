# Primitivas de dados — T-006

Extensão do DS 2.1: Geist, superfícies sólidas, tokens e alvos de 44px existentes. A anatomia, o ponto de troca tabela/cartões em 768px e o posicionamento da ajuda são **RECOMENDADOS** sobre os contratos dos docs 04/14. Não foram criadas cores, famílias ou papéis tipográficos. As demonstrações usam dados locais identificados como exemplos.

## DataTable

`DataTable<T>` recebe `label`, `rows`, `columns` e `getRowId`. Cada coluna declara `id`, `header` textual e `accessor(row)` retornando texto, número, booleano, data ou valor ausente; `render(row)` pode formatar a célula. `sortable` e `searchable` são verdadeiros por padrão. Identificadores de colunas e registros devem ser únicos. Os renderizadores de células devem produzir o mesmo conteúdo e as mesmas ações nos dois tamanhos de tela; evite IDs fixos, pois as duas apresentações ficam no DOM e CSS expõe somente uma por vez.

`buildTableView` é o único pipeline: busca sem acento/caixa → ordenação estável → paginação. Não modifica a coleção recebida nem copia seus objetos. Desktop `<table>` e lista de cartões mobile mapeiam exatamente `view.rows`; a apresentação oculta não participa da árvore acessível. Ambos mantêm `data-row-id` para identidade e evidência. A busca combina termos entre campos, ignora colunas `searchable=false`, e os valores ausentes ficam por último nos dois sentidos de ordenação.

`pageSize` (padrão 5), `initialSort`, `searchLabel`, `emptyMessage`, `loading`, `error` e `onRetry` são opcionais. Filtro e ordenação retornam à primeira página; coleções menores limitam a página válida. O seletor de ordenação e a paginação permanecem disponíveis no mobile. Cabeçalhos informam `aria-sort`, a contagem é anunciada, há vazio recuperável, skeleton no carregamento e erro com repetição quando `onRetry` é fornecido. Interações reutilizam `Button` e `Field`.

## Switch e Tooltip

`Switch({label, checked, onCheckedChange, hint?, disabled?, loading?})` é controlado e usa um único `Button` com `role="switch"` e `aria-checked`. Espaço/Enter vêm do botão nativo, sem handlers duplicados. Estado muda pela posição do seletor além da cor; rótulo permanece durante loading, que bloqueia nova ativação. Herda normal/hover/pressed/focus-visible/disabled/loading, foco em duas camadas e movimento reduzido do Button.

`Tooltip({content, children})` aceita apenas texto como conteúdo e um único elemento acionador que encaminhe `aria-describedby` (por exemplo, Button). Compõe uma descrição anterior, abre por hover/foco, permanece enquanto acionador ou ajuda são apontados, fecha ao sair de ambos e permite Escape sem mover foco. Usa portal e a top layer de popover nativo, com posicionamento fixo como fallback, limites de viewport e recálculo na rolagem/redimensionamento. O atraso de saída de 120ms é **RECOMENDADO** para atravessar o espaço até a ajuda. Não contém controles nem informação essencial exclusiva; ajuda interativa deve usar disclosure ou diálogo. Um acionador desabilitado não recebe foco por teclado e não deve depender de tooltip para explicar a indisponibilidade.

## Apresentação e navegação

- `ChartCard({title, resumoAcessivel, children})`: resumo textual obrigatório e visível, associado à figura. Resumo vazio é erro de contrato. O conteúdo gráfico continua responsável por rótulos e alternativas adequadas; o componente não inventa dados nem interpreta gráficos.
- `ProgressBar({label, value, min=0, max=100, valueText?})`: nome acessível, valores ARIA, texto numérico visível e largura limitada a 0–100%. Limites inválidos usam 0–100; valor não finito usa o mínimo. Progresso não depende apenas de cor.
- `Collapsible({title, children, defaultOpen?, disabled?, loading?})`: botão nativo com `aria-expanded`/`aria-controls`, conteúdo permanece montado e `hidden` quando recolhido. Não é um acordeão exclusivo.
- `PageNavigation({label, items:[{href,label}], currentHref?})`: links nativos para âncoras, seleção declarada pelo chamador com `aria-current="location"`, sublinhado além da cor, foco em duas camadas. Não altera seleção por rolagem implicitamente; use um único `currentHref` que corresponda a um item.

Evidência: contratos do pipeline em `tests/table-model.test.ts` e interações/igualdade desktop↔mobile em `tests/e2e/data-ui.spec.ts`. A presença desses arquivos não atesta execução; a validação realizada deve ser registrada na entrega T-006.
