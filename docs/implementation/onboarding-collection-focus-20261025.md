# Onboarding — continuidade do foco nas coleções

## Atualização — Preview fe04 e erro local do botão

O [Preview fe04](preview-fe04-onboarding-20261025.md) permitiu conferir no hábito o foco ao adicionar, abrir outro editor e remover a escolha, preservando o rascunho. Também reproduziu um caso que o teste anterior não distinguia: ao enviar nome vazio pelo botão, o erro aparecia, mas o foco permanecia nesse botão.

**Implementado no lote seguinte:** somente o ramo local inválido chama `nameInput.current?.focus()` após definir a mensagem. É uma ação síncrona de submit; não acrescenta efeito, pedido de foco tardio, escrita ou mudança de chave/estilo. Os três editores compartilham esse ramo. Três novos casos E2E e o negativo antigo agora saem do input com Tab, comprovam o botão focado, ativam Enter e exigem o campo focado, erro e `aria-invalid`, sem foco corretivo posterior. Isso evita o falso positivo de submeter Enter com o campo já focado.

Autor, peer e Root revisaram os dois paths e hashes; Root aprovou somente a análise sintática TypeScript5.9.3, sem typecheck/lint/browser local. Manifesto `db029d0522458c9ac57a369f15a8782121a110fe6380899cae33b204415ff287`, patch `b82291ba230441cf125d9961e81fe87744a006c44dad7cee8fd4cd7bc19d3225`, peer `acb7c468afcb5d31ee746c75489309f2f6ea819a9c453d1a5d762248913df022`. CI e Preview próprios da correção continuam pendentes; fe04 ainda contém o erro reproduzido. Não há novo aceite físico/humano ou da #44.

## Histórico — primeira correção de coleções

**OBSERVADO NA REVISÃO DE CÓDIGO:** adicionar, remover ou abrir o editor de hábito/projeto/tarefa podia desmontar o controle focado sem escolher seu sucessor. A constatação é estática; não representa reprodução no Preview.

**Implementado:** um pedido de foco nasce somente de uma ação explícita e é consumido uma vez após seu estado aparecer no DOM. Abrir “Adicionar outro” ou “Editar” leva ao campo; concluir ou remover leva ao botão de adicionar, ao campo remanescente ou ao título quando o limite de cinco impede o botão. A remoção de projeto vinculado conserva editor e foco. Renderização, autosave, montagem inicial e ações não refletidas não criam pedido tardio de foco.

O componente conserva a composição do protótipo: CSS, textos, largura, temas, tokens e APIs não mudaram. Foram preservados os efeitos existentes de foco inicial e de erro. Não há mudança de banco, permissões, dados reais ou fluxo OAuth.

**Testes acrescentados para o GitHub:** três percursos DOM com teclado, usando o workspace real e API controlada de teste. Cobrem abertura/edição, digitação e autosave concluído sem roubar foco, adição, remoção até esvaziar, envio inválido, quinta escolha e recusa de remover projeto vinculado. Os destinos após abrir o editor usam `toBeFocused`, sem corrigir artificialmente o foco do campo no teste. O prefixo anterior de 52.470 bytes do spec foi preservado.

**Revisão:** autor, peer e Root conferiram o delta de dois arquivos. Manifesto V2 `28b34a40ce08f811cb30532101fc272a632c2676af243674eb5ee5540bb5455b`; patch `1e57b4ec58ee58f07e183329bb2a3a5c1710907c709b9463040d4f5332f76de7`; parecer independente `fcb7f9c74e80227331c7dbc80697934f08f97a982e8e5f80c1a43c9ce5a86af9`. A proposta V1 permanece histórica e foi ampliada para incluir a abertura do editor.

**Validação local Root:** lint dos dois arquivos sem avisos e detector Impeccable do componente sem achados. Isso é verificação estática, sem aceitar os percursos DOM por antecipação.

**Atualização f91:** gerais push/PR, incluindo pipeline de build/E2E, passaram por metadados. [Resultado próprio](ci-f91-20261025.md). Isso não registra aqui o original por nome de cada percurso nem substitui a observação conectada do novo Preview.

**Pendente:** qualificação das evidências próprias, confirmação do foco visível e teclado no Preview correspondente e aceites móveis/humanos aplicáveis. O notebook não executou navegador ou Next para este delta. O Preview a8e não contém essa correção. A #44 continua aberta; merge e produção bloqueados.
