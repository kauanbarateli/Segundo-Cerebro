# Validação do protótipo — financeiro, hábitos e histórico de revisões

## Início: imagens em Pequenos hábitos — 21/10/2026

O Início usa o mesmo resolvedor de imagens da rotina, com miniaturas decorativas de **44 × 44 px**, imagens legadas preservadas e ícone quando a imagem está ausente, removida ou falha ao carregar. A alteração se limita a `app.js` e `refinements.css`.

`.impeccable/review/home-habit-images/verification.json` registra **seis combinações de largura e tema**: 320, 390 e 1440 px, claro/escuro, sem expansão horizontal do documento e com as três miniaturas carregadas em 44 × 44 px. Também passaram seleção de arquivo e salvamento da imagem personalizada, exibição no Início, marcação do hábito, persistência após recarga, remoção persistida e fallback em falha de carregamento; a lista de erros JavaScript está vazia. A microrevisão do diff e das capturas de 1440 px claro e 320 px escuro não encontrou impedimentos nesta alteração; parecer em `.impeccable/review/home-habit-images/review.md`. Esta revisão é pontual e não repete a validação dos demais módulos registrada abaixo.

## Financeiro: painel, cartões, recorrências e metas — 21/10/2026

Extensão local orientada pelos nove estados de `references/finance-nine-screens.png`, com imagem opcional nas metas conforme a confirmação do usuário. A implementação preserva marca, Geist, DS 2.1, dados anteriores e os demais módulos. As quatro visões — Visão geral, Lançamentos, Cartões e Planejamento — usam o mesmo modelo financeiro e a data fixa de 17/10/2026.

### Evidências desta revisão

- **13/13 testes do modelo passaram**, em `.impeccable/review/finance/model-results.json`: centavos, datas, totais originais, estados excluídos dos realizados, ciclos de cartão preservados, pagamentos parciais sem despesa duplicada, isolamento entre cartões, saldo insuficiente, aportes, recorrências limitadas a 12 meses e sem duplicatas, parcelas/datas curtas, limites independentes e gravação atômica com restauração em falha.
- **12/12 fluxos principais passaram no navegador**, em `.impeccable/review/finance/root-qa-results.json`: lançamento rápido, criar/editar/duplicar/excluir, confirmação futura rejeitada, pendente/cancelado, compra no cartão e repetição, filtros/busca, períodos, privacidade persistida, categorias e repetição do orçamento, ciclo de recorrência, falha de armazenamento, recarga, resumo do Início e restauração dos exemplos. Nenhuma falha ou erro JavaScript registrado nesse conjunto.
- **7/7 fluxos de cartões passaram**, em `.impeccable/review/finance/cards-qa-results.json`: validação e persistência dos quatro últimos dígitos, fatura e navegação das abas por teclado, preservação de ciclos ao editar, pagamento parcial e edição sem duplicação, recuperação de falha ao salvar e diálogos em 320/390/1440 px nos dois temas, com Escape.
- **9/9 verificações de metas passaram**, em `.impeccable/review/finance/goals-qa-results.json`: reserva inicial e capa existente, criação com imagem local/valor/prazo, cancelamento e remoção explícita de imagem, aporte com prévia sem despesa duplicada, saldo insuficiente, recuperação de falha, seletor de várias metas, editor em 320/390/1440 px nos dois temas, Escape e ocultação de valores/percentual. Total desta extensão: **41 verificações aprovadas**, sem contar inspeções visuais ou a revisão independente como testes adicionais.
- O estado inicial conserva **sete lançamentos**, **R$ 6.034,70 em contas**, **R$ 268,90 de dívida de cartão**, **R$ 6.500,00 de entradas** e **R$ 2.584,20 de despesas em outubro**. A meta inicial registra **R$ 2.400,00 de reserva demonstrativa para R$ 6.000,00**, sem debitar novamente as contas. Os saldos ilustrados na referência não foram fabricados no modelo.
- A matriz de capturas em `.impeccable/review/finance/screens/` cobre a Visão geral em **1440, 1024, 768, 390 e 320 px**, claro/escuro, além de lançamento, período, limite, cartão, fatura, meta e recorrência. `screens/metrics.json` registra os resultados daquele lote: a tela inicial e os diálogos medidos cabiam, mas recorrências preenchidas ainda ampliavam a página no celular. Esse arquivo é evidência anterior à correção final, não comprovação de ausência global de overflow.
- A revisão independente reexecutou a superfície em **Edge isolado, por arquivo local e offline**, após conter a grade e os rótulos acessíveis dentro da região de rolagem. Com recorrência criada e pausada, `review-evidence.json` confirma documento/viewport **320/320, 390/390, 768/768, 1024/1024 e 1440/1440**. As tabelas densas mantêm rolagem interna; elementos fora de sua área visível não implicam expansão do documento. Nenhum erro JavaScript nessa execução.
- A mesma revisão confirmou foco em **Meta → Editar meta** e **Fatura → Registrar pagamento**, retorno ao controle externo com Escape, foco ao alternar recorrência e ao fechar o seletor de período. A mensagem de data futura agora orienta **Pendente**, opção existente no formulário.
- Contrastes pontuais da revisão: bordas dos campos rápidos **6,21:1 no claro / 6,74:1 no escuro**; texto secundário **6,50:1 / 8,43:1**; tinta de sucesso **5,68:1 / 6,74:1**. A correção reutiliza `control-line`; não cria cor global. Há tabela alternativa ao gráfico, nomes de controles e erros com alerta. Isso não equivale a auditoria integral de acessibilidade.
- Detector Impeccable executado **uma vez**: zero achados primários e sete avisos consultivos no momento da execução. Ajustes posteriores corrigiram escalas do gráfico, valores e popover; raios compactos locais remanescentes não mudam o DS. A revisão independente consultou esse resultado após sua própria inspeção e concluiu **aprovado para entrega do protótipo local**, sem achados materiais remanescentes. O parecer está em `.impeccable/review/finance/review.md`; o detector não foi repetido.

### Limites e entrega

Os testes cobrem a implementação local e os cenários descritos. Não houve certificação com leitor de tela, aparelho físico ou Safari/iOS, nem nova auditoria completa de Hábitos ou dos demais módulos nesta extensão. Redução de movimento, foco e estados foram examinados na revisão; os valores numéricos de contraste acima são amostras. Dados, cartões, faturas, pagamentos e aportes continuam demonstrativos, sem autenticação, backend, instituição financeira, cobrança ou transferência real. Imagens de metas usam o componente local de mídia; exportação inclui as imagens já salvas.

Entrada direta: `index.html`, seguida de Financeiro, ou `index.html#/financeiro`. A cópia canônica permanece em `outputs/segundo-cerebro`, com o pacote `outputs/Segundo-Cerebro-Prototipo.zip`. O destino solicitado é `D:/USUÁRIOS/Kauan/TRABALHO/CÉREBRO - STARTUP (SEGUNDO CÉREBRO)/Prótotipos/Protótipo - Codex`; os 299 arquivos desta entrega foram copiados e conferidos por hash, preservando arquivos extras e um backup da versão anterior. As notas de indisponibilidade de D: nas revisões anteriores abaixo são históricas. O pacote ZIP foi aberto e comparado byte a byte com os arquivos locais. A conferência da entrega está em `work/finance-destination.json` e a do pacote em `work/finance-delivery.json`, na pasta de trabalho.

