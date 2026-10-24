# Peer browser J2 V1 — 24/10/2026

**Bloqueado por P2 de revogação local.** Fonte Root lida: src/lib/files/goal-image-upload-journal.ts, 20.235 bytes, SHA256 `bb1c8c57622a7d9532ad31969d8f0db1365d04686539e3a31bf9963e8fbd152f`. Base J2 de0d933: 18.236 bytes/SHA `fddaf835d17ff455ebd87629d40f5fa2b965dfb407857d5ede4fb0f75191c21b`. Nenhum runtime, teste, navegador, rede ou edição Root foi realizado. O teste novo ainda estava em autoria quando iniciei a leitura; não o trato como congelado ou executado neste parecer V1.

## Achado P2 — o tombstone não alcança todas as instâncias do epoch

registerBrowserJournal cria um registro novo e faz epochs.set(journal.epoch,{journal,revoked:false}) a cada abertura. Duas factories do mesmo owner/epoch deixam somente o último handle no mapa. O ambiente de cada classe recebe apenas o isCurrent do caller, sem consultar o registro/tombstone. revokeBrowserOwner marca revoked e chama revokeIdentity somente no último handle.

Vetor público dedutível do código, sem execução:

1. Duas factories h1/h2, mesmo owner/epoch, isCurrent ainda true, aguardam lock antes da primeira inicialização. h2 substitui h1 no registro.
2. Logout explícito (ou abertura confirmada de outro owner) marca o registro e revoga h2. Como seen/alive/state ainda não existem, remove pode confirmar ausência sem criar um marcador persistente.
3. h1 não tem revoked=true nem vínculo com o tombstone RAM. Ao entrar depois na fila, seu initialize pode criar seen/alive/empty/pointer e retornar um journal vivo, apesar do logout desse epoch.

Outra variante: h1 e h2 já estão abertos; a remoção de alive falha no logout. h2 fica revogado, mas h1 continua sem flag privada de revogação e ainda encontra alive persistente. Se o callback do host ainda for true, pode continuar operando. Não depender exclusivamente da atualização posterior do host para fechar esta janela: o novo ciclo global pretende invalidar o epoch imediatamente.

Não é demonstração de bypass Auth remoto ou de prova nominal de imagem. É inconsistência objetiva da revogação local e da impossibilidade de ressurreição do mesmo epoch, com impacto potencial na retenção/redação do corpo local.

## Menor correção proposta

Conservar um registro/token estável por owner/epoch, capturado no environment.isCurrent de TODAS as instâncias; trocar o último revoker pode atualizar somente o ponteiro journal, sem substituir o token. Marcar o token antes das remoções; qualquer handle anterior ou factory pendente deve consultá-lo antes de inicializar/ler/escrever. Alternativa mais ampla seria registrar/revogar todos os handles, desnecessária se o token estável for completo. Não mudar classe, wire J2, seen/pointer, CAS, tempos ou regras de retirement.

Dois negativos obrigatórios: duas factories enfileiradas→logout antes da inicialização→ambas recusam/zero SET tardio; dois handles abertos→remove alive falha→ambos recusam e notificação explícita posterior consegue repetir a redação do handle registrado. A troca de owner precisa cobrir o mesmo token.

## Direções coerentes que não substituem a correção

Registro antes do primeiro await; listener global que sobrevive à saída da área; tombstone sem File/body; recusa de reabertura do epoch revogado; revogação de outros owners somente no caminho que recebe identidade confirmada; e retenção do handle exato quando a remoção/readback falha para permitir retry explícito. O retry não deve recriar alive/seen/pointer nem tratar falha como ausência certificada.

Root confirmou o achado e informou que fará a correção por token estável sem alterar a classe. Essa comunicação não aprova antecipadamente o novo hash. O presente parecer fica preservado; a fonte corrigida e seus casos escritos exigem outro peer. Não há aceite de UI, Web Locks reais, armazenamento, montagem, schema, produção ou restore.
