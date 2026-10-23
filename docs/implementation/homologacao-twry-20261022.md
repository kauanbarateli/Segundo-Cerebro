# Homologação isolada — 22/10/2026

Refs PR #100 e #35/#41/#42/#44/#75/#81. Destino exclusivo: projeto pessoal `twrydxsdemaykgvdlpyd`, conexão MCP `supabase-segundo-cerebro-homologacao`.

## Autorização e limites

Em22/10 o mantenedor autorizou preparar este projeto e aplicar as migrations necessárias, mantendo merge e deploy de produção bloqueados até concluir os testes. Isso amplia a OP-009 somente para a primeira instalação supervisionada de001–025 neste banco isolado. Não autoriza alterar produção `rishenjoikgmfubmnfiu`, instalar schema no Ensaio_restore `jvwduowyavpaxssogadn`, reset, seeds, contratação de serviços ou execução hospedada por CI/build/deploy.

Fonte congelada da instalação: PR #100, commit `3d86cd8f7e1e97e89990513237a8d4ef792b3249`, árvore `7566fe2ee28c2199ad07252a758072aa239ea247`. SQL canônico e cópias numeradas são conferidos por bytes/SHA256/Git; nenhuma migration aplicada anteriormente é editada. A aplicação neste projeto vazio é uma instalação nova, sem reaplicar arquivos em produção.

## Pré-condições observadas

- API URL confirmada pela conexão dedicada: `https://twrydxsdemaykgvdlpyd.supabase.co`.
- PostgreSQL17.11; operador e sessão `postgres`; schema `app_private` ausente; histórico de migrations vazio.
- Zero tabelas/views da aplicação, contas e sessões Auth, buckets e objetos Storage. A única função pública inicial é `rls_auto_enable()`, retornando `event_trigger`.
- Colunas Auth exigidas presentes: `sessions.not_after`, `users.is_anonymous` e `users.deleted_at`.
- `ensure_rls` habilitado, owner `postgres`, evento `ddl_command_end`, tags `CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO`; helper SECURITY DEFINER/owner `postgres`/search_path `pg_catalog`. A migration003 já contém a restrição dos grants sinalizados pelos dois Advisors iniciais; nenhuma026 foi criada.

## Protocolo da aplicação

Executar um arquivo completo de cada vez, na ordem001–025, pela conexão dedicada e parar no primeiro erro. Cada arquivo conserva seu próprio BEGIN/COMMIT.009 e019 não declaram timeout local; essa característica histórica é registrada, sem alterar os bytes. Os nomes/versões atribuídos pelo MCP serão mapeados externamente aos arquivos canônicos e seus hashes, sem fabricar ou editar histórico.

Asserções e catálogo pós025 ficam separados, em READ ONLY/ROLLBACK. A instalação não cria conta de teste nem master. O estado das contas, a configuração Auth, os callbacks, as chaves do projeto e os fluxos HTTP têm gates próprios.

**OBSERVADO:** as 25 migrations foram aplicadas em ordem, com sucesso individual e histórico remoto reconferido. A 011 foi inicialmente recusada ANTES da escrita pela revisão automática por possível conflito com a retirada do Drive. O mantenedor então respondeu explicitamente “Autorizar a 011 original na homologação”. A segunda tentativa usou o mesmo SQL e a mesma conexão dedicada, sem contornar a revisão. O Storage compartilhado de imagens/Avatar e as rotinas legadas históricas permanecem no schema; a aba Drive continua fora do MVP. Os recibos da recusa e da execução posterior foram preservados separadamente.

O catálogo canônico `supabase/tests/release-catalog.sql`, SHA256 `43901539db2d4b063825974a2d4aa47e1517e88cff380eb5241bbd4dad678ee6`, foi executado separadamente em READ ONLY/ROLLBACK: **1.534 verificações, `ok:true`, zero desvios**. A conferência encontrou 35 tabelas públicas e 15 privadas, todas com RLS, zero usuários/sessões Auth, perfis, eventos de domínio ou objetos Storage. Existem apenas os dois buckets privados constantes da instalação, com limite individual de 25 MiB e nenhum bucket público. Não houve fixtures, seeds ou bootstrap de Master.

O Advisor de segurança retornou 19 informações `rls_enabled_no_policy`, sem alertas WARN/ERROR nesse resultado. Root e peer confrontaram as 15 tabelas privadas e as quatro tabelas públicas administrativas/Cofre com as ACLs e o catálogo: a ausência de policies e de grants `authenticated` é exigida pelo contrato; o acesso ocorre por rotinas controladas, com o SELECT server-only de `user_moderation` preservado. Não criar políticas permissivas apenas para silenciar o linter. O helper de RLS continua habilitado e seu EXECUTE não é concedido a anon/authenticated/service_role após a 003.

