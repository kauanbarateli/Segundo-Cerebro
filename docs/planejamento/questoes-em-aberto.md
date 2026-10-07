# Questões em aberto

## Estado

- **Rodada 1 (Q1–Q11): respondida em 23/09/2026** — D-006 a D-015 no [registro-de-decisoes.md](registro-de-decisoes.md).
- **Rodada 2 (R1–R11): respondida em 23/09/2026** — D-016 a D-027. Fonte escolhida: **Geist** (R9=d). ClickUp mantido por presunção não contestada (R1.1 → D-017).
- **Não há rodada 3.** Nenhuma questão bloqueante permanece aberta; o planejamento está completo (docs 00–13 + anexos A/B) e a execução pode começar pelo Milestone 0 do [doc 13](13-tickets.md).
- Itens reversíveis declarados e pré-requisitos operacionais: ver o fim do [registro-de-decisoes.md](registro-de-decisoes.md) e o §"Antes do primeiro ticket" do [doc 12](12-roadmap.md).

### Atualização vigente — 29/09/2026

A demanda direta do Kauan para Capturar conectado, grafo demonstrativo, busca/perfil e refinamento geral foi registrada em **D-030**, com especificação no [doc 14](14-prototipo-interacoes.md). Não abre nova rodada nem reverte R11/D-027: o grafo desta entrega usa dados locais simulados; o grafo de produção continua na fase 2. D-031 registra a disponibilização da skill IMPECCABLE 4.4.0 no projeto e no perfil local.

As perguntas abaixo são **histórico das rodadas já respondidas**, não solicitações pendentes de autorização. Taxonomia, fonte e corte de MVP já estão confirmados; só as decisões expressamente reversíveis permanecem como tal. A verificação visual/funcional desta revisão é registrada no doc 14 §11, sem confundir requisitos planejados com testes executados.

---

# Rodada 2 — validação das propostas (R1–R11)

Cada pergunta aponta o documento onde a proposta completa está. Responda pelo número (ex.: "R1: a").

### R1. Taxonomia de módulos (re-Q7) — a tensão brainstorming × legado
O `brainstorming.md` do `novo-segundo-cerebro` trata Notas/Projetos/Documentos como FUTUROS; o legado já os tem prontos e maduros; minha proposta os inclui ([doc 05](05-arquitetura-de-produto.md) §1, [doc 11](11-estrategia-mvp.md)).
- **a) Taxonomia proposta: Início, Capturar, Conhecimento (com grafo), Tarefas, Calendário, Drive, Projetos, Hábitos, Financeiro, Cofre, Configurações, Integrações, Admin** ← *recomendo — o trabalho já existe e é bom; jogar fora Conhecimento/Drive/Projetos seria regressão*
- b) Núcleo enxuto do brainstorming (Calendário, Tarefas, Financeiro, Hábitos, Cofre, Captura); o resto entra por fase
- c) Outra composição (diga)

**R1.1 — ClickUp:** a) mantém (entra na fase 2, com validação real da API) ← *presumo* · b) descarta

### R2. Stack — confirmação ([doc 02](02-arquitetura-proposta.md) §1, [doc 03](03-comparacao-tecnologica.md))
Supabase em projeto novo + Next.js 15 + **Tailwind 4** (portando o preset do workspace para `@theme`; custo único, ganha container queries p/ o bento) + Vercel Hobby.
- **a) Confirmo tudo** ← *recomendo*
- b) Tudo menos Tailwind 4 (ficar no 3.4 do workspace — aproveitamento literal, sem container queries nativas)
- c) Quero discutir um ponto (diga qual)

### R3. ADRs e glossário do `novo-segundo-cerebro` ([anexo A](anexo-a-analise-novo-segundo-cerebro.md), [doc 02](02-arquitetura-proposta.md) §2)
- **a) Adotar os 5 ADRs como estão, com as duas conciliações registradas** (ADR-0003 com "Plano Pessoal" implícito e sem billing, por D-011; ADR-0004 com exceção do Cofre em metadados) **+ as extensões de glossário do [doc 05](05-arquitetura-de-produto.md) §4** ← *recomendo*
- b) Ajustar algum ADR/termo (diga qual e como)

