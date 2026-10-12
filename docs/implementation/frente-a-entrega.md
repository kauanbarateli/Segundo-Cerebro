# Frente A — entrega offline (12/10/2026)

Construção e validação local da Frente A definida em [handoff-duas-frentes-mvp-20261012.md](handoff-duas-frentes-mvp-20261012.md). Nenhum serviço real foi acessado: sem Supabase, Vercel, Google, SMTP, Sentry, Auth/GoTrue, runners nativos, migrations ou contas. Dados são sintéticos (`*.invalid`, UUIDs `68…`/`69…`, datas fixas de 2026). A raiz (Frente B) valida o que depende de conexões e revisa esta PR.

| Item | Valor |
| --- | --- |
| Base | `origin/main` @ `1f1f568010031f4cd59bd7ad39c783766e4c2071` |
| Branch | `codex/mvp-construcao-offline` |
| Código verificado | `1b69cc1bee9fa184177b80839d7edae7a238f227` (o commit seguinte acrescenta só este relatório) |
| Ambiente | Windows 11, Node 25.9.0 (engines `>=22.13 <26`; `.nvmrc` indica 24), `npm ci --no-audit` do lockfile, Playwright 1.63/Chromium 1243, checkout isolado fora da raiz |
| Build/E2E | `APP_MODE=demo` apenas no processo; servidor do Playwright na porta própria 3100 |

## 1. Matriz por issue

