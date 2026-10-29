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

## Rodada autenticada (29/10, produto `c6ebf212`, Preview `dpl_4qtnQLwcfGh7SzCHAK4ghSjkbi3o`)

Conta: a única do projeto de homologação (comum, sem Master), confirmada pelo responsável após o e-mail inicialmente informado não existir no Auth. Senhas e conteúdo de itens não foram gravados nem fotografados. Ferramenta: Chromium headless em nuvem; **não substitui aparelho real, zoom nativo nem leitor de tela**. Todos os valores abaixo são observações desta Source/ambiente.

### Cofre conectado (#126, J6 de #44)

Ensaio com os dois itens fictícios existentes (ambos do tipo Login; não há item "Nota segura", então esse ramo não foi exercitado). **PASS** em: abre bloqueado sem itens; senha mestra incorreta recusada; desbloqueio; máscara inicial com `aria-pressed=false`; revelar mostra o valor, o rótulo vira Ocultar e `aria-pressed=true`; revelar não copia (área de transferência intacta) e não gera requisição; ocultar volta à máscara; teclado (foco visível, Enter e Espaço); revelado + trocar de item deixa o novo item mascarado e voltar não reabre; copiar entrega o valor e a área é limpa em ~30 s; blur da janela bloqueia e remove o valor do DOM; re-desbloqueio não revela; aba oculta bloqueia; Bloquear Cofre limpa o DOM; recarregar volta bloqueado e os 2 itens persistem mascarados; **nenhuma das 117 requisições contém a senha mestra nem o valor do item**; zero erros de console. Alvo do botão 54 × 44 px; sem overflow em 320, 390 e 1440 px; contraste do valor 18,13:1 no claro e 16,01:1 no escuro (tokens do tema escuro aplicados por atributo, sem gravar preferência); rótulo e ícone ≥ 8,43:1. Bloqueio por inatividade: aberto em 4:30 e bloqueado em 5:15 com relógio simulado. Após logout em outra aba, a aba com valor revelado bloqueou e `/cofre` passou a exigir login. API do Cofre indisponível (500): mensagem e "Tentar de novo" recuperam.

**Banco após o ensaio (somente metadados):** 2 itens, versão 1, `updated_at` de 27/10, sem exclusão. Surgiram 10 eventos `vault_metadata` `updated` (bloqueio/desbloqueio) com apenas as chaves `id`, `occurred_at`, `operation`, `user_id`, `version`, sem payload.

**Achado:** desbloquear com a rede desligada exibe "Não foi possível abrir ou proteger os dados. Confira a senha e as duas metades do kit", a mesma mensagem da senha errada. A causa de rede fica indistinguível. Não corrigido.

**Não cobertos:** resposta antiga renderizada após troca de sessão (exige teste de componente), troca de identidade, e a afirmação de que revelar não renova o timer de inatividade (não medida isoladamente).

### Telas do workspace (leitura)

13 rotas (Início, Capturar, Tarefas, Calendário, Conhecimento, Projetos, Hábitos, Financeiro, Cofre, Atividade, Integrações, Configurações, Ajuda) × 320/390/768/1024/1440 px × claro/escuro = 130 medições: todas com status 200, sem redirecionamento, **zero overflow horizontal, zero campo abaixo de 16 px, zero alvo abaixo de 44 px, um `h1` por tela, zero erros de console ou de página**, sem imagem sem `alt`. O varredor sinalizou 4 botões sem nome acessível; são falsos positivos (`Arquivo`, `Registrar pausa`, `Registrar dia`, `Marcar um dia passado` têm texto no DOM). `/onboarding` (estado concluído): 10 medições limpas. Calendário foi aberto sem disparar sincronização (`calendar_sync_runs` seguiu em 2). O tema escuro foi aplicado trocando o atributo da página, não a preferência da conta.

### Estados adversos

Sem sessão: `/tarefas` redireciona ao login; `/api/vault` e `/api/settings` respondem 401. Usuário comum em `/admin`: 404. Rota inexistente: 404 com mensagem. Offline com service worker no controle: fallback "Não foi possível carregar o Segundo Cérebro" com "Tentar novamente". Captura com título e sem rede: texto preservado, "Rascunho salvo neste navegador", "Há um envio para confirmar" e "O resultado ainda não foi confirmado"; fechado o contexto offline, nada foi reenviado e o banco não ganhou captura nem página. Sem service worker (primeira visita), a navegação offline cai na página de erro do navegador.

### Onboarding e retenção hospedada (#62)

Criada **uma rodada sintética** `5fcb8f03…` pela interface (Configurar outra vez → Começar nova rodada), pausada com "Fazer depois" sem confirmar nada: pausar não criou projetos, hábitos, tarefas, capturas nem páginas (contagens iguais antes e depois), e a expiração ficou em exatamente 720 h após a edição. Recarregar ofereceu "Retomar". Para obter o cenário vencido, **apenas essa linha foi envelhecida por UPDATE direto** (`edited_at` −721 h, `expires_at` −1 h); o aging é manipulação de relógio de teste, não passagem real de tempo, e as demais rodadas não foram tocadas. Antes do tick: `dueCount=1`, `expiredPayloadCount=1`. No tick autônomo de **03:45:00 UTC** o job `sc-onboarding-retention-v1` visitou 1 e limpou 1 (`lastCode=OK`, `failed=0`, 133 ms): a rodada ficou `expired`, sem rascunho, as outras 4 `complete` e as entidades seguiram intactas, `expiredPayloadCount=0`, `residualPermitCount=0`. A interface passou a exibir "O prazo deste rascunho terminou. Seus registros já confirmados foram preservados." O job executou também em 03:15 e 03:30, todas `succeeded`.

**Não feito:** a **matriz Main HTTP de 64 passos** exige duas identidades isoladas e o operador do pacote inerte; o projeto tem uma só conta e criar contas está fora da autorização. O fluxo de nove telas com confirmações (Hábito, Projeto, Tarefa, vínculos) não foi percorrido: nesta rodada só a etapa inicial, retomada e pausa foram exercitadas, para não criar registros na conta QA. Zoom nativo, aparelhos, leitor de tela e aceite humano #44 seguem pendentes.
