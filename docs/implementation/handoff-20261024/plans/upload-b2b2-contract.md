# Metas — contrato mínimo B2b-2, para decisão da Root

24/10/2026. Somente leitura das fontes públicas e este documento. Nenhum produto, freeze, teste, Node, navegador, rede, SQL, serviço, segredo, commit ou push foi alterado/executado. É desenho implementável, **não autorização de montagem**. A fundação B2b-1 está preservada em `finance-goals-image-upload-foundation-freeze-v1-20261024`, manifesto `015ae4adfc07b7f79337732610b0af1b8f8252da0b6f203e16432c2e657dd00b`.

## 1. Decisões técnicas e gates

1. O receiver de finalização será exclusivo de Goal e nominal, privado ao novo coordenador. Só o retorno bem-sucedido do **comando original** `file.upload.finalize`, validado e ainda na sessão/scope capturados, pode gerar uma prova em memória. `ready-unbound`, DTO passado pelo chamador, localStorage, URL de preview e observação `final` isolada não geram essa prova.
2. Reutilizar `uploadFile` apenas no primeiro percurso, com callbacks síncronos protegidos e um fetcher limitado. Retomada será uma máquina de fases própria usando os mesmos endpoints/validador/sender existentes. Nunca reiniciar `uploadFile` do começo diante de finalize pendente.
3. Retirement é somente local. Exige finalização própria fresca mais barreira financeira vazia, ou confirmação financeira exata com o imageId. Não remove arquivo, não encerra reserva remota, não altera GoalCommand e não interpreta recibo ausente como ausência de escrita.
4. **Antes de autoria/montagem do coordenador, uma subfatia local deve fechar o buraco de admissão B2b-1.** O estado V1 sem corpo suficiente continua em quarentena. Sem essa correção e seus negativos não se monta o uploader, mesmo que o happy path pareça funcionar.
5. Nenhum novo protocolo remoto de arquivos, Core financeiro, SQL, migration, finalidade, setter genérico, Workspace, flag ou configuração entra nesta proposta. E1-A continua com seus gates próprios. A Root escolhe a próxima autoria; não há dúvida nova de produto para o mantenedor.

## 2. Lacuna real de admissão: o que pode e não pode ser recuperado

**OBSERVADO:** `GoalImageUploadJournal.stage` V1 remove/readback `admission:<epoch>` antes de SET de slot e corpo. Quota depois dessa remoção pode deixar `slot=null, body=null`, ou slot presente sem corpo. Isso é recusado como CORRUPT, conservadoramente. Nenhum IO é autorizado pelo coordenador até stage retornar e ser relido; entretanto o registro incompleto não guarda nome/hash/scope necessários para reconstruir A depois de reload.

Não existe consulta pública por um clientId perdido que reconstitua todos esses campos; `observe` exige uploadId e clientId conhecidos. Um File novamente escolhido e metadata que existia somente em RAM **não provam A**. Não procurar localStorage de outros journals, não enumerar uploads/dados pessoais, não descobrir IDs por nome, não inventar um clear, não girar epoch financeiro e não dizer que uma consulta vazia resolveu isso.

**RECOMENDADO — subfatia J2 finita:** antes de qualquer novo IO, substituir a admissão em vários SETs por um estado canônico local único, limitado, por epoch. O registro atômico contém uma geração local e a metadata A completa; os marcadores de liveness/revogação continuam separados. O reconhecimento durável de A e sua identidade não podem depender de apagar o único registro anterior. O futuro formato deve distinguir `empty`, `active(A)` e `retirement-review(A)`, sem nova autoridade remota. Cada transição compara o registro anterior inteiro sob o lock, grava e relê o próximo; retorno falho nunca devolve permissão de envio. O tamanho total do estado canônico continua limitado a8KiB, sem duplicar File, capability, GoalCommand ou histórico de tentativas.

Uma falha na **primeira** gravação sem efeito deixa o estado vazio original, e nenhuma reserva/PUT/finalize pode ter começado pelo protocolo. Isso não autoriza retry automático ou geração automática de B: a instância conserva A e só uma nova ação humana pode tentar persistir A. Depois de reload sem A durável não se alega recuperar sua identidade. Um erro com efeito seguido de readback falho deixa `active(A)` recuperável, nunca um estado vazio criado por limpeza.

