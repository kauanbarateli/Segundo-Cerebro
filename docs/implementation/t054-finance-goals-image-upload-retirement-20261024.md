# T-054 — retirada local de uploads de Meta (C2b-R)

24/10/2026. **Implementado em fonte isolada; não validado por execução e não montado.** Base pública Root: 7f14507353d211737b0ee22395673fb4968df785. A autoria usa o WT histórico HTTP, com seus quatro arquivos existentes byteiguais a essa base antes do delta; não copia M2-B ou dependências de outros paths. O fechamento/TypeScript/camadas e testes precisam da composição Root, sem stubs para fingir essa cadeia.

## Contrato e autoridade

Sete paths: client concreto, coordenador, journal J2, testes novos client-image-link e upload-retirement, teste J2 existente e este documento. Port FinanceGoalsClient, factory, HTTP/API, Core, SQL, flags, env, editor/picker e Workspace não mudam. C2a V2 e seus quatro negativos de lease após deadline permanecem preservados. E/retirement no host continuam sem montagem.

O client concreto fornece imageUploadLinks.current(): GoalImageLinkedProof|null. A função somente lê uma observação privada já existente e não faz HTTP/mint. Issuer/WeakMap ficam no mesmo módulo do client; só execute/reconcile ou terminal confirmed, após o reader real, validação para a intenção capturada e reconhecimento durável/fence positivos, produzem prova. Current não aceita DTO, callback, GoalCommandResult ou assinatura fornecida externamente.

A captura do comando ocorre antes dos awaits. O cache guarda somente owner/epoch, comando/clientId, source goal/revision e result goal/revision/imageId; não guarda nome, dinheiro ou corpo financeiro. Create exige imagem explícita não nula e revisão0; update exige propriedade própria explícita não nula e sucessora exata expected_revision+1. Omissão/null, prepare/leitura, terminal closed/uncertain e qualquer resposta falha não emitem prova.

inspectGoalImageLinkedProof confere a identidade do MESMO client e seu fence. consumeGoalImageLinkedProof queima a prova antes do SET/readback. Current passa a null e não a reconstitui. Uma falha posterior exige novo positivo original ou discardFinalized com observação própria fresca; storage/DTO/clone não reemitem autoridade. Novo pedido de execute/reconcile/terminal invalida o cache anterior; dispose/logout também. Um resultado de vínculo pode ser histórico; não promete que o arquivo continua disponível agora. O servidor/E1-A ainda revalida acesso, finalidade, estado/FK/holders e vínculo atômico.

Nominalidade é proteção do contrato local, não assinatura contra JavaScript hostil na mesma origem. As primitivas J2 são armazenamento/CAS interno da composição, nunca prova. Não oferecer journal/lease ao editor nem chamar essas primitivas para contornar o coordenador.

## Transições locais e liveness

retireLinked(proof) compara imageId e relação source/sucessora com a A original antes do consumo. discardFinalized() faz ação explícita e finita de file.upload.finalize com uploadId/clientId ORIGINAIS, valida o retorno fechado próprio e usa essa nova observação somente uma vez. Não observa Storage, não reinicia reserva/PUT e não interpreta ausência. Só fases finalizing/ready-unbound podem ser retiradas; prepared/reserving/upload ainda não finalizado precisa da retomada C2a correspondente.

O caminho retirement-review é próprio, sem passar por attempt(active-only). Pode recuperar A stale observando o original, mas não devolve GoalImageReadyProof para o editor B. A scope não é alterada nem rebaseada. Cada handle captura a identidade completa do upload existente na abertura; seleção inicial captura a sua A. Essa âncora permanece mesmo se um SET de B tiver efeito e seu readback falhar: resume/retirement de A recusam B antes de IO, inclusive se os dois têm o mesmo scope.

Sempre upload lock → lease financeira real breve → CAS/SET/readback síncrono. Zero HTTP/sender/Storage/loadPending/ack/terminal na lease financeira. A prova é obtida antes, e guarda/signal/controller/owner/epoch/fence/estado inteiro são reconferidos dentro. Pending concreto, hold do controller com null físico, reconfirmRequired ou erro impedem escrita. A revisão/ack humana financeira existente não é contornada pelo retirement.

active(A) vai para retirement-review(A) em um SET e revision+1, conservando A completa (a fase pode avançar de finalizing para ready-unbound após observação positiva). Repetir retirement-review local é idempotente e não minta prova. Só depois do readback e barreira positivos há uma autorização privada, em RAM e de uso único, para seleção B explícita.

replaceRetired(file,generation,nextScope) captura/valida o scope ATUAL separadamente de A, valida/hash o File em RAM, e troca review(A) por active(B,prepared) em um único SET/readback, com revision+1. Não há DELETE, empty intermediário, histórico paralelo ou mudança do scopeA. B tem clientId diferente e geração nova quando o scope é igual. O prepared B fica em RAM para repetir apenas sua identidade após SET sem efeito; o retry requer outra prova original, pois a autorização foi queimada antes do SET. Se B ficou durável, reabrir/recuperar B exata; não refazer UUID.