| Issue | Implementado | Validado localmente | Pendente da raiz (B) |
| --- | --- | --- | --- |
| [#32](https://github.com/kauanbarateli/Segundo-Cerebro/issues/32) Google | Prova interativa do `CalendarWorkspace` original montado ([spec](../../tests/e2e/calendar-workspace-browser.spec.ts), [fixture](../../tests/e2e/fixtures/calendar-workspace-browser.tsx)). Correções: título da Semana com o intervalo visível; capitalização só da inicial; título antes dos controles no mobile; respiro do dia atual; link "Preferências da agenda" para a seção existente `#lembretes` (antes `#agenda`, inexistente). | Dia/Semana/Mês e navegação pelos controles reais com URL coerente; evento de três dias em 9, 10 e 11/10 nas três visões e ausente em 12/10 (fim exclusivo), com o navegador em Tóquio; evento das 22:00 de São Paulo no dia 7; um único `calendar.sync` ao sair da janela (27/07–07/09), união da janela e snapshot atualizado sem novo documento; nenhum sync dentro da janela; conta recém-conectada (`window: null`) sincroniza o período visível uma vez; recusa 429 com `Retry-After` sem laço e repetição apenas pelo botão. | OAuth/PKCE, revogação, provider real, paginação/410, persistência e expansão com eventos reais; cron. A prova sintética demonstra UI/contrato, não o provedor. |
| [#34](https://github.com/kauanbarateli/Segundo-Cerebro/issues/34) Configurações | Correções no workspace conectado: campo de avatar não transborda; links internos com alvo ≥44px; Subir/Descer com rótulo visível; textos de Meus dados unidos. | Matriz 320/390/768/1440 × claro/escuro com movimento reduzido sobre Shell/Settings/providers originais ([spec](../../tests/e2e/settings-sessions-matrix.spec.ts)); portões de transbordo/alvo/campo limpos; falha e nova tentativa de `/api/settings` pelo teclado; Sessões recolhe e reabre pelo teclado; seletor de tema com espaço para "Sistema". | Executar `issue34-settings-sql.spec.ts` em Linux (guard preservado; helper extraído e nome "Subir Conhecimento" atualizado); tema entre aparelhos, avatar real, troca de senha e revisão humana. |
| [#37](https://github.com/kauanbarateli/Segundo-Cerebro/issues/37) Sessões | Foco volta a "Tentar novamente/Atualizar sessões" ao fim da leitura; texto redundante removido. | Carregando (status/aria-busy/esqueleto oculto), falha com alerta, nova tentativa por teclado com queda de foco afirmada e retorno ao fim da leitura, lista com nulos e instantes UTC→São Paulo, cem sessões com truncamento factual, sessão trocada (401 e 409) com "Entrar novamente" e sem repetição automática. Troca de conta e desmontagem continuam cobertas pelo vitest existente. | Identidade/cookies/endpoint/SQL, isolamento entre contas, BLOCK/FIRST e os cinco aceites conectados. |
| [#12](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12) PWA | Seletor de tema do cabeçalho móvel sem corte; rótulos da barra inferior hifenizados. | `pwa.spec.ts` 4/4 (instalabilidade do Chromium, SW/offline, share target, convite); portões visuais nas 19 rotas. | Instalação e uso em Android/iOS físicos com capturas. |
| [#35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) Release | Auditoria Impeccable local (§3) com correções medidas; remoção dos slogans genéricos de rota. | Detector 0 achados; 32 specs E2E não restritos a Linux; capturas das seis jornadas em 390/1440 × claro/escuro. | Seis jornadas em desktop/iPhone reais, leitor de tela, backup/restore e demais critérios de produção. |

Nenhuma migration, SQL, transporte, Auth, API, workflow ou segredo foi alterado. Drive continua fora do MVP e não foi tocado.

## 2. Comandos e resultados reais

Executados em sequência no SHA `1b69cc1`, sem outros processos de teste concorrentes:

| Comando | Resultado |
| --- | --- |
| `APP_MODE=demo npm run build` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, zero avisos |
| `npm run check:layers` | 332 módulos, 1.342 dependências, 0 violações |
| `npm run check:design-system` | 164 pares de contraste aprovados; runtime usa tokens |
| `npm run check:secrets` | 1.302 arquivos versionáveis; nenhum valor impresso |
| `npm run check:impeccable` | engine 0.1.6, 0 achados em `src` |
| `APP_MODE=demo npm run check:client-auth` | 79 bundles públicos sem SDK, tokens ou segredos |
| `npm run test:timezones` | UTC e America/Sao_Paulo: 116 arquivos e 1.756 testes em cada fuso, exit 0 |
| `npx --no-install playwright test` com os 32 specs sem guard Linux | 212 passed (4,1 min) |
| `git diff --check 1f1f568 HEAD` | exit 0 |

Specs novos: `calendar-workspace-browser.spec.ts` (4 testes) e `settings-sessions-matrix.spec.ts` (12). Os 32 specs incluem os PGlite em memória sem guard (`issue22-capture-persistence-sql`, `issue23-home-activity-sql`, `issue28-knowledge-sql`, `issue30-habits-sql`).

Registros de execução:

- Linha de base em `1f1f568`, antes de qualquer alteração: build demo exit 0; `calendar-google` + `calendar-timeline` 10/10; `visual-guards` + `pwa` 15/15; `check:impeccable` 0 achados. Os portões demo não montam o workspace conectado de Configurações, por isso não viam o transbordo do avatar.
- Estabilidade: `calendar-workspace-browser.spec.ts --repeat-each=3` passou 9/9 antes da rodada de revisão.
- Prova de reprodução: com `workspace-shell.css` e `own-sessions-section.tsx` da base, as asserções do seletor de tema (54px úteis para 59,5px de "Sistema") e do retorno de foco falham; com as correções, passam.
- Durante o desenvolvimento, uma passada de `test:timezones` teve um timeout de 30 s em `tests/ui-contract.test.ts` (ESLint programático) enquanto `npm run lint` rodava em paralelo; a reexecução isolada e a sequência final passaram.
- Não executados por não pertencerem ao diff ou por serem de B: `test:scripts`, `test:local-sql`, `check:sql-editor`, `test:auth-live`, `test:rate-limit`, configs `playwright.*-local`, os 8 specs com guard Linux e qualquer workflow manual.

## 3. Auditoria Impeccable local

Setup conforme `.agents/skills/impeccable/SKILL.md`: engine 0.1.6 obtido pelo próprio `npm run check:impeccable` (download fixado com verificação SHA-256, cache em `work/`), `impeccable context` carregado, briefs `calendario`, `configuracoes` e `pwa` lidos (sem `primaryTarget`, lidos diretamente), referências audit, polish, operate, distill, clarify e craft-floor. Modo Operate. Inspeção em lote (390/1440 × claro/escuro, movimento reduzido, demo local e fixtures conectados) e uma rodada de confirmação.

| # | Dimensão | Nota | Achado principal |
| --- | --- | --- | --- |
| 1 | Acessibilidade | 3 | Foco perdido quando um botão é desabilitado durante a operação (corrigido em Sessões; padrão sistêmico restante) |
| 2 | Desempenho | 3 | Cada sync gera duas leituras do snapshot além do resultado já recebido |
| 3 | Responsivo | 3 | Transbordo de 430px em Configurações conectadas a 320/390px (corrigido) |
| 4 | Temas | 4 | Somente tokens; 164 pares aprovados; claro e escuro sem achados nas capturas |
| 5 | Integridade | 3 | Slogans de rota fora do protótipo e "demonstração" na conta conectada (corrigidos) |
| **Total** | | **16/20** | Bom; dimensões 1–3 com resíduos registrados abaixo |

**Integridade da implementação:** aprovada. O detector não aponta achados em `src`; DS 2.1 (Geist, monocromia, tokens) é coerente. Os desvios verificados eram de cópia/estrutura, não de sistema visual.

### Corrigido nesta PR (reproduzido antes, medido depois)

| Sev. | Achado | Local | Prova |
| --- | --- | --- | --- |
| P1 | `input[type=file]` do avatar com 361px empurrava o documento para 430px em 320/390px | `settings.css` | matriz de Configurações: portão de transbordo limpo em 320/390 |
| P1 | Foco no `BODY` após "Tentar novamente" pelo teclado, sem retorno | `own-sessions-section.tsx` | antes: foco no `BODY` ao fim da leitura em 8/8 combinações; depois: `toBeFocused` nas 8 |
| P2 | Link "Perfil" com 37,6 × 44px | `settings.css` | portão de alvo limpo em 1440 |
| P2 | Subir/Descer anunciavam a chave interna ("Subir calendario") | `settings-connected-workspace.tsx` | todos os nomes iniciam pelo rótulo visível |
| P2 | Âncora `#agenda` inexistente no link do Calendário | `calendar-workspace.tsx` | `href=/configuracoes#lembretes` |
| P2 | Título da Semana mostrava só o dia âncora | `calendar-workspace.tsx` | "5 – 11 de outubro de 2026" |
| P2 | `capitalize` gerava "Quarta-Feira, 7 De Outubro" | `calendar.css` | `text-transform:none` e `::first-letter` maiúscula |
| P2 | "Sistema" cortado no seletor de tema móvel (56px úteis, 60px de texto) | `workspace-shell.css` | padding 12px; texto inteiro |
| P2 | Slogan genérico em todas as rotas; Capturar com dois subtítulos; "desta demonstração" na conta conectada | `workspace-page.tsx` | só o `h1` e os subtítulos factuais de cada módulo (decisão abaixo) |
| P3 | Período no mobile com título entre botões quebrados em duas linhas | `calendar.css`/`.tsx` | título primeiro (também no DOM), controles em uma linha |
| P3 | Quebra "Conheciment\|o" na barra inferior | `workspace-shell.css` | `hyphens:auto` em pt-BR |
| P3 | Frase tautológica sobre renovação e linha redundante em Sessões | `own-sessions-section.tsx` | removidas |

**Decisão de cópia (slogans de rota).** O doc 14 prevê subtítulo de 14px sob o título, e o protótipo o usa com dados factuais ("7 abertas · 1 atrasada…", "22 – 28 de setembro · 2 contas Google…"). As frases de `WORKSPACE_ROUTES.description` não vêm do protótipo, repetiam o subtítulo próprio de Capturar e afirmavam "demonstração" em Configurações e Admin na conta conectada. Seguindo o pedido do mantenedor por uma interface minimalista, sem rótulos genéricos, `WorkspacePage` deixou de exibi-las; o espaço do subtítulo continua com os textos factuais de cada módulo (Início, Capturar, Financeiro…). As descrições seguem como palavras-chave da busca de atalhos (`filterRoutes`). Ajuda, Atividade e Sair têm cabeçalhos próprios e não foram alterados. É uma decisão de apresentação para a revisão da raiz, não um defeito medido por portão.

### Registrado, não alterado

- **P2 — foco em botões desabilitados durante operação.** `Button` usa `disabled` em `loading`, e vários fluxos usam `disabled={busy}` (por exemplo "Sincronizar período" e os "Salvar …" de Configurações). O Chromium move o foco para o documento. A correção adequada é no primitivo ou em um padrão comum (`aria-disabled` com bloqueio do clique, ou retorno de foco); mexer no primitivo afeta todas as telas e pede revisão própria.
- **P2 — leituras redundantes após `calendar.sync` (diagnóstico para B).** O resultado do comando já é um snapshot validado; mesmo assim `executeDomainCommand` invalida `agenda` e o `finally` de `send` chama `refreshActive()`. O rastro sintético registrou 1 POST seguido de 2 GET `/api/calendar` (e 1 GET de capturas). Cada GET passa por `repo.quota("api")`. Decidir se o refresh do `finally` deve ocorrer só na falha envolve cota e transporte; não alterado.
- **P3 — datas técnicas.** O detalhe do evento e "Sincronizada em" usam `2026-10-09 às 00:00`, enquanto o restante do Calendário usa datas por extenso.
- **P3 — busca.** O diálogo explica Ctrl/Cmd + K também no celular e repete contexto em três linhas antes do campo.
- **P3 — demo.** A Home demo repete "dados de exemplo" no rodapé da página e no da moldura.
- **Fato, não defeito:** o estado "Nenhuma sessão" do painel é inalcançável pelo leitor real (`validOwnSessionsView` exige ao menos a sessão atual); a matriz não o força.
- Drive continua no trilho (D-032 não pediu remoção da navegação); fora do escopo.

### Jornadas (doc 05 §3), dados de exemplo da demo local

| Jornada | Superfície auditada | Resultado |
| --- | --- | --- |
| 1. Tive uma ideia | Capturar 390/1440 | Subtítulo duplicado removido; editor e biblioteca sem achados mecânicos |
| 2. O que é hoje? | Início 390/1440 | Hierarquia preservada; slogan removido; repetição demo registrada |
| 3. Gastei / paguei | Financeiro 390/1440 | Sem achados mecânicos; slogan removido |
| 4. Onde está aquilo? | Busca 390, Conhecimento | Cópia do diálogo registrada (P3) |
| 5. Reunião de amanhã | Calendário demo e conectado sintético | Correções acima; vínculo com nota real depende de B |
| 6. Preciso da senha do banco | Cofre 390/1440 | Sem achados mecânicos; `vault.spec.ts` aprovado |
| PWA | `/offline`, `/compartilhar`, instalação | Sem achados; instalação física pendente |

## 4. Limites

- Portas HTTP sintéticas reproduzem as regras do Núcleo (`defaultWindow`, `unionWindow`, `validWindow`), o formato do snapshot SQL (linhas já sincronizadas ordenadas por `starts_at,id`, sem filtro de janela, `window` nula antes do primeiro cursor) e as validações do cliente conectado, mas não certificam rota Next, Auth, cookies, RPC, provider Google, cota ou persistência.
- "Sem reload" foi provado com o `router.replace` do fixture (mesmo documento, marcador em memória, nenhuma nova navegação). No Next real, trocar `date`/`view` faz navegação suave com requisição RSC e nova execução de `authorizeWorkspaceFeature`; isso não foi exercitado e pertence à validação conectada.
- A asserção de espaço do seletor de tema considera cerca de 20px para a seta nativa do Chromium (INFERIDO, medido nesta máquina).
- Somente Chromium em Windows. Sem Safari/iOS, Android, leitor de tela real ou aparelho físico. Emulação de viewport e `colorScheme` não equivale a aparelho.
- `issue34-settings-sql.spec.ts`, `issue22-visual-port-comparison.spec.ts` e os demais seis specs com guard Linux não foram executados (sem Linux, WSL ou Docker disponível). Guards não foram alterados nem contornados.
- A remoção do slogan muda texto/altura de `.shell-page-heading` e a posição vertical do conteúdo. No `issue22` esses campos são `review-required`, não `shared-contract`; nenhuma violação contratual é esperada, mas o relatório precisa de revisão.
- Capturas e rastros ficam em `test-results/` e `work/` (ignorados); são reproduzíveis pelos specs.

## 5. Checklist da validação conectada restante (B)

- [ ] Revisar a PR e os resultados automáticos do CI no SHA da PR (sem herdar contagens).
- [ ] Linux: `npx --no-install playwright test tests/e2e/issue34-settings-sql.spec.ts` (helper extraído; nome "Subir Conhecimento").
- [ ] Linux: `npx --no-install playwright test tests/e2e/issue22-visual-port-comparison.spec.ts` e revisar os deltas de `.shell-page-heading`.
- [ ] Linux: specs `issue26-27-finance-sql`, `issue28-knowledge-conflict-sql`, `issue28-knowledge-tree-sql`, `issue30-projects-sql`, `issue31-vault-sql`, `issue33-search-sql`.
- [ ] #32: OAuth/PKCE/AAD, até duas contas, revogação/desconexão, expansão de janela com eventos reais sem reload, filtro no Início/lembretes, cron e registro Admin.
- [ ] #32: decidir sobre as leituras redundantes após sync (cota `api`).
- [ ] #34: tema escolhido no desktop aparecendo no celular, avatar assinado/re-encode/remoção, troca de senha, painéis mobile em aparelho.
- [ ] #37: endpoint/SQL/identidade, isolamento entre duas contas (uma master), BLOCK/FIRST com limpeza.
- [ ] #12: instalação Android e iOS físicos com capturas.
- [ ] #35: seis jornadas em desktop e iPhone reais com teclado/leitor/movimento reduzido; backup cifrado e restore descartável.
- [ ] Decidir o padrão de foco para botões desabilitados durante operação (primitivo `Button`).
