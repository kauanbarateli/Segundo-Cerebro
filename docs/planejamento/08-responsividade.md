# H — Responsividade (requisito arquitetural)

**Herança:** a v2 do legado já formulou e **provou** a doutrina certa ("o celular não é a versão empilhada do computador", plano V2 §6). Este documento a adota como lei, estende para a nova estética (bento/glass) e a transforma em portões de CI. Prioridade: 1) desktop · 2) celular · 3) tablet · 4) formatos futuros — com a ressalva de que o DOM nasce na ordem do mobile (que é a ordem de importância e de foco).

---

## 1. As sete regras invioláveis (as cinco da v2 + duas novas)

1. **Nada ultrapassa a viewport.** Todo flex com texto leva `min-w-0`; todo texto longo leva `truncate`/`line-clamp`.
2. **Rolagem horizontal só DENTRO de bloco**, nunca na página — e o bloco que rola tem affordance (classe `.rola-x` herdada: máscara de borda + `overscroll-behavior-x: contain` + snap).
3. **Sem `overflow-x-hidden` global.** O transbordo é a evidência da regressão; escondê-lo é esconder o bug.
4. **Alvo de toque ≥ 44×44px** — quando o desenho for menor, `alvo-44` (o `::before` herdado), nunca inflar a caixa; dois alvos estendidos lado a lado exigem gap.
5. **`dvh`, nunca `vh`** (teste-guarda `regras-do-projeto.test.ts` herdado no CI).
6. **(nova) DOM na ordem do mobile.** O desktop reposiciona por grid (`order`/áreas), o foco segue o DOM — reordenação visual jamais quebra WCAG 2.4.3; validação por Tab nas larguras de desktop.
7. **(nova) Sem breakpoint abaixo de `sm` via `extend.screens`** (a v2 documentou a armadilha da ordem do CSS): a camada sem prefixo É o desenho de 320px; casos raros usam **container query** — que no novo stack é cidadã de primeira classe.

## 2. Faixas oficiais (herdadas da v2)

| Faixa | Alvo | Prefixo |
|---|---|---|
| 320–639 | celulares (320 é o piso de projeto) | (base) |
| 640–767 | phablet | `sm:` |
| 768–1023 | tablet retrato | `md:` |
| 1024–1279 | tablet paisagem/notebook pequeno | `lg:` |
| 1280–1535 | notebook | `xl:` |
| ≥1536 | desktop amplo | `2xl:` |

**Container queries** entram como ferramenta padrão para COMPONENTES (um cartão bento não pergunta "que tela é essa?", pergunta "quanto espaço EU tenho?") — os breakpoints de viewport ficam para o shell (sidebar, barra, colunas do bento). É o que permite o mesmo cartão viver no dashboard, numa coluna estreita e num futuro formato TV sem variantes duplicadas.

## 3. O shell responsivo da nova estética

| Elemento | 320–767 | 768–1023 | 1024–1535 | ≥1536 |
|---|---|---|---|---|
| Navegação | **barra inferior** (4 itens + "Mais"), safe-area, altura tokenizada | trilho de ícones em pílula (estreito, rótulo em tooltip) | trilho em pílula com rótulos | idem, respiro maior |
| Grade bento | 1 coluna (cartões empilham na ordem de importância) | 2 colunas | grade de 12 col. com áreas nomeadas por tela | idem, teto de conteúdo |
| Glass | **desligado ou mínimo** (custo de GPU; fundo sólido) | moldura leve | moldura completa | completa |
| Teto de conteúdo | — | — | tokenizado com a aritmética conferida do legado (recolher a barra devolve exatamente o que ela ocupa — regra herdada com as duas contas) | idem |

## 4. Padrões por tipo de superfície (decididos, não caso a caso)