Sucesso de B devolve o snapshot e fecha o handle A. Exige novo GoalImageUploadCoordinator.open com scopeB, mesmos recursos reais e seleção/reseleção local exata antes de novo PUT. Readback falho não declara sucesso: grant queimado, B ou A integral recuperável, nenhum handler A autorizado a mutar B. Não há clear/reset/retire de arquivo. Encerrar acompanhamento local não altera Meta nem significa que o arquivo está sem holder; cleanup histórico segue suas condições.

## Falhas, recuperação e testes escritos

Sem efeito no SET: predecessor integral. Com efeito e erro/readback falho: sucessor integral continua no único registro; a chamada não concede permissão. Reload sem prova exige observação nova. Não reconstruir o corpo financeiro removido a partir de A. Se o original ainda está no protocolo financeiro, consulta humana existente pode dar novo positivo; caso contrário, finalize original fresco + barreira livre permite apenas encerrar acompanhamento local.

Testes escritos, sem execução: issuer pelo client real com HTTP sintético; create/update, sucessora, captura contra mutação, uso único/clone/proxy/getters, instância/owner/epoch, preview não issuer, ack parcial/terminal novo, flag desligada, late timeout; retirement com reconfirmação, scope stale/review, A→B/nova abertura, identidade diferente após SET B/readback falho, quota/mesmo UUID, pending físico/hold/reconfirm, dois handles e source goal/image/revision alheios, logout e lease tardia; J2 CAS/replay e SET antes/depois/readback sem DELETE. As suítes sintéticas não provam Web Locks/Storage/servidor reais.

Pendentes: peer independente, TypeScript/lint/camadas/unidades no SHA composto e revisão da nova dependência de valor coordinator→client para o inventário. Depois, E isolada com props opcionais; nenhuma montagem antes de aprovação Root e gates próprios. Auth/Entitlement/RLS, Storage e corridas cleanup×bind exigem a união supervisionada E1/financeiro. Não executar schema em CI, não promover produção nem aceitar restore por esta entrega.


## Correção V2 — reconciliar o hold do candidato que ficou durável

A revisão Root confirmou um bloqueador na V1: se SET B tinha efeito e o readback falhava, heldReplacement ainda apontava B. Um novo handle B usando o MESMO journal conseguia retomar/retirar B, mas a troca seguinte C era recusada pelo hold antigo. O freeze V1 fica preservado e não é tratado como corrigido retroativamente.

Na V2 o hold vincula predecessor A inteiro e candidata B. Sob a lease/guard atual, um método privado compara a identidade imutável completa de B com o registro durável e exige revisão sucessora ou posterior coerente com os avanços mínimos de fase. Prepared exige pelo menos predecessor+1; reserving+2, reserved+3, put-uncertain+4, put-confirmed/finalizing+5, ready-unbound/review+6 (o caminho direto uncertain→finalizing é permitido pelo contrato). O decoder já exige estado/fase/ID válidos. Nenhuma fase regredida ou identidade diferente pode liberar o hold.

Somente essa B reconhecida promove heldPrepared=B e retira o hold local, sem SET, DELETE, alteração de revisão ou emissão de ready/grant/prova. Guardas antes/depois protegem a mudança privada; falha transitória restaura os caches, enquanto revoke/dispose explícitos mantêm sua redação. Se A ainda é o predecessor sem efeito, B e seu UUID permanecem obrigatórios e C é recusada. Estado divergente ou revisão insuficiente não limpa nada.

Foram escritos dois casos com três ciclos consecutivos de SET com efeito/erro ou readback falho, sempre abrindo NOVO handle sobre o MESMO journal antes de observar/finalizar/retirar a candidata; depois outra admissão deve funcionar. A reconciliação isolada exige zero escrita/IO. Negativos J2 verificam identidade/revisão mutadas e a retenção sem efeito já existente. Não muda nenhuma assinatura pública, wire, schema, autoridade, prazo ou regra de montagem; testes/TypeScript/lint/CI seguem não executados pelo autor.

## Correção V3 — classificar identidade antes da fase de retirada

A leitura Root encontrou uma inconsistência fail-closed preservada em V2: depois de SET B com efeito/readback falho, o estado durável B é prepared/uploadId null. O handle antigo A recusava a retirada como PENDING antes de conferir que a identidade era outra, enquanto os negativos existentes já exigem STALE. Não é permissão de efeito nem perda de A/B.

A V3 mantém ausência de tentativa/empty como PENDING; havendo tentativa, identidade divergente é STALE antes de olhar fase/uploadId. Só a própria identidade ainda sem upload ou fora de finalizing/ready-unbound recebe PENDING. Guardas, lease, receiver, autoridade, journal, prazos, IO e fases não mudam. A nova fixture opt-in para A original prepared escreve um negativo de zero finalize, zero Storage, zero UUID adicional e snapshot/storage integrais preservados. Os negativos de B prepared e dos três ciclos mantêm suas expectativas STALE originais, sem adaptação ao defeito.

R1/R2 e suas evidências permanecem congeladas. Esta fatia foi apenas escrita e revisada textualmente pelo autor; nenhum teste, Node, lint, TypeScript, SQL, rede ou serviço foi executado. O próximo candidato precisa do peer independente e de CI próprio. Não certifica efeito hospedado, montagem, produção ou restore.