### R4. Módulo Gmail (apareceu no brainstorming §7)
- **a) Roadmap "futuro", sem compromisso de fase** ← *recomendo — o valor declarado era servir de contexto à IA, que o ADR-0005 tirou do app*
- b) Fase 2 (leitura/busca como módulo)
- c) Descartar de vez

### R5. Cofre — modelo ([doc 09](09-seguranca.md) §3)
- **a) Manter E2E (senha mestra + kit; irrecuperável sem eles) com as 7 evoluções propostas** ← *recomendo*
- b) Modelo recuperável pelo servidor (mais conveniência, menos privacidade)

### R6. Métricas do Admin ([doc 10](10-area-administrativa.md) §1)
- **a) Eventos próprios no Postgres (enum fechado, sem conteúdo) + rollup diário** ← *recomendo*
- b) Ferramenta externa (Plausible/PostHog — diga qual)

### R7. Corte de MVP ([doc 11](11-estrategia-mvp.md))
- **a) Aprovo a tabela essencial/importante/futuro como está** ← *recomendo*
- b) Ajustes (diga: o que entra, o que sai)

### R8. Metodologia — mapeamento ([anexo B](anexo-b-metodologia-match-spoc.md) §3)
Épico = spec-issue · Milestone = fase do roadmap · Ticket = tracer-bullet com bloqueio nativo · "arquivos afetados" vira "módulos/áreas do CONTEXT.md" (a metodologia proíbe caminhos de arquivo, que apodrecem).
- **a) Aprovo o mapeamento** ← *recomendo*
- b) Quero caminhos de arquivo nos tickets mesmo assim / outro ajuste

### R9. Tipografia — escolha pela amostra visual (link no chat; [doc 04](04-design-system.md) §1.2)
- **a) Instrument Sans** ← *recomendo (grotesca com personalidade, excelente em UI densa)*
- b) Schibsted Grotesk (display editorial mais forte)
- c) Onest (humanista, máxima legibilidade)
- d) Geist (técnica, dígitos tabulares exemplares)
- e) Manter Inter (zero risco, zero personalidade)

### R10. Repositório-base do novo produto ([doc 02](02-arquitetura-proposta.md) §5)
- **a) Repo novo `kauanbarateli/segundo-cerebro`, raiz na pasta `Novo  -- Segundo Cerebro` (app + este planejamento versionados juntos); aproveitamento por cópia; `novo-segundo-cerebro` arquivado como fonte** ← *recomendo*
- b) Continuar no `novo-segundo-cerebro` (a partir da branch de bootstrap não mesclada)
- c) Outro nome/local (diga)

### R11. Grafo — fase ([doc 06](06-arquitetura-de-dados.md) §3, [doc 11](11-estrategia-mvp.md))
- **a) MVP = wiki-links `[[...]]` + backlinks + "Relacionado" clicável; grafo VISUAL (vizinhança) na fase 2** ← *recomendo — o valor do grafo começa nos links, não no desenho*
- b) Grafo visual já no MVP

---

---

# Rodada 1 (arquivada — respondida)

Perguntas necessárias para fechar o diagnóstico e abrir os documentos B–M. Cada uma traz opções e a minha recomendação. Responda pelo número (ex.: "Q1: a").

---

## Tema A — Estado real do projeto e fontes

### Q1. Qual Financeiro é a referência: o da main, o da v2 — ou a fusão dos dois?

A v2 tem 13 commits além da main: Financeiro refeito em 5 telas (busca, filtros, paginação, estado na URL, plano do mês, exclusão lógica com "Desfazer", gráficos interativos), responsividade global, 841 testes e auditoria própria. **MAS** o merge final da v2 (`a9422bc`) **descartou o conteúdo do último commit da main**: a árvore resultante é idêntica à do commit anterior ao merge, e a v2 NÃO tem o pagamento parcial de fatura (`paid_cents`/`payTransaction`), a recorrência por coluna (`serie_tipo`) nem a tripla "Dívida × Compromissos futuros × Total previsto" que a main ganhou em `ffdf064`. Ou seja: **nenhuma branch contém a outra** — são dois modelos de Financeiro que evoluíram em paralelo a partir do mesmo ponto (`87f1ee2`).

