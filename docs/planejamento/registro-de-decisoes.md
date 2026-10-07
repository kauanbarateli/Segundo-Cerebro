# Registro de decisões

Formato: o que foi decidido · alternativas consideradas · motivo · data. Decisões estratégicas são sempre do Kauan; as tomadas pelo agente são operacionais e estão marcadas como tal.

| ID | Decisão | Alternativas consideradas | Motivo | Quem | Data |
|---|---|---|---|---|---|
| D-001 | Documentos de planejamento ficam em `Novo  -- Segundo Cerebro\docs\planejamento\`, um arquivo por seção + índice | Pasta `docs/planejamento` dentro do repo antigo; raiz da pasta nova | Instrução direta do Kauan na abertura do trabalho ("Estruture todos os arquivos criados... dentro do diretório") | Kauan | 23/09/2026 |
| D-002 | As 4 imagens de layout enviadas pelo Kauan são a linha de referência visual do novo produto | — | Instrução direta ("quero seguir essa linha de referencia"); salvas em `referencias/` e analisadas em `referencias-visuais.md` | Kauan | 23/09/2026 |
| D-003 | Investigação lê a working copy local como fonte do repositório (remote confirmado: `kauanbarateli/segundo_cerebro`), com clone de trabalho no scratchpad para checkout da v2 e instalação da Impeccable | Clonar do GitHub por SSH/HTTPS | A working copy local **é** o repositório pedido (mesmo remote), já sincronizada com `origin/main`; evita depender de autenticação e não escreve nada no original | Agente (operacional) | 23/09/2026 |
| D-004 | Diagnóstico cobre a `main` E a branch `v2-interface-e-financeiro`, tratando a v2 como estado mais avançado do Financeiro/responsividade | Diagnosticar só a main | A v2 contém a main inteira + 13 commits de trabalho recente e planejado (95 arquivos, +14.690 linhas); ignorá-la descreveria um produto que já não existe | Agente (operacional) | 23/09/2026 |
| D-005 | Impeccable: detector determinístico rodado nas duas branches via CLI; lentes `critique`/`audit` aplicadas manualmente sobre o código (modo estático declarado), porque rodar o app com dados reais exigiria credenciais do Supabase | Subir o app localmente para detect por DOM | Sem credenciais não há dado além do login; o modo estático é declarado como limitação no diagnóstico, conforme a própria regra da skill sobre execuções degradadas | Agente (operacional) | 23/09/2026 |

## Rodada 1 — respostas do Kauan (23/09/2026)

| ID | Decisão | Origem |
|---|---|---|
| D-006 | **Financeiro por fusão:** main e v2 são referência; o novo produto funde os dois modelos (status/exclusão lógica/plano do mês da v2 + pagamento parcial/`serie_tipo`/horizontes de dívida da main) | Q1 = a |
| D-007 | O banco antigo recebeu "todas as migrations" (declaração do Kauan; qual `0023` exatamente, não verificado) — **mas será criado um novo projeto Supabase**, então o estado exato do banco antigo deixa de importar para o plano | Q2 |
| D-008 | **Sem migração de dados:** a nova versão nasce limpa; o banco antigo vira arquivo morto | Q3 = b |
| D-009 | O repositório `novo-segundo-cerebro` é **incorporado como fonte** do planejamento; os 5 ADRs e o glossário serão validados um a um na rodada 2 | Q4 = a |
| D-010 | Seguir **sem o REQ-FIN** original; `DIVERGENCIAS-REQ-FIN.md` + plano da v2 são a fonte do requisito do Financeiro | Q5 = b |
| D-011 | **Uso pessoal + pessoas próximas, sem cobrança.** Multiusuário limpo, sem billing no MVP | Q6 = a |
| D-012 | **Direção visual confirmada** (bento, raios generosos, trilho em pílula, monocromia com preto como acento, vidro na moldura); a **marca "2" atual evolui** dentro da nova estética | Q8 = a |
| D-013 | **Tema claro de nascença** (glass da ref-01), escuro derivado com o mesmo rigor; **trocar a Inter** — candidatas com amostras serão apresentadas no doc 04 (interpretação de "Q9 = A" cobrindo 9.1 e 9.2; Kauan pode corrigir) | Q9 = a |
| D-014 | **Custo-alvo ~zero** (free tiers) no cenário inicial; degraus de custo documentados no doc 03 | Q10 = a |
| D-015 | A metodologia de tickets ("Match-SPOC") é definida pelo repositório **`https://github.com/mattpocock/skills.git`** — investigada e documentada no [anexo-b-metodologia-match-spoc.md](anexo-b-metodologia-match-spoc.md) | Q11 |

