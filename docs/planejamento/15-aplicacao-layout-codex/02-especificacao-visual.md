# Especificação visual e de interação — aplicação do layout Codex

Inspeção estática em 17/10/2026. **Não é um novo ensaio de navegador.** Os fatos abaixo foram conferidos no [snapshot final](prototipo/index.html), incluído na pasta `prototipo/` deste pacote, depois da correção cromática para o DS 2.1. As evidências anteriores estão no [registro de validação](prototipo/VALIDACAO.md). Os links deste documento distinguem os arquivos de referência daqueles da aplicação. Valores de geometria e tipografia são em pixels, salvo unidade explicitamente diferente.

**OBSERVADO** = presente no código final; **INFERIDO** = correspondência entre papéis; **RECOMENDADO** = regra para a implementação de produção. A solicitação do mantenedor autoriza transportar a composição definida. Isso não transforma divergências numéricas em alterações silenciosamente aprovadas de todo o DS.

O onboarding simplificado tem uma especificação complementar em [07-onboarding-simplificado.md](07-onboarding-simplificado.md). Suas nove telas reutilizam este sistema, com coluna central de 560 px e detalhes recolhidos. A sidebar descrita abaixo pertence ao painel; não deve aparecer no tutorial.

## 1. Precedência e integração

1. Preservar [AGENTS.md](../../../AGENTS.md), [CONTEXT.md](../../../CONTEXT.md), regras de domínio e decisões atuais, inclusive D-027/D-032 no [doc 14](../14-prototipo-interacoes.md) e [ADR-0008](../../adr/0008-google-calendar-readonly.md). O protótipo não substitui contratos, segurança, API ou persistência da aplicação.
2. **Cores:** os [tokens autorais do DS 2.1](../../../design-system/tokens/tokens.json) prevalecem sobre as duas imagens de paleta e sobre as versões anteriores do protótipo. A [cópia final](prototipo/design-system/tokens.json) preserva os **82 valores de cor**, sem divergências.
3. **Composição e microinterações:** o snapshot final é a referência deste trabalho, inclusive a lateral recolhível e a agenda. O [doc 14/D-030](../14-prototipo-interacoes.md) continua autoridade histórica e de comportamento onde este planejamento não o substituir explicitamente. Não aplicar, por acidente, suas medidas anteriores de trilho de 228/74 px e títulos de 28/24 px sobre os novos 232/76 px e 32/28 px.
4. **Deltas não cromáticos:** a geometria e a hierarquia do snapshot orientam aliases locais de componente, documentados no DS com classificação e alcance. Usar tokens oficiais para propriedades idênticas; não trocar o significado de `h2`, `radius.lg` ou `motion.fast` globalmente para imitar o protótipo. Movimento usa os tempos/curva oficiais do DS, não aliases novos. Não criar uma segunda paleta.
5. Preservar Geist e a marca original; na aplicação, usar o carregamento local existente/`next/font`. Não incorporar dependência de Google Fonts ou CDN para reproduzir o arquivo local.
6. Portar a aparência para componentes React e fronteiras existentes. Não copiar `window.App`, renderização por `innerHTML`, roteamento hash, armazenamento demo ou data fixa para produção. `components/ui` não importa `features`; uma feature não importa outra.

### Ordem real do snapshot

[index.html](prototipo/index.html) carrega, nesta ordem: [colors.css](prototipo/design-system/colors.css) → [styles.css](prototipo/styles.css) → [calendar.css](prototipo/calendar.css) → [life.css](prototipo/life.css) → **[refinements.css](prototipo/refinements.css)** → **[onboarding.css](prototipo/onboarding.css)**. `onboarding.css` é restrito à introdução; `refinements.css` contém correções obrigatórias de escala, sidebar, temas, adaptação móvel, truncamento e movimento; ler só a primeira folha produz a versão errada. Há regras antigas de `226px`, fontes menores e animação de drawer sobrescritas depois: não transplantar os valores mortos.

Scripts clássicos, com `defer`: [core.js](prototipo/core.js) → [calendar.js](prototipo/calendar.js) → [life.js](prototipo/life.js) → [navigation.js](prototipo/navigation.js) → [onboarding.js](prototipo/onboarding.js) → [app.js](prototipo/app.js). É uma ordem de referência do protótipo, não arquitetura de produção recomendada.

