# A — Diagnóstico do projeto atual (`segundo_cerebro`)

**Data:** 23/09/2026 · **Base:** working copy local = `git@github.com:kauanbarateli/segundo_cerebro.git`, `main` @ `ffdf064` e `origin/v2-interface-e-financeiro` @ `a9422bc` · **Método:** leitura de código por cinco frentes paralelas (banco, módulos, segurança, UI/qualidade, docs/história) + Impeccable v4.1.0 em clone de trabalho. Nada foi executado contra banco, Vercel ou APIs externas; nada foi escrito no repositório. Evidências no formato `caminho:linha`, relativas à raiz do repo. O que não pôde ser confirmado está marcado **não verificado** (consolidado no §11).

---

## 1. Sumário executivo

**O projeto está muito além do que o prompt de planejamento descrevia.** Não é um protótipo pausado em "testes com Google": é um produto funcional com **14 rotas de módulo**, 42 tabelas com RLS por dono desde o primeiro dia, Cofre com criptografia de conhecimento zero, integração Google Calendar (leitura, 2 contas, tokens cifrados), integração ClickUp (9 operações fechadas por construção), e-mail semanal de métricas, área administrativa com papéis, Design System 1.0 próprio e documentado, ~780 testes unitários na main (841 na v2), 5 fluxos e2e e CI com 9 portões.

**A qualidade de engenharia é o maior ativo.** O código registra o *porquê* ao lado de cada decisão, tem guardas por varredura de texto (testes que impedem regressão de invariantes), contratos de camadas executáveis (dependency-cruiser) e docs internas por módulo. O detector determinístico da Impeccable (61 regras) encontrou **zero violações reais** nas duas branches.

**Os problemas são de três naturezas:**
1. **Bifurcação não resolvida** — `main` e `v2-interface-e-financeiro` divergiram em paralelo no Financeiro e **nenhuma contém a outra** (§2.3); as migrations `0023` conflitam entre si.
2. **Defeitos e lacunas pontuais** — reais, mapeados e em geral pequenos (ex.: editar tarefa reseta o status; sem logout no celular; falha de leitura vira tela vazia) (§5.2).
3. **Incerteza operacional** — não há registro de quais migrations foram aplicadas no banco real, a CSP está em Report-Only, o ClickUp nunca falou com a API real, e o bloqueio administrativo pode ser revertido pelo próprio bloqueado (§6).

**Distribuição:** não existe PWA (sem manifest, sem service worker) — o requisito "Web App + app instalável" da nova versão parte do zero nesse aspecto.

⚠️ **Alerta imediato (independe da reconstrução):** os segredos reais do servidor (`SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_SECRET`, `CRON_SECRET`) vivem em `.env.local` **dentro de pasta sincronizada pelo OneDrive** — exatamente o que `scripts/backup.ps1:18-35` proíbe para o dump do banco, pelo mesmo motivo. Detalhe no §6.1.

---

## 2. Identificação, história e branches

### 2.1 Linha do tempo

52 commits na main (02/08 → 09/08/2026) + 13 na v2 (13–14/08). Autor único (duas identidades do mesmo e-mail). O plano da v2 cita caminho Linux (`/home/kauan-sousa-barateli/...`) — a v2 foi feita em outra máquina (inferência).

| Fase | Quando | O que entrou |
|---|---|---|
| 0 | 02/08 | **V1 em um único snapshot** (`96a8cf4`, 145 arquivos, +42k linhas): Início, Capturar, Tarefas+Kanban, Calendário Google, Cofre, Financeiro, Drive, Conhecimento, Vínculos, notificações, links sociais, módulos ligáveis, Configurações, login — migrations 0001–0013 |
| 1 | 02/08 | Endurecimento pré-deploy: kit de recuperação do Cofre, 0014 fecha `anon`, 0015 rotação de chave, CSP, CI |
| 2–3 | 03–04/08 | ClickUp (6 fases), busca real, e-mail semanal + crons, Hábitos, Projetos |
| 4–5 | 05–06/08 | Correções de integração; **Design System 1.0** (`c91e88b`) e **reversão da tipografia** (`15931d6` — "o resto do DS 1.0 fica") |
| 6 | 08/08 | Fuso (`tempo.ts`), Sentry enxuto, captura com imagem, **multiusuário/papéis/admin** (0021), e2e |
| 7 | 08–09/08 | Financeiro na main: cartão/fatura/rotativo (0022), pagamento parcial (0023), recorrência `serie_tipo` (0024) |
| 8 | 13–14/08 | **Branch v2**: responsividade global, Financeiro em 5 telas, regressão com massa controlada, auditoria |

Último fetch registrado: 17/08 (`.git/FETCH_HEAD`) — o estado do GitHub depois disso é **não verificado**.

