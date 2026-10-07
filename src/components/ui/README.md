# Primitivas compartilhadas

T-003 porta a base do legado para DS 2.1. As demonstrações executáveis ficam em `/design-system`. Componentes usam apenas tokens; não importam features ou regras de domínio.

T-006 amplia a base: [superfícies, foco e avisos](surfaces.md) e [dados e controles](READMEdata.md) documentam as APIs e os estados avançados.

| API | Contrato |
| --- | --- |
| `Button` | `variant`: primary/secondary/ghost/danger; `size`: sm/md/lg; alturas mínimas 44/44/52px; `loading` mantém o rótulo, inclui indicador, expõe `aria-busy` e desabilita a ativação; `type=button` por padrão; ref nativa |
| `Card`, `CardHeader`, `CardBody` | `variant`: surface/inverse/tinted; `radius`: lg/xl (20/28px); `elevation`: border/shadow, uma por vez; tinted usa surface-muted |
| `Badge` | Rótulo não interativo; `tone`: default/solid/outline; `dot`: success/danger/warning/info/work/personal/fin. O ponto é decorativo, o texto comunica o significado |
| `PillButton` | Botão de filtro com `active`/`aria-pressed`; herda tamanhos, loading, disabled e interação de Button; aceita `dot` |
| `Field` | `as`: input/textarea/select; label obrigatório, hint/error/loading opcionais; ids estáveis e descrições compostas; `error` ativa aria-invalid. Encaminha props e ref nativas da variante |
| `Icons` | 47 desenhos do snapshot, viewBox 24×24, tamanho padrão 20px e traço 1.75; SVG decorativo por padrão. Botões só com ícone devem fornecer nome acessível |
| `Brand` | symbol/horizontal/compact, nome acessível sem duplicação; símbolo mínimo 24px; preservar espaço livre de ¼ do símbolo no contêiner |

## Estados e composição

Button/Pill têm default, hover, pressed, focus-visible, disabled e loading. Hover altera superfície, pressed escala discretamente, foco tem duas camadas. Movimento reduzido remove escala animada e giro. Disabled usa tokens próprios; loading mantém texto legível. O indicador pode aumentar a largura do botão, por isso a composição deve permitir esse espaço.

Field mantém texto ≥16px, borda de controle em `ink-subtle` (papel **RECOMENDADO** para valor existente), hover/pressed, foco duplo, disabled real, readOnly e erro textual associado. Loading preserva o valor: input/textarea ficam readOnly; select fica disabled, pois não oferece readOnly nativo. Campos de checkbox/radio/arquivo não pertencem a essa API de entrada textual.

Em Card inverse, os controles usam os tokens contextuais `--ui-context-*`/`--ui-focus-*`; label, ajuda e loading não reutilizam tintas normais sobre fundo inverso. Erro do Field preserva danger-ink sobre uma pequena superfície opaca própria. Inputs preservam sua superfície normal. Card e Badge não inventam estados interativos para conteúdo estático.

O lint proíbe input/textarea/select fora de `field.tsx` e constantes paralelas `inputCls`, `textareaCls`, `selectCls`. A demonstração e o seletor de tema consomem o mesmo Field. Exceções futuras precisam ampliar o contrato de forma explícita, sem duplicar o campo em uma feature.

## Utilidades portadas

- `.sb-target-44`: amplia o alvo de controles cujo desenho for menor; preservar gap ≥4px para desenho de 40px, e aumentar o gap se o desenho for menor. As primitivas atuais já medem pelo menos 44px.
- `.eyebrow`: utilidade histórica preservada; caixa normal e tracking .04em conforme D-030, papel legenda 12px **INFERIDO**. Não é uma instrução para adicionar títulos decorativos.
- `.scrollbar-thin`: barra fina tokenizada, também aplicada globalmente.
- `.toast-out`: saída de 120ms, translação de 8px e estado invisível final. Com movimento reduzido, chega ao estado final sem animação. T-006 controla o ciclo de vida do Toast.

Origem: `novo-segundo-cerebro@20914ce61fefa268ab06fb52d6e0c27fad7e7143/design-system/reference/runtime/`. Foram corrigidos o danger-solid sem contraste, a falta de loading, a escala tipográfica solta e a antiga soma de borda+sombra. A variante perigosa atual usa texto `danger-ink` sobre superfície neutra; não porta a justificativa incorreta de contraste do legado.
