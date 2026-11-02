# 06 — Integrações, autenticação social e Google Cloud

**Planejamento consolidado em 31/10/2026.** Base: `main` em `bd35288404c493d1b03f7a1a0208f808cc2079a2`, após merge do PR #120, reconferida sem mudança nesta auditoria. O conteúdo distingue **OBSERVADO** no código, catálogo Supabase e documentação pública de **RECOMENDADO** como solução técnica. A auditoria estrutural de leitura está concluída no [doc 16](16-auditoria-supabase.md); ela não constitui implementação, aprovação dos provedores nem comprovação dos fluxos em runtime.

## 1. Escopo decidido

| Frente | Entrega desta etapa | Fora desta etapa |
|---|---|---|
| Cadastro | E-mail e Google; sete dias de experiência inicial, seguidos de acesso gratuito durante o beta enquanto não há cobrança; preservar gratuidades existentes; onboarding após cadastro válido | Cobrança, checkout, preço na landing e migração automática das gratuidades |
| Google Calendar | Escolha de leitura ou leitura/edição; criar, editar e cancelar eventos **avulsos** com título, período/fuso, descrição, convidados e Meet quando disponível | Criar/editar/cancelar séries ou ocorrências recorrentes; recorrentes permanecem em leitura com acesso ao Google |
| ClickUp | Conectar, mostrar tarefas próprias não concluídas em seção própria de Tarefas; hierarquia; status/descrição/comentários; atualizar ao abrir, manualmente e em segundo plano com alvo aproximado de cinco minutos | Chat/DM, copiar automaticamente para tarefas nativas, edição de tarefas de terceiros, gestão de todo Workspace |
| Hierarquia ClickUp | Pai como contexto quando necessário e permitido; somente tarefas/subtarefas próprias acionáveis | Expor tarefas inacessíveis ou transformar o pai de outra pessoa em responsabilidade do usuário |
| Apple | Pesquisa e preparação documental para uma entrega posterior | Botão funcional, contratação do Developer Program ou configuração real agora |

A escolha de leitura/edição é do usuário. Google social serve para **entrar no Segundo Cérebro**; conexão Calendar serve para **autorizar a agenda**. Uma não deve acionar a outra implicitamente. A nova administração em `adm.segundocerebroapp.com.br` consumirá somente indicadores operacionais permitidos destas integrações; não ganha acesso a tokens, descrições, convidados ou comentários privados.

## 2. Diagnóstico e pontos de alteração

### 2.1 Google Calendar existente

**OBSERVADO:** `src/core/calendario/service.ts` declara leitura de identidade/e-mail, lista de calendários e eventos. Os comandos atuais são `calendar.select`, `calendar.sync`, `calendar.disconnect` e `calendar.event.link`. `CalendarProvider` ainda não possui escrita remota.

| Caminhos existentes | Responsabilidade / delta planejado |
|---|---|
| `src/core/calendario/types.ts`, `service.ts`, `participants.ts` | Estender DTO, capacidades e comandos; preservar parser estrito e regras de isolamento |
| `src/adapters/db/google-calendar-provider.ts` | Adicionar leitura de campos atuais, GET individual e operações remotas; não deixar URL arbitrária entrar no transporte |
| `src/adapters/db/google-calendar-security.ts` | Preservar PKCE, state, vínculo à sessão e AES-GCM; escolher scopes pelo modo solicitado |
| `src/adapters/db/google-calendar-runtime.ts`, `google-calendar-http.ts` | Adapters/RPCs e parsing de snapshots; manter servidor como fronteira |
| `src/app/api/calendar/oauth/start/route.ts`, `callback/route.ts` | Vincular o modo à intenção OAuth de uso único; validar concessão real no retorno |
| `src/components/features/calendario/calendar-integrations.tsx`, `calendar-accounts.tsx`, `use-calendar-commands.ts` | Seletor de permissão por conexão, estado efetivo, reautorização e desconexão |
| `src/components/features/calendario/` e `src/app/(workspace)/calendario/page.tsx` | Lista única e detalhe/editor avulso; recorrentes somente leitura |
| `src/components/features/onboarding/http-port.ts`, `src/adapters/db/onboarding-oauth.ts` | Preservar retorno seguro à etapa certa do onboarding durante conexão/reconexão |
| `src/app/api/cron/google-calendar/route.ts`, `.github/workflows/google-calendar-production.yml` | Scheduler existente; não reutilizar seu limite diário como implementação do worker ClickUp |
| `supabase/migrations/20261009160158_google_calendar.sql` | Modelo atual de contas/fontes/cache/credenciais/cursores; evoluir em migration nova |
| `supabase/migrations/20261022042432_spec08_calendar_participants.sql` | Participantes já persistidos; reaproveitar, sem duplicar estrutura |

Já há até duas contas, paginação, `syncToken`, reset em 410, janela padrão −45/+180 dias, máximo de 730 dias por janela, até oito páginas/20 mil eventos por sincronização e tratamento de conexão revogada. Esses limites são do aplicativo; não são garantias da API. A paginação de calendários pede `accessRole`, mas o mapeamento o descarta.