A J2 deve recusar resíduos V1 e não tratar um namespace novo como escape para a quarentena. **A Root confirmou que V1 nunca foi publicado/montado: não há migration de compatibilidade a implementar.** Preservar seu freeze; substituir a implementação antes da primeira montagem e testar resíduos sintéticos como recusa. **Não há solução autorizada para um V1 realmente incompleto após reload nesta fatia.** A imagem permanece indisponível nesse estado; a Root deve aceitar esse gate ou autorizar outra recuperação antes de montá-la. Os demais fluxos sem foto permanecem no contrato atual, sem transformar uma escolha selecionada em null silenciosamente.

Delta local mínimo recomendado: um único `state:<epoch>` em vez de `admission`+`slot`+`attempt`, mantendo os sentinelas/lock existentes. Forma fechada `{version:2,ownerId,epoch,revision,state,attempt}`, com `revision` decimal monotônica, `state:'empty'|'active'|'retirement-review'`, `attempt:null` somente em empty inicial; outros estados conservam a A completa. Não adicionar tabela, protocolo remoto, autoridade persistida, histórico ou migração. Stage escreve/reconfere active(A) de uma vez; advance faz CAS do estado inteiro; retirement escreve/reconfere retirement-review(A), sem apagar A. Na seleção B explicitamente autorizada depois da revisão/provas/barreira, um único SET substitui A por B e incrementa revision. A mesma A ainda ativa pode apenas ser retomada, jamais trocada por B. Lease antiga compara revision+corpo e é recusada antes de efeitos. Essa alteração fica nos mesmos contrato/journal/teste/doc B2b-1; nenhum arquivo financeiro precisa mudar.

## 3. Receiver e prova própria

O novo módulo `src/lib/files/goal-image-upload.ts` mantém um WeakMap privado de provas. A superfície pública expõe apenas um tipo opaco `GoalImageReadyProof` e uma função de inspeção ligada à instância atual. Não existe construtor/decoder público que transforme `{file_id,...}` ou metadata em prova positiva.

Antes de chamar o sender, capturar cópias independentes de scope, seleção, uploadClientId, uploadId e input literal `{upload_id,client_id}`. O receiver só aceita `file.upload.finalize` com **esses dois campos e valores exatos**; recusa qualquer outro comando/corpo antes do envio. Chama a função `executeDomainCommand` capturada da aplicação conectada, com clone do input. Após o await, reconfere identidade do aplicativo/sender, dono, epoch financeiro, scope/geração da tentativa A, lease e serviço. Nenhum port pode mutar a referência usada na comparação.

Há duas verificações distintas: a identidade A do envio original e a revisão/baseline **atual do destino financeiro**. Uma edição remota da Meta impede usar a imagem para preparar um comando sobre o destino antigo, mas não deve impedir consultar/finalizar o próprio envio A numa retomada explicitamente aberta sobre a metadata A. Essa recuperação não adota nova revisão/baseline nem devolve ready para o editor stale; só fornece evidência própria para a retirada local autorizada. `inspectReady` exige novamente o scope financeiro atual exato. Mudança de owner/epoch/serviço continua bloqueando ambos os percursos.

Validar o retorno por `observedImageFile(value, ownerId, uploadId, 'finance_goal_image')`, precedido de inspeção fechada de descritores, sem executar getters de ports sintéticos. Isso exige arquivo próprio, ID/purpose/folder exatos, não deletado, PNG/JPEG efetivo, bytes/dimensões/hash válidos e limites existentes. O resultado validado é clonado antes de guardá-lo no WeakMap. O objeto opaco fica ligado a essa instância/fence/scope/generation/clientId/uploadId; copiar, serializar, fabricar prototype ou usar outra sessão não conserva a prova. Não persistir a prova nem o Arquivo no journal operacional.

**Limite de autoridade explícito:** a prova nominal atesta que este receiver observou um resultado do serviço autenticado ligado ao comando capturado. Não é assinatura criptográfica enviada pelo servidor nem proteção contra JavaScript malicioso na mesma origem. A autorização/finalização própria e o vínculo financeiro atômico continuam no servidor/E1-A.

O hash `selection.sha256` é dos bytes locais originais e só identifica a reseleção. O servidor reencodifica/remove metadata, portanto `file.sha256` e extensão/tamanho podem mudar legitimamente. **Não exigir igualdade entre os dois hashes nem fingir prova criptográfica de igualdade de conteúdo antes/depois da transformação.** A prova remota usa o uploadId e o resultado finalizador próprio; ambos os hashes mantêm suas funções distintas.

