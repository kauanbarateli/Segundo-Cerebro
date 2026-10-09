# T-015 — Capturas e Tarefas persistentes

Recorte implementado em 07/10/2026 no projeto pessoal `rishenjoikgmfubmnfiu`, conforme OP-007/OP-009/OP-011 e ADR-0002/0004. Capturas e Tarefas agora usam o mesmo Núcleo através de um canal autenticado no servidor. Os outros módulos conservam dados de demonstração separados, identificados na interface. T-015 permanece aberta pelos critérios ainda pendentes ao final deste relatório.

## Schema e aplicação supervisionada

| Arquivo canônico | SHA-256 | Resultado |
|---|---|---|
| `20261007210519_capture_task_transactions.sql` | `0645892ba82c4e13a391020aea4abfaeaa05a81283056adbc9954747b066b859` | MCP `apply_migration`: `success=true` |

O arquivo foi criado com `supabase migration new` na CLI 2.117.0, inicialmente com versão `20261007204914`. O MCP atribuiu a versão remota acima; o nome local foi alinhado sem alterar os bytes SQL. Não houve alteração ou reaplicação das três migrations anteriores, manipulação do histórico interno, reset ou seed. Os tipos TypeScript foram regenerados do schema real.

Há cinco novas relações públicas (`categories`, `projects`, `captures`, `tasks`, `capture_links`) e uma relação privada de revisão por usuário. As quinze relações do recorte completo têm RLS. Categorias e Projetos são referências em leitura, sem seed ou canal de administração neste recorte. A conversão mantém IDs recíprocos entre Captura e Tarefa e constraints diferidas; exclusão é lógica.

O payload JSONB preserva o DTO e os eventos exatos do Núcleo, inclusive omissão de propriedades opcionais e representação do fuso em timestamps. Colunas relacionais são derivadas e validadas por triggers, com FKs e índices para dono, vínculos e referências. Isso evita normalizar silenciosamente um resultado já usado por recibos e eventos. Anexos são recusados até existir finalização de Storage própria.

`service_role` executa somente os wrappers necessários; não recebe DML direto nas novas tabelas nem leitura administrativa do conteúdo de eventos. Funções internas têm `search_path` vazio e não são canais públicos. Sessão Auth, moderação, troca obrigatória de senha e Entitlement são conferidos novamente em cada RPC. Bloqueios por usuário serializam alterações, moderação e veto de acesso.

## Contrato e canal da aplicação

As quatro RPCs são `capture_task_snapshot`, `capture_task_revision`, `capture_task_receipt` e `capture_task_commit`. O gateway é criado por requisição, vinculado à identidade, sessão e operação verificadas. O snapshot usa uma instrução MVCC consistente; a revisão é monotônica. O commit compara a revisão e grava alterações, eventos e recibo na mesma transação. Replay tem precedência sobre CAS e limitador; o mesmo usuário/comando/client_id com payload diferente recebe conflito.

O estágio de [T-015](t015-transacoes.md) continua usando os casos de uso existentes, com repetição limitada de snapshots ultrapassados e reconciliação por recibo após perda de confirmação. Um erro de transporte ou resposta de commit inválida conserva resultado desconhecido; uma falha de leitura nunca é convertida em lista vazia.

`/api/capture-tasks` aceita consultas e comandos de domínio, nunca contexto, dono, eventos ou lotes internos fornecidos pelo navegador. POST exige origem correta, JSON e corpo limitado. GET/POST exigem `X-Expected-User-ID`: uma precondição da página montada, comparada à identidade real antes de acessar o gateway. Ela não escolhe o dono. Uma troca de conta em outra aba recebe `SESSION_CHANGED` e não grava dados da página antiga na conta nova.

Respostas são privadas e `no-store`. Só a projeção pedida, suas categorias e os Projetos permitidos atravessam o canal de leitura; recibos, eventos e conteúdo do outro módulo não são enviados à UI. A conversão exige acesso a Capturar e Tarefas. O navegador usa cookies e endpoint relativo; SDK privilegiado e segredos permanecem no servidor.

O provider conectado é separado do modo demo e usa a data atual da aplicação. Home lê Capturas e Tarefas reais; Hábitos, Financeiro e Agenda ainda são exemplos. Capturar/Tarefas preservam a identidade de envio durante retries. Um comando de resultado desconhecido também é conservado na instância da sessão, acima dos editores, para sobreviver a troca de rota e falha de leitura. O feedback permite confirmar o payload original e impede outra escrita até reconciliação. Troca de conta e logout encerram a instância anterior.

## Limites explícitos

- Snapshot completo: até 10.000 linhas agregadas e 8 MiB; exceder falha explicitamente, sem truncamento. Paginação incremental exige evolução própria do protocolo consistente.
- Corpo HTTP: 256 KiB; Captura: até 30.000 caracteres. Descrição de Tarefa convertida preserva os 30.000 caracteres herdados; criação manual segue o limite do Núcleo.
- Escritas: 30 por minuto por usuário, com erro HTTP 429 e indicação de espera. Replay confirmado não consome outra escrita. Esse escopo é separado do limitador de login.
- IDs são gerados no servidor. O navegador fornece apenas referências e client_id estável; campos extras, anexos e destino Conhecimento são recusados.

## Evidências e revisão

`supabase/tests/capture-task-catalog.sql` e `capture-task-behavior.sql` passaram no banco pessoal e terminaram com rollback. Conferiram grants/RLS, ownership, sessão/moderação/veto, payload inválido, conflito/replay, CAS, referências, conversão e rollback integral. Aceitam a conta já existente e usam UUIDs sintéticos transacionais; não alteram a conta pessoal. A leitura posterior confirmou uma conta Auth preservada e ausência de Capturas, Tarefas, revisões e limites de escrita temporários.

