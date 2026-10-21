# Mobile Devices — Início e Calendário

Registro da adaptação local de 19/10/2026. Entrada em [index.html](../../index.html), rotas `#/inicio` e `#/calendario`. Implementação em [app.js](../../app.js), [devices.css](../../devices.css), [calendar.js](../../calendar.js) e [calendar-device.css](../../calendar-device.css). Identidade global em [DESIGN.md](../../DESIGN.md), comportamento em [PRODUCT.md](../../PRODUCT.md) e evidências em [VALIDACAO.md](../../VALIDACAO.md).

## Propósito

**Modo: Operate.** Adaptar o protótipo existente às referências fornecidas para desktop e celular. Projetos, tarefas e agenda devem ser fáceis de reconhecer e percorrer, mantendo os mesmos registros e relações. A extensão preserva o onboarding simplificado, os módulos, as regras de leitura do calendário e a identidade DS 2.1.

## Direção da superfície

**THESIS:** Uma próxima ação clara no Início; um dia selecionado e seus horários claros na agenda móvel.

**OWN-WORLD:** Marca geométrica “2”, Geist local, neutros quentes e acento monocromático do DS 2.1. As cores semânticas identificam fontes e estados. As imagens orientam composição, sem se tornarem uma nova paleta.

**STORY:** Identificar a próxima tarefa, consultar o progresso, abrir um projeto e escolher um dia para ler os compromissos e seu contexto.

**FIRST VIEWPORT:** No Início, cabeçalho e foco diário precedem os projetos. Na agenda móvel, título e controles de período conduzem ao seletor de datas e à agenda selecionada. A quantidade visível depende da largura, da altura e do conteúdo; nenhum módulo depende de caber integralmente na primeira tela.

**FORM:** Desktop com espaço para colunas e grade semanal. Celular com projetos em trilho horizontal e compromissos em agenda linear, mantendo horários fora dos cartões. A navegação inferior reúne os destinos frequentes, com captura no centro.

**SIGNATURE:** A superfície de foco e o dia selecionado compartilham o acento monocromático; linhas de horário e metadados sustentam a leitura sem disputar atenção com títulos e ações.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Identidade e medidas herdadas

Tokens permanecem em [tokens.json](../../design-system/tokens.json) e [colors.css](../../design-system/colors.css). Não há novos tokens de cor, família tipográfica ou identidade de marca. A hierarquia compartilhada de corpo, campos, rótulos e metadados permanece; tamanhos específicos pertencem à superfície.

O Início usa foco com raio de 16 px e título de 24 px no desktop, 21 px no celular. Projetos usam raio de 12 px, título de 17 px e metadados de 12 px. O progresso é um elemento nativo com altura visual de 4 px e rótulo acessível. A agenda linear usa cartões com raio de 14 px e títulos de 16 px no desktop, 14 px no celular. Horários e fontes usam 12–13 px. A faixa semanal mantém alvos mínimos de 44 px por 78 px; o seletor mensal mantém 44 px por 44 px. Essas medidas locais não redefinem os componentes globais.

O ritmo principal usa 12/16/20/24/28/32 px conforme relação entre controles, cartões e seções. Sombras ficam restritas a superfícies sobrepostas, como a navegação móvel. O destaque de compromisso usa superfície tonal, sem nova cor-base.

## Início

Próxima tarefa e progresso diário compartilham um bloco. Concluir a tarefa modifica o estado comum; o título seguinte e a contagem acompanham essa mudança. Hábitos do dia permanecem associados à elegibilidade das práticas existentes.

“Seus projetos” mostra até três registros com status ativo, antes das tarefas e da agenda. Cada cartão abre o projeto, mostra descrição quando disponível e deriva o progresso das tarefas não apagadas e não arquivadas. A ausência de tarefas é explícita. Sem projetos ativos, há uma orientação curta e ação de criar. “Ver todos” mantém acesso à lista completa.

Acima de 1100 px, os projetos ocupam três colunas; de 601 a 1100 px, duas, com o último cartão ocupando a linha disponível; até 600 px, formam um trilho com cartões de 78% da largura e parte do seguinte visível. O trilho usa rolagem nativa e `scroll-snap` por proximidade. A navegação por links e teclado permanece disponível; não há arraste obrigatório nem gesto customizado.

## Calendário

Acima de 680 px, Semana mantém a grade temporal, Mês mantém a grade mensal, Lista mantém a agenda do mês e Dia usa agenda linear. A lateral de minicalendário/fontes cede espaço quando o contêiner do calendário tem até 900 px; o botão de fontes preserva as opções.

