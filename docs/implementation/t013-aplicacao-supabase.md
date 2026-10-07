# T-013/T-014 — aplicação supervisionada no Supabase

Em 07/10/2026, as três migrations foram aplicadas pelo MCP ao projeto pessoal `rishenjoikgmfubmnfiu`, com `success=true` em cada aplicação, conforme autorização da [OP-009](decisoes-operacionais.md#op-009--conexão-pessoal-e-aplicação-supervisionada). As três asserções SQL passaram e seus rollbacks foram conferidos. Esta evidência cobre banco e fixtures SQL; não atesta login, envio de e-mail ou funcionamento da aplicação com Auth real. BlackSheep/VOE não foram utilizados.

## Destino e situação inicial

O endpoint retornado pelo MCP corresponde ao projeto pessoal informado pelo mantenedor. A inspeção anterior à escrita encontrou PostgreSQL 17.11, `auth.users` vazio, nenhuma relação do recorte de identidade, histórico de migrations vazio e as três colunas Auth exigidas pelo preflight. A primeira inspeção confirmou `transaction_read_only=on`; a aplicação posterior usou a conexão autorizada para escrita. Não houve reset, seed persistente ou aplicação por CI/build/deploy.

## Migrations aplicadas e rastreabilidade

Os hashes abaixo vieram do [manifest SHA-256](../../supabase/sql-editor/manifest.json) dos arquivos canônicos preparados para esta aplicação. Cada migration foi enviada inteira, em ordem, pelo canal MCP. O histórico remoto retornou as versões da terceira coluna.

| Migration | Versão local original | Versão remota aplicada | SHA-256 dos bytes SQL |
|---|---|---|---|
| `identity_foundation` | `20261007082811` | `20261007151834` | `7a5bc2b2b7f1fc953159ab31820ec734a5e0d9554ce92ca952465ddfc0fdddfc` |
| `auth_password_completion` | `20261007114741` | `20261007151850` | `18bdc83e45aa2169ba8404feebeb77c236d9cadc6792470de3b8f5745b091d30` |
| `restrict_rls_event_trigger_execution` | `20261007150616` | `20261007151904` | `64a2838cd0ee18a422e28d889e8d9bc5c045204e913aec050628620083baca07` |

O canal MCP gerou automaticamente a versão remota ao aplicar cada migration; não preservou o prefixo local anterior. Os nomes canônicos e as cópias do SQL Editor foram alinhados às versões remotas reais; o manifest foi regenerado, o check passou e os bytes/hash SQL foram preservados. Essa conciliação não reaplicou migrations nem manipulou o histórico do banco. As versões originais ficam preservadas nesta tabela. O pacote e seu manifest continuam provas de integridade local, não substitutos do histórico remoto.

A consulta posterior confirmou as nove tabelas do recorte com RLS habilitada. A terceira migration restringiu EXECUTE de `public.rls_auto_enable()` para os papéis da API, inclusive a concessão herdada de `PUBLIC`, preservando a função e o event trigger `ensure_rls`.

## Asserções executadas separadamente

| Script | SHA-256 executado | Resultado |
|---|---|---|
| [Catálogo](../../supabase/tests/identity-catalog.sql) | `8d9b75ba151ff8ff1137dd9b0cb1119de1f0b20a3a05996820fe7f50bacda36c` | Aprovado; grants, RLS, funções, defaults e preservação do event trigger |
| [Comportamento](../../supabase/tests/identity-behavior.sql) | `243616d084e1c05c91283f1365545ebd9a57398ed026cd7fd440a7a094b9cf57` | Aprovado; isolamento por papel/claims sintéticos, veto, replay, rollback, revogação e janela sequencial do limitador |
| [Conclusão de senha](../../supabase/tests/auth-password-completion.sql) | `2de1c5f8708dda5240deb8f0408488a2a0cfe3ec3dd80e1f1eef171a83fa6d44` | Aprovado; acesso restrito, atomicidade da flag/evento/recibo, replay e recusa de sessão revogada |

Cada script terminou com `ROLLBACK`. A conferência posterior encontrou contagem zero em `auth.users`, `auth.sessions`, `public.profiles`, `public.domain_events`, `app_private.command_receipts` e `app_private.rate_limits`, sem os probes ou triggers de falha dos testes. Nenhuma conta inicial/master foi persistida por essas asserções. O exercício SQL da conclusão de senha não chamou `Auth.updateUser` nem enviou e-mail.

## Ensaio do limitador: concorrência inconclusiva

Em 07/10/2026, seis chamadas `execute_sql` foram despachadas com `Promise.allSettled`, usando uma chave aleatória exclusiva no escopo `login`. Cinco retornaram `allowed=true`, com `remaining` de 4 a 0; uma retornou `allowed=false` e `retry_after_ms=32447`. A asserção posterior no banco confirmou exatamente cinco hits registrados.

**O ensaio é INCONCLUSIVO para concorrência.** As chamadas usaram os PIDs `12455`, `12456`, `12457`, `12459`, `12461` e `12463`, mas os intervalos observados não se sobrepuseram: transcorreram de `2026-10-07T15:31:57.634181Z` a `2026-10-07T15:32:26.190812Z`. O transporte serializou as execuções. PIDs diferentes e despacho paralelo no cliente não provam disputa simultânea no banco; o verificador corretamente recusou essa evidência de concorrência. O resultado demonstra o limite sequencial observado, sem encerrar o critério de concorrência.

A limpeza removeu exatamente um registro de `app_private.rate_limits`, restrito ao escopo `login` e à chave aleatória `e404a19313956a5c66cd1f4a5835e391bed7aa066b051f7051c5e3a0e81e6de8`. A consulta posterior confirmou a ausência dessa chave (`true`). Nenhuma fixture de Auth foi criada neste ensaio.

## Verificação local após a integração

`npm run check` passou: 727 testes, TypeScript, ESLint, build, portão de camadas, 164 verificações de contraste, gerador do SQL Editor e scanner de 50 bundles. Também passaram os dez E2E de `auth-forms.spec.ts` e `security-headers.spec.ts`, em modo demo. Esses checks não demonstram sobreposição de transações nem validam login/e-mail real. A evidência inicial de 713 testes e 140 E2E permanece como histórico no [relatório T-014](t014-integracao.md); não é apresentada como uma nova execução integral E2E deste ensaio.

## Advisors após a aplicação

- Os avisos de EXECUTE para [anon — 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) e [authenticated — 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) deixaram de aparecer após a terceira migration. O teste de catálogo confirmou que uma tabela de prova ainda recebe RLS pelo event trigger.
- O Advisor de segurança retornou somente três registros INFO de [RLS habilitada sem policy — 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), correspondentes à moderação e às duas tabelas privadas. A ausência de policy é intencional: o acesso direto permanece fechado; operações permitidas passam pelas funções restritas. Não foram criadas policies para silenciar o Advisor.
- O Advisor de desempenho retornou três registros de [índice sem uso — 0005](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), em banco sem carga de aplicação. Isso não é medição de desempenho nem motivo suficiente para remover índices; avaliar com consultas e carga representativas.

## Evidências ainda necessárias

Tipos do schema real foram gerados pelo MCP e integrados aos dois clientes Auth do servidor. A validação de respostas JSON permanece explícita; o portão de camadas impede importar o schema gerado no Núcleo, nas features ou na UI. Os checks acima validam essa integração. A verificação automatizada de divergência contra o schema real continua pendente. T-015 continua responsável por schema/adapters de Capturas e Tarefas; os módulos da interface ainda usam dados demonstrativos.

- Concorrência com sobreposição comprovada das conexões: limite compartilhado, replay do mesmo comando, conflito de payload, rollback e progresso de chaves independentes. A suíte SQL executada é sequencial e o ensaio de seis chamadas acima permaneceu inconclusivo.
- Configuração Auth com cadastro fechado, política de senha, callbacks e variáveis server-only da aplicação. O mantenedor criará a primeira conta no Dashboard Auth Users; o papel administrativo do aplicativo é `master`, atribuído pelo bootstrap com UUID conferido, conforme [runbook](t014-auth-backend.md#primeira-conta-e-papel-master).
- Fluxos reais de entrada, troca de senha, refresh/chunking/cookies HTTPS e logout/revogação entre aparelhos. A sexta tentativa foi testada na janela SQL, não pelo fluxo de login entre instâncias da aplicação. Por decisão do mantenedor, SMTP/templates e recuperação PKCE por e-mail ficam explicitamente postergados; não foram validados.
- Isolamento e Entitlement pelos canais reais, senha provisória e falhas entre Auth/RPC, incluindo resposta perdida e reconciliação. Fixtures com `SET ROLE` não substituem esses fluxos.

O [runbook T-014](t014-auth-backend.md) detalha essas etapas. T-013/T-014 permanecem abertos nos critérios ainda não demonstrados; aplicação bem-sucedida e Advisors não encerram, sozinhos, o aceite real.
