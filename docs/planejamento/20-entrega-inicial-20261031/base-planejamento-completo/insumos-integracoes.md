# Insumos — integrações e publicação Google

> **Levantamento histórico anterior às respostas finais.** Consulte `02-decisoes-confirmadas.md` e os documentos05–12 para o plano consolidado. As perguntas e alternativas abaixo foram respondidas; não reabrir a entrevista nem executar uma recomendação superada.

Data da consulta: **31/10/2026**. Base analisada: `main`, commit `bd35288404c493d1b03f7a1a0208f808cc2079a2`, snapshot local `work/sc-main-planejamento-20261031`. **Análise estática e documentação pública; nenhum console, token, usuário, SQL, API privada ou deploy foi alterado/testado.** Este arquivo é insumo para consolidação, não autorização de implementação.

## 1. Decisões já recebidas da raiz

- Primeiro lançamento: e-mail e Google; Apple em etapa posterior.
- Após sete dias, manter acesso gratuito durante o beta enquanto cobrança não estiver pronta.
- Preservar gratuidades das contas existentes.

## 2. Diagnóstico verificável no código

| Área | OBSERVADO | Arquivos concretos |
|---|---|---|
| Google Calendar | Integração persistente somente leitura; até duas contas Google; escolha de calendários, sincronização e desconexão | `src/components/features/calendario/calendar-integrations.tsx`, `calendar-accounts.tsx`; `src/core/calendario/service.ts` |
| OAuth Calendar | `openid`, `email`, `calendar.calendarlist.readonly`, `calendar.events.readonly`; PKCE S256, state/cookie vinculados a usuário/sessão, validade 10 minutos; refresh offline | `src/adapters/db/google-calendar-security.ts`; `src/app/api/calendar/oauth/start/route.ts`; `src/app/api/calendar/oauth/callback/route.ts` |
| Segredos Calendar | AES-256-GCM com chave independente e AAD por dono/conta/versão; rotação via keyring; servidor apenas | `src/adapters/db/google-calendar-security.ts`; `.env.example` |
| Persistência Calendar | Contas, fontes, cache e runs em `public`; credenciais, cursores, flows e links remotos em `app_private`; RLS e fronteira de RPC | `supabase/migrations/20261009160158_google_calendar.sql`; `src/adapters/db/google-calendar-runtime.ts`; `supabase/tests/calendar-catalog.sql`, `calendar-behavior.sql` |
| Participantes | Nome/e-mail, RSVP, self/organizer/optional/resource e indicador de lista truncada. Limite local 200; nenhuma foto/URL de foto no DTO | `src/core/calendario/participants.ts`; `supabase/migrations/20261022042432_spec08_calendar_participants.sql` |
| Lacunas do evento | `description`, Meet/conferenceData, `etag`, recorrência, fuso original, permissão efetiva não fazem parte do DTO atual. Provider pede `accessRole`, mas descarta-o no mapeamento de calendários | `src/core/calendario/types.ts`, `service.ts`; `src/adapters/db/google-calendar-provider.ts` |
| Escrita Calendar | Contrato `CalendarProvider` só oferece exchange/profile/refresh/calendars/events/revoke. Comandos atuais: select/sync/disconnect/event.link. Nenhum create/update/delete remoto | `src/core/calendario/types.ts`, `service.ts` |
| Sincronização | Full/incremental por `syncToken`, paginação, reset em 410; limite local 8 páginas/20 mil eventos; janela padrão −45/+180 dias e máximo 730 dias; cache parcial explícito | `src/core/calendario/service.ts`; `src/adapters/db/google-calendar-provider.ts` |
| Scheduler | Rota autenticada e workflow diário descrito às 02:17 Fortaleza; execução hospedada atual NÃO foi conferida nesta análise | `src/app/api/cron/google-calendar/route.ts`; `.github/workflows/google-calendar-production.yml`; `docs/operations/google-calendar-scheduler.md` |
| Login | Supabase com senha/recovery, guards e sessão verificada; ausência de `signUp` e `signInWithOAuth` no runtime. `/auth/callback` é recovery, não callback social genérico | `src/lib/auth/runtime.ts`, `service.ts`, `ports.ts`; `src/app/auth/callback/route.ts` |
| Integrações | `/integracoes` renderiza apenas `CalendarIntegrations`; não há implementação ClickUp encontrada em `src` | `src/app/(workspace)/integracoes/page.tsx` |

