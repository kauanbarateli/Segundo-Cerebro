# G0 · continuar sem nova foto, A integralmente retida

Adendo técnico ao plano finance-goals-host-mount-plan-20261024.md. Proposta de contrato, não implementação. Candidato informado Root0d933d9; E/R/J2/Workspace continuam intocados. Nenhum runtime, rede, SQL, teste ou operação foi executado.

## Recomendação

Adotar a saída proposta por Root: um gesto explícito **Continuar sem nova foto**, com decisão financeira fechada, preserva A em J2 e não exige que A tenha sido finalizada. Exigir positivo de A para essa escolha seria restrição indevida: a nova operação não usa o arquivo pendente, não solicita Storage, não admite B e não altera o acompanhamento de A. Isso resolve a opcionalidade financeira mesmo quando o File original foi perdido.

O positivo original de A continua OBRIGATÓRIO para retirar/trocar seu acompanhamento e admitir uma foto B. Não se altera ready, retireLinked, discardFinalized ou replaceRetired; não há clear, unlink, rollback ou prova de ausência implícitos. O modo normal selecionado + Revisar conserva todos os guardas E2, sem fallback para null/omissão.

## Decisão fechada e semântica

| Gesto capturado | Comando financeiro futuro | O que permanece |
| --- | --- | --- |
| Nova Meta: continuar sem foto | create com image_file_id:null explícito | A integral, mesmo phase/clientId/uploadId/hash/scope/revision |
| Meta existente: continuar sem nova foto | update OMITINDO image_file_id | imagem atual da Meta preservada por domínio; A intacta |
| Meta existente: remover foto atual | update com image_file_id:null explícito | A intacta; remoção do vínculo atual só após Confirmar financeiro |

“Sem nova foto” não significa remover a foto atual. A remoção exige o gesto/texto próprios já previstos no editor. O novo controle explica: “O envio pendente será mantido. Esta meta continuará sem usar esse envio. Confirme a operação financeira para salvar.” Se a decisão é remover, a confirmação diz que remove a imagem da Meta; não diz que apaga o arquivo ou cancela A.

A capability de autorização não efetua unlink. Um update explícito com null pode alterar holder/FK da imagem atual via os casos de uso e SQL existentes; isso é o efeito financeiro autorizado posteriormente, não uma propriedade do proof. Nunca chamar “nenhuma alteração de imagem” para esse ramo de remoção.

## Autoridade local, distinta de Ready/Linked/Receipt

Proposta nominal específica, definida no módulo do coordenador (Symbol privado + WeakMap), vinculada à instância viva:

~~~ts
type NoNewImageChoice = "create-null" | "update-omit" | "update-remove";
type NoNewImageBasis = {
  scope: Readonly<GoalImageUploadScope>; // alvo ATUAL, não rebase de A
  financeRevision: string;
  fields: Readonly<Pick<GoalFields, "name" | "target_cents" | "deadline">>;
  choice: NoNewImageChoice;
};
interface GoalImageNoNewImageProof { /* marca nominal privada */ }

// Nomes propostos, sem wire/porta financeira nova:
authorizeNoNewImage(basis: NoNewImageBasis): Promise<GoalImageNoNewImageProof>;
claimNoNewImage(proof: GoalImageNoNewImageProof, basis: NoNewImageBasis): Promise<void>;
~~~

O proof não contém File, URL assinada, GoalCommand, clientId financeiro ou resultado remoto. O WeakMap guarda somente o contexto capturado em RAM, a identidade exata de A e a finalidade escolhida, com fences; não se persiste esse proof/basis/digest no J2 nem em outro storage. JSON/clones/free DTOs não são autoridade. Não é ReadyProof, GoalImageLinkedProof, recibo financeiro nem prova de finalização/ausência de A; nenhum receiver desses aceita esse tipo.