### 2.2 Lições que o próprio histórico registra (herdar na nova versão)

- **Build verde não prova que a tela carrega** (`e98de5b`: Conhecimento caía com `tsc` limpo).
- **O fuso do servidor é UTC** e defeitos de data se escondem em máquina local (`d0cf9e4`, `docs/datas-e-fuso.md`) — rodar a suíte com `TZ=UTC`.
- **Server Action é endpoint HTTP** — a guarda vai na action, não no componente (invariante repetida em ClickUp, admin e cartão).
- **Derivar em vez de gravar estado que muda com o tempo** (status de fatura, falha de hábito) — evita cron e dessincronização.
- **Guardas por varredura de texto** (testes que leem o fonte) seguram invariantes que tipo nenhum expressa.
- **Testes unitários com fixtures mínimas não pegam defeitos de interação** — os 813 testes passavam com R1/R2 presentes; foi a massa controlada de 18 lançamentos cruzados que os achou (`src/lib/regressao-financeira.test.ts`, v2).

### 2.3 A bifurcação main × v2 (achado central)

A v2 saiu de `87f1ee2` e a main continuou até `ffdf064`. O merge final da v2 (`a9422bc`) registra `ffdf064` como mesclado, mas **a árvore resultante é idêntica à do commit anterior** (`git diff 8a9f209 a9422bc` vazio) — o conteúdo do último commit da main foi descartado. Resultado:

| Capacidade (Financeiro) | main | v2 |
|---|---|---|
| Pagamento parcial de fatura (`paid_cents`, `payTransaction`) | ✅ (0023_pagamento_parcial) | ❌ |
| Recorrência/parcelamento por coluna (`serie_tipo`) + doc `recorrencia-e-divida.md` | ✅ (0024) | ❌ |
| Horizontes "Dívida × Compromissos × Total previsto" | ✅ | ❌ |
| `status` de 5 estados, exclusão lógica com "Desfazer", duplicar | ❌ | ✅ (0023_financeiro_v2) |
| Busca/filtros/paginação/ordenação com estado na URL | ❌ | ✅ |
| Plano do mês, faixas 80/100, estorno abatendo orçamento | ❌ | ✅ |
| 5 telas separadas (2.302 linhas → 207 no shell) | parcial (quebra própria) | ✅ |
| Teal escopado (`--sb-fin-*`), Drawer/BottomSheet/DataTable/Tooltip | ❌ | ✅ |
| Safe-area, menu mobile 4+1, `.rola-x`, e2e 320/768 | ❌ | ✅ |
| Regressão com massa controlada + `regras-do-projeto.test.ts` | ❌ | ✅ |

**As duas `0023` criam gatilhos diferentes na mesma tabela** (`trg_finance_tx_pagamento` × `trg_finance_tx_status_pagamento`); aplicadas ambas, ficam dois gatilhos `BEFORE` concorrentes — o cenário que os próprios arquivos dizem evitar. A v2 ainda modela recorrência de forma **oposta** à main (tabela `finance_recurrences` planejada × coluna `serie_tipo` com recusa explícita de tabela). Qual modelo vale — ou se os dois se fundem — é a **Q1** da rodada 1; o que está aplicado no banco real é a **Q2**.

A v2 tem docs próprios de altíssimo valor: `PLANO-V2-INTERFACE-E-FINANCEIRO.md` (1.967 linhas) e `DIVERGENCIAS-REQ-FIN.md` (13 divergências decididas + 2 defeitos R1/R2 + auditoria). O requisito de origem (`PLANEJAMENTO-FINANCEIRO-V2.md`, "REQ-FIN") **não está versionado nem no disco** (Q5).

---

## 3. Stack e arquitetura

| Camada | Escolha | Evidência |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript estrito | `package.json:35-37` |
| Estilo | Tailwind 3.4 + tokens CSS próprios (`--sb-*`) | `tailwind.config.ts`, `src/app/globals.css` |
| Dados | Supabase (Postgres + Auth + Storage), Server Actions como "API"; só 6 rotas `/api` (5 Google + métricas) | `src/app/api/**` |
| Validação | Zod centralizado com tetos e datas no fuso do app | `src/lib/validation.ts` |
| Editor | TipTap 3 com lowlight, carregado sob demanda | `EditorLoader.tsx` |
| Observabilidade | Sentry com init dinâmico e allowlist de campos | `instrumentation*.ts`, `src/lib/observabilidade.ts` |
| Qualidade | Vitest, Playwright, dependency-cruiser (6 regras), knip, CI 9 portões | `.github/workflows/ci.yml` |
| Deploy | Vercel + 2 crons (sync 05:00 UTC diário; e-mail seg 11:00 UTC) | `vercel.json:3-12` |