`PRODUCT.md`, o corpo de `DESIGN.md` e `LEIA-ME.txt` foram integrados ao contexto existente. O frontmatter de `DESIGN.md`, os tokens e o sidecar permanecem preservados. Não houve publicação, alteração de PR ou atualização da aplicação de produção.

## Hábitos: agendamento, imagens e desempenho — 21/10/2026

A extensão acrescenta dias específicos e meta semanal de 1 a 7 no onboarding, imagens opcionais no editor de hábitos, desempenho por semana/mês e filtro compartilhado entre análise e rotina. A referência `references/habits-monthly.png` orienta a composição. As métricas usam o histórico já existente e a data fixa da demonstração, **17/10/2026**: **14 registros em outubro, 51 práticas previstas até hoje e 27% de consistência**, sem acrescentar os 40 registros ilustrados na referência.

### Evidências desta revisão

- **9 grupos do modelo aprovados**, em `.impeccable/review/habits/model-results.json`: datas UTC, anos bissextos e transições de semana/mês/ano; dias específicos; exclusão de datas futuras e anteriores ao início; marcas duplicadas; limites de meta semanal e períodos parciais; preservação da frequência e da marcação no dia da mudança; pausa/arquivo e dados legados; intervalos vazios e inválidos; contagem real dos exemplos.
- **13 grupos funcionais aprovados**, em `functional-results.json`, no Edge isolado e offline: criação e recarga, três frequências, escolha de período e hábito, sincronização com Início/histórico/foco, upload com prévia e salvamento, cancelamento, remoção, rejeição de arquivos inválidos, pausa/arquivo e restauração, reversão em falha de armazenamento, tabela textual, estados vazios, passagem do onboarding ao módulo e Escape no celular. O relatório contém lista de erros vazia.
- **5 grupos de onboarding aprovados**, em `onboarding-results.json`: dias preservados após recarga; rejeição de programação vazia; três frequências e meta de cinco vezes; preparação por Continuar; transferência do contrato ao módulo; normalização de rascunho legado e bloqueio de programação incompleta pelo resumo. Claro/escuro em 320/390/1440 px não apresentou overflow; os controles de dias do onboarding têm pelo menos 44 px e foco por teclado.
- **10 combinações de largura e tema**, em `visual-checks.json`: 320, 390, 768, 1024 e 1440 px, claro e escuro. Em todas, largura do documento igual à do viewport, imagens carregadas e lista de erros vazia. A rotina móvel conserva os sete dias por hábito. Seus controles compactos têm 40 px de altura e aproximadamente 34–42 px de largura nas telas estreitas verificadas, acima de 24 px; não se declara que toda a grade tenha alvos de 44×44 px.
- **5 verificações finais aprovadas**, em `final-checks.json`: nome acessível do filtro e aplicação às duas superfícies; restauração de mês futuro ou vazio; marcação de data programada com toque emulado; composição com lateral expandida/recolhida; separação do último rótulo mensal em relação ao dia 30. Essas verificações complementam os grupos funcionais, sem representar uma nova auditoria de todos os módulos.
- **Detector executado uma vez: zero achados primários e 21 avisos consultivos**, em `detector.json`. O passe ocorreu antes do alinhamento tipográfico final; títulos, subtítulos e metadados foram ajustados para 20/16/12 px. O raio local de 2 px das barras é intencional. O detector não foi repetido após os ajustes ou pela revisão independente.
- A revisão independente em `review.md` e `verdict.md` está **aprovada, sem achados materiais pendentes**. Foram corrigidos e reconferidos: eixo numérico proporcional, espaçamento dos rótulos de datas, campo do mês em largura integral em 320 px, nome acessível “Filtrar hábitos” e restauração do período inválido. O revisor examinou código e capturas, incluindo as recapturas finais de 320/390/1440 px em claro e/ou escuro; não operou o navegador nem reexecutou o detector.
- Os pares textuais amostrados na revisão superam 4,5:1: texto secundário sobre superfície/canvas de 6,50:1/5,95:1 no claro e 8,43:1/9,05:1 no escuro; placeholders de 6,21:1/6,74:1. O gráfico oferece tabela textual; controles usam elementos nativos, nomes acessíveis e foco visível. Isso não constitui certificação de acessibilidade.

`habits-model.js` concentra datas, frequências e cálculos. `scheduleHistory`, `activityHistory` e `scheduleExceptions` preservam a leitura histórica ao mudar programação, pausa ou arquivo, inclusive a marcação do dia da mudança. A análise exclui datas futuras; a rotina mostra o planejamento da semana inteira. Os registros salvos e o histórico de atividades são restaurados quando a gravação falha. Imagens em JPG/PNG/WebP de até 8 MB são preparadas pelo módulo local de mídia; não há upload externo.

Os exemplos `h1`/`h3` reutilizam as imagens originais de leitura e planejamento; `h2` usa a fotografia de caminhada gerada em `assets/covers/habit-movement.png`, com prompt e origem no arquivo `.png.json`. A escolha pessoal ou remoção explícita prevalece sobre a imagem padrão. As evidências e a direção acompanham `.impeccable/review/habits/`; os resultados históricos das demais revisões permanecem abaixo.

### Limites e entrega

Os testes usam Edge/Chromium isolado, modo offline, larguras e toque emulados. Não houve teste em aparelho físico, Safari/iOS, Firefox ou leitor de tela, nem auditoria integral dos demais módulos. As falhas de armazenamento foram controladas; não representam esgotamento real da quota. Os resultados registrados cobrem a extensão de Hábitos e suas integrações exercitadas.

Registro histórico desta revisão: Marca, Geist, DS 2.1 e o frontmatter de DESIGN.md permanecem preservados. Não foi criado backend, alterada a aplicação de produção ou atualizado PR. A unidade D: originalmente solicitada está indisponível; os arquivos permanecem em `outputs/segundo-cerebro`, na pasta local desta tarefa em C:. O empacotamento é uma etapa separada destes resultados; esta seção não atesta a inspeção de um ZIP ainda não verificado.

## Apresentação pública, checkout simulado e perfil — 20/10/2026

A entrada sem hash passou a mostrar Conheça, com estrutura de `/conheca`, textos enxutos e capturas atuais. A extensão acrescenta checkout simulado de R$ 29,90/mês para acesso integral, termos/privacidade, onboarding opcional e foto local de perfil. As rotas diretas anteriores continuam disponíveis. Os registros seguintes são históricos; a antiga entrada automática no onboarding foi substituída pela apresentação pública.

### Evidências desta revisão

