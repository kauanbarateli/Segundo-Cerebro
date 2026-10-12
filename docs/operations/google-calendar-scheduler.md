# Agenda pessoal do Calendário Google

O [workflow](../../.github/workflows/google-calendar-production.yml) usa o [executor existente](../../scripts/operations/google-calendar-cron.mjs), com uma chamada ao endpoint fixo de produção pessoal. A execução manual exige `main`. O disparo diário só executa o job quando a variável de repositório `SC_GOOGLE_CALENDAR_SCHEDULER_ENABLED` for exatamente `true`; ausente, vazia ou `false`, a agenda permanece inativa. Não há evento de push ou pull request.

## Preparação manual

1. Em **Settings → Secrets and variables → Actions → Secrets** do repositório pessoal, cadastre `GOOGLE_CALENDAR_CRON_SECRET` com o mesmo valor privado da rota hospedada. Não enviar o valor ao chat, colocá-lo em argumentos ou registrá-lo em logs. Ele deve permanecer independente de `CRON_SECRET`, Auth, Admin e demais chaves. O CLI falha antes da chamada se o segredo estiver ausente ou inválido, com o código fechado `CONFIGURATION_INVALID`.
2. Em **Variables**, mantenha `SC_GOOGLE_CALENDAR_SCHEDULER_ENABLED=false` ou ausente. Confirme a configuração OAuth e o deployment pessoal aprovado conforme o [guia operacional](configuracoes-pendentes-passo-a-passo.md#3-google-calendar-oauth-pessoal-duas-contas-e-cron) e o [contrato do executor](examples/google-calendar-cron.md).
3. Depois da publicação do workflow, abra **Actions → Google Calendar — produção pessoal → Run workflow**, selecione **main** e faça uma execução supervisionada. Não há inputs de URL, segredo ou ref alternativo no workflow.
4. Confira exit 0 e saída validada `outcome=complete`, `code=OK`, `http_status=200`, `failed=0`. No Admin, confira o registro correspondente da execução Google. Registre SHA, horário e contagens, sem tokens, IDs ou payloads privados. `complete=0` é válido para o executor, mas não prova sincronização de uma conta conectada nem os demais aceites da [issue #32](https://github.com/kauanbarateli/Segundo-Cerebro/issues/32).
5. Somente após o HTTP 200 validado e a conferência no Admin, defina a variável como `true`. Observe também o primeiro disparo diário. Para suspender os próximos disparos, volte a `false`; isso não cancela uma execução já iniciada.

## Limites da execução

A agenda é `17 5 * * *` UTC, correspondente a 02:17 em Fortaleza, sem garantia do minuto exato. O token do workflow tem somente `contents: read`; o segredo existe apenas no step do executor. Checkout não persiste credenciais, não há instalação de dependências, SQL Supabase, deploy ou alteração de configuração do aplicativo.

O executor faz um único GET HTTPS, sem redirects ou retries, com prazo de cliente de 30 segundos e resposta fechada limitada a 1.024 bytes. `concurrency` não cancela a execução anterior. Timeout, cancelamento ou `REMOTE_RESULT_UNKNOWN` não comprovam término remoto nem liberam claims: não repetir por suposição; seguir a [recuperação operacional](../implementation/t025-calendario-google.md#recuperação-operacional).

Esta preparação não cadastrou segredo/variável, publicou, disparou ou validou um job. A ativação e seus resultados reais ficam para o operador autorizado; não encerram por si só os demais critérios de OAuth, calendário ou backup.
