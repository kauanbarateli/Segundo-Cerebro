# T-031 / #53 — projeção comercial v1 e inventário de autorização

Estado: fatia aditiva offline autorizada pelo prompt de execução do mantenedor em 19/10/2026, coordenada com a Root. A autorização atual prevalece sobre o estado histórico «somente planejamento» de D-064/PR #69, preservado nos documentos originais. Refs #53. Part of #50. **O ticket continua aberto e nenhum consumidor comercial foi ativado.**

## Base, reservas e publicação

Base combinada com a Root: `3433c49b9e0e59546ed564222f3c3de814e71098` (PR #69, sobre `main` `f3d18960a41076e99aa60dcc9f6b46967970ebb5`). Branch local `codex/t031-commercial-access-v1`; clone isolado `work/Segundo-Cerebro-t031`. O clone contém somente objetos/arquivos versionados; os WIPs do checkout da Root não foram copiados.

Reservas exclusivas desta fatia: `src/core/access/commercial-access.ts`, `tests/core/commercial-access.test.ts` e este documento. Não há migration reservada ou criada. `resolve-access.ts`, Auth, Settings, páginas legais, middleware/layout, configuração, dependências e workflows permanecem com seus donos. A próxima migração só será preparada após reserva única pela Root; 001–019 não são alteradas/reaplicadas.

D-075 mantém Hobby e deploy adiado. A Root confirmou que não há canal comprovado sem autodeploy para estas novas branches; a entrega é por commit/patch local, **sem push ou PR**. A supressão da branch legal não se estende a esta. Não há prova de CI hospedado, Preview, deploy ou banco decorrente desta fatia.

## Contrato proposto e implementado isoladamente

Entradas vêm de adapters de servidor com autoridade própria, lidas novamente no momento da autorização. Nenhum DTO deste documento é uma entrada confiável de browser ou uma claim de JWT. Um UUID com formato válido, por si só, não comprova sessão, elegibilidade, pagamento ou propriedade. A validação sintática não autentica a origem dos fatos.

| Contrato | Campos e comportamento |
|---|---|
| `CommercialSubject` | `userId`, `sessionId`, `sessionActive`, `administrativelyBlocked`, `mustChangePassword`; os fatos precisam ser atuais e conferidos pelo adapter/SQL. Não recebe papel via metadata. |
| Cabeçalho `CommercialAccessProjection` | `version: 1`, `userId`, `revision` decimal textual e `category`; decoder fechado rejeita campos adicionais e versões desconhecidas. |
| `current-free` | `eligibilityId` obrigatório para um registro explícito do conjunto D-043 conferido. Ausência de estado, papel Master, origem Admin e data arbitrária de deploy não concedem a categoria. A existência real desse conjunto continua pendente. |
| `exempt` | `grantId` obrigatório de concessão explícita. Não executa Admin, revogação ou aviso D-062; o produtor deve substituir a projeção quando houver uma transição autorizada. Não há expiração automática inventada. |
| `paid` | Período reconhecido com ID, `startsAt` e `endsAtExclusive` ISO UTC canônicos; intervalo **proposto** `[início,fim)`. `renewal` é `null` ou a obrigação de renovação desse período com `chargeId`/`dueOn`. Não aceita primeira cobrança pendente como prova. |
| Renovação relevante | A data civil de vencimento deve coincidir com a data do fim do período em São Paulo. Fatura antecipada de outro ciclo é rejeitada como entrada incompatível; não vira inadimplência atual nem amplia o período. Ledger futuro precisa resolver causalidade e conflitos antes de produzir esse DTO. |
| `restricted` | Motivo fechado: `unclassified`, `suspended`, `ended`, `revoked`, `needs-reconciliation`. Não inventa gratuidade para estado protegido/incerto. |
| `resolveCommercialAccess` | Recebe Funcionalidade, subject, `AccessPolicy` existente, projeção desconhecida e `now` explícito em milissegundos. Compõe identidade/moderação/troca obrigatória, veto/privilégio e condição comercial; Preferência altera somente `visible`. Não escreve nada. |
| `resolveSelfManagementAccess` | Operações fechadas `security`, `subscription`, `data-request`; exige proprietário, sessão/moderação atuais e veto de Configurações preservado. Não recebe nem depende de período pago para permitir regularização. Não é permissão de usar o snapshot completo de Configurações. |
| Resultado/erro | Resultado `{allowed,visible,reason}` com motivos fechados, sem payload de provedor, conteúdo de módulo, e-mail ou segredo. Estado ausente/inválido, dono diferente, reconciliação, fim do período, dívida após corte, sessão inválida e veto têm resultados distintos. |

O limite `[início,fim)` e a associação da renovação são um contrato sintético explícito para revisão da Root, ainda sem consumidor. Não homologam a precisão/fonte temporal Asaas de #51 nem encerram a definição causal de #54/#57/#58/#59. Períodos concorrentes, dívida de outro ciclo, revogação causal e efeito externo incerto não podem ser convertidos em `paid` por este decoder; o produtor precisa conciliá-los. Não se usa «última notificação vence».

`renewalRestrictionStartsAt` usa as funções existentes de `core/tempo`, IANA `America/Sao_Paulo` e primeiro instante válido da data civil D+6. Vence dia 10 → acesso até o fim do dia 15 → restrição no começo do dia 16. Não soma 120 horas desde webhook e não fixa UTC−3. Os cenários incluem viradas de ano, fevereiro/bissexto e transições históricas de horário de verão, inclusive meia-noite inexistente.

Cancelamento com `renewal: null` conserva o período reconhecido até seu fim exclusivo e não acrescenta tolerância sem renovação exigível. Este módulo não cancela assinatura ou dívida e não calcula a âncora/mês da retomada; essas escritas pertencem às dependentes. A chegada de uma fatura futura durante um período válido não o torna vencido.

Sem escrita, não existem novos eventos, recibos, outbox, IDs idempotentes ou transaction boundary nesta fatia. Repetir os mesmos fatos/relógio produz o mesmo resultado; isso é determinismo de consulta, não prova de idempotência financeira. A futura produção/alteração da projeção exige CAS/locks e alteração + evento + recibo na mesma transação, com sessão/proprietário/autoridade revalidados no banco; ainda não foi implementada aqui.

Login, logout e troca obrigatória de senha conservam os fluxos Auth existentes. `readIdentity` não foi mudada e o gate não entra em `session_active`/`my_access_state`; suspensão comercial não produz identidade nula. Os rótulos de gestão não autorizam listagem de módulos, exportação automática ou escrita de foco/contexto/avatar.

## Inventário concreto de canais na base

**OBSERVADO por leitura estática na base combinada; migração e prova por canal ainda PENDENTES.** A lista abaixo organiza os pontos encontrados e os negativos necessários. Não declara cobertura remota completa. Antes da ativação, a Root precisa reconciliar o inventário com o HEAD integrado, catálogo/grants atuais e chamadas reais. Nenhuma linha desta tabela passou por execução conectada nesta fatia.

| Canal/ponto concreto | Situação observada e migração/prova necessária |
|---|---|
| URL/RSC: `src/lib/auth/workspace-guard.ts`, páginas em `src/app/(workspace)/` | `authorizeWorkspaceFeature` → `requireFeature`/`assertFeature` usam política de Entitlement. Conservar acesso Auth e dar destino comercial próprio; URL direta de módulo precisa negar no corte. Admin requer Master; Ajuda e Sair têm classificação própria. |
| Layout/prefetch: `src/app/(workspace)/layout.tsx`, `src/adapters/db/account-presentation.ts` | O layout chama `accountPresentation`/`settings_snapshot` antes dos filhos. A futura gestão mínima não pode carregar snapshot geral/providers de módulos como efeito colateral. Fallback `null` de apresentação não prova conta nova ou isenção. |
| Auth: `src/lib/auth/{runtime,policy,guards}.ts`; `app_private.session_active`, `current_user_active`, `my_access_state` em `20261007151834_identity_foundation.sql` | `readIdentity` transforma erro SQL 42501 em ausência de identidade. Preservar essa fronteira; comercial fica separado. Sessão/JWT antigos precisam consultar fatos atuais na autorização efetiva, sem confiar em claim antiga. |
| APIs Capturas/Tarefas: `src/app/api/capture-tasks/route.ts`, `capture-task-runtime.ts` | APIs verificam identidade, conta esperada e `assertFeature`; adapter usa snapshot/revision/receipt/commit. Provar leitura, escrita, conversão, replay e snapshot, também pelo canal privilegiado direto. |
| SQL Capturas/Tarefas: `capture_task_guard`, `capture_task_{snapshot,revision,receipt,commit}` nas migrations `20261007210519...` e `20261009144350...` | Guard compartilha locks e sessão; há RLS `own_read` com `has_feature`. Inventariar todas as assinaturas públicas/privadas, origens de Captura e Vínculos, sem liberar replay antigo ou apagar dados. |
| Conhecimento: API `knowledge`, `knowledge-runtime.ts`, `knowledge_guard`, `knowledge_{snapshot,receipt,commit,capture_origins}` | Leituras de relacionados e promoção atravessam várias Funcionalidades. Gate precisa cobrir origem/destino, RLS, conteúdo e replay, preservando Página/Vínculo e sem snapshot pela gestão. |
| Financeiro: API `finance`, `finance-runtime.ts`, `finance_guard`, `finance_{snapshot,revision,receipt,commit}`, wrappers `transfer`, `pay_statement`, `create_series`, `close_account` | Gate comercial de módulos é distinto de recepção/regularização da assinatura. RPCs service-only e wrappers não podem contornar o bloqueio do Financeiro. |
| Projetos/Hábitos: API `projects-habits`, `projects-habits-runtime.ts`, `projects_habits_feature`, `projects_habits_guard`, snapshots/recibos/commit | `projects_habits_feature` consulta Entitlement diretamente; mudar só `has_feature` é insuficiente. Cobrir contêineres de Captura/Caderno, histórico, marcações/pausas e contexto futuro. |
| Cofre: API `vault`, `vault-runtime.ts`, `vault_guard`, `vault_{snapshot,receipt,commit}` | Guard usa Entitlement direto; aplicar comercial sem ler conteúdo/segredo do Cofre e sem expor ciphertext pela gestão. Eventos continuam só metadados permitidos. |
| Busca/Atividade: APIs `search`/`activity`, adapters `search-runtime`/`activity-*`, `global_search`, `activity_page`, `activity_projection_feature` | Autorização de Início não pode vazar resultados, contagens ou eventos de módulos suspensos. Revalidar Funcionalidade de cada origem e isolamento na paginação. |
| Google manual/OAuth: APIs `calendar`, `calendar/oauth/{start,callback}`, `google-calendar-http.ts`, `google-calendar-runtime.ts` | `calendar_actor` consulta moderação/Entitlement diretamente. Negar novas leituras/sync e callbacks antigos incompatíveis, preservar protocolo de desconexão/revogação e claims ainda incertas segundo contrato revisado pela Root. Não executar OAuth para esta prova. |
| Google jobs/Admin: `src/app/api/cron/google-calendar/route.ts`, API `calendar/admin-runs`, `google_calendar_{jobs,call,admin_runs}` | Seleção de jobs e execução/finalização precisam revalidar projeção/revisão para não gravar após corte/estado novo. Autoridade própria de conciliação financeira futura continua fora do gate dos módulos. |
| Storage: APIs `files/{uploads,read}` e `files`, `files-http.ts`, `files-runtime.ts`, `file_guard`, `file_upload_*`, `file_read_metadata`, `file_avatar_set` | Reservar/claim/finalizar envio, ler metadata e emitir URL assinada são caminhos independentes. URL atual dura 60 segundos; bloquear nova emissão não revoga uma capacidade já emitida. Definir a estratégia/restrição exigida e provar limite antes de declarar corte imediato de Storage. Avatar não é operação mínima automaticamente liberada. |
| Storage/RLS/limpeza: `second_brain_private_objects`, `second_brain_private_buckets`, `files_owner_read`, `capture_files_owner_read`, `files/cleanup`, `cleanupFiles` e `file_cleanup_*` | Policies/restrições e service role têm provas separadas. Limpeza técnica existente não equivale à retenção comercial futura e não pode ganhar TTL D-056 por inferência. Drive é histórico retirado; esta fatia não o reabre nem apaga infraestrutura. |
| Configurações: API `settings`, `settings-runtime.ts`, `settings_snapshot`, `settings_commit`, `update_identity` | Snapshot geral contém perfil/preferências/módulos e o patch é fechado. Criar futura consulta/command de gestão mínima separado; foco/contexto não ganham escrita pelo nome «Configurações». Não adicionar campos ao patch sem versão/contrato. |
| Sessões próprias/segurança: API `settings/sessions`, `own-sessions-*`, `my_sessions`, `complete_password_change` | `my_sessions` usa sessão e `has_feature('configuracoes')`; precisa permanecer no limite permitido sem abrir snapshot de módulos. Ban, sessão revogada, troca obrigatória e veto administrativo continuam aplicáveis. |
| Admin/monitoramento: API `admin`, API `monitoring`, `admin-runtime.ts`, `admin_require_master`, `admin_*` | Não expor a saga administrativa ao checkout nem conceder Master por pagamento. Separar autoridade comercial restrita das operações existentes; definir com a Root a composição de moderação e operações internas antes de consumidores. |
| Eventos/RLS transversais | `domain_events` tem policies por tipo e as migrations posteriores expandem allowlists. Conferir cada tipo e conjunto com a projeção atual; não liberar payloads de módulos por um `else true`. Não mudar `domain_events.user_id` para visitante fictício. |

## Expansão, migração e contração ainda necessárias

1. A Root e o mantenedor conferem privadamente o conjunto D-043 e aprovam o critério de corte. Este arquivo não contém ou consulta e-mails/UUIDs reais. Registrar prova mínima de elegibilidade, sem backfill por papel ou ausência de assinatura.
2. Rever período/fonte financeira e o DTO com #51/#54, contratos de isenção com #60 e tratamento de fatos incertos/causais. Fechar fonte comum, locks/fences, eventos/recibos e timestamp da migration nova. Nenhum consumidor deve assumir que o decoder concede autoridade.
3. Preparar migração aditiva, projeções mínimas, funções de autorização equivalentes no SQL e pacote SQL Editor consistente. Provar rollbacks, grants/RLS, usuários/roles e concorrência em ambiente sintético autorizado. Não aplicar em banco remoto nesta frente.
4. Migrar todos os consumidores do inventário no mesmo recorte revisado, incluindo capacidades Storage previamente emitidas e providers/prefetch. A migração não pode tratar gestão mínima como módulo livre nem tornar a pessoa anônima.
5. A Root executa o lote conectado por canal no HEAD exato e só então considera ativação/contração; novas vendas permanecem fechadas. Publicação exige canal compatível com D-075 e verificação real de CI/autodeploy. #54 continua bloqueada por #51/#52/#53 completos.

## Prova preparada e lote de validação

Fixtures de `tests/core/commercial-access.test.ts` são inteiramente sintéticas. Cenários preparados: decoder/campos/versões/dono; gratuidade/isenção explícitas; ausência/uncerteza; veto/ban/sessão/troca obrigatória; Preferência; Master; todas as Funcionalidades; D+6 antes/exatamente/depois; meses/ano/bissexto/DST; período futuro; cancelamento sem tolerância extra; determinismo; gestão mínima sem acesso a módulos ou a outro dono.

Checks planejados sob o único slot pesado: teste Vitest focado com `--maxWorkers=1`, ESLint dos dois arquivos, TypeScript e `check:layers`; depois scanner de segredos e `git diff --check`. Instalação somente com Node 24, dependências próprias e RAM/slot liberados explicitamente. Nenhum build, PostgreSQL, navegador ou suíte ampla é necessário para alegar execução de consumidor inexistente. Evidência sintética não será apresentada como equivalência SQL/servidor ou validação de Storage/Auth real.

**Pendente neste checkpoint:** instalação/checks aguardam a fila de RAM; a Root mediu menos de 1 GB livre e interrompeu somente sua própria instalação. Os cenários acima ainda não são PASS. A evidência final identificará o commit executado e os resultados efetivos; pendências de conectividade, publicação e transição continuam separadas.

Revisão estática cruzada pelo codificador de #52: módulo/testes e funções de tempo lidos, sem achado bloqueante; propostas temporais e ausência de execução mantidas explícitas. `git diff --cached --check` passou nos três arquivos preparados. Essa conferência de whitespace não substitui parser, TypeScript, testes, lint ou scanner, que continuam bloqueados pela condição operacional.

Roteiro conectado exclusivo da Root, quando autorizado: contas sintéticas de gratuidade/isenção/paga/suspensa; sessão antiga; veto/ban e outro dono; relógio de fronteira; cada canal da matriz com leitura/escrita/replay negados; segurança/assinatura/solicitações permitidas com projeções mínimas; conferir conservação dos dados e nenhum acesso de módulo por Settings/Storage/OAuth/job. Sem compra Asaas, conta pessoal como fixture, migrations 001–019 reaplicadas ou limpeza de terceiros.

## Referências e limites da leitura

Contrato: issue #53 e SPEC-07 #50 atuais, sem comentários na reconferência de 19/10; ADRs 0001/0002/0003/0004/0007/0008/0009/0010; D-032–D-076 e prompt atual; pacote 16 (especialmente 02/04 e T-031); AGENTS/CONTEXT/docs de agentes e OP-009. A skill Supabase foi lida para Auth/RLS; não autoriza conexão nesta frente. Não há mudança de API Supabase ou schema nesta fatia.

Referências fora da base: PR #47 continua draft em `57a2967f34a11cf985e62827d67179335474f477` (sem delta em relação à referência solicitada); PR #45 draft em `93ab8549efbdc7c121715ea449c2ce04676585ed`, handoff histórico somente leitura, sem preparos CLOSED; pesquisa Asaas em `12b572ec0c93aa004bfda7141f40bd5f0ef1b659`, PR #49 em `13da4579b97072b60eed245d3e6cab4e10a10a45`. Protótipo/nove telas não comprovam onboarding conectado. Não há afirmação de capacidade atual Asaas, homologação ou consulta autenticada a fornecedores nesta fatia.
