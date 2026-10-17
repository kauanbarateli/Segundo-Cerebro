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
