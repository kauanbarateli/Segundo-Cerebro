# Reconferência estática — atualização completa H0

24/10/2026. **P2 do parecer anterior fechado por leitura; favorável ao delta para CI próprio.** Preservado o relato `finance-goals-host-refresh-static-peer-20261024.md` (SHA256 abd718ed25012a895ac8e70ce1cdc74772207624fb864643f062d4235194c81b). Nenhum código Root foi editado e nenhum Git, Node, teste, lint, SQL, browser ou rede foi executado nesta reconferência.

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| src/components/features/financeiro/goals/use-goals-channel.ts | 6460 | 9d65b93126c41c892348550b21a437655488bb620b90e71eb0dec962aba16714 |
| src/components/features/financeiro/goals/goals-panel.tsx | 14602 | 60c5a91ecd85ea029ad1feec013f2dd9bb41032f41a3b45239642acd90227dfb |
| tests/e2e/helpers/finance-goals-fixture.tsx | 16605 | f79893f8fc9f03edc53f485271b96276767c057531b6d08ce01cb7ab378c27e7 |
| tests/e2e/finance-goals-workspace.spec.ts | 33655 | cd807b4dceed1bbb50dc6e2d46e191b43ef11a311f409821b326a7643a5a94a8 |

O hook agora mantém beforeRead e controller.page dentro do mesmo channel.run (43–54). O running ref é adquirido antes do await de refresh e liberado somente depois da leitura/resposta, impedindo confirm/settle/consulta intercalada no mesmo canal. Após o refresh, reconfere a instância ativa, liveness e vínculo owner/client antes de chamar page. Falha do host devolve mensagem fixa e não lê GoalPage; o ramo de publicação só limpa needsRefresh em reply positivo e na instância original.

GoalsPanel passa onResolved somente no reload completo (34–40); paginação continua recusada enquanto needsRefresh. Não foi acrescentado estado, geração, proof, autoack, novo UUID ou mudança de journal/porta.

O teste hold-first retém o refresh, exige Consultar/Encerrar desabilitados e zero página extra antes de liberar; depois exige uma página e tentativa integralmente idêntica, sem execução/stage/resolução/ACK. O filtro final já usa os nomes reais attempt-status/attempt-settle. O controle sequencial anterior permanece: duas falhas deixam reconferência bloqueada e não leem página, o terceiro refresh completo permite somente o reconhecimento humano.

A fixture só instala callback/gate quando solicitado, preservando o trace padrão. Nenhum resultado de E2E foi inferido: lint informado por Root e os dois casos escritos ainda dependem dos checks próprios do candidato. Não encontrei novo bloqueador objetivo neste delta; aceites de host/HTTP/schema e produção permanecem separados.