## Rodada 2 — respostas do Kauan (23/09/2026)

| ID | Decisão | Origem |
|---|---|---|
| D-016 | **Taxonomia completa confirmada:** Início, Capturar, Conhecimento (com grafo), Tarefas, Calendário, Drive, Projetos, Hábitos, Financeiro, Cofre, Configurações, Integrações, Admin | R1 = a |
| D-017 | **ClickUp mantido** (fase 2, com a validação contra a API real que nunca aconteceu) — *presunção declarada na R1.1, não contestada; Kauan pode reverter a qualquer momento antes do ticket correspondente* | R1.1 (presumido) |
| D-018 | **Stack confirmada:** Supabase (projeto novo) + Next.js 15 + **Tailwind 4** (preset → `@theme`) + Vercel Hobby | R2 = a |
| D-019 | **Os 5 ADRs do `novo-segundo-cerebro` adotados** com as duas conciliações (ADR-0003 com "Plano Pessoal" implícito, sem billing; ADR-0004 com Cofre só em metadados) + extensões de glossário do doc 05 §4 | R3 = a |
| D-020 | **Gmail: roadmap "futuro"**, sem compromisso de fase | R4 = a |
| D-021 | **Cofre mantém o modelo E2E** (senha mestra + kit, irrecuperável sem eles) com as 7 evoluções do doc 09 §3 | R5 = a |
| D-022 | **Métricas do admin por eventos próprios no Postgres** (enum fechado, sem conteúdo) + rollup diário; sem ferramenta externa | R6 = a |
| D-023 | **Corte de MVP aprovado** como no doc 11; pedido adicional atendido: o planejamento futuro completo do projeto vira o doc 12 (Roadmap) | R7 = a |
| D-024 | **Formato de specs/tickets aprovado** (anexo B §3): épico = spec-issue, milestone = fase, ticket = tracer-bullet com bloqueio nativo, áreas/módulos em vez de caminhos de arquivo | R8 = a |
| D-025 | **Fonte do DS 2.0: Geist** (escolhida no mostruário; a recomendação era Instrument Sans — decisão do Kauan prevalece). Registro do trade-off aceito: sotaque "ferramenta técnica"/ecossistema Vercel em troca dos melhores numerais tabulares do grupo | R9 = d |
| D-026 | **Repositório novo `kauanbarateli/segundo-cerebro`** com raiz na pasta `Novo  -- Segundo Cerebro` (app + planejamento versionados juntos); aproveitamento por cópia; `novo-segundo-cerebro` arquivado como fonte | R10 = a |
| D-027 | **Grafo: MVP = wiki-links + backlinks + "Relacionado" clicável; grafo visual (vizinhança) na fase 2** | R11 = a |

## Artefatos derivados