## 2. Cor, superfícies e estado

| Papel DS | Claro | Escuro | Aplicação observada |
|---|---|---|---|
| `canvas` | `#f5f5f2` | `#0d0d0c` | Fundo da página; alias `--bg` |
| `surface` | `#ffffff` | `#161615` | Painéis, campos e detalhes |
| `surface-muted` | `#efeeea` | `#1d1d1b` | Sidebar, apoio e etiquetas; aliases `--sidebar`, `--surface-2` |
| `surface-hover` | `#e9e7e1` | `#232321` | Hover; alias `--surface-3` |
| `ink` / `accent` | `#161613` | `#f2f1ec` | Texto principal / ação primária e seleção |
| `ink-muted` | `#5f5e58` | `#b3b1a8` | Texto secundário; `--muted` |
| `ink-subtle` | `#62615b` | `#a09e94` | Metadados; `--subtle` |
| `line` | `#e6e4dd` | `#262624` | Divisores discretos, não limite único de controle interativo |
| `accent-ink` | `#f6f5f1` | `#161613` | Texto sobre seleção/ação; `--on-accent` |
| `surface-inverse` | `#161613` | `#f2f1ec` | Bloco de foco; `--focus-bg` |
| `ink-inverse` | `#f6f5f1` | `#161613` | Texto do foco; `--focus-ink` |
| `inverse-muted` | `#b9b7af` | `#5c5b53` | Apoio no foco; `--focus-muted` |

**INFERIDO, já materializado no snapshot:** `--control-line` aponta para `ink-subtle`; é borda de botões secundários, campos e hábito não marcado. Não usar `line` como substituto porque tem função de divisor, com contraste menor.

Fontes do calendário: `.cal-work` usa `work-ink`; `.cal-personal`, `personal-ink`; `.cal-study`, `info-ink` (**INFERIDO**, Estudos não possui token autoral próprio). Todas usam `surface-muted` de fundo. Trabalho é `#0f7568/#20b8a5`, Pessoal `#7038e8/#9d78f8`, Estudos `#2d59bb/#5c88e6`. Nome, horário, símbolo/check e posição complementam a cor. Não mapear Pessoal para `success` por herança de uma classe verde antiga.

Finanças usa `fin-ink` no contexto do módulo; receitas e conclusões conservam `success-ink`; erro usa `danger-ink` (não o degrau decorativo `danger`). Não transformar work/fin em acento global. Os aliases antigos `blue/purple/green/warm` usam info/personal/success/warning **ink**, com fundo neutro.

Sombra de overlay usa `shadow.float` do DS, via `--elevation-float`; painéis comuns permanecem planos. `shadow.card` está disponível, não aplicado indistintamente. `.life-theme-preview` usa constantes de ambos os temas: no modo escuro a amostra Claro deve continuar clara. A amostra Sistema combina metades. Conferir os modelos de aparência explicitamente; não derivá-los todos de `--canvas` do tema corrente.

## 3. Shell, lateral e dimensões

Fontes: [refinements.css](prototipo/refinements.css), [navigation.js](prototipo/navigation.js) e [app.js](prototipo/app.js), funções `A.render` e `navItem`. Os seletores da tabela localizam os componentes nesses arquivos. Medidas são regras finais do CSS, não uma medição óptica de captura.