- **Fluxo público aprovado em Edge isolado, offline e por `file://`.** `results.json`, em `.impeccable/review/public/`, registra navegação por seções, prévia Projetos/Kanban, documentos, erros do checkout, diálogo legal preservando campos, confirmação simulada, sete etapas opcionais e painel personalizado. Coleções foram preservadas e o cartão não apareceu no estado salvo. Nenhum erro JavaScript ou requisição externa foi capturado.
- **320, 390, 768, 1024 e 1440 px, claro e escuro**, sem rolagem horizontal global nos estados públicos e de Configurações verificados. O relatório lista 21 capturas. `final-evidence.json` registra cores computadas de Conheça, checkout, termos e Configurações e foco com contorno sólido por teclado. A rodada atual exerceu armazenamento local em `file://` e movimento reduzido emulado; os limites antigos ao fim deste documento pertencem aos respectivos passes históricos.
- **17 verificações de perfil aprovadas**, em `profile-validation.json`: iniciais, processamento real da imagem exercitada em 320×320 px, salvamento e recarga, troca/remoção, prévia durante mudanças de tema/lateral, rejeição de formato/tamanho/URL externa, reversão em falha e nova tentativa. Perfil foi conferido em 1440/390/320 px nos dois temas, com campos de 16 px e controles medidos de 44 px de altura; menu móvel, foco, fundo inativo e Escape também foram exercitados.
- `checkout-validation.json` registra **15 verificações aprovadas**: envio vazio com sete erros, exemplo sem aceites automáticos, recusa de dados inválidos, reversão em falha, proteção contra confirmação duplicada, coleções e preferências preservadas, estado `simulated` e novo onboarding. Número, validade e CVV ficam fora dos objetos persistidos de assinatura e onboarding. Falhas foram injetadas por retorno falso/exceção, sem preencher quota real.
- Fontes e revisão confirmam a cópia dos textos e links de **13 seções de Termos e 14 de Privacidade**, minuta v0.2 do PR #70, head `b67f58ac3973fcef5f45daa23f36cdf84432a3fb`, aberto/draft na consulta de 20/10/2026. Os avisos de revisão e contratação futura permanecem. `references/public-flow/` guarda `fontes.json`, textos e fontes dos PRs #69/#70 e de `/conheca`; o preço do PR #69 é planejamento, sem aprovação de vendas ou jurídica.
- **Detector: zero achados primários e 25 avisos consultivos de escala local**, em `detector.json`. A revisão independente inspecionou 22 capturas e código. Marca, Geist, `design-system/tokens.json`, `design-system/colors.css`, frontmatter de DESIGN.md e `.impeccable/design.json` permanecem preservados. Cores computadas e pares declarados amostrados foram conferidos; não é certificação global de contraste.
- O único **P2** foi a união de palavras em três títulos móveis quando a quebra de linha era ocultada. Espaços literais corrigiram o texto. `fix-verification.json` confirma textos normalizados e ausência de overflow em **320/390/760/761/1440 px**, nos dois temas. `verdict.md` encerra o achado como **resolved — ship**, após código, quatro capturas atualizadas e seis recortes. O revisor não reexecutou navegador ou detector; o parecer final se restringe à correção e mantém os limites anteriores.

As 14 imagens de `assets/showcase/` vêm do protótipo local com exemplos fictícios, em 1440×1000 e 390×844; `provenance.json` registra a origem. A fixture geométrica do teste de perfil não se torna fotografia padrão do produto.

### Limites e entrega

Validação em Edge/Chromium com larguras emuladas, mouse e teclado, sem aparelho físico, Safari/iOS, Firefox, leitor de tela ou certificação WCAG. As falhas de armazenamento foram controladas, sem esgotar espaço real. A inspeção do cartão no estado não audita autofill, extensões ou mecanismos internos do navegador. Não houve auditoria integral dos demais módulos nesta revisão; seus resultados anteriores permanecem abaixo.

Checkout e assinatura são demonstrações, sem conta, cobrança, envio de cartão, autenticação, processador de pagamento ou ativação real. As minutas legais continuam em revisão. O onboarding pode ser pulado e conserva coleções, preferências e foto. Não houve novo PR, merge, publicação ou deploy.

Registro histórico desta revisão: Abra `index.html` por duplo clique, sem instalação, servidor ou internet. O destino `D:\USUÁRIOS\Kauan\TRABALHO\CÉREBRO - STARTUP (SEGUNDO CÉREBRO)\Prótotipos\Protótipo - Codex` está indisponível (`Test-Path: false`); a entrega permanece em `outputs/segundo-cerebro`, com `outputs/Segundo-Cerebro-Prototipo.zip` ao lado. `LEIA-ME.txt` começa pelo roteiro do fluxo novo.

## Capturar com lista lateral e texto formatado — 20/10/2026

Capturar passou a reunir busca, filtros e lista lateral com um editor amplo. A barra oferece estilos de parágrafo, ênfase, listas, alinhamento, links, limpeza e histórico de edição. O salvamento permanece explícito; rascunhos do editor principal ficam em memória entre seleções e rotas. A promoção para Conhecimento conserva HTML sanitizado e a conversão para tarefa mantém texto simples e origem. Até 1000 px de viewport, lista e editor se alternam com retorno explícito.

### Evidências desta revisão

- **Oito grupos de verificações no Edge isolado passaram**, em modo offline e com entrada `file://`. O código de execução está em `work/capture-browser.cjs`, na pasta de trabalho; o resultado entregue está em `.impeccable/review/capture/results.json`, com `passed: true` e nenhum erro JavaScript não tratado registrado.
- Os grupos cobrem composição em duas colunas, navegação lista/editor, dois temas e lateral recolhida; busca e filtros vazios; rascunhos entre seleção e rotas, descarte e persistência após salvar; controles de formatação e Ctrl+K restrito ao editor; promoção, cancelamento e origem; conversão em tarefa e captura rápida; falha simulada de armazenamento, reversão de dados/histórico e nova tentativa; referências entre notas formatadas, renomeação e ausência de duplicação.
- **14 PNG finais** em `.impeccable/review/capture` incluem desktop de 1440 px com lateral expandida/recolhida nos dois temas, lista/editor móvel de 390 px nos dois temas, documento formatado, texto longo em 360/768/1024 px e foco do título em claro/escuro. Não foi detectada rolagem horizontal global nos estados capturados. Seleção por teclado restaura o foco no editor; movimento reduzido desativa as transições verificadas.
- A suíte compartilhada `work/richtext-browser-tests.cjs` passou em **oito verificações de sanitização e serialização**, além do fluxo de controles: negrito, itálico, título, alinhamento, link permitido/recusado, desfazer/refazer, Ctrl+K, Escape, colagem e sincronização do texto simples/HTML. Os casos removem subárvores perigosas, atributos de evento e URLs não permitidas, normalizam formatação e preservam quebras de linha e links internos permitidos. Isso delimita o HTML aceito pelo editor local; não é uma auditoria de segurança de produção.
- A revisão independente de referência, contrato, código, resultados e 12 capturas de composição encontrou **dois P2**: cancelar uma URL inválida deixava um campo oculto bloqueando o salvamento, e o foco do título tinha contraste insuficiente. O campo de link agora é limpo e desabilitado ao fechar, e reabilitado ao reabrir; o título usa contorno em `--ink`. A regressão exercita Cancelar e Escape com URL inválida, validade do formulário, reabertura e salvamento persistido.
- O parecer final em `.impeccable/review/capture/verdict.md` registra **resolved — ship** para os dois achados. As duas novas imagens de foco foram inspecionadas; os pares do contorno com a superfície medem **18,13:1 no claro** e **16,01:1 no escuro**. O revisor leu o código, as asserções e o resultado atualizado, sem reexecutar os testes. O veredicto final se restringe às duas correções; os demais estados permanecem cobertos pela revisão anterior e pela recaptura registrada no resultado.
- O detector Impeccable foi executado uma vez. `.impeccable/review/capture/detector.json` contém **15 avisos consultivos de escala local e um aviso de fonte Geist**. As escalas do componente estão documentadas na prosa de DESIGN.md. Geist é exigida pela identidade vigente; o aviso não motivou substituição da fonte. O detector não foi repetido após as correções.
- A comparação da referência com a captura final confirma a aplicação da relação lista/documento e da hierarquia de ferramentas, mantendo marca, Geist, neutros e semânticas do DS 2.1. `design-system/tokens.json`, `design-system/colors.css`, o frontmatter de DESIGN.md e `.impeccable/design.json` foram preservados. Não foram copiados fotos, tipografia ou conteúdo da referência.