## 4. Máquina de retomada e reutilização do helper

| Estado durável/observado | Próxima ação humana permitida |
| --- | --- |
| Vazio íntegro | Validar campos do formulário e File; calcular hash com WebCrypto; persistir/reler A completa antes de reservar. |
| `prepared`/`reserving`, sem uploadId | Repetir a reserva com o mesmo corpo `{kind:'finance_goal_image',name,folder_id:null,client_id}`. Isso pode recuperar o ID mesmo sem File. Persistir/reler esse ID antes de PUT. |
| `reserved` | Primeiro conferir o journal geral. Sem finalize pendente e com File exato pode iniciar o PUT condicional; gravar/reler `put-uncertain` antes dele. |
| `put-uncertain`/`put-confirmed` | Consultar somente o upload original via observe. `final` ou `staging` permite tentar finalize original, não gerar prova diretamente. |
| `missing-observed` | Só após ação humana, File reescolhido correspondente e reserva revalidada, repetir **mesmo** PUT com x-upsert:false; um PUT antigo ainda pode vencer. Não trocar IDs, fazer overwrite ou presumir ausência definitiva. |
| `indeterminate`, processamento/expiração ou falha | Preservar A e mostrar hold; nenhuma nova reserva/UUID/limpeza. Não introduzir terminal remoto de arquivos. |
| `finalizing` | Tentar primeiro o mesmo `executeDomainCommand('file.upload.finalize',originalInput)`. Não fazer reserva, PUT ou observação de Storage à frente do finalize pendente. |
| `ready-unbound` após reload | Metadata não reconstitui prova. Obter novo resultado do finalize original validado pelo receiver. Sem resultado positivo, continua hold. |
| Scope/baseline/revisão mudou | Preservar A e campos; não rebasear nem adotar nova geração automaticamente. Permitir só recuperação do envio original/retirement autorizado, sem preparar comando financeiro com scope antigo. |

O CommandSession público não fornece o corpo do journal geral. Não lê-lo por chave privada. `initializeJournal` e o feedback público determinam se há pending/journal-error/session-changed; **o sender original é a autoridade local** para recusar um finalize de outra intenção sob o lock real. Preferir `executeDomainCommand` com input completo original. `retryPendingCommand({command,input:{upload_id}})` filtra sem clientId e não é suficiente para mintar uma prova por si; não usar retry irrestrito.

Primeiro percurso pode envolver `uploadFile` com `clientId` explícito e o sender receiver. Seus callbacks síncronos devem: `reserving` persistir fase antes da reserva; `onReserved` persistir/readback ID; `uploading` persistir `put-uncertain` antes de PUT; `validating` persistir `put-confirmed` e `finalizing` antes do sender. Uma exceção do callback impede a próxima etapa; a perda após um efeito segue a fase durável anterior e observação. O resultado superficial de `uploadFile` não substitui a prova do receiver. Não modificar o helper compartilhado, Avatar ou Capturar nesta composição.

Reload sem File não restaura preview/bytes/URLs. Se houver uploadId, pode recuperar/finalizar o staging existente. Para um novo PUT, pedir reseleção: nome seguro, bytes, MIME e SHA-256 dos bytes devem corresponder à A durável; reconferir liveness antes/depois de `arrayBuffer`/WebCrypto. Não alterar geração/clientId para aceitar um arquivo parecido. Um nome igual ou metadata de RAM não bastam.

## 5. Retirement, barreira financeira e falha parcial

**Não oferecer `clear()`**. Existem duas razões locais possíveis, ambas sobre a A exata:

* `discard-finalized`: ação humana de descartar uma imagem finalizada ainda não usada nesta edição. Requer prova de finalização própria fresca **e**, sob a barreira financeira local, pending nulo, reconfirmação resolvida e ausência de hold do controlador atual. O arquivo não é apagado; sem holder segue o cleanup normal existente.
* `linked`: resultado positivo do comando financeiro original de create/update que solicita esse imageId e devolve a mesma Meta própria/imageId, validado por `decodeGoalCommandResult`. Nunca inferir isso de uma leitura atual de Meta, estatística, página, receipt ausente ou do fato de pending ter sumido. Se houver B pendente, recusar antes de qualquer escrita; se A ainda estiver protegida após uma remoção parcial, a resolução financeira original vem primeiro.

