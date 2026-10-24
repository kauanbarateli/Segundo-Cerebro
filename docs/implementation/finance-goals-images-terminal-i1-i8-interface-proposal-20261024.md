# Proposta mínima de interface — gate nativo I1–I8

Somente proposta para decisão Root. Não reserva autoria, não implementa nem executa gate, SQL, schema, workflow ou serviços. Referência: plano-promocao-finance-goals-schema-20261024.md, SHA160a95f0812d3d790d772f6551080abebfaf23349fd81c47e4f45d0b26beebdf. Base pública informada:0d933d98ca8fcd6def222d184d9b9462370d98eb/treeb6c018609cac8267f9c58def3385911f6dcd8eb2. O peer da extração E1 é separado; seus três WIPs ainda não são tratados como fonte publicada.

## Compatibilidade e modo

Manter N12 como suite terminal-v2, suas doze ordens, oracle, relatórioV2 e defaults. Acrescentar images-terminal-v1 com I1–I8, cenário e validador próprios. Não converter N12 em vinte casos, nem aceitar o relatórioV2 antigo como prova da união. Resultados N12 de0d, Dad ou deb não pertencem ao futuro SHA.

Sugestão de selector mínimo: conservar exatamente --execute e --help existentes; acrescentar um único literal --execute-images-terminal-v1 no main, mapeado ao enum images-terminal-v1 depois dos guards CI. Sem SQL, URL, RPC, path ou argumento livre. Sem variável de ambiente nova repassada à sessão física. Qualquer outro token/combinação recusa antes de start. Root deve confirmar esse spelling antes de autoria.

O workflow existente é .github/workflows/finance-goals-terminal-native-ci.yml. Conservar o job goals-terminal-native e acrescentar um job de imagens com needs:goals-terminal-native, stack/Auth/namespace/relatório próprios. Preservar cancel-in-progress:false. Não somar20 casos ao orçamento35min atual. O orçamento novo será explícito, sem ampliar15s/ação,120s/sessão,5s/barreira,quatro sessões ou limites de bytes. Medir margem no candidato próprio; sleep não escolhe vencedor.

Dois jobs no mesmo workflow não significam dois novos run IDs por evento: a expectativa inicial é continuar19 runs com21 jobs elegíveis (dependendo dos gatilhos reais). Coletores devem observar cardinalidade e identificar cada job; nenhum resumo herdará verde do needs.

## Ownership sugerido, após GO

| Responsável | Paths e limite |
| --- | --- |
| Root | Publicar primeiro os3paths da extração E1 revisada; integrar modo/guard/graph no scripts/verification/finance-goals-terminal-native-ci.mjs e o job dependente no workflow. Paths compartilhados só com revisão/delta único. |
| Autor do gate I | Novos tests/e2e-auth-local/finance-goals-images-terminal-native-contract.mjs e finance-goals-images-terminal-native-case.mjs; testes novos tests/scripts/finance-goals-images-terminal-native-contract.test.mjs e finance-goals-images-terminal-native.test.mjs; documento t054 próprio. São paths propostos adicionais para manter o relatórioN12 intacto. |
| Autor do gate, sob Root | Export SourceE1 no finance-goals-terminal-native.entry.ts; extensão finita do issuer finance-goals-terminal-native-sql.mjs e de seus testes. Mesma registry nominal privada de tickets e framing existente; sem função pública de registrar SQL. |
| Preservados | finance-goals-terminal-native-case.mjs, seu oracle N12, finance-goals-terminal-native-contract.mjs/V2 e finance-goals-terminal-native-session.mjs. Nenhuma mudança física/ACK/erro/timeout é presumida por este plano. Qualquer necessidade vira delta para Root ANTES de implementar. |
| Fora do ticket | Produto/UI, SDK/factory WASM no bundle, flags/env, migration/promoção, types/catálogo da release futura, operadores privados, Storage real, merge e produção. |

A extração E1 mantém ../../ relativo. A nova entrada/artefato deve conservar a profundidade já guardada pelo runner; não depender de tree-shaking. Fecho AST/plugin, imports dinâmicos proibidos, realpath, Git blobs e hash pós-execução precisam ser derivados no SHA novo. Nem130/45 nem a contagem de fonte antiga são promessa: imports compartilhados novos podem alterar o fecho N12 também. Toda adição deve ter origem e negativo missing/blob; não repinar até passar.

## Interfaces e tickets nominais

Conceitualmente: run suite fechada recebe environment CI existente e retorna NReportV2 OU ImagesReportV1 conforme selector; validadores nunca convertem um no outro. O caso de imagens recebe kind:I1–I8, produto pinado, contexto de instância, atores locais, sessões/budgets existentes e cleanup callback. Não recebe função SQL genérica, corpo/caminho/URL arbitrário ou transporte hospedado.

Propor issuer separado goalImagesNativeStatement(context,action,data), dentro da MESMA registry privada do móduloSQL atual. A sessão existente só reconhece tickets nominais desse issuer/frame; cópia de shape, Proxy/getter, contexto estrangeiro ou ticket de outra instância não passam. Inputs usam strings primitivas antes de regex/template, objetos de chaves próprias exatas, bytes limitados e captura imutável antes de await.

Enum mínimo de ações novas: IMAGE_RESERVE, IMAGE_CLAIM, IMAGE_COMPLETE, IMAGE_CLEANUP_CANDIDATES, IMAGE_CLEANUP_ACK, IMAGE_FIXTURE, IMAGE_MATERIAL e IMAGE_ABSENCE. Cada ramo tem argumentos próprios fechados e target literal. Reserve/claim/complete são os públicos file_upload_reserve/claim/complete; cleanup usa somente file_cleanup_candidates e file_cleanup_ack. Não aceitar nomeRPC do caller. Material/fixture/ausência são templates internos finitos do namespace. Gates de catálogo/fault injection também serão literais pinados, sem interpolação genérica ou função callback que produza SQL.

