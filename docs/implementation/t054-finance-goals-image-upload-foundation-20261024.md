# T-054 — fundação local do upload de imagem da Meta (B2b-1/J2)

24/10/2026. Implementação offline em quatro paths novos, sobre `01ae6a7c62b8d2dbe9e295b7702d329f64ec5313`. J2 substitui o armazenamento multipartido V1 antes da primeira publicação/montagem, preservando seu freeze original. Não monta interface, envia arquivo, altera Meta, chama HTTP, aplica schema ou ativa recurso. Os doze WIPs M2-S previamente congelados permanecem uma dependência preservada, não uma nova entrega desta fatia.

## Contrato e autoridade

`src/lib/files/goal-image-upload-contract.ts` é puro e não importa componentes. `GoalImageUploadScope` tem a mesma estrutura do scope B2a: `ownerId`, `epoch`, `editorKey`, `goalId`, `goalRevision`, `baselineFileId`. UUIDs são normalizados para minúsculas; revisão existente é decimal canônica até bigint positivo. Meta nova tem revisão e baseline nulas. O futuro coordenador constrói o corpo de reserva a partir do registro decodificado, preservando essa identidade.

O registro fechado contém versão1, finalidade exclusiva `finance_goal_image`, scope, seleção, clientId de reserva, uploadId e fase. Seleção: geração inteira positiva, nome já seguro/canônico, tamanho declarado de1 a8MiB, MIME PNG/JPEG/WebP/GIF e SHA-256 hexadecimal de64 caracteres. JSON UTF-8 tem limite8KiB; o leitor também limita propriedades, profundidade, duplicatas e bytes. O hash identifica a reseleção futura, não comprova conteúdo remoto. A validação de MIME declarada não substitui sniff, dimensões, hash efetivo ou reencode no servidor.

Não há File/Blob/base64, capability, URL assinada, token, comando financeiro, valor monetário ou recibo persistidos. Não há import de adapter, SDK, presenter ou journal financeiro. O scanner puro `parseGoalJson` é reutilizado sem alterar seu path M2-S.

| Fase persistida | Significado local permitido |
| --- | --- |
| `prepared` | Identidade declarada admitida e relida; nenhum envio concedido pelo journal. |
| `reserving` | O coordenador pretende/pretendeu reservar; resposta perdida conserva os mesmos IDs. |
| `reserved` | uploadId não nulo registrado; não é permissão independente para PUT. |
| `put-uncertain` | Estado a reler antes do PUT; ausência de resposta não autoriza substituição. |
| `put-confirmed` | Observação local registrada, ainda sem autoridade de vínculo. |
| `finalizing` | Mesmo uploadId; o futuro fluxo deve respeitar o CommandJournal existente. |
| `ready-unbound` | Apenas metadata de observação. **Nunca prova arquivo finalizado ou Meta salva.** |

Transições são explícitas e monotônicas; repetição da mesma fase é permitida. `put-uncertain` pode seguir a `finalizing` quando o coordenador recuperar o envio original. uploadId é nulo só nas primeiras duas fases e não muda depois de confirmado. Alterar scope, seleção ou clientId exige outra tentativa, que esta fundação não admite enquanto existir a atual. Repetir `stage` com a identidade preparada original devolve a fase atual, sem resetá-la.

## Journal concreto e falhas

`goal-image-upload-journal.ts` conserva o namespace próprio por dono, ponteiro do epoch e marcadores `seen`/`alive`, mas usa um único `state:<epoch>` para a admissão. Forma fechada: `{version:2,ownerId,epoch,revision,state,attempt}`. `empty` inicial exige revisão0/attempt nulo; `active` e `retirement-review` exigem revisão positiva/A completa. A revisão é decimal bigint, incrementada sem Number e sem wrap. O limite8KiB aplica-se ao estado inteiro. A factory assíncrona exige localStorage e Web Locks nativos, abre/reconfere o estado durável e faz zero HTTP. Não há fallback em memória. A espera de aquisição do lock tem limite25s; não é timeout de upload, ainda inexistente.

O host fornece dono/epoch financeiro confirmado e `isCurrent`. Deve trocar sua identidade antes de publicar outra sessão e encaminhar logout/troca confirmada para `revokeIdentity`. A factory não inventa epoch, não observa logout global e não registra callback no aplicativo nesta fatia. Uma instância que nunca terminou de abrir não é um port utilizável; impedir uma nova factory do epoch já revogado continua exigindo a autoridade do host, inclusive quando o armazenamento jamais conseguiu registrar esse epoch. Não se afirma revogação durável de uma sessão que nunca foi aberta diante de falha total de Storage.

Antes de cada operação e depois de cada espera de lock/callback, o journal reconfere host, ponteiro, `seen` e `alive`. Leases escapadas do callback são recusadas; snapshots e entradas são cópias. Escritas somente via lease exclusiva. `advance` exige o snapshot anterior inteiro, incluindo versão/revisão/estado/A, funcionando como CAS local. Repetir uma fase ainda incrementa a revisão; uma lease antiga não recupera autoridade só porque a fase é igual. Isso não substitui CAS no servidor nem lock entre journals distintos.

