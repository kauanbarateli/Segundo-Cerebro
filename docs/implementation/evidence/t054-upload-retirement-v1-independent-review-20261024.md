# Peer independente estático — retirement R7 V1

24/10/2026. **V1 bloqueada por P2 de liveness no terceiro ciclo**, já identificado pela Root e confirmado independentemente abaixo. Nenhum Node, teste, SQL, serviço, navegador ou rede executado. Nenhuma fonte do autor editada. Os cenários escritos não são aceite de montagem, Storage, servidor ou durabilidade real.

## Identidade

Manifesto `finance-goals-image-upload-retirement-freeze-v1-20261024/manifest.json`, 3.825 bytes/SHA `2b41189b64c2a4393dd8862ecf9cd3c547051abc14c991695644934497f19cd3`. Conferidos sete after, quatro before e três artefatos contra os tamanhos/hashes. Os sete after correspondiam ao WT autor na conferência. Os quatro before correspondem aos blobs imutáveis7f declarados. A leitura Git normal recusou cwd no sandbox; repetição somente leitura por escalada formal aprovou os quatro. A primeira tentativa recusada não foi usada como evidência positiva; nenhuma configuração foi alterada.

Conferidos também21 preservados no WT autor:12 M2-S, contrato/doc J2 e sete C2a V2. O teste inteiro C2a V2 continua idêntico, incluindo os quatro negativos de lease tardia e o timeout de sender já iniciado. Os testes J2 anteriores são prefixo/sufixo literais do novo arquivo, com somente5.933 caracteres de testes inseridos antes do fechamento do describe.

## P2 — B durável pode conservar um latch que impede C

`src/lib/files/goal-image-upload-journal.ts:161–164` guarda heldReplacement=B antes do SET. Se o SET grava B e o readback falha, a chamada recusa corretamente e não chega à limpeza do latch na linha164. B permanece integral no único registro; o handle A perde sua autorização e não deve tocá-lo.

Um NOVO coordenador B sobre o MESMO objeto journal pode abrir, reter a identidade exata de B, retomar/finalizar B e depois retirá-lo para retirement-review(B). Entretanto readState/open/snapshot/retire não reconciliam heldReplacement. Ao tentar C, a linha161 compara o latch B com preparedC e recusa PENDING, embora haja uma prova fresca legítima para retirar B e o CAS esteja correto. Criar um novo journal pode evitar o latch em RAM, mas o contrato documentado oferece retomada com os mesmos recursos; não se deve exigir isso silenciosamente nem apagar a tentativa.

O teste `tests/lib/goal-image-upload-retirement.test.ts:81–90` comprova B durável e A fenced, mas termina em need-file do novo B. Falta o percurso positivo completo B→finalização→review(B)→C, preservando o mesmo journal. Corrigir somente mediante leitura/readback positivo da identidade COMPLETA B igual ao sucessor retido; ausência, null, apenas scope ou uma identidade C diferente não podem limpar o latch. Manter os negativos de A stale, quota sem efeito e readback incerto. Não gerar UUID novo para esconder uma tentativa ainda não reconciliada.

## Autoridade e isolamento examinados

Não encontrei segundo bloqueador objetivo nesta leitura:

- Issuer em `finance-goals-client.ts:148–172` usa somente retorno positivo dos caminhos reais execute/reconcile/terminal confirmed, após decoder vinculado à intenção capturada e o reconhecimento do journal. O journal financeiro existente faz SET/DELETE com readback e fence; falhas parciais impedem reply.ok e emissão. Preview/read/null/omissão/closed/uncertain não emitem vínculo. A WeakMap exige mesmo client/owner/epoch/fence, não aceita DTO/clone/proxy e é consumida antes do SET local.
- O vínculo mínimo compara imageId e source/sucessora da Meta. Não armazena nome, dinheiro ou corpo financeiro. A prova é local de um positivo histórico, sem prometer disponibilidade atual do arquivo nem substituir E1/servidor.
- `retirementState` ancora a identidade inteira capturada por cada handle. Depois de B persistir, A recusa B mesmo no mesmo scope, antes de sender/mutação. O caminho stale/review só finaliza o upload ORIGINAL e não retorna ready para outro editor.
- Ordem de lock: upload→lease financeira breve→CAS/readback síncrono. Sender/HTTP/finalize precedem essa lease; não há fetch/loadPending/ack/terminal dentro dela. Pending físico, hold em RAM, reconfirmação ou sessão recusam a transição.
- A permanece completa em review; B entra num único SET/readback, com nova identidade e geração quando aplicável, sem empty/DELETE intermediários. Grant e prova são queimados antes da escrita, com guard/signal/CAS/estado inteiro. Retire não apaga arquivo, não libera dinheiro e não se torna prova pela metadata.

Pendentes após V2: revisão do delta corrigido, TypeScript/lint/camadas/inventário e unidades próprias no SHA composto. A dependência de valor coordenador→client deve entrar na derivação real; nenhum número de fonte deve ser presumido. Não montar editor/Workspace, ativar flags/schema ou promover ambiente por este parecer.