- **a) Fusão: as duas são referência; o diagnóstico registra o melhor de cada e o NOVO produto funde os dois modelos** ← *recomendo — é uma reconstrução, não um fork; nada obriga a escolher um lado*
- b) A v2 é a principal; o que ela descartou da main (pagamento parcial, `serie_tipo`, horizontes de dívida) morre
- c) A main é a principal; a v2 vira estudo

### Q2. Qual é o estado do ambiente real (Supabase + deploy)?

As branches **divergem em migrations**: a main tem `0023_pagamento_parcial` + `0024_serie_tipo`; a v2 tem `0023_financeiro_v2` (o README da v2 avisa que o app cai sem ela). As duas 0023 criam **gatilhos diferentes sobre a mesma tabela** — aplicadas ambas, ficariam dois gatilhos `BEFORE` concorrentes, exatamente o cenário que os próprios arquivos dizem evitar. E há sinais de que várias migrations podem nunca ter sido aplicadas: os commits da 0014 à 0019 marcam "NÃO aplicada" na mensagem, e um deles registra "sem acesso ao banco, como sempre". Para planejar a migração de dados eu preciso saber o que está aplicado no banco real.

Responda o que souber: existe projeto Supabase vivo? Você usa o app no dia a dia (e por qual URL — Vercel?)? Qual branch está publicada? Até qual migration o banco foi levado (`0022`? `0023/0024` da main? `0023_financeiro_v2`?)? Se não souber, diga — eu te passo as consultas de verificação prontas (o repo tem `supabase/verificacao.sql`) para você rodar no SQL Editor.

### Q3. Os dados existentes precisam viver na nova versão?

- **a) Sim — o novo Segundo Cérebro deve nascer com meus dados atuais migrados (tarefas, lançamentos financeiros, notas, hábitos, cofre…)** ← *recomendo se você usa o app hoje; o plano de migração vira parte da arquitetura desde o início*
- b) Não — recomeço limpo; o banco antigo fica como arquivo morto
- c) Parcial — só alguns módulos (diga quais; o Financeiro e o Cofre são os mais delicados)

### Q4. O que fazer com o projeto `novo-segundo-cerebro` já iniciado?

Descobri na pasta `Novo - Segundo Cerebro` (vizinha da nova) um repositório `kauanbarateli/novo-segundo-cerebro` com 4 commits: glossário de domínio (`CONTEXT.md` com os conceitos Plano/Entitlement/Preferência, Núcleo/Canal, Evento de domínio), **5 ADRs formais** (usuário como unidade de isolamento; núcleo como única porta para os dados; entitlement ≠ preferência; toda escrita emite evento; **sem IA dentro do app**), um workspace de design system extraído do legado e um bootstrap Next.js.

- **a) Incorporar como fonte: analiso a fundo na rodada 2 e aproveito ADRs/glossário no novo planejamento** ← *recomendo — são decisões suas já registradas; confirmo o que continua valendo*
- b) Descartar — o planejamento atual recomeça do zero e esse repo vira histórico
- c) Continuar NELE — a nova versão deve ser construída nesse repositório existente, não em um novo

### Q5. Você ainda tem o requisito `PLANEJAMENTO-FINANCEIRO-V2.md` (REQ-FIN)?

Os docs da v2 o citam como fonte normativa (§ por §), mas ele não está no repositório nem o encontrei no disco (o plano da v2 referencia um caminho de uma máquina Linux). Não é bloqueante — `DIVERGENCIAS-REQ-FIN.md` e o plano da v2 preservam o essencial —, mas com ele o novo módulo Financeiro herda o requisito original completo.

- a) Tenho / vou procurar e coloco na pasta do planejamento
- **b) Não tenho — sigam com o que está registrado nos docs da v2** ← *ok se for o caso; nada se perde de crítico*

---

## Tema B — Produto e usuários

### Q6. Quem usa, e há modelo comercial?

O prompt fala em ~10 usuários. O glossário do `novo-segundo-cerebro` define "Plano" como **pacote comercial** e "Entitlement" por plano — o que muda MUITO a arquitetura (billing, gestão de planos, isolamento, admin).

- **a) Pessoal + pessoas próximas, sem cobrança; arquitetura multiusuário limpa mas sem billing** ← *recomendo para o MVP: papéis/isolamento já existem no atual; billing é peso morto até haver cliente*
- b) SaaS com planos pagos desde o início (billing, entitlements e onboarding comercial entram no MVP)
- c) Pessoal agora, SaaS depois — arquitetura já modelada com entitlements (sem billing), para ligar cobrança sem retrabalho