As prévias de entrega são `preview-captura-claro.png`, `preview-captura-escuro.png`, `preview-captura-mobile.png` e `preview-captura-formatada.png`. A referência fornecida está em `references/capture-editor.jpg`, acompanhada do registro de origem; o contrato está em `.impeccable/surfaces/capture-editor.md`. Os scripts de teste ficam em `work`, fora da pasta de execução. As prévias dos demais módulos e os registros abaixo preservam as revisões anteriores.

### Limites e entrega

Validação em Edge/Chromium com larguras emuladas e teclado, sem aparelho físico, Safari/iOS, Firefox, leitor de tela ou certificação WCAG. O foco do título teve medição pontual; isso não recalcula todos os contrastes da aplicação. O histórico de desfazer/refazer usa recursos do navegador, sem matriz de compatibilidade entre navegadores. A falha de armazenamento foi simulada. Não houve auditoria completa dos demais módulos nesta revisão.

Rascunhos do editor principal sobrevivem à seleção de outra captura e à troca de rota na mesma sessão, mas são perdidos ao recarregar ou fechar sem salvar. Cancelar a organização deixa a captura salva, sem conversão. Cancelar ou fechar por Escape a entrada de um link inválido não bloqueia o salvamento. Colagem e persistência sanitizam o HTML; imagens, anexos e incorporações não são recursos deste editor. Texto simples legado permanece compatível. Não há backend, colaboração, autenticação ou sincronização real.

Registro histórico desta revisão: Entrada: `index.html`, seguida de **Capturar**, sem instalação, servidor ou rede. A unidade D: está indisponível; a entrega local permanece em `outputs/segundo-cerebro`, na pasta desta tarefa em C:. Esta revisão não alterou GitHub, PR ou aplicação de produção.

## Calendário lateral, Lista e participantes — 20/10/2026

O Calendário recebeu um seletor lateral e uma Lista da data escolhida até o fim do mês, com cinco eventos por página, até dois eventos anteriores e seletor expansível quando a lateral não cabe. Lista é a abertura sem preferência explícita; preferências existentes e as visões Dia, Semana e Mês foram preservadas. Os rostos aparecem na Lista principal, na agenda diária e em Eventos anteriores; o painel de detalhes apresenta nomes completos.

### Evidências desta revisão

- **20/20 verificações de comportamento em Node/VM passaram**, registradas em `work/calendar-list-test-results.json`. Cobrem abertura e preferência Semana, quatro visões, filtros e contas disponíveis, intervalo selecionado, ordem, paginação e reinício da página, navegação entre meses/anos, Hoje, evento de vários dias em entrada única, término exclusivo de dia inteiro e à meia-noite, detalhes, notas, tarefas relacionadas e rota de integrações. As 20 verificações passaram novamente após a correção dos rostos em Eventos anteriores.
- **6/6 verificações do módulo de participantes passaram**, com código em `work/calendar-people-test.cjs`: associação apenas aos exemplos exatos, preservação de participantes explícitos inclusive vazios, normalização e escape de nomes, rejeição de URLs não permitidas, limite de quatro avatares com +N, participante individual apenas nos detalhes e fallback após falha de imagem. A apresentação não modifica os eventos.
- **Sete grupos de fluxo no Edge isolado passaram**, por `file://` e sem rede, em `work/calendar-list-qa/results.json`: Lista inicial e grupos/indivíduos; dois temas e detalhes com imagens locais carregadas; seletor compacto e retorno do foco, mês completo e paginação; filtros e recuperação do vazio; quatro visões e navegação mensal; teclado e responsividade; e preferência inicial incluindo Lista com Semana salva preservada. A confirmação repetiu os sete grupos e verificou explicitamente os dois rostos no evento anterior Grupo de leitura. Nenhum erro JavaScript não tratado foi registrado.
- **14 capturas finais** em `work/calendar-list-qa`, também copiadas para `.impeccable/review/calendar-list`, incluem Lista e detalhes em 1440×1100 e 390×844 nos dois temas, resultado da seleção de data no celular, estado vazio, larguras de 360, 768 e 1280 px e navegação lateral recolhida. Não foi registrada rolagem horizontal global nas larguras verificadas. A decodificação das imagens e a abertura de detalhes foram exercitadas offline.
- Detector Impeccable em `work/calendar-list-qa/detector.json`: **zero achados primários e dez avisos auxiliares** de tipografia e raios locais. Os valores 22/30/17/27 px e raios de 14/6/4 px foram documentados em DESIGN.md como decisões do componente que reutilizam o sistema existente; não alteram a escala normativa.
- Revisão independente em contexto novo examinou a referência, as 14 capturas, contrato, código e evidências. O único achado material foi a ausência de rostos nas prévias de Eventos anteriores. O tratamento foi reutilizado nesses itens e as capturas de desktop foram refeitas nos dois temas. O parecer final em `work/calendar-list-qa/finish-review-final.md` marcou o ajuste como **resolved — ship**, sem pendência no escopo revisado. A confirmação do revisor foi restrita a esse ajuste; ele não reexecutou o navegador, o detector ou os testes.
- Os três retratos fictícios em `assets/avatars/` têm registros `.png.json` com prompt e origem de image_gen. A conferência de proveniência encontrou **três imagens e nenhum registro ausente**. O mapeamento é determinístico somente para os exemplos originais `e1`, `e6`, `e10` e `e13`; participantes explícitos prevalecem, inclusive `[]`.
- `design-system/tokens.json`, `design-system/colors.css`, o frontmatter de DESIGN.md e `.impeccable/design.json` foram preservados. A extensão não migra o armazenamento nem escreve participantes nos registros pessoais. Os números de contraste históricos abaixo não foram recalculados neste passe.

As prévias `preview-calendario-claro.png`, `preview-calendario-escuro.png`, `preview-calendario-mobile-claro.png` e `preview-calendario-mobile-escuro.png` foram substituídas pelas novas capturas da Lista. `preview-calendario-participantes-claro.png` e `preview-calendario-participantes-escuro.png` mostram os detalhes. A referência fornecida `694348d7507cb8069508f983baf92a19.jpg` está preservada em `references/calendar-events-list.jpg`; ela orienta a composição e não é carregada pela interface.

### Limites e entrega

Validação em Edge/Chromium com larguras emuladas e teclado, sem aparelho físico, Safari/iOS, leitor de tela ou nova medição de contraste WCAG. Alvos de 44 px e movimento reduzido constam do CSS, sem representar certificação integral de acessibilidade. Os participantes são fictícios e não envolvem leitura de contatos, OAuth ou sincronização. O Calendário permanece somente leitura para eventos Google. As demais áreas do produto não foram integralmente retestadas nesta revisão; os registros seguintes são históricos.

Registro histórico desta revisão: A unidade D: está indisponível. A entrega local permanece em `outputs/segundo-cerebro`, com ZIP em `outputs/Segundo-Cerebro-Prototipo.zip`, na pasta desta tarefa. Esta etapa não alterou GitHub, PR ou aplicação de produção.