Para `linked`, um receiver local separado captura os retornos efetivos de `FinanceGoalsClient.execute/reconcile` ou do terminal confirmado, por clone/input/fence, sem alterar essas APIs nem o comando. O tipo `GoalImageLinkedProof` é nominal/privado à composição; não é um callback público que aceita result arbitrário e declara sucesso. A prova confere create/update, dono, goalId quando existente, intenção/UUID e `image_file_id` explícito. Um update que omite imagem não prova o vínculo. `closed` terminal sem confirmação não é `linked`; nesse caso uma futura retirada só pode usar `discard-finalized`, depois de resolver o hold financeiro.

**Barreira necessária:** `FinanceGoalsClient.loadPending()` isoladamente é observação, não exclusão mútua entre abas, e não expõe o hold em memória do controlador. Proponho um seam browser-only por injeção, sem Core/SQL: `withFinanceImageBarrier(work)`. Sua implementação recebe o **journal financeiro concreto já aberto** da mesma composição, usa `FinanceGoalsJournal.exclusive` e fornece somente leitura da lease mais a asserção de fence/owner/epoch. Não exporta corpo financeiro para o journal de upload. Dentro dela, o controlador atual também deve declarar sua situação recuperada/hold; false/error bloqueiam. Não adquirir outro lock financeiro por nome adivinhado, não reler localStorage bruto e não chamar `loadPending()` de dentro de sua própria lease (deadlock). Sem esse handle/seam real no host futuro, os testes por injeção não autorizam retirement em produção.

Ordem fixa: lock do upload → lease financeira breve → escritas/readbacks locais; **zero HTTP/Storage/sender dentro da lease financeira**. As provas são obtidas antes, reconferidas após entrar. Nenhum caminho inverso pode segurar a lease financeira e depois esperar lock de upload. Outra aba pode iniciar uma nova intenção depois da saída; por isso toda futura preparação/envio reconfere a barreira. Não se promete atomicidade remota entre dois journals.

**Recomendação para J2:** não apagar a única A antes de tornar durável a necessidade de revisão. `retirement-review(A)` conserva a metadata completa e invalida ack anterior; a resposta de retirement só ocorre após readback exato. Não há admissão vazia concedida por DELETE. Se houver clear parcial legado ou remoção externa, `missing` continua erro, não B. Na próxima abertura, esse estado exige **nova** prova fresca/barreira/revisão humana antes de aceitar outra seleção; o marcador local não vira prova do servidor. Uma nova A/B substitui o estado canônico em um único SET/readback, com geração local incrementada e CAS do predecessor inteiro, sem lista histórica. SET com efeito+readback falho recupera o corpo presente e exige retomada; SET sem efeito conserva o anterior. Lease/retorno atrasado com geração anterior não pode avançar/limpar B.

Uma confirmação `linked` pode deixar o journal financeiro com reconfirmRequired=true (protocolo atual). Isso não apaga a confirmação positiva, mas impede nova intenção financeira/nova seleção enviada até a revisão/ack correspondentes. Não usar retirement para contornar esse aviso. Logout explícito continua retirando sentinelas e redigindo apenas o próprio epoch; dispose/fechamento do editor cancela espera/preview e preserva tentativa durável, sem interpretar abort como rollback.

## 6. API de composição e editor — proposta fechada

No `lib/files`, sem import de componentes, o port opcional oferece operações humanas, nunca agenda retries:

```ts
interface GoalImageUploadPort {
  readonly ownerId: string;
  readonly epoch: string;
  open(scope: GoalImageUploadScope): Promise<ImageUploadView>;
  select(scope: GoalImageUploadScope, generation: number, file: File): Promise<ImageUploadView>;
  prepareReady(scope: GoalImageUploadScope): Promise<ImageReadyReply>;
  resume(scope: GoalImageUploadScope): Promise<ImageReadyReply>;
  inspectReady(proof: GoalImageReadyProof, scope: GoalImageUploadScope): ReadyImageView;
  discardFinalized(scope: GoalImageUploadScope): Promise<ImageUploadView>;
  recognizeLinked(proof: GoalImageLinkedProof): Promise<ImageUploadView>;
  dispose(): void;
  revokeIdentity(): void;
}
```

