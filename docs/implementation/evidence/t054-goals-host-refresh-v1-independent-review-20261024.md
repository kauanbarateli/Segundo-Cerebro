# Peer estático — atualização completa H0

24/10/2026. **Um P2 ainda impede considerar o bloqueio de reconferência completo.** Nenhum runtime, teste, Git, browser, SQL ou rede executado; não editei Root. O lint informado por Root não foi reexecutado e o E2E permanece escrito, sem resultado.

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| src/components/features/financeiro/goals/goals-panel.tsx | 14654 | ee60cf9b6abc2a883d12b1553aa428f368a3fac7576724471561339e4181187f |
| tests/e2e/helpers/finance-goals-fixture.tsx | 16181 | a6bb75c136490cf7c54193d334c2b27a0294a835da60611429d3c2700eb51506 |
| tests/e2e/finance-goals-workspace.spec.ts | 32280 | f7d019e0b373380b56dcd451499657b5a26d394382f5131923c9aa62c16d3e8a |

## P2 — atualização anterior pode liberar reconferência após uma resolução posterior

`goals-panel.tsx:34–40` aguarda o refresh do host fora da exclusão de `channel.run`. Durante esse await, channel.busy permanece false. Um caminho possível com pending já existente:

1. O usuário inicia **Atualizar metas**; refresh F1 do financeiro lê o estado anterior, mas sua resposta fica pendente.
2. Enquanto F1 aguarda, o usuário encerra a tentativa. O canal resolve, marca needsRefresh=true e inicia refresh F2; F2 falha.
3. F1 responde depois. O mesmo owner/controller continua atual, então o load antigo chama loadPage.
4. `use-goals-channel.ts:46–49` aceita a nova GoalPage e limpa needsRefresh/reviewedCurrent sem distinguir a resolução que ocorreu após F1 começar. O reconhecimento humano pode ser liberado com financeiro geral ainda anterior à resolução.

É uma possibilidade derivada do código, não uma corrida executada. O guard current verifica owner/controller, não a ordem da resolução. O caso novo do spec (52–71) é sequencial e não cobre F1 intercalado.

Correção mínima sugerida: serializar o await de host-refresh pela exclusão já existente de channel.run e não avançar para GoalPage em erro/busy; assim confirm/settle não se intercalam com aquele refresh. A alternativa é uma geração de resolução capturada/reconferida antes de publicar a página, com maior delta. Acrescentar controle com refresh pendente e tentativa de resolução durante a fila, exigindo exclusão/busy ou recusa do load velho; nenhuma atualização parcial pode liberar ACK. Root deve escolher/aplicar o delta, sem alterar proof, UUID ou journals.

## Parte sequencial coerente

A atualização completa aguarda onResolved antes da GoalPage, recusa a página em falha e mantém needsRefresh. Paginação é recusada quando needsRefresh é true. Não há autoack nem nova prova.

A fixture só fornece onResolved quando hostRefresh é solicitado, preservando o trace padrão. O novo E2E cobre duas falhas, ausência de GoalPage extra/ACK e sucesso posterior com reconhecimento humano explícito. Esse controle é útil; precisa do caso de interleaving acima para fechar o gate.
