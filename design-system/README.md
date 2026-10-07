# Tokens DS 2.1

`tokens/tokens.json` é a fonte autoral. O gerador produz `tokens/tokens.css`, incluindo claro, escuro explícito e fallback escuro do sistema somente quando `html` não possui `data-theme`. O estado de preferência e seu bootstrap pertencem a `src/lib/theme.ts` e aos componentes de tema.

```sh
node design-system/generate.mjs
node design-system/validate.mjs
npm test -- --run tests/design-system.test.ts
```

Depois de mudar o JSON, regenere o CSS e revise ambos. O validador nunca corrige o CSS silenciosamente: divergência, contraste abaixo do piso, token obrigatório ausente, valor cru no runtime ou alteração no asset de marca encerram o processo com código 1. Nenhum comando precisa de serviço externo ou aplica migrations.

## Contratos de consumo

Importe `tokens/tokens.css` após o import do Tailwind em `src/app/globals.css`. `@theme inline` expõe utilitários como `bg-surface`, `text-ink`, `text-corpo`, `rounded-xl` e `shadow-float`. As paletas genéricas de cor e tamanho tipográfico do Tailwind são desativadas; o guard também rejeita classes como `text-sm` e `bg-blue-500`.

| Família | Tokens CSS / regra |
|---|---|
| Fundos | `--canvas`, `--surface`, `--surface-muted`, `--surface-hover` |
| Tintas | `--ink`, `--ink-muted`, `--ink-subtle`; todas atingem 4.5:1 nos quatro fundos de ambos os temas |
| Acento | `--accent` com `--accent-ink` |
| Inversa | `--surface-inverse` com `--ink-inverse` ou `--inverse-muted`; preservar a dupla também em hover |
| Semântica | `success`, `danger`, `warning`, `info`, `work`, `personal`, `fin`: token básico para sinais e decoração; sufixo `-ink` para texto nos quatro fundos |
| Financeiro | `--fin`/`--fin-ink` restritos ao módulo e à página de verificação; oito `--cat-*` para gráficos, acompanhados de nomes/símbolos |
| Desabilitado | `--disabled`, `--disabled-bg`; somente controles realmente inativos, fora do piso de texto ativo |
| Tipografia | `--type-{papel}`, `--leading-{papel}`, `--weight-{papel}`, `--tracking-{papel}`; os mesmos papéis estão em `text-{papel}` |
| Raios | `--radius-xs/sm/md/lg/xl/2xl/full` = 4/8/12/20/28/36/9999px |
| Espaço | `--space-1` a `--space-20`, além de `--space-group` e `--space-section` |
| Camadas | `--z-local-popover`, `--z-sticky`, `--z-mobile-overlay`, `--z-mobile-navigation`, `--z-editor-popover`, `--z-dropdown-catcher`, `--z-dropdown-panel`, `--z-modal`, `--z-toast`, `--z-skip-link` |
| Movimento | `--motion-fast`, `--motion-surface`, `--motion-ease`; regra global limita animações/transições sob `prefers-reduced-motion` |

Geist vem do carregamento local já adotado no layout, via `--font-geist-sans`, com fallback Segoe UI/system. Valores e tabelas usam `font-variant-numeric: tabular-nums`. `micro` é exceção exclusiva para eixos de gráfico; não é legenda nem texto de controle. Campos e editor ficam em 16px ou mais. O papel `h2` identifica a escala de título de página, independentemente da tag semântica: aplique `--type-h2-mobile` (24px) abaixo de 768px. Editor usa entrelinha 1.8.

## Evidência e conciliação

Os valores e seus grupos são classificados no JSON. D-030 e o [doc 14](../docs/planejamento/14-prototipo-interacoes.md) prevalecem sobre propostas antigas do [doc 04](../docs/planejamento/04-design-system.md).

- **OBSERVADO:** cores neutras, inversas, vidro e sombras do [protótipo vigente](../docs/prototipo/prototipo-segundo-cerebro.html). Seus `surface-2/3` recebem os nomes semânticos `surface-muted/hover`. O refinamento final de `subtle` foi aplicado. Corpo 14px e h3 20px preservam a escala efetiva do HTML; títulos 28/24px e editor 16px vêm da revisão DS 2.1.
- **OBSERVADO:** degraus decorativos, categorias, disabled e camadas herdados do snapshot indicado em `meta.legacy`. O `success-ink` antigo não se transfere: sobre o novo fundo hover atingiria apenas 4.455:1. A tinta de sucesso vigente do protótipo atinge 4.593:1 e foi preservada nos dois temas.
- **INFERIDO:** aliases de acento, fallback opaco do vidro e mapeamento do Financeiro para o teal usado por `.fin .lbl .ic` no protótipo. São valores existentes com papéis explícitos.
- **RECOMENDADO:** formalização da escala 4pt, raios adicionais, display, corpo forte, campo, micro, entrelinhas não especificadas pelo protótipo e camada do skip link conforme doc 04. Não foi criada uma nova cor para completar a paleta.

## Contraste e vidro

O validador calcula luminância relativa sRGB WCAG sem arredondar o limiar de aprovação. O conjunto atual tem 164 pares: 80 de tintas nos quatro fundos × dois temas, 64 de categorias gráficas (piso 3:1), seis pares de acento/inversos e 14 pares de vidro/fallback. O menor contraste de texto é `work-ink`/`fin-ink` no fundo hover claro: **4.5109:1**. O número impresso não substitui a comparação de precisão completa.

`.glass-frame` é exclusiva da moldura (trilho/cabeçalho/sheet), nunca de cartões de dados. Ela nasce opaca; transparência só é habilitada em telas a partir de 768px, com suporte a blur e preferência explícita `no-preference`. Mobile, preferência de transparência reduzida e navegadores sem essa media query recebem `glass-fallback`.

Sobre fundos arbitrários, vidro carrega somente a tinta principal `ink`: o contraste é verificado após composição de alpha sobre preto, branco e os quatro fundos do tema. Tintas secundárias ou semânticas exigem uma superfície opaca própria ou o fallback; a aprovação de `ink` não se estende automaticamente a essas tintas. Bordas de vidro são decoração e não devem ser a única delimitação de um campo/controle.

## Portão e limites

Os testes exercitam a API pública do validador com dataset completo, sabotagem de contraste com CSS coerente, exclusão de token e CSS divergente. Os pisos de campo/editor e alvo exigem valores finitos em `px`: expressões não resolvidas, unidades distintas e números inválidos são reprovados. O guard percorre `src/` e `public/`; documentos, testes e evidências históricas ficam fora do runtime. Verifica literais hex, funções de cor numéricas, o conjunto completo de cores CSS nomeadas em declarações/shorthands/propriedades camelCase e paletas/tamanhos genéricos do Tailwind. Isso complementa revisão de código; não substitui testes dos pares realmente renderizados, de estados, foco ou de sobreposição.

O favicon original é a única exceção estática de cor: [brand-manifest.json](brand-manifest.json) registra origem, justificativa e SHA-256 após normalizar CRLF para LF. Ele não é recolorido pelo tema. A marca inline usa `currentColor` e tokens. A checagem não pretende impedir uma mudança deliberada e revisada no manifesto, mas acusa qualquer alteração não registrada no asset.
