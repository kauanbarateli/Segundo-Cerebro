# Agendamento da manutenção

Destino: projeto Vercel `segundo-cerebro-of`, organização pessoal e Supabase `rishenjoikgmfubmnfiu`. Os arquivos deste guia não ativam jobs. A ativação e a execução remota permanecem pendentes no modo manual da OP-012. Não usar BlackSheep/VOE.

## Limpeza de arquivos

`/api/files/cleanup` aceita GET e POST com o mesmo guard, antes de configurar o cliente privilegiado. `CRON_SECRET` exige pelo menos 32 bytes; o header deve ser exatamente `Authorization: Bearer <segredo>`, limitado a 1.024 caracteres. Sem segredo válido, nenhum candidato ou objeto é processado. Respostas não são cacheadas; sucesso retorna somente `removed`/`failed`. Falha parcial retorna HTTP 503 com as contagens, sem detalhes do provedor.

O [cron nativo Vercel](https://vercel.com/docs/cron-jobs) usa GET no deployment Production, com horário UTC. A Vercel envia automaticamente o `CRON_SECRET` no [header de autorização](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs); não se põe chave na URL. O User-Agent e o header de agenda não substituem esse segredo.

O [exemplo de configuração](examples/vercel-cleanup.json) fica em docs, fora da configuração ativa. **RECOMENDADO:** execução diária às 06:00 UTC, correspondente a 03:00 em Fortaleza. O [plano Hobby](https://vercel.com/docs/cron-jobs/usage-and-pricing) admite cadência diária e pode invocar dentro da hora; não promete minuto exato.

Antes de ativar:

1. Conferir o catálogo, as migrations aplicadas e as policies dos buckets pessoais. A definição da 015 já foi confirmada pelo catálogo readonly hospedado. O desvio de default ACL anterior deixou de ocorrer após a aplicação informada da [016](../implementation/sequence-defaults.md): em 09/10 às 22:51:10.820 em Fortaleza, o catálogo readonly hospedado passou em 1.246 checks, sem desvios. Preservar 001–016 sem reaplicação ou bootstrap e os demais ensaios de manutenção antes da ativação. A contagem local de 1.243 não é uma exigência de contagem hospedada. O [relatório da correção](../implementation/cleanup-fairness.md) registra o fingerprint, os testes e os limites. Asserções com fixtures são somente para base dedicada vazia.
2. Cadastrar `CRON_SECRET` exclusivo em Production, diferente das chaves Auth/Admin/Supabase/Google. Os valores ficam somente na configuração privada, nunca em chat, Git, argumentos ou logs.
3. Revisar o exemplo e incorporar sua entrada `crons` à configuração do projeto; não substituir configurações preexistentes. O próximo deployment registra o agendamento.
4. Observar uma execução autorizada, seu status e as contagens; conferir reconciliação e proteção de vínculos/quota no ambiente de teste dedicado.

A Vercel [não repete automaticamente uma falha e pode entregar execuções duplicadas ou perdidas](https://vercel.com/docs/cron-jobs/manage-cron-jobs#cron-job-error-handling). Preservar a reconciliação do banco e observar as contagens; HTTP 503 não comprova retry. A disputa entre limpeza e vínculo precisa de teste com conexões sobrepostas. Se o tempo exceder a função, interromper a ativação e revisar a unidade de trabalho; não simular durabilidade com chamadas encadeadas.

A seleção da 015 ordena pela primeira expiração ou pelo último ACK mais um dia. Um ACK bem-sucedido permite avançar outros candidatos; remoções que falham permanentemente continuam sem confirmação e podem ocupar o lote. Contagens de falha exigem investigação, não certificam progresso por si mesmas.

## Calendário Google

`/api/cron/google-calendar` já aceita GET/POST, mas exige `GOOGLE_CALENDAR_CRON_SECRET`, próprio do Calendário. O header automático da Vercel usa `CRON_SECRET`; cadastrar a rota diretamente no cron nativo com os segredos distintos não satisfaz seu guard. Não igualar segredos para contornar essa diferença. O exemplo deste guia agenda somente a limpeza.

O [executor externo preparado](examples/google-calendar-cron.md) fornece o Bearer próprio sem argumentos, URL secreta ou leitura automática de `.env`. `npm run google:cron:help` e `google:cron:check` não fazem rede; `run` exige opt-in literal para o projeto pessoal e envia um único GET ao alias HTTPS fixo. Há [exemplo de agenda](examples/google-calendar-cron.yml) somente em docs, fora de `.github/workflows`. Nenhum job foi ativado.

Configurar um scheduler capaz de fornecer esse header após cadastrar o cliente OAuth e conferir a capacidade. A implementação limita a seleção a 200 contas e processa cada uma sequencialmente; essa contagem não é prova de que a execução cabe no hosting. O executor valida DTO/status/contagens, limita resposta a 1.024 bytes e aguarda no máximo 30 segundos pela resposta inteira. Timeout ou perda de resposta resultam em operação remota incerta, sem retry automático: abortar o cliente não prova término do servidor. Pode restar claim `running`; nunca a expirar/liberar automaticamente ou iniciar concorrente com a mesma identificação. Seguir [recuperação operacional](../implementation/t025-calendario-google.md#recuperação-operacional) somente após provar que todas as chamadas anteriores terminaram. A opção de não cancelar jobs sobrepostos no scheduler não é um lock remoto ou global.

## Backup

Backup/restauração usam o [operador privado](backup-restore-release.md), com PostgreSQL nativo, quiescência, destino externo privado e perfil/chave próprios. Um cron HTTP na Vercel não fornece esses pré-requisitos e não certifica o backup agendado. Preservar o procedimento e o aceite real de restore/Cofre.