Fields e financeRevision são necessários para impedir aplicar a autorização emitida para um formulário em outro após await. Usar validadores puros/assinatura JS locais já existentes, sem SDK/servidor no browser e sem hipótese de canonicalização SQL. Nada disso certifica que a revisão do banco ainda é atual: preview e commit CAS no servidor continuam obrigatórios.

## Emissão e claim sob os recursos reais

1. O editor captura e valida formulário, decisão, GoalDetail/Page revision, owner/epoch, alvo e baseline ANTES de await. Só o clique humano específico inicia esse ramo. Falha/timeout no Revisar selecionado nunca o chama automaticamente.
2. O coordenador real adquire upload lease e depois a lease financeira breve pela MESMA client.imageUploadBarrier e MESMO controller. Guardar signal ao entrar tarde na fila e antes do callback. Dentro dessa janela não há HTTP, hashing de File, Storage, sender nem escrita de J2/finance.
3. A precisa existir como metadata completa, própria e decodificada em active ou retirement-review. Pode estar em QUALQUER phase e sem File; sua identidade/revisão são capturadas exatamente. Record ausente/corrupto/legacy/indeterminate local não vira vazio nem autorização. Este mecanismo não repara metadata perdida; resolve apenas o fato de não depender dos bytes/finalização de A.
4. Exigir owner/epoch atual, service/controller/journal originais, targetCurrent do alvo atual, financeiro pending=null, reconfirmRequired=false e nenhum hold conservador do controller — inclusive quando o corpo físico do journal está null. Um proof terminal/revisão de imagem não chama acknowledgeReview para satisfazer esse guard.
5. Emitir a capability nominal para a instância + A + basis/choice exatas. O objeto público não revela fields. Após liberar leases, fazer novamente os fences de liveness; resposta tardia não pode ser aceita por outra sessão/serviço.
6. claimNoNewImage reacquire upload→finance e reconfere snapshot de A e basis/choice/fences idênticos. Consome uma vez ANTES de retornar sucesso. Proof usado/stale/clonado/forjado, A alterada por outra aba, formulário/revisão/baseline diferentes ou barreira ocupada falham com zero ID financeiro e zero prepare.
7. Só depois do claim positivo, ainda no mesmo gesto e com formulário/scope vivos, o editor cria UM clientId financeiro, congela o GoalCommand escolhido e guarda seu corpo original antes do prepare. Não deriva a escolha de retorno nullable do receiver: usa a enum capturada. Preparar continua read-only; Confirmar permanece outro gesto.
8. Se falhar antes de criar a intenção, uma nova tentativa exige novo gesto e contexto reconferido, sem novo upload UUID. Se falhar depois da intenção/dispatch, usar o mesmo corpo/clientId e o protocolo financeiro existente; não emitir outra intenção para “sair” do hold. Consultar/reconciliar/settle a intenção original não depende de reconstituir esse proof local.

Claim não congela A indefinidamente contra outro ator legítimo após liberar o lock. Garante que ESTA ação não modifica A e que o contexto era o mesmo na admissão. A posterior troca de foto por outra aba segue seus próprios proofs/locks; o comando sem nova imagem não usa A e continua protegido pelo CAS financeiro. Não manter uma lease local durante HTTP.

Uma recusa de SET/quota do journal financeiro continua impedindo dispatch quando for necessário persistir o comando. A admissão sem foto não contorna esse write/readback e não usa memória como fallback. J2 fica byteigual por toda essa ação.

## Integração E/host mínima

