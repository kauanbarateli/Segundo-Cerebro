# L — Roadmap: o planejamento futuro do projeto inteiro

**Este é o arquivo pedido na R7:** a evolução completa do novo Segundo Cérebro, do primeiro commit ao horizonte — fases com objetivo, conteúdo, critério de saída, e o backlog futuro consolidado com os gatilhos de reconsideração. Os milestones M0–M4 estão detalhados em specs e tickets executáveis no [doc 13](13-tickets.md); as fases seguintes serão quebradas em tickets **quando chegarem** (regra da metodologia: spec+tickets só quando o trabalho não cabe numa sessão — e só quando for a vez dele).

**Como ler:** cada fase termina num estado utilizável. A ordem dentro de cada fase é dada pelas arestas de bloqueio dos tickets (trabalha-se a fronteira); a ordem ENTRE fases é compromisso deste roadmap. Datas não são prometidas — o projeto é de uma pessoa; o roadmap ordena, não agenda.

**Baseline visual de 29/09/2026 — D-030:** o [doc 14](14-prototipo-interacoes.md) e o HTML associado demonstram Capturar com escrita ampla, vínculos, backlinks, grafo local, busca e perfil. Essa antecipação serve à implementação fiel das telas, mas não conclui M0/M1 nem transfere o grafo de produção da fase 2. “Todas as notas” explora sete registros locais, sem substituir o grafo global de fase 3. A especificação discrimina medidas, comportamentos implementados, limites e evidências; documentação e protótipo devem mudar juntos em cada revisão.

---

## Antes do primeiro ticket (pré-requisitos operacionais, ~1h)

| # | Ação | Por quê |
|---|---|---|
| 1 | Mover `.env.local` do legado para fora do OneDrive e **rotacionar** service role, `TOKEN_ENCRYPTION_KEY(S)`, `GOOGLE_CLIENT_SECRET`, `CRON_SECRET`; conferir a máquina Linux (senha mestra/kit + REQ-FIN) | Alerta do diagnóstico §6.1 |
| 2 | `gh auth login` na conta `kauanbarateli` (hoje a CLI está na `contasvoedigital`) e confirmar com `gh repo view` | Sem isso, nenhuma issue pode ser criada (anexo B §4) |
| 3 | Criar o repositório `kauanbarateli/segundo-cerebro` com raiz na pasta `Novo  -- Segundo Cerebro` (D-026) e os **5 labels de triagem** (comandos prontos em `novo-segundo-cerebro/docs/agents/triage-labels.md`) + milestones M0–M4 | Casa do produto e do tracker |
| 4 | Criar o projeto **Supabase novo** (região `sa-east-1`) e um segundo projeto/local para e2e; guardar segredos só no cofre da Vercel + `.env` fora de sincronização | D-007/D-018; doc 09 §2.9 |

---

## Fase 1 — MVP (milestones M0–M4 do doc 13)

**Objetivo:** substituir o app atual no dia a dia do Kauan, com a fundação que não se troca depois.

| Milestone | Entrega | Estado ao fim |
|---|---|---|
| **M0 — Fundação visual** | Repo + CI com portões + DS 2.0 (tokens Geist, tema 3 estados, primitivos, shell bento trilho/barra) + PWA base + Impeccable como portão | App instalável, navegável entre cascas, bonito e acessível — sem dados |
| **M1 — Fundação funcional (mocks)** | Núcleo (`src/core/`) com as regras puras portadas COM testes + depcruise ativo + telas principais operando sobre adapters em memória | O produto inteiro se USA com dados de exemplo; troca de mock por banco não reescreve tela (a exigência 80/20 do prompt) |
| **M2 — Banco, auth e primeiras persistências** | Schema de identidade + RLS + moderação correta + auth httpOnly + CSP em bloqueio + rate-limit persistente + eventos de domínio + **Capturar/Tarefas/Início reais** + Admin básico | Multiusuário seguro; o trio de entrada (capturar→organizar→dia) é real |
| **M3 — Módulos de valor** | **Financeiro fundido** (schema+RPCs+massa de regressão; contas/cartão/fatura/pagamento parcial/lançamentos/transferências) + Conhecimento com wiki-links/backlinks/lixeira + Drive + Projetos + Hábitos completos + Cofre E2E + Calendário Google | Todos os módulos do MVP persistem de verdade |
| **M4 — Fecho do MVP** | Busca global + palette, Configurações completas (tema persistido, reset de senha), hardening de release (Sentry, backups agendados, checklist manual) | **Release 1** — migração de uso: o legado vira somente-leitura |

**Critério de saída da Fase 1:** as 6 jornadas-âncora do doc 05 §3 passam de ponta a ponta no desktop e no iPhone real; CI verde com e2e 320/390/768 + detect/audit; RLS auditada pelo script executável; zero questão de segurança alta aberta.

## Fase 2 — O celular como primeira classe + análise

