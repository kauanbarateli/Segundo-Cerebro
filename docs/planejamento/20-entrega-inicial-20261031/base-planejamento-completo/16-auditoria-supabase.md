# Auditoria do Supabase e ajustes no planejamento

**31/10/2026, America/Fortaleza · auditoria estrutural em leitura.** Projeto `rishenjoikgmfubmnfiu`, confirmado pelo MCP como `https://rishenjoikgmfubmnfiu.supabase.co`. A autenticação OAuth foi concluída pelo mantenedor. A `origin/main` foi atualizada e permanece em `bd35288404c493d1b03f7a1a0208f808cc2079a2`.

**O bloqueio de acesso ao catálogo foi resolvido.** A estrutura observada corresponde aos 67 nomes de tabelas esperados no código. Antes de novas migrations, porém, é necessário reconciliar o histórico: existem 27 arquivos no Git e apenas cinco registros no banco. Também é preciso incorporar à verificação de release um ajuste operacional do onboarding que já está instalado.

Não foram alterados dados, schema, políticas, funções, buckets ou jobs. Não foram consultados conteúdos dos usuários, credenciais, sessões individuais ou objetos armazenados. A configuração alterada foi a conexão MCP local solicitada pelo mantenedor. A inspeção estrutural não substitui testes funcionais com duas contas em homologação.

## Evidência e cobertura

| Item | Resultado observado |
| --- | --- |
| PostgreSQL | 17.11 |
| Tabelas em `public` e `app_private` | 67; nenhuma ausente ou extra em relação a `expected_tables` do catálogo versionado |
| RLS dessas tabelas | 67 habilitadas |
| Rotinas dos schemas da aplicação | 357, com assinaturas, hash do corpo, proprietário, linguagem, privilégios e configuração inventariados |
| Políticas da aplicação e Storage | 33 |
| Constraints / índices da aplicação | 408 / 191 |
| Triggers da aplicação e de `auth.users` | 98 triggers não internos |
| Migrations | 27 arquivos no Git; cinco registros no ledger remoto |
| Verificação estrutural versionada | 2.512 verificações; retorno bruto `ok=false`, com uma divergência explicada abaixo |
| Storage | Dois buckets privados, com limite de 26.214.400 bytes cada, equivalentes a 25 MiB |
| Edge Functions | Nenhuma listada; o backend atual usa adapters/rotas da aplicação |
| Cron Postgres | Um job de retenção do onboarding, ativo a cada 15 minutos |
| Histórico agregado desse cron | 96 execuções e 96 sucessos nas 24 horas anteriores à consulta; último sucesso em 01/11/2026 00:00 UTC, ainda 31/10 no fuso local |

O [resumo verificável](evidencias/supabase/audit-summary.json) identifica escopo, SHA e limitações. As [consultas executadas](anexos/auditoria-supabase/catalog-environment.sql) usam `BEGIN TRANSACTION READ ONLY`, timeouts e `ROLLBACK`; a [consulta de release](anexos/auditoria-supabase/release-catalog.sql) foi copiada do repositório sem alteração lógica. Listagens dos provedores e advisors também foram somente leitura. Quantidades de registros de usuários retornadas como estimativas pelo inventário não foram incluídas na evidência entregue.

## 1. Histórico de migrations precisa de reconciliação

O ledger contém somente:

1. `20261007151834_identity_foundation`;
2. `20261007151850_auth_password_completion`;
3. `20261007151904_restrict_rls_event_trigger_execution`;
4. `20261007210519_capture_task_transactions`;
5. `20261007223710_activity_page`.

Apesar disso, o catálogo contém Financeiro, Conhecimento, Admin, Arquivos, Cofre, Calendar, imagens privadas, frequência de hábitos, onboarding e metas financeiras previstos na cadeia posterior. **Não executar automaticamente as 22 migrations sem registro.** A ausência no ledger não significa ausência dos objetos e não permite determinar, sozinha, como cada mudança foi instalada.

**Incluir na F01, antes de schema novo:**