| Elemento/selector | Contrato observado |
|---|---|
| `.app-shell` | Grid `var(--sidebar-width) minmax(0,1fr)`, mínimo `100dvh` |
| Sidebar normal / `.is-collapsed` | **232 / 76 px**. Coluna flex sticky, `height:100dvh`; padding `24px 12px 16px` |
| `.sidebar-scroll` | `flex:1`, `min-height:0`, rolagem vertical interna; footer/perfil não somem |
| Marca | Ícone 38 × 38 px, texto 21 px, gap 12 px; grupo de marca com altura mínima 48 px e margem inferior 24 px |
| Busca lateral | Altura mínima 44 px, borda de controle, texto 13 px, margem inferior 20 px |
| Grupo de navegação | Gap 18 px entre grupos e 3 px entre links; rótulos 12 px |
| `.nav-link` | Altura mínima 44 px, padding 10 × 12 px, gap 12 px, ícone 20 px, fonte 14 px, raio 9 px |
| Estado atual | `aria-current="page"`, `accent/accent-ink`, peso 600; ponto 5 px ou contador |
| Lateral recolhida | Rótulos visuais ocultos, mas `aria-label` conservado; ícones centrados, separadores de grupo; contador 16 px com texto 11 px |
| `.topbar` | Altura 76 px, padding horizontal 32 px; controle 44 × 44 px, breadcrumb 13 px |
| `main` | `max-width:1600px`, padding `32px 32px 0`, margem auto, `min-width:0` na workspace |
| Página | Margem inferior do cabeçalho 28 px; título 32 px/peso 570; subtítulo 14 px com margem superior 8 px |
| Painel | Fundo `surface`, padding 24 px, raio 16 px; hierarquia por alinhamento, gap e divisória |

Grupos exatos: **Meu dia** (Início, Capturar, Tarefas, Calendário); **Meu contexto** (Conhecimento, Projetos); **Vida pessoal** (Hábitos, Financeiro, Cofre). Integrações e Configurações no rodapé, depois Perfil. Atividade é ação do cabeçalho. Preservar essa arquitetura da informação sem introduzir uma rota só porque existe em uma imagem.

### Comportamento da lateral

- Preferência `sc-prototype-sidebar` aceita `collapsed`/`expanded`; sem preferência, até **1050 px** inicia recolhida. Escolha manual prevalece sobre o fallback responsivo. Na produção usar o mecanismo de preferência definido no projeto; não transportar nome de armazenamento demo como contrato de domínio.
- `A.toggleSidebar()` chama `A.syncShell()`, que muda classes/atributos **sem reconstruir a tela ativa**. Não perder cursor, rascunho, seleção ou scroll do conteúdo ao recolher/expandir.
- Recolhida: tooltip `#nav-tooltip[role=tooltip]` aparece por foco ou ponteiro mouse; associa `aria-describedby`; fica 10 px à direita do item, limitado à janela. Escape, clique e scroll dispensam; ponteiro pode entrar no tooltip. Não depender só de `title`.
- Até **600 px**, painel sobreposto com `width:min(288px,100vw - 32px)`, rótulos restaurados e padding de 20 px / 12 px / 16 px; não vira trilho de 76 px. Abre com botão de menu e fecha por X, fundo sobreposto ou Escape.
- Aberto no celular: `role=dialog`, `aria-modal=true`, foco inicial no X, Tab/Shift+Tab contidos, `.workspace` e `.mobile-bottom` inertes, body sem scroll. Fechado: lateral inerte e foco devolvido ao abridor. Ao sair do breakpoint móvel, desfazer inert/scroll lock/aria-modal.
- Navegação inferior móvel: Início, Tarefas, Capturar, Agenda e Mais; altura `68px + safe-area-inset-bottom`; conteúdo tem espaço inferior 88 px. Não permitir sobreposição de ações/inputs com a barra.

## 4. Tipografia, raios e deltas com o DS

Família é **Geist em ambos**, não uma decisão de substituir a fonte. Snapshot: `@font-face` local em [Geist-Regular.woff2](prototipo/assets/Geist-Regular.woff2), com declaração de peso 100–900; body `Geist,'Segoe UI',sans-serif`. Repositório: `var(--font-geist-sans), 'Segoe UI', system-ui, sans-serif`. Conferir se o arquivo usado em produção oferece os pesos necessários; manter a [licença da fonte](prototipo/assets/Geist-LICENSE.txt).