## Capas demonstrativas nos projetos — 20/10/2026

Os três exemplos iniciais agora possuem capas distintas: trabalho em Segundo Cérebro, livros em Aprender com intenção e paisagem em Uma rotina mais leve. Os novos arquivos `assets/covers/project-workspace.png` e `project-learning.png` foram gerados pelo image_gen integrado, inspecionados e copiados sem edição; seus prompts completos e origens estão nos respectivos `.png.json`. A paisagem existente foi reutilizada.

**7/7 verificações de migração passaram:** três capas no estado inicial, atualização de exemplos antigos, persistência única e idempotente, preservação de imagens personalizadas e remoções explícitas, exclusão de projetos renomeados/novos da atualização automática, manutenção de tarefas/notas/preferências e exibição na sessão quando o armazenamento falha. Sintaxe de `core.js` aprovada.

No Edge isolado e offline, as três imagens carregaram no Início e na lista de projetos em 1440×1000 e 390×844, nos temas claro e escuro, sem imagens quebradas ou rolagem horizontal global. Os detalhes apresentaram a imagem correspondente; remover e substituir uma capa continuou funcionando após recarga. Dez prévias foram atualizadas pelo navegador, incluindo as quatro novas `preview-projetos-capas-*.png`. As imagens individuais e capturas representativas foram inspecionadas visualmente.

Registro histórico desta revisão: A mudança acrescenta dados e ativos demonstrativos; componentes, tokens, Kanban e demais fluxos não foram redesenhados ou integralmente retestados. Os registros anteriores sobre projetos inicialmente sem capa descrevem a versão anterior. Não é necessário apagar o armazenamento para receber as capas de exemplos ainda não personalizados. A entrega permanece na pasta local desta tarefa e no ZIP, pois a unidade D: está indisponível.

## Visualização Kanban em Tarefas — 20/10/2026

A rota Tarefas oferece Lista e Kanban. A lista continua inicial; a escolha fica salva no navegador. O quadro usa os mesmos registros, filtros, busca e ordenação, com colunas A fazer, Em andamento e Concluídas. Arquivo e Lixeira aparecem em coluna própria. A extensão está em `kanban.js` e `kanban.css`, com integração pontual em `app.js`, dois ícones em `core.js` e carregamento por `index.html`.

### Evidências desta revisão

- **20/20 testes de comportamento em Node/VM passaram**, incluindo preferência de visualização, dados escapados, agrupamento, filtros especiais, criação por coluna, movimento, falha de persistência, foco, rolagem e arraste.
- **15 verificações de fluxo e resultado no Edge isolado passaram**, por `file://` e sem rede: lista inicial; preferência Kanban após recarga; busca/projeto/ordenação compartilhados; criação com estado e projeto herdados; atualização da lista e progresso diário; arraste entre colunas; foco após desaparecimento por filtro; arquivar/reabrir; excluir/restaurar; reversão de estado e histórico quando o armazenamento falha; foco revelado horizontalmente no celular; foco visível por teclado; vazio e título longo; persistência; e matriz responsiva.
- **14 capturas finais** incluem Kanban claro/escuro em 1440×1000, 900×900, 390×844 e 320×780; Lista nos dois temas em desktop e celular; quadro sem resultados e título longo a 320 px. Nenhum erro JavaScript não tratado ou rolagem horizontal global foi registrado na confirmação. Controles novos medidos têm pelo menos 44×44 px; a alça de arraste é exclusiva de mouse e tem alternativa no seletor de estado.
- A primeira rodada visual encontrou uma rolagem global indevida em telas estreitas, causada pelo texto de acessibilidade de notas fora do contêiner posicionado. O quadro recebeu `position: relative`, contendo esse elemento na rolagem interna. A confirmação repetiu os fluxos e a matriz com sucesso.
- Os seletores dos testes foram ajustados aos campos existentes após duas tentativas iniciais sem capturas da matriz; essas interrupções eram do teste. Não se alteraram os formulários de tarefa para contorná-las.
- Sintaxe dos oito arquivos JavaScript aprovada. Os hashes de `design-system/tokens.json` e `design-system/colors.css` são idênticos aos do backup anterior.
- Detector Impeccable executado uma vez sobre `kanban.js` e `kanban.css`: **zero achados primários e seis avisos auxiliares**, referentes aos raios e ao título de 15 px. São medidas locais documentadas em DESIGN.md; nenhum token global foi redefinido.
- A revisão independente examinou as 14 capturas e apontou um caso com coluna longa: preservar sempre a posição vertical podia ocultar o controle focado ao mover uma tarefa para uma coluna curta. A reprodução acrescentou oito tarefas de teste e confirmou o foco fora da viewport. A correção revela o foco nos eixos necessários, respeitando as barras fixas; quando já está visível, mantém a rolagem. A verificação pontual passou (controle entre 359 e 403 px numa viewport de 844 px), e os 15 fluxos/14 capturas foram repetidos com sucesso.
- O revisor classificou a correção como **resolved — ship** após examinar código, captura e métricas novas. Esse veredito pontual encerra o único achado material da revisão; não representa uma nova auditoria de toda a aplicação.

Prévias: `preview-tarefas-kanban-claro.png`, `preview-tarefas-kanban-escuro.png`, `preview-tarefas-kanban-mobile-claro.png` e `preview-tarefas-kanban-mobile-escuro.png`. As quatro mostram o viewport; as tarefas seguintes continuam por rolagem.

### Limites

Validação em Edge/Chromium com larguras emuladas, mouse e teclado, sem aparelho físico, Safari/iOS ou leitor de tela. O celular utiliza rolagem nativa entre colunas e seletor de estado; arraste por toque não foi implementado. Arrastar muda o estado, sem reordenação manual: os cartões continuam ordenados por prazo ou prioridade. Nenhum backend, estado personalizado ou função de colaboração foi acrescentado. As outras funcionalidades não foram integralmente retestadas nesta revisão.

Registro histórico desta revisão: A unidade D: continuou indisponível. A versão atualizada e seu ZIP permanecem na pasta local desta tarefa, em `outputs/segundo-cerebro` e `outputs/Segundo-Cerebro-Prototipo.zip`. O repositório e o PR de planejamento não foram alterados.

## Capas de projetos e imagem do destaque — 19–20/10/2026

Projetos podem receber uma capa opcional ao criar ou editar. A mesma imagem aparece no Início, na lista e no detalhe do projeto. Configurações ganhou “Imagem do destaque do dia”, com prévia, troca, remoção, restauração da paisagem e aplicação por “Salvar imagem”. Os registros iniciais de projetos continuam sem capa; a paisagem aparece inicialmente apenas no destaque.

### Evidências desta revisão