**Objetivo:** o produto deixa de ser "site que instala" e vira app de verdade no bolso; o dono passa a enxergar o uso.

Conteúdo (specs a escrever ao chegar): **Outbox offline de captura** (IndexedDB + Background Sync + `client_id`) · **Share target** Android/desktop + Atalho iOS · **Web Push** (VAPID; lembrete de reunião, fatura, capturas paradas) · **Orçamentos + Plano do mês** (a parte da v2 que ficou p/ cá) + recorrência na UI (`serie_tipo`) + gráficos interativos completos · **Grafo visual de vizinhança** (lazy; sigma/graphology vs d3-force decidido por protótipo `/prototype`) · **Métricas do admin** (`usage_events` + rollup + telas Visão geral/Módulos/Sistema) · **ClickUp portado e finalmente validado contra a API real** (D-017) · **Exportar meus dados** + excluir conta · e-mail semanal **opt-in** multiusuário correto · TOTP (MFA) nas Configurações.

**Critério de saída:** capturar offline no metrô e ver sincronizar; push chegando no Android e no iOS instalado; painel do admin respondendo "o que é mais usado?"; ClickUp com contrato validado por 9 chamadas reais documentadas.

## Fase 3 — Profundidade e abertura

**Objetivo:** os módulos ganham as camadas que pedem uso acumulado; o produto se abre para outros Canais.

Conteúdo: **API v1** (o Canal "Plataforma externa" dos ADRs: rotas finas sobre o Núcleo, token pessoal, rate-limit próprio — pré-requisito de qualquer IA externa e de automações) · **Realtime** (canal por usuário; listas vivas entre dispositivos) · **Grafo global** com filtros por caderno/projeto · anexos em lançamento (fase 3 do plano v2) + importação OFX/CSV · prévia de arquivos (imagem/PDF) e busca no Drive · templates de página e trechos na busca do Conhecimento · subtarefas/repetição em Tarefas · metas de Projetos · relatórios/período comparado no Financeiro.

**Critério de saída:** um fluxo externo (ex.: automação pessoal) cria uma captura pela API v1 sem tocar no banco; duas abas em dois aparelhos refletem a mesma escrita em segundos.

## Fase 4+ — Horizonte (sem compromisso de ordem)

**Gmail como integração** (D-020: leitura/busca como contexto — só faz sentido junto de um Canal de IA externo) · **IA pela Plataforma externa** (ADR-0005: chega como Canal da API v1, nunca embutida; WhatsApp idem) · **Wrapper Capacitor** (gatilho: precisar de share extension iOS, widgets ou biometria nativa p/ o Cofre) · escrita no Google Calendar (gatilho: dor real de criar evento; custo: escopo sensível + verificação do app) · e-mail-para-capturar e clipper de navegador · CalDAV/outras agendas · multi-moeda na UI · compartilhamento seletivo (⚠️ gatilho duro do ADR-0001: **reabrir o ADR ANTES de desenhar qualquer feature compartilhada**) · billing/planos reais (gatilho: primeiro usuário pagante à vista — a estrutura de entitlements já espera; sair do Vercel Hobby junto) · TV/tablet-paisagem como formatos dedicados.

## Recusas com gatilho de reconsideração (herdadas do doc 02 §6)

| Recusado por ora | Reconsiderar quando |
|---|---|
| Microsserviços / monorepo | um segundo app real (mobile nativo) entrar em desenvolvimento |
| Fila/worker dedicado | um job passar de ~30s ou precisar de retry gerenciado |
| Event sourcing | nunca por padrão; eventos são registro, não fonte |
| CRDT/merge fino em notas | conflito real e frequente de edição em 2 aparelhos (hoje: concorrência otimista + tela de conflito) |
| Ferramenta externa de analytics | a análise interna deixar de responder uma pergunta concreta do dono |
| Upstash/Redis p/ rate-limit | a tabela Postgres virar gargalo medido |

## Riscos do plano inteiro (e o antídoto embutido)

1. **Projeto de uma pessoa** → fases terminam utilizáveis; qualquer pausa deixa um produto inteiro, não um canteiro (a lição do legado, que pausou DUAS vezes em estado são).
2. **Recomeço que vaza escopo** ("já que estou refazendo…") → o corte do MVP é decisão registrada (D-023); mudanças passam pelo registro de decisões, não pelo impulso.
3. **Supabase Free pausando/limitando** → crons diários geram atividade; alarme no e-mail; degrau Pro mapeado no doc 03.
4. **Fidelidade da fusão do Financeiro** → a massa de regressão com valores calculados à mão porta JUNTO com o schema (ticket T-018 exige os números da main E os da v2 passando).
5. **Deriva doc×código (a doença do legado)** → `DESIGN.md`/`CONTEXT.md` são vivos por regra de PR: mudou comportamento, muda o doc no MESMO commit; comentário que descreve o passado é regressão bloqueável em review.