**Padrões estruturais:** `src/lib/data.ts` (1.790 linhas) é a camada única de leitura do servidor (`server-only`), com `cache()` do React, leitura em lote anti-N+1 e paginação para somas — mas concentra todos os domínios num arquivo. Três clientes Supabase com papéis claros (`client`/`server`/`admin`); a service role só em código de servidor, com regra de camadas que impede import por componentes. **Realtime não é usado**; não há WebSocket. Fonte: Inter via `next/font` (`src/app/layout.tsx:14`).

**Fricções conhecidas do ambiente:** OneDrive corrompia o `.next` (`df57ccc`), Node local 25 × engine 24, knip bloqueado pelo App Control do Windows.

---

## 4. Banco de dados (resumo — ER completo irá no doc 06)

**42 tabelas, 2 views, 11 enums, 20 funções, 68 triggers, 151 policies + 8 de storage, 2 buckets privados** (`avatars` 2 MiB; `drive` 50 MiB, upload direto do navegador e leitura só por URL assinada).

- **RLS em 100% das tabelas**, padrão uniforme "dono" (`(select auth.uid()) = user_id`, 4 policies por tabela). Tabelas de segredo (`google_oauth_credentials`, `clickup_credentials`): RLS ligada **sem nenhuma policy** + grants revogados → só service role. `anon` fechado pela 0014.
- **Dinheiro:** `bigint` em centavos, sinal pelo `kind`, última parcela absorve arredondamento. **Fatura não é tabela**: é `statement_month` gravado na escrita + status derivado na leitura (`credit.ts`). Transferência = 2 pernas com `transfer_group_id`. Parcelamento/recorrência = N linhas com `installment_group_id` (+ `serie_tipo` na main).
- **Cofre:** servidor guarda apenas chave embrulhada (Argon2id m=64MiB/t=3) + payloads AES-GCM; kit de recuperação em duas metades com autoverificação byte a byte.
- **Boas fundações para crescer:** `key_id`/`crypto_version` (rotação), `watch_*` (push Google), canal em `notification_deliveries`, trigger genérico de vínculo, subcategorias e `currency` já no schema.
- **Fragilidades de schema/processo:** migrations 0014–0021 sem transação e não idempotentes, aplicadas à mão e **sem registro do que foi aplicado** (commits marcam "NÃO aplicada"; um diz "sem acesso ao banco, como sempre"); `database.types.ts` escrito à mão e parcial (33/44 objetos), clientes sem o genérico `Database`; checagem de dono cruzado por trigger em algumas FKs e ausente em outras (`task_tags`, `finance_transactions.account_id`, etc.); soft delete sem padrão (`deleted_at` × `archived_at` × status × delete real); auditorias de Cofre/Financeiro **editáveis pelo próprio dono** (contradiz `0013:58-59`); `deleteAccount` órfã a outra perna de transferências; e-mail semanal classifica transferência por `kind='transfer'` que nunca é gravado (`api/metrics/email/route.ts:163-177` — pernas entram como receita/despesa).
- **Estrutura sem uso:** `tags`/`task_tags`, `notification_deliveries`, `push_subscriptions`, `watch_*`, `finance_categories.parent_id`, `profiles.timezone`, `currency`, papel `admin`.

---

## 5. Funcionalidades por módulo

### 5.1 Classificação (critérios do planejamento)

| Módulo | Estado | Pendência principal |
|---|---|---|
| Início | **Funcionando** | "hoje" junta concluídas de dias anteriores; ignora módulos desligados; "Cérebro em ordem" calcula em UTC |
| Capturar (+imagem) | **Funcionando** | primeira imagem sem gatilho visível no celular; não edita anexos depois; "Lembrete" sem data |
| Tarefas | **Funcionando** (defeito de integridade) | **editar reseta status para "A fazer"** (form sem campo; `validation.ts:185` + `tarefas/actions.ts:84`); Kanban com cópia não sincronizada (`TaskBoard.tsx:51`); mobile sem arquivar/excluir |
| ClickUp | **Incompleta** | **nunca validado contra a API real**; contrato na tela desatualizado (diz que não muda prazo; muda — `capabilities.ts:95-112`); reconexão sem saída quando o token invalida |
| Calendário | **Funcionando** (dep. credenciais) | janela fixa −31/+180 sem refetch; evento multi-dia só no 1º dia; calendários desmarcados vazam no Início/lembretes |
| Cofre | **Funcionando** | item que não decifra some em silêncio; `logAudit` é action pública sem Zod; sem gerador de senha/limpeza de clipboard |
| Conhecimento | **Funcionando** (módulo mais maduro) | sem lixeira; busca sem trecho no resultado |
| Drive | **Funcionando** | excluir pasta é definitivo (`deleted_at` de pasta nunca preenchido); `moveFolder` sem tela; cota 1 GB fixa no código |
| Financeiro | **Funcionando** — bifurcado | main × v2 (§2.3); na main, aba/ocultar não persistem |
| Hábitos | **Incompleta** | pausas e marcação de dia passado existem no backend **sem tela**; sequência limitada à janela carregada (30/90 dias → números divergem entre telas) |
| Projetos | **Funcionando** | sem restaurar; cadernos/pastas/capturas não abrem a partir do projeto |
| Vínculos | **Funcionando** | itens relacionados não são clicáveis; só 3 tipos (sem página/arquivo/projeto) |
| Admin | **Funcionando** | papel `admin` não concede nada; sem excluir usuário/reset de senha; `perPage:200` sem paginação |
| Configurações | **Funcionando** (parcial) | tema só no navegador (coluna `theme` órfã); `updatePreferences` sem chamador; push inexistente |
| Ajuda | **Incompleta** | placeholder (3 itens; não lista atalhos) |
| Login | **Funcionando** | sem "esqueci a senha"; `redirectedFrom` ignorado |
| Busca | parcial | slot no cabeçalho + filtro real só em Tarefas; full-text só no Conhecimento; **não há busca global** |

