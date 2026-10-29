# Retomada dos aceites do MVP — 29/10/2026

Continuação do [handoff de 28/10](handoff-retomada-20261028-mvp.md) e do [registro de aceites doc18](aceites-conectados-doc18-20261027.md). PR #120 permanece em rascunho; merge e deploy de produção seguem bloqueados. Restore, checkout Asaas e novo Drive estão fora do recorte. Este registro **não altera produto, migrations, SDKs, Cron nem configuração de Vercel/Supabase**: as consultas abaixo foram somente leitura.

## Base conferida

- HEAD da PR no início da retomada: `e04ee04c2ac049c8d2b708266278331f634b6a32` (documental sobre `2169354`; produto inalterado desde `c6ebf212…`).
- Checks do HEAD `e04ee04`: leitura inicial com 23 de 25 jobs em `success` e 2 jobs "Fundação" em andamento. Releitura posterior: o CI de [push (run 666)](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40806413743) e o de [PR (run 667)](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40806418599) terminaram com conclusão `success`, attempt 1. É um delta somente documental sobre `2169354`; não altera o produto `c6ebf212`. Os commits desta retomada na branch `claude/dreamy-cori-fkltl0` (`4e255d1`, `9e28340` e o seguinte) são documentação e SQL operacional fora de CI e herdam o produto sem alterá-lo; seus runs são próprios e não foram aguardados até o fim.
- Preview `dpl_4qtnQLwcfGh7SzCHAK4ghSjkbi3o`: `READY`, branch `codex/homologacao-twry-20261022`, SHA `c6ebf212…`, sem alvo Production. Nenhum deploy novo foi feito.
- Supabase: a conexão enxerga apenas o projeto `twrydxsdemaykgvdlpyd`. O histórico de migrations contém `m001`–`m027`, sem divergência com o catálogo do repositório. Nada foi aplicado.

## Cofre conectado (#126, #62–65 relacionadas ao QA)

**Validado por metadados (independente do relato do responsável):** o banco de homologação tem 1 registro em `vault_master_keys` e 2 em `vault_items`. `domain_events` registra `vault_metadata` com 3 `created` e 2 `updated`, canal `web`, entre 27/10 23:24:20 e 23:25:34 UTC. Os payloads têm apenas chaves de envelope (`envelope`, `version`, `created_at`, `updated_at`, `deleted_at`, `id`, `user_id`; no mestre, `master`, `recovery`, `consent_at`, `schema_version`). Nenhum valor de payload foi lido ou copiado.

**Pendente / bloqueado:** o aceite conectado de abrir/bloquear, revelar/ocultar, troca de item, perda de foco/visibilidade e persistência exige uma sessão de navegador logada e desbloqueada na conta QA. Esta sessão em nuvem não tem essa sessão nem pode obter a senha mestra ou o kit, que não devem ser solicitados. Nenhum critério da #126 foi marcado como aprovado. O ensaio precisa ser feito pelo responsável ou por um agente com o navegador dele já aberto e desbloqueado por ele.

## Retenção hospedada de 720h (#62)

**Observado, somente leitura:**

- `app_private.onboarding_retention_sweep()` e `onboarding_retention_health()` existem no projeto de homologação.
- `pg_cron` **não está instalado** e não existe o schema `cron`. Não há agendador para o sweep no repositório nem no banco.
- O estado do health é todo nulo: `lastStartedAt`, `lastCompletedAt`, `lastCode`, `visited`, `cleaned`, `skipped` e `failed`. `dueCount`, `expiredPayloadCount` e `residualPermitCount` são 0.
- As 4 rodadas de onboarding existentes estão `complete`, sem rascunho, com expiração entre 22/11 e 25/11/2026. Nenhuma está vencida.

**Conclusão:** a retenção autônoma hospedada **não está ativa nem comprovada**. O sweep foi entregue como componente inerte. A migration 026 declara que a remoção física exige um sweep nativo ativo e medido, e esse agendador não existe. Os testes R01–R07 do CI provam a função em PostgreSQL descartável, não execução autônoma no projeto de homologação.

**Atualização após autorização do responsável (29/10, mesma data):** o responsável autorizou a recomendação de versionar e aplicar o agendamento sob supervisão. Os scripts [`onboarding-retention-schedule.sql`](../../supabase/operations/onboarding-retention-schedule.sql) e [`onboarding-retention-unschedule.sql`](../../supabase/operations/onboarding-retention-unschedule.sql) ficam em `supabase/operations/`, **fora da cadeia canônica de migrations de propósito**: o CI aplica todas as migrations em PostgreSQL descartável sem `pg_cron`, e `supabase/manual/` exige ROLLBACK final. O script de agendamento foi aplicado por `execute_sql` apenas no projeto `twrydxsdemaykgvdlpyd`, sem registro no histórico de migrations, que continua em `m001`–`m027`. Ele cria a extensão `pg_cron` e o job `sc-onboarding-retention-v1`, `*/15 * * * *`, dono `postgres`, ativo. Não foram expiradas fixtures nem executado o sweep manualmente. Production não foi tocada e não tem agendamento.

**Execução autônoma observada:** o job rodou sozinho em 29/10 às 03:00:00 UTC (`cron.job_run_details`: `succeeded`, 1 linha). O health passou a `lastCode=OK`, `visited=0`, `cleaned=0`, `failed=0`, `durationMs≈1,7`, `dueCount=0`, `expiredPayloadCount=0`, `residualPermitCount=0`. Isso comprova agendamento, execução autônoma pelo papel `postgres` e saúde mensurável no projeto de homologação. **Não comprova a remoção física de um payload vencido no ambiente hospedado**, porque não há rodada vencida (a primeira expira em 22/11) e as fixtures não foram expiradas; essa remoção segue coberta apenas por R01–R07 em PostgreSQL descartável. Critério #62 de "cenário vencido determinístico" continua pendente. Cada execução futura soma uma linha em `cron.job_run_details` (96 por dia), sem limpeza automática.