- **15/15 verificações do módulo de imagens e 31/31 de onboarding passaram.** O módulo cobre fontes permitidas, formatos, tamanho, normalização, descarte de URLs temporárias, concorrência entre uploads, cancelamento de processamento e recuperação de erros. Imagem e canvas são simulados nesses testes; o navegador verificou o processamento real separadamente.
- **14 verificações de fluxo e resultado no Edge isolado passaram**, com entrada `file://` e rede desativada: paisagem inicial; cancelamento de rascunho; upload real convertido para JPEG e preservado após recarga; capa compartilhada entre três telas; remoção antes/depois de salvar; rejeição de SVG, PNG corrompido e arquivo maior que 8 MB; saída de Configurações sem salvar; troca de tema sem perder prévia; salvar/remover/restaurar fundo; falha simulada de armazenamento com reversão e nova tentativa; reversão integral de projeto em falha; criação com capa a 320 px; foco visível por teclado; e matriz responsiva.
- **26 estados capturados** em 1440×1000, 900×900, 390×844 e 320×780, nos dois temas. Incluem Início e Configurações em todas as larguras, lista/detalhe de projetos no desktop e celular, e editor de projeto a 320 px. Nenhum erro JavaScript não tratado, imagem visível quebrada ou rolagem horizontal global apareceu nas medições. Os controles novos de imagem medidos têm pelo menos 44×44 px.
- A camada escura de 70% sobre a imagem usa o neutro `#161613`, com texto `#f6f5f1`. O contraste calculado para esses textos, mesmo sobre imagem inteiramente branca, é aproximadamente **6,15:1**. Isso se refere ao texto do destaque, não a uma nova auditoria completa de todas as cores da aplicação.
- Sintaxe dos sete arquivos JavaScript aprovada. `design-system/tokens.json`, `design-system/colors.css` e `.impeccable/design.json` conservaram os hashes do backup anterior.
- O detector Impeccable rodou uma vez nos arquivos alterados: um aviso estático de imagem sem `src` corresponde à prévia vazia intencionalmente oculta (`hidden`), preenchida quando há uma imagem; não houve imagem quebrada visível no navegador. Um aviso auxiliar de raio de 12 px foi documentado como tratamento local da prévia, sem alterar a escala global.
- Revisão final independente, em contexto novo, de todas as 26 capturas, referência, contrato, implementação e evidências: **ship**, sem achados materiais no escopo das capas e do destaque. O revisor não reexecutou o navegador.

As capturas de entrega do Início foram atualizadas; `preview-projeto-capa-claro.png`, `preview-projeto-capa-escuro.png`, `preview-configuracao-imagem-claro.png` e `preview-configuracao-imagem-escuro.png` mostram os novos recursos. Nas prévias, o projeto Segundo Cérebro recebeu a paisagem pelo formulário em um navegador isolado, apenas para demonstrar a personalização; isso não modifica os dados iniciais distribuídos. Prévias do calendário e onboarding permanecem da revisão anterior.

A paisagem em `assets/covers/focus-landscape.png` é uma imagem original gerada para esta implementação; o prompt completo e a origem estão em `assets/covers/focus-landscape.png.json`. O arquivo de referência do usuário orientou clima e posição, sem cópia de seus pixels.

### Limites

Validação em Edge/Chromium com larguras emuladas, sem aparelho físico, Safari/iOS ou leitor de tela. O processamento real foi exercitado com PNG; JPEG e WebP têm aceitação/validação cobertas pelo módulo, sem uma matriz real de arquivos e metadados EXIF. Imagens ficam no armazenamento local do navegador e não são enviadas a um serviço. A falha de espaço foi simulada; não houve preenchimento real da quota. Exportar demonstração inclui as imagens salvas, mas importação não faz parte deste protótipo.

Registro histórico desta revisão: A unidade D: continuou indisponível. A entrega permanece em `outputs/segundo-cerebro`, com ZIP em `outputs/Segundo-Cerebro-Prototipo.zip`. O PR e a aplicação de produção não foram alterados nesta revisão.

## Adaptação Mobile Devices — 19/10/2026

O Início ganhou foco e progresso integrados, atalhos para até três projetos ativos e navegação inferior com captura central. O Calendário móvel passou a apresentar seleção de datas e agenda linear do dia; no desktop, Dia usa a mesma leitura linear e Semana mantém a grade temporal. Os módulos, o onboarding simplificado e a paleta DS 2.1 foram preservados.

### Evidências desta revisão

- **102/102 verificações Node/VM de integração e 31/31 de onboarding passaram.** Incluem seleção sem trocar a visão, navegação entre períodos e anos, fim exclusivo de eventos de dia inteiro, eventos que cruzam a meia-noite, filtros, contexto expansível, vínculos entre notas/tarefas e progresso calculado a partir dos projetos reais da demonstração.
- **28 estados capturados no Edge isolado**, aberto por `file://` e sem rede, em uma rodada inicial e uma confirmação. A matriz final inclui Início e Semana, claro/escuro, em 1440×1000, 900×900, 844×390, 390×844 e 320×780. Também inclui Dia no desktop/celular, Mês e Lista a 320 px, sidebar recolhida e dia vazio.
- A confirmação não apresentou rolagem horizontal global. Trilhos de projetos, faixa semanal e mês estreito conservam rolagem nativa interna. Nos controles medidos — calendário móvel, alternância de visão e navegação inferior — os alvos têm pelo menos **44×44 px**. A seleção do calendário ficou visível nas capturas medidas; a última coluna do mês foi alcançada por teclado e rolagem interna em 320 px.
- **Dez fluxos no navegador passaram:** seleção e deslocamento semanal, expansão/recolhimento e nota vinculada, mês e dia vazio, filtros compartilhados com o Início, atalhos de projetos, conclusão de tarefa e progresso, menu móvel e Escape, busca, rascunho preservado ao trocar tema, contexto preservado ao redimensionar e movimento reduzido. Nenhum erro JavaScript não tratado foi capturado.
- A primeira asserção de foco usava foco programático logo após toque; ela foi corrigida com uma verificação pontual usando **Tab real**. O projeto recebeu `:focus-visible` com contorno sólido e abriu com Enter. Transições dos novos cartões: **180 ms** no modo normal e removidas com movimento reduzido. Isso é uma correção do teste; não houve nova rodada de polimento visual.
- Sintaxe dos seis arquivos JavaScript aprovada. Detector Impeccable no escopo `layout`: **zero achados antes e depois**. O ajuste entre as duas rodadas corrigiu o crescimento mínimo do grid no Início em 320 px, reduziu texto auxiliar do cabeçalho móvel do calendário e distribuiu melhor os botões de visão.
- `design-system/tokens.json` e `design-system/colors.css` conservaram exatamente os hashes SHA-256 do backup anterior. Nenhuma cor global foi redefinida. Os contrastes numéricos históricos abaixo não foram recalculados neste passe.
- Revisão final independente de duas referências, oito capturas e registros de testes: **ship**, sem achados materiais P0/P1/P2 no escopo examinado. O revisor não reexecutou o navegador nem alterou a interface.

Prévias geradas diretamente pelo navegador: `preview.png` (Início claro), `preview-inicio-escuro.png`, `preview-calendario-claro.png`, `preview-calendario-escuro.png`, `preview-calendario-dia.png`, `preview-inicio-mobile.png`, `preview-inicio-mobile-escuro.png`, `preview-calendario-mobile-claro.png` e `preview-calendario-mobile-escuro.png`. As quatro prévias móveis mostram o viewport de 390×844; a página continua por rolagem. As imagens de onboarding permanecem da revisão anterior.

Referências originais fornecidas pelo usuário foram copiadas para `references/mobile-devices/`; são materiais de consulta, não recursos carregados na interface. A especificação está em `.impeccable/surfaces/mobile-devices.md`. Os relatórios e capturas de teste permanecem na pasta de trabalho `work/mobile-adaptation-qa`, fora do pacote de execução.