A [evidência pública de metadados](evidence/homologacao-twry-installed-20261022.json) registra os hashes canônicos, o mapeamento remoto, catálogo, contagens e limites. Os recibos completos originais e checkpoints parcial/final são preservados fora do Git. Um banco instalado não significa deployment ou aceite conectado concluído; os gates HTTP, Auth, Storage e UI permanecem separados.

| Ordem | Versão canônica | Versão atribuída pelo MCP | Nome remoto |
| --- | --- | --- | --- |
| 001 | `20261007151834` | `20261022182227` | `m001_identity_foundation` |
| 002 | `20261007151850` | `20261022182231` | `m002_auth_password_completion` |
| 003 | `20261007151904` | `20261022182234` | `m003_restrict_rls_event_trigger_execution` |
| 004 | `20261007210519` | `20261022182345` | `m004_capture_task_transactions` |
| 005 | `20261007223710` | `20261022182348` | `m005_activity_page` |
| 006 | `20261009144343` | `20261022182351` | `m006_financial_transactions` |
| 007 | `20261009144350` | `20261022182354` | `m007_knowledge_pages_links` |
| 008 | `20261009150122` | `20261022182359` | `m008_identity_admin_settings` |
| 009 | `20261009151557` | `20261022182404` | `m009_account_preferences` |
| 010 | `20261009152200` | `20261022182408` | `m010_projects_habits` |
| 011 | `20261009152822` | `20261022184641` | `m011_private_storage_drive` |
| 012 | `20261009154609` | `20261022184656` | `m012_global_search_activity` |
| 013 | `20261009160151` | `20261022184659` | `m013_encrypted_vault` |
| 014 | `20261009160158` | `20261022184702` | `m014_google_calendar` |
| 015 | `20261009231338` | `20261022184706` | `m015_file_cleanup_fairness` |
| 016 | `20261010010955` | `20261022184709` | `m016_close_public_sequence_defaults` |
| 017 | `20261010044217` | `20261022184711` | `m017_finance_monthly_plan` |
| 018 | `20261011071500` | `20261022184714` | `m018_admin_auth_creation_order` |
| 019 | `20261011113751` | `20261022184717` | `m019_own_sessions` |
| 020 | `20261021045700` | `20261022184729` | `m020_spec08_private_entity_images` |
| 021 | `20261021144650` | `20261022184731` | `m021_spec08_habit_frequency_history` |
| 022 | `20261021171416` | `20261022184735` | `m022_spec08_capture_document_write` |
| 023 | `20261022042432` | `20261022184740` | `m023_spec08_calendar_participants` |
| 024 | `20261022042500` | `20261022184743` | `m024_spec08_finance_card_metadata` |
| 025 | `20261022042501` | `20261022184746` | `m025_spec08_capture_knowledge_promotion` |

## Próximos gates

Revisar o contrato explícito de origem para Auth antes do SDK, build, adapters, Storage e CSP; configurar Preview restrito à branch de homologação com credenciais próprias. Não copiar chaves de produção, OAuth/Cron ou contas pessoais como fixtures. A branch `codex/homologacao-twry-20261022` permanece com deployfalse durante o preparo. Somente o deployment isolado já autorizado poderá ser liberado após a conferência do candidato/destino; produção e merge continuam bloqueados.

**OBSERVADO na Vercel:** projeto `prj_68nPrMlzdTLhvhXF2zWvNK6BFaW2`, equipe `kauanbarateli-projects`, sem deployment ou variáveis da branch de homologação. As 14 variáveis existentes estão exclusivamente em Production; nenhum valor foi decifrado ou copiado. Antes do Preview, cadastrar valores exclusivos com target `preview` e gitBranch exata, conferir `VERCEL_BRANCH_URL` efetivamente atribuído e usar esse origin HTTPS como APP_URL. O marcador `APP_DEPLOYMENT_TARGET=homologation` pertence somente à homologação: deve permanecer ausente nos ambientes atuais, pois vazio também é opt-in inválido.

O Advisor de desempenho retornou quatro WARN `auth_rls_initplan` nas policies `own_read` de `calendar_accounts`, `calendar_sources`, `calendar_sync_runs` e `calendar_events`, além de informações sobre índices não utilizados/FKs. Não são falhas do catálogo ou autorização para abrir RLS; otimizações exigem revisão e migration nova própria. Os 50 índices ainda sem uso em um banco vazio não demonstram que devam ser removidos. Os tipos oficiais pós025 foram exportados desta homologação para comparação estática; não atestam a versão instalada em produção.