Participantes já carregam nome/e-mail, RSVP e flags. Não há foto no contrato. Descrição, Meet, `etag`, fuso original e identidade da série não estão no DTO atual. A API de eventos não fornece fotos dos participantes: usar iniciais quando não houver imagem legitimamente disponível, sem adicionar People API por finalidade decorativa. [Recurso Events](https://developers.google.com/workspace/calendar/api/v3/reference/events).

### 2.2 Auth e ClickUp

**OBSERVADO:** `src/lib/auth/runtime.ts` suporta senha, recovery, troca de senha e logout; não oferece cadastro aberto/social. `/auth/callback` chama exclusivamente `exchangeRecovery`, com cookie/nonce próprios. Reutilizar essa rota como callback social quebraria a fronteira atual.

`src/app/(workspace)/integracoes/page.tsx` renderiza somente `CalendarIntegrations`. Não foi encontrada integração ClickUp em `src`. Ela é uma frente nova e não um botão sobre serviço existente.

O arquivo `src/lib/legal/documents.ts` já identifica o domínio e `suporte@segundocerebroapp.com.br`. Sua política descreve Calendar **somente leitura**, logo precisa ser atualizada antes de liberar escrita e ClickUp. Não solicitar esses dados novamente nem copiar documentos pessoais do fornecedor para o Git.

### 2.3 Catálogo hospedado confirmado e reconciliação necessária

**OBSERVADO em leitura pelo MCP pessoal, em 31/10/2026:** as 67 tabelas de `public`/`app_private` coincidem com as 67 esperadas em `supabase/tests/release-catalog.sql`, todas com RLS habilitado. O inventário registra 357 funções, 33 policies e 98 triggers no recorte auditado. O catálogo executou 2.512 verificações e reportou uma única divergência: `public.onboarding_call(uuid,uuid,text,jsonb)`. A comparação posterior confirmou que o corpo remoto corresponde ao patch versionado `supabase/operations/onboarding-conflict-code.sql` com PT409 e finais de linha CRLF. Preservar essa operação conhecida; não restaurar o pin histórico só para eliminar a divergência. Evidências e limites: [auditoria Supabase](16-auditoria-supabase.md).

As estruturas atuais de Calendar, seus participantes e as estruturas de onboarding já estão instaladas; os campos e intents adicionais deste plano continuam deltas. Não foram encontrados objetos dedicados às novas frentes ClickUp, feedback/roadmap, aquisição/UTM e extensões administrativas na consulta por termos do catálogo. Essa ausência é delimitada ao catálogo consultado, não uma prova sobre conteúdo JSONB, serviços externos ou todos os schemas possíveis.

**Pré-requisito antes de DDL:** há 27 migrations no repositório e somente cinco entradas no histórico remoto. Isso não significa 22 migrations ausentes: o catálogo contém estruturas posteriores. Reconciliar a cadeia instalada, definições/grants e operações supervisionadas com as evidências do doc 16; revisar e registrar a linha de base antes de novas migrations. Não reaplicar automaticamente as 22 migrations, não executar reset/seeds nem reparar o histórico com base apenas na contagem.

**Correção planejada de desempenho:** o advisor registra quatro avisos `auth_rls_initplan` nas policies `own_read` de `calendar_accounts`, `calendar_sources`, `calendar_events` e `calendar_sync_runs`. Criar migration aditiva para avaliar `auth.uid()` e os helpers independentes da linha via subselect, após revisão de equivalência. Preservar `user_id`, verificação de sessão/entitlement em `has_feature('calendario')` e, em eventos, a fonte selecionada e a conta conectada. Não elevar privilégios, remover predicados nem editar a migration histórica. Atualizar conscientemente as expectativas de catálogo; provar isolamento entre usuários, bloqueio por sessão/acesso e plano de consulta em QA. [Orientação oficial de RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

**Operação observada:** `sc-onboarding-retention-v1` está ativo em `*/15 * * * *`, com 96 de 96 execuções registradas como sucesso nas 24 horas consultadas. Isso comprova os registros desse job, não testa a retenção de cada dado nem a sincronização Calendar/ClickUp. Não há job ClickUp no catálogo de cron consultado. Há dois buckets privados, `second-brain-files` e `second-brain-staging`, cada um com limite de 25 MiB, e nenhuma Edge Function listada. Não confundir ausência de Edge Functions com ausência das rotas de servidor da aplicação.

**NÃO VERIFICADO:** provedores e configurações Auth, SMTP/DNS, projetos/scopes/quotas Google, app ClickUp, configuração dos schemas expostos pela Data API, backups/recuperação, QA e comportamento funcional em runtime. A auditoria não executou OAuth, comandos de negócio ou alterações remotas; esses aceites continuam nas etapas apropriadas.

## 3. Ordem de execução e estimativas

Estimativas relativas: **M** = alteração delimitada em várias camadas; **L** = fluxo completo com integração; **XL** = nova integração com sincronização/concorrência. Não são prazos de calendário; revisão dos provedores não tem SLA garantido.

| Lote | Objetivo | Pré-requisitos | Prioridade/esforço | Saída verificável |
|---|---|---|---|---|
| INT-01 | Inventário Google/SMTP/domínios, reconciliação do histórico instalado e especificação de contratos | Plano validado; auditoria do doc 16; responsáveis de console | P0 / M | Linha de base reconciliada antes de DDL; matriz de ambientes sem segredos, callbacks e scopes conferidos |
| INT-02 | E-mail + Google social | Provisionamento aberto/entitlements/beta; SMTP; INT-01 | P0 / L | Conta nova chega ao onboarding; antiga preservada; recovery intacto |
| INT-03 | Completar leitura Calendar, selecionar modo e otimizar quatro policies de leitura | INT-01; contratos/migration revisados | P1 / M | DTO/cache compatíveis e policies equivalentes em acesso, com plano de consulta verificado |
| INT-04 | Escrita de avulsos Calendar | INT-03; verificação/scopes; journal | P1 / L | Criar/editar/cancelar remotamente com conflitos e resultados incertos tratados |
| INT-05 | ClickUp OAuth + leitura/hierarquia | Estrutura de integrações e segredo independente | P1 / L | Somente itens próprios e pai contextual; paginação e desconexão |
| INT-06 | ClickUp status/descrição/comentários | INT-05; permissões e journal | P1 / L | Efeito remoto confirmado, sem retry cego de comentário |
| INT-07 | Worker ClickUp ~5 min e reconciliação | INT-05; scheduler/fila operáveis; cotas | P1 / L | Atualização sem aba aberta, retirada de itens concluídos/desatribuídos, métricas |
| INT-08 | Verificação integrada/publicação | Lotes aprovados e evidências por ambiente | P0 para liberar / M | Sem alegações além do que foi comprovado; rollback por flags |
| INT-09 | Apple | Etapa posterior aprovada e orçamento/requisitos conferidos | P2 / L | Nova decisão de execução; nenhuma ativação nesta fase |

INT-03 e INT-05 podem avançar em paralelo após contratos separados. INT-06 e INT-07 podem dividir autoria, mas compartilham os contratos do espelho/journal; revisar juntos antes de integrar. Não mover código de domínio para componentes e não fazer feature importar outra feature.

## 4. Roteiro Google Cloud e Supabase Auth

### 4.1 Inventário anterior a qualquer alteração

Registrar em checklist restrito: ambiente, Google project ID, função do projeto, OAuth client ID (identificador, não secret), domínio canônico, Supabase project ref correspondente, APIs habilitadas, status da verificação, scopes aprovados e cotas efetivas. Confirmar domínio `https://www.segundocerebroapp.com.br` como produção; QA usa origem estável própria. Não usar domínio aleatório de Preview em produção.

A aplicação permanece na hospedagem atual. “Publicar no Google Cloud Console” significa preparar OAuth/APIs, e não migrar frontend/backend para Cloud Run.

**RECOMENDADO técnico:** projetos Google separados para produção e QA. Também isolar Google Auth de Google Calendar quando se desejar revogar a agenda sem afetar o grant de login. O endpoint de revogação Google abrange todos os clientes do mesmo projeto para aquele usuário; dois client IDs no mesmo projeto não isolam esse efeito. Se for mantido projeto único, documentar e testar reconsentimento no próximo login. Uma revogação Google não equivale a remover imediatamente a sessão Supabase já emitida. [Revogação](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke).

### 4.2 Console — execução manual assistida

1. Selecionar os projetos corretos e confirmar owner/responsáveis. Registrar a separação produção/QA; não reutilizar recursos de outros projetos pessoais ou de trabalho.
2. Em **APIs & Services → Library**, habilitar **Google Calendar API** apenas no projeto que a utiliza. Gmail, Drive, People e service account não são necessários para este escopo.
3. Em **Google Auth Platform → Branding**, informar Segundo Cérebro, logo aprovada, suporte, contatos de desenvolvimento, homepage e links públicos de Termos/Privacidade. Conferir marca coerente com landing/login.
4. Verificar propriedade do domínio pelo responsável em Search Console e cadastrar os domínios autorizados. `www.segundocerebroapp.com.br` é origem do aplicativo; os valores exigidos pela tela de domínios são preenchidos conforme o domínio registrado, sem incluir caminho.
5. Em **Audience**, escolher público externo para cadastro aberto. QA pode permanecer Testing; produção pública exige processo de verificação aplicável, não exceção de uso pessoal.
6. Em **Data Access**, registrar somente os scopes da matriz abaixo. Justificar cada scope por recurso demonstrável.
7. Em **Clients**, criar/conferir clientes do tipo Web application. Cadastrar callbacks exatos da matriz; no cliente de login, configurar também a origem JavaScript correspondente quando exigida pelo fluxo escolhido. Localhost fica no cliente de desenvolvimento, não como atalho no cliente de produção.
8. Guardar client secrets diretamente no vault adequado; não enviar ao chat, documentação, Git ou comandos com valor visível. No Supabase, habilitar provider Google com as credenciais de **Auth**; na hospedagem, Calendar usa suas variáveis próprias.
9. Preparar vídeo de consentimento e uso, justificativas dos scopes sensíveis, instruções de acesso ao ambiente de revisão e políticas atualizadas. Submeter verificação pelo console e tratar solicitações do Google.
10. Conferir status aprovado e consentimento real com conta de teste externa. Só então retirar flag de rollout, registrar evidência e observar erros/reautorizações.

| Finalidade | Scopes planejados | Local de retorno |
|---|---|---|
| Entrar com Google | `openid`, `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/userinfo.profile` | Google → Supabase: `${SUPABASE_URL}/auth/v1/callback`; copiar URL mostrada no provider correto |
| Agenda leitura | `openid`, `email`, `https://www.googleapis.com/auth/calendar.calendarlist.readonly`, `https://www.googleapis.com/auth/calendar.events.readonly` | `${APP_URL}/api/calendar/oauth/callback` existente |
| Agenda leitura/edição | `openid`, `email`, `https://www.googleapis.com/auth/calendar.calendarlist.readonly`, `https://www.googleapis.com/auth/calendar.events` | Mesmo callback Calendar, intenção vinculada ao modo |

Não pedir `calendar` amplo: gestão de calendários/compartilhamento não pertence à entrega. `calendar.events.owned` é mais restrito, mas não satisfaz edição em calendários compartilhados nos quais o usuário tem direito; a implementação deve seguir o alcance do escopo aprovado. [Scopes Calendar](https://developers.google.com/workspace/calendar/api/auth), [Google via Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

Callback Calendar previsto em produção: `https://www.segundocerebroapp.com.br/api/calendar/oauth/callback`. Retorno **Supabase → aplicativo**, proposto e ainda inexistente: `https://www.segundocerebroapp.com.br/auth/social/callback`. Incluir esse retorno exato em Auth URL Configuration; o callback Google não é essa rota do aplicativo. Preservar `/auth/callback` para recovery.

### 4.3 Cadastro social no código

1. Estender ports/runtime de Auth com início social e troca de code tipada; nova rota `src/app/auth/social/callback/route.ts` e handler de início. Criar estado próprio que não aceite cookie de recuperação como autorização social.
2. Validar retorno interno por allowlist; rejeitar open redirect. Usar PKCE SSR e cookies seguros por host. Nunca estender cookie de sessão ao domínio inteiro apenas para compartilhar login com a nova administração.
3. Confirmar identidade no servidor, provisionar perfil/acesso/beta idempotentemente e integrar a etapa de ciência das políticas antes de acesso ao conteúdo. Não usar `user_metadata` para conceder administração ou entitlements.
4. Conta existente conserva `user_id`, concessões, links profundos e histórico. Não executar merge de usuários por comparação case-insensitive de e-mail em código próprio; usar identidade do provider e comportamento suportado pelo Supabase.
5. Cobrir e-mail/senha já cadastrado, e-mail não confirmado, tentativa social cancelada, conta bloqueada, usuário trocado entre abas e repetição de callback. Não permitir criar nova conta como forma de contornar bloqueio.
6. Nome ausente vai para onboarding. Os sete dias iniciam pela regra de cadastro definida no plano de acesso, com timestamp do servidor; encerrá-los não cobra nem bloqueia durante o beta. Gratuidades anteriores não são substituídas.

Supabase associa identidades com o mesmo e-mail verificado e tem regras específicas para identidades não confirmadas. Testar esse comportamento com a versão efetiva de Auth antes de liberar, sem prometer junção manual de contas. [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

### 4.4 Automação e limites da publicação

| Ação | Manual/automatizável | Evidência necessária |
|---|---|---|
| Verificar domínio, marca, contato e responsabilidade | Manual pelo titular | Status/URL pública, sem documentos privados no Git |
| Habilitar API e inventariar configuração | Automatizável via CLI/IaC após autorização | Projeto selecionado e diferença revisada |
| Cadastrar cliente, consentimento, redirects e scopes | Manual assistido; scripts somente se API oficial cobrir o ato | Valores não secretos e ambiente |
| Guardar segredos nos vaults | Operação privilegiada, canal próprio | Nome/versão do segredo; nunca seu conteúdo |
| Aprovação OAuth | Externa, pelo Google | Status real no console; clicar Production não é aprovação |
| Testar callback, políticas públicas, scopes e isolamento | Automatizável em QA e ensaio conectado autorizado | SHA, ambiente, cenário e resultado |
| Configurar DNS/SMTP | Manual/automação autorizada, conforme provedor | Entrega real e autenticação do domínio, não apenas variável preenchida |

No Testing externo há até 100 usuários de teste; tokens de autorização Calendar expiram em sete dias. Identidade básica tem exceção documentada à expiração de teste, portanto não tratar login e Calendar como iguais. Scopes sensíveis não aprovados podem manter aviso/limite mesmo após mudar o status para produção. [Audience](https://support.google.com/cloud/answer/15549945?hl=en), [OAuth e validade](https://developers.google.com/identity/protocols/oauth2), [verificação sensível](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

## 5. Calendar — contratos e fluxo de escrita

### 5.1 Permissão efetiva

**RECOMENDADO técnico:** manter leitura como padrão e exigir consentimento adicional explícito para edição. Persistir separadamente:

- `connection_mode`: escolha dentro do Segundo Cérebro (`read`/`write`);
- `scopes`: concessão efetivamente recebida do Google, já existente;
- `access_role`: permissão atual por calendário;
- `write_enabled`: flag de rollout do servidor;
- capacidades por evento: recorrente, evento especial, organizador/convidado e campos modificáveis.

Toda escrita exige sessão válida, entitlement, conexão ativa, modo write, scope suficiente, ACL atual e evento suportado. Scope write não transforma convidado em organizador. Se o evento/ACL não permitir alteração, oferecer leitura e “Abrir no Google”. Google pode fornecer `writerWithoutPrivateAccess`; tratar detalhes ocultos sem inventar conteúdo. [CalendarList e ACL](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList).

Ao reduzir para leitura, bloquear imediatamente comandos no servidor. Informar a diferença entre restrição no aplicativo e revogação de grant Google; se revogar para retirar scope, preservar sequência de reconexão e considerar o efeito sobre o projeto inteiro. Não apagar agenda remota ao desconectar.

**Compatibilidade obrigatória:** atualizar em conjunto `sufficientCalendarScopes` no adapter e os guards SQL de conexão/refresh, que hoje exigem explicitamente `calendar.events.readonly`. O grant `calendar.events` deve satisfazer a capacidade de leitura e habilitar escrita apenas com os demais controles; conexões legadas somente leitura continuam aceitas. Testar grant readonly, write, parcial e ausente nos dois lados, sem exigir que o Google devolva simultaneamente scopes redundantes.

### 5.2 Dados propostos

Novos nomes abaixo são **RECOMENDADOS**, sujeitos ao contrato da migration nova e ao mapa geral de dados. Nenhuma migration foi criada/aplicada.

| Estrutura existente | Evolução proposta |
|---|---|
| `public.calendar_accounts` | `connection_mode`; scopes existentes continuam a representar concessão real |
| `public.calendar_sources` | `access_role`, `time_zone`, tipos de conferência permitidos e instante de verificação de capacidades |
| `public.calendar_events` | `description` sanitizada/limitada, `etag`, fuso/datas civis para dia inteiro, `remote_updated_at`, organizador, `recurring_event_id`, início original, `event_type`, Meet/link validado e estado de conferência |
| `app_private.google_calendar_cursors` | Versão da projeção; reset controlado para preencher campos novos em cache antigo |
| `app_private.google_credentials` | Preservar envelope cifrado/rotação; nenhuma coluna de token em claro |
| Nova `app_private.calendar_mutation_intents` | Dono, conta/calendário/evento, UUID de intenção, hash do pedido, revisão base/etag, ID remoto estável, estado e resultado sanitizado |
| `public.domain_events` | Novos eventos de operação com metadados permitidos; nunca descrição/convidados/token no log administrativo |

`calendar_events.google_id` já existe na persistência e não deve ser duplicado com outro campo de identidade. Views/RPCs/snapshots precisam expor só campos necessários ao próprio usuário. Preservar FKs compostas `(user_id, ...)`, RLS e isolamento de `app_private`; não conceder DML direto ao browser para facilitar o editor.

### 5.3 Comportamento

1. Novo evento abre formulário compacto: calendário elegível, título, dia inteiro ou início/fim/fuso; descrição e convidados opcionais; Meet apenas quando permitido.
2. Para avulsos existentes, carregar versão atual antes da edição; não salvar usando cache antigo como se fosse definitivo.
3. Eventos recorrentes, inclusive instâncias com `recurringEventId`, permanecem sem comandos de escrita nesta etapa. Não criar cópia avulsa para contornar essa regra. [Recorrência](https://developers.google.com/workspace/calendar/api/guides/recurringevents).
4. Validar data final posterior à inicial, limites de texto e convidados, fuso IANA e fim exclusivo em dia inteiro. Manter datas civis do provider para evitar deslocamento de “dia inteiro” ao converter UTC.
5. Ação com convidados informa que alterações/convites serão enviados. **RECOMENDADO técnico:** `sendUpdates=all`, com confirmação explícita da operação; não usar `none` por padrão, pois pode causar perda de sincronização em calendários externos. Cancelamento requer confirmação e não passa pela lixeira local de sete dias. [Insert e atualizações](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert).
6. Meet usa `conferenceDataVersion=1` e request ID estável para retries da mesma intenção pendente/incerta. Exibir “Criando link” enquanto pendente; não fabricar URL. Após falha confirmada, uma nova tentativa específica de conferência recebe novo request ID, preservando o ID do evento existente; não recriar o evento nem repetir o ID de conferência já processado. [Contrato conferenceData](https://developers.google.com/workspace/calendar/api/v3/reference/events).
7. Sucesso só depois de resposta remota validada e reconciliação local. Se Google confirmou, mas o banco falhou, registrar recuperação pendente; não afirmar falha remota e reenviar automaticamente.

### 5.4 Idempotência e conflito

Estado proposto da intenção: `prepared → sent → confirmed`, com saídas `rejected` ou `unknown`. Mesmo UUID + mesmo hash retorna/consulta o resultado; mesmo UUID + payload diferente é recusado.

Criação: gerar ID Google válido e estável por intenção. Após timeout, consultar esse ID antes de qualquer repetição. Edição/cancelamento: GET atual e `If-Match` com etag. Em 412, preservar rascunho, carregar versão nova e exigir nova escolha/ação; não aplicar last-write-wins. `If-Match` não é suportado para inserts. [Versionamento](https://developers.google.com/workspace/calendar/api/guides/version-resources).

Reusar sync incremental e respeitar paginação até o cursor final; 410 dispara resync da janela, sem duplicar vínculos. Ao ampliar DTO, invalidar a versão do cache antigo de modo controlado: eventos inalterados podem não reaparecer num incremental. [Sincronização](https://developers.google.com/workspace/calendar/api/guides/sync).

## 6. ClickUp — plano completo

### 6.1 Conexão

**RECOMENDADO técnico:** OAuth por usuário e credencial cifrada persistida, necessário para sincronização quando a página está fechada. Uma identidade ClickUp pode autorizar diversos Workspaces; permitir seleção de quais entram no produto. Não impor limite comercial arbitrário nem interpretar Workspace ClickUp como unidade de isolamento do Segundo Cérebro.

Criar app OAuth por owner/admin do Workspace de desenvolvimento; configurar redirect HTTPS proposto `${APP_URL}/api/integrations/clickup/oauth/callback`. Usar authorization code com state de uso único, sessão/dono vinculados e exchange no servidor. Endpoints oficiais: `https://app.clickup.com/api` e `https://api.clickup.com/api/v2/oauth/token`. Token OAuth atualmente não expira segundo a documentação, mas pode ser revogado; não inventar refresh endpoint. Token pessoal não integra a interface pública planejada. [Autenticação ClickUp](https://developer.clickup.com/docs/authentication).

Identificar usuário por `GET /api/v2/user` e Workspaces autorizados; nunca confiar em assignee enviado pelo browser. Cada consulta e comando valida vínculo entre sessão, conexão, Workspace e item. [Usuário autorizado](https://developer.clickup.com/reference/getauthorizeduser).

Ao desconectar: marcar conexão inativa e impedir jobs/escritas antes da limpeza, remover caches e credenciais locais, descartar intents ainda não enviadas; manter apenas recibos técnicos mínimos de operações incertas. Não há endpoint de revogação OAuth identificado na documentação pública consultada: orientar revogação no ClickUp e não apresentar “revogado no ClickUp” só porque o token local foi apagado. Se webhooks vierem a ser adotados, deletá-los antes de eliminar a credencial ou registrar falha de limpeza sem permitir novas operações. [Erros de autorização](https://developer.clickup.com/docs/common_errors).

Cada conexão precisa de geração/revisão monotônica. Job e intenção capturam a geração; verificam estado/geração antes da chamada e novamente ao publicar cache, resultado e watermark. Desconectar/reconectar invalida a geração anterior; uma resposta antiga não repovoa dados ou usa o token da nova conexão. Lease expirada não prova término do HTTP anterior: preservar resultado incerto e reconciliação, sem conceder autoridade a um worker atrasado.

### 6.2 Seleção e experiência das tarefas

Consulta inicial por Workspace com `assignees[]=remote_user_id`, `subtasks=true`, `include_closed=false`, páginas a partir de zero e até 100 registros. Páginas são processadas no servidor; não buscar toda a equipe e filtrar no navegador. [Get Filtered Team Tasks](https://developer.clickup.com/reference/getfilteredteamtasks).

Excluir da fila ativa tipos de status `done` e `closed`; nomes podem ser customizados/traduzidos. Não usar apenas texto “Concluído”. A exclusão de closed pela API não substitui regra sobre Done. [Tipos de status](https://developer.clickup.com/docs/filter-views), [Done](https://help.clickup.com/hc/en-us/articles/6309517280919-Use-Done-statuses).

Seção própria **ClickUp** dentro de Tarefas, com origem, Workspace/lista e ligação ao original. Não misturar progresso das tarefas nativas com status externos. Não enviar espelho para a lixeira local nem criar tarefa nativa duplicada. A referência visual do app orienta listas/menus, sem recodificar o workflow ClickUp em três status artificiais.

Subtarefa própria aparece sob o pai. Quando o pai não é atribuído ao usuário, lê-lo apenas se a API já autoriza, armazenando o mínimo de contexto (identificador, título, origem) e sem controles de edição. Pai inacessível vira rótulo neutro “Tarefa principal indisponível”, sem revelar conteúdo. Subtarefas de outras pessoas ficam ocultas; concluídas não são acionáveis. Contagens nunca sugerem que filhos ocultos foram importados ou concluídos pelo usuário.

### 6.3 Detalhe e edição

Mostrar título, descrição, status reais da lista, responsáveis, datas, prioridade, links, subtarefas próprias e comentários. Campos extras suportados podem ter leitura limitada; anexos remotos ficam como links seguros, sem download/espelhamento automático.

- Status e descrição: `PUT /task/{task_id}` com somente os campos alterados; consultar lista para opções válidas. Custom Fields usam endpoint próprio e não têm edição nesta entrega. [Update Task](https://developer.clickup.com/reference/updatetask), [Get List](https://developer.clickup.com/reference/getlist).
- Comentários: ler/enviar comentários da tarefa. Chat/DM não faz parte do escopo. Informar envio sob a conta conectada; `notify_all=false` não elimina notificações a outros responsáveis/watchers. [Create Task Comment](https://developer.clickup.com/reference/createtaskcomment).
- Antes de mutação, revalidar que o usuário continua responsável, tem acesso e a tarefa está elegível. Se deixou de ser responsável durante edição, conservar rascunho para copiar e bloquear envio, retirando item da fila na reconciliação.
- Conteúdo remoto em Markdown/HTML passa por sanitização. Não expor cookies/headers/tokens, embeds arbitrários ou execução de HTML. Preservar campos não editados e semântica de subtarefas.

### 6.4 Concorrência e resultado incerto

A documentação de Update Task consultada não fornece CAS/If-Match. **RECOMENDADO:** guardar `date_updated`/hash dos campos, reler antes de enviar e pedir escolha se houver divergência; enviar somente campos deliberados e reler resultado. Existe intervalo de corrida entre GET e PUT: não prometer isolamento serializável do serviço externo.

Journal por dono/conexão/intenção, com hash e estado. Serializar escritas da mesma tarefa dentro do app. Receber 200 não autoriza inventar confirmação de campos; validar resposta/GET posterior.

Comentário não dispõe de idempotency key remota comprovada. Se houver timeout após envio, marcar resultado incerto, preservar texto e buscar comentários recentes para reconciliação assistida. Não reenviar automaticamente nem deduplicar só por texto — duas mensagens iguais podem ser legítimas. Só retentar após resultado conhecido ou confirmação explícita de novo envio.

### 6.5 Sincronização ao abrir, manual e em segundo plano

**Decidido:** alvo aproximado de cinco minutos em condições normais, inclusive sem aba aberta. Não escrever “tempo real”.

1. Consulta de UI lê cache do próprio usuário e informa última atualização; abertura solicita job se estiver desatualizado. Botão Sincronizar usa o mesmo coordenador, com deduplicação.
2. Worker server-side agenda conexões elegíveis a cada aproximadamente cinco minutos, com jitter, lease por conexão, fila limitada e backoff. Não implementar isso apenas com `setInterval` no navegador.
3. Poll incremental usa `date_updated_gt`, margem de sobreposição e deduplicação por ID/revisão; watermark só avança após todas as páginas confirmadas. Nova execução retoma/faz reconciliação, nunca marca lote parcial como completo.
4. Consulta filtrada não devolve tarefa concluída ou removida do assignee. Para removê-la do cache, reler os IDs ativos em lotes e/ou executar reconciliação completa periódica. 404 e perda de acesso tornam o item indisponível; não concluir exclusão remota apenas porque uma página falhou.
5. `last_success_at`, `next_run_at`, falhas, idade do cache e contagens são métricas sanitizadas. Conexão suspensa/sem entitlement não é elegível. Remover credencial impede novo trabalho.
6. Replanejar cadência sob 429, alto volume ou instabilidade, mostrando atraso. Objetivo de cinco minutos é operacional, não garantia contra limites do provider. Dimensionar chamadas por conexão: páginas + releituras + comentários + escritas; aferir em QA e simular volume antes da liberação.

**RECOMENDADO para esta entrega:** polling coordenado + reconciliação satisfazem a cadência escolhida; webhooks são melhoria posterior, não bloqueio escondido do primeiro lote. Se adicionados, verificar HMAC SHA256 de `X-Signature` sobre bytes originais, segredo por webhook, deduplicação e fila; notificações fora de ordem apenas acionam releitura. Não confiar em IP de origem ou evento como prova de permissão atual. [Webhooks](https://developer.clickup.com/docs/webhooks), [assinatura](https://developer.clickup.com/docs/webhooksignature).

O scheduler Google atual é diário e tem protocolo próprio; não substitui o worker ClickUp. Preferir infraestrutura já existente, com rota proposta `/api/cron/clickup` protegida e scheduler autorizado. **Contrato da borda:** Vercel Cron nativo envia `Bearer CRON_SECRET`; nesse caso a rota valida esse segredo e despacha internamente o caso de uso restrito. `CLICKUP_CRON_SECRET` serve para executor externo que possa enviar o header correspondente, não é enviado automaticamente pelo Vercel. Escolher um contrato, testar401/200 e não aceitar silenciosamente vários segredos nem reaproveitar o segredo Google. Conferir limites/custos vigentes e comportamento de entrega. Apenas ter Vercel Pro não comprova jobs criados ou executados. [Autenticação Vercel Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).

### 6.6 Estrutura proposta

Os nomes são **propostos**, não arquivos/tabelas presentes hoje.

| Camada | Estrutura |
|---|---|
| Domínio | `src/core/integracoes/clickup/`: contratos, seleção, hierarquia, comandos, sincronização e resultados |
| Adapters | `src/adapters/integrations/clickup-provider.ts`; adapters DB/security no padrão de infraestrutura existente |
| Canais | `src/app/api/integrations/clickup/` para start/callback/snapshot/commands/disconnect; `src/app/api/cron/clickup/route.ts` |
| UI | Feature de conexão ClickUp e seção própria de tarefas consumidas por composição; sem imports feature→feature |
| Conexões | `public.clickup_connections`: dono, identidade remota, estado e último sucesso; `public.clickup_workspaces`: seleção/metadados mínimos |
| Espelho | `public.clickup_task_mirrors`: dono/conexão/Workspace/ID remoto únicos, parent/list/status/tipo, campos essenciais e revisão; diferenciar item próprio de contexto |
| Segredos/flows | `app_private.clickup_credentials`, `app_private.clickup_oauth_flows`, com cifra e nonce de uso único |
| Operação | `app_private.clickup_sync_jobs`, `clickup_mutation_intents`, limites e leases; métricas administrativas por metadados |
| Migrações | Novas migrations em `supabase/migrations/`, criadas pela CLI e revisadas; tipos gerados/snapshots/RPCs atualizados |

RLS nas tabelas expostas; FK composta com dono; browser não recebe token nem escreve diretamente em espelho/journal. `app_private` não recebe grants amplos para facilitar jobs. Função privilegiada deve ser mínima, com verificação explícita e evento de domínio na mesma transação da escrita local. A lixeira de sete dias das tarefas/capturas/páginas nativas **não se aplica** a espelhos externos: excluir/cancelar no provedor é efeito remoto próprio.

## 7. Variáveis, credenciais e separação de ambientes

| Nome | Estado | Destino/uso |
|---|---|---|
| `APP_MODE`, `APP_URL` | Existente | Modo e origem canônica do app |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Existente | Servidor conforme contrato atual; segredo nunca cliente |
| `AUTH_STATE_SECRET`, `AUTH_RATE_LIMIT_SECRET` | Existente | Fluxos/limitação Auth; manter separação de propósito |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | Existente | OAuth **Calendar** atual |
| `GOOGLE_CALENDAR_STATE_SECRET` | Existente | Intenções Calendar |
| `GOOGLE_CALENDAR_TOKEN_KEY`, `GOOGLE_CALENDAR_TOKEN_KEY_ID`, `GOOGLE_CALENDAR_TOKEN_KEYS` | Existente | Chave AES-GCM e keyring de rotação Calendar |
| `GOOGLE_CALENDAR_CRON_SECRET`, `SC_GOOGLE_CRON_ALLOW_RUN`, `SC_GOOGLE_CRON_TIMEOUT_MS` | Existente | Scheduler/executor Google; não reaproveitar como segredo ClickUp |
| `SC_GOOGLE_CALENDAR_SCHEDULER_ENABLED` | Existente, variável GitHub | Ativação do workflow Google; estado real não auditado aqui |
| Google Auth client ID/secret | Nova configuração de provider | Painel Supabase Google; não requer automaticamente novas envs no app |
| `GOOGLE_CALENDAR_WRITE_ENABLED` | Proposta | Flag server-only, inicialmente falsa |
| `CLICKUP_INTEGRATION_ENABLED` | Proposta | Flag server-only, inicialmente falsa |
| `CLICKUP_CLIENT_ID`, `CLICKUP_CLIENT_SECRET`, `CLICKUP_STATE_SECRET` | Propostas | OAuth ClickUp no servidor |
| `CLICKUP_TOKEN_KEY`, `CLICKUP_TOKEN_KEY_ID`, `CLICKUP_TOKEN_KEYS` | Propostas | Cifra e rotação ClickUp, independentes de Calendar/Auth |
| `CLICKUP_CRON_SECRET` | Proposta, executor externo | Header explícito de executor externo ClickUp; não é enviado pelo Vercel Cron nativo |
| `CRON_SECRET` | Existente, condicionado ao uso nativo Vercel | Credencial validada na borda do cron nativo; não substituir os segredos de outros executores |

Não criar `NEXT_PUBLIC_*` para essas credenciais. Atualizar `.env.example` somente com nomes/comentários vazios; valores reais ficam no vault. Resolver rotação com leitura de chave anterior e regravação confirmada, não invalidar todas as conexões ao trocar a chave. Callback/worker sempre verificam ambiente; cliente de QA nunca usa token de produção.

## 8. Custos e limites datados

Consulta oficial em **31/10/2026**; reconferir imediatamente antes de contratar/configurar.

| Serviço | Informação verificada / consequência |
|---|---|
| Google Calendar | Modelo de quotas foi atualizado em 01/05/2026; projetos antigos podem manter limites anteriores. A página informa uso padrão sem custo adicional e mudança de cobrança acima do limite prevista para 2026, com comunicação prévia. Não prometer “ilimitado/grátis para sempre”; conferir quotas e billing do projeto. [Limites/custos](https://developers.google.com/workspace/calendar/api/guides/quota) |
| ClickUp | Limites por token/minuto: Free/Unlimited/Business 100; Business Plus 1.000; Enterprise/Enterprise Plus 10.000. Respeitar `X-RateLimit-Limit`, `Remaining`, `Reset`. O plano do usuário condiciona capacidade; não recomendar upgrade como pré-requisito sem medição. [Rate limits](https://developer.clickup.com/docs/rate-limits) |
| Apple Developer | US$ 99 por ano segundo página oficial, com variações regionais/possíveis isenções. Contratação não autorizada neste plano. [Inscrição](https://developer.apple.com/programs/enroll/) |
| Hospedagem, banco, SMTP e worker | Há consumo de execução, chamadas, armazenamento e entrega de e-mail. Dimensionar com planos atuais do titular; valores reais não foram auditados e não devem ser inventados. Cadência de cinco minutos precisa de orçamento operacional. |

## 9. Apple posterior

Preparar backlog separado: Services ID associado a App ID primário habilitado, domínio e return URL, chave de assinatura `.p8`, provider Supabase e rotação do client secret. O fluxo web requer renovação do segredo pelo menos a cada seis meses; falhar nessa manutenção interrompe novos logins. Nome pode faltar em acessos posteriores e e-mail relay exige teste de entrega. [Configuração Apple](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/), [Supabase Apple](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple).

Não mostrar botão Apple antes de estar operacional. Reavaliar associação de identidades sem fundir usuários por nome; ausência do nome se resolve no onboarding. A etapa tem dependência externa e nova aprovação de execução, não bloqueia e-mail/Google.

## 10. Testes e critérios de aceite

Reaproveitar `tests/adapters/calendar-security-provider.test.ts`, `calendar-runtime.test.ts`, `calendar-route.test.ts`, `calendar-oauth-sql.test.ts`, `calendar-participants-sql.test.ts`, `supabase/tests/calendar-catalog.sql`, `calendar-behavior.sql`, `tests/scripts/google-calendar-cron.test.mjs` e suites de Auth. Adicionar casos de negócio que os contratos novos exigem, sem testes que apenas fixam textos/classes.

| Frente | Casos obrigatórios | Aceite objetivo |
|---|---|---|
| Auth social | Novo/existente, mesmo e-mail verificado, não confirmado, conta bloqueada, cancelamento, state/PKCE adulterado, replay, troca de dono, deep link, recovery | Novo chega ao onboarding; existente mantém dados/gratuidades; nenhum bypass de bloqueio; recovery anterior passa |
| OAuth Calendar | Recusa parcial, leitura/write, upgrade/downgrade, duas contas, reconexão da conta errada, revogação | Modo efetivo é conferido no servidor; leitura não escreve nem por HTTP direto |
| DTO/cache | Legado sem novos campos, resync, participantes omitidos, descrição perigosa, ausência de Meet, evento privado/recorrente | Sem conteúdo inventado; sem fotos falsas; cache atualizado sem perder vínculos |
| Escrita Calendar | Avulso, dia inteiro, DST/fuso, convidados, Meet pendente/falho, cancelamento, 412, timeout antes/depois da resposta | Um evento por intenção; conflito preserva rascunho; remoto+local reconciliados; recorrentes bloqueados |
| ClickUp leitura | Mais de 100 itens, múltiplos Workspaces, assignee mudando, Done/Closed, pai terceiro/acesso negado, item removido | Somente itens próprios acionáveis; pai contextual; sem duplicação nativa/vazamento |
| ClickUp escrita | Status inválido/sem permissão, descrição concorrente, comentário confirmado/incerto, refresh de dados | Efeito no ClickUp verificável; nenhum comentário duplicado por retry cego |
| Worker | Página fechada, execuções concorrentes, cursor parcial, 429, token revogado, timeout, scheduler atrasado | Atualização em torno de cinco minutos em cenário QA normal; atraso visível; uma execução por conexão; backoff e recuperação |
| Isolamento | Dois donos/IDs cruzados, token em DTO/log, grants/RLS, desconexão enquanto job roda | Nenhum acesso cruzado; bloqueio imediato de novas operações; segredo nunca no cliente |
| Policies Calendar | Comparar as quatro `own_read` antes/depois; sessão inválida, veto/entitlement, fonte desmarcada, conta desconectada e dois donos | Mesmas permissões e recusas; sem grants novos; plano de consulta medido em QA e expectativas de catálogo atualizadas |
| Interface | Teclado/foco, celular, temas, estado vazio/offline/permissão, formulário preservado | Fluxo executável sem mouse; erro não apaga rascunho; sem promessa de disponibilidade ausente |

Validação em camadas: contratos puros → adapters com provider falso → SQL/isolamento em banco de teste → browser com cenários controlados → ensaio conectado autorizado com contas de teste. Registrar SHA, ambiente, execução e resultado separadamente. CI verde e HTTP 200 sem registros não comprovam sincronização real nem verificação Google.

## 11. Liberação, contingência e pontos operacionais

- Manter flags desligadas até schema/serviço/UI compatíveis e aceite conectado. Antes de DDL, reconciliar as 27 migrations versionadas com as cinco entradas remotas e a estrutura comprovada no doc 16; não reaplicar as 22 por diferença de contagem. Aplicação de schema é supervisionada; CI/build/deploy não executam migrations.
- Antes do deploy: reconferir `main`, lockfile, versões Supabase e changelog, destino de banco/hospedagem, OAuth redirects e política pública. Não presumir que o snapshot documental continua sendo o código vigente.
- Para rollback, desabilitar novas escritas/conexões; conservar dados e intents pendentes para reconciliação. Não remover colunas/segredos necessários a operações em andamento nem cancelar o processo como prova de ausência de efeito.
- Desativar Admin atual somente depois de existir contingência de observabilidade operacional. Novo `adm` recebe métricas sanitizadas de sucesso/falha/atraso, nunca payloads, conteúdo dos calendários ou credenciais. O roteiro de Google não pode depender de uma tela Admin retirada.
- Logs excluem authorization headers, códigos OAuth, state completo, nomes de tarefas, descrições, convidados e comentários. Recibos e IDs técnicos têm retenção definida pelo plano de dados; a regra de 12 meses para feedback encerrado não se aplica automaticamente a credenciais ou caches.
- Conferências externas ainda necessárias: projetos/quotas Google reais, DNS/SMTP, scopes aprovados, provider Supabase, criação do app ClickUp, execução do worker e domínio da administração. São tarefas operacionais futuras, não novas lacunas de produto a perguntar.
- O Supabase pessoal foi auditado por consultas estruturais de leitura; a recusa inicial de acesso foi superada após autenticar o MCP. Não houve configuração do aplicativo no console, execução de OAuth de Calendar/ClickUp, escrita SQL ou ensaio funcional remoto. Auth/SMTP/DNS, schemas expostos pela Data API, backups, QA e runtime continuam não verificados, conforme doc 16.