`ImageReadyReply` é discriminado: ready com prova opaca, need-file com metadata da reseleção, held, stale ou safe-error. Um retorno held/erro **não contém** imageId alternativo, null de fallback, capability ou File. `ImageUploadView` só contém scope/geração/fase, metadata permitida e possibilidades de ação; nunca é ready financeiro. `ReadyImageView` expõe o imageId final validado e identificação do scope, sem token/URL assinada; não salva nada. Os nomes de tipos podem ser concretizados sem ampliar semântica após a Root aprovar J2/barreira.

`select` guarda File somente em memória privada do coordenador e calcula hash antes da admissão. Após A admitida, outra escolha B é recusada; desfazer/cancelar escolha nunca limpa pending. O presenter B2a ganha só um port opcional para repassar a seleção privada internamente. `onChange` continua metadata-only e o File não atravessa o callback do formulário nem journals.

`GoalEditor` ganha prop opcional `imageUpload`; ausente mantém exatamente a interface atual sem fotos. Na presença: validar campos primeiro; `preserve` mantém omissão em update/null inicial em create; `remove` é null explícito revisável; `selected` exige prepareReady+prova atual. Só então montar o GoalCommand completo com clientId financeiro próprio e imagem explícita. Não trocar campos/baseline/revisões durante await; CAS/revisão mudou exige revisar, sem rebase silencioso. Só `prepare` financeiro existente abre a revisão; upload/finalize não confirma nem salva a Meta. Os handlers de confirmar/reconcile existentes continuam protegendo o mesmo corpo/UUID.

O presenter oferece status textual, retomar, reescolher arquivo exato e cancelamento local honesto. Botões/inputs permanecem44px/16px, foco/teclado/movimento reduzido e máscara monetária; progresso de upload não altera gráficos/valores financeiros. Imagem real indisponível continua sem capa. Nenhum GoalEditor/GoalsPanel/Workspace será montado nesta proposta sem novo GO.

## 7. I/O finito e preservação

Novo transporte privado, sem endpoint novo: reserve/observe same-origin, headers de owner esperado, credentials same-origin, redirect:error, query de observe apenas IDs/finalidade; Storage somente origem/caminho/token exatos via `signedUploadUrl`, credentials omit e x-upsert:false. URLs/corpos/tokens/arquivos não vão a log ou erro. Request de reserva curto, resposta JSON limitada a64KiB até EOF natural; observar/finalFile limitado a64KiB; PUT com resposta limitada e prazo fixo60s, reserva/observe15s cada, abort/cleanup em todas as saídas. Não converter exit/headers/leitura parcial em confirmação. Cada tentativa humana executa no máximo uma passagem da fase; sem backoff/loop automático.

O sender geral existente usa seu próprio timeout20s e journal real. O coordenador pode deixar de aguardar uma chamada travada, mas não pode certificar que a cancelou remotamente nem limpar o journal geral. Uma chamada ainda em voo não autoriza outra chamada paralela do mesmo receiver. O leitor JSON genérico do CommandSession não tem cap de bytes nesta proposta; não alegar hardening que não foi feito. Seu retorno é checado estruturalmente pelo receiver. Se a Root exigir um cap de rede também naquele canal compartilhado, isso será um gate separado, sem refatorá-lo silenciosamente nesta fatia.

Depois de cada await/callback/retorno e antes de cada efeito: comparar a identidade capturada do serviço/app/sender, owner/epoch atual, scope, geração da seleção e lease/fence. Abort, 403, 503, quota, response-loss e falha de Storage deixam A protegida. Logout explícito é a única redacção de identidade; um callback antigo não toca o estado novo.

## 8. Fatias e paths para a próxima autorização

