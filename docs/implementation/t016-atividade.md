# T-016 — Atividade de Capturas e Tarefas

A rota `/atividade` consulta os eventos reais dos dois domínios conectados. O acesso pertence ao Início; não acrescenta uma Funcionalidade. O servidor e a RPC aplicam o Entitlement atual de Capturar e Tarefas antes de apresentar seus registros. Preferência de exibição não revoga acesso à rota explícita. O modo demo informa que não consulta produção e não dispara a leitura de Atividade.

## Canal e contrato

`GET /api/activity` aceita somente `limit` (padrão 20, máximo 50) e o par `before_time`/`before_id`. Par incompleto, parâmetros desconhecidos/duplicados e datas inválidas são recusados. `X-Expected-User-ID` é uma precondição contra uma tela de outra conta, nunca autoridade para escolher o dono. A identidade e a sessão vêm de Auth; a criação do cliente privilegiado de domínio ocorre depois da autenticação e dos gates. Origem externa declarada e requisição cross-site são recusadas. Respostas são privadas e `no-store`.

O gateway chama `activity_page` usando o tipo real regenerado e o cliente privilegiado comum. Confere dono, shape exato, enums, lista permitida de campos, títulos até 200 caracteres e ordem antes de remover `user_id`. O DTO público contém apenas id do evento/entidade, tipo, ação, canal, horário, título e nomes dos campos alterados. Não contém `before`, `after`, texto da captura, descrição, dados de anexos, recibos ou credenciais. O título completo de registros legados é preservado; o limite 120 do editor não é aplicado à leitura.

O cursor conserva a string UTC com microssegundos do PostgreSQL. A ordem é decrescente por instante e UUID; o comparador puro usa microssegundos inteiros, sem cortar a precisão com `Date.toISOString`. Cada página possui snapshot próprio e revalida o acesso; não há promessa de snapshot histórico compartilhado entre páginas. Um cursor de outro usuário continua sendo apenas uma posição e não amplia o filtro de dono.

## Interface e falhas

Lista semântica cronológica com ação, título, nomes dos campos, canal e horário no fuso America/Sao_Paulo; paginação de 20 registros e atualização explícita. Tokens, foco, alvos e tipografia do DS 2.1 foram preservados. O [brief de Atividade](../../.impeccable/surfaces/atividade.md) registra a composição e a evidência visual ainda necessária.

O reader usa fetch com credenciais same-origin, redirecionamento proibido, timeout de 20 s e abort/race que também limita transportes injetados ou leitura do corpo que ignorem o sinal. Requisições substituídas e desmontagem cancelam a leitura; respostas antigas não alteram o estado. Logout limpa dados e fecha a instância. A mudança global de sessão desmonta a rota pelo feedback da sessão compartilhada.

Uma falha 503 mantém a página anterior e oferece repetição; nunca vira lista vazia. Respostas 401/403/409 limpam os registros e encerram a instância: entrar novamente para 401, recarregar para permissões ou conta alteradas. JSON/DTO inválido limpa o conteúdo não confirmado, mas permite uma nova tentativa. O vazio só é apresentado depois de uma resposta válida sem registros.

## Evidência e limites

- 49 testes locais de Atividade passaram na integração: os 48 de contrato, gateway, API, reader e apresentação, mais um teste de fronteira. Cobrem dono estrangeiro, payload indevido, veto, cursor inválido/microssegundos, paginação, erro, timeout, resposta tardia, logout e recuperação de sessão. Usam doubles e transportes injetados; não são ensaios do serviço real.
- Após a fonte final de 07/10/2026, `npm run check` passou (exit 0), com 924 testes Vitest em 50 arquivos e 35 testes isolados de scripts. As camadas observaram 206 módulos/702 dependências; 164 pares de contraste e o scanner de 54 bundles passaram. O parser aprovou 18 arquivos SQL por análise estática. Detector Impeccable retornou zero achados. A evidência foi preservada em 09/10, sem nova execução nessa data.
- A suíte integrada aprovou 142 E2E em modo demo (exit 0), incluindo os dois de Atividade em 320/1280 px: contexto/título, estado honesto, ausência de requisições à API e overflow. Esse resultado não prova a lista conectada nem inspeção com fixtures reais.
- A migration canônica `20261007223710_activity_page` foi aplicada de forma supervisionada em 07/10; os tipos foram regenerados e duas asserções SQL passaram com rollback, incluindo 56 eventos, isolamento e paginação por microssegundos. A leitura posterior confirmou zero resíduos temporários e preservação da conta master. As quatro migrations anteriores ficaram intactas; o pacote passou a ter cinco migrations e oito scripts separados.

A [validação integrada T-015/T-016](t015-t016-validacao.md) registra a origem, o hash SQL e os limites desses resultados. O novo ensaio de 16 cenários de navegador conectado e 18 etapas via SDK ainda não foi executado: o MCP pessoal não estava anexado à sessão da retomada. Registros anteriores não demonstram o avanço final. Não há novas screenshots conectadas, nova limpeza remota ou CI do novo commit confirmado.

Atividade cobre somente Capturas/Tarefas. Os outros módulos continuam demonstrações identificadas. Preferências reais e a prova específica por spy no adapter de não consulta de blocos ocultos no Início permanecem critérios separados de T-016. A inspeção visual desktop/mobile claro/escuro com fixtures reais permanece pendente. A [issue #23](https://github.com/kauanbarateli/Segundo-Cerebro/issues/23) continua aberta; publicar este avanço não encerra seus critérios de aceite.

Referências técnicas verificadas: [RPC no SDK Supabase](https://supabase.com/docs/reference/javascript/rpc) e [funções de banco e privilégios](https://supabase.com/docs/guides/database/functions). O contrato SQL versionado e as asserções do repositório são a evidência específica desta implementação.
