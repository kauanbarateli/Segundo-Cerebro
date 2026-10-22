# Orçamento global do CI geral — 21/10/2026

A Root executa as primeiras fatias #52/#53/#73 no GitHub Actions, conforme a autorização de usar runners em vez da máquina local sob pressão de RAM. Todos os workflows e critérios de aceite permanecem ativos.

O GitHub confirmou nas anotações dos checks os seguintes cancelamentos da primeira tentativa:

| PR / HEAD | Run / job | Evidência |
| --- | --- | --- |
| #83 / `1700a75f59cd2ac3abe4e261dd7885ff61459278` | [39550649690](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39550649690) / `119058820340` | Limite global de 15 minutos excedido. E2E e upload de evidências já estavam em success; o job completo permanece cancelled. |
| #84 / `8a6023acfc7b9dfe43830dd067e6bc9db7087e54` | [39550649266](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39550649266) / `119058819052` | Limite global de 15 minutos excedido; E2E interrompido. As etapas anteriores aprovadas não concluem o job. |

Os dois jobs começaram às 05:38:01 UTC e terminaram, respectivamente, às 05:53:04 e 05:53:12 UTC. As anotações dizem `The job has exceeded the maximum execution time of 15m0s`. Não foram cancelados por um novo push ou por rerun da Root, nem recebem PASS retrospectivo.

O orçamento do **job geral** passa para 20 minutos para completar a sequência integral de verificações, build, E2E, artefatos e pós-processamento. Nenhuma etapa é retirada, paralelizada por conveniência ou marcada como tolerável. Os deadlines de requisições e cenários, assertivas de terminais nativos, limites, isolamento, negativos, número de workers e cleanup permanecem inalterados. Os workflows nativos de Auth/Admin/Recovery não sofrem mudança.

Cada novo HEAD continua exigindo os resultados próprios. O ajuste não autoriza merge, deploy, uso de credenciais pessoais, conexão a Asaas ou aplicação de migrations hospedadas. A supressão de deploy das branches de validação permanece vigente. A falha separada de Recovery na base `eab708f` é preservada para diagnóstico; não é corrigida nem certificada pelo aumento do orçamento geral.

Validação local desta mudança: revisão estática do delta restrito e diff-check; nenhum teste, build, navegador ou serviço foi executado nesta máquina. A validação dinâmica pertence à nova rodada no Actions, sem substituir os cancelamentos anteriores.
