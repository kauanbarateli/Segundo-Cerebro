# T-015 — transações de Capturas e Tarefas

O primeiro recorte implementou o contrato por capacidade e o estágio transacional no servidor, ainda sem gateway Supabase ou ligação às telas. **Atualização em 07/10/2026:** o adapter `src/adapters/db/capture-task-store.ts` está integrado ao gateway Supabase, ao canal autenticado e ao provider conectado. Capturar e Tarefas usam persistência da conta nesse modo; a demonstração em memória continua disponível e separada. Este registro descreve o protocolo CAS adotado. A [evidência de persistência T-015](t015-persistencia.md) registra aplicação, validações e pendências, sem declarar o ticket encerrado.

## Protocolo adotado

Cada comando roda sobre um snapshot completo e consistente do usuário, com revisão monotônica. O Núcleo decide as alterações usando os mesmos casos de uso da memória. O adapter mantém dados, eventos e recibo em estágio; só o commit do gateway pode persistir o lote. As portas expiram ao terminar o callback, inclusive em falha ou repetição.

O gateway é criado por requisição e vinculado a ator, sessão verificada e operação autorizada pelo canal. Cada acesso e commit confere novamente sessão/moderação/Entitlement. O lote interno não é argumento público do canal nem RPC genérica concedida a `authenticated`: somente o servidor executa as RPCs transacionais.

No commit, a RPC trava a revisão do usuário e verifica primeiro o recibo por usuário/comando/client_id. O mesmo conteúdo devolve o resultado persistido; conteúdo diferente conflita. Sem recibo, revisão divergente devolve `stale`, sem escrita. A revisão abrange inserções, lixeira e referências deste recorte. Futuras operações administrativas deverão preservar essa abrangência: só assim um rename pode repetir sobre uma captura criada simultaneamente, sem perder referências.

O adapter limita a repetição a três tentativas por padrão (máximo configurável de cinco). A cada conflito refaz o callback sobre novo snapshot. Um erro de domínio só é devolvido depois de conferir que a revisão lida ainda é atual; isso evita falso `NOT_FOUND` causado por leitura que perdeu validade. Não executar upload, enviar e-mail ou realizar outro efeito externo dentro do callback repetível.

Se a confirmação pode ter sido perdida, o gateway sinaliza `CommitOutcomeUnknown`. O adapter consulta o recibo exato e confere ator, comando, client_id e fingerprint antes de devolver o resultado. Sem prova, conserva um erro explícito de resultado desconhecido. A UI preserva o payload e o client_id no reenvio e impede alterar um envio incerto antes de confirmá-lo; não gera outra criação ao repetir Salvar.

## Fronteiras e integridade

- `CaptureTaskUnitOfWork` expõe apenas Capturas, Tarefas, organização em leitura, eventos e recibos. Não exige adaptadores fictícios de Financeiro ou Hábitos.
- Snapshot e retornos são copiados. Dono, IDs duplicados, referências, origem de conversão e campos imutáveis são verificados. Cada alteração exige seu evento correspondente; eventos sem alteração e recibos incompatíveis são recusados.
- Não há exclusão física de Capturas/Tarefas. Categorias e Projetos são leitores neste contrato, preservando os tickets próprios de administração dessas entidades.
- O gateway real valida respostas e preserva o contrato do Núcleo, incluindo IDs, timestamps e campos opcionais. Não trunca o snapshot por paginação. Limite operacional ou falha de leitura produz erro explícito, sem transformar resposta incompleta em coleção válida.
- Leituras de apresentação exigem o Entitlement da funcionalidade consultada. Referências internas de Projetos podem sustentar integridade sem entregar conteúdo de uma funcionalidade vetada. Uma permissão de Capturar não autoriza exibir Tarefas, Projetos ou Conhecimento.

## Integração aplicada e validação local

A quarta migration, [`20261007210519_capture_task_transactions.sql`](../../supabase/migrations/20261007210519_capture_task_transactions.sql), foi aplicada de forma supervisionada no projeto pessoal. SHA-256: `0645892ba82c4e13a391020aea4abfaeaa05a81283056adbc9954747b066b859`. Ela acrescenta Capturas, Tarefas, categorias/projetos de referência, vínculos, revisão e RPCs restritas, sem seed.

O runtime cria o gateway no servidor; `/api/capture-tasks` recebe apenas consultas ou comandos de domínio autenticados. O provider usa cookies httpOnly, sem SDK Supabase no navegador, e atualiza consultas ao retornar à aba ou recarregar. A conversão exige Capturar e Tarefas; as referências de Projetos respeitam a permissão atual. Categorias e Projetos permanecem somente de leitura, sem cadastro ou seed neste recorte.

As telas preservam a estrutura de M1, com estados conectados, erro visível e reenvio explícito de resultado incerto. Imagens não são aceitas como anexos reais enquanto o upload estiver pendente; guardar em Conhecimento é bloqueado até T-021. Os demais módulos continuam em memória, identificados como exemplos e isolados dos registros persistidos.

Na validação integrada local, `npm run check` passou com 841 testes da aplicação, 29 testes isolados e os demais portões; 140 E2E de regressão passaram. Separadamente, 18 etapas do protocolo no serviço real e 13 cenários de navegador conectado passaram, incluindo confirmação perdida após falha de leitura e troca de rota. A limpeza das contas sintéticas e de seus registros foi conferida. O [relatório de persistência](t015-persistencia.md) registra os limites: esses ensaios não medem sobreposição PostgreSQL nem substituem aparelhos físicos.

## Critérios ainda pendentes

1. Validar atualização em aparelhos físicos; isolamento, rollback, rename, conversão/replay e dois contextos de navegador já passaram, conforme o [relatório de persistência](t015-persistencia.md).
2. Provar concorrência com sobreposição medida no banco; testes em memória e chamadas sequenciais não demonstram disputa simultânea.
3. Integrar reservas de upload, medição real de bytes, reencodificação e finalização idempotente. Storage e banco não compartilham transação.
4. Persistir o journal de confirmação para retomada após recarregamento completo; o estado atual sobrevive a troca de rota e falha de leitura durante a instância do aplicativo.

T-015 permanece aberta. A evidência real e o CI do commit serão registrados na [issue #22](https://github.com/kauanbarateli/Segundo-Cerebro/issues/22); Conhecimento persistente continua no ticket T-021.
