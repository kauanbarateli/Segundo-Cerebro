# T025 — Calendário Google

Implementação local concluída, sem conexão Supabase ou Google. A migration `20261009160158_google_calendar.sql` foi versionada para aplicação manual posterior. Nenhum OAuth, token, chamada HTTP com credenciais reais, cron remoto, build ou navegador foi executado pelo responsável deste módulo.

## Entrega

Núcleo puro em `src/core/calendario`; portas injetáveis e operações de conexão, seleção, sincronização, desconexão e vínculo com captura. Adapters `google-calendar-{security,provider,runtime,http}.ts` isolam cifra, PKCE, transportes fixos, quotas, contrato RPC planejado e guards HTTP. O contrato planejado não modifica tipos gerados como se a migration já estivesse aplicada.

Rotas: GET/POST `/api/calendar`, POST `/api/calendar/oauth/start`, GET `/api/calendar/oauth/callback`, GET/POST `/api/cron/google-calendar` e GET `/api/calendar/admin-runs`. Mutação comum exige Origin, cookie atual, ExpectedUser e calendario permitido antes de corpo/adapter. Callback externo usa estado/cookie e sessão verificados; os retornos usam origem configurada e notices fechados, nunca dados do Google. O cron confere bearer próprio antes de configuração, corpo, SDK ou listagem de proprietários. Admin exige master/admin primeiro e só retorna os nove campos de execução.

A interface mantém dia/semana/mês, lista mensal mobile, fim exclusivo dos eventos de dia inteiro, intervalos de vários dias e deep link por UUID estável. Controles conectam/reconectam até duas contas, selecionam calendários e sincronizam o período. Navegar para período não coberto solicita expansão uma vez; em falha há recuperação manual. O callback completa somente a conexão e devolve a agenda para iniciar essa sincronização, evitando uma longa série de páginas no retorno OAuth. Há nota de reunião via captura existente/criada, RelatedPanel e link externo Google restrito. Comandos públicos passam pelo journal compartilhado; código, URL OAuth, cookie, token e claim nunca passam por ele. As consultas ativas são atualizadas também após falha de desconexão, para retirar conteúdo já protegido pela fence.

As preferências de visão/lembrete vêm do perfil. Lembretes somente na sessão visível do app, sem notificação de sistema nem novo consentimento; não consultam agenda oculta/vetada e são limpos ao sair. Não é promessa de entrega em segundo plano ou com navegador fechado.

## Configuração manual posterior

