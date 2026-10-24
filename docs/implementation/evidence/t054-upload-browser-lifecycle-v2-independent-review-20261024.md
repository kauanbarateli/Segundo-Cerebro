# Peer browser J2 corrigido — 24/10/2026

**Favorável estático ao hash corrigido, sem novo bloqueador objetivo nesta leitura.** O parecer V1 bloqueado permanece em finance-goals-image-upload-browser-lifecycle-v1-static-peer-20261024.md, SHA `9cb3847fdf625c78d75cc5f359afeb7921f6406a91a2789d37a35565274fe386`. Nenhum teste ou browser foi executado por este peer.

## Vínculo e preservação

- Fonte Root: src/lib/files/goal-image-upload-journal.ts, 20.622 bytes, SHA `1fd90cfd41c28e93f127b5d5834d094d7c20c4f41ccc050b67f072a65eeb4cf3`.
- Teste Root final: tests/lib/goal-image-upload-browser-lifecycle.test.ts, 8.239 bytes, SHA `4eb2c6be2f113aa1a7d8f5d54e9bad6148180cbbc7918a7be79e2be564447cad`.
- A classe GoalImageUploadJournal e seus imports, do começo do arquivo até o fim da classe, são byte-idênticos à base0d933 (arquivo completo antigo SHA `fddaf835d17ff455ebd87629d40f5fa2b965dfb407857d5ede4fb0f75191c21b`). Comparei os prefixos nos delimitadores da factory antiga e do novo registro.

Portanto não houve alteração do protocolo2, CAS/revisões, validação de A, fases/retirement/replace, heldReplacement, seen/alive/pointer, redação da classe ou seus prazos. O delta é exclusivamente o ciclo browser fora da classe e os casos novos. Não foi copiado para meu pacote G0.

## P2 V1 fechado pelo token estável

O registro passa a reutilizar o MESMO objeto por owner/epoch; substituir o último revoker modifica somente entry.journal. Cada instância captura esse objeto em environment.isCurrent, cuja condição é registration.revoked===false E o guard atual do host. Antes de register terminar, registration é null, logo o guard é conservador.

Register ocorre antes do primeiro await de journal.open. Logout marca entry.revoked antes de tentar remover alive/state. Assim um handle anterior, uma factory na fila e o último redactor veem a mesma revogação, mesmo se remove/readback falhar ou o host ainda retornar true. O P2 anterior não depende mais de marcar somente a flag privada da última classe. Nenhum SET é necessário para criar o tombstone RAM.

O tombstone recusa reabertura do mesmo epoch; não é apagado pelo sucesso do retry. Um novo epoch pode abrir conforme os fences duráveis existentes. A saída da área/dispose não registra logout nem remove A: o listener global e o último revoker permanecem acessíveis. Um journal fechado pode ser usado para retry de revokeIdentity porque esse método preservado não depende da sessão continuar aberta.

## Owner e redação falha

As chaves do registro vêm de journal.ownerId/epoch já normalizados pelo constructor; o evento também normaliza o owner. Registrar a identidade atualmente confirmada revoga os outros owners, sem usar metadata de A para adotar B. Um logout tardio de A percorre somente o mapa A; o corpo B e o epoch B permanecem separados.

Se a remoção/readback falha, o token continua revogado e a referência exata ao redactor fica registrada. A abertura de outro owner recusa enquanto a redação anterior não for confirmada; uma notificação explícita posterior pode repetir as remoções. O código não recria alive, seen ou pointer para reparar a falha, não transforma erro em ausência certificada e não retém File, bytes ou comando financeiro no registro global.

A factory assume que seu caller fornece owner/epoch financeiros confirmados e um guard de sessão real. Não autentica por si só e não transforma um CustomEvent em prova de identidade. O tombstone é RAM do módulo/documento, não uma nova garantia persistente entre reloads/tabs; o guard de Auth/epoch do host e os marcadores duráveis continuam necessários na montagem H1.

## Oito casos escritos e oracle corrigido

Conferi oito declarações: logout fora da área com seen/pointer preservados; um open enfileirado; duas factories mesmo epoch antes de inicializar; logout no SET de alive; dispose/novo host com A íntegra; troca de owner/logout A tardio; remove falho com dois handles e retry explícito; caller stale antes do lock.

Os dois novos negativos cobrem precisamente o P2: duas factories têm ambos resultados rejected/SESSION_CHANGED e zero SET tardio; dois handles já abertos recusam após falha na remoção, mesmo com alive ainda persistente, e o retry depois completa a redação. A fixture usa EventTarget/Storage/Web Locks simulados, sem autoridade nativa ou Auth/Storage remoto.

No teste intermediário SHA `73e56710bc08389f7870ae9e477d62e4d48a0665d25a558c88eddb8c8c0efcef`, identifiquei outro P2, somente de expectativa: logout síncrono dentro do SET de alive remove a chave antes do readback de put(); o readback vira UNAVAILABLE ANTES de initialize verificar host. A classe não foi alterada para acomodar o teste. O hash final4eb2 exige o UNAVAILABLE original nesse interleave e SESSION_CHANGED na reabertura pelo tombstone, preservando asserts de seen/ausência de alive/state/pointer. Isto não declara redação completa a partir de um erro.

## Limites

Leitura, hashes e comparação textual apenas; nenhum runtime, Node, Vitest, navegador, serviço, rede, SQL, CLI ou Git nesta revisão. Nenhuma edição Root/frozen foi realizada. Aprovação estática não é PASS dos oito casos, Web Locks nativos, quiescência, upload, montagem H1, Auth/Storage conectado, schema, merge, produção ou restore. Root precisa conferir o novo SHA integrado e seus gates próprios, preservando as evidências V1 e intermediárias.