**Atenção:** o diretório raiz `migrations/` é documental. Migrations executáveis versionadas ficam em `supabase/migrations/`; não inventar numeração nem editar as históricas.

## 3. Google Calendar — proposta técnica

**RECOMENDADO:** manter leitura como padrão. Pedir permissão adicional somente quando a pessoa escolher editar. Separar `granted_scopes` (o que Google concedeu), `connection_mode` (o que a pessoa autoriza no app) e `access_role` de cada calendário (ACL efetiva). Todos os três são verificados no servidor; esconder botão não é autorização.

Escopos mínimos planejados:

- Leitura: os quatro atuais.
- Leitura/edição em calendários permitidos: `openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events`.
- Se a decisão limitar a calendários próprios, avaliar `calendar.events.owned`; não pedir `calendar` amplo, que também dá poderes sobre calendários/compartilhamento. [Escopos oficiais](https://developers.google.com/workspace/calendar/api/auth).

Guardar `accessRole` e `conferenceProperties.allowedConferenceSolutionTypes`. Google distingue reader, writer, owner e também `writerWithoutPrivateAccess`; eventos privados podem continuar sem detalhes. Não presumir que o consentimento OAuth permite editar qualquer evento. [CalendarList](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList).

Estender o DTO e schema com descrição sanitizada, conference metadata estritamente necessária, link de reunião validado, `etag`, organizer/self, recurrence/recurringEventId/originalStartTime, timezone, capacidades e revisão local. Não armazenar payload bruto ilimitado. A API entrega descrição, convidados e videoconferência, mas **não foto de participante**; bolinhas devem usar iniciais quando não houver imagem legitimamente disponível. Não adicionar People API/contatos apenas para completar decoração. [Events](https://developers.google.com/workspace/calendar/api/v3/reference/events).

Criação/edição: validar início/fim, fuso IANA, evento de dia inteiro com fim exclusivo, convidados e calendário destino. Conferência Meet usa `conferenceDataVersion=1` e `conferenceData.createRequest.requestId` estável por intenção; respeitar disponibilidade do calendário e estado de criação pendente/falho. Convidados implicam envio real: confirmação antes de salvar e política de `sendUpdates=all`; `none` não é alternativa segura genérica, pois pode impedir atualização de agendas externas. [Insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert).

Concorrência: GET atual + `If-Match`/etag; 412 preserva rascunho e exige escolha, sem sobrescrita automática. Inserção usa ID válido e estável por intenção e consulta do resultado após timeout; não gerar novo ID a cada retry. Manter journal de operações `prepared/sent/confirmed/unknown/failed`, identidade e evento de domínio; sem transação distribuída fictícia entre Google e Postgres. [Versionamento oficial](https://developers.google.com/workspace/calendar/api/guides/version-resources).

Recorrências precisam de decisão de alcance: ocorrência, série inteira e “esta e próximas” têm comportamentos distintos; último caso pode exigir partir a série. Nunca representar várias ocorrências como eventos independentes sem vínculo. [Guia de recorrência](https://developers.google.com/workspace/calendar/api/guides/recurringevents).

Reutilizar sincronização incremental; tratar exclusões, invalidação 410, permissão revogada, paginação e alteração da janela. Mudança na projeção dos eventos exige estratégia para completar cache antigo (resync versionado), sem assumir que `syncToken` devolve campos novos de eventos inalterados. [Sincronização](https://developers.google.com/workspace/calendar/api/guides/sync).

Quotas por projeto/usuário e limites operacionais exigem fila, jitter e backoff em 403/429. A documentação mudou quotas em **01/05/2026**, com tratamento distinto para projetos antigos; obter valores do console antes de dimensionar, sem copiar números históricos. [Limites Google](https://developers.google.com/workspace/calendar/api/guides/quota).

## 4. Google Cloud / autenticação social — roteiro planejado

Não é necessário hospedar a aplicação no Google Cloud: a aplicação continua em sua hospedagem atual; Cloud fornece projeto/API/OAuth.

1. Inventariar, sem copiar segredos: projetos Google de produção/homologação, domínio canônico, client IDs e respectivos usos, projeto Supabase correspondente, APIs e quotas. O domínio canônico observado em documentação é `https://www.segundocerebroapp.com.br`; reconfirmar antes da execução.
2. Separar produção de QA. Habilitar Google Calendar API; não habilitar Gmail/Drive/People por conveniência.
3. Configurar Google Auth Platform: Branding (marca, suporte, homepage, Termos e Privacidade públicas), Audience externa para cadastro aberto, Data Access com os escopos exatos, contatos de manutenção e domínios verificados via Search Console.
4. Registrar cliente web para Calendar com callback **`${APP_URL}/api/calendar/oauth/callback`**. Em produção prevista: `https://www.segundocerebroapp.com.br/api/calendar/oauth/callback`. URLs exatas, sem wildcard e sem previews aleatórios.
5. Login Google: habilitar provider no Supabase. Callback registrado no cliente Google de Auth é **`${SUPABASE_URL}/auth/v1/callback`**, obtido no painel correspondente. O retorno Supabase→app deve ser uma nova rota social, proposta `/auth/social/callback`, allowlisted em Auth URL Configuration. Não substituir `/auth/callback`, que protege recovery.
6. Login pede identidade mínima (`openid/email/profile`) e não calendário. Após sessão válida: provisionamento idempotente do usuário novo, ciência das políticas, política de beta/trial, onboarding; existente preserva acesso e destino. Reusar PKCE SSR/cookies/guards e verificar identidade no servidor. [Supabase Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).
7. Mesmo e-mail verificado pode ser vinculado pelo Supabase à mesma identidade; testar colisões, senha existente, e-mail não confirmado e nova conta Google. Não mesclar dados de usuários por e-mail em SQL manualmente. Mudança de e-mail não muda `user_id`. [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).
8. Em Testing externo, há até 100 test users; autorização Calendar de teste expira em sete dias. Mudar para Production não equivale a aprovar scopes: submeter verificação de marca/scopes sensíveis, justificativas por recurso e vídeo demonstrando consentimento/uso/desconexão. Não prometer prazo ou ausência de avisos antes do resultado. [Audience](https://support.google.com/cloud/answer/15549945?hl=en), [tokens de teste](https://developers.google.com/identity/protocols/oauth2), [verificação sensível](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).
9. Conferir projeto e ambiente antes de gravar segredos no vault de hospedagem/Supabase, testar com contas QA, validar recusa parcial e reconexão; só então preparar liberação.

**Risco importante de revogação:** Google declara que `/revoke` remove os grants/tokens de todos os clientes do mesmo projeto para aquele usuário. Clientes OAuth separados no mesmo projeto NÃO isolam essa revogação. Recomendar projeto Auth separado do projeto Calendar se a desconexão Calendar precisar ser totalmente independente do consentimento de login; caso se mantenha projeto único, documentar/testar novo consentimento no próximo login. Isso não afirma encerramento imediato de uma sessão Supabase já emitida. [Revogação Google](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke).

**Manual:** propriedade de domínio, informações e contatos oficiais, consentimento e submissão/verificação, cadastro/conferência de redirects e clients, aprovação/aceite no provider, vault. **Automatizável após autorização:** habilitação de API por CLI/IaC, validação pública de URLs/headers, inventário sem segredos, teste de callbacks/scopes e monitoramento; código não pode alegar que automatizou aprovação Google.

### Variáveis e configurações

| Existentes, servidor | Uso |
|---|---|
| `APP_MODE`, `APP_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Ambiente/autenticação |
| `AUTH_STATE_SECRET`, `AUTH_RATE_LIMIT_SECRET` | Segurança de flows/limites |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | Calendar atual, não reutilizar silenciosamente para login |
| `GOOGLE_CALENDAR_STATE_SECRET`, `GOOGLE_CALENDAR_TOKEN_KEY`, `GOOGLE_CALENDAR_TOKEN_KEY_ID`, `GOOGLE_CALENDAR_TOKEN_KEYS` | State e cifragem/rotação |
| `GOOGLE_CALENDAR_CRON_SECRET`, `SC_GOOGLE_CRON_ALLOW_RUN`, `SC_GOOGLE_CRON_TIMEOUT_MS` | Rota/executor; variável GitHub `SC_GOOGLE_CALENDAR_SCHEDULER_ENABLED` governa scheduler |

Google social: client ID/secret cadastrados no provider Supabase, não requerem automaticamente novas variáveis do app. Flags de rollout propostas (não existentes): `GOOGLE_CALENDAR_WRITE_ENABLED`, `CLICKUP_INTEGRATION_ENABLED`. Preservar política server-only e não expor segredo em `NEXT_PUBLIC_*`.

## 5. Apple — pesquisa para fase posterior

Web exige Services ID, associação a App ID primário habilitado, domínios/return URLs e chave de assinatura; não é simplesmente adicionar botão. [Configuração Apple](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/). Programa Developer informa **US$ 99 por ano**, sujeito a preço regional/isenções; reconferir na contratação, que não está autorizada. [Adesão](https://developer.apple.com/programs/enroll/).

Provider Supabase suporta Apple; segredo OAuth web exige renovação no máximo a cada seis meses; nome não vem sempre e deve ser solicitado no onboarding se ausente. Considerar e-mail relay, vinculação de identidades e entrega SMTP ao relay. Não criar conta separada apenas por nome ausente. [Supabase Apple](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple).

## 6. ClickUp — proposta de integração

### Autorização e segurança

OAuth é o caminho oficial para integração usada por outras pessoas; token pessoal serve a uso individual/testes. Somente owner/admin cria app OAuth. Usuário autoriza um ou mais Workspaces. Auth code usa `https://app.clickup.com/api` e token exchange `https://api.clickup.com/api/v2/oauth/token`. A documentação informa token OAuth atualmente sem expiração: não inventar refresh token nem prazo fixo. [Autenticação](https://developer.clickup.com/docs/authentication).

**RECOMENDADO:** uma conexão ClickUp por usuário inicialmente, Workspaces selecionáveis; state de uso único vinculado a sessão, callback HTTPS proposto `/api/integrations/clickup/oauth/callback`, exchange apenas no servidor; token cifrado AES-GCM com chave independente, identidade do dono/conta e rotação. Sem persistência de token, conexão terminaria com sessão/processo e sincronização de fundo não funcionaria. Não oferecer token pessoal na UX pública salvo decisão explícita.

Ao desconectar: bloquear novos jobs/escritas imediatamente, remover webhooks remotos quando possível, eliminar token e cache privado conforme política, sinalizar pendência de limpeza se necessário. Não foi identificado endpoint público de revogação OAuth na documentação consultada; não prometer revogação remota automática. Orientar revogação nas configurações ClickUp e reconhecer token revogado na próxima chamada. [Erros oficiais](https://developer.clickup.com/docs/common_errors).

### Consulta e hierarquia

Identidade pelo `GET /api/v2/user`, sem confiar no e-mail informado. [Usuário autorizado](https://developer.clickup.com/reference/getauthorizeduser). Usar Workspace autorizado e `GET /team/{id}/task` com `assignees[]=id`, `subtasks=true`, `include_closed=false`, paginação desde zero; páginas até 100 tarefas e filtros de atualização. Não buscar todas as tarefas da equipe para filtrar no browser. [Consulta filtrada](https://developer.clickup.com/reference/getfilteredteamtasks).

“Concluída” precisa mapear tipos `done` e `closed`, não nomes traduzidos/customizados. `include_closed=false` sozinho não resolve toda a semântica de Done. Recomenda-se excluir ambos da fila ativa e preservar o contexto de hierarquia. [Tipos de status](https://developer.clickup.com/docs/filter-views), [Done](https://help.clickup.com/hc/en-us/articles/6309517280919-Use-Done-statuses).

Persistir espelho externo separado de `tasks` nativas; chave `(user_id, connection_id, workspace_id, remote_task_id)`, parent remoto, list/status types, campos essenciais e revisão remota. Evita duplicação, conclusão local divergente, disparo de retenção da lixeira e perda de semântica dos status. Fonte ClickUp claramente identificada na lista/detalhe; botão abrir original. Conteúdo remoto sanitizado, sem scripts/HTML arbitrário. Campos personalizados/anexos apenas leitura resumida ou link, sem edição irrestrita por “demais campos”.

### Escrita e conflitos

Status e descrição via `PUT /task/{id}`; consultar lista para status válidos. Atualizar só campos deliberadamente alterados. Custom fields têm endpoint próprio e ficam fora da primeira edição proposta. [Update](https://developer.clickup.com/reference/updatetask), [List](https://developer.clickup.com/reference/getlist).

“Mensagens” deve significar comentários da tarefa, não Chat/DM, até decisão contrária. `POST /task/{id}/comment`; `notify_all` não impede notificações a outros responsáveis/watchers. Mostrar claramente autoria e envio; preservar rascunho se incerto. [Comentários](https://developer.clickup.com/reference/createtaskcomment).

Sem CAS/If-Match documentado no Update Task consultado: comparar `date_updated`/hash dos campos após releitura, avisar conflito e enviar patch mínimo; isso reduz risco mas não garante ausência de corrida entre GET e PUT. Não alegar garantia serializável remota. Reconsulta após write e registro da operação; timeout de comentário NÃO gera retry cego, pois duplicaria publicação. Erro 401/revogado desconecta, 403 preserva rascunho e explica permissão, 404 remove espelho acessível, 429 agenda retry de leitura conforme cabeçalhos.

### Atualização de dados

Limites atuais por token/minuto: Free/Unlimited/Business 100; Business Plus 1.000; Enterprise/Enterprise Plus 10.000. Respeitar `X-RateLimit-*`, backoff e quotas por conexão. [Rate limits](https://developer.clickup.com/docs/rate-limits).

Incremental por `date_updated_gt` com janela sobreposta/deduplicação + reconciliação completa periódica. **Cuidado:** consulta apenas assignee/não concluídas não devolve tarefa que deixou de ser atribuída ou foi concluída; webhook/reconsulta por ID ou reconciliação precisa retirar esses espelhos. Cursor só avança após lote completo; IDs remotos como strings.

Webhooks se associam ao usuário e param quando perde acesso; usar eventos mínimos de tarefa/status/assignee/delete/move/comentário. Assinatura HMAC SHA256 `X-Signature` sobre bytes originais, segredo por webhook cifrado, resposta rápida e trabalho em fila; deduplicar por webhook/history item e reconciliar fora de ordem. Não usar allowlist de IP como prova. [Webhooks](https://developer.clickup.com/docs/webhooks), [assinatura](https://developer.clickup.com/docs/webhooksignature).

### Arquivos/estruturas propostos (ainda inexistentes)

- `src/core/integracoes/clickup/` contratos/casos de uso; adapters server-only próprios; rotas finas `/api/integrations/clickup/*`; feature independente consumida pela página de Integrações/Tarefas sem imports cruzados de features.
- Tabelas privadas de credentials, oauth_flows, sync_jobs, mutation_intents, webhook_receipts; tabelas públicas mínimas de connections/task_mirrors com RLS por usuário. Avaliar schema `app_private` antes de migração.
- Variáveis propostas `CLICKUP_CLIENT_ID`, `CLICKUP_CLIENT_SECRET`, `CLICKUP_STATE_SECRET`, `CLICKUP_TOKEN_KEY`, `CLICKUP_TOKEN_KEY_ID`, `CLICKUP_TOKEN_KEYS`; segredo de webhook é por registro, não um segredo global compartilhado. Não aplicar migrations até plano validado.

## 7. Lacunas essenciais para UMA rodada consolidada

Recomendações não são decisões tomadas. A raiz deve agrupar/encurtar conforme outras frentes; não perguntar valores que podem ser descobertos no console.

1. **Alcance da primeira edição Calendar:** incluir eventos avulsos, dia inteiro, convidados, descrição, Meet e cancelamento; recorrências também desde já? Recomendo avulsos completos primeiro e recorrentes só leitura/abrir no Google até etapa dedicada; alternativa: incluir ocorrência + série inteira agora, “esta e próximas” depois. Impacto: escopo e risco, não limitação de API.
2. **Avisos a convidados:** confirmar que salvar/cancelar eventos com participantes enviará atualização a todos, com aviso antes da ação. Recomendo esse comportamento explícito; não silencioso. Se produto permite não notificar, documentar limitações e evitar `none` como padrão.
3. **Subtarefas ClickUp fora da responsabilidade:** tarefa pai de outra pessoa, mas subtarefa minha: mostrar pai apenas como contexto, sem editar; subtarefas de outros ocultas por padrão? Recomendo só itens meus acionáveis, pai contextual somente se API permite, concluídos não acionáveis. Não importar toda equipe por consequência da hierarquia.
4. **ClickUp na experiência:** tarefas em seção própria dentro de Tarefas (com filtro de origem) ou feed misturado às nativas? Recomendo seção/filtro identificável, sem copiar para tarefas nativas; comentários da tarefa apenas, sem Chat/DM. Confirmar alcance de “mensagens”.
5. **Atualização esperada:** tolera atualização ao abrir/acionar sincronizar e em até cerca de 5 minutos, ou precisa quase imediata com webhook já no primeiro lote? Recomendo leitura/escrita inicial com atualização ao abrir e manual, seguida de worker/webhooks antes de prometer atualização contínua. Números são meta proposta condicionada a quotas/volume.
6. **Persistência da conexão ClickUp:** aprovar OAuth com token cifrado até desconexão para sync em fundo? Recomendo sim, uma identidade ClickUp com Workspaces selecionados, sem pedir API key. A alternativa sem guardar credencial exige reconectar e perde sync autônomo.

Não reabrir: e-mail/Google/Apple (respondido), preservação das gratuidades, beta após trial. Fotos de convidados não exigem pergunta se adotado fallback de iniciais já previsto. Domínio/clientes/chaves/SMTP são inventário operacional, nunca solicitar segredos no questionário.

## 8. Validação mínima planejada e sequência

1. **Auth/publicação Google (P0, L):** callbacks separados, consentimento mínimo, usuário existente/novo, e-mail não confirmado, cancelamento, state/PKCE inválidos, troca de dono, deep link, onboarding idempotente, conta bloqueada, linking e recuperação intacta. Provar em QA e em scopes realmente aprovados antes de liberar.
2. **Calendar DTO/leitura (P1, M):** cache legado e resync, descrição sanitizada, Meet ausente/presente, lista de convidados truncada/sem nomes, sem fotos inventadas, ACL privada, múltiplas contas, 410/429/revogação.
3. **Calendar escrita (P1, L/XL se recorrência):** readonly bloqueado em chamada direta, scope recusado, evento compartilhado sem direito, conflito 412, timeout incerto sem duplicar, DST/fuso/dia inteiro, criação Meet assíncrona, convite/cancelamento com efeito remoto e confirmação UI; revogação não destrói conta do produto.
4. **ClickUp conexão/leitura (P1, L):** isolamento 2 usuários, paginação >100, responsabilidade alterada, done/closed customizados, pai fora do escopo, subtarefa própria, tokens ausentes/revogados, desconexão e cache limpo.
5. **ClickUp escrita/sync (P1, L):** status permitido/negado, descrição concorrente, comentário confirmado versus incerto, duplicatas, callback/webhook fraudulento, eventos fora de ordem, 429, cursor parcial, perda de acesso. Oráculo remoto em conta de teste, sem usar tarefas pessoais para ensaio.

Critério transversal: build/testes locais não comprovam configuração de console, verificação Google ou efeitos remotos. Registrar separadamente implementado, testado local, validado conectado e pendente; nunca publicar “sincronização ativa” por um HTTP 200 sem eventos/contas de teste verificáveis.

## 9. Limitações desta pesquisa

- Não confirmei configuração real do Google Cloud, Supabase, ClickUp ou Vercel; documentação operacional do repositório pode refletir estado histórico.
- Changelog Supabase em `.md` foi consultado, mas o leitor web rejeitou seu MIME; páginas oficiais de Google/Apple/identity linking foram consultadas diretamente. Antes de implementar, reconferir changelog via ferramenta compatível e versões do lockfile.
- Não há benchmark nem teste conectado realizado. Estimativas são relativas: M < L < XL; aprovação de provedores não tem prazo garantido.