- Método explícito separado em GoalImageEditorSession, com o mesmo busy/fencing e cache de intenção. Não alterar o ramo normal review() nem relaxar imageId/gen/hash/scope.
- Botão próprio no GoalEditor, após explicar a pendência. Preservar/remover são decisões distintas. Depois do gesto, mostrar claramente que a prévia selecionada NÃO integra a nova revisão; pode descartar apenas a URL/File local por escolha explícita. A segue visível como envio protegido, não como upload cancelado.
- Capability só sai da factory privada usando coordinator/client/journal/barreira/controller reais. Não usar um boolean “A pronta” ou o DTO retirement-review como substituto de receiver.
- Não gerar outro editorKey, uploadClientId ou uploadId por ausência, erro ou fonte perdida. Metadados A ficam íntegros. Fonte antiga ainda pode ser recuperada pelo roteiro do plano, independentemente das metas criadas sem foto.
- Flags false/403/503 não apagam A. Quando apenas novas fotos estão desabilitadas, a autorização sem nova foto pode destravar o financeiro Auth/Entitlement vigente, desde que a barreira/contexto sejam válidos. Nunca reativar upload B por esse caminho.
- H0/host básico continua independente. H1 pode ser montado para fotos só depois desta fatia ser implementada/revisada/qualificada junto aos outros gates; não deve usar o formulário legado como bypass estrutural de A selecionada.

Paths futuros restritos: coordenador src/lib/files/goal-image-upload.ts (nominal + dois métodos locais), sessão/editor de Metas (ação separada/copy), seus testes unitários/E2E/fixture e documentação. NOVO tests/lib/goal-image-upload-no-new-image.test.ts pode provar emissão/claim com recursos reais. Sem mudar protocolo J2, Core/GoalCommand, SQL, RPC, versão HTTP, FinanceGoalsClientPort, SDK ou esquema; nenhum desses paths é editado neste adendo.

## Matriz necessária antes de GO de montagem

1. Para TODAS as phases A e active/review: create-null, update-omit e update-remove após gesto próprio; J2 byteigual, zero reserve/PUT/observe/finalize/cleanup e zero upload UUID novo. Efeito financeiro somente no Confirmar explícito.
2. File de A perdido não é pedido/lido por essa ação. A completa permanece; outro File não vira B.
3. Normal selected+Revisar continua sem fallback e conserva negativos E2 de imageId interno, hash diferente, scope e geração. Falha de upload não aciona “sem foto”.
4. Proof nominal: forjado/clonado/de outra instância/owner/epoch/choice, dupla claim e uso em receivers Ready/Linked são recusados; nenhuma reflexão produz autoridade.
5. Owner/serviço/controller/scope/revisão/baseline/fields/decision mudam em CADA await/fila: zero createId/prepare e nenhuma resposta em B. Mesmo para timeout que depois drena callback.
6. Financeiro pending/reconfirm/hold com corpo físico null bloqueia emissão/claim. Ler os dados não chama ack automático.
7. Metadata J2 ausente/corrupta/legacy ou readback recusado: hold, sem clear/novo ID. SET financeiro recusado: nenhum execute; A preservada.
8. Novo movimento no servidor após captura: preview/commit CAS recusam stale; capability não afirma frescor do banco. Não recalcular corpo silenciosamente.
9. Duplo clique cria só uma intenção; execute perdido mantém UUID/corpo exatos null/omit/remove. Reconcile/settle originais funcionam sem reemitir o proof e sem liberar A.
10. Após Meta com foto A, novo editor cria outra Meta sem foto por gesto, sem recuperar bytes de A; update preserva/remover explicitamente. Fotos futuras continuam bloqueadas até provas reais de retirada/replace.
11. Finalize A tardio não liga A automaticamente à Meta criada sem foto. Troca legítima de A por outra aba antes de claim a invalida; depois do claim nenhum efeito foto pode ser atribuído ao comando sem nova imagem.
12. Remover baseline por Confirmar pode atualizar holder/FK/evento conforme o domínio, mas não apaga File/A. Cobrir imagens arquivadas/privadas e política de cleanup sem inferência de unlink pelo proof.

Comparação final: exigir finalização A para todos os caminhos conserva segurança, mas prende a funcionalidade opcional mesmo quando a nova operação não usa o arquivo. Autorizar uma escolha humana sem imagem com proof local específico e locks reais mantém as autoridades separadas, não afrouxa o upload e é a menor saída recomendada para G0. Depende de contrato Root/peer antes de autoria; nenhuma pergunta externa é necessária.