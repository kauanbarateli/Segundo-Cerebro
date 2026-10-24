# T-054 — Editor sem nova foto, com o envio anterior preservado

Candidato local G0 em `codex/goals-editor-no-new-image-20261024`, sobre `0d933d98ca8fcd6def222d184d9b9462370d98eb` (árvore `b6c018609cac8267f9c58def3385911f6dcd8eb2`). Esta fatia altera somente sessão/editor, testes públicos e este documento. Não monta Workspace, não ativa finalidade/flag/schema e não altera Core, API, SQL ou journal.

## Decisão explícita

Uma tentativa íntegra A pode ficar protegida mesmo quando seu File original foi perdido. O gesto **Continuar sem nova foto** permite revisar uma operação financeira independente, mantendo A integralmente no J2:

| Alvo e gesto | Intenção financeira após a autorização |
| --- | --- |
| Nova meta, continuar sem foto | `finance.goal.create` com `image_file_id: null` |
| Meta existente, manter foto atual | `finance.goal.update` com a propriedade da foto omitida |
| Meta existente, remover foto atual | `finance.goal.update` com `patch.image_file_id: null` |

Essa escolha não finaliza, cancela, aposenta, desvincula, limpa ou substitui A. Não admite um upload B nem aloca UUID de foto. A seleção normal com foto continua usando o fluxo original; uma falha de upload não escolhe null/omissão. Metadados ausentes, inválidos ou corrompidos continuam recusados.

## Autoridade e captura

A sessão consome as capacidades locais G0 do coordenador real:

- `authorizeNoNewImage(basis): Promise<GoalImageNoNewImageProof>`;
- `claimNoNewImage(proof, basis): Promise<void>`.

O basis fechado contém scope atual, revisão financeira, campos já validados e a decisão. O emissor nominal pertence ao coordenador; o editor não fabrica prova, não aceita boolean ou readmodel como autoridade e não importa uma nova porta financeira. O coordenador usa os mesmos client, journals, barreira e controller reais, sob ordem upload → lease financeira breve, sem IO remoto nessa autorização.

Dependência congelada, sem cópia neste checkout: `finance-goals-image-upload-no-new-image-freeze-v1-20261024/manifest.json`, SHA256 `3429284e70efa9015de0ba184498663e882e7eeb996caeae864c0db889efc722`; coordenador after SHA256 `d8a93ebb6b6ad5b251b1a9d0faaf47dc5cdb199551e8987345dfafa5d0c03348`. A entrega R contém somente coordenador, teste e documento, sobre a mesma base 0d933d9. A composição e os peers pertencem a Root.

Antes do primeiro await, o editor valida e captura campos, scope/revisões e decisão. Cada retorno verifica a sessão/capacidade atual, geração e formulário capturado. A sessão conserva sua cópia original quando envia argumentos ao coordenador. Depois do claim positivo, reconfere o snapshot integral de A; somente então exclui a prévia local por callback próprio e aloca a intenção financeira. A exclusão visual ocorre antes de preparar a revisão, sem modificar A.

Uma intenção já capturada é mantida em RAM pela sessão. Preparação recusada ou resposta perdida não cria outro UUID/corpo: o novo gesto repete apenas a preparação readonly da mesma intenção. Basis diferente é recusado. A execução financeira continua exigindo uma confirmação separada, com validação e CAS do servidor. Recibo ausente, 403, 503 ou timeout não autorizam outra intenção nem limpeza de A.

A escolha explícita pode ser feita com A em fase anterior a finalizing, sem File e em scope anterior. Não rebaseia A para o scope atual nem a transforma em ready. Recuperar/trocar a foto continua dependendo do protocolo R existente e de um positivo próprio posterior.

## Interface e ciclo de vida

A capacidade opcional e as props de GoalEditor permanecem as mesmas. Ausente a capacidade, não há Picker/CSS adicional. Após o gesto G0 positivo, a prévia escolhida fica visivelmente excluída e a mensagem explica se a revisão será sem foto, conservará a atual ou solicitará remoção. O envio anterior permanece protegido. Não há confirmação financeira automática.

Cancelar fecha apenas o editor e sua prévia local. Dispose, troca de sessão/serviço, formulário alterado e respostas tardias não publicam uma revisão nova. Um segundo clique durante a operação é recusado; a fila que entra após o prazo da operação não pode autorizar outro UUID. A sessão conserva o hold financeiro, inclusive quando a consulta de recibo continua incerta.

A fixture passa a montar o Dialog/Editor somente enquanto aberto, como o consumidor real, para que Cancelar/Escape executem o cleanup correspondente. Isso é ajuste do harness isolado, sem rota de app ou mudança de produção no Dialog. Tokens, CSS, controles de 44 px, campos de 16 px, foco, tema e reduced motion foram preservados.