- Preservar inventário, ledger, hashes de fonte e resultado do catálogo desta auditoria.
- Conferir evidências operacionais da implantação e relacionar cada arquivo ao estado final, considerando alterações posteriores que substituem definições anteriores.
- Reproduzir a cadeia canônica em homologação isolada e comparar estrutura e exceções operacionais reconhecidas. Não usar reset no projeto pessoal.
- Preparar procedimento explícito para reconciliar o registro de migrations, revisado por arquivo. Não marcar em lote como aplicadas sem prova e não reescrever migrations antigas para acomodar o banco.
- Registrar os patches operacionais e o responsável por mantê-los até sua incorporação formal ao protocolo de release.
- Somente depois dessa reconciliação, gerar migrations aditivas das frentes novas e validar sua sequência.

**Aceite:** ledger e estrutura têm uma explicação rastreável, a cadeia é reproduzível e a próxima migration pode ser aplicada sem tentar recriar módulos existentes. Evidências: [ledger remoto](evidencias/supabase/migration-ledger.json) e [comparação dos 27 arquivos](evidencias/supabase/migration-comparison.csv).

## 2. A divergência do onboarding é um patch já previsto

A consulta `supabase/tests/release-catalog.sql` retornou 2.512 verificações e uma divergência em `public.onboarding_call(uuid,uuid,text,jsonb)`. O contrato histórico espera o wrapper SQL original; o banco tem o wrapper PL/pgSQL que converte conflito de serialização em `PT409`.

Esse comportamento corresponde a `supabase/operations/onboarding-conflict-code.sql`, já versionado. O corpo remoto tem 203 caracteres e MD5 `d0cf024a96f4ed619dc54e65c7024037`, exatamente o corpo desse script com finais de linha CRLF. A cópia lida com LF tem 198 caracteres; os cinco caracteres adicionais são as diferenças de quebra de linha. Assinatura, retorno, `SECURITY INVOKER`, `search_path` vazio e concessão somente ao papel de serviço permanecem compatíveis.

**Incluir na F01/F13:** atualizar o protocolo e as expectativas de catálogo para reconhecer formalmente o patch; manter o resultado bruto desta execução. Não reverter a correção apenas para deixar o teste antigo verde e não declarar que o catálogo passou integralmente. Validar em QA que um conflito retorna HTTP 409 sem repetir a operação indefinidamente.

Evidências: [resultado bruto interpretado](evidencias/supabase/release-catalog-result.json) e [comparação dos corpos e privilégios](evidencias/supabase/onboarding-patch-comparison.json). O script operacional foi apenas lido, não reaplicado.

## 3. Segurança e desempenho

O inventário não encontrou privilégios anônimos em tabelas/rotinas da aplicação, escrita direta de `authenticated` nas tabelas ou escrita direta de `service_role` nelas. O pequeno conjunto de rotinas executáveis pelo usuário autenticado corresponde ao contrato atual de identidade/acesso. Essas observações são estruturais; não comprovam a autorização de cada comando em execução.

| Achado do advisor | Interpretação e trabalho planejado |
| --- | --- |
| 36 informações de RLS sem policy | São 32 tabelas privadas e quatro públicas fechadas intencionalmente: `user_moderation`, `admin_audit_events`, `vault_items` e `vault_master_keys`. Preservar o acesso pelos canais/RPCs previstos. Não criar policies permissivas para remover o aviso. |
| Proteção contra senhas vazadas desativada | Incluir na preparação de Auth da F02. Conferir disponibilidade no plano Supabase, configurar quando disponível e validar cadastro/troca/recuperação. Vercel Pro não informa o plano Supabase. Se o recurso não estiver disponível, registrar essa condição e a decisão de liberação com os controles de senha e abuso existentes. |
| Quatro avisos de avaliação de Auth por linha no Calendar | Revisar `own_read` de `calendar_accounts`, `calendar_sources`, `calendar_events` e `calendar_sync_runs`. Otimizar a avaliação estável de `auth.uid()` preservando dono, atividade e capacidade; comparar acesso e plano de execução em QA. |
| 25 indicações de FKs sem índice de cobertura | Priorizar por consulta, joins, cascatas e volume; evitar índices redundantes. A quantidade é a informada pelo advisor, não uma ordem de criar 25 índices. |
| 27 indicações de índices sem uso | Não remover automaticamente: estatísticas dependem da janela observada e há índices de integridade, filtros e manutenção. Medir antes de decidir. |