Preferir envelopes físicos já existentes: RPC real retorna ack/rpc/value; fixture,material(a/b),absence têm seus shapes atuais. Assim o novo maker pode criar tickets na registry sem alterar a sessão. Novos ACKs ou import circular para contornar a nominalidade NÃO estão autorizados. Se o desenho exigir isso, parar e apresentar a interface alternativa a Root.

Não executar Storage.remove/PUT/URL assinada. A imagem finalizada é uma fixture explícita pelo caminho SQL público reserve→claim→complete; o gate prova metadados/vínculo/cleanup SQL, não bytes/pixels. Se essa fixture exigir entitlement novo, derivar a concessão mínima fechada no modoI, mantendo a expectativa e os atoresN12 intactos; não usar Master, bypass de Auth ou escrever metadados de usuário como autorização.

## Oito grupos fixos

| ID/enum proposto | Oracle mínimo |
| --- | --- |
| I1_CREATE_BIND_FIRST | CREATE vence; cleanup waiter observado, recheck/ACK preservam imagem referenciada. Candidate retornado com remove_final=false é válido; não exigir ausência artificial. |
| I2_CREATE_CLEANUP_FIRST | Cleanup vence batch original válido; CREATE recusa22023 pela imagem não finalizada, sem Meta/recibo/evento/efeito financeiro tardio. |
| I3_UPDATE_BIND_FIRST | Troca explícita vence; referência/revisão sucessora exatas; baseline anterior e material financeiro preservados. |
| I4_UPDATE_CLEANUP_FIRST | Cleanup vence; recusa original da prova indisponível, sem troca de referência/revisão/recibo. |
| I5_HOLDERS | Meta ativa/arquivada e todas as espécies holder023 protegem seleção,recheck,ACK; referências owner+file completas. Asserts nativos, sem barreira fictícia. |
| I6_IMAGE_COMMIT_FIRST | Commit vence settle; recibo original, sem disposição/novo efeito; replay após troca legítima de imagem continua receipt-first. |
| I7_IMAGE_SETTLE_FIRST | Settle vence; nenhum vínculo posterior. Executor histórico com batch válido recusa23505/NAMESPACE_CLOSED, não stale genérico. |
| I8_NEGATIVES_ROLLBACK | Owner/sessão/finalidade/grants e falha de evento após projeção: rollback integral de FK,Meta,recibo,revisão,quota e outro usuário intacto. |

I1–I4/I6/I7 precisam de barreira PostgreSQL/PIDs/mesmo advisory lock observados. I5/I8 usam schema de checks próprio; não preencher barrierObserved=true sem confronto. Revogação deve respeitar a linearização FOR SHARE de sessão anterior ao lock do dono.

Material completo e ordenado dos dois atores permanece interno ao oracle, comparado por conteúdo e não só contagem: ledger/contas/revisão/quota,Metas/reservas/liberações/destaque,arquivos/reservas upload,recibos/eventos/disposições e permits. Não expor esse material em stdout/erro.

## Relatório novo fechado

ImagesReportV1: version1, scenario finance-goals-images-terminal-native-ci, suite images-terminal-v1, sourceSha/sourceTree,nodeVersion completa24.x.y,cliVersion,serverVersion17, status/code/phase,sources/dependencies,cases exatamente os8IDs em ordem,writeOutcomeUncertain,pending(commands/http/backends),cleanup(groups/backends/stack/temp),limitations. Reusar conceitos e limites, sem alterar o decoderNReportV2. Ausência/falha continua explícita; todos os grupos restantes ficam not-run.

Checks por grupo são fechados e diferentes quando não aplicável. No PASS, exigir fonte/instância/Auth/catálogo/originalGraph/oracle/sessões/fixtureAbsent observados, barreira nos seis confrontos e zeros de pending/unknown. SQLSTATE/mensagem entram somente como enums públicos revisados (ex.:IMAGE_NOT_FINALIZED,IMAGE_PROOF_UNAVAILABLE,NAMESPACE_CLOSED), nunca textoSQL/stderr.

Contagens são deltas em janelas de operação identificadas, com expectativas exatas por caso antes do freeze: receipts,dispositions,financialEffects/events,terminalEvents,quota,imageReferences,cleanupAcks,holders,sessions. I6 pode ter troca legítima adicional; não usar total global1 ou ignorar essa escrita. Fonte pass não dispensa terminais reais/EOF,exit/close/códigos/sinais,quiescência e ausência de backends/fixtures. Timeout/ACK ausente/erro após COMMIT sem prova = unknown e bloqueia PASS.

limitations mantém hostedAccepted,browserAccepted,imagesAccepted,restoreAccepted,productionEnabled=false. O PASS significa somente o gateSQL descartável de união. Upload/bytes/RLS/HTTP/Storage reais e aceite de UI/produção continuam separados.

## Gates antes de qualquer execução

Root confirma selector,paths e matriz exata por grupo; autor congela fontes/testes e prova preservaçãoN12/session/protocol. Peer independente verifica tickets,grants,barreiras,cleanup e material. Controles puros cobrem enum/shape/major24,relatório cruzado,8IDs,not-run/unknown/cleanup,forged ticket/coerção e todos os novos branches. CI próprio deve provar N12 e I8 na mesma árvore, sem rerun automático, skip convertido em PASS ou CI antigo herdado. Companions permanecem os bytes revisados; aplicação remota não faz parte desta frente.

Esta proposta usou apenas leitura/hash de fontes e plano público; nenhum Node,Git,SQL,CLI,serviço,rede ou dado privado foi executado/lido. Nenhuma autoria dos paths acima foi iniciada.