## Inventário de variáveis (nomes e escopos; valores não lidos)

- Production tem `APP_MODE`, `APP_URL`, `ADMIN_COMMAND_SECRET`, `AUTH_RATE_LIMIT_SECRET`, `AUTH_STATE_SECRET`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GOOGLE_CALENDAR_STATE_SECRET`, `GOOGLE_CALENDAR_TOKEN_KEY`, `GOOGLE_CALENDAR_TOKEN_KEY_ID` e `GOOGLE_CALENDAR_CRON_SECRET`.
- **Production não tem `GOOGLE_OAUTH_CLIENT_ID` nem `GOOGLE_OAUTH_CLIENT_SECRET`.** Isso confirma o recadastro adiado pelo responsável e é pré-requisito do corte. Elas existem somente em Preview.
- `FINANCE_GOALS_V1_ENABLED` e `FINANCE_GOALS_IMAGES_V1_ENABLED` existem somente em Preview, na branch de homologação. Production não as tem. Decidir se a release deve habilitá-las é um item do corte, não inferido do Preview.
- `GOOGLE_CALENDAR_CRON_SECRET` existe em Production e não em Preview.

## Estado dos aceites, por critério

| Aceite | Estado | Observação |
|---|---|---|
| Cofre conectado (#126) | Bloqueado | Falta sessão desbloqueada do responsável; metadados no banco consistentes. |
| Main HTTP de onboarding (#62, #63, #80) | Pendente | Pacote continua inerte; nenhum operador, HTTP ou SSO executado. Exige canal protegido da Vercel e janela própria. |
| Retenção hospedada (#62) | Parcial | Agendamento e execução autônoma comprovados na homologação; remoção de payload vencido hospedado e cenário vencido determinístico pendentes. |
| Responsividade, zoom nativo, dispositivos, estados adversos (#44, #81, #12) | Pendente | Exigem navegador/aparelho real. Capturas de ambiente em nuvem não certificam aparelho. |
| Migrations / compatibilidade | Conferido | `m001`–`m027` presentes; nada reaplicado. |
| Variáveis Google em Production | Pendente | Duas ausentes, conforme acima. |
| CI do HEAD `e04ee04` | Concluído | Push e PR `success`, attempt 1. |
| Rede do ambiente | Bloqueio | O proxy de saída responde 403 ao host do Preview; navegador, Main HTTP e provas de dispositivo não rodam daqui. Liberar o domínio em Network access do ambiente. |
| Advisors Supabase (segurança) | Observado | 36 INFO de RLS sem policy em tabelas privadas (desenho) e 1 WARN: proteção contra senhas vazadas desativada no Auth. Avaliar o WARN antes do corte. |
| Erros de runtime do Preview | Observado | Nenhum nos últimos 3 dias. |

## Decisões que cabem ao responsável

1. Como o Cofre será exercitado: o responsável conduz a sessão desbloqueada, ou abre o navegador dele para um agente com acesso a essa sessão.
2. Como a retenção será ativada no projeto de homologação, com migration versionada e aplicação supervisionada ou outro canal, antes de qualquer prova de execução autônoma.
3. Se o Main HTTP pode usar o link de compartilhamento de 23h da Vercel, que torna o Preview acessível a quem tiver a URL.
4. Quando recadastrar as duas variáveis Google em Production.

Nenhum desses itens foi decidido ou executado por esta retomada.

## Rodada com rede liberada (29/10, produto `c6ebf212`, Preview `dpl_4qtnQLwcfGh7SzCHAK4ghSjkbi3o`)

O responsável liberou a rede, autorizou o login na conta de teste e a conduta dos ensaios com dados sintéticos, e informou a senha mestra do Cofre. A senha não foi gravada em arquivo, log ou commit.

**Login: não realizado.** Com o e-mail informado (`kauan.bara15@gmail.com`) o Preview respondeu "Não foi possível entrar". Esse e-mail não existe em `auth.users` da homologação: o único usuário é a conta comum QA com e-mail diferente, dona do Cofre (1 chave-mestra, 2 itens, papel `user`, sem Master). O nome do projeto Supabase contém o e-mail informado, o que sugere confusão com o dono do projeto. Uma segunda tentativa com o outro e-mail foi bloqueada pelo controle de permissões, porque o e-mail não foi fornecido pelo responsável. **Nenhum ensaio autenticado, incluindo o Cofre, foi executado.** Pendente de confirmação do e-mail correto.

**Responsividade das páginas públicas (sem login):** `/entrar`, `/conheca`, `/privacidade`, `/termos-de-servico` e `/recuperar-senha` em 320, 390, 768, 1024 e 1440 px, temas claro e escuro, Chromium headless: 50 combinações. Sem overflow horizontal, sem campo abaixo de 16 px, status 200 e um único `h1` em todas, e `data-theme` aplicado conforme o esquema. Único achado: em `/conheca`, a partir de 1024 px, os botões de aba "Projetos" e "Kanban" medem cerca de 42 px de altura (CSS declara `min-height: 44px`). A causa observada é a escala do contêiner `conheca-capitulo__tela` (0,94 a 0,96 durante a rolagem, animação de entrada), que reduz o alvo efetivo. Não corrigido: a animação vem do protótipo e a decisão entre manter ou limitar a escala é do responsável. Chromium headless não substitui aparelho real, zoom nativo nem leitor de tela.