- **Tabela ↔ cartão:** um único padrão no DS (`DataTable` da v2 evoluído): `<table>` com ordenação/paginação a partir de `md`, lista de cartões abaixo — **mesmo array filtrado/ordenado, nunca duas fontes**.
- **Formulários:** `Drawer` lateral no desktop, tela cheia/BottomSheet no mobile (padrão da v2); campos 100% → `sm:grid-cols-2` com a conta de largura documentada; input sempre ≥16px (piso anti-zoom iOS — no DS como invariante, para o `inputCls` paralelo do legado nunca renascer).
- **Gráficos:** SVG fluido (`preserveAspectRatio` + `vectorEffect` como no legado), eixo compacto no mobile (6 de 12 meses + rolagem), coluna interativa = `<button>` com foco (padrão v2), `resumoAcessivel` obrigatório via `ChartCard`.
- **Dashboards (Início/Financeiro):** bento com áreas nomeadas por breakpoint; limites responsivos de itens por lista (3 no mobile / 5 acima) pelo padrão CSS da v2 (`hidden sm:flex` + contador duplo), sem `useMediaQuery`.
- **Editor:** coluna única sempre; barra de ferramentas com overflow em menu no mobile; sidebar de cadernos = `SecaoRecolhivel` abaixo de `md` (padrão v2).
- **Grafo (fase do grafo):** canvas ocupa o bloco, gestos de pinch/drag no mobile, e um modo lista (vizinhança como lista) como equivalente acessível e de telas pequenas — o grafo nunca é o único caminho até a informação.
- **Modais:** só para confirmações curtas; conteúdo longo é Drawer/página — decisão de DS que elimina a classe de problema "modal de formulário no celular".

## 5. Correções que o novo produto já nasce sem (lições do diagnóstico)

Sem logout ausente no mobile (ações de conta vivem no shell mobile), sem ações de item que só existem no desktop (todo item tem o mesmo menu nas duas formas), sem tela "disponível no desktop" (Kanban mobile = colunas com rolagem horizontal snap), sem mês de calendário sem versão móvel (mês vira lista de semanas no mobile), sem `/ajuda` inalcançável (rota fixa no "Mais").

## 6. Portões de verificação (CI + manuais)

1. **e2e de transbordo** nas larguras 320, 390 e 768 varrendo todas as rotas (herda e amplia o spec da v2 que aponta o elemento culpado).
2. **e2e de alvo mínimo** (nenhum interativo <44px na dimensão menor) nas rotas densas.
3. Teste-guarda das regras (5) e (7).
4. Checklist manual por release: Tab na ordem visual em 1440; teclado+leitor nas 3 telas principais; `prefers-reduced-motion`; teste de um fluxo completo no iPhone real (Safari esconde o que emulador não mostra — lição da v2 com `vh`/safe-area).

## 7. Valores observados no protótipo — D-030

As faixas acima regem o app de produção. Para recriar o HTML desta revisão, usar os breakpoints reais do [doc 14 §2](14-prototipo-interacoes.md): trilho completo a partir de 1120px, trilho de ícones entre 768–1119px, barra inferior até 767px; editor/grafo com biblioteca/detalhe lateral somente acima de 1000px. A coluna de escrita vem primeiro no DOM. A 1000px ou menos, biblioteca vai abaixo; suas notas usam duas colunas até 768px e uma no mobile.

Corpo de escrita tem mínimo 340px desktop/300px mobile; rodapé Salvar sticky respeita a barra inferior (16px desktop/96px mobile). Cabeçalho mantém foto/tema e busca compacta; até 380px a marca textual cede espaço ao rótulo da busca. Diálogos têm limites em `dvh`, conteúdo rolável e foco modal. O grafo inicia em lista se a página carregar até 767px, com alternativa SVG ampliada por `viewBox="190 60 380 360"`, seleção por teclado e controles de zoom; não implementa pinch, que continua requisito de produção do §4. O documento inclui viewport e safe-area, sem ocultar transbordo globalmente. Configurações e auditoria Admin quebram linhas em até 480px, o heatmap usa colunas `minmax(0,1fr)` e labels ocultos da tabela Admin ficam contidos em `.twrap`. Resultados medidos em larguras e dispositivos devem ser consultados no doc 14 §11; requisitos não significam testes aprovados.