A comparação estática do export MCP encontrou os mesmos 35 tipos de tabelas, uma view e 59 RPCs, sem objetos ou relações acrescentados/removidos. O formato do gerador difere do snapshot CLI: omite `ComputedFields`, amplia `NonNullable<Json>`, descreve colunas GENERATED como graváveis e usa `Args:never` nas cinco RPCs sem parâmetros. Por isso o export foi preservado como evidência, sem substituir cegamente `database.generated.ts` nem remover suas proteções de escrita. O catálogo real aprovado é a prova independente de schema; testes de tipos e aplicação ainda precisam dos próprios resultados do candidato.

## Primeira rodada e ajustes dos verificadores

A fonte `f5485d4ddb529cd1be915e320076a737e92bf616` recebeu 17 runs originais: nove SUCCESS e oito FAILURE, sem cancelamento ou repetição. Os dois CI gerais pararam no getter adversarial do QA, inferido como void pelo TypeScript; os seis Admin/Recovery pararam nos controles que ainda exigiam 65 fontes, apesar do módulo novo e do inventário de 66. Não chegaram aos casos nativos dessas seis linhas. As fontes e os raws da primeira rodada foram preservados.

A correção declara o retorno string do getter que só lança erro, mantendo a recusa sem invocá-lo, e alinha a cardinalidade exata do coletor e as duas declarações de tipos aos inventários já revisados. Não muda clientes, destinos, permissões, limites ou testes de recusa. Os novos resultados pertencem ao candidato posterior; nenhum PASS da primeira rodada é herdado.

A chave exclusiva da homologação foi conferida em leitura administrativa com cliente identificado como servidor, sem criar contas. O User-Agent padrão do PowerShell parecia navegador e ocasionou recusas401 nos probes anteriores; essa distinção é prevista na documentação de [API keys do Supabase](https://supabase.com/docs/guides/getting-started/api-keys). Os valores não foram expostos. A última leitura pública sem cache ainda mostrou signup habilitado após o primeiro ajuste informado; a confirmação do controle e do Save changes foi solicitada no projeto exato. O Preview continua sem publicação ou credenciais copiadas para a Vercel.

## Atualização observada em23/10

O parágrafo anterior conserva seu checkpoint histórico. Depois de salvar o controle no projeto correto, a leitura sem cache de22/10 às19h46UTC confirmou `disable_signup:true`, e-mail ativo e anonymous/phone desativados. Quatro testes negativos reais da Data API passaram sem escrita: perfil, eventos e RPC sem sessão recusados, e schema privado não exposto. A reconferência final desse ensaio encontrou zero usuários, sessões, perfis, eventos e objetos.

O mantenedor informou a importação das variáveis e o callback. Root conferiu os nove nomes como segredos, exclusivamente em Preview da branch `codex/homologacao-twry-20261022`, sem decifrar valores nem copiar Production. O deployment isolado `dpl_AgUkCiELx42G912hWePFBUbNJ4HC`, fonte `fd16e51e68a3c2d64bdbfab9a136cdb0093c885a`, chegou a READY. O alias real é `segundo-cerebro-of-git-codex-homo-efc4bb-kauanbarateli-projects.vercel.app`. O preflight sem credenciais anterior permanece preservado como recusa esperada; não virou sucesso retroativo.

Na mesma fonte, 16 runs originais passaram e Auth PR foi cancelado pelo teto de35min durante a instalação do cliente PostgreSQL. Uma única reexecução diagnóstica do job aprovou577 guardas, três jornadas de Auth, isolamento/persistência e limpeza. Os registros de tentativa1CANCELLED e tentativa2SUCCESS permanecem separados. Esse aceite de runner não certifica UI hospedada.

A composição da #101 sobre a #105 preserva17 blobs exatos da fonte móvel629, Recovery233 e os controles históricos B/P; a única combinação nova é a união dos guardsfalse. A nova fonte precisa de CI próprio. READY e a presença de callback não substituem login do aplicativo, persistência, imagens, isolamento nem aceites mobile. O acesso HTTP anônimo ao Preview ainda é protegido pela autenticação Vercel; não desabilitar essa proteção para testar. A organização e a janela-alvo estão no [plano de fechamento23/10](plano-fechamento-20261023.md).

O mantenedor entrou na Vercel pelo navegador do Codex. A conferência subsequente encontrou a tela real “Entrar · Segundo Cérebro” no alias de homologação, sem criar link de bypass nem remover a proteção. Isso confirma acesso à aplicação pelo navegador autorizado, ainda sem sessão de Usuário do aplicativo ou prova de persistência.

Depois desse checkpoint, o [ensaio real de Auth e persistência](homologacao-auth-persistencia-20261023.md) aprovou duas contas comuns, replay com evento único, isolamento, revogação e limpeza exata. A primeira recusa do parser e sua recuperação ficaram preservadas. As contagens finais no MCP voltaram a zero. Esse PASS pertence à Auth/Data API; UI do Preview, imagens e mobile continuam pendentes.