### Limites e entrega

Validação em Edge/Chromium com larguras emuladas, toques sintetizados, mouse e teclado. Não houve teste em aparelho físico, Safari/iOS ou leitor de tela, nem certificação integral de acessibilidade. Rolagem de trilhos e mês é nativa; não foi implementado arrastar compromissos ou trocar períodos por gesto. Os dados continuam fictícios e o Google Calendar permanece somente leitura, sem OAuth ou sincronização real.

Registro histórico desta revisão: A unidade D: não estava disponível nesta sessão. A cópia atualizada e o ZIP completo ficam em `outputs/segundo-cerebro` e `outputs/Segundo-Cerebro-Prototipo.zip`, na pasta local desta tarefa do Codex. Nenhuma alteração foi feita no PR ou na aplicação de produção nesta revisão.

## Simplificação do onboarding — 17/10/2026

Versão atual: boas-vindas, sete etapas opcionais e resumo, em nove telas. A composição passou a uma coluna de 560 px, sem trilho lateral ou painel ilustrativo. Campos secundários e explicações adicionais aparecem sob demanda; o resumo apresenta somente as escolhas realizadas. As etapas e os módulos continuam disponíveis, com navegação reversível e opção de fazer depois.

### Evidências desta revisão

- **31/31 testes de comportamento em Node/VM passaram.** Cobrem migração v1→v2, preservação de rascunhos e registros existentes, pausa/retomada, limites, duplicatas, formulários progressivos, vínculos explícitos e conclusão idempotente. Títulos pendentes são considerados inclusive nos caminhos indiretos de voltar e acessar o resumo.
- **Fluxo completo em Microsoft Edge isolado, por Playwright, aprovado:** perfil, duas contas de demonstração, hábito, projeto, tarefa, caderno, nota e painel. Também foram exercitados pular todas as etapas, recarregar, retomar, alternar tema preservando campos e rever o resumo sem duplicar registros. Nenhum erro JavaScript não tratado foi capturado.
- Entrada por **file:// em modo offline** verificada, incluindo saída opcional para o painel.
- Telas em **1280, 390 e 320 px** verificadas nos dois temas, sem rolagem horizontal global nas medições. Os controles medidos têm alvos de pelo menos 44 px. O resumo preenchido cabe nas alturas móveis testadas (844 e 780 px). O menu de etapas expandido pode aumentar a página e permite rolagem normal.
- Nas telas normais amostradas, o conteúdo principal tem **29 a 48 palavras visíveis**. A abertura tem 32. A redução resulta da retirada de explicações repetidas e da apresentação progressiva dos detalhes.
- Navegação por teclado, foco e Escape no menu de etapas exercitados. Erros em caderno/nota abrem os detalhes necessários e levam o foco ao campo correspondente; a correção permite continuar.
- Movimento reduzido emulado: animação computada `none`. Movimento normal: entrada de 180 ms; estados rápidos de 120 ms.
- Sintaxe de `onboarding.js` aprovada. Detector Impeccable executado uma vez: **zero achados primários e cinco avisos de escala local** (raios do progresso/menu e título de abertura), documentados na especificação da superfície. Os tokens DS 2.1 foram preservados; os valores de contraste das seções anteriores não foram recalculados neste passe.
- Revisão visual independente de código, capturas e evidências: **ship**, sem achados materiais P0/P1/P2 no escopo examinado. O revisor não reexecutou os testes.

Prévias atuais: `preview-onboarding-claro.png`, `preview-onboarding-escuro.png` e `preview-onboarding-mobile.png`. A especificação atual está em `.impeccable/surfaces/onboarding.md`; `LEIA-ME.txt` descreve abertura e retomada.

### Limites

Google Calendar usa contas fictícias, sem login ou sincronização. Arquivos é uma apresentação sem upload; Cofre permanece demonstrativo. Não houve teste em aparelho físico ou leitor de tela, nem alteração de produção ou GitHub. Os registros abaixo documentam versões anteriores e não significam reexecução de todos os testes nesta revisão.

## Histórico: onboarding inicial — 17/10/2026

Extensão local do protótipo existente, preservando a identidade e os módulos. Foram adicionados `onboarding.js`, `onboarding.css` e a rota `#/onboarding`; o arquivo de entrada e a moldura receberam a integração necessária. Os arquivos de tokens DS 2.1 e sua folha de cores conservam os mesmos hashes da versão anterior.

### Fluxos exercitados

- Primeira abertura conduz às boas-vindas; perfil, agenda, hábitos, projetos, tarefas e conhecimento são opcionais. Também foi concluída uma rodada sem incluir registros.
- Pausar, recarregar e retomar preserva o rascunho. Trocar tema mantém os campos em edição. A aplicação dos registros acontece ao acessar o painel pelo resumo.
- Rodada completa com nome, intenção, duas contas fictícias, hábito, projeto, tarefa, caderno e nota. Os vínculos entre projeto, tarefa e nota foram conferidos; o Início apresentou o nome e os registros criados.
- Recarregar e reabrir o resumo concluído não duplica registros. Uma nova rodada explícita preserva os anteriores.
- Campo vazio, nota sem título e título de nota já existente produzem orientação e foco para correção, sem aplicação parcial. Continuar com título digitado adiciona uma vez e limpa o campo.
- Configurações permite retomar/rever; o Calendário manteve a navegação e o funcionamento da lateral expandida/recolhida após sair do onboarding.

### Execução, acessibilidade e acabamento

- **18/18 testes de comportamento em Node/VM passaram.** Incluem preservação dos exemplos, persistência, conclusão idempotente, remoção de vínculos pendentes, limites, falha de armazenamento, uso do hábito no módulo existente e categoria de projeto criado em rodada anterior.
- **Fluxo completo e casos de recuperação passaram em Microsoft Edge isolado**, por Playwright, após indisponibilidade do kernel da ferramenta de navegador integrada. Nenhum erro JavaScript não tratado foi capturado.
- Claro e escuro conferidos, com matriz de perfil em **1440, 900, 390 e 320 px**. Boas-vindas, agenda e resumo também inspecionados em celular. Nas medidas verificadas não houve rolagem horizontal global; as etapas mantêm sua rolagem interna, com a atual à vista.
- Controles do onboarding medidos com alvo de pelo menos **44 px**. Link para saltar ao conteúdo, sequência de Tab, foco visível, associação dos erros aos campos e retorno do foco ao título foram exercitados.
- **14 pares de texto/superfície passaram em 4,5:1**, nos dois temas. Menor contraste medido: **5,9548:1**. São pares selecionados dos tokens usados pela nova superfície; isso não é certificação de acessibilidade integral.
- `prefers-reduced-motion` foi emulado no navegador: a animação de entrada ficou desativada. No modo normal, a duração computada foi 180 ms. Os estados rápidos usam 120 ms.
- Abertura direta por **file://**, com navegador offline, foi exercitada: apresentação, entrada no painel e persistência após recarga funcionaram sem servidor. Isso complementa a limitação do passe histórico descrito abaixo.
- Sintaxe dos seis arquivos JavaScript aprovada. Revisão independente confirmou a continuidade visual e, no veredicto pontual final, marcou como resolvidos os cinco achados apresentados; disposição **ship**, limitada a essas correções.
- O detector Impeccable foi executado uma vez sobre os arquivos afetados. A transição de largura do progresso foi removida. Geist permanece por ser a fonte definida no projeto; avisos de escala local da introdução e da marca foram documentados na especificação da superfície, sem mudar o sistema global.

