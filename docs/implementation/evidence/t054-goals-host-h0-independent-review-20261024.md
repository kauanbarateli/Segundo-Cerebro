# H0 — peer estático independente do host Metas

Favorável estático, sem bloqueador objetivo nesta leitura. Não aprova ativação, schema, H1/foto, render ou ensaio conectado. Fonte WIP Root em Segundo-Cerebro-mvp-goals-terminal-20261023; seis hashes lidos e reconferidos sem alteração:

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| src/components/features/financeiro/goals/finance-goals-host-lifetime.ts | 1606 | 715cdafbde393c160164cc79ab58bc992acf0cc358278a13b18509ca9a0c1705 |
| src/components/features/financeiro/goals/finance-goals-host.tsx | 3670 | 6a248d5bbffe613ef691c4838978b5c51079ff82c2f76ba01f25a8c68e05d8ef |
| src/components/features/financeiro/goals/goals-panel.tsx | 14218 | dbb695998ad2af4aeeac31c4a753efdc4eacd4ac7e49f0f3b9fc86bae020aa9a |
| src/components/features/financeiro/finance-panels.tsx | 25188 | e1314217f80637a3ffb83141eb07916e31fad51a93205697ed68ca5cc8f37941 |
| src/components/features/financeiro/finance-workspace.tsx | 22740 | a0c47a5cb0b5249e114e548f75d0599c3dab3cd66d4712669da0be3cb7d294e6 |
| tests/scripts/finance-goals-host-lifetime.test.mjs | 4315 | f6a48838991a6b06264c69b2b15085c4c6f7f0af946352af4091fbcf331142f5 |

## Identidade e lifetime

O helper captura owner/providerEpoch/mode/closing e as identidades de sender/initialize/commandSnapshot/refresh. Admissão exige connected,não closing,owner não vazio e epoch inteiro válido. current usa igualdade dos campos e um ref atualizado a cada render; objeto de contexto novo com as mesmas funções não reinicia recurso. Há fence antes e depois de await open. Recurso que chega tarde é disposto e não publicado. close é idempotente e só dispose, sem revoke/clear do journal.

O host recusa demo/closing e usa key owner:providerEpoch. O effect depende dos valores capturados e do restart humano. As continuations ready/catch verificam lifetime.current antes de setState; mudança de contexto deixa o render antigo inelegível. O factory concreto conserva seus guards antes/depois de journal.open. Não há cliente sintético, SDK servidor ou chave nova neste host. Dispose da superfície não é logout.

## Um controller e operação pendente

As condições state.tab===painel e ===orcamentos são mutuamente exclusivas. O primeiro monta o host compact no slot antes dos cartões; o segundo monta o host completo após orçamentos. Nas demais abas não há host. Trocar aba desmonta/dispose o recurso local; o journal durável permanece para a nova abertura. GoalsPanel/useGoalsChannel continuam emitindo um controller por owner/client. Não há segundo controller oculto para manter uma operação em paralelo.

silentUnavailable em goals-panel.tsx:111 só remove o painel após ready+availablefalse e ausência de pending,reconfirmRequired,failure e erro local. Não esconde tentativa ou reconfirmação com a flag desligada; o aviso de recovery permanece. Loading/erro são explícitos e não simulam disponibilidade. O host não altera flags nem instala RPC/schema.

## Refresh e confirmação humana

O callback onResolved verifica lifetime e client.isCurrent antes e depois de await refreshActive. Os handlers do painel verificam channel.current após operações. A falha de refresh só publica erro se o contexto continua atual. Confirmado/closed continuam distintos no canal; confirmed/resolved marcam needsRefresh=true e reviewedCurrent=false. Refresh global não carrega uma página como aceite nem chama acknowledgeReview; a revisão/ack humana continua necessária. Nenhum efeito de mount/unmount/erro cria confirmação, settle ou novo intent.

prepareEditor é o único caller com required=true: sessão alterada ou reply não-ok lança e impede o editor de tratar a tentativa como preparada. Os demais callers mantêm sua semântica anterior. O catch/cache do GoalEditor é outra frente, não foi validado como parte deste H0.

## Navegação e UI

O rótulo da aba passa a Planejamento, mas o identificador permanece orcamentos e os navegadores/links continuam usando o contrato existente. Não foi criada rota ou tradução de query que perca deep links. O slot Metas antecede cartões no painel; demo continua sem montagem. Tokens, máscara, foco e controles existentes são reutilizados; este peer não mede contraste nem certifica DOM/mobile.

O teste Node puro contém seis controles úteis de admissão, mudanças de binding, fechamento antes/durante abertura, erro e dispose sem revoke/clear. Root informou6/6PASS; não houve reexecução por este revisor. Ele não renderiza React nem prova troca real de abas/foco, uma única superfície visível ou recovery com flagfalse em navegador. Esses gates, TypeScript/lint/camadas/source-closure e CI pertencem ao SHA que publicar H0; as seis capturas de0d são de outra composição e não os substituem.

Contexto PRODUCT/DESIGN e instruções Impeccable/React foram lidos; contexto já carregado pelo Root não foi relançado. Nenhum Node,teste,DOM,browser,rede,Git,SQL,serviço ou dado privado foi executado/lido neste peer. Nenhum arquivo H0 foi alterado.
