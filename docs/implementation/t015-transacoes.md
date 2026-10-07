# T-015 — transações de Capturas e Tarefas

O primeiro recorte implementa o contrato por capacidade e o estágio transacional no servidor. O adapter `src/adapters/db/capture-task-store.ts` recebe um gateway de persistência; não contém um gateway Supabase, não cria tabelas e ainda não está ligado às telas. Capturas e Tarefas continuam demonstrativas. Este registro adota o protocolo CAS proposto na nota T-014/T-015 e separa o que foi implementado do que falta integrar.

## Protocolo adotado

Cada comando roda sobre um snapshot completo e consistente do usuário, com revisão monotônica. O Núcleo decide as alterações usando os mesmos casos de uso da memória. O adapter mantém dados, eventos e recibo em estágio; só o commit do gateway pode persistir o lote. As portas expiram ao terminar o callback, inclusive em falha ou repetição.

O gateway deverá ser criado por requisição e vinculado a ator, sessão verificada e operação autorizada pelo canal. Cada acesso e commit deve conferir novamente sessão/moderação/Entitlement. O lote interno nunca pode ser um argumento público de Server Action nem uma RPC genérica concedida a `authenticated`.

No commit, a RPC deverá travar a revisão do usuário e verificar primeiro o recibo por usuário/comando/client_id. O mesmo conteúdo devolve o resultado persistido; conteúdo diferente conflita. Sem recibo, revisão divergente devolve `stale`, sem escrita. A revisão deve cobrir também inserções, lixeira, referências e futuras operações administrativas: só assim um rename pode repetir sobre uma captura criada simultaneamente, sem perder referências.

O adapter limita a repetição a três tentativas por padrão (máximo configurável de cinco). A cada conflito refaz o callback sobre novo snapshot. Um erro de domínio só é devolvido depois de conferir que a revisão lida ainda é atual; isso evita falso `NOT_FOUND` causado por leitura que perdeu validade. Não executar upload, enviar e-mail ou realizar outro efeito externo dentro do callback repetível.

Se a confirmação pode ter sido perdida, o gateway sinaliza `CommitOutcomeUnknown`. O adapter consulta o recibo exato e confere ator, comando, client_id e fingerprint antes de devolver o resultado. Sem prova, conserva um erro explícito de resultado desconhecido. A futura UI deve preservar o client_id e reconciliar antes de iniciar outro comando; gerar novo identificador ao clicar novamente em Salvar pode duplicar uma criação.

## Fronteiras e integridade

- `CaptureTaskUnitOfWork` expõe apenas Capturas, Tarefas, organização em leitura, eventos e recibos. Não exige adaptadores fictícios de Financeiro ou Hábitos.
- Snapshot e retornos são copiados. Dono, IDs duplicados, referências, origem de conversão e campos imutáveis são verificados. Cada alteração exige seu evento correspondente; eventos sem alteração e recibos incompatíveis são recusados.
- Não há exclusão física de Capturas/Tarefas. Categorias e Projetos são leitores neste contrato, preservando os tickets próprios de administração dessas entidades.
- O gateway real deve validar respostas, converter UUIDs/timestamps e nunca truncar o snapshot por paginação. Um limite operacional deve produzir erro explícito; não pode transformar uma leitura incompleta em uma coleção válida.
- Leituras de apresentação exigem o Entitlement da funcionalidade consultada. Referências internas de Projetos podem sustentar integridade sem entregar conteúdo de uma funcionalidade vetada. Uma permissão de Capturar não autoriza exibir Tarefas, Projetos ou Conhecimento.

## Próxima integração

1. Criar por CLI e revisar a migration de Capturas/Tarefas/categorias/referências/revisões, constraints, RLS e RPCs restritas. Aplicar somente pelo procedimento supervisionado da OP-009; não alterar migrations já aplicadas.
2. Implementar o gateway Supabase com snapshot consistente, commit atômico, revisão abrangendo todas as escritas, verificação de sessões/Entitlements e erros explícitos.
3. Ligar o canal autenticado e o provider conectado, conservar comandos/DTOs das telas e tratar resposta perdida na UI. A conversão requer Capturar e Tarefas; a organização em Conhecimento não deve simular Páginas/Cadernos de T-021.
4. Integrar reservas de upload, medição real de bytes, reencodificação e finalização idempotente. Storage e banco não compartilham transação.
5. Executar os mesmos contratos contra o gateway real e provar isolamento, rollback, concorrência, rename, conversão e dois aparelhos. Testes com gateway em memória não comprovam esses critérios no PostgreSQL.

O recorte não altera a interface nem conclui T-015. A evidência de testes e o CI do commit serão registrados na [issue #22](https://github.com/kauanbarateli/Segundo-Cerebro/issues/22).
