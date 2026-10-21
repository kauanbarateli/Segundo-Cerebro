# Referências e reprodução visual

## Autoridade

Usar cores de `design-system/tokens/tokens.json` do projeto, comparadas ao snapshot `prototipo/design-system/tokens.json`; são fontes com estruturas possivelmente distintas, não arquivos para substituir um pelo outro. Manter Geist, marca “2”, neutros quentes, destaque monocromático e semânticas existentes. As fotos fornecidas orientam proporção/composição; não autorizam outra paleta.

Pontos de partida completos: [DESIGN do protótipo](prototipo/DESIGN.md), [contexto e fluxos](prototipo/PRODUCT.md), [briefs por superfície](prototipo/.impeccable/surfaces/), [capturas atuais](capturas/README.md). A documentação dentro do snapshot conserva as datas e limitações de cada entrega, inclusive frases históricas “sem publicação”; a publicação atual está neste pacote externo.

## Catálogo de referências

| Pedido / uso | Referência preservada | Arquivos de interação no snapshot |
|---|---|---|
| Layout/paletas originais | [Nove arquivos originais do doc 15](../15-aplicacao-layout-codex/referencias/) | `design-system/`, `styles.css`, `refinements.css` |
| Desktop/celular e capas | [Mobile Devices](prototipo/references/mobile-devices/) — inclui ea474ef… e 694348… | `devices.css`, `media.js/css`, `app.js` |
| Calendário com lista/rostos | [calendar-events-list.jpg](prototipo/references/calendar-events-list.jpg) | `calendar.js`, `calendar-list.css`, `calendar-device.css`, `calendar-people.js/css` |
| Captura lateral e editor | [capture-editor.jpg](prototipo/references/capture-editor.jpg) | `capture.js/css`, `richtext.js/css` |
| Hábitos mensal | [habits-monthly.png](prototipo/references/habits-monthly.png) | `habits-model.js`, `habits.js/css`, `onboarding.js`, `app.js::homeHabitVisual` |
| Financeiro nove estados | [finance-nine-screens.png](prototipo/references/finance-nine-screens.png) | `finance-model.js`, `finance.js/css`, `finance-cards.js/css`, `finance-goals.js/css` |
| Landing/checkout/legais/perfil | [public-flow](prototipo/references/public-flow/) | `public.js/css`, `checkout.js/css`, `profile.js/css`, `legal-content.js` |
| Onboarding enxuto | [onboarding.md](prototipo/.impeccable/surfaces/onboarding.md) | `onboarding.js/css`, nove telas com sete etapas opcionais |

As referências nove telas de Financeiro e Hábitos foram fornecidas pelo usuário nesta conversa; são guias de composição, não dados reais. Avatares dos convidados e capas demonstrativas foram gerados para a entrega; detalhes de proveniência acompanham os arquivos `.json`. Fonte Geist inclui licença. Não reutilizar dados reais de usuários em screenshots da landing.

## Medidas e comportamento

- Preservar shell existente de 232/76px (expandida/recolhida) e modal mobile, ajustando conforme estilos atuais do snapshot. Não reconstruir navegação. Layout operacional usa largura até 1600px e respiros 32/24/16px; piso 320px.
- Tipografia do layout: título de página 32/28px, seção 18px, corpo 14px, metadados 12px; campos pelo menos 16px e controles com alvo ≥44px. Usar aliases locais sem alterar escala global para resolver uma tela.
- Hierarquia operacional: uma ação principal, título curto, detalhes secundários recolhidos. Formulários completos podem ter divulgação progressiva; nunca esconder informação indispensável para decidir.
- Superfícies sólidas, bordas sutis e uma decisão de elevação; sem gradientes genéricos, badges decorativos, métricas fictícias ou repetição de títulos/subtítulos explicando o óbvio. Imagem de foco usa camada de contraste e fallback.
- Motion ligado a ações: feedback em torno de 120ms, superfícies 180ms, curva do DS; sidebar/conteúdo coordenados, reversão natural, foco sem esperar animação. `prefers-reduced-motion` reduz movimento. Não animar em cascata toda tela de trabalho.
- Onboarding: coluna até 560px, progresso, uma ação principal, “Pular”, voltar e “Fazer depois”; detalhes recolhidos. Nove telas: boas-vindas, nome/foco, Google, hábitos, projetos, tarefas, notas, outros espaços, resumo. Resumo mostra somente escolhas desta rodada.
- No mobile, grade semanal/tabela/quadro podem ter rolagem interna identificada; o documento não transborda. Captura alterna lista/editor com retorno claro. Calendário recolhe seu seletor secundário sem perder data/filtro. Diálogos mantêm ação e fechamento alcançáveis.

## Uso das skills na execução

Ler Impeccable local integral e referências pertinentes. Carregar `context` uma vez, inspecionar a verdade visual existente, fazer `critique`/`audit` inicial do delta e priorizar achados. Antes de editar UI, ler `craft-floor`; ao final, `polish` em rodada limitada com desktop/mobile juntos, corrigir achados e confirmar uma vez. `distill`, `adapt` e `animate` são recursos quando necessários, não motivo para trocar a identidade.

A origem das orientações frontend-design/Anthropic, Awesome Design Skills e Emil Kowalski consultadas nas entregas anteriores está em `prototipo/DESIGN.md`; conservar apenas recomendações compatíveis com o DS e o briefing. Não instalar bibliotecas de animação só para reproduzir transições CSS simples.

## Como produzir evidência

`scripts/capture-prototype.mjs` abre somente o snapshot em contexto isolado/offline. Pode usar `PLAYWRIGHT_MODULE` e `BROWSER_PATH` locais; sem configuração usa `@playwright/test` do projeto e seu Chromium. As capturas são referência visual, não teste conectado. Na produção, gerar equivalentes sobre fixtures autorizadas no SHA implementado, inclusive telas de erro/vazio/conflito; renovar as imagens de `/conheca` a partir dessa versão real.
