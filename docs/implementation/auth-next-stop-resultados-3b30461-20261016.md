# Relay original observado em Admin e Recovery — 16/10/2026

Primeiras capturas próprias dos runs de `3b30461`, etapa 8/index 7, usando JOB REST original e interior estrito do intervalo. Metadados de run/tentativa/job/step foram conferidos duas vezes antes do claim. Reader19/19 próprio de Root, lint3+2 e peer independente; logs novos somente em NTFS privado, sem reabrir capturas anteriores.

## Admin

[Run38959031520/job117169122077](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38959031520), [evidência fechada](evidence/ci-admin-native-3b30461-20261016.json): `QUIESCENCE_HTTP_AUTH_RESPONSE_PENDING`, oito estágios funcionais, uma request HTTP pendente e zero SQL. Login/fetch/main, introduzida em fixtures, after-blank, continue-ack. A avaliação original foi **INELIGIBLE / STATIC_AUTHORITY_MISSING**. No parent, após settlement do runner e antes do finally, requested=false, settled=false, resolvedTrue=null.

O worker não emitiu o pedido de stop durante o drain; a autoridade estática não existia para essa request. O snapshot do parent antecede o finally, que depois chama `stopOnce`. Isso explica sua inelegibilidade no drain, não a ausência do terminal. Escrita incerta/limpeza não certificada permanecem. O segundo caso não executou. Fontes352Git+60dependências declaradas conferidas; não representam todo o código executado.

## Recovery

[Run38959031628/job117169122527](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38959031628), [projeção fechada](evidence/ci-recovery-native-3b30461-20261016.json): `QUIESCENCE_HTTP_ASSET_NO_RESPONSE_PENDING`, sete estágios funcionais incluindo alteração de credenciais, quatro requests pendentes e zero SQL. Script/full, continue-ack. A avaliação original foi **EMITTED / NONE**. No parent, após settlement do runner e antes do finally, requested=true, settled=true, resolvedTrue=true.

O writer emitiu o frame e o Promise original de stop retornou true no snapshot posterior do parent. Na primeira falha do worker, as requests continuavam sem terminal observado: exact-server-request, managerEntry=same-request, sessionRegistered=registered, Fetchcontinue resolvido. Esses fatos não são simultâneos entre processos nem provam EOF das requests. Em particular, o snapshot do parent não prova que o stop terminou antes da falha de quiescência. O caso manteve unknown=false e o agregado unknown=true; deleted/absenceReads/revocationAcks=0 e ausência de certificado de limpeza permanecem. Zero ACKs não prova zero chamadas de limpeza. Fontes196Git+60dependências declaradas conferidas.

## Consequência para o próximo recorte

Ampliar a autoridade estática por hipótese não resolve a elegibilidade de Recovery: sua tentativa original já emitiu o frame. Root precisa isolar o comportamento de requests/terminais e a ordem temporal entre drain/stop no consumidor original, com reprodutor público mínimo e ensaio real separado, preservando primeira falha, incerteza e cleanup. Não deduzir causa unificada com Admin, descartar registries ou transformar ACK/kill/stop em EOF.

Capturas encerradas. Não repetir esses runs ou reabrir seus arquivos privados para procurar PASS. Nenhuma issue foi fechada por estas observações.