| Propriedade | DS 2.1 autoral | Snapshot final | Tratamento recomendado no PR executor |
|---|---|---|---|
| Título de página | h2: 28 px / 24 px móvel; peso 600; entrelinha 1.2; tracking −0.025 em | `.page-heading h1`: 32 px / 28 px móvel; peso 570; entrelinha 1.25; tracking −0.03 em | Alias local `page-title` de 32/28 px; não redefinir h2 global |
| Título de seção | h3: 20 px; peso 600; entrelinha 1.3; tracking −0.01 em | `.section-head h2`: 18 px, peso 570, entrelinha 1.25, tracking herdado −0.025 em; 17 px até largura 780 px e 16 px até 360 px | Alias `section-title`; registrar redução por densidade |
| Corpo | 14 px; entrelinha 1.5; peso 400 | 14 px; entrelinha 1.55; peso 400 | Alias/estilo de corpo da superfície; preservar editor de 16 px / entrelinha 1.8 existente |
| Botão | Não há papel autônomo neste JSON | 13 px; entrelinha 1.3; peso 550 | Papel local de controle, não reutilizar micro |
| Metadado / dado / campo | 12 / 13 / 16 px | 12 / 13 / 16 px | Reutilizar tamanhos DS; exceções de 11 px limitadas a GMT, dia inteiro e contador do trilho |
| Campo | `field-height:52px`; fonte 16 px | Mínimo 44 px; padding 11 × 12 px; fonte 16 px | **Preservar 52 px do DS na produção**, com fonte mínima 16 px; adaptar a composição ao campo, sem comprimi-lo |
| Raios | 4 / 8 / 12 / 20 / 28 / 36 px / full | Campo 8 px; botão/nav 9 px; painel/nota/dialog 16 px; agenda 8/10/12/14 px; drawer 20 px | Aliases de componente de 9/16/10/14 px para este layout; não mudar `radius.md`/`radius.lg` global |
| Motion | 120/180 ms; `cubic-bezier(.2,.75,.25,1)` | 140/180/240 ms; `cubic-bezier(.23,1,.32,1)` | **Usar CSS e DS oficial:** feedback 120 ms, superfícies/sidebar 180 ms, curva oficial. Os 240 ms são observação da origem, não requisito de produção |
| Reduced motion | 0.001 ms | Remove deslocamento; alguns fades de 80 ms | **Manter piso DS de 0.001 ms na produção**; não importar 80 ms como novo contrato global |
| Z-index | escala autoral 10–110 | sidebar 20, menu 70/scrim 65, tooltip 150, skiplink 1000; dialog top layer nativo | Mapear na escala DS/top layer. Não copiar números altos cegamente |

Estas diferenças são **OBSERVADAS**, não alterações já aplicadas ao DS. A resolução para execução é: cores globais intactas; aliases locais para geometria/hierarquia do layout; movimento, foco, campos e alvos com invariantes oficiais. Restrições de acessibilidade e domínio prevalecem mesmo quando exigirem alguns pixels de diferença. Este planejamento explicita a diferença entre fonte visual e produção e **não promete identidade pixel a pixel** onde a adaptação para 44 px/52 px altera a distribuição. A identidade depende da composição e dos papéis, não de baixar áreas de toque ou perder comportamento real.

Piso de interação: [AGENTS.md](../../../AGENTS.md) exige **44 × 44 px**. O snapshot tem exceções: setas de período de 36 × 44 px (34 × 44 px até largura 680 px), dias do minicalendário com 32 px de altura e setas de 25 × 36 px; abas com 40 px de altura no desktop e 42 px até largura 760 px. `pointer:coarse` esconde o minicalendário e aumenta controles principais para 44 px. **Na portabilidade, regularizar 44 × 44 px em todos os modos, com área clicável real e gaps que impeçam sobreposição**. Se sete colunas de 44 px não couberem no minicalendário, adaptar/ocultar o seletor e manter seleção de data em superfície acessível; não sobrepor áreas de interação. Não declarar que todos os alvos já atendem ao piso apenas porque `.icon-button` base tem 44 px.

## 5. Composição de início e conteúdos

