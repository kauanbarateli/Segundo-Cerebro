# T017 — Admin MVP offline

Implementados núcleo puro, decoder estrito, porta administrativa e saga Auth; adapter/RPC tipado como contrato planejado; endpoint privado `/api/admin`; tela de Usuários, Operações pendentes e Auditoria; migration `20261009150122_identity_admin_settings.sql`; suites Vitest e scripts SQL com rollback. Nenhuma migration ou chamada SDK foi executada contra Supabase. Os tipos globais gerados não foram alterados para fingir aplicação remota.

## Canal e comandos

GET retorna `AdminSnapshot` (users, audit, operations). POST aceita `{command,input}`. `client_id` é obrigatório; ator/sessão nunca são aceitos no corpo.

| Comando | Entrada adicional |
| --- | --- |
| `admin.user.create` | `email`, `temporary_password` (12 caracteres até 72 bytes UTF-8) |
| `admin.user.block` / `admin.user.unblock` / `admin.user.force_password` | `target_user_id` |
| `admin.user.role` | `target_user_id`, `role: user/master` |
| `admin.user.entitlement` | `target_user_id`, `feature_key`, `allowed` |
| `admin.operation.reconcile` | `operation_id` |

Todos exigem master corrente, sessão corrente, ausência de troca obrigatória, ausência de veto admin e `X-Expected-User-ID` igual à conta autenticada. Escritas exigem Origin exata e JSON limitado a 64 KiB. A senha fica somente no formulário e no POST privado; não há integração com journal ou executor compartilhado. O formulário mantém o client_id ao repetir o mesmo envio e limpa a senha ao fechar ou sair. Em demo, a área explica a indisponibilidade sem contas inventadas ou POSTs.

## Persistência e falhas

A reserva/HMAC/claim fica em `app_private.admin_operations`. DTOs nunca contêm compromisso ou claim privada. Auditoria tem apenas identificação de autor/alvo/operação, ação, etapa e momento; e-mail pertence somente à lista de usuários, não ao histórico. O Admin não lê conteúdos dos módulos ou payloads de `domain_events`.

Papel/veto aplicam dado, evento, auditoria e recibo numa transação. Criação/bloqueio/desbloqueio/troca forçada usam saga: reserva+fence; efeito Auth guardado; revogação de TODAS as sessões/refresh tokens; confirmação final; moderação/evento/auditoria/recibo. Conta provisória nasce bloqueada e forçada no trigger antes de qualquer rota. O login dedicado de troca é liberado somente após os estados Auth/SQL confirmados; os guards/RLS existentes impedem qualquer módulo até a troca.

O advisory lock global precede a operação pendente e os pais Auth/lock compartilhado. O último master utilizável considera ban, deleção, anonimato, moderação, troca obrigatória e veto admin. Autoalteração de papel, bloqueio, desbloqueio, veto admin ou troca forçada é recusada; senha própria é Configurações. Forçar senha também recusa conta já bloqueada/banida, evitando reativar um ban preexistente.

Uma claim privada por execução evita efeitos SDK concorrentes. HTTP 4xx confirmado ou falha interna depois de uma resposta SDK válida pode liberar somente a claim, mantendo moderação protegida. Timeout/transporte, 0/5xx e DTO Auth inválido deixam `needs_reconciliation` **com claim retida e sem expiração**. Retomar não rouba a claim. Cancelar a janela ou perder a sessão não desbloqueia conta nenhuma.

## Procedimento futuro para Auth incerto