| Fatia | Paths exclusivos propostos | Limite verificável |
| --- | --- | --- |
| J2 — admissão/retirement local | Deltas revisados em `src/lib/files/goal-image-upload-contract.ts`, `goal-image-upload-journal.ts`, `tests/lib/goal-image-upload-journal.test.ts` e doc B2b-1; freeze novo preservando V1. | Registro canônico, quarentena V1, readback/retirement sem perda de A; sem HTTP/TSX. |
| C2 — receiver/coordenador | Novos `src/lib/files/goal-image-upload.ts`, `goal-image-upload-transport.ts`, `goal-image-upload-finance-barrier.ts`; três testes lib focais e doc próprio. | Injeção, prova nominal, callbacks primeiro percurso, retomada por fase, barreira concreta por handle; sem editar Core/SQL/Goals journal. |
| P2 — presenter/editor isolados | Deltas somente em `goal-image-picker.tsx`, `goal-editor.tsx`; novo seam de provas financeiras junto à composição isolada; testes E2E/helper próprios. | Port opcional, metadata callback intacto, fluxo sem flag/Workspace/produção. A Root deve fechar o seam concreto do host antes de montagem. |
| Aceite | CI/typecheck/dependency gate, testes unitários/E2E sintéticos; depois gates conectados/Storage/duas abas explicitamente autorizados. | Não substituir prova real por mocks. E1-A+finalize/vínculo próprios continuam pendentes. |

O seam financeiro não modifica `FinanceGoalsClient`/Core/SQL nesta autorização: pode compor o client existente e journal concreto pelo host de teste. Se o host real não consegue fornecer esse handle sem mudar sua factory atual, **isso é uma dependência de integração explícita para a Root**, não motivo para usar uma leitura solta como barreira ou construir outro client do qual não se controla o epoch. Nenhuma alteração fora dos paths autorizados acontece por esta proposta.

## 9. Negativos obrigatórios antes de montar

1. J2: quota/SET com e sem efeito em cada transição; readback falho; recarga recupera A inteira; estado V1 slot/corpo ausente permanece recusado; nenhum B, clear ou epoch novo automático.
2. Prova: objeto estrutural/fabricado/clonado/serializado, outro owner/epoch/editor/generation/upload/client, raw observe-final e ready metadata recusados; getters não executados; sender/port que muta argumento não troca intenção; finalidade genérica negada.
3. Callback/IO: persistência falha em onReserved impede PUT; falha em uploading impede PUT; falha em validating impede finalize; perda de reserva recupera mesmo ID/corpo; nunca usar default randomUUID do helper.
4. Reload: sem File pode finalizar staging/final; missing exige reseleção exata/hash; nome igual+hash diferente recusa; hash de reencode diferente é legítimo e não aceita File local diferente; finalizing não faz reserve/observe/PUT antes do sender.
5. Geral/financeiro: pending alheio bloqueia antes de IO; retry não filtrado é proibido; financial A ou B, reconfirmRequired, hold em RAM e erro de leitura impedem retirada; B é recusada **antes** de metadados/ack serem alterados.
6. Retirement: prova própria+barreira vazia permite somente retirada local; linked exige resultado financeiro exato/imageId; física null depois de clear parcial não prova nada; SET/DELETE com efeito+leitura falha e nova montagem mantêm revisão/hold; prova fresca é necessária para concluir depois de falha.
7. Concorrência: lock order, lease escapada, await atrasado, logout/quota, e1 versus e2, geração A versus B, desmontagem sem logout; zero escrita/rerender/retirement por resposta velha. Uma conexão/Storage fake não prova corrida nativa.
8. Editor: preserve/remove/selected, cancel nativo, desfazer antes de admissão, cancel após admissão sem promessa de rollback, erro mantém campos/projeto/UUID; perda de resposta financeira mantém original; sem fallback selected→null; máscara/ARIA/mobile320/390/temas/teclado/foco.

## 10. Estado desta entrega

**Implementado aqui:** somente este contrato de planejamento público. **Observado:** assinaturas/limites e lacunas nas fontes citadas. **Recomendado:** J2, receiver e barreira acima. **Pendente:** GO exato de autoria, peers, todos os testes, infraestrutura real, receiver/captura de prova financeira, integração do handle no host e montagem. Nenhum resultado de execução foi herdado de B2b-1/M2.

Fontes locais lidas: B2b-1 quatro paths; `src/components/layout/file-upload.ts` e `entity-image-attempt.ts`; `src/lib/files/{image-upload-observation,storage-origin}.ts`; `src/adapters/db/image-upload-observation-runtime.ts`; `/api/files/uploads` e `/observe`; `src/lib/demo/connected-application.ts`; `src/lib/{finance-goals-client-contract,finance-goals-client,finance-goals-journal}.ts`; B2a picker/model; GoalEditor e GoalPanel; `decodeGoalCommandResult` e validadores de finalidade; proposta E1-A inerte. Sem consulta a arquivo privado ou serviço externo.