- `.home-top`: foco e resumo na proporção `2.12fr : 1fr`, gap 24 px. Foco com padding 28 px, altura mínima 230 px, título 28 px com largura máxima 30 ch; resumo com padding 26 px e número de 48 px. Até largura de 1000 px: proporção 1.7:1, título do foco 26 px e padding 24 px. Até 780 px: coluna única e resumo reorganizado em grade.
- `.home-main`: tarefas e agenda na proporção `1.2fr : 1fr`, gap 24 px; até largura de 1000 px, coluna única. Linhas de tarefa com altura mínima 76 px, título 14 px / entrelinha 1.45 e metadado 12 px. Agenda com altura mínima 72 px, horário 12 px e título 14 px. Nenhum card decorativo precisa disputar com a tarefa em foco.
- `.home-bottom`: proporção `1.25fr : 1fr : .85fr`, gap 24 px; de 601 a 1200 px, duas colunas e inbox na linha inteira; até 780 px, uma coluna. Notas recentes passam a uma coluna até 1000 px.
- Capturas em largura de até 780 px: `.capture-item` vira grid `34px minmax(0,1fr)`; ações em linha seguinte `grid-column:1/-1`, com quebra de linha. Não manter ações ao lado comprimindo o texto em 70 px.
- `.note-card h3`: 21 px, corpo de 14 px / entrelinha 1.65; `.note-prose`: 16 px; título de captura 18 px; listas de vínculos 13 px. Financeiro e agenda usam numerais tabulares. Estados vazios: título 18 px, corpo 14 px, largura máxima 45 ch; explicar ação seguinte.
- Hábitos: tabela móvel conserva rolagem **interna** e primeira coluna sticky; não empurrar o documento inteiro. Financeiro móvel transforma lançamentos em linhas com valor/ações à direita; abas podem rolar internamente. Cofre deve continuar bloqueando/mascarando com os contratos atuais.

## 6. Calendário reproduzível

Fonte principal de composição: [405324035233224479.jpg](referencias/405324035233224479.jpg). Implementação observada em [calendar.js](prototipo/calendar.js), funções `timeline`, `layoutEvents`, `month`, `list`, `eventDetails` e `renderCalendar`, e em [calendar.css](prototipo/calendar.css), com sobrescritas finais em [refinements.css](prototipo/refinements.css).

### Grade e painel de fontes

- `.cal-toolbar`: período à esquerda, setas e Hoje; à direita Dia/Semana/Mês/Lista e botão de fontes quando a lateral interna estiver oculta. Título 22 px/peso 600; apoio 12 px. Toolbar com altura mínima 78 px e padding inferior 25 px; abas em superfície secundária, seleção inversa, raio externo 12 px e interno 9 px.
- `.cal-layout`: `208px minmax(0,1fr)`, gap 25 px; em viewport até 1270 px: coluna de 190 px e gap 20 px; a partir de 1600 px: coluna de 228 px e gap 30 px. Ocultar `.cal-aside` e mostrar fontes pelo botão quando o viewport tiver até 1120 px **ou o contêiner `calendar` tiver até 900 px**. Não confundir contêiner com viewport.
- `.cal-time-scroll`: rolagem interna, altura máxima 785 px; sobe para 840 px em viewport a partir de 1600 px e cai para 730 px até largura de 760 px. Usa `overscroll-behavior:contain`, `role=region`, nome e `tabindex=0`. Grade semanal com largura mínima 610 px; dia único pode encolher. É permitido scroll interno, não global.
- `.cal-time-grid`: coluna de horas de 52 px e dias iguais, gap 7 px, cabeçalho 81 px. A regra intermediária até 1270 px usa coluna 49 px/gap 6 px; até 1120 px, retorna a 52 px/gap 7 px. Dia único usa 58 px na regra base. Cabeçalhos sticky no topo 0, raio 12 px; dia atual em acento e seleção separada por borda. Numeral 25 px, dia 12 px.
- **80 px por hora** (`HOUR_HEIGHT`). Faixa base 07 h–21 h expandida para eventos anteriores/posteriores. Posição vertical proporcional à hora, não lista arbitrária. Não transportar `TODAY='2026-10-17'` ou fuso fixo do fixture; usar relógio e contrato de fuso da aplicação.
- Faixa dia inteiro separada: cada trilha 48 px, altura total `trilhas*48+14`; barra 44 px, intervalo visual contínuo pelos dias. Término `endDate` **exclusivo**; mostrar o último dia incluído no detalhe. Não acrescentar um dia a evento Google all-day.
- Conflitos de horário dividem colunas sem ocultar outro evento. Posição: top+3; altura `max(44,duraçãoPx-6)`; left por lane+3; width fracionária−6. `layoutEvents` usa janela mínima 48 min para separar visualmente itens curtos. Isso é regra demonstrativa de colisão; adaptar com testes de eventos curtos/cruzamento da meia-noite no código real.
- Evento: raio 10 px, padding 11 × 10 px, fonte 13 px (14 px em viewport a partir de 1600 px), título até 2 linhas pela sobrescrita final; horário 12 px, gap 6 px. Altura temporal inferior a 105 px usa `.is-short`, gap 4 px/padding 8 px e oculta fonte; abaixo de 70 px, usa `.is-tiny`, título de 1 linha/gap 2 px. Título/horário completos continuam no nome acessível e no detalhe. `strong`, hora e origem não encolhem verticalmente para cortar meia linha.
- Fonte semanticamente colorida e rotulada; nota vinculada com ícone+texto acessível. Hoje usa acento monocromático, não cor de fonte.

