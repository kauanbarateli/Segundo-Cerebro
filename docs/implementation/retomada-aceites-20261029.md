# Retomada dos aceites do MVP — 29/10/2026

Continuação do [handoff de 28/10](handoff-retomada-20261028-mvp.md) e do [registro de aceites doc18](aceites-conectados-doc18-20261027.md). PR #120 permanece em rascunho; merge e deploy de produção seguem bloqueados. Restore, checkout Asaas e novo Drive estão fora do recorte. Este registro **não altera produto, migrations, SDKs, Cron nem configuração de Vercel/Supabase**: as consultas abaixo foram somente leitura.

## Base conferida

- HEAD da PR no início da retomada: `e04ee04c2ac049c8d2b708266278331f634b6a32` (documental sobre `2169354`; produto inalterado desde `c6ebf212…`).
- Checks do HEAD: 25 check runs; 23 `success` e 2 jobs "Fundação" ainda `in_progress` na última leitura. Resultado terminal pendente; não equivale a CI verde.
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

**Não feito, por decisão que cabe ao responsável:** habilitar `pg_cron` e agendar o sweep seria mudança de infraestrutura do banco fora de migration versionada (OP-009), e a escolha entre `pg_cron` e outro canal não está registrada. Também não foram expiradas fixtures nem executado o sweep manualmente, para não forçar uma aprovação artificial.

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
| Retenção hospedada (#62) | Pendente / sem agendador | Ver seção acima. |
| Responsividade, zoom nativo, dispositivos, estados adversos (#44, #81, #12) | Pendente | Exigem navegador/aparelho real. Capturas de ambiente em nuvem não certificam aparelho. |
| Migrations / compatibilidade | Conferido | `m001`–`m027` presentes; nada reaplicado. |
| Variáveis Google em Production | Pendente | Duas ausentes, conforme acima. |
| CI do HEAD | Parcial | 23/25 `success`; 2 jobs "Fundação" em andamento. |

## Decisões que cabem ao responsável

1. Como o Cofre será exercitado: o responsável conduz a sessão desbloqueada, ou abre o navegador dele para um agente com acesso a essa sessão.
2. Como a retenção será ativada no projeto de homologação, com migration versionada e aplicação supervisionada ou outro canal, antes de qualquer prova de execução autônoma.
3. Se o Main HTTP pode usar o link de compartilhamento de 23h da Vercel, que torna o Preview acessível a quem tiver a URL.
4. Quando recadastrar as duas variáveis Google em Production.

Nenhum desses itens foi decidido ou executado por esta retomada.
