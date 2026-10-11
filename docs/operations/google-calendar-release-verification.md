# Conferência Google e operação — 11/10/2026

## Correções locais de revogação e cron

A desconexão ocultava o conteúdo e criava a fence antes da chamada Google, mas o adapter tratava qualquer HTTP 400 ou 2xx como confirmação de revogação. Isso permitia finalizar a exclusão da credencial cifrada depois de uma recusa do provedor. Agora somente HTTP 200 permite `finishDisconnect`; 201, 204, 400, falhas de transporte e outros estados preservam a operação pendente para revisão/retomada. O corpo de erro Google não é lido nem refletido nessa decisão.

Regra oficial consultada em 11/10/2026: “If the revocation is successfully processed, then the HTTP status code of the response is `200`.” A mesma seção define HTTP 400 como erro. [Google OAuth — token revocation](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke). O ACK 200 confirma o processamento pelo provedor; não afirma propagação instantânea da revogação em todas as APIs.

`readGoogleCalendarConfig` também recusa `GOOGLE_CALENDAR_CRON_SECRET` igual a `CRON_SECRET`, aplicando a separação já exigida pelo [executor Google](examples/google-calendar-cron.md). A rota e o executor não ganham fallback entre os dois segredos.

Os testes usam o provider, a cifra AES-GCM, o Núcleo e o repository originais, com transporte HTTP e RPC injetados. Comprovam que HTTP 400 não chama `finish_disconnect`, que o retry com HTTP 200 finaliza uma vez e que 201/204/400/503 não são ACK. Não executam OAuth, SQL hospedado, cron, chamadas Google reais nem escrita de eventos.

Validação do recorte: **67/67 testes Vitest** em `calendar-security-provider`, `calendar-runtime` e `core/calendar`; lint dos três arquivos alterados e TypeScript integral sem emissão aprovados. A primeira tentativa Vitest foi recusada pelo cache Temp do sandbox antes de importar os testes; a repetição pura fora desse Temp passou. Não é evidência de CI ou release.

## Dependências para o aceite real

Conferência local em 11/10/2026, somente presença booleana em `.env.local` e ambiente do processo: as seis variáveis Google obrigatórias estavam ausentes. O destino Supabase consultado correspondia ao projeto pessoal. Isso não informa os valores, validade das credenciais ou configuração atual da Vercel.

| Frente | Pré-requisito externo e próxima prova |
| --- | --- |
| Google — #32 | Cliente OAuth pessoal, seis variáveis de servidor e duas contas autorizadas. Executar consentimento PKCE/escopos, recusa da terceira conta, sincronização de leitura e expansão da janela; conferir desconexão/ACK sem criar eventos Google. Seguir o [runbook do módulo](../implementation/t025-calendario-google.md). |
| Cron Google — #32 | Conferir segredo independente, scheduler pessoal e duração real antes de ativar recorrência. O exemplo permanece fora de `.github/workflows`; configuração ou resposta de zero contas não comprova sincronização real. [Executor e recuperação de resultado incerto](examples/google-calendar-cron.md). |
| Backup/restore — #35 | Destino privado fora de sincronização, chave/perfil dedicados, ferramentas PostgreSQL e alvo descartável autorizado. As quatro variáveis consultadas de destino/chave/pg_dump/ref do restore também estavam ausentes localmente; um perfil operacional externo pode existir sem ser examinado aqui. Executar janela de quietude, backup agendado e restore que abre o Cofre, conforme [runbook existente](backup-restore-release.md). Nenhuma tarefa ou backup foi ativado nesta conferência. |
| PWA e jornadas — #12/#35 | Registrar instalação em Android/iOS reais e seis jornadas em desktop/iPhone, acessibilidade e auditoria Impeccable final. Emulação de viewport e CI não comprovam instalação física. |

Ausência de configuração local não autoriza usar BlackSheep/VOE, extrair tokens de conexões, pedir senhas pelo chat ou apagar uma claim sem prova de término das operações. Este registro prepara a execução; não encerra as issues #32/#35/#12.