### Mês, lista, filtros e detalhe

- Mês tem 42 células, semana iniciando segunda; cabeçalho com altura 48 px e dia com altura mínima 150 px. Mostra 2 compromissos e `+N compromissos`, que abre o dia completo. Título longo pode truncar na célula, mas o detalhe é completo.
- Lista mostra somente dias com eventos no período; data 32 px e coluna de 83 px; horário 13 px, título 14 px, detalhes 12 px. O estado vazio explica período/fontes e oferece Revisar calendários.
- **Até largura de 680 px**, esconde `.cal-large` e mostra `.cal-mobile` como agenda legível. As quatro escolhas de visão continuam definindo período; não prometer uma grade mensal minúscula no celular. Coluna de data 40 px, gap 13 px, coluna de horário 40 px; até 600 px, conteúdo com `flex-basis:calc(100% - 49px)` e etiqueta na linha seguinte com margem 49 px para não espremer o título.
- Fontes afetam tanto Calendário quanto agenda do Início. A seleção é persistida; todas ocultas produz mensagem e caminho de recuperação. Fontes de conta removida não aparecem nem retornam dados.
- Detalhe é `dialog:has(.cal-event-body)` à direita, largura `min(460px,100vw)`, altura 100 dvh e raio 20 px à esquerda; até largura de 680 px, sem raio. Padding interno de 28 × 30 px (25 × 23 px móvel), título 29 px / entrelinha 1.25 (28 px móvel). Mostra data/horário/local/origem, Abrir/Criar nota e Criar tarefa relacionada.
- Compromissos permanecem **somente leitura**: nem drag para mover, nem criar/editar/apagar no Google. No máximo 2 contas, fontes escolhidas e contratos do ADR-0008. A aparência do snapshot não autoriza reimplementar OAuth ou substituir a integração existente por simulação.
- `renderCalendar` conserva scroll entre filtros/visões/períodos; Hoje zera scroll e volta à data atual. A seleção do minicalendário muda data; abrir cabeçalho/dia muda para visão Dia. Não perder foco após rerender de botão.

## 7. Teclado, estados e movimento

- [core.js](prototipo/core.js), função `setTheme()`, atualiza `data-theme` e chama `syncTheme` de [navigation.js](prototipo/navigation.js); `life-theme` em [life.js](prototipo/life.js) salva preferência sem `A.render()`. Tema claro/escuro/sistema atualiza ícones, `aria-pressed`, metatag e amostras sem apagar rascunho. Sistema reage a `prefers-color-scheme`; bootstrap evita flash de tema errado.
- [index.html](prototipo/index.html) tem skiplink para `#main[tabindex=-1]`; os handlers estão em [app.js](prototipo/app.js). Navegação por Enter move foco ao main; retorno de diálogo devolve ao elemento abridor se ainda conectado. Busca Ctrl/Cmd+K; setas escolhem resultados; Enter abre; Escape fecha. Rótulos/validação nativa devem sobreviver ao styling.
- Foco base 2 px; no card inverso usa `focus-ink`. Controle desabilitado não transforma em active. Hover de componentes novos considera `hover:hover` e `pointer:fine`.
- Feedback 140 ms, estado 180 ms, espaço 240 ms no snapshot. Lateral anima `grid-template-columns`; botão de toggle gira no mesmo estado. Troca de tema usa cores 180 ms, sem reconstrução. Sem entrada coreografada de página, atrasos seriados ou animação de dados recorrente.
- Dialog padrão na origem: opacidade e `translateY(6px) scale(.98)`; drawer com `translateX(30px)`, na mesma direção na saída; camada nativa com `allow-discrete`/`@starting-style`. Busca abre imediatamente. O fallback em navegador sem transições discretas deve permanecer utilizável.
- `html[data-input=keyboard]` suprime transições do shell/sidebar/dialog; WAAPI do período também checa teclado. Reduced motion remove translação/animação; **portar para o piso autoral do DS**, como descrito nos deltas.
- **Divergência explícita e resolução:** `renderCalendar` de [calendar.js](prototipo/calendar.js) usa `stage.animate(...)` com deslocamento 10 px, opacidade inicial 0.72 e duração 180 ms, enquanto o [doc 04](../04-design-system.md) mantém proibição de animação JS. **Na produção reproduzir essa mudança discreta em CSS/estado React, com interrupção natural, curva DS e sem WAAPI.** Não bloquear navegação esperando animação terminar. A lateral usa superfície de 180 ms; a troca de tema e diálogos também usam 180 ms; feedback de 120 ms e movimento reduzido de 0.001 ms. A velocidade/curva de origem ficam registradas como observação, sem impor alteração global.