### Q7. Taxonomia de módulos da nova versão (e o destino do ClickUp)

O prompt lista: Dashboard; Anotações; Conhecimento; Cadernos; Páginas; Tarefas; Calendário; Arquivos/Drive; Projetos; Hábitos; Financeiro; Cofre; Configurações; Integrações; Administração. O app atual tem: Início, Capturar, Tarefas (+integração ClickUp de leitura), Calendário (Google), Conhecimento (cadernos/páginas TipTap), Drive (+lixeira), Financeiro, Hábitos, Projetos, Cofre, Vínculos (ligações entre registros), Configurações, Admin, Ajuda.

Minha leitura: "Anotações/Cadernos/Páginas" = o módulo Conhecimento (estilo Obsidian, com grafo a avaliar); "Capturar" é a porta de entrada rápida e merece continuar como conceito próprio; "Vínculos" é o embrião do grafo.

- **a) Confirmo essa leitura: módulos da nova versão = Início/Dashboard, Capturar, Conhecimento (notas+cadernos+páginas+grafo), Tarefas, Calendário, Drive, Projetos, Hábitos, Financeiro, Cofre, Configurações, Integrações, Admin** ← *recomendo*
- b) Quero ajustar a lista (diga o que entra/sai)

**Q7.1 — ClickUp:** a integração é grande (leitura de tarefas do trabalho, quadro por fase, subtarefas). Continua na nova versão? — a) sim, é parte do meu dia a dia ← *presumo que sim, mas confirme* · b) não, descartar

---

## Tema C — Design

### Q8. Confirmação da direção visual e da marca

Referências analisadas em [referencias/referencias-visuais.md](referencias/referencias-visuais.md): grade bento, raios generosos, trilho de navegação em pílula, monocromia com preto como acento, superfícies claras+escuras misturadas, vidro fosco na moldura, números editoriais. O DS 1.0 atual já é parente próximo disso (neutro quente, preto como decisão) e o produto tem marca própria (símbolo "2" com pontos de conexão, lockup, favicon).

- **a) Direção confirmada; EVOLUIR a marca atual ("2") dentro da nova estética** ← *recomendo — marca é ativo, e ela nasceu bem resolvida*
- b) Direção confirmada; marca nova do zero
- c) Quero calibrar a direção antes (me diga o quê)

### Q9. Tema de nascença e tipografia

- **Q9.1 Tema:** a) **claro com vidro (como a ref-01), escuro derivado com o mesmo rigor de contraste do atual** ← *recomendo* · b) escuro primeiro
- **Q9.2 Fonte:** o app usa **Inter**, que a Impeccable classifica como antipadrão ("fonte batida"). a) **trocar — apresento 3–4 candidatas com amostras no doc 04 (ex.: Instrument Sans, Switzer, Satoshi, General Sans)** ← *recomendo* · b) manter Inter (neutra, madura, zero risco)

---

## Tema D — Execução

### Q10. Custo-alvo de infraestrutura

Para a comparação tecnológica (doc 03) com estimativas honestas: qual teto mensal aceitável no cenário inicial (~10 usuários)?

- **a) O mais próximo de zero possível (free tiers; hoje Supabase Free + Vercel Hobby provavelmente bastam)** ← *recomendo como premissa; aponto no doc onde estão os degraus de custo*
- b) Até ~US$ 25–50/mês se comprar robustez (backups, sem pausa de projeto, e-mail)
- c) Sem restrição forte — otimizar para qualidade

### Q11. Metodologia "Match-SPOC no GitHub"

O prompt manda **perguntar em vez de supor**, e eu não conheço uma metodologia pública com esse nome. Antes de estruturar o doc 13 (tickets):

- a) Vou explicar o que o Match-SPOC define / mandar o material de referência
- b) Use a interpretação padrão — Visão geral → Épicos → Milestones → Tickets → Subtarefas, tickets como issues do GitHub com objetivo/contexto/escopo/fora-de-escopo/arquivos/dependências/critérios de aceite/validação — e eu valido o formato no primeiro lote

---

## Registro

| Rodada | Enviada em | Respondida em |
|---|---|---|
| 1 (Q1–Q11) | 23/09/2026 | — |
