# Calendário — T025

## Convergência ao doc17 — 26/10/2026

O pedido atual do mantenedor substitui as composições históricas abaixo: Lista com lateral interna de 330 px onde houver espaço para sete alvos de 44 px, separador e cartões planos com trilho de data; Dia como agenda linear expansível; celular com seletor de sete dias ou 42 datas do mês e agenda do dia selecionado. A Semana e o Mês desktop conservam suas grades. Seleção de data preserva a vista e o scroll fica contido no seletor.

Fuso, cache parcial, fontes ocultas, OAuth somente leitura, até duas contas, Drawer, notas e Entitlements permanecem reais. O DTO não contém descrição/texto da nota: não inventar parágrafos ou consultar outro canal para preencher o mock. Participantes usam iniciais permitidas. Em 320 px, setas → Hoje conservam a mesma ordem no DOM e na tela. O código recebeu revisão independente e 22 contratos estáticos; geometria, contraste, teclado e QA da Source integrada ainda exigem validação própria.

## Histórico — não substitui o doc17 vigente

Direção Operate do DS 2.1 existente: Geist, superfícies neutras, hierarquia da grade, Button/Field/Switch/Drawer. Referência inspecionada: `docs/implementation/evidence/t011-t012/calendar-month-1440-light.png`. Preservar lista mensal mobile, scroll interno da semana e foco das primitivas.

Objetivo: escolher fontes de até duas contas, ler compromissos no período, sincronizar ou recuperar conexão, ligar uma nota e abrir o evento. Contas/fontes ficam num bloco contínuo antes da grade, sem métricas ilustrativas. Exibir leitura Google, pendência de revogação, retorno OAuth seguro e erro recuperável. Fim de all-day explicitamente exclusivo; relógio do app em São Paulo.

Contexto local Impeccable/PRODUCT/DESIGN e new-work/operate/craft-floor lidos. Context loader não executou por ausência do engine no cache permitido; contexto lido diretamente. Markup React real e regras de fronteira testados localmente; ESLint DS usado. Sem build/servidor/browser por orientação do trabalho. A revisão visual conectada, temas, mobile, teclado e conteúdo longo está pendente; a referência é direção, não uma captura desta implementação.


## Layout Codex (D-033, #46)

Substitui a direção acima (contas antes da grade). Composição atual: barra de período (título 22px, “ano · Semana N”, setas de 44px, Hoje, Dia/Semana/Mês/Lista com `aria-pressed`); lateral interna de 208/190/228px com minicalendário (semanas como alvos de 44px na largura toda), campo de data, “Meus calendários” em checkboxes com contagem e bloco Google; linha do tempo de 80px por hora (faixa 07–21h expandida quando preciso), dia inteiro em trilhas de 48px com término exclusivo e conflitos em colunas de 50px; Mês com 42 células e `+N`; Lista apenas na URL (`view=list`), nunca salva como preferência. Até 680px a visão vira agenda. A gestão de contas é o componente compartilhado com Integrações; no modo conectado o Calendário mantém a seção Contas Google. Relatório e desvios: `docs/implementation/layout-codex-ds21/README.md`.