## Preparação legada sem capacidade de imagem

H0 passará uma preparação que rejeita quando o controller recusa a revisão. O ramo legado agora captura essa rejeição com texto fixo e sem afirmar salvamento.

O cache legado é distinto da autorização G0: somente conserva a intenção financeira validada em RAM. Não possui prova de foto ou autoridade de journal. Não cria ID antes de validar campos/revisões; repete o mesmo UUID/corpo em nova tentativa manual ou clique duplicado. Se campos ou basis já capturado mudarem, orienta fechar/reabrir com dados atuais. Edições inválidas que ainda não produziram intenção não ficam congeladas. Nenhum retry ou dispatch é automático.

## Provas escritas e seus limites

A unidade adicional usa coordinator, concrete client, journals e controller reais, com storage/fetch/locks sintéticos. Os positivos nominais não são forjados; o controller negativo com hold independente existe somente para provar a recusa. Os doubles estruturais antigos receberam métodos G0 que sempre rejeitam.

A fixture E2E usa localStorage, Web Locks, client, controller, barreira, decoders e coordenador reais, com transporte público sintético. O cenário A perdido parte de metadados completos sintéticos, nunca de um recibo/ReadyProof fabricado. Não comprova Storage/Auth hospedados nem finalização de foto.

Casos acrescentados:

- três decisões e preservação do snapshot/corpo de A, com criação de ID somente depois do claim;
- formulário inválido/alvo incorreto; pending físico e hold do controller;
- argumento mutado pelo receiver; troca de owner/serviço/formulário; retorno tardio e dispose;
- duplo clique e lease liberada após deadline, com zero IO de foto/novo ID;
- prepare recusado com argumento mutado, preservando corpo/UUID e sem nova autorização;
- UI com A prepared/reserving e File perdido; seleção normal não usa fallback;
- preservação/remoção de foto existente; revisão recusada e execução perdida com reconcile da mesma intenção;
- ausência de recibo mantém tentativa e impede B; cache legado recusa basis alterado;
- captura planejada 320 px escuro do estado sem nova foto e A retida.

**Nenhum teste, lint, typecheck, Node, Playwright, build, serviço, SQL, rede ou publicação foi executado nesta autoria.** E3/EFix/R anteriores e a base foram preservados. A assinatura G0 depende da composição dos bytes do coordenador entregue pela frente R; este checkout isolado não contém stubs nem cópia dessa implementação.

## Gates da composição

Root precisa compor o coordenador G0 congelado e estes seis paths, derivar a closure real, revisar os peers e executar lint/typecheck/unidade/E2E no candidato próprio. Os comandos focais propostos, ainda não executados, são:

```text
vitest run tests/features/goal-image-editor-session.test.ts
playwright test tests/e2e/finance-goals-image-upload.spec.ts --workers=1
```

A montagem H0/H1, schema/finalidade e aceites conectados permanecem separados. Esta entrega não declara Metas/fotos aceitas nem libera merge/produção.

## Revisão V2 — resposta tardia no ramo legado

V1 e seus before/after permanecem congelados. A revisão V2 restringe o catch e o foco tardio do ramo sem capacidade de imagem: exige valores visíveis, valida o formulário atual com goalFields e compara o mesmo basis normalizado de campos, alvo e revisões capturado antes da preparação. Referência de prepare não faz parte desse fence, pois o consumidor pode recriar o callback em um rerender. A intenção e seu UUID não são recalculados.

Dois casos E2E novos mantêm o preview sintético pendente: um edita um campo realmente habilitado e outro usa uma ação de host da fixture para ocultar os valores. Uma contagem readonly de preparações encerradas permite aguardar a resposta original antes dos asserts. Não há alteração de disabled, relógio, debounce ou resposta financeira. O erro tardio não é mostrado/focado no formulário alterado nem reaparece após exibir os valores; uma revisão manual posterior continua usando o UUID original quando o basis é idêntico. Basis alterado continua recusando a intenção B.

A dependência revisada de R é `finance-goals-image-upload-no-new-image-freeze-v2-20261024/manifest.json`, SHA256 `949cf129ddfdbcc33758553d818fa02519dc140ea0d9ffd0fbc04481d535eb68`; seu coordenador permanece byteigual ao V1 (`d8a93ebb6b6ad5b251b1a9d0faaf47dc5cdb199551e8987345dfafa5d0c03348`). A correção R2 ajusta somente a disponibilidade no teste e o documento. Nenhum teste ou runtime foi executado nesta V2 do editor; o pacote depende da reconferência cruzada e dos checks próprios de Root.
