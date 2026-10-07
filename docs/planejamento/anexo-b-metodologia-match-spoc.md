# Anexo B — Metodologia de execução ("Match-SPOC" = Matt Pocock skills)

**Resolução da Q11 (23/09/2026):** a metodologia que o planejamento chama de "Match-SPOC no GitHub" é o **fluxo de engenharia do repositório [mattpocock/skills](https://github.com/mattpocock/skills)** (v1.2.3, MIT) — que o projeto `novo-segundo-cerebro` já tem instalado (25 skills, hashes travados em `skills-lock.json`), configurado (`docs/agents/{issue-tracker,triage-labels,domain}.md`) e documentado em português (`docs/skills-mattpocock.md`). Fontes lidas: o guia instalado + os `SKILL.md` normativos de `to-spec` e `to-tickets` no repositório de origem.

---

## 1. O fluxo principal

```
IDEIA → /grill-with-docs (sabatina com registro em CONTEXT.md + ADRs)
      → [dúvida que só código resolve? → /prototype e volta]
      → cabe em UMA sessão?  sim → /implement (dirige /tdd) → /code-review → SHIP
                             não → /to-spec → /to-tickets → /implement POR TICKET
Rampas: relatos externos → /triage · esforço grande e nebuloso → /wayfinder (mapa de decision tickets)
```

**Regra de ouro:** o split spec+tickets só se paga quando o trabalho **não cabe em uma sessão**. Cabendo, vai direto para a implementação.

## 2. As peças normativas

### 2.1 Spec (`/to-spec`) — o "épico" executável

Uma spec é **uma issue no GitHub** com o template fixo: **Problem Statement** (do ponto de vista do usuário) · **Solution** · **User Stories** (lista longa e numerada, "As a…, I want…, so that…") · **Implementation Decisions** (módulos e interfaces tocados, decisões de arquitetura/schema/contratos — **sem caminhos de arquivo nem snippets**, que apodrecem; exceção: trecho de protótipo que codifica uma decisão) · **Testing Decisions** (o que é um bom teste, quais módulos, prior art) · **Out of Scope** · **Further Notes**. Antes de publicar, os **test seams são acordados** (preferir seams existentes, o mais alto possível — o ideal é um). Publica com o label `ready-for-agent`.

### 2.2 Tickets (`/to-tickets`) — tracer bullets com arestas de bloqueio

- Cada ticket é uma **fatia vertical completa** (schema → API → UI → testes) que prova um caminho fim a fim e é **demonstrável sozinha** — nunca "todo o backend, depois todo o frontend".
- Dimensionado para **uma janela de contexto nova** (uma sessão de agent).
- Declara **Blocked by** com as **dependências nativas de issue do GitHub** (bloqueadores primeiro; trabalha-se a *fronteira*: qualquer ticket sem bloqueador aberto).
- Template da issue: **Parent** (spec) · **What to build** (comportamento fim a fim, do ponto de vista do usuário) · **Acceptance criteria** (checklist) · **Blocked by**.
- **Exceção:** refactors largos e mecânicos não viram tracer bullet — viram sequência **expand → migrate (em lotes) → contract**.
- O quebra-se apresenta a lista ao dono (granularidade? arestas corretas? fundir/dividir?) **antes** de publicar.

### 2.3 Labels e tracker

Tracker: **GitHub Issues** via CLI `gh` (convenções operacionais completas em `novo-segundo-cerebro/docs/agents/issue-tracker.md`). Labels canônicos: `needs-triage` · `needs-info` · `ready-for-agent` · `ready-for-human` · `wontfix` (+ `wayfinder:*` se o fluxo wayfinder for usado). Tickets gerados por nós **não passam por triagem** — nascem `ready-for-agent`.

### 2.4 Disciplinas de apoio

`/tdd` (red-green em seam pré-acordado; sem teste em seam não confirmado; mocks só em fronteiras de sistema) · `/code-review` (dois eixos: padrões + aderência à spec) · `/domain-modeling` + `CONTEXT.md` (vocabulário canônico com `_Avoid_`) · ADRs em `docs/adr/` (conflito com ADR se **sinaliza**, nunca se sobrescreve em silêncio) · `/writing-for-agents` para todo documento que um agent lê.

## 3. Mapeamento para a estrutura pedida no planejamento

O prompt do planejamento pede "Visão geral → Épicos → Milestones → Tickets → Subtarefas" e campos por ticket. Tradução proposta (a validar na rodada 2, Q-R2):

| Estrutura pedida | Realização na metodologia |
|---|---|
| Visão geral | Doc 12 (Roadmap) + issue-índice fixada no repositório |
| Épico | **Spec** (issue com o template §2.1), uma por área de entrega |
| Milestone | **GitHub Milestone** agrupando as specs/tickets de cada fase do roadmap |
| Ticket | **Issue tracer-bullet** (§2.2) com dependências nativas de bloqueio |
| Subtarefas | Checklist de *acceptance criteria* dentro do ticket (sub-issues só quando um critério crescer) |
| objetivo / contexto | "What to build" + link ao Parent (spec traz o contexto) |
| escopo / fora do escopo | Na spec (Out of Scope); o ticket herda e recorta |
| arquivos/áreas afetados | **Adaptação consciente:** a metodologia proíbe caminhos de arquivo (apodrecem); usamos **módulos/áreas do CONTEXT.md** (ex.: "domínio Financeiro, camada de dados") em vez de paths |
| dependências | Blocked by (nativo) |
| critérios de aceite / validação | Acceptance criteria + Testing Decisions da spec (seams acordados) |

## 4. Aplicação neste projeto (decidido/proposto)

1. **Este planejamento (docs 00–13) cumpre o papel do `/grill-with-docs` + `/wayfinder`**: as rodadas de perguntas são a sabatina; o registro de decisões faz as vezes dos decision tickets; os docs A–L são o material de que as specs serão sintetizadas.
2. O **doc 13** conterá as specs (épicos) e os tickets no formato exato dos templates §2.1/§2.2, prontos para `gh issue create`, com a ordem de bloqueio desenhada — Ticket 01 (fundação visual) e Ticket 02 (fundação funcional) do prompt viram **milestones** com várias fatias verticais cada.
3. No **novo repositório**: instalar as mesmas skills (repetir o `skills-lock.json` aproveitando o trabalho do `novo-segundo-cerebro`), rodar `/setup-matt-pocock-skills`, criar os 5 labels, e criar `CONTEXT.md` + `docs/adr/` desde o dia 1 (herdando o glossário validado na rodada 2).
4. **Pendência operacional herdada:** a CLI `gh` desta máquina estava autenticada na conta `contasvoedigital`, que não enxerga os repositórios privados do `kauanbarateli` (registrado em 30/08/2026 em `issue-tracker.md`). Antes do primeiro lote de issues: `gh auth login` na conta correta + criar os labels (comandos prontos em `triage-labels.md`).
