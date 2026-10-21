# Agenda pessoal do Calendário Google

O [workflow](../../.github/workflows/google-calendar-production.yml) usa o [executor existente](../../scripts/operations/google-calendar-cron.mjs), com uma chamada ao endpoint fixo de produção pessoal. A execução manual exige `main`. O disparo diário só executa o job quando a variável de repositório `SC_GOOGLE_CALENDAR_SCHEDULER_ENABLED` for exatamente `true`; ausente, vazia ou `false`, a agenda permanece inativa. Não há evento de push ou pull request.

## Migração para o domínio canônico — preparo em 21/10/2026

Esta fatia usa a base já publicada em produção `b67f58ac3973fcef5f45daa23f36cdf84432a3fb`, cabeça da [PR70](https://github.com/kauanbarateli/Segundo-Cerebro/pull/70). A main remota ainda está em f3d1896, ancestral que não contém as páginas legais e o diagnóstico de Auth publicados; não selecionar essa versão antiga para deploy. A PR desta correção deve ser empilhada na branch da PR70, preservando o pacote aprovado. A branch de revisão tem deploy automático desativado em `vercel.json`; main e produção exigem revisão coordenada das dependências.

**Implementado nesta fatia, com CI e ativação pendentes:** executor, workflow pessoal e exemplo documental usam exclusivamente `https://www.segundocerebroapp.com.br/api/cron/google-calendar`. O teste focado prende o domínio literal e o `APP_URL` dos dois workflows independentemente das constantes do executor. O alias antigo e a raiz sem `www` permanecem recusados; `redirect: "error"`, segredo, opt-in, limites, ausência de retry e condição de `main` foram preservados. Não há alteração de OAuth, Supabase, Vercel ou dados por este preparo.

**OBSERVADO na origem anterior:** o [scheduler original de 21/10, run 39583365671](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39583365671), executou em `main`, SHA `f3d18960a41076e99aa60dcc9f6b46967970ebb5`, com `APP_URL=https://segundo-cerebro-of.vercel.app`. Retornou `OK`, HTTP 200, `complete=0` e `failed=0`; a variável de ativação foi lida como `true`. Esse resultado não comprova sincronização de uma conta, ausência de eventos, funcionamento do novo destino ou recuperação de senha.

**Validação pendente, coordenada pela Root:**

1. Publicar e revisar esta fatia separadamente, após os runs originais da integração Capture terminarem. No GitHub, executar os testes focados com `node --test tests/scripts/google-calendar-cron.test.mjs`, o scanner `node scripts/check-secrets.mjs` e os checks pertinentes do repositório; registrar o SHA efetivamente executado. Nenhum teste foi rodado localmente nesta máquina de 8 GB.
2. Antes de publicar a mudança na branch padrão, coordenar a suspensão dos próximos disparos e comprovar o término dos já iniciados. Pausar a variável ou cancelar um job não prova término remoto; não cancelar nem repetir chamadas como forma de validação.
3. Conferir que o domínio `www` atende o deployment pessoal aprovado e mantém a mesma autorização da rota. Preservar o segredo existente e os callbacks durante a transição. Não habilitar redirects, outro host ou fallback entre segredos.
4. Depois da revisão e da publicação coordenada, realizar somente a rodada supervisionada autorizada para `main` e conferir resultado fechado e registro correspondente no Admin. Zero contas não satisfaz o aceite de sincronização real; timeout ou resultado incerto requerem a recuperação operacional, sem retry automático.
5. Restabelecer a ativação somente após a conferência e observar o próximo scheduler original. Registrar o resultado no domínio novo com SHA/horário/contagens permitidas; aceites humanos de calendários e recuperação continuam separados.

## Preparação manual

1. Em **Settings → Secrets and variables → Actions → Secrets** do repositório pessoal, cadastre `GOOGLE_CALENDAR_CRON_SECRET` com o mesmo valor privado da rota hospedada. Não enviar o valor ao chat, colocá-lo em argumentos ou registrá-lo em logs. Ele deve permanecer independente de `CRON_SECRET`, Auth, Admin e demais chaves. O CLI falha antes da chamada se o segredo estiver ausente ou inválido, com o código fechado `CONFIGURATION_INVALID`.
2. Em **Variables**, mantenha `SC_GOOGLE_CALENDAR_SCHEDULER_ENABLED=false` ou ausente. Confirme a configuração OAuth e o deployment pessoal aprovado conforme o [guia operacional](configuracoes-pendentes-passo-a-passo.md#3-google-calendar-oauth-pessoal-duas-contas-e-cron) e o [contrato do executor](examples/google-calendar-cron.md).
3. Depois da publicação do workflow, abra **Actions → Google Calendar — produção pessoal → Run workflow**, selecione **main** e faça uma execução supervisionada. Não há inputs de URL, segredo ou ref alternativo no workflow.
4. Confira exit 0 e saída validada `outcome=complete`, `code=OK`, `http_status=200`, `failed=0`. No Admin, confira o registro correspondente da execução Google. Registre SHA, horário e contagens, sem tokens, IDs ou payloads privados. `complete=0` é válido para o executor, mas não prova sincronização de uma conta conectada nem os demais aceites da [issue #32](https://github.com/kauanbarateli/Segundo-Cerebro/issues/32).
5. Somente após o HTTP 200 validado e a conferência no Admin, defina a variável como `true`. Observe também o primeiro disparo diário. Para suspender os próximos disparos, volte a `false`; isso não cancela uma execução já iniciada.

## Limites da execução

A agenda é `17 5 * * *` UTC, correspondente a 02:17 em Fortaleza, sem garantia do minuto exato. O token do workflow tem somente `contents: read`; o segredo existe apenas no step do executor. Checkout não persiste credenciais, não há instalação de dependências, SQL Supabase, deploy ou alteração de configuração do aplicativo.

O executor faz um único GET HTTPS, sem redirects ou retries, com prazo de cliente de 30 segundos e resposta fechada limitada a 1.024 bytes. `concurrency` não cancela a execução anterior. Timeout, cancelamento ou `REMOTE_RESULT_UNKNOWN` não comprovam término remoto nem liberam claims: não repetir por suposição; seguir a [recuperação operacional](../implementation/t025-calendario-google.md#recuperação-operacional).

## Execução confirmada em 12/10/2026

O mantenedor cadastrou o segredo no repositório. A [rodada supervisionada 38267560938](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38267560938), no SHA `b8bf4ced273c6507c04385db706b06c49d01f53c`, concluiu com HTTP 200, `complete=2` e `failed=0`. Duas execuções `Agendada · Concluída` foram conferidas no Admin às 12:04 em Fortaleza. Em seguida a variável foi definida e reconferida como `true`.

A rotina diária foi habilitada nesse checkpoint. A observação posterior de 21/10 e a migração de domínio têm o registro separado acima. Não repetir o despacho manual para obter uma observação agendada. Os demais critérios OAuth/calendário/backup conservam seus próprios aceites. [Evidência e limites](../implementation/google-producao-20261012.md).

Antes de uma janela de backup, desabilitar os próximos disparos, impedir dispatch manual e confirmar o término das operações já iniciadas. Alterar a variável ou cancelar um job não prova término remoto e não substitui a pausa dos demais escritores.