Revisão independente do SQL, gateway/canal e cliente corrigiu três fronteiras antes da publicação: status obrigatório em transições de Tarefa, precondição de conta e retenção do comando incerto acima dos editores. `npm run check` passou com 841 testes Vitest em 43 arquivos e 29 testes isolados de configuração/limitadores/Auth. TypeScript, lint, build, 196 módulos/662 dependências de arquitetura, 164 pares de contraste, pacote SQL e scanner de 51 bundles públicos passaram. O Impeccable 0.1.6 não apresentou apontamentos. Parsing aprovou os 14 arquivos SQL. A suíte de regressão Chromium aprovou 140 cenários em modo demo.

No serviço real, duas contas sintéticas marcadas executaram os mesmos comandos do Núcleo e 18 etapas do protocolo: snapshot isolado, criação atômica, replay sem duplicação, conflito de payload, RLS próprio/alheio, RPC privilegiada recusada a authenticated, sessão de outro ator recusada, vínculos, rename de duas Capturas, rollback integral após corromper o segundo evento, conversão/replay e recusa após saída global. Dois commits HTTP com a mesma revisão produziram um `committed` e um `stale`, com apenas uma nova Captura/evento/recibo. Isso comprova resultados CAS; não mede sobreposição de transações PostgreSQL.

Os 13 cenários do navegador conectado passaram: visitante recusado; duas sessões independentes; origem externa/dono injetado recusados; criação e edição pelo formulário; persistência após recarregar na outra sessão; conversão e navegação recíproca; criação, edição, conclusão, lixeira e restauração de Tarefa; visualização em 390 px; confirmação perdida; e troca de conta. No cenário de confirmação perdida, o servidor gravou, mas o navegador recebeu 503 intencionalmente. Uma leitura também falhou, desmontando o editor; depois de navegação interna para Tarefas, o aviso da sessão reenviou o payload/client_id original. O banco retornou a mesma Captura, sem duplicação. O controle de confirmação foi medido com alvo mínimo de 44 px e sem transbordo horizontal em 390 px.

Trocar os cookies para a segunda conta sintética, mantendo a página da primeira, produziu `SESSION_CHANGED` em leitura/escrita antes do gateway. A coleção da segunda conta permaneceu idêntica. São contextos de navegador no mesmo computador; ensaio com aparelhos físicos continua pendente.

As duas contas foram removidas pela Admin API com UUID/e-mail sintético/marcador conferidos. SQL por IDs exatos confirmou zero resíduos em Auth, perfis, papéis, Capturas, Tarefas, vínculos, eventos, recibos, revisões e limites de escrita. Os dois hashes exatos de login foram removidos separadamente, pois são pré-autenticação. A conta pessoal permaneceu `master`, ativa, confirmada e sem troca obrigatória. Não foi usada como fixture nem recebeu nova promoção.

Um aviso de desenvolvimento revelou a diferença esperada entre o atributo `nonce` ocultado pelo navegador e a propriedade `script.nonce`. A correção restringe `suppressHydrationWarning` ao script estável de tema, preservando nonce e CSP. Duas execuções diagnósticas adicionais usaram quatro contas sintéticas; a confirmação posterior apresentou zero erros de console e verificou que a propriedade nonce corresponde à política recebida. Essas contas e os dois registros adicionais de login foram removidos e conferidos por IDs/hashes exatos. O serviço pode conservar seu histórico normal de Auth; nenhum token, senha, UUID ou e-mail pessoal foi publicado.

Os ensaios reais foram optativos, supervisionados e executados em desenvolvimento local com `APP_MODE=supabase`. Manifestos e protocolos temporários ficaram em `work/`, ignorado pelo Git; credenciais permaneceram em memória. Screenshots foram limitados ao conteúdo sintético de `<main>`, sem formulários de Auth, perfil ou traces. São evidências distintas dos testes demo e não rodam em CI.

Advisors de desempenho não apresentaram apontamentos. Os avisos informativos de RLS sem políticas correspondem às relações deliberadamente fechadas. O Advisor de segurança mantém o aviso de proteção contra senhas vazadas desativada em Auth; não houve alteração global de Auth nem de plano do serviço.

## Pendências

Atualização posterior no mesmo dia: o [diário durável](t015-journal.md) implementa retomada após reload/reabertura, e [Atividade](t016-atividade.md) implementa a leitura paginada de eventos. A [validação integrada desse avanço](t015-t016-validacao.md) conserva evidência e limites próprios; as contagens acima pertencem à entrega anterior.

- Upload de imagens: reserva/finalização idempotente, tamanho medido, reencodificação e Storage. Banco e Storage não compartilham transação; metadados fictícios não são aceitos.
- Organização em Conhecimento depende de T-021; o controle conectado explica sua indisponibilidade. Administração de categorias/Projetos permanece fora deste recorte.
- Preferências reais e a prova de não consulta dos blocos ocultos no Início continuam critérios próprios de T-016.
- Concorrência PostgreSQL com sobreposição medida, HTTPS/proxy e aparelhos físicos permanecem evidências distintas dos ensaios locais/HTTP. Não se atribui simultaneidade no banco ao simples despacho paralelo de HTTP.
- Fechar o cadastro público (`disableSignup=false` ainda confirmado na consulta de Auth) e habilitar a proteção contra senhas vazadas requer ajuste/conferência no Dashboard pessoal. SMTP e recuperação ponta a ponta seguem postergados por OP-010.

CI, build e deploy não aplicam migrations nem criam contas no serviço. `npm run sql:editor` apenas empacota quatro migrations e seis scripts separados com integridade determinística; não abre conexão. A instalação inicial continua com preflight e não deve ser reaplicada em um projeto já instalado. Os registros anteriores descrevem sua época; este relatório documenta a evolução de T-015.