Prévias entregues: `preview-onboarding-claro.png`, `preview-onboarding-escuro.png` e `preview-onboarding-mobile.png`. A composição e o comportamento estão descritos em `.impeccable/surfaces/onboarding.md`; as instruções de abertura e retomada ficam em `LEIA-ME.txt`.

### Limites desta extensão

Contas Google são exemplos e não executam OAuth ou sincronização. Selecionar exemplos define as fontes disponíveis na simulação; pular preserva as contas e preferências existentes. Arquivos é uma apresentação conceitual, sem upload. O Cofre permanece demonstrativo. Não houve teste em aparelho físico ou leitor de tela, nem alteração da aplicação de produção ou do GitHub. Os resultados anteriores a seguir são históricos, não reexecuções de todo o produto nesta etapa.

## Atualização de cores — DS 2.1

Após o refinamento v2, o pedido de alinhamento ao design system substituiu a interpretação das paletas visuais pelos tokens oficiais do repositório. Os registros de v2 abaixo descrevem o passe anterior; as evidências desta alteração são:

- **82 tokens de cor idênticos** ao JSON autoral DS 2.1, copiado para `design-system/tokens.json`; a folha `colors.css` é consumida antes dos aliases do protótipo.
- **88 pares de texto aprovados**, incluindo dez tintas nos quatro fundos de cada tema, acento, inversos e botão destrutivo. Menor contraste: **4,5109:1**.
- Cores computadas de fundo, superfície, tinta, acento e categorias conferidas no navegador nos dois temas. Trabalho usa work; Pessoal usa personal; Estudos reutiliza info, como alias inferido. Receita/conclusão mantém success. Financeiro usa fin no seu contexto.
- Início e Calendário inspecionados em claro/escuro no desktop; Configurações verificadas em 390 px, incluindo amostras de Claro/Escuro/Sistema e troca de tema. Documento móvel com 380 px úteis, sem rolagem horizontal global.
- Sintaxe dos três arquivos JavaScript ajustados aprovada. Nenhum erro/aviso no console capturado. Não houve alteração dos fluxos de dados.
- Prévias atualizadas para a paleta DS 2.1. Os limites da validação anterior permanecem aplicáveis.

## Registro do passe anterior

Realizada em 17/10/2026 sobre o protótipo local. O resultado preserva o escopo e os exemplos da primeira versão.

## Base e método

- Código: kauanbarateli/Segundo-Cerebro, commit 61d03c7. Documentação local de 16/10/2026, incluindo referências à PR #45/93ab854.
- Crítica manual e detector IMPECCABLE em contextos independentes, implementação e polish. Diagnóstico em DIAGNOSTICO.md; fontes das quatro coleções de skills em DESIGN.md.
- Paletas e layouts inspecionados; calendário orientado principalmente por 405324035233224479.jpg.
- Verificação no navegador por HTTP local sem cache. Nenhum serviço de produção foi acionado.

## Navegador — verificado nesta atualização

| Área | Resultado observado |
|---|---|
| Navegação | 12 rotas principais abertas no desktop; 11 rotas na matriz móvel de 390/320 px. Links da lateral conservam nomes acessíveis quando recolhidos. |
| Sidebar | Controle manual, estado ativo, persistência e larguras 232/76 px. No celular, painel com rótulos, foco contido e fundo inativo; Escape fecha e devolve foco. |
| Dicas e teclado | Tooltip do trilho aparece por teclado; Escape o dispensa. Navegação por Enter transfere foco ao conteúdo. |
| Rascunhos | Captura conservada após recolher/expandir e trocar tema. Nome não salvo conservado após escolher tema em Configurações. |
| Temas | Claro e escuro comparados no Início e Calendário, com lateral expandida/recolhida; seleção e ícones refletem o tema. |
| Calendário | Semana, mês e lista navegáveis. Próximo mês chega a novembro; Hoje volta a outubro. Filtro Trabalho oculta/restaura os eventos correspondentes. |
| Contexto | Revisão do Segundo Cérebro abre detalhes e permite navegar à nota Decisões da revisão de produto. |
| Formulário | Nova tarefa abre com foco no título. Salvar título vazio conserva a janela, foca o campo e apresenta validação nativa. Cancelar fecha normalmente. |
| Largura intermediária | Tarefas e Calendário em 900 px sem rolagem horizontal global; documento com 890 px úteis. |
| Celular | Correções confirmadas para capturas longas, agenda, configurações, hábitos e financeiro em 390/320 px. Tabelas/abas podem rolar internamente. |
| Console | Nenhum erro ou aviso nos registros capturados da sessão final. |

## Código e contraste

- Sintaxe aprovada por node --check nos cinco arquivos JavaScript.
- **70 de 70 verificações estáticas e de comportamento em ambiente de teste passaram**: rotas, ações, conversão/promoção única, origem, privacidade da busca, calendário, hábitos, financeiro, Cofre, foco, menu móvel e temas sem reconstruir formulários.
- Calendário conferido em quatro visualizações, transição dezembro/janeiro, sobreposições e término exclusivo de eventos de vários dias.
- Financeiro preserva a distinção entre compra no cartão e pagamento: não reduz caixa na compra nem duplica a despesa no pagamento.
- **38 pares semânticos de texto** passaram em 4,5:1 nos dois temas; mínimo **4,631:1**. Contorno de hábitos ativos/não marcados corrigido para **3,516:1 no claro e 3,851:1 no escuro** contra a superfície.
- Foco inverso, estados hover/active/disabled e prefers-reduced-motion presentes no código. Operações de teclado suprimem movimentos desnecessários.

## Polish independente

Comparadas 20 capturas intermediárias e seis finais. Quatro achados corrigidos e reconferidos: ações comprimindo capturas móveis, fonte comprimindo títulos na agenda móvel, última linha cortada em eventos semanais e contorno fraco de hábitos não marcados. Parecer final: **aprovado para entrega**, sem pendências materiais no conjunto revisado.

As imagens preview.png, preview-calendario-claro.png e preview-calendario-escuro.png acompanham a entrega. Barras fixas podem aparecer no meio de screenshots de página inteira; isso decorre da captura.

## Limites históricos do passe inicial

Estes limites descrevem somente o passe inicial. Revisões posteriores, inclusive a atual, exercitaram `file://`, armazenamento local e movimento reduzido emulado; seus resultados estão registrados nas seções correspondentes acima.

- Dois cliques em index.html não foram exercitados pela automação, que aceita apenas HTTP/HTTPS. A entrega usa scripts clássicos, recursos locais e caminhos relativos, sem módulos, fetch ou CDN, para abrir sem servidor obrigatório.
- LocalStorage foi verificado em HTTP local. Em arquivo local depende do navegador; há aviso e funcionamento em memória se indisponível.
- Não houve teste em aparelho físico, leitor de tela, zoom 200% ou preferência de movimento reduzido ativada no sistema. A implementação de movimento reduzido foi revisada em código.
- Contraste cobre os pares descritos; não é certificação completa de acessibilidade ou de toda combinação possível.
- Autenticação, OAuth, sincronização, criptografia, banco e transações reais permanecem fora da demonstração. Credenciais e contas são fictícias. Clipboard depende de permissões do navegador.
