# Executor externo do cron Google — preparação manual

Este exemplo mantém a autorização própria do Calendário. Não cria scheduler, workflow ativo, segredo ou integração; não altera a rota Google nem executa SQL. A migration 015 foi informada como aplicada pelo mantenedor, mas isso não comprova cron, catálogo/grants ou Google reais. OP-012 conserva a separação entre preparar ferramentas e executar operações remotas. Consulte o [guia de manutenção](../scheduled-maintenance.md).

A Vercel envia automaticamente `CRON_SECRET` nos cron jobs do projeto; a rota `/api/cron/google-calendar` exige `GOOGLE_CALENDAR_CRON_SECRET`. Não igualar esses valores nem acrescentar fallback de autorização. O executor envia somente o Bearer próprio da rota, por HTTPS e sem seguir redirects. [Autorização Vercel](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).

## Contrato do operador

O [executor Node](../../../scripts/operations/google-calendar-cron.mjs) usa somente bibliotecas nativas. Não lê `.env`, arquivos de configuração, tokens do Supabase ou SDK; não instala dependências. Funções importadas recebem o ambiente explicitamente. Quando chamado como CLI, recolhe somente os cinco nomes abaixo do ambiente do processo; não modifica o ambiente global nem depende do diretório atual para configurar adapters.

| Variável | Regra |
| --- | --- |
| `APP_URL` | Origem HTTPS de produção `https://segundo-cerebro-of.vercel.app`, sem credenciais, caminho extra, query ou fragmento. O endpoint enviado é fixo. |
| `GOOGLE_CALENDAR_CRON_SECRET` | Valor privado igual ao configurado na rota Google; pelo menos 32 bytes UTF-8, sem controles ou normalização pelo header. Bearer completo limitado a 1.024 caracteres. Nunca aparece em argv, URL, corpo, saída ou arquivo deste exemplo. |
| `SC_GOOGLE_CRON_ALLOW_RUN` | Para `run`, exige literalmente `rishenjoikgmfubmnfiu`; `YES`/`true` não autorizam. |
| `CRON_SECRET` | Opcional, somente se já estiver disponível no ambiente privado do operador: recusa igualdade com o segredo Google. Não transferir a chave da limpeza para outro serviço só para executar esta comparação. A separação dos valores deve ser conferida pelo operador. |
| `SC_GOOGLE_CRON_TIMEOUT_MS` | Opcional; inteiro de 1 a 30.000. Padrão **RECOMENDADO**: 30.000 ms para a entrega HTTP e leitura completa da resposta; não define a duração da função hospedada. |

Cadastre o segredo no mecanismo privado do scheduler/operador. Não cole valores no terminal, chat, parâmetros de workflow ou argumentos. Use um ambiente dedicado ao processo, separado do VOE/BlackSheep e do perfil de backup. Não carregar `.env.local` automaticamente.

Estes comandos contêm somente o nome da operação; preparar o ambiente privado é uma etapa separada:

```sh
node scripts/operations/google-calendar-cron.mjs --help
node scripts/operations/google-calendar-cron.mjs check
```

`check` valida configuração sem rede e informa se o opt-in literal está presente. Importar o módulo ou solicitar ajuda também não faz rede. Somente após autorização e conferência de OAuth, projeto e capacidade, o operador pode executar:

```sh
node scripts/operations/google-calendar-cron.mjs run
```

`run` faz **um único GET** para o endpoint fixo, sem cookie, login, body ou segredo na URL. A resposta precisa ser JSON de até 1.024 bytes e corresponder exatamente ao contrato real:

| HTTP | DTO aceito | Resultado local |
| --- | --- | --- |
| 200 | `{ ok: true, complete: 0..200, failed: 0 }` | Sucesso, exit 0; zero contas também é uma resposta válida. |
| 503 | `{ ok: false, complete, failed }`, `failed > 0`, soma até 200 | Falha relatada com contagens, exit 1; não certifica que toda claim falha foi liberada. |
| 403 | `{ ok: false, code: "FORBIDDEN" }` | Recusa relatada, exit 1. |
| 503 | `{ ok: false, code: "UNAVAILABLE" }` | Indisponível, resultado remoto incerto, exit 1. |

Campos extras, contagens inválidas, HTML de proteção, status inesperado, JSON/UTF-8 inválido ou corpo excessivo falham fechados. A saída contém apenas operação, resultado, código fechado, status HTTP e contagens quando validadas; não contém resposta bruta, mensagens de exceção, headers ou valores do ambiente.

## Resultado incerto e capacidade

Timeout, perda de resposta ou erro de transporte retornam `REMOTE_RESULT_UNKNOWN`. **Não existe retry automático.** O limite de 30 segundos aborta somente a espera/requisição do cliente; o job remoto pode continuar. Não liberar claims ou repetir por suposição. Uma claim Google `running` não tem expiração automática; seguir o [procedimento de recuperação](../../implementation/t025-calendario-google.md#recuperação-operacional) depois de comprovar que chamadas/processos anteriores terminaram.

A rota processa até 200 contas sequencialmente, com limites próprios de fontes/páginas. Esse teto não prova que a execução cabe na Vercel; o executor não muda deadline global, janela, quotas, cursor ou claims. Observar duração e resultados no ambiente pessoal antes de habilitar recorrência. Nenhuma conexão Google, conta fixture remota ou execução real foi usada para validar esta ferramenta.

## Exemplo de scheduler — não ativo

O [exemplo GitHub Actions](google-calendar-cron.yml) está nesta pasta de documentos, **fora de `.github/workflows`**. Ele usa o executor sem `npm install` e obtém o segredo privado somente no ambiente do step Node, nunca numa linha `curl -H` ou em argv. `contents: read` limita o token, checkout usa `persist-credentials: false` e o job só executa para `refs/heads/main`; não há evento pull request, parâmetro de branch/ref ou checkout derivado de input do operador. Não é ativado pelo CI do repositório.

**RECOMENDADO:** `17 5 * * *` em UTC, correspondente a 02:17 em Fortaleza. GitHub usa UTC por padrão, executa schedules na branch padrão e pode atrasar ou perder disparos sob carga; em repositórios públicos, schedules podem ser desabilitados após 60 dias sem atividade. Conferir disponibilidade/custos do plano antes de escolher o scheduler. [Regras oficiais de schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

`concurrency` com `cancel-in-progress: false` não cancela o job Actions anterior quando chega outro. O operador ainda pode cancelar manualmente um job e o timeout do job continua vigente. Essa configuração não cria lock global, não impede outro operador de chamar a rota e não cancela trabalho remoto após timeout. Somente as claims/revisões do domínio e a prova de término das operações protegem a recuperação; não usar repetição automática para contornar esse limite. Segredos de Actions precisam permanecer no armazenamento privado e fora de logs; [orientação oficial](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

Copiar o exemplo para `.github/workflows`, cadastrar o segredo e publicar na branch padrão são etapas de **ativação remota**, não realizadas por esta entrega. Confirmar a escolha do operador, revisar o SHA usado, cadastrar a chave somente no escopo pessoal, conferir OAuth/capacidade, executar uma rodada supervisionada e registrar status/contagens/horário sem dados privados. Isso não encerra os aceites reais das issues #32/#35.
