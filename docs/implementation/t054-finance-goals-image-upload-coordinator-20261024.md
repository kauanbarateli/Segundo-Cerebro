# T-054 — coordenador de upload de imagem, C2a isolado

24/10/2026. Candidato offline, sem montagem, rede, Storage ou banco. Implementa uma fatia de B2b-2 depois de J2; não implementa retirement, editor ou vínculo financeiro. Nenhum teste/lint/TypeScript/Node/navegador/SQL foi executado pelo autor. Testes escritos com ports, Storage, File, Response e CommandSession sintéticos não equivalem à finalização/isolamento reais.

## Fontes e fronteira

O WT autor permanece em `01ae6a7c62b8d2dbe9e295b7702d329f64ec5313`, conservando12 WIPs M2-S e4 J2 congelados. Para **somente** `src/lib/finance-goals-client.ts`, o before autorizado é o blob Git `7e5bad2`, SHA256 `630ebec71a814a63c7e96977e2d0468a9c5ece66b43fe1e7c00f2802d978e505`. Seus imports M2-B precisam da união Root atual; não tentar simular esse fechamento com stubs no WT antigo. O delta desse client é um import, campo readonly e criação da capacidade local sobre o mesmo journal privado. Factory/logout, HTTP, DTO, Core e port `FinanceGoalsClient` permanecem sem alteração.

Paths novos: três módulos `lib/files/goal-image-upload{,-transport,-finance-barrier}.ts`, três testes de mesmo nome, teste `finance-goals-client-image-barrier.test.ts` e este documento. Não há import de componente no lib, SDK, endpoint, schema, migration, env, flag, Workspace, presenter, GoalEditor, package ou workflow alterado. A Root aprovou a diferença para o plano inicial: não importar `components/layout/file-upload.ts` de lib. O transporte específico usa os mesmos endpoints, validadores e sender; não copia/refatora o helper compartilhado nem Avatar/Capturar e não cria uma abstração genérica de upload.

## Capacidade local concreta

`FinanceGoalsBrowserClient.imageUploadBarrier` é adicional no client **concreto**; o port financeiro puro não mudou. Fecha sobre `this.journal`, o mesmo recebido/registrado pela factory existente. Não exporta journal, lease ou input financeiro. Sem outro journal, chave de lock adivinhada ou peek de localStorage.

`runLocalTransition(controller, work)` exige client inicializado, identidade/epoch vivos, controlador atual que corresponde ao client, snapshot interno da lease sem pending/reconfirmação e snapshot atual do controlador também livre. Assim um hold em RAM não desaparece só porque o corpo físico é null. O callback tem retorno undefined, é síncrono e recebe um guard temporário. Promise/outro resultado é recusado; sua eventual rejeição é observada, e o guard expira no finally. Não há escrita financeira, sender, HTTP, ack, terminal ou UUID nessa capacidade. Ordem da composição: upload lock → lease financeira breve → metadata local. Zero IO remoto enquanto a lease financeira está emprestada.

O coordenador captura referências de journal, serviço financeiro, barreira, controlador e métodos da aplicação. Mudança de owner/epoch/mode/closing/serviço impede respostas/efeitos posteriores. Transporte injetado tem seus métodos capturados; uma troca posterior de método não troca a implementação usada pela tentativa. Snapshots/inputs financeiros não são persistidos pelo upload.

## Identidade, seleção e retomada

`GoalImageUploadCoordinator.open` abre/readback os journals locais antes de devolver a instância; não faz HTTP. Exige aplicação conectada e scope compatível. `select(File,generation)` valida tamanho/MIME/nome, lê até8MiB, calcula SHA-256 em cópia de bytes e stage a A completa J2 sob a barreira antes de qualquer IO remoto. UUID é criado somente para uma seleção humana nova; se stage falhar sem efeito, a instância retém o mesmo prepared/clientId para retry humano. Metadata em RAM não se torna prova depois de reload.

`reselect(File)` conserva IDs/generation/scope da A durável e exige nome canônico/tamanho/MIME/hash exatos. Não troca conteúdo por semelhança. File e URLs não são persistidos. O hash local é dos bytes de origem; o hash do arquivo final reencodificado pode diferir legitimamente. Nenhuma igualdade criptográfica antes/depois da transformação é prometida.

`resume()` é uma ação humana finita, sem loop/retry automático:

* prepared sem File depois de reload: pedir o original antes de reservar, pois nenhuma reserva começou pelo protocolo; prepared com File/reserving: mesma reserva e clientId, persistir/readback uploadId antes de PUT;
* reserved sem File, put-uncertain ou put-confirmed: observar envio original; staging/final encaminham ao finalize **original**, não a uma prova direta;
* missing-observed: só permite retry condicional explícito do mesmo File/ID depois de reseleção/hash e nova capability do mesmo upload. PUT anterior ainda pode vencer. put-confirmed seguido de ausência fica held, sem regredir a fase;
* indeterminate: held, preserva A;
* finalizing/ready-unbound: primeiro o mesmo `file.upload.finalize`; nenhum reserve/observe/PUT à frente do finalize pendente. O journal geral continua recusando uma intenção alheia sob seu lock real;
* alvo financeiro stale: não monta GoalCommand/rebase. Recuperar um finalize original ainda pode produzir metadata finalizada, mas devolve stale e não prova pronta ao editor antigo.

Antes de IO não-journal, inicializa/confere o CommandSession público e recusa pending/journal-error/session-changed, além de conferir barreira financeira. Não lê seu corpo privado nem chama retry irrestrito. O receiver usa somente `executeDomainCommand('file.upload.finalize', {upload_id,client_id})` capturado e clonado. Ele não repete o finalize fora de ação humana nem modifica o CommandJournal existente.

