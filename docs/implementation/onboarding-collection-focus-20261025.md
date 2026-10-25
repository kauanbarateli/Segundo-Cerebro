# Onboarding — continuidade do foco nas coleções

**OBSERVADO NA REVISÃO DE CÓDIGO:** adicionar, remover ou abrir o editor de hábito/projeto/tarefa podia desmontar o controle focado sem escolher seu sucessor. A constatação é estática; não representa reprodução no Preview.

**Implementado:** um pedido de foco nasce somente de uma ação explícita e é consumido uma vez após seu estado aparecer no DOM. Abrir “Adicionar outro” ou “Editar” leva ao campo; concluir ou remover leva ao botão de adicionar, ao campo remanescente ou ao título quando o limite de cinco impede o botão. A remoção de projeto vinculado conserva editor e foco. Renderização, autosave, montagem inicial e ações não refletidas não criam pedido tardio de foco.

O componente conserva a composição do protótipo: CSS, textos, largura, temas, tokens e APIs não mudaram. Foram preservados os efeitos existentes de foco inicial e de erro. Não há mudança de banco, permissões, dados reais ou fluxo OAuth.

**Testes acrescentados para o GitHub:** três percursos DOM com teclado, usando o workspace real e API controlada de teste. Cobrem abertura/edição, digitação e autosave concluído sem roubar foco, adição, remoção até esvaziar, envio inválido, quinta escolha e recusa de remover projeto vinculado. Os destinos após abrir o editor usam `toBeFocused`, sem corrigir artificialmente o foco do campo no teste. O prefixo anterior de 52.470 bytes do spec foi preservado.

**Revisão:** autor, peer e Root conferiram o delta de dois arquivos. Manifesto V2 `28b34a40ce08f811cb30532101fc272a632c2676af243674eb5ee5540bb5455b`; patch `1e57b4ec58ee58f07e183329bb2a3a5c1710907c709b9463040d4f5332f76de7`; parecer independente `fcb7f9c74e80227331c7dbc80697934f08f97a982e8e5f80c1a43c9ce5a86af9`. A proposta V1 permanece histórica e foi ampliada para incluir a abertura do editor.

**Validação local Root:** lint dos dois arquivos sem avisos e detector Impeccable do componente sem achados. Isso é verificação estática, sem aceitar os percursos DOM por antecipação.

**Pendente:** typecheck/build e execução desses três testes no CI próprio do novo candidato, confirmação do foco visível e teclado no Preview correspondente e aceites móveis/humanos aplicáveis. O notebook não executou navegador ou Next para este delta. O Preview a8e não contém essa correção. A #44 continua aberta; merge e produção bloqueados.