`stage` grava/readback uma A **completa** em um único SET antes de retornar permissão de IO. Não existe DELETE de selo ou SET de slot separado que possa perder nome/hash/scope entre passos. Se SET tiver efeito mas lançar, ou o readback falhar, o novo handle recupera a A inteira. Se SET não tiver efeito, o estado vazio original permanece: nenhuma A foi duravelmente admitida e nenhum chamador pode ter iniciado IO pelo protocolo. A instância conserva uma cópia de A para recusar B e permitir somente retry humano de A; essa memória não é prova após reload. Um leitor novo vê empty real, não alega reconstruir a A que existia só em RAM. Nenhum método gera UUID ou dispara retry. Getter/proxy inválido, duplicata, bytes extras, quota, chave state ausente, dono/epoch divergentes ou sentinela corrompida são recusados; ausência não reconstrói empty. Nenhuma falha apaga A para tentar outra.

Resíduos V1 `admission`/`slot`/`attempt`, íntegros ou incompletos, permanecem recusados; a abertura confere o namespace do dono, inclusive epochs anteriores. Não há migração, clear ou escape por epoch novo: a Root confirmou que V1 nunca foi publicado/montado. O freeze V1 permanece como evidência, sem representar fonte ativa aprovada.

`dispose` apenas fecha a instância; preserva Storage. `revokeIdentity` é reservado a logout explícito/troca confirmada: remove e relê `alive` antes de redigir o corpo, sem precisar de SET. Assim quota de escrita não deixa outros handles do epoch vivos. DELETE efetivo com readback falho ainda deixa a sentinela ausente; o erro é reportado e a redacção pode ser repetida no mesmo epoch. DELETE sem efeito reporta falha, preserva o corpo e **não certifica limpeza**; o host ainda deve revogar sua identidade financeira. Revogação atrasada de e1 não toca ponteiro/corpo de e2. HTTP403/503, timeout, flag desligada ou desmontagem não equivalem a esse logout.

Não há `clear`, rotação automática, abandono, retry remoto ou admissão de outra tentativa depois de `ready-unbound`. `retirement-review` só é decodificado quando conserva A em ready-unbound; bloqueia stage/advance inclusive da mesma A. **Não existe método retire nem aceitação de boolean/DTO como autoridade para entrar/sair dele.** A futura transição exige receiver e barreira nominal ainda não implementados; o estado não concede prova ou novo ID por si. Remoção manual de todo localStorage e código malicioso na mesma origem não podem ser tratados como recibo/segurança do servidor; esta metadata não concede poder financeiro. O futuro coordenador deve obter uma finalização própria recém-observada e validada antes de apresentar imagem pronta, e respeitar pending financeiro sem alterar corpo/UUID.

## Implementado, escrito e pendente

Implementado: contrato fechado, factory localStorage/Web Locks, estado canônico único V2, readback, lease/fence, CAS por revisão/estado inteiro, admissão única, quarentena V1, revogação explícita e clonagem. Não existe autoridade de retirement, uploader, presenter, editor, host ativo, montagem, IO, alteração de GoalCommand ou duplicação de `file.upload.finalize`/CommandJournal.

`tests/lib/goal-image-upload-journal.test.ts` contém negativos escritos com Storage/locks sintéticos: forma/tamanho/MIME/hash, estado/revisão fechados, cópias, transições, IDs imutáveis, repetição/gerações antigas, quota com e sem efeito, SET com efeito+readback falho, corrupção/duplicatas, chave ausente, quarentena V1, retirement-review bloqueado, abertura parcial, sentinela ausente/corrompida, DELETE com/sem efeito, outros handles, epoch anterior versus novo, dispose, troca de dono durante fila/await e lease escapada. **Nenhum teste, lint, TypeScript, Node, navegador, rede ou SQL foi executado pelo autor nesta entrega.** Fake Storage não prova comportamento de várias abas/disco/Web Locks real.

**Esta fundação não está pronta para montagem.** Validação futura pela Root: typecheck/dependency gate e teste unitário focal no GitHub; depois, em B2b-2, integração e testes reais de reload, quota, cancelamento, sessão/abas, perda de resposta e finalização/vínculo próprios. A retirada local em B2b-2 exigirá prova própria de finalização e ausência de intenção financeira pendente para um descarte local (órfãos seguem o cleanup normal), ou confirmação financeira do imageId correspondente. Metadata pronta ou recibo ausente não autorizam retirada; não se inventa abandono remoto. O contrato desse coordenador ainda será revisado pela Root. E1-A continua proposta inerte com seus próprios gates de instalação/Storage. Nada aqui autoriza ativar `fg_image`, aplicar migration ou promover produção.

Referências: doc17/T-054, B2a picker, planos públicos `work/ci-capture-write-20261021/review/finance-goals-image-upload-b2b-plan-20261024.md` e `finance-goals-image-upload-b2b2-contract-20261024.md`; freeze M2-S `finance-goals-terminal-http-freeze-v1-20261023`. Não inclui Drive UI, Asaas ou novas dependências.