## Prova nominal e destino

Somente o retorno desse finalize exato passa pelo registro fechado sem getters e por `observedImageFile` para owner/upload/finalidade `finance_goal_image`. São validados estado não deletado, folder nula, MIME PNG/JPEG efetivo, hash/dimensões/bytes/instantes e limites existentes. Raw DTO, observe final, ready metadata, URL/Blob e objeto fabricado não mintam prova.

A prova fica em WeakMap privado ligada à instância, identidade imutável da A e uploadId; o objeto público é opaco. A atualização/readback de J2 para ready-unbound deve suceder antes da exposição. `inspectReady` reconfere sessão, target scope atual, estado active, metadata/ID e instância. Cópia, serialização, outra instância ou scope stale são recusados. O resultado de inspeção contém só imageFileId/scope/generation; não executa qualquer comando financeiro. É evidência local de observação do serviço, não assinatura criptográfica ou autoridade independente do servidor contra JavaScript malicioso da mesma origem.

Não há criação de Meta, setter genérico, GoalCommand, confirmação financeira, `retire` ou `clear`. O upload finalizado continua protegido em J2; outra seleção B é recusada. A futura fatia deve fornecer prova de finalização+barreira nominal para descarte local, ou confirmação financeira exata do imageId. Esta entrega não resolve isso e **não está pronta para montagem**.

## Transporte e liveness

Reserva/observação: same-origin, expected-owner, sem redirects, JSON64KiB até EOF natural,15s fixos. PUT: somente URL Storage literal validada por `signedUploadUrl`, credentials omit, x-upsert:false, resposta limitada64KiB/EOF e60s. Capability fica só em WeakMap/RAM, ligada a owner/client/selection/scope/upload/expiração, e é de uso único; não consta de metadata/erro/URL de app. Duplicatas, MIME inválido, bytes excessivos, UTF-8 inválido, resposta parcial, ID inesperado, URL/redirect e expiração são recusados. Mensagens remotas, tokens/corpos/URLs não são copiados para erros/logs.

Abort/deadline cancelam o leitor/espera sem aguardar cleanup indefinidamente; isso não afirma rollback do servidor. O coordenador limita também ports injetados: reserva/observe20s, PUT65s, finalize25s (o CommandSession real conserva seu timeout20s), IO local15s e operação inteira150s. Um timeout aborta o signal daquela operação, bloqueando callbacks atrasados; não libera A nem cria ID novo. O JSON genérico do CommandSession ainda não ganhou cap de rede por esta fatia: seu resultado é checado pelo receiver, e não se declara esse hardening como implementado.

### Correção V2 — lease obtida depois da recusa

A revisão independente encontrou um bloqueador na V1: uma lease de upload podia ser adquirida depois dos 150 segundos, e o callback de `resume` ainda alcançava o sender de finalize. Avaliar o Promise antes de chamar `wait` já iniciava o envio, mesmo com signal abortado. O pacote V1 permanece preservado e bloqueado; esta V2 é uma correção escrita, ainda sem execução de testes.

O signal da operação agora é obrigatório nos helpers privados `attempt` e `advance`. As entradas de lease de `resume` e `reselect`, a entrada de `finalize`, as mudanças locais de fase e os pontos anteriores a IO/sender conferem esse mesmo signal. A guarda anterior ao sender ocorre antes de avaliar `executeDomainCommand`; a guarda de `wait` não é usada como substituta. Seleção, reseleção e exposição da prova também reconferem a operação antes dos efeitos locais. Não mudam API pública, fases, J2, barreira, receiver ou deadlines.

Foram acrescentados testes sintéticos com o lock real da fixture retido: a operação ultrapassa 150 segundos e recusa antes da liberação; a fila é então drenada. Os casos `finalizing` e `ready-unbound` exigem zero finalize/reserve/observe/PUT e A integralmente idêntica. A seleção expirada não pode stagear nem criar UUID; a reseleção expirada não pode reter o File em RAM. O teste anterior de timeout depois de um finalize já iniciado continua intacto: conserva um envio incerto e A, sem prometer rollback. Estes testes foram escritos, não executados.

dispose cancela a instância/bytes locais, preservando metadata. Logout/troca confirmada exige `revokeIdentity`, que redige somente o epoch do journal de upload; o host permanece responsável por revogar os demais serviços/journals oficiais. 403/503/timeout/flag desligada não equivalem a logout. A disponibilidade e o gate de montagem continuam com a integração Root; a classe não é uma rota pública nem contorna Entitlements do servidor.

## Provas escritas e pendências

Negativos escritos: lease real versus snapshot solto, B/reconfirmação/hold em RAM/null, callback async/guard escapado, fila e logout; reserva/PUT fechados, limite/UTF-8/redirect/duplicatas/EOF/deadline, capability fabricada/alheia/consumida; entrada durável antes de IO, quota com retry do UUID original, pending geral/financeiro, finalize original em reload, raw observação insuficiente, perda de resposta, input mutado/getter/owner errado, reseleção/hash, hold, target stale, dispose/owner/timeout tardios. Fixtures são fictícias e não usam chaves ou conexão.

Pendente: peer independente da V2 dos três paths corretivos, lint/TypeScript/dependency gate e todos os testes em CI no SHA composto. Os seis outros paths C2a, os 12 M2-S, os quatro J2 e o client-before permanecem byte a byte preservados. Depois: retirement nominal, cancel/discard completos, presenter/editor opcional, host/availability atual e logout real, E1-A e validação conectada/Storage/duas abas. Não herdar PASS de J2/M2/7e5 para este delta. Não aplicar schema, montar o port ou promover produção por causa de testes sintéticos.