## 8. Breakpoints de referência

| Limite | Resultado |
|---|---|
| ≥ 1600 px | Lateral do calendário 228 px, gap 30 px; títulos de evento 14 px; altura máxima de rolagem 840 px |
| ≤ 1270 px | Lateral do calendário 190 px, gap 20 px; coluna de horas 49 px, gap 6 px |
| 601–1200 px | Padding do main: 28 px vertical e 24 px horizontal; topbar 24 px horizontal; blocos inferiores da Home em 2 colunas |
| Viewport ≤ 1120 px ou contêiner ≤ 900 px | Oculta lateral interna da agenda; fontes por botão |
| ≤ 1100 px | Financeiro em 1 coluna; toolbar dos módulos pessoais em coluna; lateral do Cofre 240 px |
| ≤ 1050 px | Sem escolha salva, lateral do app começa recolhida |
| ≤ 1000 px | Home: tarefas/agenda em 1 coluna; notas recentes em 1 coluna; badges secundários ocultos |
| ≤ 940 px | Toolbar da agenda quebra linha |
| ≤ 780 px | Home: foco/resumo e blocos inferiores em 1 coluna; capturas com ações abaixo |
| ≤ 760 px | Toolbar da agenda em 2 linhas; tabelas/financeiro/cofre móveis; hábitos com scroll interno |
| ≤ 680 px | Calendário em lista por período; drawer sem raio |
| ≤ 600 px | Sidebar sobreposta de até 288 px; topbar 64 px; padding do main 24 px / 16 px / 88 px; navegação inferior; título 28 px |
| ≤ 360 px | Padding do painel 16 px; temas em 3 linhas, prévia 64 × 44 px; tarefa permite vencimento na linha seguinte |
| `pointer:coarse` | Minicalendário oculto; setas/abas principais com alvo de 44 px na origem. Aplicar piso de 44 × 44 px em todos os modos na produção |

Não substituir por um único breakpoint de 767 px: a lateral externa e a agenda interna respondem a necessidades diferentes. Calcular largura real do conteúdo com sidebar de 232/76 px e margens, e testar os dois estados entre limites.

## 9. Matriz de aceite para o executor

Evidências devem ser novas no app integrado. Os resultados de 82 tokens, 88 pares de contraste, 70 testes e capturas do protótipo são referência inicial, não prova de produção nem CI verde. A matriz de aceite cobre **12 áreas**: Início, Capturar, Conhecimento, Tarefas, Calendário, Projetos, Hábitos, Financeiro, Cofre, Integrações, Configurações e Atividade. Abrir também detalhes/editor relacionados aos fluxos, sem contá-los como uma área substituta.