1. Preservar moderação bloqueada e a claim. Não usar retry, timeout, idade da linha ou existência do usuário como prova de término.
2. Operador autorizado verifica a operação exata, UUID/marcador, requisições anteriores no serviço Auth e no processo servidor. Deve haver evidência de que todas terminaram e nenhuma atualização de ban/unban ainda pode chegar. Sem essa evidência, a conta continua protegida.
3. Depois dessa prova, verificar novamente alvo e moderação e, numa transação owner autorizada com a mesma ordem de locks, liberar **somente a claim privada** e registrar a etapa de revisão; preservar `needs_reconciliation` e o fence. Não há RPC pública de liberação cega. Rotina manual deve ser revisada e aplicada posteriormente, junto da compatibilidade do schema Auth real.
4. Um master atualmente válido pode então retomar a operação pelo endpoint. Se criação nunca ocorreu, o master original reenvia e-mail/senha/client_id originais; HMAC confirma identidade sem armazenar credenciais. Se esses dados foram perdidos, resolver operacionalmente, mantendo a conta protegida. Não trocar o segredo HMAC com pendências sem plano de reconciliação.

`ADMIN_COMMAND_SECRET` exige pelo menos 32 bytes UTF-8 e deve ser distinto dos segredos Auth/rate-limit e da chave service. Configuração é manual posterior; este trabalho não abriu `.env` ou criou credenciais.

## Evidência e limitações

Vitest usa portas/RPC/SDK injetados e IDs/e-mails sintéticos explícitos. Cobre ordem do master guard, payload fechado, ausência de credenciais na persistência, fases da saga, falha parcial, revogação, retry, duas tentativas simultâneas, unban tardio mantendo o fence, claim retida sem prova de término, último master utilizável e proteção HTTP/DTO. `admin-catalog.sql` e `admin-behavior.sql` estão preparados para futuro ambiente de teste vazio, com rollback; a execução SQL remota continua deferida. Ensaio PGlite de outro agente, se realizado, deve ser relatado separadamente como Auth stub local, nunca como Supabase/Auth real ou concorrência de Postgres real.

Verificação executada em 09/10/2026: **129/129 Vitest** (100 Admin + 29 regressões Auth/guards), `tsc --noEmit --incremental false` sem erros, ESLint dos arquivos Admin/testes/E2E preparado sem avisos. TEMP/TMP ficaram em `work/admin-test-temp`. Nenhum servidor/build/browser/Git/SDK real foi chamado por esses testes.

Preparados quatro E2E de demo em 320/1280; não executados pelo agente Admin; a integração autorizada pela raiz está registrada no complemento final. Revisão visual Admin 390/1440 claro/escuro/teclado também não executada. O briefing `.impeccable/surfaces/admin.md` identifica referências anteriores e essa limitação.

Validação real futura exige dois contextos de navegador: B já autenticado, A master bloqueia B, B perde conteúdo/API na próxima verificação e todas as sessões/refresh tokens somem; B não se reativa por API; master com veto/role revogado não consulta nem replays; dois masters concorrendo para remoção preservam um utilizável; último master em estados blocked/ban/forced/veto não conta como alternativa; conta provisória tenta cada rota/API antes da troca e é recusada. Essas condições estão especificadas, não declaradas aprovadas remotamente.

Fontes/decisão: issue #24/T017, docs planejamento 09/10/13 e ADR-0007. Sem acesso a BlackSheep/Sistema VOE, sem coautoria, Git, build, dev server, browser, SQL/Auth remoto.
## Integração final da raiz — 09/10/2026

Os resultados e restrições de execução descritos acima pertencem ao checkpoint individual do agente deste módulo. A raiz estava autorizada a compilar e testar e concluiu a integração: 1.427 testes em UTC e São Paulo, 57 testes Node, 14 migrations e 29 asserções em PostgreSQL descartável, catálogo1242 e **168 E2E Chromium**. O portão Impeccable passou com zero registros. Detalhes, auditoria visual e limites estão na [validação final](t028-validacao-final.md).

Asserções de comportamento/fixtures são somente para **base dedicada vazia**, com rollback e verificação de resíduos; não executar sobre contas reais. No projeto pessoal, a revisão estrutural usa o catálogo readonly. Nenhuma migration nova foi aplicada remotamente. Banco/Storage/Google/SMTP, concorrência real, aparelhos e backup/restore seguem na [entrega e pendências](entrega-mvp-pendencias.md). Teste de demonstração não comprova o módulo conectado.