1. Revisar/aplicar a cadeia SQL no projeto explicitamente configurado; confirmar os catálogos e executar os testes rollback em base dedicada vazia. Nunca rodar fixtures em banco com usuários reais.
2. No Google Cloud, habilitar Calendar API, configurar consentimento OAuth e criar cliente Web. Registrar exatamente `APP_URL` + `/api/calendar/oauth/callback` como redirect URI. Usar test users enquanto o aplicativo estiver em teste; verificar exigências do consentimento/publicação para os escopos solicitados. [Guia oficial](https://developers.google.com/identity/protocols/oauth2/web-server), [escopos Calendar](https://developers.google.com/workspace/calendar/api/auth).
3. Configurar apenas no servidor: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`; `GOOGLE_CALENDAR_STATE_SECRET` com pelo menos 32 bytes UTF-8; `GOOGLE_CALENDAR_TOKEN_KEY` base64 canônico de 32 bytes aleatórios; `GOOGLE_CALENDAR_TOKEN_KEY_ID` (1–32 caracteres); opcional `GOOGLE_CALENDAR_TOKEN_KEYS` JSON com até cinco identificadores antigos/chaves base64; `GOOGLE_CALENDAR_CRON_SECRET` com pelo menos 32 bytes. Estado, cifra, cron e segredos Auth/Admin devem ser distintos. Não usar prefixo NEXT_PUBLIC.
4. Publicar com HTTPS e cookies Secure. Agendar diariamente `/api/cron/google-calendar` com `Authorization: Bearer <segredo próprio>` em um scheduler que preserve o header; não colocar segredo na URL nem chamar HTTP Google no browser. A execução é limitada a 200 contas elegíveis; rever capacidade antes de ampliar esse limite.
5. Conectar uma conta de teste, conferir os escopos concedidos e escolher fontes. Não existe fallback de demonstração no modo conectado.

Limites explícitos: janela unificada até 730 dias, fontes Google até quatro páginas/1.000 entradas, eventos até oito páginas/20.000 entradas por fonte, transporte 20 segundos e 8 MiB por resposta. OAuth: cinco inícios/10 min, sync: seis novas execuções/10 min, HTTP/API: 60/min por proprietário. Quando excedidos, o app recusa com recuperação; não declara dados completos.

## Recuperação operacional

`revocation_pending`: conteúdo permanece removido. Retomar desconexão repete revogação com o segredo cifrado, confirma exclusão e então elimina esse segredo. Se a configuração de cifra/Google estiver ausente, corrigir configuração antes de retomar. Não mudar status para connected por SQL para contornar falha.

Uma execução de sync `running` com `app_private.google_sync_executions.execution` preenchida não tem lease expirada. Se processo/timeout/permissão interromperem o pedido, confirmar que todas as chamadas HTTP anteriores terminaram e que nenhum processo pode continuar; só depois um operador pode registrar falha e limpar a claim privada na mesma transação dedicada. Sem essa prova, preservar running/claim. Nunca expor essa UUID ao browser ou reutilizá-la para uma segunda execução concorrente. Uma nova sincronização usa outra identificação; revisões protegem commits antigos. Reconectar com outra conta Google não substitui silenciosamente a identidade anterior.

## Evidência local e pendências

Vitest focado: testes puros com fakes, AES-GCM/rotação, HMAC/PKCE/expiração, grants reais/alias, paginação/410/cursor, DTO proprietário, guards OAuth/cron/Admin, markup real React e projeções. Todos os transportes são injetados. `supabase/tests/calendar-{catalog,behavior}.sql` especificam grants/RLS, dono cruzado, state replay, claims/revisões, seleção em Relacionados, reset/nota preservada, rollback de evento e desconexão. O ensaio SQL local da cadeia é feito pelo integrador e deve ser registrado separadamente; esses arquivos não comprovam PostgreSQL remoto, concorrência real ou revogação Google.

Verificado em 2026-10-09: 99/99 Vitest em sete arquivos; lint do recorte e checagem TypeScript sem emissão. O ensaio descartável PGlite do integrador instalou as 14 migrations e passou os dois arquivos Calendar. Ele encontrou e permitiu corrigir precedência de subtração de chaves JSONB e aliases SQL conflitantes com records PL/pgSQL. Nenhum erro foi contornado desativando o catch de produção ou os guards. A revisão independente acrescentou o marcador HTTP SESSION_CHANGED e a interrupção de respostas próprias de OAuth/Admin ao sair, impedindo redirects e metadados tardios.

E2E preparado em `tests/e2e/calendar-google.spec.ts`; não executado neste trabalho. Após configuração: testar duas contas/terceira recusada; retorno adulterado/expirado/repetido e troca de sessão; consentimento negado; falta de refresh token; expansão mês/semana/dia; páginas incompletas/410; evento de três dias em ambos os fusos do processo; seleção refletida no Início/lembretes/Related; nota criada com falha posterior no vínculo sem duplicar captura; desconexão com HTTP incerto; veto/moderação durante sync; Admin sem conteúdo. Capturar 390/1440 claro/escuro, teclado, contraste e títulos longos. As referências antigas não certificam a interface nova.
## Integração final da raiz — 09/10/2026

Os resultados e restrições de execução descritos acima pertencem ao checkpoint individual do agente deste módulo. A raiz estava autorizada a compilar e testar e concluiu a integração: 1.427 testes em UTC e São Paulo, 57 testes Node, 14 migrations e 29 asserções em PostgreSQL descartável, catálogo1242 e **168 E2E Chromium**. O portão Impeccable passou com zero registros. Detalhes, auditoria visual e limites estão na [validação final](t028-validacao-final.md).

Asserções de comportamento/fixtures são somente para **base dedicada vazia**, com rollback e verificação de resíduos; não executar sobre contas reais. No projeto pessoal, a revisão estrutural usa o catálogo readonly. Nenhuma migration nova foi aplicada remotamente. Banco/Storage/Google/SMTP, concorrência real, aparelhos e backup/restore seguem na [entrega e pendências](entrega-mvp-pendencias.md). Teste de demonstração não comprova o módulo conectado.
