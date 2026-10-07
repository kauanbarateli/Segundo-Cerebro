# D — Novo Design System ("DS 2.0")

**Ponto de partida:** o workspace `design-system/` do `novo-segundo-cerebro` — snapshot **validado** (36/36) do DS 1.0 do legado — entra como **infraestrutura e linha de base**: arquitetura de tokens, validador, docs de padrões/acessibilidade, marca. Sobre ele, o DS 2.0 aplica a direção confirmada em D-012/D-013 ([referencias-visuais.md](referencias/referencias-visuais.md)): **bento, raios generosos, trilho em pílula, monocromia com preto como acento, vidro na moldura, números editoriais** — tema claro de nascença, escuro com o mesmo rigor. Formato final: `PRODUCT.md` + `DESIGN.md` no novo repo (Impeccable `init`/`document`), com `detect`/`audit` no CI.

**Método herdado e inegociável:** todo valor novo nasce marcado **OBSERVADO / INFERIDO / RECOMENDADO**, contraste **medido contra os 4 fundos de cada tema** antes de entrar, desvio consciente ganha registro com porquê, e comentário que descreve o passado é regressão.

## Revisão vigente do protótipo — DS 2.1, 29/09/2026

D-030 preserva a identidade do DS 2.0 e refina escrita, busca e conexões. O [doc 14 §2](14-prototipo-interacoes.md#2-direção-visual-e-anatomia) contém os valores **OBSERVADOS** no HTML e prevalece sobre as propostas de medidas abaixo para recriar esta demonstração: corpo de escrita 16px/1.8, mínimo 340px (300px mobile); cabeçalho 60px; busca/ações 44px; título de página 28px (24px mobile); editor com biblioteca subordinada e opções recolhidas. Labels ficam em caixa normal, telas não animam sua entrada e a organização da Home usa uma proporção calculada da coleção de notas.

Componentes demonstrados: mesa de escrita, biblioteca/filtros, chips de vínculo, sugestões `[[...]]`, backlinks, detalhe e lista do grafo, diálogo de busca, diálogo de vínculo, popover de perfil e toast persistente com Desfazer. Estados e limites estão nos §§4–10 do doc 14. A foto é ilustrativa e embutida; Geist continua carregada por Google Fonts com fallback no HTML, enquanto `next/font` permanece o plano de produção. Os resultados de contraste/detector desta revisão pertencem exclusivamente ao doc 14 §11, sem herdar aprovação de D-028/D-029.

Refinamentos observados da passada final: `--subtle` claro `#62615b`/escuro `#a09e94`; hover inverso preserva sua dupla de cores; popover de perfil tem sombra sem borda. Barra de ações precede o corpo; rodapé de salvar é sticky (16px desktop/96px mobile); remoção de vínculo/anexo mede 44×44px. No grafo, nós têm área SVG de interação 64×84 e texto 15px/18px. Hierarquia semântica do Kanban e quebras dos módulos densos são detalhadas no doc 14 §9.

---

## 1. Fundamentos

### 1.1 Cor (evolução calibrada, não revolução)
- Neutros **quentes** herdados (canvas `#f5f5f2`, superfícies, tintas) — já resolvem o antipadrão "preto/cinza puros" da Impeccable por baixo da estética monocromática das referências.
- **Preto como acento** (`accent = ink`) mantido — é a identidade; superfícies escuras de ênfase (cartão preto das referências) ganham tokens próprios (`surface-inverse`, `ink-inverse`) com dupla de contraste medida, e a regra herdada evolui: **1–3 blocos escuros por tela** (as referências usam mais que o "1" do legado; o teto evita virar tema escuro acidental).
- Semânticas com **dois degraus** (`x`/`x-ink`) herdadas intactas; categóricas do Financeiro (8 tons medidos) herdadas; o **teal do módulo Financeiro** (lição da v2, com `fin-ink` a 4.5:1) mantido como cor de módulo escopada.
- **Vidro:** tokens `glass-surface` (rgba + blur), `glass-border`, `glass-fallback` (opaco) — uso restrito à **moldura do app** (trilho, cabeçalho, sheets), nunca em cartões de dados; contraste medido sobre o pior fundo possível; `backdrop-filter` desligado em mobile de baixo desempenho e sob `prefers-reduced-transparency`.
- Regra 90/10 e "cor nunca é a única informação": leis herdadas.

### 1.2 Tipografia (a correção da maior dívida do legado)
- **Uma escala nomeada, papéis explícitos, zero degrau solto** — o CI barra `text-sm|lg|xl|2xl…` cru (lint) para a fragmentação (14 tamanhos!) nunca voltar.
- Proposta de escala (RECOMENDADO; números finais medidos no Ticket 01 com a fonte escolhida): `display` clamp(40→64) para o herói editorial · `h2` 28 · `h3` 22 · `corpo-forte` 16 · **`corpo` 15** (leitura) · **`dado` 13** (tabelas/listas densas — a lição da reversão do legado: densidade é decisão de produto; aqui ela ganha NOME e regra: *lê → corpo; consulta → dado*) · `legenda` 12 · `micro` 10 (exceção documentada, só eixo de gráfico). Campo de formulário ≥16px sempre (piso iOS herdado como invariante).
- **Números editoriais:** KPIs em `display/h2` com `tabular-nums` obrigatório em todo valor/tabela (herdado da v2).
- **Família: Geist** (✅ decidida — D-025, escolhida pelo Kauan no mostruário da rodada 2 entre Instrument Sans, Schibsted Grotesk, Onest e Geist). Pontos fortes que a escolha compra: desenho exato e os melhores **numerais tabulares** do grupo — sob medida para o Financeiro e os KPIs editoriais. Trade-off registrado: sotaque técnico/ecossistema Vercel; o antídoto é a identidade vir da composição (bento, marca "2", neutros quentes), não da fonte. Servida via `next/font` self-hosted, `display: swap`, com fallback de sistema declarado; `tabular-nums` obrigatório em valores e tabelas.

### 1.3 Forma, espaço, elevação, movimento
- **Raios (a assinatura bento):** `xs 4 · sm 8 · md 12 (controles) · lg 20 (cartões, sobe de 18) · xl 28 (blocos bento/hero) · 2xl 36 (moldura/sheets) · full` — pílula para navegação/chips/busca.
- Espaçamento 4pt herdado; **grade bento**: 12 colunas com áreas nomeadas por tela e `gap` generoso (24/32); container queries dirigem o interior dos cartões (doc 08 §2).
- Elevação por tema (sombra que existe no escuro — herdado da v2) + nova camada `float` para o painel de vidro; **escala `zIndex` nomeada** (o workspace já a criou — adotada, mata os `z-[88]` soltos).
- Movimento: 120/180ms + curva única herdadas; **piso de reduced-motion blindado** (a regra mais protegida do legado) + `prefers-reduced-transparency` para o vidro; proibições mantidas (`animation-delay`, animação por JS, easing elástico).

## 2. Componentes (inventário DS 2.0)

**Herdados por porte** (dos snapshots validados, com as pendências do anexo A §4 corrigidas — `sb-target-44`, `.eyebrow`, scrollbar, `toast-out`): Button (**ganha estado `loading`**), Card (raio novo), Badge/Pill (ponto semântico), Modal (a implementação-referência de foco), DropdownMenu, Avatar, Icons (47, traço 1.75), Logotipo ("2" evolui na nova estética — refinamento, não redesenho), states (Empty/Error/Skeleton), Quadro.
**Promovidos da v2 a primitivos de primeira classe:** Drawer (formulários desktop) · BottomSheet (mobile) · DataTable (ordenação/paginação; par tabela↔cartão) · Tooltip acessível · MetricCard/FaixaDeMetricas (KPIs bento) · ChartCard (`resumoAcessivel` obrigatório) · ProgressBar · SecaoRecolhivel · NavegacaoInternaDaPagina · armadilha-de-foco compartilhada.
**Novos do DS 2.0:** **Switch** (o legado o duplicou 4×) · **Dialog de confirmação unificado** (herda TODO o rigor do Modal — mata o ConfirmationDialog fraco) · Toast v2 (dispensável, pausa no hover, ação "Desfazer" — base do soft delete) · **CommandPalette** (Ctrl/K: capturar, navegar, buscar) · TrilhoDeNavegacao (pílula desktop/tablet) + BarraInferior (mobile, safe-area, 4+Mais) · CartaoBento (variantes claro/escuro/tinted/glass-moldura) · CampoDeBusca pílula · GraphView (lazy, fase do grafo).
Para cada componente: variantes, estados (`default/hover/pressed/focus-visible/disabled/loading`), comportamento desktop×mobile — documentados no `DESIGN.md` executável, com a **matriz de 16 componentes** do workspace como baseline de medidas e contratos de a11y.

## 3. Estados e acessibilidade (pisos herdados + correções)

Foco global de duas camadas · `sb-target-44` com a regra do gap · contraste AA medido nos 4 fundos (validador roda no CI) · **skip-link** (novo) · `aria-invalid`/`aria-describedby` como contrato de TODO campo (era 0 no legado) · foco visível em item de menu (fecha o ~1,14:1) · skeleton por rota com a geometria real (o legado tinha 1 genérico) · Empty states calmos herdados · Error com retry que **aparece** (doc 02 §3) · offline com `AvisoDeOffline` herdado.

## 4. Como o DS 2.0 nasce (processo no Ticket 01)

1. `/impeccable init` → `PRODUCT.md` (verdade de produto: os docs 01/05 + decisões D-011/12/13 alimentam).
2. Recalibrar `tokens.json/tokens.css` (workspace) para os valores 2.0 → **validador atualizado roda no CI** (JSON×CSS×contraste×hashes de marca).
3. `@theme` do Tailwind 4 consumindo o `tokens.css` (o preset JS aposenta).
4. Telas de referência (Início, Financeiro/Painel, Conhecimento) montadas com as lentes `shape → typeset → layout → colorize → adapt → harden → onboard` e conferidas com `npx impeccable detect` + `audit` — os antipadrões (fonte batida, cinza puro, cards aninhados, bounce) são portão, não conselho.
5. `DESIGN.md` gerado/curado com os desvios conscientes numerados (a tradição do legado que a Impeccable formaliza).