A proteção contra senhas vazadas está disponível no Supabase Pro e superiores, segundo a [documentação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Para interpretar os demais avisos, consultar [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [avaliação de Auth nas policies](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [FKs](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) e [índices sem uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

Preservar a saga administrativa, a proteção do último Master e os triggers de criação de identidade. Na separação do ADM, os mesmos contratos devem receber a nova validação de sessão/canal, não ser substituídos por permissões amplas. Evidências completas: [segurança](evidencias/supabase/advisors-security.json), [desempenho](evidencias/supabase/advisors-performance.json), [privilégios](evidencias/supabase/permissions.json), [rotinas](evidencias/supabase/functions.json) e [policies](evidencias/supabase/policies.json).

## 4. Storage e retenção já existentes

`second-brain-files` e `second-brain-staging` são privados, ambos com limite de 25 MiB. A configuração de MIME do bucket está nula: os limites e tipos específicos por funcionalidade precisam continuar sendo validados no pipeline de upload. O limite do bucket não altera o limite de 8 MB previsto na interface para determinadas imagens. Não abrir buckets para facilitar capas, avatares ou metas.

O job `sc-onboarding-retention-v1` executa a cada 15 minutos e apresentou 96 sucessos em 96 execuções na janela de 24 horas. Essa prova confirma agendamento e término SQL da retenção de onboarding; não comprova volume eliminado nem implementa a futura lixeira de tarefas, capturas e páginas. Não executar sweep durante a auditoria.

**Incluir na F08/F07:** planejar separadamente a purga da lixeira e o worker ClickUp. A ausência de outros jobs em `cron.job` não prova ausência de agendamentos no GitHub ou na Vercel. Esses executores externos permanecem a conferir. Evidências: [buckets](evidencias/supabase/storage.json), [cron sanitizado](evidencias/supabase/cron.json) e [extensões instaladas](evidencias/supabase/extensions-installed.json).

## 5. Deltas efetivos para cada frente

| Frente | Base confirmada no banco/código | Delta a implementar |
| --- | --- | --- |
| F01 — Acesso | Perfis, papéis, moderação, entitlements e RPCs atuais | Reconciliação 5/27, reconhecimento do patch, disponibilidade de novas funcionalidades e estado de beta |
| F02 — Cadastro | Auth de senha/recovery e onboarding persistente | Cadastro aberto, login Google, provisionamento, ciência legal e sete dias sem bloqueio no beta; configuração de provider/SMTP ainda não comprovada |
| F04 — Capturas | Capturas/documentos, anexos, vínculos e páginas existentes | Modal e reorganização de controles; reaproveitar os contratos atuais |
| F05/F06 — Calendar | Contas, fontes, eventos, participantes, cursores, credenciais privadas e sincronização de leitura | Descrição/Meet/etag/ACL/modo, escrita avulsa, recibos/conflitos e melhoria das quatro policies |
| F07 — ClickUp | Nenhuma estrutura dedicada encontrada no catálogo ou na main | OAuth, espelho próprio, hierarquia, comandos e worker; não reutilizar credenciais Google |
| F08 — Lixeira | Exclusão lógica, FKs/triggers e manutenção do onboarding | Prazo de sete dias, transição, restauração e purga referencial próprios; não reaproveitar o job de onboarding como se fosse suficiente |
| F09 — Imagens/projetos | Referências privadas de imagens e contexto de projetos existentes | Polimento de layout e uso dos campos/serviços atuais |
| F10 — Feedback/roadmap | Nenhum domínio dedicado de pedidos, respostas ou roadmap encontrado | Tabelas, RLS, comandos privados, publicação editorial e retenção |
| F11 — ADM | Saga, auditoria, papéis, moderação e proteção do último Master existem | Deploy separado, MFA, vínculo da sessão ao canal e liberação de funcionalidades; novas estruturas dedicadas ainda não encontradas |
| F12 — UTM/métricas | Não foram encontradas tabelas/colunas dedicadas nem referências correspondentes nas rotinas pesquisadas | Implementar coleta consentida e atividade mínima, cronologia e agregados, sem inventar histórico anterior |
| F13 — Aceite | Catálogo estrutural consultável e evidência atual disponível | Baseline reconciliado, testes de comportamento e isolamento em QA, depois prova de liberação |

Os pontos de código continuam sendo os mapeados nos docs [05](05-plano-executivo.md), [06](06-integracoes-e-google-cloud.md), [07](07-dados-seguranca-e-retencao.md), [09](09-administracao-separada.md) e [10](10-utm-metricas-e-jornada.md). Em especial: `src/core/access/resolve-access.ts`, `src/core/calendario/`, `src/adapters/db/google-calendar-*`, `src/core/admin/`, `src/adapters/db/admin-runtime.ts`, `src/lib/auth/`, `src/core/onboarding/` e novas migrations em `supabase/migrations/`.

O [scan de novas funcionalidades](evidencias/supabase/new-features.json) retornou zero correspondências aos termos documentados na [consulta](anexos/auditoria-supabase/catalog-new-features.sql). Isso delimita a ausência de estruturas identificáveis no catálogo examinado; não exclui um sistema externo ou informações arbitrárias dentro de JSON, que não foram inspecionadas. Para o planejamento atual, UTM, feedback/roadmap, ClickUp e a sessão do novo ADM continuam sendo implementação nova.

## 6. Critérios adicionais de execução

1. **DB-REC-01:** reproduzir e reconciliar a cadeia de 27 migrations e os patches reconhecidos antes de adicionar schema; nenhum reset ou reaplicação automática das 22 sem registro.
2. **DB-REC-02:** atualizar a expectativa do wrapper PT409 mantendo assinatura, privilégios e a prova HTTP 409 em QA.
3. **DB-SEC-01:** preservar os fechamentos intencionais das 36 tabelas; validar RPCs com dois usuários e com Master bloqueado/sem MFA.
4. **DB-AUTH-01:** conferir plano e configuração de proteção de senhas, SMTP, providers, confirmação, redirects e recuperação, sem presumir esses estados a partir das tabelas.
5. **DB-CAL-01:** otimizar as quatro policies sem alterar resultados autorizados; comparar planos e testar negação entre contas.
6. **DB-RET-01:** preservar o cron de onboarding e introduzir purga da lixeira com prova própria, incluindo FK de captura promovida, imagens compartilhadas e restauração concorrente.
7. **DB-NEW-01:** criar os domínios novos com RLS, contratos e retenção desde a primeira migration, reutilizando a fundação atual.

## Limites que permanecem

- Configuração completa de Auth, Google provider, SMTP, confirmação, CAPTCHA, redirects e MFA não foi lida por este MCP. O advisor confirmou especificamente a proteção contra senhas vazadas desativada.
- O setting de schemas expostos da Data API não apareceu na consulta de configurações de role/database. Resultado nulo é inconclusivo: conferir a configuração efetiva, sem afirmar que `app_private` está exposto ou fechado por isso.
- Backups, PITR, recuperação, custos/plano Supabase, projeto de QA e agendamentos externos não foram validados.
- Não foram executados fluxos reais de cadastro, comandos de negócio, OAuth de Calendar/ClickUp, upload/download, exclusão, restauração ou testes de isolamento com conteúdo. Testes SQL que criam fixtures ou funções temporárias ficaram fora da auditoria em produção, mesmo quando usam rollback.
- O registro histórico das cinco migrations continua inalterado. A classificação da divergência do wrapper não transforma o resultado bruto `ok=false` em `true`.

As recusas de acesso registradas anteriormente permanecem como histórico. Este documento e suas evidências substituem a situação de “catálogo do banco não verificado” dos rascunhos anteriores, apenas dentro do escopo acima.