Até 680 px, Dia e Semana apresentam uma faixa de sete dias seguida apenas da agenda selecionada. Mês apresenta uma grade de seleção de datas e a mesma agenda. Lista mostra os dias com compromissos do mês. O comportamento de período permanece distinto: um dia, sete dias ou um mês, conforme a visão. Selecionar uma data não força outra visão.

O seletor usa texto, estado pressionado e acento para identificar a data escolhida. Hoje tem identificação própria, e pontos indicam dias com compromissos das fontes visíveis. Nomes acessíveis incluem data completa e quantidade. Em 320 px, os seletores podem rolar internamente para conservar alvos de 44 px. Após a renderização, apenas a posição horizontal interna é ajustada para revelar a data selecionada; a página e o foco não são deslocados.

A agenda linear mostra dia inteiro antes dos horários. A coluna externa contém início/fim ou “Dia inteiro”; continuação de eventos e fim exclusivo dos eventos de vários dias permanecem coerentes com os registros. Cada cartão mostra título, fonte nomeada, duração e indicador de nota existente.

Expandir um cartão revela contexto do compromisso ou da nota vinculada, local quando disponível e ações de detalhe/nota. Há no máximo um contexto aberto; a escolha inicial do dia privilegia um compromisso com contexto, ou o primeiro disponível. A pessoa pode recolher todos. “Ver detalhes” abre o painel completo e mantém “Criar tarefa relacionada”. Não foram inventados participantes, avatares, reuniões ou ações de escrita no Google.

Dia sem eventos oferece outra data ou revisão de calendários. Fontes ocultas continuam identificadas por mensagem. As mesmas fontes alimentam o Início. Redimensionar preserva data, visão e filtros; muda somente a representação.

## Navegação, interação e movimento

Até 600 px, a barra inferior fixa reúne Início, Tarefas, Capturar, Agenda e Mais. Capturar recebe um ícone circular em acento, com rótulo visível; a rota ativa usa estado visual e `aria-current`. Mais continua abrindo o menu com gestão de foco existente. Buscar aparece no topo.

A barra tem 72 px de altura e distância inferior de `10px + safe-area-inset-bottom`. O conteúdo reserva `112px + safe-area-inset-bottom`; mensagens usam posição acima da barra. O viewport usa `viewport-fit=cover`. Alvos principais mantêm 44 px e o foco continua visível nos dois temas.

As transições reaproveitam durações e curvas do projeto. Mudança de período usa 180 ms e deslocamento curto, desativado por movimento reduzido ou operação de teclado. Seleção e expansão respondem imediatamente; rolagem permanece nativa e pode ser interrompida. `prefers-reduced-motion` também remove a transição dos projetos. A adaptação não acrescenta entradas em cascata ou movimento decorativo repetido.

## Referências e proveniência

As duas imagens foram fornecidas pelo usuário em `C:\Users\Kauan Sousa Barateli\Downloads\Mobile Devices` e copiadas para a entrega. Autoria e licença não foram informadas.

| Arquivo | Observação e interpretação |
|---|---|
| [3df5e69013c107c5cc78be9ebeec9e27.jpg](../../references/mobile-devices/3df5e69013c107c5cc78be9ebeec9e27.jpg) | Composição monocromática de Início e agenda: projetos próximos de tarefas, faixa semanal com seleção forte, horários externos aos cartões e captura central. |
| [ea474ef2299b82b3f5a8372aa3bbbb7d.jpg](../../references/mobile-devices/ea474ef2299b82b3f5a8372aa3bbbb7d.jpg) | Início com foco/progresso, projetos horizontais e agenda linear com contexto em destaque. |

Os arquivos são material de referência, não imagens usadas pela interface. Fotos, avatares, a paleta das imagens e funcionalidades ilustrativas não foram reproduzidos. A extensão aplica as orientações Adapt, Layout, Polish e Craft Floor do Impeccable 4.4.0 ao contexto já estabelecido; não executa uma redefinição da identidade.

## Limites e validação

Datas e dados continuam demonstrativos, com referência em 17/10/2026. Não há OAuth, sincronização real, escrita Google, colaboração ou backend novo. O onboarding e suas opções permanecem disponíveis. Esta adaptação não atualiza o repositório, PR ou issues no GitHub.

Este documento registra composição e comportamento observados no código. Não representa aprovação de testes ou certificação de acessibilidade. Capturas, verificações executadas, revisão de acabamento e limitações da entrega devem ser consultadas em [VALIDACAO.md](../../VALIDACAO.md).

A unidade D: estava indisponível na sessão. A entrega atualizada permanece na pasta local `outputs/segundo-cerebro` da tarefa, com entrada em `index.html`; a pasta pode ser transportada integralmente.