### 5.2 Defeitos transversais de maior impacto

1. **Falha de leitura vira tela vazia**: nenhum loader de `data.ts` checa `error` (única exceção `:1137`) — erro de RLS/rede aparece como "Nenhuma tarefa aqui". `lerTudoPaginado` ainda devolve **soma parcial** em erro no meio (`:1138`), o "corte silencioso" que o próprio comentário diz evitar.
2. **Sem logout no celular** — `signOut` só existe na sidebar, oculta abaixo de `md` (`AppSidebar.tsx:343`, `:125`).
3. **Desligar módulo só esconde a tela**: Início continua mostrando dados do módulo desligado; nenhuma action confere o módulo.
4. **`/ajuda` inalcançável no celular** com ≤5 módulos ativos (o botão "Mais" some — `MobileNavigation.tsx:207`).
5. **Fuso residual**: rótulos "Hoje/Amanhã" e "Cérebro em ordem" usam a meia-noite do processo (UTC na Vercel) — a classe de bug que `tempo.ts` foi criado para matar.
6. Mensagens cruas do Postgres chegam ao usuário em alguns caminhos (`tarefas/actions.ts:59`; `cofre/actions.ts:95…`).

---

## 6. Segurança

### 6.1 ⚠️ Alerta operacional imediato

Os planos locais não versionados afirmam que `SENHA_MESTRA` e `KIT_DE_RECUPERACAO` do Cofre foram guardados em texto puro no `.env.local` (`docs/PROXIMOS-PASSOS-CLICKUP.md:239-242`; `docs/PLANO-CLICKUP.md:795-797`). **Checagem direta (somente nomes de variáveis, sem ler valores): o `.env.local` atual desta máquina NÃO contém essas chaves** — contém as 10 padrão (Supabase, Google, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`). O risco residual é real mesmo assim:
- esses **segredos de servidor estão numa pasta sincronizada pelo OneDrive** (o projeto proíbe isso para o dump do banco pelo mesmo motivo — `scripts/backup.ps1:18-35`);
- a nota dos planos pode se referir à outra máquina (a v2 foi feita em Linux) — **não verificado**.

**Recomendação (ação sua, fora do escopo dos docs):** mover `.env.local` para fora do OneDrive (ou excluir da sincronização), verificar a máquina Linux, e rotacionar `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY(S)`, `GOOGLE_CLIENT_SECRET` e `CRON_SECRET`. Se a senha mestra do Cofre chegou a ser escrita em arquivo sincronizado em qualquer máquina, trocar a senha e **gerar kit novo** (kits antigos não são revogáveis — `docs/cofre-recuperacao.md:30-35`).

### 6.2 Pontos fortes (preservar como referência)

RLS por dono desde a 0001 com `anon` fechado; padrão "RLS sem policy + grants revogados" para segredos; AES-GCM + AAD por linha + `key_id`/versão com testes de rotação; Cofre de conhecimento zero com kit autoverificado; ClickUp **limitado por construção** (tabela fechada de 9 operações, DELETE inexpressável, guard que falha fechado, token nunca volta ao cliente); `requireMaster()` na 1ª linha de toda action com teste-varredura da ordem; admin sem afrouxar policy alguma (service role atrás da guarda; `user_roles` sem policy de escrita; auditoria admin append-only); OAuth com state HMAC + expiração + vínculo à sessão, escopo mínimo readonly; cron com `timingSafeEqual`, falha fechada com segredo vazio e "autorizar antes de parsear"; CSP com nonce pronta; Sentry por allowlist com teste de vazamento; validação de imagem por magic bytes; login sem enumeração nem open redirect; `getUser()` (nunca `getSession()`).

### 6.3 Riscos priorizados

| # | Risco | Evidência | Correção |
|---|---|---|---|
| **Alto** A2 | **Usuário bloqueado pode se desbloquear**: `profiles.status` fica em tabela com UPDATE do dono (`0001:644-645,708`; a 0021 "não altera nenhuma policy"); com JWT válido (cookie legível), PATCH direto no PostgREST reativa; actions de módulo só usam `getUser()`, não `getAppContext()`; `desbloquearUsuario` não recusa o próprio id | `0021:80-97`; `admin/actions.ts:321-349` | negar escrita das colunas de bloqueio, checar bloqueio na RLS ou revogar sessões ao banir |
| **Alto** A3 | **Superfície XSS sem barreira efetiva**: CSP **Report-Only** (`csp.ts:35`), cookie de sessão **não-HttpOnly** (decisão documentada — cliente fala direto com PostgREST/Storage), chave do Cofre `extractable:true` (`vault.ts:141-147`) e kits irrevogáveis → um XSS leva sessão e Cofre aberto. Nenhum vetor XSS foi encontrado; o risco é o impacto | `cookie-options.ts:26-41` | virar a CSP para bloqueio; considerar BFF com cookie HttpOnly; rotação da chave de dados |
| **Médio** M1 | **State do OAuth com chave possivelmente vazia**: HMAC usa `TOKEN_ENCRYPTION_KEY` crua; se o operador seguir o `.env.example` e definir só `TOKEN_ENCRYPTION_KEYS`, o HMAC assina com `""` (Node aceita) → state forjável | `oauth.ts:30-43`; `env.ts:41-50` | chave HMAC própria e obrigatória |
| Médio M2 | Login sem MFA, sem rate limit próprio, sem reset de senha; senha inicial do admin não força troca | `(auth)/actions.ts` | — |
| Médio M3 | Rate limit em memória por instância; ausente em Cofre/Drive/Calendário/sync | `rate-limit.ts:16-37` | Upstash/Redis (o próprio arquivo aponta) |
| Médio M4 | Guard do ClickUp compara com campo editável pelo dono (`clickup_user_id`) | `guard.ts:58-59`; `0016:106-115` | — |
| Médio M5 | Sentry: `beforeSend` só cobre **eventos de erro**; transações (10%) saem sem allowlist; `integrations: []` **não** desliga os padrões (o SDK concatena — comentário errado no código) | `instrumentation-client.ts:87-90` | `beforeSendTransaction` + corrigir comentário |
| Médio M7 | Service role usada além do necessário (leituras que a RLS atenderia); proteção = `.eq("user_id")` manual | `credentials.ts:38-54` | — |
| Baixo | RPC `papel_do_usuario` SECURITY DEFINER provavelmente exposta a `anon`; auditorias editáveis pelo dono; `PUBLIC_PATHS` por prefixo com `/auth` vestigial; possível loop de redirect p/ bloqueado; `url` do ClickUp vira `href` sem validar esquema; e-mail do master hardcoded na 0021; e-mail semanal envia a bloqueados, sem opt-out, só página 1 | ver relatório | `verificacao.sql` bloco 12c responde a primeira |

---

## 7. Interface e Design System (estado real)

### 7.1 O que existe e é sólido

- **Arquitetura de tokens exemplar:** canais RGB p/ `<alpha-value>`, tema `.dark`, semânticas com **dois degraus** (`x` preenchimento / `x-ink` texto), sombras por tema, **contraste medido contra o pior de 4 fundos por tema, documentado em comentário** (`globals.css:46-51,106-149`). Paleta categórica do Financeiro com 8 tons medidos (piso 3:1) e rosca com vão geométrico.
- **Primitivos maduros:** `Modal` (armadilha de foco aninhada, devolve foco, trava rolagem com contador, saída animada), `DropdownMenu` (portal, vira pra cima, teclado completo), `alvo-44` (`::before` que estende o alvo), foco global de duas camadas, **piso de reduced-motion que zera duração e força iteração única** (corrige o caso real de animação infinita), proibição de `animation-delay` e animação por JS.
- **Marca própria:** símbolo "2" com pontos de conexão, `Logotipo` tokenizado (1 SVG, 2 temas), favicon/apple-icon, mestres em `public/brand/`.
- **Scripts pré-pintura** (tema e sidebar) com hash CSP travado por teste.
- Na **v2**: `Drawer`, `BottomSheet`, `DataTable`, `Tooltip` acessível, `ChartCard` com `resumoAcessivel` obrigatório, `armadilha-de-foco` compartilhada, safe-area, `.rola-x`.

### 7.2 O que está frágil

- **`docs/design-system.md` mente sobre tipografia**: descreve Body 16/Small 14, mas a escala foi **revertida por decisão de produto** (`15931d6` — densidade: ~30% mais itens por rolagem em telas de grade) e o doc nunca foi atualizado. Hoje: corpo 13px, legenda 12px, e **14 tamanhos em uso** com `text-sm`(14) como degrau sem nome (58 usos), mais lg/xl/2xl/3xl/4xl/5xl soltos.
- **Financeiro ignora `estilos.ts`**: `inputCls` próprio com campo de 40px/14px (`FinanceForms.tsx:37-38`) — texto <16px reintroduz o zoom do iOS que o projeto declara ter eliminado.
- **Componentes faltantes/duplicados:** sem `ui/Switch` (interruptor implementado 4×), sem estado `loading` no `Button` (cada tela troca rótulo à mão), `ConfirmationDialog` muito abaixo do padrão do `Modal` (não prende Tab, Esc aninhado fecha os dois — inferido), Toast sem dispensar/pausa (3,2s fixos), 3 estratégias de popover, z-index sem escala, escala de ícones inexistente na prática (9 tamanhos sobrescritos).
- **A11y pontual:** sem link "pular para o conteúdo"; `aria-invalid` 0 em formulários; foco de item de menu ~1,14:1; alvos de 28–40px em pontos específicos; dias fora do mês clicáveis a ~2,6:1.
- **Responsividade (main):** mês do calendário sem versão mobile (rolagem sempre); Kanban só desktop; tablets 768–1100px com semana rolando dentro do contêiner. A v2 corrige as maiores lacunas de mobile (Início reordenada, Configurações com chips, Financeiro 5 telas, safe-area, e2e 320/768) — mas a v2 não contém os módulos... contém, tudo exceto o conteúdo de `ffdf064` (Financeiro-main).
- **Sem PWA** (nada de manifest/SW/offline; a CSP já reserva `manifest-src`/`worker-src`).

---

## 8. Qualidade de engenharia

- **Testes:** 42 arquivos, ~780 casos na main (841 na v2); força em `lib/` pura (crédito 111, conhecimento 61, validação 51, cripto ~98% cobertura); **zero testes em `ui/`** (cobertura de componentes ~0–6%). Testes-guarda notáveis: hash da CSP, varredura das actions do admin, forma do SQL de migrations, regras do projeto na v2 (`dvh` nunca `vh`, classe Tailwind nunca em runtime, `new Date("AAAA-MM-DD")` proibido).
- **e2e:** 5 fluxos que codificam defeitos reais (data/hora, 390px sem transbordo apontando o culpado, fatura, admin fechado) — **não rodam no CI** (exigem projeto Supabase de teste).
- **CI:** tipos → lint → camadas → testes → build → **varredura de segredos no bundle** → knip (relatório) → audit. Ausentes: e2e, cobertura, orçamento de bundle, a11y automatizada.
- **Contrato de camadas:** 6 regras nascidas de defeitos reais (`ui/` não importa `features/`; `estilos.ts` sem imports; componentes não importam `admin.ts`/`tokens.ts`; só `lib/clickup` importa `capabilities`; sem ciclos). Falta regra feature→feature.
- **Comentários-âncora:** o projeto documenta o porquê no código — e onde a realidade mudou sem atualizar o texto, o próprio plano do DS chama isso de regressão. Casos mapeados: `design-system.md` (tipografia), `Button.tsx:74-75`, `modules.ts:68-78` (Hábitos "na barra" — está na gaveta), `TasksView.tsx:337-343`, comentário do `integrations: []` do Sentry (§6.3-M5), `docs/clickup.md` ("8 operações"/"não muda prazo"), README ("14 testes", busca "placeholder").

---

## 9. Análise Impeccable (v4.1.0)

**Setup:** skill instalada no clone de trabalho (`npx impeccable install --providers=claude --scope=project`), engine v0.1.5 windows-x64. ⚠️ **Modo estático declarado:** o app não foi executado (exigiria credenciais Supabase e dados reais), então a crítica por navegador/overlay e a pontuação Nielsen ao vivo não foram aplicadas — abaixo, o detector (determinístico, completo) e as lentes `audit`/`critique` aplicadas sobre o código.

### 9.1 Detector (61 regras determinísticas)

| Alvo | Resultado |
|---|---|
| `src/` @ main | **1 aviso** (`broken-image`, `CaptureView.tsx:1041`) |
| `src/` @ v2 | **1 aviso** (o mesmo) |

O único achado é **falso positivo verificado**: `<img src={a.previa}>` com fonte `blob:` local (prévia de anexo), com comentário justificando o `<img>` cru sobre `next/image` e `eslint-disable` consciente. **Zero violações reais** — nenhum tell de "interface gerada por IA" (sem gradiente roxo-azul, sem cards aninhados, sem easing bounce, sem texto cinza sobre cor).

### 9.2 Lente `audit` (5 dimensões, 0–4 → /20)

| Dimensão | Nota | Justificativa |
|---|---|---|
| Acessibilidade | **3** | Disciplina sistêmica (alvo-44, reduced-motion blindado, "nunca só por cor", contraste medido) com lacunas pontuais (§7.2) |
| Performance | **3** | Sem lib de gráfico (~100 kB poupados), Sentry dinâmico medido (105 kB c/ init), TipTap lazy, `staleTimes` — mas 1 só `Suspense`, 1 `loading.tsx` na main, sem orçamento de bundle |
| Theming | **4** | Sistema de tokens completo, dois temas de verdade, zero cor crua fora de token (exceção: `global-error.tsx` com paleta própria) |
| Responsividade | **3** | Mobile-first real com e2e 390px; lacunas na main (mês do calendário, ações de tarefa no mobile, tablets); v2 eleva o patamar (safe-area, 320/768) |
| Integridade de implementação | **4** | Detector limpo; sistema coerente e autoral; ressalva: *documentação* visual defasada (o código é a verdade; o doc não) |
| **Total** | **17/20 — "Good"** | (faixa 14–17: atacar as dimensões fracas) |

### 9.3 Lente `critique` (síntese estática)

- **Veredito de especificidade:** a interface é **autoral** — marca própria, 46 ícones próprios, gráficos SVG à mão, copy em pt-BR com tom definido, regras visuais com porquês. É o oposto do template genérico que a skill combate. Único antipadrão declarado da Impeccable presente: **fonte Inter** (`src/app/layout.tsx:2,14`) — e `--sb-surface` branco puro (a v2 registra como pendência conhecida; os demais neutros são tonalizados/quentes).
- **Carga cognitiva (checklist da skill):** o diagnóstico da própria v2 mediu os piores casos e os corrigiu no mobile (Início a ~3.500px de altura → meta ≤2.000; Configurações 6 painéis → chips + seções recolhíveis; Financeiro 27 lacunas F1–F27 → resolvidas em 5 telas). No desktop a hierarquia é boa; o ponto fraco restante é **descoberta** (heurística 6): pausas de hábito, mover pasta e preferências existem sem tela.
- **Personas em risco:** *Alex (power user)* — sem atalhos de teclado globais, sem command palette, sem busca global; *Casey (mobile distraído)* — na main, sem logout, sem excluir tarefa, alvos de 28px; a v2 atende Casey muito melhor; *Sam (a11y)* — bem servido no geral (foco global, ARIA), prejudicado por formulários sem `aria-invalid`/`aria-describedby`.
- **Nielsen (indicativo, sem navegador):** fortes em 1 (status: toasts, contadores, estados por bloco), 4 (consistência via tokens/primitivos), 5 (confirmações que dizem o que acontece; guardas de servidor); fracos em 3 (sem desfazer na main — v2 introduz no Financeiro; exclusões definitivas), 7 (sem atalhos/bulk), 10 (Ajuda placeholder).

### 9.4 Encaminhamento Impeccable para a nova versão

`/impeccable init` (PRODUCT.md) e `shape` das telas principais no novo projeto **antes de código**, com `typeset` (resolver Inter + escala fragmentada), `layout` (bento das referências), `colorize` (monocromia + teal aprendido na v2), `adapt`, `harden`, `onboard` como lentes do doc 04; `detect`/`audit` como portões de CI desde o Ticket 01.

---

## 10. Preservar × Descartar (consolidado)

### Preservar como referência (o "ouro" do projeto atual)

**Produto/UX:** Capturar como porta de entrada (rascunho local por usuário, conversão idempotente em tarefa); "hoje" como recorte central do Início; módulos ligáveis com "ausência = ligado"; confirmações que dizem o que realmente acontece; máscara `R$ ••••`; selo "Fatura de <mês>"; estados vazios calmos com CTA único.
**Domínio:** dinheiro em centavos; competência de cartão pelo mês da fatura (D2 — decisão consciente e testada); fatura/hábito **derivados**, nunca gravados; transferência em 2 pernas; parcelas com arredondamento na última; registro esparso de hábitos; "coluna no contêiner" de Projetos; vínculo como UPDATE sem cópia.
**Segurança:** tudo do §6.2.
**Design:** arquitetura de tokens + contraste medido; dois degraus semânticos; reduced-motion blindado; `alvo-44`; Modal/DropdownMenu; Logotipo tokenizado; regra 90/10 e "cor nunca sozinha"; a **planilha de decisões visuais com porquês**.
**Processo:** docs por módulo com invariantes; commits que ensinam; testes-guarda; contrato de camadas; massa de regressão controlada; CI com varredura de segredos; e2e que aponta o culpado.

### Descartar (com justificativa)

- **Estruturas nunca usadas:** `tags`/`task_tags`, `push_subscriptions`+`notification_deliveries` (lembrete é client-side), `watch_*`, rota `accounts`, `updatePreferences`, `moveFolder`/`desanexarImagem`/pausas sem tela (ou ganham tela na nova versão, ou não nascem), papel `admin` sem efeito, status `draft` de captura, animações `*-out` sem uso, `CardHeader/Body`, `FormModal`, `NAV_ITEMS`.
- **Padrões a não repetir:** `data.ts`/actions monolíticos por domínio único; tipos de banco à mão (gerar com `supabase gen types`); erros de leitura engolidos; filtros por nome fixo de categoria; cota do Drive no código; 3 snapshots para montar histórico; janela fixa do calendário; migrations sem transação/registro; e-mail semanal fora do padrão multiusuário; `cn` sem tailwind-merge conviver com sobrescritas.
- **Dívidas visuais:** escala tipográfica fragmentada (resolver na origem no novo DS — decisão consciente de densidade PODE ser mantida, mas nomeada e única), Inter (Q9), interruptor 4×, ConfirmationDialog fraco, z-index sem escala.

---

## 11. Não verificado (consolidado)

1. **Banco real:** quais migrations aplicadas (0014–0024, e qual `0023`); grants efetivos (`verificacao.sql` blocos 1/9/12/16 respondem, mas o bloco 1 só cobre até 0019); pg_cron; validade do CHECK de cartão; policies de Storage criadas por SQL ou painel.
2. **Deploy:** URL/projeto Vercel, branch publicada, `CRON_SECRET`/`RESEND_API_KEY` atuais, região, se o e-mail semanal já saiu, DSN Sentry e o que as transações carregam.
3. **GitHub pós-17/08**: PR da v2? CI rodou nela? Visibilidade do repo (relevante: `AUDITORIA-SEGURANCA-2026-08-02.md` e `PLANO-CLICKUP.md` continuam **recuperáveis no histórico git**).
4. **Google OAuth:** modo Testing×produção (docs indicam Testing → refresh tokens expiram ~7 dias), verificação do app.
5. **ClickUp:** qualquer contato real com a API.
6. **Supabase Auth:** signup desligado, duração do JWT, comportamento de `getUser()` para banido.
7. **Máquina Linux da v2:** existência de `.env` com segredos/senha mestra (§6.1) e do REQ-FIN.
8. Comportamentos de execução inferidos e não reproduzidos: autodesbloqueio, Esc duplo em diálogo aninhado, hidratação do ThemeToggle, loop de redirect do bloqueado.

---

## 12. O que este diagnóstico implica para o novo produto (antecipação dos docs B–M)

1. **Não é um resgate de escombros — é uma refundação sobre ativos excelentes.** A maior parte do valor está em decisões de domínio, segurança e processo, não em telas.
2. O novo Financeiro deve nascer da **fusão** dos dois modelos (Q1): estado/soft-delete/plano-do-mês/URL da v2 + pagamento parcial/serie_tipo/horizontes da main.
3. **Banco:** repetir RLS-por-dono e centavos; corrigir na fundação: bloqueio fora do alcance do dono, auditoria append-only, migrations transacionais com registro, tipos gerados, padrão único de soft delete, transação de verdade para operações compostas (RPCs/functions).
4. **PWA/app é greenfield** (doc 07): manifest, SW, offline, captura rápida mobile, push (as tabelas já anteciparam).
5. **Grafo de conhecimento** (doc 05/06): `*_links` + backlinks do editor são o embrião; falta generalizar o vínculo polimórfico e a visualização.
6. **Novo DS** (doc 04): partir dos tokens/da disciplina atuais + direção das referências visuais (bento/pílula/glass), resolvendo na origem tipografia, fonte, Switch, Button-loading, Dialog único, z-index, e — da v2 — Drawer/BottomSheet/DataTable/Tooltip como primitivos de primeira classe.
7. **Admin** (doc 10): hoje é gestão de contas; a visão estratégica (uso por módulo, sessões, dispositivos) não existe — decidir eventos próprios × ferramenta externa.
8. **Autonomia de operação:** a nova versão precisa de migrations aplicáveis por pipeline (o "sem acesso ao banco, como sempre" não pode se repetir).
