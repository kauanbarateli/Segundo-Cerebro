# Aplicação do layout Codex com DS 2.1 — relatório de execução

Execução da [issue #46](https://github.com/kauanbarateli/Segundo-Cerebro/issues/46) a partir do pacote [`docs/planejamento/15-aplicacao-layout-codex/`](../../planejamento/15-aplicacao-layout-codex/README.md). Aceite final coordenado com a [issue #44](https://github.com/kauanbarateli/Segundo-Cerebro/issues/44). Este relatório separa **implementado**, **validado** e **pendente**; resultados do protótipo não contam como prova da aplicação.

## L0 · Base e preparação

| Item | Registro |
|---|---|
| Branch | `claude/segundo-cerebro-layout-final-ays1kz` |
| Base `main` | `61d03c768071e6618136e648fc71c552e3db2043` (mesma base inspecionada pelo planejamento) |
| Pacote de referência | `codex/planejamento-layout-ds21` @ `ea6cd61b0c196df27f4d0c75a3f5cf2ba1aea5ee` ([PR #47](https://github.com/kauanbarateli/Segundo-Cerebro/pull/47), Draft). Incorporado por fast-forward nesta branch porque ainda não está em `main`. |
| Verificador do pacote | `node docs/planejamento/15-aplicacao-layout-codex/verificar-pacote.mjs`: 79 arquivos, 320 links, 82 cores exatas, 88 pares de contraste (mínimo 4,5109:1), 5 scripts, zero falhas. |
| PR paralelo #45 | HEAD `93ab8549`. Altera somente `docs/implementation/*`, `scripts/operations/restore-managed-inspect.mjs`, `scripts/verification/browser-active-close-probe.mjs` e dois testes de scripts. Nenhuma colisão com UI, tokens, rotas ou testes de interface. |
| Impeccable | Versão local 4.4.0 (`.agents/skills/impeccable/`). `impeccable context` executado (PRODUCT.md/DESIGN.md e briefs carregados). Referências lidas: SKILL, craft-floor, critique, audit, polish, animate, operate. Modo de superfície: **Operate**. |
| Ambiente de prova | APP_MODE=demo, build de produção local (`next build` + `next start`), Chromium 1194 do contêiner (Playwright 1.63), fuso `America/Sao_Paulo`, `prefers-reduced-motion: reduce` nas capturas para estabilidade. Dados de exemplo da demonstração; nenhuma conta, migration ou serviço remoto. |

### Capacidades reais inventariadas (não aparecem no protótipo e foram preservadas)

TipTap/JSON e conflitos em Conhecimento; anexos de imagem, rascunhos, promoção e conversão idempotente em Capturar; lixeira/arquivo/restauro em Tarefas, Projetos, Conhecimento e Financeiro; cinco abas e modelo fundido do Financeiro (cartões, faturas, transferências, orçamentos); pausas globais/individuais e heatmap de 26 semanas em Hábitos; criptografia cliente, kit de recuperação, auto-lock e limpeza da área de transferência no Cofre; sessões próprias, privacidade de valores, ordem/visibilidade de módulos, lembretes e instalação PWA em Configurações; histórico paginado de Atividade; Google somente leitura com até duas contas, revogação pendente e sync por período; Auth, Admin, Ajuda, `/sair`, `/offline`, `/compartilhar` e `/conheca`.

### Auditoria inicial (Impeccable audit/critique sobre a base)

Capturas da base em [`capturas/base/`](capturas/base/). Pontuação audit (0–4): acessibilidade 3, desempenho 3, responsivo 3, tema 4, integridade 3 — **16/20 (Good)**. A base é sólida; os achados são de composição em relação ao alvo e de persistência da lateral.

| Sev. | Achado | Evidência | Encaminhamento |
|---|---|---|---|
| P1 | Recolhimento da lateral não persiste (estado React inicial `false`) e é forçado abaixo de 1120 px sem escolha manual | `workspace-shell.tsx`, `@media (max-width:1119px)` | L2: preferência de apresentação no navegador, fallback em memória, padrão recolhido ≤1050 px |
| P2 | Lateral recolhida nomeia itens apenas com `aria-label`/`title`; nenhuma dica no foco do teclado | `RouteLink` | L2: tooltip `role=tooltip` por foco/ponteiro com `aria-describedby`, Esc dispensa |
| P2 | Hierarquia: título de página usa h2 global de 28 px; seções sem papel próprio; cartões com raio 20/28 px e bordas | `.shell-page-heading`, `ui-card` | L1: aliases `page-title` 32/28 e `section-title` 18; painéis 16 px sem borda |
| P2 | Navegação sem agrupamento (13 itens em lista única, Configurações/Integrações misturadas com módulos) | trilho | L2: Meu dia / Meu contexto / Vida pessoal; utilitários no rodapé |
| P2 | Calendário abre em Mês sem minicalendário, fontes ou linha do tempo; `input type=date` e botões em duas linhas | `calendar-workspace.tsx` | L3B |
| P3 | Cabeçalho flutuante duplica superfícies (vidro opaco sobre canvas) e concorre com o trilho | `.shell-header` | L2: topbar 76 px com divisor |

Pontos fortes mantidos: foco em duas camadas, alvos de 44 px no shell, skip link, busca com Ctrl/Cmd+K, Dialog nativo com pilha de foco, tokens sem literais (validador do DS) e redução de movimento global.

### Decisões de integração (plano §2)

| Tema | Decisão aplicada |
|---|---|
| Agrupamento × ordem personalizada | Grupos padrão: **Meu dia** (Início, Capturar, Tarefas, Calendário), **Meu contexto** (Conhecimento, Drive quando visível, Projetos), **Vida pessoal** (Hábitos, Financeiro, Cofre). Integrações, Configurações e Admin (quando há privilégio) ficam no rodapé. A ordem continua vindo de `getVisibleRoutes(policy)`. Se a ordem personalizada mantiver cada grupo contíguo, os rótulos aparecem; se a pessoa intercalar módulos de grupos diferentes, a lateral mostra a lista única na ordem escolhida, sem rótulos, para não reorganizá-la implicitamente. Ocultar continua sendo Preferência; veto continua sendo Entitlement. |
| Persistência do recolhimento | Chave de apresentação `segundo-cerebro-sidebar` (`collapsed`/`expanded`) no navegador, com fallback em memória quando o armazenamento falha. Sem escolha salva: recolhida até 1050 px. Nenhuma migration nem chave do protótipo. A troca altera atributos do shell sem remontar `main`. |
| Mobile | Até 600 px a lateral vira painel sobreposto (`role=dialog`, `aria-modal`, foco inicial no X, Tab contido, fundo `inert`, scroll travado, retorno ao abridor); barra inferior com os quatro primeiros módulos visíveis e **Mais**. Uma única árvore de navegação para todas as larguras. |
| Tema no cabeçalho | O protótipo alterna claro/escuro. O produto conserva o seletor nativo **Tema** (Claro/Escuro/Sistema, conta e navegador), apresentado como controle de 44 × 44 px com ícone. Configurações ganha os três modelos de tema com amostras fixas de cada paleta. |
| Integrações | `/integracoes` deixa de ser vazia e compõe a gestão Google existente do Calendário pela rota (`app → feature`), sem importação feature→feature nem segundo estado de contas. Mesmo serviço, mesmas permissões. |
| Calendário Lista | Visão de apresentação `view=list` na URL com janela mensal. `default_calendar_view` persistido continua `day/week/month`; Lista nunca é salva como preferência. |
| Fuso e datas | `FUSO_DO_APP` e helpers de `src/core/tempo`; nada de Fortaleza ou 17/10/2026 fixos. |
| Medidas | Aliases locais em `src/components/ui/aliases.css` (232/76, topbar 76/64, títulos 32/28 e 18, raios 9/16/10/14/20, `--control-line`). Campos continuam 52 px/16 px; alvos 44 × 44 px; motion 120/180 ms com a curva DS; redução 0,001 ms. Cores somente dos tokens DS 2.1. |

## L1 · Aliases e primitivas — implementado

- `src/components/ui/aliases.css`: aliases locais classificados (OBSERVADO/INFERIDO/RECOMENDADO) para lateral 232/76/288 px, topbar 76/64 px, conteúdo 1600 px e gutters 32/24/16 px, título de página 32/28 px (570, −0,03 em), título de seção 18 px, papel de controle 13 px/550, raios 9/16/10/14/20 px e `--control-line` (= `ink-subtle`). Nenhum token global foi redefinido; `h2`, `radius.md/lg` e `motion.*` mantêm o significado.
- Gerador do DS: amostras fixas `--theme-{light,dark}-*` derivadas do JSON (sem cor nova) para os modelos de tema. `check:design-system` continua com 164 pares aprovados.
- Primitivas: botão com raio 9 px e papel de controle, borda secundária em `--control-line`, hover do primário no par DS medido; campo com raio 8 px e 52 px/16 px preservados; painel padrão plano de 16 px (borda/sombra opcionais); badge de 4 px; diálogo 16 px e drawer 20 px com entrada CSS de 180 ms na curva oficial (`@starting-style`, sem WAAPI), busca abrindo imediatamente e transições suprimidas em navegação por teclado.
- Ícones: sete desenhos do shell (lateral, menu, atividade, setas, monitor) no mesmo traço 1,75; catálogo de 54.
- `ThemeModelPicker`/`ThemeModels`: três modelos (Claro, Escuro, Sistema) com rádios nativos e amostras fixas de cada paleta, também no `/design-system` (seção Layout Codex).

## L2 · Shell e navegação — implementado

- Lateral em grid (232 ↔ 76 px, transição de 180 ms) com marca empilhada (símbolo 38 px, texto 21 px), busca Ctrl K, grupos e rodapé; `aria-current`, ponto/contador, separadores na versão recolhida e **dicas** `role=tooltip` por foco ou ponteiro com `aria-describedby`, Esc/clique/scroll dispensam.
- Estado de apresentação pintado no `<head>` (mesmo script do tema, hash de CSP recalculado) e lido por `useSyncExternalStore`: alternar só muda um atributo — `main` não remonta (teste com rascunho digitado). Escolha manual persiste; sem escolha, recolhe até 1050 px e acompanha a janela.
- Até 600 px: a mesma árvore vira menu modal (`role=dialog`, `aria-modal`, foco no X, Tab contido, `inert` no conteúdo e na barra inferior, scroll travado, Esc/fundo/X fecham e o foco volta ao abridor depois que o fundo deixa de ser inerte). Barra inferior com os quatro primeiros módulos visíveis e Mais.
- Topbar: alternar lateral, breadcrumb, estado (Demonstração/Conta conectada), Tema nativo compacto (Claro/Escuro/Sistema, gravação na conta preservada), Atividade (quando permitida) e Capturar (quando permitido). Perfil e Sair no rodapé da lateral (popover), Ajuda sempre na lateral.
- `WorkspacePage` com h1 do módulo + subtítulo do protótipo e `actions` opcionais.

## L3A · Trabalho e conhecimento — implementado

- **Início:** cartão inverso “Em foco” (título 28 px, contexto, Concluir/Reabrir e Abrir tarefa) ao lado de “Seu ritmo hoje” (número 48 px, progresso segmentado, data, hábitos feitos e próximo compromisso); Tarefas de hoje (linhas ≥ 76 px, 3/5 por largura, Adicionar tarefa) e Na sua agenda (faixa da semana com `?date=…&view=day` e ponto só em dias com eventos); Pequenos hábitos, Pulso financeiro, Caixa de entrada e “Continue de onde parou”. Projeções novas com testes (`projectWeek`, `projectDayProgress`, `projectHabitsToday`, `projectRecentNotes`). Preservados `HomeTaskCommand` com envio incerto, privacidade financeira, blocos ocultos/negados sem consulta, skeleton/erro/vazio e a mesma coleção dos módulos.
- **J2 no celular (RECOMENDADO):** até 600 px o foco e o ritmo compactam e as linhas de tarefa têm 60 px. A 390 × 844, foco, ritmo (com hábitos e próximo compromisso) e as três primeiras tarefas terminam em 774 px, acima da barra inferior (776 px); a 412 × 915, em 748 px. O E2E `home.spec.ts` mede essa dobra. A 360 × 800 os títulos quebram e só duas tarefas cabem — limite registrado.
- **Capturar:** painel de escrita com dica lateral fixa; biblioteca em largura total com abas, busca e itens tipados; editor, anexos privados, wiki/backlinks, rascunhos, conversão com Desfazer e promoção sem mudança de lógica.
- **Tarefas:** filtros em barra, painel com linhas de 80 px, check à esquerda (Concluir/Reabrir/Restaurar) e menu de ações em ícone; colunas Tarefa · Projeto · Prioridade · Prazo · Estado; deep links, lixeira e drawer preservados.
- **Conhecimento:** cadernos em navegação lateral (faixa horizontal no celular), páginas em cartões inteiramente clicáveis, documento 30 px com prosa 16 px/1,8; TipTap e conflitos preservados.
- **Projetos:** grade de cartões com progresso calculado das tarefas reais e detalhe com hero e grade 1,2/1; associação de contêineres e lixeira preservadas.
- Desvios registrados: “Pulso financeiro” mantém o nome (contratos do Financeiro), data no cartão de ritmo, `.home-stats` ao fim do Início (harness #23), notas recentes vindas das capturas organizadas, Tarefas sem abas (select “Mostrar tarefas” exigido pelos harnesses), ações por item da Captura continuam no editor.

## L3B · Calendário e Integrações — implementado

- **Calendário:** barra de período (título 22 px, “ano · Semana N” ISO, setas de 44 px, Hoje, Dia/Semana/Mês/Lista com `aria-pressed`, botão Calendários quando a lateral some); lateral interna com minicalendário, campo de data, “Meus calendários” em checkboxes (contagem do período como descrição) e bloco Google; linha do tempo de 80 px/hora (07–21 h, expandida quando há eventos fora), dia inteiro em trilhas de 48 px com término exclusivo, conflitos em colunas de 50 px e eventos curtos `.is-short`/`.is-tiny` com nome acessível completo; Mês com 42 células e `+N compromissos`; **Lista** só na URL (`view=list`, janela mensal) — `default_calendar_view` continua day/week/month e nunca recebe `list`. Até 680 px qualquer visão vira agenda legível. Detalhe no Drawer de 460 px com data/hora em São Paulo, término exclusivo explicado e ações existentes (nota de reunião, Hábitos, Google, Relacionado). Cliques rápidos de navegação partem da última URL pedida (corrige clique perdido).
- **Integrações:** compõe pela rota a mesma gestão Google (`CalendarAccounts`, query `agenda`, `use-calendar-commands.ts` com OAuth cercado no logout e origem `accounts.google.com` conferida); conectado com até duas contas, fontes, Sincronizar, Reconectar e Desconectar/Retomar; demonstração honesta sem OAuth; sem permissão de Calendário não consulta a agenda.
- Desvios registrados: semanas do minicalendário como alvos de 44 px na largura toda (sete colunas de 44 px não cabem em 190–228 px), visão padrão sem preferência = Semana (igual ao default do banco), cores das fontes Google alternadas pela ordem com o nome sempre visível, faixa de dia inteiro não fixa.
- **Pendências:** “Criar tarefa relacionada” ao evento não existe como contrato real (lacuna da J5, exige issue própria); o retorno OAuth ainda leva a `/calendario?notice=` quando a conexão começa em Integrações; a seleção de fontes na demonstração não chega ao Início.

## L3C · Vida pessoal — implementado

- **Hábitos:** introdução “Pequenos passos. Mais presença.” com resumo do dia e barra da semana; grade semanal em tabela com setas de semana (sem passar da atual nem do início mais antigo), células de 44 px, hoje com borda dupla, estados feito/pode marcar/pausa/futuro/não previsto distinguidos por glifo e borda além da cor, nome acessível e motivo por `aria-describedby`; rolagem **interna** com primeira coluna fixa até 760 px. Preservados heatmap de 26 semanas, “Marcar um dia passado”, pausas globais/individuais com intervalo e motivo, arquivados com Restaurar, RelatedPanel e as regras do Núcleo (`canMark` intacto).
- **Financeiro:** barra Ocultar valores · Transferir · Novo lançamento; cinco abas segmentadas com `aria-current`; competência Anterior/Próximo; visão geral com patrimônio líquido, Plano do mês (soma dos orçamentos por categoria — não existe limite único no domínio), realizado da competência e lançamentos recentes em tabela que vira linhas até 760 px. Preservados contas/cartões, faturas, transferências, orçamentos, filtros/ordenação/página na URL, proteção contra resposta atrasada, máscara integral e lixeira/Desfazer.
- **Cofre:** estados bloqueado/criar/recuperar/trocar/kit em coluna centrada; aberto em lista de 290 px + detalhe (240 px até 1100 px, uma coluna até 760 px). Senha e nota continuam **mascaradas** (sem “Revelar”); usuário e endereço aparecem no detalhe como no protótipo, apenas na sessão decifrada no navegador. Cópia com limpeza em 30 s, auto-lock, kit, recuperação e diagnóstico de item ilegível preservados.
- **Configurações:** painéis Perfil, Aparência, Módulos, Calendários conectados (link para Integrações quando permitido), Dados da demonstração e Instalação. Na demonstração, Aparência usa os três modelos de tema; na conta conectada mantém o select “Tema da conta” + “Salvar aparência” para não gravar na conta a cada clique (contrato do harness #34).
- **Atividade:** linha do tempo “Movimentos do seu espaço” com paginação, erros de sessão e campos sanitizados preservados.
- Desvios registrados: rótulos Entradas/Saídas/Resultado e “Ocultar valores” na barra (exigidos pelos harnesses SQL do Financeiro), DataTable vira cartões em 767 px (limite da primitiva), células e abas de 44 px (protótipo 40 px).

## L4 · Compatibilidade — verificado

Auth (`/entrar`, `/trocar-senha`), Admin, Ajuda, `/sair`, `/offline`, `/compartilhar`, Drive e 404 do workspace renderizam com as primitivas novas, sem transbordo em 1440 e 390 px nos dois temas (capturas locais). Ajuste aplicado: cabeçalhos legados com `h1` + `p` diretos quebram o subtítulo. Lateral em janelas baixas esmaece a borda que ainda esconde itens, sem esconder o rodapé.

**404 fora do workspace:** rotas sem página fora do grupo `(workspace)` (ex.: `/rota-inexistente`) usavam o 404 padrão do Next, em inglês e sem tokens. Agora `src/app/not-found.tsx` responde 404 com a mesma moldura de `/offline` (marca, título, texto e “Voltar ao Início” com alvo de 44 px), coberto por E2E nos dois temas ([capturas](capturas/aplicacao/erro-404-escuro-expandida.webp)).

## L5 · Convergência, portões e aceite

### Condições

| Item | Registro |
|---|---|
| Commit avaliado | `dd9df4a` (código do app idêntico a `bb39b22`; o commit seguinte só altera documentação e hash de teste) |
| Modo | APP_MODE=demo, `next build` + `next start` locais; harnesses SQL locais descartáveis (PGlite/PostgreSQL local, sem schema remoto, reset ou seed) |
| Navegador | Chromium 1194 do contêiner (Playwright 1.63); CI do GitHub usa o Chromium instalado pelo Playwright |
| Fuso/locale | `America/Sao_Paulo`, pt-BR; dados fictícios da demonstração |
| Capturas | [`capturas/aplicacao/`](capturas/aplicacao/) (aplicação) e [`capturas/base/`](capturas/base/) (base `61d03c7`), WebP; medidas renderizadas em [`medidas.json`](capturas/aplicacao/medidas.json), geradas por [`capturar-evidencias.mjs`](capturar-evidencias.mjs) |

### Portões executados (local, `dd9df4a`/`bb39b22`)

| Portão | Resultado |
|---|---|
| `npm run typecheck`, `npm run lint` (sem o override local não versionado) | Aprovados, 0 avisos |
| `npm run test:timezones` | UTC 1804/1804 e São Paulo 1804/1804 |
| `node --test tests/scripts/*.test.mjs` | 1581/1581 |
| `npm run test:local-sql` | Aprovado; nenhum SQL remoto |
| `check:layers` / `check:design-system` / `check:impeccable` / `check:sql-editor` / `check:secrets` | 0 violações (383 módulos) / 164 pares / 0 registros / 19 migrations verificadas / 1607 arquivos sem segredo |
| `npm run build` (demo) + `check:client-auth` | Aprovados; 80 bundles públicos sem SDK, token ou segredo |
| E2E completo (`playwright test`, 291 testes, inclui harnesses SQL) | **289 aprovados**; 2 falhas de ambiente local: `issue22-visual-port-comparison` exige o binário do canal Chromium 1243 (ausente no contêiner) e `pwa.spec` recusa instalabilidade em contexto anônimo do Chromium completo. Ambos passam no CI da Fundação, que instala o navegador. |
| CI do GitHub | Ver checks do PR. `admin-browser-local` e `auth-recovery-local` falham com o mesmo `QUIESCENCE_HTTP_*_NO_RESPONSE_PENDING` já presente em `main` (`61d03c7`), acompanhado em #35. |

### Medidas renderizadas (52 capturas das 12 telas)

- **Transbordo:** zero em 1440/900/390 px, lateral expandida e recolhida, claro e escuro; zero nas 12 telas a 200% de zoom (720 px CSS em densidade 2).
- **Contraste:** 4130 pares de texto medidos no fundo efetivo (inclusive inverso, alfa e seleção); mínimo 4,80:1; nenhum abaixo do piso.
- **Alvos e campos:** nenhum alvo interativo abaixo de 44 × 44 px; nenhum campo abaixo de 16 px; nenhum erro de página.
- **Movimento reduzido:** transições do shell, da lateral e do diálogo em `0s`; recolher a lateral chega a 76 px imediatamente.
- **Teclado:** primeiro Tab no skip link, depois marca, busca e navegação; Ctrl K foca o campo da busca dentro do diálogo e Esc devolve o foco ao link de origem.

### Seis jornadas (doc 05)

| Jornada | Executado | Resultado | Limitação |
|---|---|---|---|
| J1 “Tive uma ideia” | `captures.spec`, `issue22-capture-persistence-sql`, `issue28-knowledge-sql`, `issue28-knowledge-conflict-sql`; sonda Início → Capturar → Salvar | Aprovados; conversão idempotente, promoção, TipTap e rascunhos íntegros. Sonda: 0,46 s do clique até “Salva nesta sessão” | Medida em demonstração (sessão), não persistência durável conectada; fila offline continua lacuna preexistente |
| J2 “O que é hoje?” | `home.spec` (inclui dobra a 390 × 844), `home-account-preferences`, `issue23-home-activity-sql`, `issue30-habits-sql` | Aprovados; foco, ritmo (hábitos e próximo compromisso) e três tarefas acima da barra inferior a 390 × 844 | A 360 × 800 só duas tarefas cabem — registrado para a frente #44 |
| J3 “Gastei / paguei” | `finance.spec`, `issue26-27-finance-sql`; sonda de toques | Aprovados; **2 toques** do Início ao formulário (“Ir aos lançamentos” → “Novo lançamento”) | Digitação do lançamento não contada |
| J4 “Onde está aquilo?” | `search.spec`, `issue33-search-sql`, `knowledge-workspace` | Aprovados; Ctrl K, setas/Enter, rotas profundas e recusa de conta encerrada | — |
| J5 “Reunião de amanhã” | `calendar-layout`, `calendar-google`, `calendar-timeline`, `calendar-workspace-browser` (inclui Integrações conectada no harness) | Aprovados; Dia/Semana/Mês/Lista, minicalendário, fontes, término exclusivo e a mesma gestão de contas em Integrações | “Criar tarefa relacionada” ao evento não existe como contrato real; conta Google real não exercitada |
| J6 “Preciso da senha do banco” | `vault.spec`, `issue31-vault-sql` | Aprovados; criptografia, kit, recuperação, cópia com limpeza em 30 s e auto-lock | Leitor de tela não exercitado |

### Pendências explícitas

- Validação em aparelhos físicos, leitor de tela e conta Google real.
- “Criar tarefa relacionada” ao evento (J5) e fila offline (J1): lacunas de contrato preexistentes, fora deste lote.
- Retorno OAuth para `/calendario?notice=` quando a conexão começa em Integrações.
- `admin-browser-local` e `auth-recovery-local` vermelhos também em `main` (#35).
- Intermitência de `password-change` no harness Auth local depois do L3B (POST `/entrar` abortado em `old-password-denied`; verde no HEAD `2176fb3`): investigar com Docker e trace do Playwright.

### Decisões do mantenedor (18/10/2026)

- **J2 no celular:** a referência de aceite é 390 × 844, onde foco, ritmo e três tarefas ficam acima da barra inferior. O limite de 360 × 800 (duas tarefas acima da dobra) foi **aceito**.
- **Cofre aberto:** usuário e endereço **permanecem visíveis** no detalhe, como no protótipo, apenas na sessão decifrada no navegador; senha e nota seguem mascaradas, sem Revelar.
- **Merge:** o PR #48 foi autorizado com `admin-browser-local` e `auth-recovery-local` vermelhos, falha que também ocorre em `main` (#35).
- **Pendências funcionais** (J5 “Criar tarefa relacionada”, fila offline da J1 e retorno do OAuth para Integrações) seguem para trabalho posterior, com issues e PRs próprios.
