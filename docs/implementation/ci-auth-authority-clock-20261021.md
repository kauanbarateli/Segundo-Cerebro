# Relógio do teste sintético de autoridade — 21/10/2026

O run [39553069622](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39553069622), tentativa 1, no HEAD `0eb484ed865f01988967959253676a74c0f94ee7` da PR #84, recusou o controle puro de Auth antes de iniciar o ensaio conectado ao serviço descartável: 407/408 testes passaram. O teste `owned positive login abort candidate requires identity/access and a guard for its same new session` esperava `PROTECTED_PAGE` para seu negativo de página protegida e recebeu `POST_COMPLETION_TIMEOUT`.

O helper sintético desse teste usa um orçamento de 10 ms e consulta `performance.now()` real. O log registra 13,1 ms de duração total, mas não identifica sozinho qual mecanismo temporal venceu. A alteração isola o teste de autoridade do tempo transcorrido: um mock contextual de `performance.now()` vale somente durante esse teste e é restaurado pelo contexto do Node. O positivo e os três negativos continuam verificando identidade, página protegida, mesma sessão, incerteza e quantidade de POSTs.

Não há mudança no helper, no orçamento de 10 ms, nos timers reais, nos testes separados de timeout, no protocolo de produção ou nos deadlines dos ensaios. Este controle não passa a certificar prazo. A revisão estática independente não identificou concorrência explícita nesse arquivo nem perda de oráculos; a eficácia dinâmica depende do novo HEAD no Actions.

A falha original permanece registrada. As falhas separadas de Admin e Recovery não são corrigidas nem certificadas por esta alteração. Em particular, o run Recovery [39553069746](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39553069746) recusou `QUIESCENCE_HTTP_API_NO_RESPONSE_PENDING`, com um request sem terminal observado e sem autorização para cleanup. Não se transforma um ACK de aborto em prova de término.

Validação local: revisão estática do diff e `git diff --check`. Nenhum Node, teste, build, navegador ou serviço foi executado nesta máquina sob pressão de RAM. A publicação permanece em PR de rascunho, sem merge, deploy ou alteração de plano de hospedagem.