| ID | Artefato | Detalhes |
|---|---|---|
| D-029 | **Remodelagem Impeccable do protótipo (v2)**, a pedido do Kauan (busca desagradável + pedir mais minimalismo/hierarquia): aplicadas as lentes `typeset` (escala de 6 papéis nomeados `--fs-*`, pesos reduzidos a 400/500/600), `layout` (ritmo: bento gap 20 × linhas internas apertadas; proximidade antes de contêiner), `distill` (estatísticas viram números planos no canvas sem cartão; categoria/prioridade de tabela viram texto+ponto em vez de badge; copy cortada; gradientes decorativos removidos) e `quieter` (busca e ícones do topo viram fantasmas dentro de UMA moldura; chips sem borda; compromisso borda OU sombra — cartões só borda, flutuantes só sombra; sombras 40–60px → 2–24px). Detector após a passada: **0 achados consultivos, 0 reais**; restam 215 falsos positivos de contraste cross-theme + 4 de padding (3 por cegueira do detector a `padding-left`, inset presente; 1 heurística) — todos verificados | Versão 2 publicada na mesma URL |
| D-028 | **Protótipo visual navegável** (pedido do Kauan em 23/09/2026): todas as telas do DS 2.0 em HTML puro, sem back-end — Início bento, Capturar, Tarefas (lista+quadro), Calendário, Conhecimento (editor+backlinks), Drive, Projetos (+detalhe), Hábitos, Financeiro (5 abas), Cofre (aberto+bloqueado), Configurações, Admin, Login, drawers e navegação mobile | Arquivo: `prototipo/prototipo-segundo-cerebro.html` · Publicado: <https://claude.ai/artifact/Cb3wdhPXBnrUzM8utNDx2w> · **Validação Impeccable:** todas as classes reais de achado zeradas (uppercase longo, texto <11px, tile-de-ícone, paddings — 23→0/1); restam 225 falsos positivos de contraste (o detector estático cruza texto de um tema com fundo do outro; pares `#000000 on #161615` etc. não existem em nenhum tema real) + 2 avisos consultivos da moldura de vidro (borda hairline + sombra difusa — assinatura consciente do DS 2.0, registrada como desvio) |

## Revisão do protótipo — 29/09/2026

| ID | Decisão | Alternativas consideradas / motivo | Quem / data |
|---|---|---|---|
| D-030 | Reformular Capturar como escrita ampla com notas conectadas, biblioteca, vínculos explícitos, wiki-links, backlinks e grafo interativo simulado; redesenhar busca compacta e perfil fotográfico no cabeçalho; refinar hierarquia e manter planejamento sincronizado. [Doc 14](14-prototipo-interacoes.md) é a especificação observada vigente do HTML. | Demanda direta do Kauan. Preserva identidade Geist/monocromia/neutros, taxonomia e regras fora do escopo. Dados são exemplos locais; foto é ilustrativa; anexo é nominal. Antecipar o grafo visual **não altera D-027**: a implementação persistente continua fase 2 e o grafo global de produção continua fase 3. D-028/D-029 e a URL publicada permanecem registros históricos; esta revisão é local, sem publicação remota declarada. | Kauan (escopo); agente (medidas e implementação operacional) · 29/09/2026 |
| D-031 | Instalar e disponibilizar **IMPECCABLE 4.4.0** em `.agents/skills/impeccable` no projeto e em `.codex/skills/impeccable` no perfil local para a continuidade das revisões. | Aplicação da skill solicitada nesta demanda; instalação local permite repetir o fluxo no projeto e instalação global permite descoberta pelo Codex. Não alterar o histórico dos diagnósticos executados com versões anteriores. A versão e resultados de cada execução são registrados separadamente no doc 14 §11; instalar a skill não significa detector/audit aprovados. | Agente (operacional) · 29/09/2026 |

## Pendentes (aguardam o Kauan)

- Nenhuma decisão **bloqueante** em aberto. O planejamento de produção (docs 00–13 + anexos) foi aprovado; a execução pode começar pelo Milestone 0. O doc 14 registra a revisão visual simulada de 29/09 e seu estado de validação.
- Reversíveis declaradas: D-017 (ClickUp presumido) e a densidade fina da tipografia (números finais medidos no Ticket de tokens, com Geist).
