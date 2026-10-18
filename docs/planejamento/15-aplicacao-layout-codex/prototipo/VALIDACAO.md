# Validação do protótipo — refinamento v2 e onboarding

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

## Limites

- Dois cliques em index.html não foram exercitados pela automação, que aceita apenas HTTP/HTTPS. A entrega usa scripts clássicos, recursos locais e caminhos relativos, sem módulos, fetch ou CDN, para abrir sem servidor obrigatório.
- LocalStorage foi verificado em HTTP local. Em arquivo local depende do navegador; há aviso e funcionamento em memória se indisponível.
- Não houve teste em aparelho físico, leitor de tela, zoom 200% ou preferência de movimento reduzido ativada no sistema. A implementação de movimento reduzido foi revisada em código.
- Contraste cobre os pares descritos; não é certificação completa de acessibilidade ou de toda combinação possível.
- Autenticação, OAuth, sincronização, criptografia, banco e transações reais permanecem fora da demonstração. Credenciais e contas são fictícias. Clipboard depende de permissões do navegador.