| Cenário | Ação / resultado exigido | Evidência |
|---|---|---|
| Desktop 1440 × 1000 px | Início/Calendário, claro/escuro, sidebar expandida/recolhida; comparar hierarquia, cores e densidade | 8 capturas nomeadas e comparação visual |
| Intermediário, largura 900 px | Tarefas/agenda em ambos os estados da sidebar; fontes acessíveis por botão; sem rolagem horizontal global | Capturas e dimensões DOM |
| Mobile, larguras 390 e 320 px | 12 áreas navegáveis, tema claro/escuro; rótulos da lateral, capturas longas, hábitos, financeiro e configurações | Capturas e fluxo por teclado/toque emulado |
| Tema | Digitar captura e nome sem salvar; mudar tema e recolher/expandir; valor, cursor e preferência preservados | Teste de fluxo e recarga controlada |
| Sidebar | Persistir estado; iniciar recolhida até 1050 px quando não houver preferência; abrir/fechar overlay, Tab/Shift+Tab/Escape, retorno de foco e `inert` | Teste E2E e árvore acessível |
| Navegação | Rotas existentes, `aria-current`, links com nomes após recolher, skiplink, busca Ctrl/Cmd+K, setas/Enter | Teste E2E |
| Calendário | 4 visões, Hoje, anterior/próximo, virada dezembro/janeiro, fontes, todas ocultas, conta removida e mais de 2 eventos por dia no mês | Teste de comportamento |
| Densidade temporal | Sobrepostos, 15/30 minutos, evento longo, título longo, dia inteiro, vários dias, término exclusivo e meia-noite | Fixtures, captura e assertions |
| Detalhe | Abrir evento por mouse/teclado, Escape/fechar, nota/tarefa relacionada e retorno de foco; evento externo não editável | Teste E2E |
| Estados | Vazio, erro, carregamento, desabilitado, confirmação, permissão insuficiente, sem fonte e armazenamento falhando | Capturas e testes pertinentes ao módulo |
| Acessibilidade | Texto ≥ 4.5:1 e controle/foco ≥ 3:1 sobre fundos reais; alvo 44 × 44 px, campo 52 px/fonte ≥ 16 px, zoom 200%, teclado, leitor de tela e movimento reduzido ativado | Relatório de contraste e ensaios reais |
| Animação | Reverter toggle antes de 180 ms, abrir/fechar repetidamente, trocar período rápido; nada fica preso ou atrasa input; curva oficial e redução para 0.001 ms | Vídeo curto ou ensaio anotado |
| Regressão de escopo | Dados reais mantidos; conversão/promoção únicas, vínculos/privacidade da busca, contabilidade de cartão, pausa/arquivamento de hábitos, Cofre seguro e Google somente leitura | Suítes de domínio existentes e E2E seletivo |

Não usar zoom 200%, leitor de tela, aparelho físico ou movimento reduzido do sistema como itens já validados: [VALIDACAO.md](prototipo/VALIDACAO.md) declara que não foram exercitados nessa entrega. Exigir esses ensaios na integração ou registrar bloqueio específico com alcance claro.

## 10. Referências embarcadas no planejamento

- [Snapshot navegável](prototipo/index.html), com cinco JS, quatro CSS de UI, [cores geradas](prototipo/design-system/colors.css), [tokens](prototipo/design-system/tokens.json), [marca](prototipo/assets/brand.svg), fonte/licença e docs. Preservar caminhos relativos para abrir sem rede.
- Prévias finais do DS 2.1: [Início](prototipo/preview.png), [Calendário claro](prototipo/preview-calendario-claro.png) e [Calendário escuro](prototipo/preview-calendario-escuro.png).
- [Referência principal do calendário](referencias/405324035233224479.jpg) e [demais imagens fornecidas](referencias/). As imagens de paleta são históricas, substituídas pelo DS para a decisão de cor.
- [DESIGN.md](prototipo/DESIGN.md), [PRODUCT.md](prototipo/PRODUCT.md), [DIAGNOSTICO.md](prototipo/DIAGNOSTICO.md), [VALIDACAO.md](prototipo/VALIDACAO.md) e [registro Impeccable](prototipo/.impeccable/design.json): contexto e limites. Não tratar todo campo de documentação como token já adotado no app.
- Tabela de correspondência snapshot→componentes reais e issues por frente, mais decisões de deltas. Cada issue deve apontar a commit/revisão deste conjunto para evitar implementar uma paleta anterior.
- Prompt do executor deve começar pela precedência, pedir leitura dos arquivos de planejamento e respectivos tickets, exigir provas de fluxo/visual e impedir substituir backends/contratos por mocks do protótipo.
